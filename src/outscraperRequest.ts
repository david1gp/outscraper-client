import * as v from "valibot"
import { type Result } from "#result"
import { outscraperBodySerialize } from "./outscraperBodySerialize.js"
import type { OutscraperClient } from "./outscraperClientCreate.js"
import type { OutscraperHeaderValue } from "./outscraperHeaderValue.js"
import { outscraperHttpErrorCreate } from "./outscraperHttpErrorCreate.js"
import type { OutscraperQueryParamValue } from "./outscraperQueryParamValue.js"
import { outscraperResponseJsonParse } from "./outscraperResponseJsonParse.js"
import { outscraperResponseValidate } from "./outscraperResponseValidate.js"
import { outscraperResultErrorCreate } from "./outscraperResultErrorCreate.js"
import { outscraperUrlCreate } from "./outscraperUrlCreate.js"

export type { OutscraperQueryParamValue as QueryParamValue } from "./outscraperQueryParamValue.js"

export async function outscraperRequest<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  client: OutscraperClient,
  options: {
    op: string
    path: string
    method?: string
    pathParams?: Record<string, string | number | boolean>
    params?: Record<string, OutscraperQueryParamValue>
    headers?: Record<string, OutscraperHeaderValue>
    body?: unknown
    contentType?: string
    schema: TSchema
    baseUrl?: string
  },
): Promise<Result<v.InferOutput<TSchema>>> {
  const { op, path, method = "GET", pathParams, params, headers: parameterHeaders, body, contentType, schema } = options
  const baseUrl = options.baseUrl ?? client.config.baseUrl

  const urlResult = outscraperUrlCreate(op, baseUrl, path, pathParams, params)
  if (!urlResult.success) {
    return urlResult
  }

  const headers: Record<string, string> = {
    "X-API-KEY": client.config.apiKey,
    client: "TypeScript SDK",
    Accept: "application/json",
  }

  for (const [name, value] of Object.entries(parameterHeaders ?? {})) {
    if (value === undefined) continue
    headers[name] = Array.isArray(value) ? value.join(",") : String(value)
  }

  if (body !== undefined) {
    headers["Content-Type"] = contentType ?? "application/json"
  }

  const bodyResult =
    body === undefined ? { success: true as const, data: undefined } : outscraperBodySerialize(op, body)
  if (!bodyResult.success) {
    return bodyResult
  }

  const fetchFn = client.config.fetch ?? fetch

  let response: Response
  try {
    response = await fetchFn(urlResult.data.toString(), {
      method,
      headers,
      body: bodyResult.data,
    })
  } catch (err) {
    return outscraperResultErrorCreate(op, `Fetch failed: ${err instanceof Error ? err.message : String(err)}`, {
      apiKey: client.config.apiKey,
    })
  }

  if (!response.ok) {
    return outscraperHttpErrorCreate(op, response, client.config.apiKey)
  }

  if (response.status === 204) {
    return outscraperResponseValidate(op, undefined, schema, client.config.apiKey)
  }

  let responseText: string
  try {
    responseText = await response.text()
  } catch (err) {
    return outscraperResultErrorCreate(
      op,
      `Response body read failed: ${err instanceof Error ? err.message : String(err)}`,
      {
        apiKey: client.config.apiKey,
      },
    )
  }

  const jsonResult = outscraperResponseJsonParse(op, responseText, client.config.apiKey)
  if (!jsonResult.success) {
    return jsonResult
  }

  return outscraperResponseValidate(op, jsonResult.data, schema, client.config.apiKey)
}
