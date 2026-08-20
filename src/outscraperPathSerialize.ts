import { createResult, type Result } from "#result"
import { outscraperResultErrorCreate } from "./outscraperResultErrorCreate.js"

export function outscraperPathSerialize(
  op: string,
  path: string,
  pathParams?: Record<string, string | number | boolean>,
): Result<string> {
  const serializedPath = path.replace(/\{([^{}]+)\}/g, (_match, name: string) => {
    const value = pathParams?.[name]
    if (value === undefined) {
      return `{${name}}`
    }
    return encodeURIComponent(String(value))
  })

  if (/\{[^{}]+\}/.test(serializedPath)) {
    return outscraperResultErrorCreate(op, `Missing path parameter for ${serializedPath}`)
  }

  return createResult(serializedPath)
}
