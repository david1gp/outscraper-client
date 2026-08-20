import type { OutscraperQueryParamValue } from "./outscraperQueryParamValue.js"

export function outscraperQuerySerialize(params?: Record<string, OutscraperQueryParamValue>): URLSearchParams {
  const searchParams = new URLSearchParams()

  if (!params) {
    return searchParams
  }

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== "") {
          searchParams.append(key, String(item))
        }
      }
      continue
    }

    searchParams.set(key, String(value))
  }

  return searchParams
}
