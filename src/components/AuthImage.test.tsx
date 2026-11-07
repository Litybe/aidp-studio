import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearToken, setToken } from '../api/auth'
import { AuthImage } from './AuthImage'

describe('AuthImage', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', class {
      constructor(private cb: (e: Array<{ isIntersecting: boolean }>) => void) {}
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    })
  })
  afterEach(() => {
    clearToken()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses src directly without a token', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const { container } = render(<AuthImage src="/api/runs/r/files/a.png" alt="a" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/api/runs/r/files/a.png')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches with the header, then revokes the blob URL on unmount', async () => {
    setToken('secret', false)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x', { status: 200 }))
    const create = vi.fn(() => 'blob:one')
    const revoke = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
    const { container, unmount } = render(<AuthImage src="/api/runs/r/files/a.png" alt="a" />)
    await vi.waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:one'))
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer secret')
    expect(revoke).not.toHaveBeenCalled()
    unmount()
    expect(revoke).toHaveBeenCalledWith('blob:one')
  })
})
