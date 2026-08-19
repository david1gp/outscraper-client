import type { Result } from "#result"
import * as v from "valibot"
import { type OutscraperAsyncResponse, outscraperAsyncResponseSchema } from "./outscraperAsyncResponseSchema.js"
import type { OutscraperClient } from "./outscraperClientCreate.js"
import { outscraperRequest } from "./outscraperRequest.js"

export const requestArchiveResponseSchema = v.object({
  id: v.string(),
  status: v.string(),
  results_location: v.optional(v.string()),
  data: v.optional(v.unknown()),
})

export type RequestArchiveResponse = v.InferOutput<typeof requestArchiveResponseSchema>

export async function requestArchiveGet(
  client: OutscraperClient,
  requestId: string,
): Promise<Result<RequestArchiveResponse>> {
  const op = "requestArchiveGet"
  if (!requestId || requestId.trim() === "") {
    return {
      success: false,
      op,
      errorMessage: "requestId is required",
    }
  }

  return outscraperRequest(client, {
    op,
    path: `/requests/${encodeURIComponent(requestId)}`,
    schema: requestArchiveResponseSchema,
  })
}
