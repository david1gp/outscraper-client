import { describe, expect, it } from "bun:test"
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openApiCatalogGenerate } from "../scripts/openapi/openApiCatalogGenerate.js"
import { openApiCatalogNormalize } from "../scripts/openapi/openApiCatalogNormalize.js"
import { openApiCatalogSerialize } from "../scripts/openapi/openApiCatalogSerialize.js"
import { openApiSnapshotAcquire } from "../scripts/openapi/openApiSnapshotAcquire.js"

describe("OpenAPI generator foundation", () => {
  it("normalizes and generates a fixture deterministically", async () => {
    const fixture = await Bun.file("test/fixtures/openapi-small.json").json()
    const firstCatalog = openApiCatalogNormalize(fixture)
    const secondCatalog = openApiCatalogNormalize(fixture)

    expect(firstCatalog.success).toBe(true)
    expect(secondCatalog.success).toBe(true)
    if (!firstCatalog.success || !secondCatalog.success) return

    expect(openApiCatalogSerialize(firstCatalog.data)).toBe(openApiCatalogSerialize(secondCatalog.data))
    expect(firstCatalog.data.operations.map((operation) => operation.operationId)).toEqual(["petCreate", "petGet"])
    expect(firstCatalog.data.operations[1]?.parameters.map((parameter) => parameter.name)).toEqual([
      "petId",
      "includeOwner",
    ])
    expect(firstCatalog.data.source.securitySchemes?.ApiKeyAuth?.name).toBe("X-API-KEY")
    expect(firstCatalog.data.operations[1]?.parameters[0]?.description).toBe("Pet identifier")
    expect(firstCatalog.data.operations[1]?.parameters[0]?.schema).toEqual({ minLength: 1, type: "string" })
    expect(firstCatalog.data.operations[1]?.responses[0]?.headers).toEqual({
      "X-Request-Id": { schema: { type: "string" } },
    })
    expect(firstCatalog.data.operations[0]?.requestBody?.description).toBe("A new pet")
    expect(firstCatalog.data.operations[0]?.security).toEqual([])

    const firstFiles = openApiCatalogGenerate(firstCatalog.data)
    const secondFiles = openApiCatalogGenerate(secondCatalog.data)
    expect(firstFiles).toEqual(secondFiles)
    expect(firstFiles.success).toBe(true)
    expect(secondFiles.success).toBe(true)
    if (!firstFiles.success || !secondFiles.success) return

    expect(Object.keys(firstFiles.data).sort()).toEqual([
      "outscraperGeneratedCliCommands.ts",
      "outscraperGeneratedExports.ts",
      "pet-create/petCreatePost.ts",
      "pet-create/petCreatePostDefinition.ts",
      "pet-create/petCreatePostInputSchema.ts",
      "pet-create/petCreatePostResponseSchema.ts",
      "pet-get/petGetGet.ts",
      "pet-get/petGetGetDefinition.ts",
      "pet-get/petGetGetInputSchema.ts",
      "pet-get/petGetGetResponseSchema.ts",
    ])
    expect(firstFiles.data["pet-create/petCreatePostDefinition.ts"]).toContain('"method": "POST"')
    expect(firstFiles.data["pet-get/petGetGetDefinition.ts"]).toContain('"path": "/pets/{petId}"')
    expect(firstFiles.data["pet-get/petGetGetInputSchema.ts"]).toContain("v.boolean()")
    expect(firstFiles.data["pet-create/petCreatePost.ts"]).toContain('method: "POST"')
    expect(firstFiles.data["outscraperGeneratedCliCommands.ts"]).toContain("petCreatePostCliCommand")

    const firstDirectory = await mkdtemp(join(tmpdir(), "outscraper-openapi-first-"))
    const secondDirectory = await mkdtemp(join(tmpdir(), "outscraper-openapi-second-"))
    try {
      for (const [filePath, source] of Object.entries(firstFiles.data)) {
        await mkdir(join(firstDirectory, filePath, ".."), { recursive: true })
        await mkdir(join(secondDirectory, filePath, ".."), { recursive: true })
        await Bun.write(join(firstDirectory, filePath), source)
        await Bun.write(join(secondDirectory, filePath), secondFiles.data[filePath] ?? "")
      }
      const firstFileNames = (await readdir(firstDirectory, { recursive: true })).sort()
      const secondFileNames = (await readdir(secondDirectory, { recursive: true })).sort()
      expect(firstFileNames).toEqual(secondFileNames)
      for (const fileName of firstFileNames.filter((fileName) => fileName.endsWith(".ts"))) {
        expect(await Bun.file(join(firstDirectory, fileName)).text()).toBe(
          await Bun.file(join(secondDirectory, fileName)).text(),
        )
      }
    } finally {
      await rm(firstDirectory, { recursive: true, force: true })
      await rm(secondDirectory, { recursive: true, force: true })
    }
  })

  it("generates one unique endpoint folder for every official operation", async () => {
    const catalog = await Bun.file("openapi/outscraper-api.normalized.json").json()
    const generated = openApiCatalogGenerate(catalog)

    expect(generated.success).toBe(true)
    if (!generated.success) return

    const folders = catalog.operations.map((operation: { folder: string }) => operation.folder)
    expect(catalog.operations).toHaveLength(107)
    expect(new Set(folders)).toHaveLength(107)
    expect(folders.every((folder: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folder))).toBe(true)
    expect(Object.keys(generated.data)).toHaveLength(430)
    expect(generated.data["outscraperGeneratedExports.ts"]).toContain("googleMapsReviewsGet")
  })

  it("acquires a canonical unauthenticated OpenAPI snapshot", async () => {
    const snapshot = await openApiSnapshotAcquire(
      "https://example.test/openapi.json",
      async () =>
        new Response(JSON.stringify({ paths: {}, openapi: "3.1.0", info: { version: "1", title: "Fixture" } })),
    )

    expect(snapshot.success).toBe(true)
    if (!snapshot.success) return
    expect(snapshot.data).toEqual({
      info: { title: "Fixture", version: "1" },
      openapi: "3.1.0",
      paths: {},
    })
  })
})
