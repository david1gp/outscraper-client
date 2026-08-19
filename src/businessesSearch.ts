import type { Result } from "#result"
import * as v from "valibot"
import { type OutscraperAsyncResponse, outscraperAsyncResponseSchema } from "./outscraperAsyncResponseSchema.js"
import type { OutscraperClient } from "./outscraperClientCreate.js"
import { outscraperRequest } from "./outscraperRequest.js"

export const businessesSearchOptionsSchema = v.object({
  filters: v.optional(v.record(v.string(), v.unknown()), {}),
  limit: v.optional(v.number(), 10),
  includeTotal: v.optional(v.boolean(), false),
  cursor: v.optional(v.nullable(v.string())),
  fields: v.optional(v.union([v.string(), v.array(v.string())])),
  query: v.optional(v.nullable(v.string())),
  enrichments: v.optional(v.nullable(v.union([v.string(), v.array(v.string())]))),
  async: v.optional(v.boolean(), false),
})

export type BusinessesSearchOptions = v.InferInput<typeof businessesSearchOptionsSchema>

export const businessesSearchSyncResponseSchema = v.object({
  items: v.optional(v.array(v.record(v.string(), v.unknown()))),
  has_more: v.optional(v.boolean()),
  next_cursor: v.optional(v.nullable(v.string())),
  total: v.optional(v.number()),
  status: v.optional(v.string()),
})

export type BusinessesSearchSyncResponse = v.InferOutput<typeof businessesSearchSyncResponseSchema>

export async function businessesSearch(
  client: OutscraperClient,
  options: BusinessesSearchOptions = {},
): Promise<Result<BusinessesSearchSyncResponse | OutscraperAsyncResponse>> {
  const op = "businessesSearch"
  const parsed = v.safeParse(businessesSearchOptionsSchema, options)
  if (!parsed.success) {
    return {
      success: false,
      op,
      errorMessage: `Invalid businessesSearch options: ${v.summarize(parsed.issues)}`,
    }
  }

  const opt = parsed.output
  const body = {
    filters: opt.filters,
    limit: opt.limit,
    include_total: opt.includeTotal,
    cursor: opt.cursor,
    fields: opt.fields ? (Array.isArray(opt.fields) ? opt.fields : [opt.fields]) : null,
    query: opt.query,
    enrichments: opt.enrichments ? (Array.isArray(opt.enrichments) ? opt.enrichments : [opt.enrichments]) : null,
    async: opt.async,
  }

  if (opt.async) {
    return outscraperRequest(client, {
      op,
      path: "/businesses",
      method: "POST",
      body,
      schema: outscraperAsyncResponseSchema,
    })
  }

  return outscraperRequest(client, {
    op,
    path: "/businesses",
    method: "POST",
    body,
    schema: businessesSearchSyncResponseSchema,
  })
}
