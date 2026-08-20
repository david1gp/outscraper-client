import { createResult, createResultError, type Result } from "#result"
import type { OpenApiCatalog } from "./openApiCatalog.js"
import { openApiValueCanonicalize } from "./openApiValueCanonicalize.js"

function stringCompare(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function sourceModulePath(value: string): string {
  return value.match(/(?:from|export \* from) "([^"]+)"/)?.[1] ?? value
}

function sourceModuleCompare(left: string, right: string): number {
  const leftParts = sourceModulePath(left).split("/")
  const rightParts = sourceModulePath(right).split("/")
  const length = Math.min(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const comparison = stringCompare(leftParts[index] ?? "", rightParts[index] ?? "")
    if (comparison !== 0) return comparison
  }
  return leftParts.length - rightParts.length || stringCompare(left, right)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function sourceIdentifier(value: string): string {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)

  const identifier = words
    .map((word, index) => {
      const lower = word.toLowerCase()
      return index === 0 ? lower : `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`
    })
    .join("")

  return /^[a-zA-Z_$]/.test(identifier) ? identifier : `operation${identifier}`
}

function typeIdentifier(value: string): string {
  const identifier = sourceIdentifier(value)
  return `${identifier.slice(0, 1).toUpperCase()}${identifier.slice(1)}`
}

function operationFunctionName(operation: OpenApiCatalog["operations"][number]): string {
  const method = operation.method.toLowerCase()
  const methodPrefix = new RegExp(`^${method}`, "i")
  const subject = operation.operationId.replace(methodPrefix, "")
  const subjectIdentifier = sourceIdentifier(subject.length > 0 ? subject : operation.operationId)
  return `${subjectIdentifier}${method.slice(0, 1).toUpperCase()}${method.slice(1)}`
}

function sourceValue(value: unknown): string {
  return JSON.stringify(value)
}

function schemaContent(schema: Record<string, unknown>): Record<string, unknown> {
  const content = schema.content
  if (!isRecord(content)) {
    return schema
  }

  const mediaTypes = Object.keys(content).sort((left, right) => {
    const leftJson = left === "application/json" ? 0 : 1
    const rightJson = right === "application/json" ? 0 : 1
    return leftJson - rightJson || stringCompare(left, right)
  })
  const firstMediaType = mediaTypes[0]
  const media = firstMediaType ? content[firstMediaType] : undefined
  return isRecord(media) && isRecord(media.schema) ? media.schema : {}
}

function schemaBaseSource(schemaInput: Record<string, unknown>): string {
  const schema = schemaContent(schemaInput)
  const nullable = schema.nullable === true
  const enumValues = Array.isArray(schema.enum) ? schema.enum : undefined
  const constValue = schema.const

  let source: string
  if (constValue !== undefined) {
    source = `v.literal(${sourceValue(constValue)})`
  } else if (enumValues && enumValues.length > 0) {
    const literals = enumValues.map((value) => `v.literal(${sourceValue(value)})`)
    source = literals.length === 1 ? (literals[0] ?? "v.unknown()") : `v.union([${literals.join(", ")}])`
  } else if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const alternatives = (schema.oneOf ?? schema.anyOf) as unknown[]
    const schemas = alternatives.filter(isRecord).map((item) => schemaBaseSource(item))
    source =
      schemas.length === 0
        ? "v.unknown()"
        : schemas.length === 1
          ? (schemas[0] ?? "v.unknown()")
          : `v.union([${schemas.join(", ")}])`
  } else if (Array.isArray(schema.allOf)) {
    const schemas = schema.allOf.filter(isRecord).map((item) => schemaBaseSource(item))
    source =
      schemas.length === 0
        ? "v.unknown()"
        : schemas.length === 1
          ? (schemas[0] ?? "v.unknown()")
          : `v.intersect([${schemas.join(", ")}])`
  } else {
    const type = schema.type
    if (Array.isArray(type)) {
      const types = type.map((item) => ({ type: item })).filter(isRecord)
      const schemas = types.map((item) => schemaBaseSource(item))
      source =
        schemas.length === 0
          ? "v.unknown()"
          : schemas.length === 1
            ? (schemas[0] ?? "v.unknown()")
            : `v.union([${schemas.join(", ")}])`
    } else if (type === "string") {
      const actions: string[] = []
      if (typeof schema.minLength === "number") actions.push(`v.minLength(${sourceValue(schema.minLength)})`)
      if (typeof schema.maxLength === "number") actions.push(`v.maxLength(${sourceValue(schema.maxLength)})`)
      if (typeof schema.pattern === "string") {
        try {
          new RegExp(schema.pattern)
          actions.push(`v.regex(new RegExp(${sourceValue(schema.pattern)}))`)
        } catch {
          // Invalid regular expressions are ignored rather than making generation fail.
        }
      }
      source = actions.length > 0 ? `v.pipe(v.string(), ${actions.join(", ")})` : "v.string()"
    } else if (type === "number" || type === "integer") {
      const actions: string[] = []
      if (type === "integer") actions.push("v.integer()")
      if (typeof schema.minimum === "number") actions.push(`v.minValue(${sourceValue(schema.minimum)})`)
      if (typeof schema.maximum === "number") actions.push(`v.maxValue(${sourceValue(schema.maximum)})`)
      if (typeof schema.exclusiveMinimum === "number")
        actions.push(`v.gtValue(${sourceValue(schema.exclusiveMinimum)})`)
      if (typeof schema.exclusiveMaximum === "number")
        actions.push(`v.ltValue(${sourceValue(schema.exclusiveMaximum)})`)
      if (schema.exclusiveMinimum === true && typeof schema.minimum === "number")
        actions.push(`v.gtValue(${sourceValue(schema.minimum)})`)
      if (schema.exclusiveMaximum === true && typeof schema.maximum === "number")
        actions.push(`v.ltValue(${sourceValue(schema.maximum)})`)
      if (typeof schema.multipleOf === "number") actions.push(`v.multipleOf(${sourceValue(schema.multipleOf)})`)
      source = actions.length > 0 ? `v.pipe(v.number(), ${actions.join(", ")})` : "v.number()"
    } else if (type === "boolean") {
      source = "v.boolean()"
    } else if (type === "null") {
      source = "v.null()"
    } else if (type === "array") {
      const itemSchema = isRecord(schema.items) ? schemaBaseSource(schema.items) : "v.unknown()"
      const actions: string[] = []
      if (typeof schema.minItems === "number") actions.push(`v.minLength(${sourceValue(schema.minItems)})`)
      if (typeof schema.maxItems === "number") actions.push(`v.maxLength(${sourceValue(schema.maxItems)})`)
      source = actions.length > 0 ? `v.pipe(v.array(${itemSchema}), ${actions.join(", ")})` : `v.array(${itemSchema})`
    } else if (type === "object" || isRecord(schema.properties)) {
      const properties = isRecord(schema.properties) ? schema.properties : {}
      const required = new Set(
        Array.isArray(schema.required)
          ? schema.required.filter((item): item is string => typeof item === "string")
          : [],
      )
      const entries = Object.keys(properties)
        .sort(stringCompare)
        .map((name) => {
          const property = isRecord(properties[name]) ? properties[name] : {}
          const propertySource = schemaFieldSource(property, required.has(name))
          return `${sourceValue(name)}: ${propertySource}`
        })
      if (entries.length === 0) {
        source = isRecord(schema.additionalProperties)
          ? `v.record(v.string(), ${schemaBaseSource(schema.additionalProperties)})`
          : "v.looseObject({})"
      } else {
        source = `v.looseObject({${entries.join(", ")}})`
      }
    } else {
      source = "v.unknown()"
    }
  }

  return nullable ? `v.nullable(${source})` : source
}

function schemaFieldSource(schema: Record<string, unknown>, required: boolean): string {
  const base = schemaBaseSource(schema)
  if (required) return base
  if (!Object.hasOwn(schema, "default")) return `v.optional(${base})`

  const defaultValue = schema.default
  if (defaultValue === null) return `v.optional(v.nullable(${base}), null)`
  if (!schemaDefaultCompatible(schema, defaultValue)) return `v.optional(${base})`
  return `v.optional(${base}, ${sourceValue(defaultValue)})`
}

function schemaDefaultCompatible(schema: Record<string, unknown>, value: unknown): boolean {
  const enumValues = Array.isArray(schema.enum) ? schema.enum : undefined
  if (enumValues && !enumValues.some((item) => Object.is(item, value))) return false
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const alternatives = (Array.isArray(schema.oneOf) ? schema.oneOf : schema.anyOf) as unknown[]
    return alternatives.some((item: unknown) => isRecord(item) && schemaDefaultCompatible(item, value))
  }
  if (schema.type === "string") return typeof value === "string"
  if (schema.type === "number") return typeof value === "number"
  if (schema.type === "integer") return typeof value === "number" && Number.isInteger(value)
  if (schema.type === "boolean") return typeof value === "boolean"
  if (schema.type === "array") return Array.isArray(value)
  if (schema.type === "object") return isRecord(value)
  return true
}

function groupSchemaSource(
  parameters: OpenApiCatalog["operations"][number]["parameters"],
  location: string,
): { source: string; required: boolean } {
  const groupParameters = parameters.filter((parameter) => parameter.location === location)
  const required = groupParameters.some((parameter) => parameter.required)
  const entries = groupParameters
    .sort((left, right) => stringCompare(left.name, right.name))
    .map((parameter) => `${sourceValue(parameter.name)}: ${schemaFieldSource(parameter.schema, parameter.required)}`)
  const objectSource = `v.looseObject({${entries.join(", ")}})`
  return {
    source: required ? objectSource : `v.optional(${objectSource}, {})`,
    required,
  }
}

function exampleBaseSource(value: unknown, depth = 0): string {
  if (value === null || depth > 3) return "v.unknown()"
  if (typeof value === "string") return depth > 0 ? "v.nullable(v.string())" : "v.string()"
  if (typeof value === "number") return depth > 0 ? "v.nullable(v.number())" : "v.number()"
  if (typeof value === "boolean") return depth > 0 ? "v.nullable(v.boolean())" : "v.boolean()"
  if (Array.isArray(value)) {
    const firstItem = value[0]
    const itemSource = firstItem === undefined ? "v.unknown()" : exampleBaseSource(firstItem, depth + 1)
    return `v.array(${itemSource})`
  }
  if (!isRecord(value)) return "v.unknown()"

  const entries = Object.keys(value)
    .sort(stringCompare)
    .slice(0, 64)
    .map((name) => `${sourceValue(name)}: v.optional(${exampleBaseSource(value[name], depth + 1)})`)
  return `v.looseObject({${entries.join(", ")}})`
}

function responseSchemaSource(operation: OpenApiCatalog["operations"][number]): string {
  const schemas = operation.responses
    .filter((response) => /^2\d\d$/.test(response.status))
    .flatMap((response) =>
      response.content.map((content) => {
        if (response.status === "204" && Object.keys(content.schema).length === 0) return "v.undefined()"
        if (Object.keys(content.schema).length === 0 && Object.hasOwn(content, "example")) {
          return exampleBaseSource(content.example)
        }
        return schemaBaseSource(content.schema)
      }),
    )

  const uniqueSchemas = [...new Set(schemas)]
  if (uniqueSchemas.length === 0) return "v.unknown()"
  if (uniqueSchemas.length === 1) return uniqueSchemas[0] ?? "v.unknown()"
  return `v.union([${uniqueSchemas.join(", ")}])`
}

function inputSchemaSource(
  operation: OpenApiCatalog["operations"][number],
  functionName: string,
): { source: string; required: boolean } {
  const path = groupSchemaSource(operation.parameters, "path")
  const query = groupSchemaSource(operation.parameters, "query")
  const headers = groupSchemaSource(operation.parameters, "header")
  const bodyContent = operation.requestBody?.content.slice().sort((left, right) => {
    const leftJson = left.mediaType === "application/json" ? 0 : 1
    const rightJson = right.mediaType === "application/json" ? 0 : 1
    return leftJson - rightJson || stringCompare(left.mediaType, right.mediaType)
  })[0]
  const bodySchema = bodyContent
    ? schemaBaseSource(bodyContent.schema)
    : operation.requestBody
      ? "v.unknown()"
      : undefined
  const bodyRequired = operation.requestBody?.required === true
  const entries = [
    `path: ${path.source}`,
    `query: ${query.source}`,
    `headers: ${headers.source}`,
    ...(bodySchema ? [`body: ${bodyRequired ? bodySchema : `v.optional(${bodySchema})`}`] : []),
  ]
  const required = path.required || query.required || headers.required || bodyRequired
  return {
    source: `/* ${functionName} input is grouped by HTTP argument location. */\nv.object({${entries.join(", ")}})`,
    required,
  }
}

function definitionSource(operation: OpenApiCatalog["operations"][number], functionName: string): string {
  const definition = JSON.stringify(openApiValueCanonicalize(operation), null, 2)
  return `/* Generated by openApiCatalogGenerate. Do not edit. */\nexport const ${functionName}Definition = ${definition} as const\n`
}

function cliSource(
  operations: Array<{ operation: OpenApiCatalog["operations"][number]; functionName: string }>,
): string {
  const imports = operations.flatMap(({ operation, functionName }) => [
    `import { ${functionName} } from "./${operation.folder}/${functionName}.js"`,
    `import { ${functionName}Definition } from "./${operation.folder}/${functionName}Definition.js"`,
  ])
  const commands = operations.map(
    ({ functionName }) =>
      `const ${functionName}CliCommand = outscraperCliCommandBuild({\n  definition: ${functionName}Definition,\n  execute: ${functionName},\n})`,
  )
  const methods = [...new Set(operations.map(({ operation }) => operation.method.toLowerCase()))].sort(stringCompare)
  const routeMaps = methods.map((method) => {
    const methodOperations = operations.filter(({ operation }) => operation.method.toLowerCase() === method)
    const routes = methodOperations
      .map(({ operation, functionName }) => {
        const prefix = `${method}-`
        const route = operation.folder.startsWith(prefix) ? operation.folder.slice(prefix.length) : operation.folder
        return `    ${sourceValue(route)}: ${functionName}CliCommand,`
      })
      .join("\n")
    return `const ${method}CliCommands = buildRouteMap({\n  routes: {\n${routes}\n  },\n  docs: { brief: ${sourceValue(`${method.toUpperCase()} endpoint operations`)} },\n})`
  })
  const rootRoutes = methods.map((method) => `    ${sourceValue(method)}: ${method}CliCommands,`).join("\n")

  return [
    "/* Generated by openApiCatalogGenerate. Do not edit. */",
    'import { buildRouteMap } from "@stricli/core"',
    'import { outscraperCliCommandBuild } from "./cli/outscraperCliCommandBuild.js"',
    ...imports.sort(sourceModuleCompare),
    "",
    ...commands,
    "",
    ...routeMaps,
    "",
    "export const outscraperGeneratedCliCommands = buildRouteMap({",
    "  routes: {",
    rootRoutes,
    "  },",
    '  docs: { brief: "Outscraper API endpoint operations" },',
    "})",
    "",
  ].join("\n")
}

function inputSchemaFileSource(functionName: string, inputSource: string): string {
  return `/* Generated by openApiCatalogGenerate. Do not edit. */\nimport * as v from "valibot"\n\nexport const ${functionName}InputSchema = ${inputSource}\n\nexport type ${typeIdentifier(functionName)}Input = v.InferInput<typeof ${functionName}InputSchema>\n`
}

function responseSchemaFileSource(functionName: string, responseSource: string): string {
  return `/* Generated by openApiCatalogGenerate. Do not edit. */\nimport * as v from "valibot"\n\nexport const ${functionName}ResponseSchema = ${responseSource}\n\nexport type ${typeIdentifier(functionName)}Response = v.InferOutput<typeof ${functionName}ResponseSchema>\n`
}

function functionSource(
  operation: OpenApiCatalog["operations"][number],
  functionName: string,
  inputRequired: boolean,
  bodyContentMediaType?: string,
): string {
  const inputTypeName = `${typeIdentifier(functionName)}Input`
  const responseTypeName = `${typeIdentifier(functionName)}Response`
  const pathParameter = operation.parameters.some((parameter) => parameter.location === "path")
    ? "pathParams: value.path as Record<string, string | number | boolean>,"
    : "pathParams: value.path as Record<string, string | number | boolean>,"
  const queryParameter = operation.parameters.some((parameter) => parameter.location === "query")
    ? "params: value.query as Record<string, string | number | boolean | readonly (string | number | boolean)[] | null | undefined>,"
    : "params: value.query as Record<string, string | number | boolean | readonly (string | number | boolean)[] | null | undefined>,"
  const headerParameter = operation.parameters.some((parameter) => parameter.location === "header")
    ? "headers: value.headers as Record<string, string | number | boolean | readonly (string | number | boolean)[] | undefined>,"
    : "headers: value.headers as Record<string, string | number | boolean | readonly (string | number | boolean)[] | undefined>,"
  const bodyParameter = bodyContentMediaType
    ? `body: value.body,\n    contentType: ${sourceValue(bodyContentMediaType)},`
    : ""
  const deprecatedComment = operation.deprecated
    ? "\n/** @deprecated This operation is deprecated in the official Outscraper specification. */"
    : ""
  const inputArgument = inputRequired ? `input: ${inputTypeName}` : `input: ${inputTypeName} = {}`
  return `/* Generated by openApiCatalogGenerate. Do not edit. */\nimport * as v from "valibot"\nimport { type Result } from "#result"\nimport type { OutscraperClient } from "../outscraperClientCreate.js"\nimport { outscraperRequest } from "../outscraperRequest.js"\nimport { outscraperResultErrorCreate } from "../outscraperResultErrorCreate.js"\nimport { type ${inputTypeName}, ${functionName}InputSchema } from "./${functionName}InputSchema.js"\nimport { type ${responseTypeName}, ${functionName}ResponseSchema } from "./${functionName}ResponseSchema.js"\n${deprecatedComment}\nexport async function ${functionName}(client: OutscraperClient, ${inputArgument}): Promise<Result<${responseTypeName}>> {\n  const op = "${functionName}"\n  const parsed = v.safeParse(${functionName}InputSchema, input)\n  if (!parsed.success) {\n    return outscraperResultErrorCreate(op, \`Invalid ${functionName} input: \${v.summarize(parsed.issues)}\`)\n  }\n\n  const value = parsed.output\n  return outscraperRequest(client, {\n    op,\n    path: ${sourceValue(operation.path)},\n    method: ${sourceValue(operation.method)},\n    ${pathParameter}\n    ${queryParameter}\n    ${headerParameter}\n    ${bodyParameter}\n    schema: ${functionName}ResponseSchema,\n  })\n}\n`
}

export function openApiCatalogGenerate(catalog: OpenApiCatalog): Result<Record<string, string>> {
  const op = "openApiCatalogGenerate"
  const files: Record<string, string> = {}
  const folders = new Set<string>()
  const functionNames = new Set<string>()
  const exports: string[] = []
  const cliOperations: Array<{ operation: OpenApiCatalog["operations"][number]; functionName: string }> = []
  for (const operation of [...catalog.operations].sort((left, right) =>
    stringCompare(left.operationId, right.operationId),
  )) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(operation.folder)) {
      return createResultError(op, `Operation folder must be kebab-case: ${operation.folder}`)
    }
    if (folders.has(operation.folder)) {
      return createResultError(op, `Operation folder collision at ${operation.folder}`)
    }
    folders.add(operation.folder)

    const functionName = operationFunctionName(operation)
    if (functionNames.has(functionName)) {
      return createResultError(op, `Generated function collision at ${functionName}`)
    }
    functionNames.add(functionName)
    cliOperations.push({ operation, functionName })

    const input = inputSchemaSource(operation, functionName)
    const response = responseSchemaSource(operation)
    const bodyContentMediaType = operation.requestBody?.content.slice().sort((left, right) => {
      const leftJson = left.mediaType === "application/json" ? 0 : 1
      const rightJson = right.mediaType === "application/json" ? 0 : 1
      return leftJson - rightJson || stringCompare(left.mediaType, right.mediaType)
    })[0]?.mediaType
    const filesForOperation: Record<string, string> = {
      [`${operation.folder}/${functionName}Definition.ts`]: definitionSource(operation, functionName),
      [`${operation.folder}/${functionName}InputSchema.ts`]: inputSchemaFileSource(functionName, input.source),
      [`${operation.folder}/${functionName}ResponseSchema.ts`]: responseSchemaFileSource(functionName, response),
      [`${operation.folder}/${functionName}.ts`]: functionSource(
        operation,
        functionName,
        input.required,
        bodyContentMediaType,
      ),
    }

    for (const [filePath, source] of Object.entries(filesForOperation)) {
      if (files[filePath]) {
        return createResultError(op, `Generated file collision at ${filePath}`)
      }
      files[filePath] = source
    }
    exports.push(`export * from "./${operation.folder}/${functionName}.js"`)
    exports.push(`export * from "./${operation.folder}/${functionName}InputSchema.js"`)
    exports.push(`export * from "./${operation.folder}/${functionName}ResponseSchema.js"`)
    exports.push(`export * from "./${operation.folder}/${functionName}Definition.js"`)
  }

  files["outscraperGeneratedExports.ts"] =
    `/* Generated by openApiCatalogGenerate. Do not edit. */\n${exports.sort(sourceModuleCompare).join("\n")}\n`
  files["outscraperGeneratedCliCommands.ts"] = cliSource(cliOperations)

  return createResult(files)
}
