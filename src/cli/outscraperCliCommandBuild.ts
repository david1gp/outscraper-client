import { type ApplicationContext, buildCommand, type Command } from "@stricli/core"
import { createResultError, type Result } from "#result"
import type { OutscraperClient } from "../outscraperClientCreate.js"
import { outscraperClientCreateResult } from "../outscraperClientCreateResult.js"
import { outscraperCliConfigResolve } from "./outscraperCliConfigResolve.js"
import { outscraperCliResultWrite } from "./outscraperCliResultWrite.js"

type OpenApiSchema = Record<string, unknown>

type OpenApiParameter = {
  name: string
  location: string
  required: boolean
  schema: OpenApiSchema
  description?: string
}

type OpenApiDefinition = {
  operationId: string
  folder: string
  method: string
  path: string
  summary?: string
  description?: string
  parameters: readonly OpenApiParameter[]
  requestBody?: {
    required: boolean
    content: readonly { mediaType: string; schema: OpenApiSchema }[]
  }
}

type CliEndpoint<Input> = {
  definition: OpenApiDefinition
  execute: (client: OutscraperClient, input: Input) => Promise<Result<unknown>>
}

type CliFlags = Readonly<Record<string, unknown>>

const invalidInput = Symbol("outscraper-cli-invalid-input")

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function schemaContent(schema: OpenApiSchema): OpenApiSchema {
  const content = schema.content
  if (!isRecord(content)) return schema

  const mediaTypes = Object.keys(content).sort((left, right) => {
    const leftJson = left === "application/json" ? 0 : 1
    const rightJson = right === "application/json" ? 0 : 1
    return leftJson - rightJson || left.localeCompare(right)
  })
  const mediaType = mediaTypes[0]
  const media = mediaType === undefined ? undefined : content[mediaType]
  return isRecord(media) && isRecord(media.schema) ? media.schema : {}
}

function literalType(value: unknown): string | undefined {
  if (typeof value === "string") return "string"
  if (typeof value === "number") return "number"
  if (typeof value === "boolean") return "boolean"
  if (value === null) return "null"
  return undefined
}

function schemaType(schemaInput: OpenApiSchema): string | undefined {
  const schema = schemaContent(schemaInput)
  if (Array.isArray(schema.enum)) {
    const types = schema.enum.map(literalType).filter((type): type is string => type !== undefined)
    if (types.length > 0 && types.every((type) => type === types[0])) return types[0]
  }
  if (Object.hasOwn(schema, "const")) return literalType(schema.const)
  if (typeof schema.type === "string") return schema.type
  const alternatives = Array.isArray(schema.oneOf) ? schema.oneOf : Array.isArray(schema.anyOf) ? schema.anyOf : []
  for (const alternative of alternatives) {
    if (isRecord(alternative)) {
      const type = schemaType(alternative)
      if (type !== undefined && type !== "null") return type
    }
  }
  return undefined
}

function schemaArrayItem(schemaInput: OpenApiSchema): OpenApiSchema {
  const schema = schemaContent(schemaInput)
  return isRecord(schema.items) ? schema.items : {}
}

function invalidInputParse(): symbol {
  return invalidInput
}

function scalarValueParse(value: unknown, schemaInput: OpenApiSchema): unknown {
  const schema = schemaContent(schemaInput)
  const type = schemaType(schema)

  if (type === "boolean") {
    if (typeof value === "boolean") return value
    if (typeof value !== "string") return invalidInputParse()
    const normalized = value.toLowerCase()
    if (normalized === "true") return true
    if (normalized === "false") return false
    return invalidInputParse()
  }

  if (type === "number" || type === "integer") {
    if (typeof value === "string" && value.trim().length === 0) return invalidInputParse()
    const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN
    if (!Number.isFinite(numberValue)) return invalidInputParse()
    if (type === "integer" && !Number.isInteger(numberValue)) return invalidInputParse()
    return numberValue
  }

  if (type === "null") return value === "null" || value === null ? null : invalidInputParse()
  if (type === "object") return isRecord(value) ? value : invalidInputParse()
  if (type === "array") return Array.isArray(value) ? value : invalidInputParse()
  if (type === "string" || type === undefined) return typeof value === "string" ? value : invalidInputParse()
  return value
}

function jsonValueParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return invalidInputParse()
  }
}

function parameterValueParse(value: string, schemaInput: OpenApiSchema): unknown {
  const schema = schemaContent(schemaInput)
  if (schemaType(schema) !== "array") return scalarValueParse(value, schema)

  if (value.trimStart().startsWith("[")) {
    const parsed = jsonValueParse(value)
    if (!Array.isArray(parsed)) return invalidInputParse()
    return parsed.map((item) => scalarValueParse(item, schemaArrayItem(schema)))
  }

  const collectionFormat = schema.collectionFormat
  const values = collectionFormat === "csv" ? value.split(",") : [value]
  return values.map((item) => scalarValueParse(item, schemaArrayItem(schema)))
}

function parameterFlagName(parameter: OpenApiParameter): string {
  const location = parameter.location === "header" ? "headers" : parameter.location
  const name = parameter.name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
  return `${location}-${name}`
}

function groupFlagBrief(group: string): string {
  return `JSON object for ${group} parameters (individual --${group}-... flags are also supported)`
}

function parameterBrief(parameter: OpenApiParameter): string {
  const type = schemaType(parameter.schema)
  const enumValues = schemaContent(parameter.schema).enum
  const enumBrief =
    Array.isArray(enumValues) && enumValues.length > 0 ? ` Allowed values: ${enumValues.join(", ")}.` : ""
  return `${parameter.location} parameter${type === undefined ? "" : ` (${type})`}.${enumBrief} ${parameter.description ?? ""}`.trim()
}

function commandFlagParameters(definition: OpenApiDefinition): Record<string, unknown> {
  const flags: Record<string, unknown> = {
    apiKey: {
      brief: "Override OUTSCRAPER_API_KEY (never printed)",
      kind: "parsed",
      optional: true,
      parse: (value: string) => value,
      placeholder: "KEY",
    },
    baseUrl: {
      brief: "Override OUTSCRAPER_BASE_URL",
      kind: "parsed",
      optional: true,
      parse: (value: string) => value,
      placeholder: "URL",
    },
  }

  const locations = new Set(definition.parameters.map((parameter) => parameter.location))
  for (const location of ["path", "query", "header"] as const) {
    if (!locations.has(location)) continue
    const flagName = location === "header" ? "headers" : location
    flags[flagName] = {
      brief: groupFlagBrief(flagName),
      kind: "parsed",
      optional: true,
      parse: jsonValueParse,
      placeholder: "JSON",
    }
  }

  if (definition.requestBody) {
    flags.body = {
      brief: "JSON request body (nested objects and arrays are supported)",
      kind: "parsed",
      optional: true,
      parse: jsonValueParse,
      placeholder: "JSON",
    }
  }

  for (const parameter of definition.parameters) {
    if (parameter.location !== "path" && parameter.location !== "query" && parameter.location !== "header") continue
    const flagName = parameterFlagName(parameter)
    const array = schemaType(parameter.schema) === "array"
    flags[flagName] = {
      brief: parameterBrief(parameter),
      kind: "parsed",
      optional: true,
      parse: (value: string) => parameterValueParse(value, parameter.schema),
      placeholder: array ? "VALUE..." : "VALUE",
      ...(array ? { variadic: true } : {}),
    }
  }

  return flags
}

function groupName(location: string): "path" | "query" | "headers" | undefined {
  if (location === "path") return "path"
  if (location === "query") return "query"
  if (location === "header") return "headers"
  return undefined
}

function arrayValuesNormalize(value: unknown): unknown[] | symbol {
  if (!Array.isArray(value)) return [value]
  return value.flatMap((item) => (Array.isArray(item) ? item : [item]))
}

function inputBuild(definition: OpenApiDefinition, flags: CliFlags): unknown {
  const input: Record<string, unknown> = {
    path: {},
    query: {},
    headers: {},
  }

  for (const group of ["path", "query", "headers", "body"] as const) {
    const groupValue = flags[group]
    if (groupValue === undefined) continue
    if (groupValue === invalidInput) return invalidInput
    input[group] = groupValue
  }

  for (const parameter of definition.parameters) {
    const group = groupName(parameter.location)
    if (group === undefined) continue
    const flagName = parameterFlagName(parameter)
    const value = flags[flagName]
    if (value === undefined) continue
    if (value === invalidInput) return invalidInput

    const existing = input[group]
    if (!isRecord(existing)) return invalidInput
    const normalized = schemaType(parameter.schema) === "array" ? arrayValuesNormalize(value) : value
    if (normalized === invalidInput) return invalidInput
    if (Array.isArray(normalized) && normalized.some((item: unknown) => item === invalidInput)) return invalidInput
    input[group] = { ...existing, [parameter.name]: normalized }
  }

  return input
}

function endpointDescription(definition: OpenApiDefinition): { brief: string; fullDescription?: string } {
  const brief = definition.summary ?? `${definition.method} ${definition.path}`
  const fullDescription = definition.description
  return fullDescription === undefined ? { brief } : { brief, fullDescription }
}

export function outscraperCliCommandBuild<Input>(endpoint: CliEndpoint<Input>): Command<ApplicationContext> {
  const definition = endpoint.definition
  return buildCommand<Record<string, unknown>, [], ApplicationContext>({
    func: async function (this: ApplicationContext, flags: Record<string, unknown>) {
      const input = inputBuild(definition, flags)
      const config = outscraperCliConfigResolve(flags, this.process.env)
      if (!config.success) {
        outscraperCliResultWrite(this.process, config)
        return
      }

      const client = outscraperClientCreateResult(config.data)
      if (!client.success) {
        outscraperCliResultWrite(this.process, client, config.data.apiKey)
        return
      }

      let result: Result<unknown>
      try {
        result = await endpoint.execute(client.data, input as Input)
      } catch (error) {
        result = createResultError(definition.operationId, error instanceof Error ? error.message : String(error))
      }
      outscraperCliResultWrite(this.process, result, config.data.apiKey)
    },
    parameters: { flags: commandFlagParameters(definition) } as never,
    docs: endpointDescription(definition),
  })
}
