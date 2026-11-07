import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { clearToken, fetchEventToken, getToken, setToken, useLoginRequired } from './auth'
import { apiGet } from './client'
import { LoginPage } from '../components/LoginPage'

function Gate() {
  return useLoginRequired() ? <LoginPage /> : <p>app</p>
}

afterEach(() => {
  clearToken()
  localStorage.clear()
})

describe('auth', () => {
  it('shows the Connexion page after a 401, then hides it once a token is given', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"error":"unauthorized"}', { status: 401, headers: { 'content-type': 'application/json' } }))
    render(<Gate />)
    expect(screen.getByText('app')).toBeInTheDocument()
    await act(async () => {
      await apiGet('/gateway/status').catch(() => null)
    })
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Jeton'), 's3cret')
    await userEvent.click(screen.getByLabelText('Se souvenir sur cet appareil'))
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(screen.getByText('app')).toBeInTheDocument()
    expect(getToken()).toBe('s3cret')
    expect(localStorage.getItem('aidp-studio.token')).toBe('s3cret')
  })

  it('does not persist the token without the checkbox', () => {
    setToken('abc', false)
    expect(localStorage.getItem('aidp-studio.token')).toBeNull()
  })

  it('sends the token as a Bearer header, never in the URL', async () => {
    setToken('abc', false)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { headers: { 'content-type': 'application/json' } }))
    await apiGet('/gateway/status')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/gateway/status')
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer abc' })
  })

  it('asks the single-use SSE token with the header', async () => {
    setToken('abc', false)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"token":"once"}', { headers: { 'content-type': 'application/json' } }))
    await expect(fetchEventToken()).resolves.toBe('once')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/events/token')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer abc' } })
  })
})
