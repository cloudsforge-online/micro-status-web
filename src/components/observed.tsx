/**
 * The observation stamp. Nothing on this page states a figure without one.
 *
 * It is a component rather than a formatting call at each site so that the ABSENT case has to be
 * handled: passing `null` renders "observation time unknown" in the same slot, in the same place,
 * at the same size. A page where a missing timestamp renders as empty space is a page where the
 * reader sees a state and assumes it is current — which is the failure `asof.ts` exists to
 * prevent, and it cannot be prevented by a function that returns a string.
 */
import { observedSentence, staleness, type Freshness } from '../lib/asof.ts'

export interface ObservedProps {
  /** ISO instant the figure beside this was observed, or null when there is none. */
  at: string | null
  /** Overrides the leading word. Defaults to "Observed". */
  verb?: string
  /** Fixed clock, for tests. Defaults to now. */
  now?: Date
}

const NOTE: Readonly<Record<Freshness, string | null>> = {
  fresh: null,
  stale: 'Older than our polling should ever leave it. A cache between you and us may be holding on to an old copy.',
  ancient: 'Far too old to describe now. Read it as a record of that moment, not as the state of anything today.',
  unknown: null,
}

export function Observed({ at, verb = 'Observed', now }: ObservedProps) {
  const clock = now ?? new Date()
  const sentence = observedSentence(at, clock)
  const freshness = staleness(at, clock)
  const note = NOTE[freshness]

  if (sentence === null) {
    return (
      <p className="st-observed st-observed--none">
        <span className="st-observed__glyph" aria-hidden="true">
          ?
        </span>{' '}
        No observation time — we cannot say when this reading was taken.
      </p>
    )
  }

  return (
    <p className={`st-observed st-observed--${freshness}`}>
      {/* A machine-readable copy of the same instant, so a screen reader and a scraper both get
          the unambiguous form rather than the prose one. */}
      <span className="st-observed__glyph" aria-hidden="true">
        {freshness === 'fresh' ? '·' : '!'}
      </span>{' '}
      {verb}{' '}
      <time dateTime={at ?? undefined}>{sentence}</time>
      {note !== null && <span className="st-observed__note"> {note}</span>}
    </p>
  )
}
