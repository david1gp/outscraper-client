import { describe, expect, it } from "bun:test"
import * as v from "valibot"
import * as library from "../src/index.js"
import { outscraperGeneratedCliCommands } from "../src/outscraperGeneratedCliCommands.js"

type OpenApiSchema = Record<string, unknown>

type OpenApiParameter = {
  name: string
  location: string
  required: boolean
  schema: OpenApiSchema
  example?: unknown
}

type OpenApiContent = {
  mediaType: string
  schema: OpenApiSchema
  [key: string]: unknown
}

type OpenApiOperation = {
  operationId: string
  folder: string
  method: string
  path: string
  parameters: OpenApiParameter[]
  requestBody?: {
    required: boolean
    content: OpenApiContent[]
  }
  responses: Array<{
    status: string
    content: OpenApiContent[]
  }>
}

type OpenApiCatalog = {
  operations: OpenApiOperation[]
}

type ValidationSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>
type LibraryExports = Record<string, unknown>

const catalog = (await Bun.file("openapi/outscraper-api.normalized.json").json()) as OpenApiCatalog
const exported = library as LibraryExports

function recordValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function ownValue(record: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(record, key)
}

function schemaContent(schemaInput: OpenApiSchema): OpenApiSchema {
  const content = schemaInput.content
  if (!recordValue(content)) return schemaInput

  const mediaTypes = Object.keys(content).sort((left, right) => {
    const leftJson = left === "application/json" ? 0 : 1
    const rightJson = right === "application/json" ? 0 : 1
    return leftJson - rightJson || left.localeCompare(right)
  })
  const mediaType = mediaTypes[0]
  const media = mediaType === undefined ? undefined : content[mediaType]
  return recordValue(media) && recordValue(media.schema) ? media.schema : {}
}

function schemaValueAccepts(schemaInput: OpenApiSchema, value: unknown): boolean {
  const schema = schemaContent(schemaInput)
  if (value === null) {
    if (schema.nullable === true || schema.type === "null") return true
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((item) => Object.is(item, value))) return false
  if (ownValue(schema, "const") && !Object.is(schema.const, value)) return false

  const alternatives = Array.isArray(schema.oneOf)
    ? schema.oneOf
    : Array.isArray(schema.anyOf)
      ? schema.anyOf
      : undefined
  if (alternatives) {
    return alternatives.some((alternative) => recordValue(alternative) && schemaValueAccepts(alternative, value))
  }
  if (Array.isArray(schema.allOf)) {
    return schema.allOf.every((part) => recordValue(part) && schemaValueAccepts(part, value))
  }

  if (Array.isArray(schema.type)) {
    return schema.type.some((type) => schemaValueAccepts({ type }, value))
  }

  if (schema.type === "string") {
    if (typeof value !== "string") return false
    if (typeof schema.minLength === "number" && value.length < schema.minLength) return false
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) return false
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) return false
    return true
  }
  if (schema.type === "integer" && (typeof value !== "number" || !Number.isInteger(value))) return false
  if (schema.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) return false
  if (schema.type === "boolean" && typeof value !== "boolean") return false
  if (schema.type === "null" && value !== null) return false

  if (schema.type === "number" || schema.type === "integer") {
    if (typeof value !== "number") return false
    if (typeof schema.minimum === "number" && value < schema.minimum) return false
    if (typeof schema.maximum === "number" && value > schema.maximum) return false
    if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) return false
    if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum) return false
    if (schema.exclusiveMinimum === true && typeof schema.minimum === "number" && value <= schema.minimum) return false
    if (schema.exclusiveMaximum === true && typeof schema.maximum === "number" && value >= schema.maximum) return false
    return true
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) return false
    if (typeof schema.minItems === "number" && value.length < schema.minItems) return false
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) return false
    return value.every((item) => !recordValue(schema.items) || schemaValueAccepts(schema.items, item))
  }

  if (schema.type === "object" || recordValue(schema.properties)) {
    if (!recordValue(value)) return false
    const required = Array.isArray(schema.required)
      ? schema.required.filter((item): item is string => typeof item === "string")
      : []
    if (required.some((name) => !ownValue(value, name))) return false
    const properties = recordValue(schema.properties) ? schema.properties : {}
    return Object.entries(properties).every(([name, property]) => {
      if (!ownValue(value, name) || !recordValue(property)) return true
      return schemaValueAccepts(property, value[name])
    })
  }

  return true
}

function schemaDocumentedValue(schemaInput: OpenApiSchema, documented?: unknown, hasDocumented = false): unknown {
  const schema = schemaContent(schemaInput)
  if (hasDocumented) {
    if (schemaValueAccepts(schema, documented)) return documented
    if (schema.type === "array" && !Array.isArray(documented)) {
      if (recordValue(schema.items) && schemaValueAccepts(schema.items, documented)) return [documented]
    }
  }

  if (ownValue(schema, "example")) {
    if (schemaValueAccepts(schema, schema.example)) return schema.example
    if (schema.type === "array" && !Array.isArray(schema.example)) {
      if (recordValue(schema.items) && schemaValueAccepts(schema.items, schema.example)) return [schema.example]
    }
  }
  if (ownValue(schema, "default")) {
    if (schemaValueAccepts(schema, schema.default)) return schema.default
    if (schema.type === "array" && !Array.isArray(schema.default)) {
      if (recordValue(schema.items) && schemaValueAccepts(schema.items, schema.default)) return [schema.default]
    }
  }
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const first = schema.enum[0]
    if (schemaValueAccepts(schema, first)) return first
  }
  if (ownValue(schema, "const")) return schema.const

  const alternatives = Array.isArray(schema.oneOf)
    ? schema.oneOf
    : Array.isArray(schema.anyOf)
      ? schema.anyOf
      : undefined
  if (alternatives) {
    const alternative = alternatives.find((item): item is OpenApiSchema => recordValue(item))
    return alternative === undefined ? undefined : schemaDocumentedValue(alternative)
  }
  if (Array.isArray(schema.allOf)) {
    const values = schema.allOf
      .filter((item): item is OpenApiSchema => recordValue(item))
      .map((item) => schemaDocumentedValue(item))
    if (values.every(recordValue)) return Object.assign({}, ...values)
    return values.find((value) => value !== undefined)
  }

  if (Array.isArray(schema.type)) return schemaDocumentedValue({ type: schema.type[0] })
  if (schema.type === "string") {
    const minimum = typeof schema.minLength === "number" ? schema.minLength : 1
    return "x".repeat(minimum)
  }
  if (schema.type === "integer" || schema.type === "number") {
    let value = typeof schema.minimum === "number" ? schema.minimum : 1
    if (typeof schema.exclusiveMinimum === "number") value = schema.exclusiveMinimum + 1
    if (schema.exclusiveMinimum === true && typeof schema.minimum === "number") value = schema.minimum + 1
    return schema.type === "integer" ? Math.ceil(value) : value
  }
  if (schema.type === "boolean") return true
  if (schema.type === "null") return null
  if (schema.type === "array") {
    const item = recordValue(schema.items) ? schemaDocumentedValue(schema.items) : "example"
    const count = typeof schema.minItems === "number" ? Math.max(1, schema.minItems) : 1
    return Array.from({ length: count }, () => item)
  }
  if (schema.type === "object" || recordValue(schema.properties)) {
    const properties = recordValue(schema.properties) ? schema.properties : {}
    return Object.fromEntries(
      Object.entries(properties)
        .map(([name, property]) => [name, recordValue(property) ? schemaDocumentedValue(property) : undefined])
        .filter((entry): entry is [string, unknown] => entry[1] !== undefined),
    )
  }

  return undefined
}

function operationFunctionName(operation: OpenApiOperation): string {
  const method = operation.method.toLowerCase()
  const subject = operation.operationId.replace(new RegExp(`^${method}`, "i"), "")
  const words = subject
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
  const identifier = words
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : `${word[0]?.toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join("")
  return `${identifier}${method[0]?.toUpperCase()}${method.slice(1)}`
}

function operationInput(operation: OpenApiOperation, includeOptional: boolean): Record<string, unknown> {
  const input: Record<string, unknown> = {}
  for (const parameter of operation.parameters) {
    if (!includeOptional && !parameter.required) continue
    const group = parameter.location === "header" ? "headers" : parameter.location
    if (group !== "path" && group !== "query" && group !== "headers") continue
    const groupValue = recordValue(input[group]) ? input[group] : {}
    const hasExample = ownValue(parameter, "example")
    groupValue[parameter.name] = schemaDocumentedValue(parameter.schema, parameter.example, hasExample)
    input[group] = groupValue
  }

  if (operation.requestBody && includeOptional) {
    const content =
      operation.requestBody.content.find((item) => item.mediaType === "application/json") ??
      operation.requestBody.content[0]
    if (content) input.body = schemaDocumentedValue(content.schema)
  }
  return input
}

function inputValueSet(
  input: Record<string, unknown>,
  location: string,
  name: string,
  value: unknown,
): Record<string, unknown> {
  const copy = structuredClone(input) as Record<string, unknown>
  const group = recordValue(copy[location]) ? copy[location] : {}
  group[name] = value
  copy[location] = group
  return copy
}

function inputValueDelete(input: Record<string, unknown>, location: string, name: string): Record<string, unknown> {
  const copy = structuredClone(input) as Record<string, unknown>
  if (recordValue(copy[location])) delete copy[location][name]
  return copy
}

function schemaParse(schema: unknown, input: unknown) {
  return v.safeParse(schema as ValidationSchema, input)
}

function routeEntries(value: unknown): readonly unknown[] {
  if (value === null || typeof value !== "object") return []
  const getAllEntries = (value as { getAllEntries?: unknown }).getAllEntries
  if (typeof getAllEntries !== "function") return []
  return getAllEntries.call(value) as readonly unknown[]
}

function routeEntryName(value: unknown): string {
  if (value === null || typeof value !== "object") return ""
  const name = (value as { name?: unknown }).name
  if (typeof name === "string") return name
  if (recordValue(name)) {
    const kebab = name["convert-camel-to-kebab"]
    if (typeof kebab === "string") return kebab
    const original = name.original
    if (typeof original === "string") return original
  }
  return ""
}

function operationRoute(operation: OpenApiOperation): string {
  const prefix = `${operation.method.toLowerCase()}-`
  const route = operation.folder.startsWith(prefix) ? operation.folder.slice(prefix.length) : operation.folder
  return `${operation.method.toLowerCase()}:${route}`
}

function schemaWrongValue(schemaInput: OpenApiSchema): unknown {
  const schema = schemaContent(schemaInput)
  if (Array.isArray(schema.enum)) return "__invalid_enum__"
  if (schema.type === "boolean") return "not-a-boolean"
  if (schema.type === "integer" || schema.type === "number") return "not-a-number"
  if (schema.type === "array") return "not-an-array"
  if (schema.type === "object") return "not-an-object"
  if (schema.type === "string") return 123
  return "__invalid__"
}

describe("normalized Outscraper catalog coverage", () => {
  it("keeps every operation independently exported and routable", async () => {
    const generatedExports = await Bun.file("src/outscraperGeneratedExports.ts").text()
    const folders = new Set<string>()
    const functionNames = new Set<string>()
    const inputSchemaNames = new Set<string>()
    const responseSchemaNames = new Set<string>()
    const definitionNames = new Set<string>()
    const missingExports: string[] = []

    for (const operation of catalog.operations) {
      const functionName = operationFunctionName(operation)
      const inputSchemaName = `${functionName}InputSchema`
      const responseSchemaName = `${functionName}ResponseSchema`
      const definitionName = `${functionName}Definition`
      folders.add(operation.folder)
      functionNames.add(functionName)
      inputSchemaNames.add(inputSchemaName)
      responseSchemaNames.add(responseSchemaName)
      definitionNames.add(definitionName)

      expect(typeof exported[functionName]).toBe("function")
      expect(exported[inputSchemaName]).toBeDefined()
      expect(exported[responseSchemaName]).toBeDefined()
      expect(exported[definitionName]).toBeDefined()
      expect(generatedExports).toContain(`export * from "./${operation.folder}/${functionName}.js"`)
      if (
        typeof exported[functionName] !== "function" ||
        exported[inputSchemaName] === undefined ||
        exported[responseSchemaName] === undefined ||
        exported[definitionName] === undefined
      ) {
        missingExports.push(operation.operationId)
      }
    }

    const cliRoutes = new Set<string>()
    for (const methodEntry of routeEntries(outscraperGeneratedCliCommands)) {
      const method = routeEntryName(methodEntry)
      const target = methodEntry as { target?: unknown }
      for (const endpointEntry of routeEntries(target.target)) {
        cliRoutes.add(`${method}:${routeEntryName(endpointEntry)}`)
      }
    }

    expect(catalog.operations).toHaveLength(107)
    expect(folders).toHaveLength(catalog.operations.length)
    expect(functionNames).toHaveLength(catalog.operations.length)
    expect(inputSchemaNames).toHaveLength(catalog.operations.length)
    expect(responseSchemaNames).toHaveLength(catalog.operations.length)
    expect(definitionNames).toHaveLength(catalog.operations.length)
    expect(missingExports).toEqual([])
    expect([...cliRoutes].sort()).toEqual(catalog.operations.map(operationRoute).sort())
  })

  it("accepts catalog examples/defaults and rejects required, typed, enum, and bounded violations", async () => {
    const inputFailures: string[] = []
    const responseExampleFailures: string[] = []
    const missingRequiredFailures: string[] = []
    const enumFailures: string[] = []
    const wrongTypeFailures: string[] = []

    for (const operation of catalog.operations) {
      const functionName = operationFunctionName(operation)
      const inputSchema = exported[`${functionName}InputSchema`]
      const responseSchema = exported[`${functionName}ResponseSchema`]
      const fullInput = operationInput(operation, true)
      const minimalInput = operationInput(operation, false)
      const fullParsed = schemaParse(inputSchema, fullInput)
      const minimalParsed = schemaParse(inputSchema, minimalInput)
      if (!fullParsed.success || !minimalParsed.success) inputFailures.push(operation.operationId)

      for (const parameter of operation.parameters.filter((item) => item.required)) {
        const location = parameter.location === "header" ? "headers" : parameter.location
        if (location !== "path" && location !== "query" && location !== "headers") continue
        const missing = inputValueDelete(fullInput, location, parameter.name)
        if (schemaParse(inputSchema, missing).success)
          missingRequiredFailures.push(`${operation.operationId}:${parameter.name}`)
      }

      for (const parameter of operation.parameters) {
        const location = parameter.location === "header" ? "headers" : parameter.location
        if (location !== "path" && location !== "query" && location !== "headers") continue
        const schema = schemaContent(parameter.schema)
        const enumValues = Array.isArray(schema.enum)
          ? schema.enum
          : recordValue(schema.items) && Array.isArray(schema.items.enum)
            ? schema.items.enum
            : undefined
        if (enumValues) {
          const invalid = schema.type === "array" ? ["__invalid_enum__"] : "__invalid_enum__"
          const invalidInput = inputValueSet(fullInput, location, parameter.name, invalid)
          if (schemaParse(inputSchema, invalidInput).success)
            enumFailures.push(`${operation.operationId}:${parameter.name}`)
        }
      }

      const typedParameter = operation.parameters.find(
        (parameter) => schemaWrongValue(parameter.schema) !== "__invalid__",
      )
      if (typedParameter) {
        const location = typedParameter.location === "header" ? "headers" : typedParameter.location
        if (location === "path" || location === "query" || location === "headers") {
          const invalidInput = inputValueSet(
            fullInput,
            location,
            typedParameter.name,
            schemaWrongValue(typedParameter.schema),
          )
          if (schemaParse(inputSchema, invalidInput).success)
            wrongTypeFailures.push(`${operation.operationId}:${typedParameter.name}`)
        }
      }

      for (const response of operation.responses.filter((item) => /^2\d\d$/.test(item.status))) {
        for (const content of response.content) {
          const example = ownValue(content, "example") ? content.example : content.schema.example
          if (example === undefined) continue
          if (!schemaParse(responseSchema, example).success)
            responseExampleFailures.push(`${operation.operationId}:${response.status}`)
        }
      }
    }

    expect(inputFailures).toEqual([])
    expect(responseExampleFailures).toEqual([])
    expect(missingRequiredFailures).toEqual([])
    expect(enumFailures).toEqual([])
    expect(wrongTypeFailures).toEqual([])

    const aiOperation = catalog.operations.find((operation) => operation.operationId === "getAi-Scraper")
    expect(aiOperation).toBeDefined()
    if (aiOperation) {
      const parameter = aiOperation.parameters.find((item) => item.name === "prompt")
      expect(parameter?.schema.maxLength).toBe(2024)
      if (parameter && typeof parameter.schema.maxLength === "number") {
        const invalid = inputValueSet(
          operationInput(aiOperation, true),
          "query",
          parameter.name,
          "x".repeat(parameter.schema.maxLength + 1),
        )
        expect(schemaParse(exported[`${operationFunctionName(aiOperation)}InputSchema`], invalid).success).toBe(false)
      }
    }

    const businessesOperation = catalog.operations.find((operation) => operation.operationId === "postBusinesses")
    expect(businessesOperation).toBeDefined()
    if (businessesOperation) {
      const schema = exported[`${operationFunctionName(businessesOperation)}InputSchema`]
      const invalidBound = operationInput(businessesOperation, true)
      const boundBody = recordValue(invalidBound.body) ? invalidBound.body : {}
      boundBody.limit = 0
      invalidBound.body = boundBody
      expect(schemaParse(schema, invalidBound).success).toBe(false)

      const invalidType = operationInput(businessesOperation, true)
      const typeBody = recordValue(invalidType.body) ? invalidType.body : {}
      const enrichments = recordValue(typeBody.enrichments) ? typeBody.enrichments : {}
      enrichments.company_insights = "not-a-boolean"
      typeBody.enrichments = enrichments
      invalidType.body = typeBody
      expect(schemaParse(schema, invalidType).success).toBe(false)

      const invalidEnum = operationInput(businessesOperation, true)
      const enumBody = recordValue(invalidEnum.body) ? invalidEnum.body : {}
      const filters = recordValue(enumBody.filters) ? enumBody.filters : {}
      filters.email_and_phone = "not-a-documented-value"
      enumBody.filters = filters
      invalidEnum.body = enumBody
      expect(schemaParse(schema, invalidEnum).success).toBe(false)
    }
  })
})
