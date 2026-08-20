import { createResult, createResultError, type Result } from "#result"
import type { OpenApiCatalog } from "./openApiCatalog.js"
import { openApiValueCanonicalize } from "./openApiValueCanonicalize.js"

const operationMethods = new Set(["delete", "get", "head", "options", "patch", "post", "put", "trace"])

function stringCompare(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function canonicalRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? (openApiValueCanonicalize(value) as Record<string, unknown>) : {}
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function referenceTarget(root: Record<string, unknown>, reference: string): unknown {
  if (!reference.startsWith("#/")) return undefined

  return reference
    .slice(2)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce<unknown>((value, part) => (isRecord(value) ? value[part] : undefined), root)
}

function valueResolve(value: unknown, root: Record<string, unknown>, references: Set<string> = new Set()): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => valueResolve(item, root, references))
  }
  if (!isRecord(value)) return value

  const reference = stringValue(value.$ref)
  if (reference && !references.has(reference)) {
    const target = referenceTarget(root, reference)
    if (target !== undefined) {
      const nextReferences = new Set(references)
      nextReferences.add(reference)
      const resolvedTarget = valueResolve(target, root, nextReferences)
      const siblings = Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== "$ref")
          .map(([key, item]) => [key, valueResolve(item, root, references)]),
      )
      if (isRecord(resolvedTarget)) return { ...resolvedTarget, ...siblings }
      return siblings
    }
  }

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, valueResolve(item, root, references)]))
}

function operationFolder(operationId: string): string {
  return operationId
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

function fallbackOperationId(method: string, path: string): string {
  const pathName = path.replace(/[{}]/g, "").split("/").filter(Boolean).join("-")
  const suffix = pathName.length > 0 ? pathName : "root"
  return `${method}${suffix.replace(
    /(^|-)([a-z])/g,
    (_match, separator: string, letter: string) => `${separator}${letter.toUpperCase()}`,
  )}`
}

function schemaFrom(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return openApiValueCanonicalize(value) as Record<string, unknown>
  }

  return {}
}

function contentNormalize(
  value: unknown,
): Array<{ mediaType: string; schema: Record<string, unknown>; [key: string]: unknown }> {
  if (!isRecord(value)) {
    return []
  }

  return Object.keys(value)
    .sort()
    .map((mediaType) => {
      const media = isRecord(value[mediaType]) ? value[mediaType] : {}
      return {
        ...canonicalRecord(media),
        mediaType,
        schema: schemaFrom(media.schema),
      }
    })
}

function parameterNormalize(
  value: unknown,
  root: Record<string, unknown>,
): OpenApiCatalog["operations"][number]["parameters"][number] | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const resolved = valueResolve(value, root)
  if (!isRecord(resolved)) return undefined

  const reference = stringValue(value.$ref)
  const name = stringValue(resolved.name) ?? (reference ? reference : undefined)
  const location = stringValue(resolved.in) ?? (reference ? "ref" : undefined)
  if (!name || !location) {
    return undefined
  }

  const schemaValue =
    resolved.schema ?? (resolved.content ? { content: openApiValueCanonicalize(resolved.content) } : {})
  const description = stringValue(resolved.description)

  return {
    ...canonicalRecord(resolved),
    name,
    location,
    in: location,
    required: resolved.required === true,
    schema: schemaFrom(schemaValue),
    ...(description ? { description } : {}),
  }
}

function parametersNormalize(
  values: unknown,
  root: Record<string, unknown>,
): OpenApiCatalog["operations"][number]["parameters"] | undefined {
  if (values === undefined) {
    return []
  }
  if (!Array.isArray(values)) {
    return undefined
  }

  const parameters = values.flatMap((value) => {
    const parameter = parameterNormalize(value, root)
    return parameter ? [parameter] : []
  })

  return parameters.sort((left, right) =>
    stringCompare(`${left.location}:${left.name}`, `${right.location}:${right.name}`),
  )
}

function parametersMerge(
  pathParameters: OpenApiCatalog["operations"][number]["parameters"],
  operationParameters: OpenApiCatalog["operations"][number]["parameters"],
): OpenApiCatalog["operations"][number]["parameters"] {
  const merged = new Map(pathParameters.map((parameter) => [`${parameter.location}:${parameter.name}`, parameter]))
  for (const parameter of operationParameters) {
    merged.set(`${parameter.location}:${parameter.name}`, parameter)
  }
  return [...merged.values()].sort((left, right) =>
    stringCompare(`${left.location}:${left.name}`, `${right.location}:${right.name}`),
  )
}

function responsesNormalize(
  value: unknown,
  root: Record<string, unknown>,
): OpenApiCatalog["operations"][number]["responses"] | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  return Object.keys(value)
    .sort((left, right) => {
      if (left === "default") return 1
      if (right === "default") return -1
      return Number(left) - Number(right) || stringCompare(left, right)
    })
    .flatMap((status) => {
      const responseValue = valueResolve(value[status], root)
      const response = isRecord(responseValue) ? responseValue : undefined
      if (!response) return []
      const description = stringValue(response.description)
      return [
        {
          ...canonicalRecord(response),
          status,
          ...(description ? { description } : {}),
          content: contentNormalize(response.content),
        },
      ]
    })
}

export function openApiCatalogNormalize(document: unknown): Result<OpenApiCatalog> {
  const op = "openApiCatalogNormalize"
  if (!isRecord(document)) {
    return createResultError(op, "OpenAPI document must be an object")
  }

  const openapi = stringValue(document.openapi)
  if (!openapi) {
    return createResultError(op, "OpenAPI document is missing openapi")
  }

  if (!isRecord(document.paths)) {
    return createResultError(op, "OpenAPI document is missing paths")
  }

  const operations: OpenApiCatalog["operations"] = []
  const operationIds = new Set<string>()
  const documentSecurity = Array.isArray(document.security)
    ? (openApiValueCanonicalize(document.security) as Array<Record<string, string[]>>)
    : undefined
  const components = isRecord(document.components) ? document.components : undefined
  const componentSecuritySchemes = isRecord(components?.securitySchemes) ? components.securitySchemes : undefined
  const securitySchemes = componentSecuritySchemes
    ? Object.fromEntries(
        Object.keys(componentSecuritySchemes)
          .sort()
          .map((name) => [name, canonicalRecord(valueResolve(componentSecuritySchemes[name], document))]),
      )
    : undefined
  for (const path of Object.keys(document.paths).sort()) {
    const resolvedPathItem = valueResolve(document.paths[path], document)
    if (!isRecord(resolvedPathItem)) continue
    const pathItem = resolvedPathItem

    const pathParameters = parametersNormalize(pathItem.parameters, document)
    if (!pathParameters) {
      return createResultError(op, `Invalid parameters for path ${path}`)
    }

    for (const method of [...operationMethods].sort()) {
      const operationValue = valueResolve(pathItem[method], document)
      if (operationValue === undefined) continue
      if (!isRecord(operationValue)) {
        return createResultError(op, `Invalid ${method.toUpperCase()} operation for path ${path}`)
      }
      const operation = operationValue

      const operationParameters = parametersNormalize(operation.parameters, document)
      if (!operationParameters) {
        return createResultError(op, `Invalid parameters for ${method.toUpperCase()} ${path}`)
      }

      const responses = responsesNormalize(operation.responses, document)
      if (!responses || responses.length === 0) {
        return createResultError(op, `Missing responses for ${method.toUpperCase()} ${path}`)
      }

      const operationId = stringValue(operation.operationId) ?? fallbackOperationId(method, path)
      if (operationIds.has(operationId)) {
        return createResultError(op, `Duplicate operationId ${operationId}`)
      }
      operationIds.add(operationId)

      const summary = stringValue(operation.summary) ?? stringValue(operation.description)
      const resolvedRequestBody = valueResolve(operation.requestBody, document)
      const requestBody = isRecord(resolvedRequestBody)
        ? {
            ...canonicalRecord(resolvedRequestBody),
            required: resolvedRequestBody.required === true,
            content: contentNormalize(resolvedRequestBody.content),
          }
        : undefined

      const description = stringValue(operation.description)
      const tags = Array.isArray(operation.tags)
        ? operation.tags.filter((tag): tag is string => typeof tag === "string")
        : []
      const externalDocs = isRecord(operation.externalDocs)
        ? (openApiValueCanonicalize(valueResolve(operation.externalDocs, document)) as Record<string, unknown>)
        : undefined
      const security = Array.isArray(operation.security)
        ? (openApiValueCanonicalize(operation.security) as Array<Record<string, string[]>>)
        : documentSecurity
      const servers = Array.isArray(operation.servers)
        ? operation.servers
        : Array.isArray(pathItem.servers)
          ? pathItem.servers
          : undefined

      operations.push({
        ...canonicalRecord(operation),
        operationId,
        folder: operationFolder(operationId),
        method: method.toUpperCase(),
        path,
        ...(summary ? { summary } : {}),
        ...(description ? { description } : {}),
        ...(tags.length > 0 ? { tags } : {}),
        ...(operation.deprecated === true ? { deprecated: true } : {}),
        ...(externalDocs ? { externalDocs } : {}),
        parameters: parametersMerge(pathParameters, operationParameters),
        ...(requestBody ? { requestBody } : {}),
        responses,
        ...(security ? { security } : {}),
        ...(servers ? { servers: openApiValueCanonicalize(valueResolve(servers, document)) } : {}),
      })
    }
  }

  operations.sort((left, right) => stringCompare(left.operationId, right.operationId))
  const info = isRecord(document.info) ? document.info : {}
  const title = stringValue(info.title)
  const version = stringValue(info.version)
  const description = stringValue(info.description)
  const servers = Array.isArray(document.servers)
    ? (openApiValueCanonicalize(valueResolve(document.servers, document)) as OpenApiCatalog["source"]["servers"])
    : undefined
  return createResult({
    version: 1,
    source: {
      openapi,
      ...(title ? { title } : {}),
      ...(version ? { version } : {}),
      ...(description ? { description } : {}),
      ...(servers ? { servers } : {}),
      ...(documentSecurity ? { security: documentSecurity } : {}),
      ...(securitySchemes ? { securitySchemes } : {}),
    },
    operations,
  })
}
