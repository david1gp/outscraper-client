import { createResultError, type ResultErr } from "#result"

export function outscraperResultErrorCreate(
  op: string,
  errorMessage: string,
  options?: { apiKey?: string; statusCode?: number; code?: string },
): ResultErr {
  const apiKey = options?.apiKey
  const safeMessage = apiKey && apiKey.length > 0 ? errorMessage.split(apiKey).join("[REDACTED]") : errorMessage
  const result = createResultError(op, safeMessage.slice(0, 2000))

  if (options?.statusCode !== undefined) {
    result.statusCode = options.statusCode
  }
  if (options?.code !== undefined) {
    result.code = options.code
  }

  return result
}
