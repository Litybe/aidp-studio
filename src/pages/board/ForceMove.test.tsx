import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Ticket } from '../../api/types'
import { mockApi } from '../../test/harness'
import { ForceMove } from './ForceMove'

const toTest: Ticket = {
  key: 'GH-4',
  summary: 'Saut mural',
  status: 'in-progress',
  labels: ['aidp:to-test'],
  githubNumber: 4,
}

function renderForce(ticket: Ticket) {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <ForceMove ticket={ticket} />
    </QueryClientProvider>,
  )
}

describe('ForceMove', () => {
  it('forces a ticket to À merger after a confirmation', async () => {
    const calls = mockApi({ 'POST /tickets/GH-4/force': { body: { key: 'GH-4', target: 'merge' } } })
    renderForce(toTest)
    const select = screen.getByLabelText('Forcer #4 vers')
    expect(screen.queryByRole('option', { name: 'À tester' })).not.toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'merge' } })
    fireEvent.click(screen.getByRole('button', { name: 'Forcer' }))
    expect(calls).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Oui, confirmer' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/tickets/GH-4/force',
      body: { target: 'merge', reason: 'forcée depuis le front' },
    })
  })

  it('shows the refusal of the daemon', async () => {
    mockApi({
      'POST /tickets/GH-4/force': { status: 409, body: { error: 'aucun flow ne déclare merge', code: 'conflict' } },
    })
    renderForce(toTest)
    fireEvent.change(screen.getByLabelText('Forcer #4 vers'), { target: { value: 'merge' } })
    fireEvent.click(screen.getByRole('button', { name: 'Forcer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Oui, confirmer' }))
    expect(await screen.findByText('aucun flow ne déclare merge')).toBeInTheDocument()
  })
})
