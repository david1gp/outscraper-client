export function openApiValueCanonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => openApiValueCanonicalize(item))
  }

  if (value === null || typeof value !== "object") {
    return value
  }

  const record = value as Record<string, unknown>
  const entries = Object.keys(record)
    .sort()
    .map((key) => [key, openApiValueCanonicalize(record[key])] as const)

  return Object.fromEntries(entries)
}
