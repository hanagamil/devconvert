import { isRecord } from './jsonArrayUtils'

export interface ConvertOptions {
  delimiter?: ',' | ';' | '\t'
  flattenNestedObjects?: boolean
  protectSpreadsheetFormulas?: boolean
  selectedColumns?: string[]
}

export interface ConvertResult {
  headers: string[]
  rows: string[][]
  csv: string
}

function flattenObject(
  value: Record<string, unknown>,
  prefix = '',
  output: Record<string, unknown> = {},
): Record<string, unknown> {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (isRecord(child) && Object.keys(child).length > 0) {
      flattenObject(child, path, output)
    } else {
      // Arrays are kept in a single cell as JSON, avoiding accidental row duplication.
      output[path] = child
    }
  }

  return output
}

function cellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function protectFormula(value: string): string {
  // Mitigation for common spreadsheet formula prefixes; not a guarantee for every app.
  return /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value
}

function escapeCell(value: string, delimiter: string): string {
  const escaped = value.replace(/"/g, '""')
  const needsQuotes =
    escaped.includes('"') ||
    escaped.includes('\n') ||
    escaped.includes('\r') ||
    escaped.includes(delimiter)

  return needsQuotes ? `"${escaped}"` : escaped
}


/**
 * Converts a top-level JSON array of objects to CSV.
 * Nested objects can be flattened into dot-separated column names.
 */
export function convertJsonToCsv(
  input: unknown,
  options: ConvertOptions = {},
): ConvertResult {
  const delimiter = options.delimiter ?? ','
  const flatten = options.flattenNestedObjects ?? true
  const protectFormulas = options.protectSpreadsheetFormulas ?? true

  if (!Array.isArray(input)) {
    throw new Error(
      'Expected a JSON array of objects, for example: [{ "name": "Alice" }].',
    )
  }

  if (input.length === 0) {
    throw new Error('The JSON array is empty. Add at least one object to convert.')
  }

  if (!input.every(isRecord)) {
    throw new Error('Every item in the top-level JSON array must be an object.')
  }

  const records = input.map((item) =>
    flatten ? flattenObject(item) : item,
  )

  // Keep the first-seen order of columns while including keys from every record.
  const headers: string[] = []
  const seen = new Set<string>()

  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key)
        headers.push(key)
      }
    }
  }

  if (headers.length === 0) {
    throw new Error('No columns found to export. Add fields to at least one object.')
  }

  const selectedHeaders = options.selectedColumns
    ? headers.filter((header) => options.selectedColumns?.includes(header))
    : headers

  const rows = records.map((record) =>
    selectedHeaders.map((header) => {
      const rawValue = record[header]
      let value = cellValue(rawValue)

      // Only protect strings, so numeric negatives remain ordinary numbers.
      if (protectFormulas && typeof rawValue === 'string') {
        value = protectFormula(value)
      }

      return value
    }),
  )

  const csv = [selectedHeaders, ...rows]
    .map((row) => row.map((cell) => escapeCell(cell, delimiter)).join(delimiter))
    .join('\r\n')

  return { headers: selectedHeaders, rows, csv }
}
