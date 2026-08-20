import { describe, expect, it } from "bun:test"
import * as v from "valibot"
import { outscraperClientCreate } from "../src/outscraperClientCreate.js"
import { outscraperClientCreateResult } from "../src/outscraperClientCreateResult.js"
import { outscraperRequest } from "../src/outscraperRequest.js"

const responseSchema = v.object({ ok: v.boolean() })

describe("outscraper shared runtime", () => {
  it("validates Result-based client configuration", () => {
    const result = outscraperClientCreateResult({ apiKey: 123 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.op).toBe("outscraperConfigValidate")
    }
  })

  it("serializes the base path, path parameters, and query values", async () => {
    let requestedUrl = ""
    const client = outscraperClientCreate({
      apiKey: "test-key",
      baseUrl: "https://example.test/api/",
      fetch: async (input) => {
        requestedUrl = input.toString()
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    const result = await outscraperRequest(client, {
      op: "runtimeTest",
      path: "/items/{itemId}",
      pathParams: { itemId: "a/b" },
      params: { tag: ["one", "", "two"], enabled: false, omitted: null },
      schema: responseSchema,
    })

    expect(result.success).toBe(true)
    expect(requestedUrl).toBe("https://example.test/api/items/a%2Fb?tag=one&tag=two&enabled=false")
  })

  it("serializes header arrays and JSON body arrays", async () => {
    let requestedUrl = ""
    let requestedHeaders: Record<string, string> = {}
    let requestedBody = ""
    const client = outscraperClientCreate({
      apiKey: "test-key",
      fetch: async (input, init) => {
        requestedUrl = input.toString()
        requestedHeaders = (init?.headers ?? {}) as Record<string, string>
        requestedBody = String(init?.body ?? "")
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    const result = await outscraperRequest(client, {
      op: "serializationTest",
      path: "/items/{itemId}",
      pathParams: { itemId: "item/1" },
      params: { tags: ["one", "", "two"] },
      headers: { "X-Trace": ["first", "second"] },
      method: "POST",
      body: { values: ["one", "two"] },
      contentType: "application/custom+json",
      schema: responseSchema,
    })

    expect(result.success).toBe(true)
    expect(requestedUrl).toBe("https://api.app.outscraper.com/items/item%2F1?tags=one&tags=two")
    expect(requestedHeaders["X-Trace"]).toBe("first,second")
    expect(requestedHeaders["Content-Type"]).toBe("application/custom+json")
    expect(JSON.parse(requestedBody)).toEqual({ values: ["one", "two"] })
  })

  it("returns a Result error when a request body cannot be serialized", async () => {
    let fetchCalled = false
    const body: Record<string, unknown> = {}
    body.self = body
    const client = outscraperClientCreate({
      apiKey: "test-key",
      fetch: async () => {
        fetchCalled = true
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    const result = await outscraperRequest(client, {
      op: "runtimeTest",
      path: "/items",
      method: "POST",
      body,
      schema: responseSchema,
    })

    expect(result.success).toBe(false)
    expect(fetchCalled).toBe(false)
  })

  it("validates JSON response bodies through the shared Result path", async () => {
    const client = outscraperClientCreate({
      apiKey: "test-key",
      fetch: async () => new Response("not-json", { status: 200 }),
    })

    const result = await outscraperRequest(client, {
      op: "runtimeTest",
      path: "/items",
      schema: responseSchema,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.op).toBe("runtimeTest")
      expect(result.errorMessage).toContain("Invalid JSON response")
    }
  })

  it("returns Result errors for network and response schema failures", async () => {
    const apiKey = "secret-network-key"
    const networkClient = outscraperClientCreate({
      apiKey,
      fetch: async () => {
        throw new Error(`network failed for ${apiKey}`)
      },
    })

    const networkResult = await outscraperRequest(networkClient, {
      op: "networkTest",
      path: "/items",
      schema: responseSchema,
    })

    expect(networkResult.success).toBe(false)
    if (!networkResult.success) {
      expect(networkResult.op).toBe("networkTest")
      expect(networkResult.errorMessage).toContain("Fetch failed")
      expect(networkResult.errorMessage).not.toContain(apiKey)
    }

    const invalidResponseClient = outscraperClientCreate({
      apiKey: "test-key",
      fetch: async () => new Response(JSON.stringify({ ok: "yes" }), { status: 200 }),
    })
    const invalidResponseResult = await outscraperRequest(invalidResponseClient, {
      op: "responseSchemaTest",
      path: "/items",
      schema: responseSchema,
    })

    expect(invalidResponseResult.success).toBe(false)
    if (!invalidResponseResult.success) {
      expect(invalidResponseResult.op).toBe("responseSchemaTest")
      expect(invalidResponseResult.errorMessage).toContain("Schema validation failed")
    }
  })

  it("normalizes HTTP errors without exposing the API key", async () => {
    const apiKey = "secret-test-key"
    const client = outscraperClientCreate({
      apiKey,
      fetch: async () => new Response(`failed for ${apiKey}`, { status: 403, statusText: "Forbidden" }),
    })

    const result = await outscraperRequest(client, {
      op: "runtimeTest",
      path: "/items",
      schema: responseSchema,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.op).toBe("runtimeTest")
      expect(result.statusCode).toBe(403)
      expect(result.errorMessage).toContain("403")
      expect(result.errorMessage).not.toContain(apiKey)
    }
  })
})
