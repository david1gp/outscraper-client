import { type ResultErr, resultTryParsingFetchErr } from "#result"
import { outscraperResultErrorCreate } from "./outscraperResultErrorCreate.js"

export async function outscraperHttpErrorCreate(op: string, response: Response, apiKey?: string): Promise<ResultErr> {
  let body = ""
  try {
    body = await response.text()
  } catch {
    body = response.statusText
  }

  const parsed = resultTryParsingFetchErr(op, body, response.status, response.statusText)
  const isUnstructured = parsed.op === `${op}.resultTryParsingFetchErr`
  const errorMessage = isUnstructured
    ? `Request failed with status ${response.status}: ${body || response.statusText || "Unknown error"}`
    : parsed.errorMessage

  return outscraperResultErrorCreate(op, errorMessage, {
    apiKey,
    statusCode: response.status,
  })
}
