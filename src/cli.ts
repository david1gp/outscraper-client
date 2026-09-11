#!/usr/bin/env bun
import { run } from "@stricli/core"
import { outscraperCliApplication } from "./cli/outscraperCliApplication.js"
import { outscraperCliGlobalConfigExtract } from "./cli/outscraperCliGlobalConfigExtract.js"
import { outscraperCliResultWrite } from "./cli/outscraperCliResultWrite.js"
import { outscraperCliVersionMetadataRender } from "./cli/outscraperCliVersionMetadataRender.js"

const globalConfig = outscraperCliGlobalConfigExtract(process.argv.slice(2))
if (!globalConfig.success) {
  outscraperCliResultWrite(process, globalConfig)
} else if (
  globalConfig.data.args.includes("--verbose") &&
  (globalConfig.data.args.includes("--version") || globalConfig.data.args[0] === "version")
) {
  process.stdout.write(outscraperCliVersionMetadataRender())
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
