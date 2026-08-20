import * as v from "valibot"
import { createResult, type Result } from "#result"
import { outscraperResultErrorCreate } from "./outscraperResultErrorCreate.js"

export function outscraperResponseValidate<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  op: string,
  body: unknown,
  schema: TSchema,
  apiKey?: string,
): Result<v.InferOutput<TSchema>> {
  const parsed = v.safeParse(schema, body)
  if (!parsed.success) {
    return outscraperResultErrorCreate(op, `Schema validation failed: ${v.summarize(parsed.issues)}`, { apiKey })
  }

  return createResult(parsed.output)
}
