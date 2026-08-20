import { createResult, type Result } from "#result"
import { outscraperResultErrorCreate } from "./outscraperResultErrorCreate.js"

export function outscraperBodySerialize(op: string, body: unknown): Result<string | undefined> {
  try {
    const serializedBody = JSON.stringify(body)
    if (serializedBody === undefined) {
      return outscraperResultErrorCreate(op, "Request body cannot be serialized as JSON")
    }
    return createResult(serializedBody)
  } catch (error) {
    return outscraperResultErrorCreate(
      op,
      `Request body serialization failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
