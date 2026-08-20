#!/usr/bin/env bun
import { run } from "@stricli/core"
import { outscraperCliApplication } from "./cli/outscraperCliApplication.js"
import { outscraperCliGlobalConfigExtract } from "./cli/outscraperCliGlobalConfigExtract.js"
import { outscraperCliResultWrite } from "./cli/outscraperCliResultWrite.js"

const globalConfig = outscraperCliGlobalConfigExtract(process.argv.slice(2))
if (!globalConfig.success) {
  outscraperCliResultWrite(process, globalConfig)
} else {
  const runProcess = {
    env: { ...process.env, ...globalConfig.data.env },
    stdout: process.stdout,
    stderr: process.stderr,
    get exitCode() {
      return process.exitCode
    },
    set exitCode(value: number | string | null | undefined) {
      process.exitCode = value
    },
  }
  await run(outscraperCliApplication, globalConfig.data.args, { process: runProcess })
}
