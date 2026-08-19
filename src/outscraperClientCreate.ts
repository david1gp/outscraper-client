import * as v from "valibot"
import { type OutscraperConfig, outscraperConfigSchema } from "./outscraperConfigSchema.js"

export interface OutscraperClient {
  config: OutscraperConfig
}

export function outscraperClientCreate(config: v.InferInput<typeof outscraperConfigSchema>): OutscraperClient {
  const parsed = v.parse(outscraperConfigSchema, config)
  return {
    config: parsed,
  }
}
