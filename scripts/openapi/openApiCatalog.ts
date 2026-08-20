type OpenApiCatalogMetadata = Record<string, unknown>

export type OpenApiCatalog = {
  version: 1
  source: {
    openapi: string
    title?: string
    version?: string
    description?: string
    servers?: OpenApiCatalogMetadata[]
    security?: Array<Record<string, string[]>>
    securitySchemes?: Record<string, OpenApiCatalogMetadata>
  }
  operations: Array<{
    operationId: string
    folder: string
    method: string
    path: string
    summary?: string
    description?: string
    tags?: string[]
    deprecated?: boolean
    externalDocs?: OpenApiCatalogMetadata
    parameters: Array<{
      name: string
      location: string
      required: boolean
      schema: Record<string, unknown>
      description?: string
      [key: string]: unknown
    }>
    requestBody?: {
      required: boolean
      content: Array<{
        mediaType: string
        schema: Record<string, unknown>
        [key: string]: unknown
      }>
      [key: string]: unknown
    }
    responses: Array<{
      status: string
      description?: string
      content: Array<{
        mediaType: string
        schema: Record<string, unknown>
        [key: string]: unknown
      }>
      [key: string]: unknown
    }>
    security?: Array<Record<string, string[]>>
    [key: string]: unknown
  }>
}
