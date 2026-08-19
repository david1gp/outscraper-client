import * as v from "valibot"

export const outscraperAsyncResponseSchema = v.object({
  id: v.string(),
  status: v.optional(v.string(), "Pending"),
  results_location: v.optional(v.string()),
})

export type OutscraperAsyncResponse = v.InferOutput<typeof outscraperAsyncResponseSchema>
