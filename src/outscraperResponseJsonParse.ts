import * as v from "valibot"
import { createResult, type Result } from "#result"
import { outscraperResultErrorCreate } from "./outscraperResultErrorCreate.js"

export function outscraperResponseJsonParse(op: string, text: string, apiKey?: string): Result<unknown> {
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson()), text)
  if (!parsed.success) {
    return outscraperResultErrorCreate(op, `Invalid JSON response: ${v.summarize(parsed.issues)}`, { apiKey })
  }

  return createResult(parsed.output)
}
