import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { openApiCatalogNormalize } from "./openapi/openApiCatalogNormalize.js"
import { openApiCatalogSerialize } from "./openapi/openApiCatalogSerialize.js"

const inputPath = process.argv[2] ?? "openapi/outscraper-api.json"
const outputPath = process.argv[3] ?? "openapi/outscraper-api.normalized.json"

try {
  const document = await Bun.file(inputPath).json()
  const normalized = openApiCatalogNormalize(document)
  if (!normalized.success) {
    console.error(normalized.errorMessage)
    process.exit(1)
  }

  await mkdir(dirname(outputPath), { recursive: true })
  await Bun.write(outputPath, openApiCatalogSerialize(normalized.data))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
