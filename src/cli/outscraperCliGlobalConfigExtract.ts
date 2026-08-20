import { createResult, createResultError, type Result } from "#result"

type OutscraperCliGlobalConfig = {
  args: readonly string[]
  env: Readonly<Record<string, string>>
}

export function outscraperCliGlobalConfigExtract(inputs: readonly string[]): Result<OutscraperCliGlobalConfig> {
  const op = "outscraperCliGlobalConfigExtract"
  const args: string[] = []
  const env: Record<string, string> = {}

  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index]
    if (input === undefined) continue
    if (input === "--api-key" || input === "--base-url") {
      const value = inputs[index + 1]
      if (value === undefined) return createResultError(op, `Missing value for ${input}`)
      env[input === "--api-key" ? "OUTSCRAPER_API_KEY" : "OUTSCRAPER_BASE_URL"] = value
      index += 1
      continue
    }

    const apiKeyPrefix = "--api-key="
    const baseUrlPrefix = "--base-url="
    if (input.startsWith(apiKeyPrefix)) {
      env.OUTSCRAPER_API_KEY = input.slice(apiKeyPrefix.length)
      continue
    }
    if (input.startsWith(baseUrlPrefix)) {
      env.OUTSCRAPER_BASE_URL = input.slice(baseUrlPrefix.length)
      continue
    }

    args.push(input)
  }

  return createResult({ args, env })
}
