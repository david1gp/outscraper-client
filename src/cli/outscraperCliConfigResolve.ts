import { type Result } from "#result"
import type { OutscraperConfig } from "../outscraperConfigSchema.js"
import { outscraperConfigValidate } from "../outscraperConfigValidate.js"
import { outscraperResultErrorCreate } from "../outscraperResultErrorCreate.js"

export function outscraperCliConfigResolve(
  flags: Readonly<Record<string, unknown>>,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Result<OutscraperConfig> {
  const op = "outscraperCliConfigResolve"
  const flagApiKey = flags.apiKey
  const hasFlagApiKey = typeof flagApiKey === "string"
  const apiKey = hasFlagApiKey ? flagApiKey : env.OUTSCRAPER_API_KEY
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return outscraperResultErrorCreate(op, "Missing API key; set OUTSCRAPER_API_KEY or pass --api-key")
  }

  const flagBaseUrl = flags.baseUrl
  const hasFlagBaseUrl = typeof flagBaseUrl === "string"
  const baseUrl = hasFlagBaseUrl ? flagBaseUrl : env.OUTSCRAPER_BASE_URL
  if (typeof baseUrl === "string" && baseUrl.trim().length === 0) {
    return outscraperResultErrorCreate(op, "Base URL cannot be empty")
  }

  return outscraperConfigValidate({
    apiKey,
    ...(baseUrl === undefined ? {} : { baseUrl }),
  })
}
