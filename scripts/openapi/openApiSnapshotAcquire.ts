import { createResult, createResultError, type Result } from "#result"
import { openApiValueCanonicalize } from "./openApiValueCanonicalize.js"

export async function openApiSnapshotAcquire(
  sourceUrl = "https://app.outscraper.cloud/api-docs-data.json",
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<Result<unknown>> {
  const op = "openApiSnapshotAcquire"
  let response: Response
  try {
    response = await fetcher(sourceUrl)
  } catch (error) {
    return createResultError(op, error instanceof Error ? error.message : String(error))
  }

  if (!response.ok) {
    return createResultError(op, `OpenAPI source returned ${response.status} ${response.statusText}`)
  }

  try {
    return createResult(openApiValueCanonicalize(await response.json()))
  } catch (error) {
    return createResultError(op, error instanceof Error ? error.message : String(error))
  }
}
