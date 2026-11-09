import { useState } from 'react'
import { apiPost, routes, useApiAction } from '../../api/actions'
import { useSession } from '../../api/f1queries'
import type { AskQuestion } from '../../api/types'
import { FeedbackLine } from '../../components/ActionControls'
import { BUTTON_SOFT } from '../../components/ui/classes'
import { useSessionStream } from './stream'

const KIND_STYLE = {
  text: 'text-ink',
  tool: 'text-accent',
  question: 'text-amber-300',
  result: 'text-emerald-300',
  done: 'text-ink-faint',
} as const

export function QuestionForm({
  sessionId,
  questions,
}: {
  sessionId: string
  questions: readonly AskQuestion[]
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const reply = useApiAction((body: unknown) => apiPost(routes.sessionReply(sessionId), body))
  const ready = questions.every((question) => (answers[question.question] ?? '').trim() !== '')
  const set = (question: string, value: string) => setAnswers((current) => ({ ...current, [question]: value }))
  return (
    <form
      className="space-y-2 rounded-card border border-amber-900/60 bg-amber-950/30 p-3"
      onSubmit={(event) => {
        event.preventDefault()
        reply.run({
          answers: Object.fromEntries(
            questions.map((question) => [question.question, { answer: answers[question.question] ?? '' }]),
          ),
        })
      }}
    >
      {questions.map((question) => (
        <fieldset key={question.question} className="space-y-1">
          <legend className="text-sm text-amber-200">{question.question}</legend>
          {question.options?.map((option) => (
            <label key={option.label} className="mr-3 inline-flex items-center gap-1 text-xs text-ink-soft">
              <input
                type="radio"
                name={question.question}
                checked={answers[question.question] === option.label}
                onChange={() => set(question.question, option.label)}
              />
              {option.label}
            </label>
          ))}
          <input
            aria-label={`Réponse : ${question.question}`}
            className="block w-full rounded border border-line-strong bg-card px-2 py-1 text-sm text-ink"
            value={answers[question.question] ?? ''}
            onChange={(event) => set(question.question, event.target.value)}
          />
        </fieldset>
      ))}
      <button
        type="submit"
        disabled={!ready || reply.feedback.pending}
        className={BUTTON_SOFT}
      >
        Répondre
      </button>
      <FeedbackLine feedback={reply.feedback} />
    </form>
  )
}

/** Live view of the current session: bounded ring of lines, pending question with its answer form. */
export function SessionPanel({ sessionId }: { sessionId: string | null }) {
  const info = useSession(sessionId)
  const stream = useSessionStream(sessionId, info.data !== undefined)
  if (sessionId === null) return <p className="text-sm text-ink-faint">Aucune session en cours.</p>
  const question = info.data?.pendingQuestion
  return (
    <div className="space-y-2">
      {question ? <QuestionForm sessionId={sessionId} questions={question.questions} /> : null}
      {info.isError ? (
        <p className="text-xs text-ink-faint">Session indisponible (run natif ou route absente).</p>
      ) : null}
      {stream.status === 'unavailable' ? <p className="text-xs text-ink-faint">Flux indisponible.</p> : null}
      <ol
        className="max-h-72 overflow-auto rounded-md border border-line bg-canvas p-2 font-mono text-xs"
        aria-label="Flux de la session"
        data-testid="stream"
      >
        {stream.lines.map((line) => (
          <li key={line.id} className={`whitespace-pre-wrap ${KIND_STYLE[line.kind]}`}>
            {line.kind === 'tool' ? `› ${line.text}` : line.text}
          </li>
        ))}
      </ol>
    </div>
  )
}
