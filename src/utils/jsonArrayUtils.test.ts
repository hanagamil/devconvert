import { describe, expect, it } from 'vitest'
import { findObjectArrays, getValueAtPath } from './jsonArrayUtils'

describe('JSON array discovery helpers', () => {
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

  it('can read an object array nested inside an array', () => {
    const input = { data: [{ users: [{ id: 1 }, { id: 2 }] }] }
    const candidates = findObjectArrays(input)
    const candidate = candidates.find((item) => item.path === 'data[0].users')

    expect(candidate).toBeDefined()
    expect(getValueAtPath(input, 'data[0].users')).toEqual([{ id: 1 }, { id: 2 }])
  })
})
