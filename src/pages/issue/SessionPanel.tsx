import { useState } from 'react'
import { apiPost, routes, useApiAction } from '../../api/actions'
import { useSession } from '../../api/f1queries'
import type { AskQuestion } from '../../api/types'
import { FeedbackLine } from '../../components/ActionControls'
import { useSessionStream } from './stream'

const KIND_STYLE = {
  text: 'text-slate-200',
  tool: 'text-sky-400',
  question: 'text-amber-300',
  result: 'text-emerald-300',
  done: 'text-slate-500',
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
      className="space-y-2 rounded border border-amber-800 bg-amber-950/30 p-2"
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
            <label key={option.label} className="mr-3 inline-flex items-center gap-1 text-xs text-slate-300">
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
            className="block w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
            value={answers[question.question] ?? ''}
            onChange={(event) => set(question.question, event.target.value)}
          />
        </fieldset>
      ))}
      <button
        type="submit"
        disabled={!ready || reply.feedback.pending}
        className="rounded border border-sky-700 bg-sky-900/40 px-2 py-0.5 text-xs text-sky-200 disabled:opacity-50"
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
  if (sessionId === null) return <p className="text-sm text-slate-500">Aucune session en cours.</p>
  const question = info.data?.pendingQuestion
  return (
    <div className="space-y-2">
      {question ? <QuestionForm sessionId={sessionId} questions={question.questions} /> : null}
      {info.isError ? (
        <p className="text-xs text-slate-500">Session indisponible (run natif ou route absente).</p>
      ) : null}
      {stream.status === 'unavailable' ? <p className="text-xs text-slate-500">Flux indisponible.</p> : null}
      <ol
        className="max-h-72 overflow-auto rounded bg-slate-900 p-2 font-mono text-xs"
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
