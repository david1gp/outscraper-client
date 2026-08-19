import type { Result } from "#result"
import * as v from "valibot"
import { type OutscraperAsyncResponse, outscraperAsyncResponseSchema } from "./outscraperAsyncResponseSchema.js"
import type { OutscraperClient } from "./outscraperClientCreate.js"
import { outscraperRequest } from "./outscraperRequest.js"

export const emailsAndContactsOptionsSchema = v.object({
  query: v.union([v.string(), v.array(v.string())]),
  preferredContacts: v.optional(v.union([v.string(), v.array(v.string())])),
  async: v.optional(v.boolean(), false),
})

export type EmailsAndContactsOptions = v.InferInput<typeof emailsAndContactsOptionsSchema>

export const emailsAndContactsSyncResponseSchema = v.object({
  data: v.array(v.array(v.record(v.string(), v.unknown()))),
  status: v.optional(v.string()),
})

export type EmailsAndContactsSyncResponse = v.InferOutput<typeof emailsAndContactsSyncResponseSchema>

export async function emailsAndContacts(
  client: OutscraperClient,
  options: EmailsAndContactsOptions,
): Promise<Result<EmailsAndContactsSyncResponse | OutscraperAsyncResponse>> {
  const op = "emailsAndContacts"
  const parsed = v.safeParse(emailsAndContactsOptionsSchema, options)
  if (!parsed.success) {
    return {
      success: false,
      op,
      errorMessage: `Invalid emailsAndContacts options: ${v.summarize(parsed.issues)}`,
    }
  }

  const opt = parsed.output
  const queryArray = Array.isArray(opt.query) ? opt.query : [opt.query]

  const params: Record<string, string | number | boolean | readonly string[] | undefined> = {
    query: queryArray,
    async: opt.async,
  }

  if (opt.preferredContacts) {
    params.preferredContacts = Array.isArray(opt.preferredContacts) ? opt.preferredContacts : [opt.preferredContacts]
  }

  if (opt.async) {
    return outscraperRequest(client, {
      op,
      path: "/emails-and-contacts",
      params,
      schema: outscraperAsyncResponseSchema,
    })
  }

  return outscraperRequest(client, {
    op,
    path: "/emails-and-contacts",
    params,
    schema: emailsAndContactsSyncResponseSchema,
  })
}
