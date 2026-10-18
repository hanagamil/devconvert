import { describe, expect, it } from 'vitest'
import { convertJsonToCsv, findObjectArrays, getValueAtPath } from './jsonToCsv'

describe('convertJsonToCsv', () => {
  it('converts an array of simple objects', () => {
    const result = convertJsonToCsv([
      { name: 'Alice', role: 'Developer' },
      { name: 'Bob', role: 'Designer' },
    ])

    expect(result.headers).toEqual(['name', 'role'])
    expect(result.csv).toBe('name,role\r\nAlice,Developer\r\nBob,Designer')
  })

  it('flattens nested objects by default', () => {
    const result = convertJsonToCsv([
      { user: { name: 'Alice', city: 'Cairo' } },
    ])

    expect(result.headers).toEqual(['user.name', 'user.city'])
    expect(result.rows).toEqual([['Alice', 'Cairo']])
  })

  it('preserves first-seen header order and fills missing fields', () => {
    const result = convertJsonToCsv([
      { first: 1, shared: true },
      { second: 2, shared: false },
    ])

    expect(result.headers).toEqual(['first', 'shared', 'second'])
    expect(result.rows).toEqual([
      ['1', 'true', ''],
      ['', 'false', '2'],
    ])
  })

  it('escapes commas, double quotes, and line breaks', () => {
    const result = convertJsonToCsv([
      { text: 'hello, world', quote: 'say "hi"', multiline: 'line 1\nline 2' },
    ])

    expect(result.csv).toBe(
      'text,quote,multiline\r\n"hello, world","say ""hi""","line 1\nline 2"',
    )
  })

  it('supports semicolon and tab delimiters', () => {
    expect(convertJsonToCsv([{ a: 1, b: 2 }], { delimiter: ';' }).csv)
      .toBe('a;b\r\n1;2')
    expect(convertJsonToCsv([{ a: 1, b: 2 }], { delimiter: '\t' }).csv)
      .toBe('a\tb\r\n1\t2')
  })

  it('exports only selected columns', () => {
    const result = convertJsonToCsv(
      [
        { name: 'Alice', role: 'Developer', active: true },
        { name: 'Bob', role: 'Designer', active: false },
      ],
      { selectedColumns: ['name', 'active'] },
    )

    expect(result.headers).toEqual(['name', 'active'])
    expect(result.rows).toEqual([['Alice', 'true'], ['Bob', 'false']])
    expect(result.csv).toBe('name,active\r\nAlice,true\r\nBob,false')
  })

  it('keeps arrays as JSON in a single cell', () => {
    const result = convertJsonToCsv([{ tags: ['vue', 'typescript'] }])

    expect(result.rows).toEqual([['["vue","typescript"]']])
    expect(result.csv).toBe('tags\r\n"[""vue"",""typescript""]"')
  })

  it('mitigates common spreadsheet formula prefixes in string values', () => {
    const result = convertJsonToCsv([
      { dangerous: '=SUM(A1:A2)', safeNumber: -42 },
    ])

    expect(result.rows).toEqual([["'=SUM(A1:A2)", '-42']])
  })

  it('can disable spreadsheet formula protection', () => {
    const result = convertJsonToCsv(
      [{ value: '=1+1' }],
      { protectSpreadsheetFormulas: false },
    )

    expect(result.rows).toEqual([['=1+1']])
  })

  it('can preserve nested objects as JSON when flattening is disabled', () => {
    const result = convertJsonToCsv(
      [{ user: { name: 'Alice' } }],
      { flattenNestedObjects: false },
    )

    expect(result.headers).toEqual(['user'])
    expect(result.rows).toEqual([['{"name":"Alice"}']])
  })

  it('exports empty nested arrays as JSON in a single cell', () => {
    const result = convertJsonToCsv([{ tags: [], metadata: {} }])

    expect(result.headers).toEqual(['tags', 'metadata'])
    expect(result.rows).toEqual([['[]', '{}']])
    expect(result.csv).toBe('tags,metadata\r\n[],{}')
  })

  it('combines selected columns with semicolon and tab delimiters', () => {
    const input = [{ name: 'Alice', role: 'Developer', active: true }]

    expect(
      convertJsonToCsv(input, {
        delimiter: ';',
        selectedColumns: ['name', 'active'],
      }).csv,
    ).toBe('name;active\r\nAlice;true')

    expect(
      convertJsonToCsv(input, {
        delimiter: '\t',
        selectedColumns: ['role', 'active'],
      }).csv,
    ).toBe('role\tactive\r\nDeveloper\ttrue')
  })

  it('protects formula-like strings even when they start with whitespace', () => {
    const result = convertJsonToCsv([
      { value: '  =1+1' },
      { value: '\t@SUM(A1:A2)' },
      { value: '+1+1' },
      { value: '-1+1' },
    ])

    expect(result.rows).toEqual([
      ["'  =1+1"],
      ["'\t@SUM(A1:A2)"],
      ["'+1+1"],
      ["'-1+1"],
    ])
  })

  it('rejects arrays of empty objects because there are no columns to export', () => {
    expect(() => convertJsonToCsv([{}, {}]))
      .toThrow('No columns found to export')
  })

  it('rejects non-array input', () => {
    expect(() => convertJsonToCsv({ name: 'Alice' }))
      .toThrow('Expected a JSON array of objects')
  })

  it('rejects an empty array', () => {
    expect(() => convertJsonToCsv([]))
      .toThrow('The JSON array is empty')
  })

  it('rejects arrays containing non-object entries', () => {
    expect(() => convertJsonToCsv([{ name: 'Alice' }, null]))
      .toThrow('Every item in the top-level JSON array must be an object')
  })

  it('discovers arrays of objects inside API response objects', () => {
    const input = {
      data: {
        users: [
          { name: 'Alice' },
          { name: 'Bob' },
        ],
      },
      meta: { total: 2 },
    }

    const candidates = findObjectArrays(input)
    expect(candidates.map((candidate) => candidate.path)).toContain('data.users')
    expect(getValueAtPath(input, 'data.users')).toEqual(input.data.users)
  })

  it('finds a top-level array using the root path', () => {
    const input = [{ id: 1 }, { id: 2 }]
    const candidates = findObjectArrays(input)

    expect(candidates[0].path).toBe('$')
    expect(getValueAtPath(input, '$')).toEqual(input)
  })

  it('does not treat arrays of primitives as convertible object arrays', () => {
    const candidates = findObjectArrays({ tags: ['vue', 'typescript'] })
    expect(candidates).toEqual([])
  })

})
