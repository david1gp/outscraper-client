import { mkdir, rm } from "node:fs/promises"
import { dirname, join } from "node:path"
import { openApiCatalogGenerate } from "./openapi/openApiCatalogGenerate.js"

const catalogPath = process.argv[2] ?? "openapi/outscraper-api.normalized.json"
const outputDirectory = process.argv[3] ?? "src"

function stringCompare(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

try {
  const catalog = (await Bun.file(catalogPath).json()) as Parameters<typeof openApiCatalogGenerate>[0]
  const generated = openApiCatalogGenerate(catalog)
  if (!generated.success) {
    console.error(generated.errorMessage)
    process.exit(1)
  }

  for (const operation of catalog.operations) {
    await rm(join(outputDirectory, operation.folder), { force: true, recursive: true })
  }

  for (const [filePath, source] of Object.entries(generated.data).sort(([left], [right]) =>
    stringCompare(left, right),
  )) {
    const targetPath = join(outputDirectory, filePath)
    await mkdir(dirname(targetPath), { recursive: true })
    await Bun.write(targetPath, source)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
