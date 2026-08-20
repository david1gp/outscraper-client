import { createResult, type Result } from "#result"
import type { OutscraperClient } from "./outscraperClientCreate.js"
import { outscraperConfigValidate } from "./outscraperConfigValidate.js"

export function outscraperClientCreateResult(config: unknown): Result<OutscraperClient> {
  const validated = outscraperConfigValidate(config)
  if (!validated.success) {
    return validated
  }

  const client: OutscraperClient = { config: validated.data }
  return createResult(client)
}
