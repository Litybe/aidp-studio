import { ApiError, apiGet, isUnreachable } from './client'

function respond(status: number, body: string, contentType: string) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body, { status, headers: { 'content-type': contentType } }),
  )
}

describe('apiGet', () => {
  it('reads JSON from the relative /api base', async () => {
    const fetchMock = respond(200, '{"uptimeSec":3}', 'application/json')
    await expect(apiGet<{ uptimeSec: number }>('/gateway/status')).resolves.toEqual({ uptimeSec: 3 })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/gateway/status')
  })

  it('maps a network failure to unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await apiGet('/health').catch((caught: unknown) => caught)
    expect(isUnreachable(error)).toBe(true)
  })

  it('maps the empty 500 of the dev proxy to unreachable', async () => {
    respond(500, '', 'text/plain')
    const error = await apiGet('/health').catch((caught: unknown) => caught)
    expect(isUnreachable(error)).toBe(true)
  })

  it('keeps the message and code of a daemon error', async () => {
    respond(404, '{"error":"not found","code":"not_found"}', 'application/json')
    const error = await apiGet('/nope').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: 'http', status: 404, message: 'not found', code: 'not_found' })
  })
})
