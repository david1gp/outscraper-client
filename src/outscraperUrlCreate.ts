import { createResult, type Result } from "#result"
import { outscraperPathSerialize } from "./outscraperPathSerialize.js"
import type { OutscraperQueryParamValue } from "./outscraperQueryParamValue.js"
import { outscraperQuerySerialize } from "./outscraperQuerySerialize.js"
import { outscraperResultErrorCreate } from "./outscraperResultErrorCreate.js"

export function outscraperUrlCreate(
  op: string,
  baseUrl: string,
  path: string,
  pathParams?: Record<string, string | number | boolean>,
  params?: Record<string, OutscraperQueryParamValue>,
): Result<URL> {
  const serializedPath = outscraperPathSerialize(op, path, pathParams)
  if (!serializedPath.success) {
    return serializedPath
  }

  try {
    const base = new URL(baseUrl)
    const basePath = base.pathname === "/" ? "/" : `${base.pathname.replace(/\/+$/, "")}/`
    const requestPath = serializedPath.data.replace(/^\/+/, "")
    const url = new URL(`${basePath}${requestPath}`, base.origin)

    for (const [key, value] of base.searchParams) {
      url.searchParams.append(key, value)
    }

    for (const [key, value] of outscraperQuerySerialize(params)) {
      url.searchParams.append(key, value)
    }

    return createResult(url)
  } catch (error) {
    return outscraperResultErrorCreate(
      op,
      `Invalid request URL: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
