import { LEAD_EXPORT_FIELDS } from '@/lib/export'

export interface ExportPreferences {
  fields?: string[]
  filename: string
  bom: boolean
}

export function safeExportFilename(value: unknown): string {
  if (typeof value !== 'string') return `leadzipp-export-${Date.now()}`
  const withoutExtension = value.replace(/\.csv$/i, '')
  const safe = withoutExtension
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return safe || `leadzipp-export-${Date.now()}`
}

export function parseExportPreferences(body: {
  fields?: unknown
  filename?: unknown
  bom?: unknown
}): ExportPreferences {
  const validFieldKeys = new Set(LEAD_EXPORT_FIELDS.map((field) => field.key))
  const fields = Array.isArray(body.fields)
    ? body.fields.filter(
        (field): field is string => typeof field === 'string' && validFieldKeys.has(field)
      )
    : undefined

  return {
    fields,
    filename: safeExportFilename(body.filename),
    bom: body.bom === true,
  }
}
