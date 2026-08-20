import type { StricliProcess } from "@stricli/core"
import { createResultError, type Result } from "#result"
import { outscraperCliJsonSerialize } from "./outscraperCliJsonSerialize.js"

function secretRedact(value: string, secret?: string): string {
  if (!secret) return value
  return value.split(secret).join("[REDACTED]")
}

export function outscraperCliResultWrite(process: StricliProcess, result: Result<unknown>, secret?: string): void {
  const output = result.success ? result.data : result
  const serialized = outscraperCliJsonSerialize(output)
  if (!serialized.success) {
    process.stderr.write(
      `${secretRedact(JSON.stringify(createResultError("outscraperCliResultWrite", serialized.errorMessage)), secret)}\n`,
    )
    process.exitCode = 1
    return
  }

  const safeOutput = secretRedact(serialized.data, secret)
  if (result.success) {
    process.stdout.write(`${safeOutput}\n`)
    return
  }

  process.stderr.write(`${safeOutput}\n`)
  process.exitCode = 1
}
