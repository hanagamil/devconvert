import { describe, expect, it } from 'vitest'
import { convertJsonToExcelData, createXlsxWorkbook } from './jsonToExcel'

describe('convertJsonToExcelData', () => {
  it('converts object arrays and preserves numeric and boolean values', () => {
    const result = convertJsonToExcelData([
      { name: 'Alice', age: 29, active: true },
      { name: 'Bob', age: 32, active: false },
    ])

    expect(result.headers).toEqual(['name', 'age', 'active'])
    expect(result.rows).toEqual([
      ['Alice', 29, true],
      ['Bob', 32, false],
    ])
  })

  it('flattens nested objects into dotted column names', () => {
    const result = convertJsonToExcelData([{ profile: { city: 'Cairo', team: 'Platform' } }])
    expect(result.headers).toEqual(['profile.city', 'profile.team'])
    expect(result.rows).toEqual([['Cairo', 'Platform']])
  })

  it('can keep nested objects as JSON text', () => {
    const result = convertJsonToExcelData([{ profile: { city: 'Cairo' } }], { flattenNestedObjects: false })
    expect(result.headers).toEqual(['profile'])
    expect(result.rows).toEqual([[`{"city":"Cairo"}`]])
  })

  it('keeps array values in a single JSON text cell and exports missing or null values as blanks', () => {
    const result = convertJsonToExcelData([
      { name: 'Alice', tags: ['vue', 'typescript'], notes: null },
      { name: 'Bob', tags: [], active: true },
    ])

    expect(result.headers).toEqual(['name', 'tags', 'notes', 'active'])
    expect(result.rows).toEqual([
      ['Alice', '["vue","typescript"]', null, null],
      ['Bob', '[]', null, true],
    ])
  })

  it('exports only the selected columns in source header order', () => {
    const result = convertJsonToExcelData(
      [{ name: 'Alice', age: 29, active: true }],
      { selectedColumns: ['active', 'name'] },
    )
    expect(result.headers).toEqual(['name', 'active'])
    expect(result.rows).toEqual([['Alice', true]])
  })

  it('rejects non-array input', () => {
    expect(() => convertJsonToExcelData({ name: 'Alice' })).toThrow('Expected a JSON array of objects')
  })

  it('rejects an empty array', () => {
    expect(() => convertJsonToExcelData([])).toThrow('selected JSON array is empty')
  })

  it('rejects arrays containing non-object entries', () => {
    expect(() => convertJsonToExcelData([{ name: 'Alice' }, null])).toThrow('Every item')
  })

  it('rejects empty objects with no exportable columns', () => {
    expect(() => convertJsonToExcelData([{}, {}])).toThrow('No columns found')
  })

  it('does not interpret formula-like strings as numbers or booleans', () => {
    const result = convertJsonToExcelData([{ formula: '=SUM(A1:A2)', numericString: '123' }])
    expect(result.rows).toEqual([['=SUM(A1:A2)', '123']])
  })
})

describe('createXlsxWorkbook', () => {
  it('creates a ZIP-based XLSX with workbook and worksheet XML parts', () => {
    const workbook = createXlsxWorkbook(['name', 'age', 'active'], [['Alice', 29, true]])
    expect(Array.from(workbook.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])

    const packageBytes = new TextDecoder().decode(workbook)
    expect(packageBytes).toContain('[Content_Types].xml')
    expect(packageBytes).toContain('xl/workbook.xml')
    expect(packageBytes).toContain('xl/worksheets/sheet1.xml')
    expect(packageBytes).toContain('inlineStr')
    expect(packageBytes).toContain('<v>29</v>')
    expect(packageBytes).toContain('<v>1</v>')
  })

  it('escapes XML characters and encodes formula-like strings as text', () => {
    const workbook = createXlsxWorkbook(['label'], [['<Alice & Bob>'], ['=1+1']])
    const packageBytes = new TextDecoder().decode(workbook)
    expect(packageBytes).toContain('&lt;Alice &amp; Bob&gt;')
    expect(packageBytes).toContain('t="inlineStr"')
    expect(packageBytes).toContain('=1+1')
  })

  it('rejects workbook data without headers', () => {
    expect(() => createXlsxWorkbook([], [])).toThrow('without columns')
  })
})
