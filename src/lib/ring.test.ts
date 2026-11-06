import { Ring } from './ring'

describe('Ring', () => {
  it('keeps the newest items up to its capacity', () => {
    const ring = new Ring<number>(3)
    for (let value = 1; value <= 5; value += 1) ring.push(value)
    expect(ring.size).toBe(3)
    expect(ring.toArray()).toEqual([3, 4, 5])
    ring.clear()
    expect(ring.toArray()).toEqual([])
  })

  it('refuses a non-positive capacity', () => {
    expect(() => new Ring(0)).toThrow(RangeError)
  })
})
