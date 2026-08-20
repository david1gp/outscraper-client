import * as v from "valibot"
import { type Result } from "#result"
import { type OutscraperAsyncResponse, outscraperAsyncResponseSchema } from "../outscraperAsyncResponseSchema.js"
import type { OutscraperClient } from "../outscraperClientCreate.js"
import { outscraperRequest } from "../outscraperRequest.js"
import { outscraperResultErrorCreate } from "../outscraperResultErrorCreate.js"

export const googleMapsSearchOptionsSchema = v.object({
  query: v.union([v.string(), v.array(v.string())]),
  limit: v.optional(v.number(), 20),
  language: v.optional(v.string(), "en"),
  region: v.optional(v.string()),
  skip: v.optional(v.number(), 0),
  dropDuplicates: v.optional(v.boolean(), false),
  enrichment: v.optional(v.union([v.string(), v.array(v.string())])),
  async: v.optional(v.boolean(), false),
})

export type GoogleMapsSearchOptions = v.InferInput<typeof googleMapsSearchOptionsSchema>

export const googleMapsSearchSyncResponseSchema = v.object({
  data: v.array(v.array(v.record(v.string(), v.unknown()))),
  status: v.optional(v.string()),
})

export type GoogleMapsSearchSyncResponse = v.InferOutput<typeof googleMapsSearchSyncResponseSchema>

export async function googleMapsSearch(
  client: OutscraperClient,
  options: GoogleMapsSearchOptions,
): Promise<Result<GoogleMapsSearchSyncResponse | OutscraperAsyncResponse>> {
  const op = "googleMapsSearch"
  const parsed = v.safeParse(googleMapsSearchOptionsSchema, options)
  if (!parsed.success) {
    return outscraperResultErrorCreate(op, `Invalid googleMapsSearch options: ${v.summarize(parsed.issues)}`)
  }

  const opt = parsed.output
  const queryArray = Array.isArray(opt.query) ? opt.query : [opt.query]

  const params: Record<string, string | number | boolean | readonly string[] | undefined> = {
    query: queryArray,
    organizationsPerQueryLimit: opt.limit,
    language: opt.language,
    region: opt.region,
    skipPlaces: opt.skip,
    dropDuplicates: opt.dropDuplicates,
    async: opt.async,
  }

  if (opt.enrichment) {
    params.enrichment = Array.isArray(opt.enrichment) ? opt.enrichment : [opt.enrichment]
  }

  if (opt.async) {
    return outscraperRequest(client, {
      op,
      path: "/maps/search-v2",
      params,
      schema: outscraperAsyncResponseSchema,
    })
  }

  return outscraperRequest(client, {
    op,
    path: "/maps/search-v2",
    params,
    schema: googleMapsSearchSyncResponseSchema,
  })
}
