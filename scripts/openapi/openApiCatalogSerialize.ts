import type { OpenApiCatalog } from "./openApiCatalog.js"
import { openApiValueCanonicalize } from "./openApiValueCanonicalize.js"

export function openApiCatalogSerialize(catalog: OpenApiCatalog): string {
  return `${JSON.stringify(openApiValueCanonicalize(catalog), null, 2)}\n`
}
