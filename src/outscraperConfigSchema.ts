import * as v from "valibot"

export type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export const outscraperConfigSchema = v.object({
  apiKey: v.string(),
  baseUrl: v.optional(v.string(), "https://api.app.outscraper.com"),
  fetch: v.optional(v.custom<FetchFunction>((val) => typeof val === "function")),
})

export type OutscraperConfig = v.InferOutput<typeof outscraperConfigSchema>
