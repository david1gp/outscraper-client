import * as v from "valibot"
import { createResult, type Result } from "#result"
import { type OutscraperConfig, outscraperConfigSchema } from "./outscraperConfigSchema.js"
import { outscraperResultErrorCreate } from "./outscraperResultErrorCreate.js"

export function outscraperConfigValidate(config: unknown): Result<OutscraperConfig> {
  const parsed = v.safeParse(outscraperConfigSchema, config)
  if (!parsed.success) {
    return outscraperResultErrorCreate(
      "outscraperConfigValidate",
      `Invalid Outscraper config: ${v.summarize(parsed.issues)}`,
    )
  }

  return createResult(parsed.output)
}
