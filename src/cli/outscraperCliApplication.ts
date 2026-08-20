import { buildApplication, help, version } from "@stricli/core"
import { outscraperGeneratedCliCommands } from "../outscraperGeneratedCliCommands.js"

export const outscraperCliApplication = buildApplication(
  outscraperGeneratedCliCommands,
  {
    name: "outscraper-client",
    scanner: {
      caseStyle: "allow-kebab-for-camel",
    },
    documentation: {
      caseStyle: "convert-camel-to-kebab",
      disableAnsiColor: true,
    },
  },
  {
    help: help({
      brief: "Print help information and exit",
      formatting: {
        caseStyle: "convert-camel-to-kebab",
        onlyRequiredInUsageLine: false,
        useAliasInUsageLine: false,
      },
    }),
    version: version({
      brief: "Print version information and exit",
      info: {
        currentVersion: "0.1.0",
      },
    }),
  },
)
