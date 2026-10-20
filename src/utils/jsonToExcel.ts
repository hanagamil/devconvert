export type ExcelCellValue = string | number | boolean | null

export interface ConvertJsonToExcelOptions {
  flattenNestedObjects?: boolean
  selectedColumns?: string[]
}

export interface ConvertJsonToExcelResult {
  headers: string[]
  rows: ExcelCellValue[][]
}

const MAX_EXCEL_ROWS = 1_048_576
const MAX_EXCEL_COLUMNS = 16_384

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function stringifyStructuredValue(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return String(value)
  }
}

function flattenObject(
  value: Record<string, unknown>,
  flattenNestedObjects: boolean,
  prefix = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (flattenNestedObjects && isPlainObject(item) && Object.keys(item).length > 0) {
      Object.assign(result, flattenObject(item, flattenNestedObjects, path))
    } else {
      result[path] = item
    }
  }

  return result
}

function toCellValue(value: unknown): ExcelCellValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (typeof value === 'object') return stringifyStructuredValue(value)
  return String(value)
}

/**
 * Converts an array of JSON objects to worksheet rows while preserving JSON scalar types.
 * Nested object properties are flattened to dotted column names by default.
 */
export function convertJsonToExcelData(
  input: unknown,
  options: ConvertJsonToExcelOptions = {},
): ConvertJsonToExcelResult {
  const flattenNestedObjects = options.flattenNestedObjects ?? true

  if (!Array.isArray(input)) {
    throw new Error('Expected a JSON array of objects. Select an array in your JSON input.')
  }
  if (input.length === 0) throw new Error('The selected JSON array is empty.')
  if (!input.every(isPlainObject)) {
    throw new Error('Every item in the selected JSON array must be an object.')
  }
  if (input.length + 1 > MAX_EXCEL_ROWS) {
    throw new Error(`Excel supports up to ${MAX_EXCEL_ROWS - 1} data rows plus a header row per worksheet.`)
  }

  const records = input.map((item) => flattenObject(item, flattenNestedObjects))
  const allHeaders: string[] = []
  const seenHeaders = new Set<string>()

  for (const record of records) {
    for (const header of Object.keys(record)) {
      if (!seenHeaders.has(header)) {
        seenHeaders.add(header)
        allHeaders.push(header)
      }
    }
  }

  if (allHeaders.length === 0) throw new Error('No columns found to export. The selected objects are empty.')
  if (allHeaders.length > MAX_EXCEL_COLUMNS) {
    throw new Error(`Excel supports up to ${MAX_EXCEL_COLUMNS} columns per worksheet.`)
  }

  const selected = options.selectedColumns
    ? new Set(options.selectedColumns.filter((header) => seenHeaders.has(header)))
    : null
  const headers = selected ? allHeaders.filter((header) => selected.has(header)) : allHeaders
  if (headers.length === 0) throw new Error('Choose at least one column to export.')

  const rows = records.map((record) => headers.map((header) => toCellValue(record[header])))
  return { headers, rows }
}

function sanitizeXmlText(value: string): string {
  // XML 1.0 excludes most C0 control characters. Valid tabs and line breaks are retained.
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
}

function escapeXml(value: string): string {
  return sanitizeXmlText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function columnName(index: number): string {
  let number = index + 1
  let name = ''
  while (number > 0) {
    const remainder = (number - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    number = Math.floor((number - 1) / 26)
  }
  return name
}

function cellXml(reference: string, value: ExcelCellValue): string {
  if (value === null || value === undefined) return `<c r="${reference}"/>`
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}"><v>${String(value)}</v></c>`
  }
  if (typeof value === 'boolean') {
    return `<c r="${reference}" t="b"><v>${value ? '1' : '0'}</v></c>`
  }

  // All strings are explicitly stored as text, so values beginning with =, +, - or @
  // cannot be interpreted as spreadsheet formulas.
  const text = escapeXml(String(value))
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`
}

function worksheetXml(headers: string[], rows: ExcelCellValue[][]): string {
  const allRows: ExcelCellValue[][] = [headers, ...rows]
  const lastCell = `${columnName(Math.max(headers.length - 1, 0))}${allRows.length}`
  const sheetRows = allRows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1
    const cells = headers.map((_, columnIndex) => cellXml(`${columnName(columnIndex)}${rowNumber}`, row[columnIndex] ?? null)).join('')
    return `<row r="${rowNumber}">${cells}</row>`
  }).join('')
  const autoFilter = rows.length > 0 ? `<autoFilter ref="A1:${lastCell}"/>` : ''

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/><sheetData>${sheetRows}</sheetData>${autoFilter}</worksheet>`
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((total, part) => total + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

/** Creates a standards-compliant ZIP using the STORE method, avoiding a runtime dependency. */
function createZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  const now = new Date()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  let localOffset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const checksum = crc32(entry.data)
    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true) // UTF-8 filenames
    localView.setUint16(8, 0, true) // STORE, no compression
    localView.setUint16(10, dosTime, true)
    localView.setUint16(12, dosDate, true)
    localView.setUint32(14, checksum, true)
    localView.setUint32(18, entry.data.length, true)
    localView.setUint32(22, entry.data.length, true)
    localView.setUint16(26, nameBytes.length, true)
    localView.setUint16(28, 0, true)
    localHeader.set(nameBytes, 30)
    localParts.push(localHeader, entry.data)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, dosTime, true)
    centralView.setUint16(14, dosDate, true)
    centralView.setUint32(16, checksum, true)
    centralView.setUint32(20, entry.data.length, true)
    centralView.setUint32(24, entry.data.length, true)
    centralView.setUint16(28, nameBytes.length, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, localOffset, true)
    centralHeader.set(nameBytes, 46)
    centralParts.push(centralHeader)

    localOffset += localHeader.length + entry.data.length
  }

  const centralDirectory = concatBytes(centralParts)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralDirectory.length, true)
  endView.setUint32(16, localOffset, true)
  endView.setUint16(20, 0, true)

  return concatBytes([...localParts, centralDirectory, end])
}

/** Builds a valid .xlsx workbook containing a single worksheet named "Data". */
export function createXlsxWorkbook(headers: string[], rows: ExcelCellValue[][]): Uint8Array {
  if (headers.length === 0) throw new Error('Cannot create an Excel workbook without columns.')
  if (headers.length > MAX_EXCEL_COLUMNS) throw new Error(`Excel supports up to ${MAX_EXCEL_COLUMNS} columns per worksheet.`)
  if (rows.length + 1 > MAX_EXCEL_ROWS) throw new Error(`Excel supports up to ${MAX_EXCEL_ROWS - 1} data rows plus a header row per worksheet.`)
  if (rows.some((row) => row.length > headers.length)) {
    throw new Error('A data row contains more cells than the selected header row.')
  }

  const encoder = new TextEncoder()
  const entries: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>'),
    },
    {
      name: '_rels/.rels',
      data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>'),
    },
    {
      name: 'xl/workbook.xml',
      data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<bookViews><workbookView/></bookViews><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '</Relationships>'),
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      data: encoder.encode(worksheetXml(headers, rows)),
    },
  ]

  return createZip(entries)
}
