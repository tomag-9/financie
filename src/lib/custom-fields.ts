export type SnapshotCustomFieldPrimitive = string | number | boolean | null
export type SnapshotCustomValues = Record<string, SnapshotCustomFieldPrimitive>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function toPrimitive(value: unknown): SnapshotCustomFieldPrimitive | undefined {
  if (value === null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value
  if (isFiniteNumber(value)) return value
  return undefined
}

export function normalizeSnapshotCustomValues(input: unknown): SnapshotCustomValues {
  if (!isRecord(input)) {
    return {}
  }

  const normalized: SnapshotCustomValues = {}

  for (const [key, value] of Object.entries(input)) {
    const trimmedKey = key.trim()
    if (!trimmedKey) continue

    const primitiveValue = toPrimitive(value)
    if (primitiveValue !== undefined) {
      normalized[trimmedKey] = primitiveValue
    }
  }

  return normalized
}

export function parseSnapshotCustomValues(rawNote: string | null | undefined): SnapshotCustomValues {
  if (!rawNote) {
    return {}
  }

  try {
    const parsed = JSON.parse(rawNote) as unknown

    if (isRecord(parsed) && 'values' in parsed) {
      return normalizeSnapshotCustomValues((parsed as { values: unknown }).values)
    }

    return normalizeSnapshotCustomValues(parsed)
  } catch {
    return {}
  }
}
