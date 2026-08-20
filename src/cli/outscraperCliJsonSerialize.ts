import { createResult, createResultError, type Result } from "#result"

function valueStable(value: unknown, ancestors: ReadonlySet<object>): unknown {
  if (typeof value === "bigint") return value.toString()
  if (value === null || typeof value !== "object") return value
  if (ancestors.has(value)) return "[Circular]"

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)
  if (Array.isArray(value)) return value.map((item) => valueStable(item, nextAncestors))

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, valueStable((value as Record<string, unknown>)[key], nextAncestors)]),
  )
}

export function outscraperCliJsonSerialize(value: unknown): Result<string> {
  const op = "outscraperCliJsonSerialize"
  try {
    const serialized = JSON.stringify(valueStable(value, new Set()), null, 2)
    if (serialized === undefined) return createResultError(op, "CLI output cannot be serialized as JSON")
    return createResult(serialized)
  } catch (error) {
    return createResultError(
      op,
      `CLI output serialization failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
