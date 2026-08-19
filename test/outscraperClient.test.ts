import { describe, expect, it } from "bun:test"
import { businessesSearch } from "../src/businessesSearch.js"
import { emailsAndContacts } from "../src/emailsAndContacts.js"
import { googleMapsReviews } from "../src/googleMapsReviews.js"
import { googleMapsSearch } from "../src/googleMapsSearch.js"
import { outscraperClientCreate } from "../src/outscraperClientCreate.js"
import { requestArchiveGet } from "../src/requestArchiveGet.js"

describe("outscraper-client", () => {
  it("creates client instance with valid config", () => {
    const client = outscraperClientCreate({ apiKey: "test_key_123" })
    expect(client.config.apiKey).toBe("test_key_123")
    expect(client.config.baseUrl).toBe("https://api.app.outscraper.com")
  })

  it("handles googleMapsSearch with custom fetch mock", async () => {
    let requestedUrl = ""
    let headersReceived: Record<string, string> = {}

    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = input.toString()
      headersReceived = (init?.headers as Record<string, string>) ?? {}

      return new Response(
        JSON.stringify({
          status: "Success",
          data: [[{ name: "Coffee Shop", place_id: "ChIJ123", rating: 4.8 }]],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    const client = outscraperClientCreate({
      apiKey: "test_api_key",
      fetch: mockFetch,
    })

    const res = await googleMapsSearch(client, {
      query: "cafes in berlin",
      limit: 10,
      language: "de",
    })

    expect(res.success).toBe(true)
    if (res.success && "data" in res.data) {
      expect(res.data.data[0]?.[0]?.name).toBe("Coffee Shop")
      expect(res.data.data[0]?.[0]?.rating).toBe(4.8)
    }

    expect(headersReceived["X-API-KEY"]).toBe("test_api_key")
    expect(requestedUrl).toContain("/maps/search-v2")
    expect(requestedUrl).toContain("query=cafes+in+berlin")
    expect(requestedUrl).toContain("organizationsPerQueryLimit=10")
    expect(requestedUrl).toContain("language=de")
  })

  it("handles async googleMapsSearch response", async () => {
    const mockFetch = async () => {
      return new Response(
        JSON.stringify({
          id: "req_abc_123",
          status: "Pending",
          results_location: "https://api.app.outscraper.com/requests/req_abc_123",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    const client = outscraperClientCreate({
      apiKey: "test_api_key",
      fetch: mockFetch,
    })

    const res = await googleMapsSearch(client, {
      query: "restaurants brooklyn",
      async: true,
    })

    expect(res.success).toBe(true)
    if (res.success && "id" in res.data) {
      expect(res.data.id).toBe("req_abc_123")
      expect(res.data.status).toBe("Pending")
    }
  })

  it("handles emailsAndContacts correctly", async () => {
    const mockFetch = async () => {
      return new Response(
        JSON.stringify({
          status: "Success",
          data: [[{ domain: "example.com", emails: ["info@example.com"] }]],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    const client = outscraperClientCreate({
      apiKey: "test_api_key",
      fetch: mockFetch,
    })

    const res = await emailsAndContacts(client, {
      query: "example.com",
    })

    expect(res.success).toBe(true)
    if (res.success && "data" in res.data) {
      expect(res.data.data[0]?.[0]?.domain).toBe("example.com")
    }
  })

  it("handles googleMapsReviews correctly", async () => {
    const mockFetch = async () => {
      return new Response(
        JSON.stringify({
          status: "Success",
          data: [[{ author_title: "John Doe", review_rating: 5, review_text: "Great place!" }]],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    const client = outscraperClientCreate({
      apiKey: "test_api_key",
      fetch: mockFetch,
    })

    const res = await googleMapsReviews(client, {
      query: "ChIJrc9T9fpYwokRdvjYRHT8nI4",
      reviewsLimit: 10,
    })

    expect(res.success).toBe(true)
    if (res.success && "data" in res.data) {
      expect(res.data.data[0]?.[0]?.review_rating).toBe(5)
    }
  })

  it("handles businessesSearch correctly", async () => {
    const mockFetch = async (_: RequestInfo | URL, init?: RequestInit) => {
      const parsedBody = JSON.parse((init?.body as string) ?? "{}")
      expect(parsedBody.limit).toBe(5)
      return new Response(
        JSON.stringify({
          items: [{ name: "Target Store", country: "US" }],
          has_more: false,
          total: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    const client = outscraperClientCreate({
      apiKey: "test_api_key",
      fetch: mockFetch,
    })

    const res = await businessesSearch(client, {
      limit: 5,
      query: "target",
    })

    expect(res.success).toBe(true)
    if (res.success && "items" in res.data) {
      expect(res.data.items?.[0]?.name).toBe("Target Store")
      expect(res.data.total).toBe(1)
    }
  })

  it("handles requestArchiveGet correctly", async () => {
    const mockFetch = async () => {
      return new Response(
        JSON.stringify({
          id: "req_xyz",
          status: "Success",
          data: [[{ name: "Result Place" }]],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    const client = outscraperClientCreate({
      apiKey: "test_api_key",
      fetch: mockFetch,
    })

    const res = await requestArchiveGet(client, "req_xyz")

    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.id).toBe("req_xyz")
      expect(res.data.status).toBe("Success")
    }
  })

  it("returns Result error on HTTP failure", async () => {
    const mockFetch = async () => {
      return new Response("Unauthorized", { status: 401, statusText: "Unauthorized" })
    }

    const client = outscraperClientCreate({
      apiKey: "bad_key",
      fetch: mockFetch,
    })

    const res = await googleMapsSearch(client, { query: "berlin" })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.op).toBe("googleMapsSearch")
      expect(res.errorMessage).toContain("401")
    }
  })
})
