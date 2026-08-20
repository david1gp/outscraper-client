import * as v from "valibot"
import { type Result } from "#result"
import { type OutscraperAsyncResponse, outscraperAsyncResponseSchema } from "./outscraperAsyncResponseSchema.js"
import type { OutscraperClient } from "./outscraperClientCreate.js"
import { outscraperRequest } from "./outscraperRequest.js"
import { outscraperResultErrorCreate } from "./outscraperResultErrorCreate.js"

export const googleMapsReviewsOptionsSchema = v.object({
  query: v.union([v.string(), v.array(v.string())]),
  reviewsLimit: v.optional(v.number(), 100),
  reviewsQuery: v.optional(v.string()),
  limit: v.optional(v.number(), 1),
  sort: v.optional(v.string(), "most_relevant"),
  lastPaginationId: v.optional(v.string()),
  start: v.optional(v.number()),
  cutoff: v.optional(v.number()),
  cutoffRating: v.optional(v.number()),
  ignoreEmpty: v.optional(v.boolean(), false),
  source: v.optional(v.string(), "google"),
  language: v.optional(v.string(), "en"),
  region: v.optional(v.string()),
  fields: v.optional(v.union([v.string(), v.array(v.string())])),
  async: v.optional(v.boolean(), false),
})

export type GoogleMapsReviewsOptions = v.InferInput<typeof googleMapsReviewsOptionsSchema>

export const googleMapsReviewsSyncResponseSchema = v.object({
  data: v.array(v.array(v.record(v.string(), v.unknown()))),
  status: v.optional(v.string()),
})

export type GoogleMapsReviewsSyncResponse = v.InferOutput<typeof googleMapsReviewsSyncResponseSchema>

export async function googleMapsReviews(
  client: OutscraperClient,
  options: GoogleMapsReviewsOptions,
): Promise<Result<GoogleMapsReviewsSyncResponse | OutscraperAsyncResponse>> {
  const op = "googleMapsReviews"
  const parsed = v.safeParse(googleMapsReviewsOptionsSchema, options)
  if (!parsed.success) {
    return outscraperResultErrorCreate(op, `Invalid googleMapsReviews options: ${v.summarize(parsed.issues)}`)
  }

  const opt = parsed.output
  const queryArray = Array.isArray(opt.query) ? opt.query : [opt.query]

  const params: Record<string, string | number | boolean | readonly string[] | undefined> = {
    query: queryArray,
    reviewsLimit: opt.reviewsLimit,
    reviewsQuery: opt.reviewsQuery,
    limit: opt.limit,
    sort: opt.sort,
    lastPaginationId: opt.lastPaginationId,
    start: opt.start,
    cutoff: opt.cutoff,
    cutoffRating: opt.cutoffRating,
    ignoreEmpty: opt.ignoreEmpty,
    source: opt.source,
    language: opt.language,
    region: opt.region,
    async: opt.async,
  }

  if (opt.fields) {
    params.fields = Array.isArray(opt.fields) ? opt.fields : [opt.fields]
  }

  if (opt.async) {
    return outscraperRequest(client, {
      op,
      path: "/maps/reviews-v3",
      params,
      schema: outscraperAsyncResponseSchema,
    })
  }

  return outscraperRequest(client, {
    op,
    path: "/maps/reviews-v3",
    params,
    schema: googleMapsReviewsSyncResponseSchema,
  })
}
