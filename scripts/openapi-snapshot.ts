import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { openApiSnapshotAcquire } from "./openapi/openApiSnapshotAcquire.js"

const sourceUrl = process.argv[2] ?? "https://app.outscraper.cloud/api-docs-data.json"
const outputPath = process.argv[3] ?? "openapi/outscraper-api.json"

const snapshot = await openApiSnapshotAcquire(sourceUrl)
if (!snapshot.success) {
  console.error(snapshot.errorMessage)
  process.exit(1)
}

try {
  await mkdir(dirname(outputPath), { recursive: true })
  await Bun.write(outputPath, `${JSON.stringify(snapshot.data, null, 2)}\n`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
