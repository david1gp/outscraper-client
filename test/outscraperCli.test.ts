import { describe, expect, it } from "bun:test"
import { outscraperGeneratedCliCommands } from "../src/outscraperGeneratedCliCommands.js"

type CliRun = {
  status: number
  stdout: string
  stderr: string
}

async function cliRun(args: readonly string[], env: Record<string, string | undefined> = {}): Promise<CliRun> {
  const child = Bun.spawn(["bun", "run", "src/cli.ts", ...args], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { status: await child.exited, stdout, stderr }
}

function routeCommandCount(): number {
  let count = 0
  for (const methodEntry of outscraperGeneratedCliCommands.getAllEntries()) {
    if (!("getAllEntries" in methodEntry.target)) continue
    for (const endpointEntry of methodEntry.target.getAllEntries()) {
      if (!("getAllEntries" in endpointEntry.target)) count += 1
    }
  }
  return count
}

describe("Outscraper CLI", () => {
  it("discovers all generated endpoint commands", async () => {
    const help = await cliRun(["get", "--help"])
    const postHelp = await cliRun(["post", "--help"])

    expect(help.status).toBe(0)
    expect(help.stdout).toContain("outscraper-client get google-maps-reviews")
    expect(postHelp.status).toBe(0)
    expect(postHelp.stdout).toContain("outscraper-client post tasks")
    expect(routeCommandCount()).toBe(107)
  })

  it("parses typed GET arguments and keeps API keys out of output", async () => {
    const requests: Array<{ url: string; apiKey: string | null }> = []
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        requests.push({ url: request.url, apiKey: request.headers.get("X-API-KEY") })
        return new Response("{}", { headers: { "content-type": "application/json" } })
      },
    })

    try {
      const result = await cliRun(
        [
          "--api-key",
          "cli-secret",
          "--base-url",
          server.url.origin,
          "get",
          "google-maps-search",
          "--query-query",
          "cafes",
          "--query-async",
          "false",
          "--query-limit",
          "2",
        ],
        { OUTSCRAPER_API_KEY: undefined },
      )

      expect(result.status).toBe(0)
      expect(result.stderr).toBe("")
      expect(result.stdout).not.toContain("cli-secret")
      expect(requests[0]?.apiKey).toBe("cli-secret")
      expect(new URL(requests[0]?.url ?? "").searchParams.get("async")).toBe("false")
      expect(new URL(requests[0]?.url ?? "").searchParams.get("limit")).toBe("2")
    } finally {
      server.stop()
    }
  })

  it("parses nested POST bodies and returns Result errors for invalid values", async () => {
    let requestBody = ""
    const server = Bun.serve({
      port: 0,
      fetch: async (request) => {
        requestBody = await request.text()
        return new Response(JSON.stringify({ id: "task-id" }), { headers: { "content-type": "application/json" } })
      },
    })

    try {
      const post = await cliRun([
        "post",
        "tasks",
        "--body",
        JSON.stringify({ queries: ["one", "two"], tags: ["test"], nested: { enabled: true } }),
        "--api-key",
        "post-secret",
        "--base-url",
        server.url.origin,
      ])
      expect(post.status).toBe(0)
      expect(JSON.parse(requestBody)).toEqual({
        queries: ["one", "two"],
        tags: ["test"],
        nested: { enabled: true },
      })
      expect(post.stdout).toBe('{\n  "id": "task-id"\n}\n')

      const invalid = await cliRun(
        ["get", "google-maps-search", "--query-query", "cafes", "--query-async", "not-a-boolean"],
        { OUTSCRAPER_API_KEY: "invalid-secret", OUTSCRAPER_BASE_URL: server.url.origin },
      )
      expect(invalid.status).not.toBe(0)
      expect(JSON.parse(invalid.stderr)).toMatchObject({ success: false, op: "googleMapsSearchGet" })
      expect(invalid.stderr).not.toContain("invalid-secret")

      const malformed = await cliRun(
        ["post", "tasks", "--body", "{", "--api-key", "malformed-secret", "--base-url", server.url.origin],
        { OUTSCRAPER_API_KEY: undefined },
      )
      expect(malformed.status).not.toBe(0)
      expect(JSON.parse(malformed.stderr)).toMatchObject({ success: false, op: "tasksPost" })
      expect(malformed.stderr).not.toContain("malformed-secret")
    } finally {
      server.stop()
    }
  })

  it("executes a representative DELETE route", async () => {
    const requests: Array<{ method: string; url: string; apiKey: string | null }> = []
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        requests.push({ method: request.method, url: request.url, apiKey: request.headers.get("X-API-KEY") })
        return new Response(JSON.stringify("deleted"), { headers: { "content-type": "application/json" } })
      },
    })

    try {
      const result = await cliRun(
        [
          "delete",
          "requests-request-id",
          "--path-request-id",
          "request/123",
          "--api-key",
          "delete-secret",
          "--base-url",
          server.url.origin,
        ],
        { OUTSCRAPER_API_KEY: undefined },
      )

      expect(result.status).toBe(0)
      expect(result.stderr).toBe("")
      expect(result.stdout).toBe('"deleted"\n')
      expect(requests[0]?.method).toBe("DELETE")
      expect(new URL(requests[0]?.url ?? "").pathname).toBe("/requests/request%2F123")
      expect(requests[0]?.apiKey).toBe("delete-secret")
      expect(result.stdout).not.toContain("delete-secret")
    } finally {
      server.stop()
    }
  })
})
