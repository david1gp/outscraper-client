import { describe, expect, it } from "bun:test"
import { googleMapsSearchGet } from "../src/get-google-maps-search/googleMapsSearchGet.js"
import { outscraperClientCreate } from "../src/outscraperClientCreate.js"
import { businessesPost } from "../src/post-businesses/businessesPost.js"

describe("generated Outscraper endpoints", () => {
  it("validates query arguments before making a request", async () => {
    let fetchCalled = false
    const client = outscraperClientCreate({
      apiKey: "test-key",
      fetch: async () => {
        fetchCalled = true
        return new Response("{}", { status: 200 })
      },
    })

    const result = await googleMapsSearchGet(client, {
      query: {
        async: true,
        limit: 500,
        query: "cafes in Berlin",
        language: "not-a-language" as never,
      },
    })

    expect(result.success).toBe(false)
    expect(fetchCalled).toBe(false)
  })

  it("serializes documented body arguments through the shared runtime", async () => {
    let requestUrl = ""
    let requestMethod = ""
    let requestBody = ""
    const client = outscraperClientCreate({
      apiKey: "test-key",
      fetch: async (input, init) => {
        requestUrl = input.toString()
        requestMethod = init?.method ?? ""
        requestBody = String(init?.body ?? "")
        return new Response("{}", { status: 200 })
      },
    })

    const result = await businessesPost(client, { body: { limit: 5, query: "cafes" } })

    expect(result.success).toBe(true)
    expect(requestUrl).toContain("/businesses")
    expect(requestMethod).toBe("POST")
    expect(JSON.parse(requestBody)).toEqual({ include_total: false, limit: 5, query: "cafes" })
  })
})
