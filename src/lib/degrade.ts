/**
 * What the page says when it cannot say what it is for.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **A STATUS PAGE THAT RENDERS GREEN ON MISSING DATA IS WORSE THAN NO STATUS PAGE.** It converts
 * an outage into an accusation that the customer's connection is at fault, and it does it at the
 * exact moment trust is most expensive to rebuild. So the failure copy is a pure function, tested
 * in both directions, rather than JSX scattered through a component where the green branch is the
 * one that is easy to reach by accident.
 *
 * Four things can happen and the reader is told which:
 *
 *   | outcome | what actually happened | what we say |
 *   | --- | --- | --- |
 *   | `unreachable` | no answer: DNS, TLS, CORS, a dead gateway, a timeout | we cannot reach our own status service |
 *   | `refused` | an answer with a non-2xx code | our status service refused to answer |
 *   | `unreadable` | a 200 whose body we could not read | we got an answer we could not read |
 *   | `ok` | a document | the document — with its observation time |
 *
 * They are not collapsed into "something went wrong" because they are not the same thing: the
 * first two are ours to fix and the third means something in between is lying, and a reader who
 * is deciding whether to open a support ticket is entitled to the difference.
 *
 * **NOTE WHAT IS ABSENT.** No branch here produces `operational`. The only route to that word on
 * this page runs through `verdict()` in publicstatus.ts with a complete document, which is the
 * property that makes green-on-unknown structurally unreachable rather than merely unlikely.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import type { StatusOutcome } from './beacon.ts'
import { verdict, type CellState, type PublicStatus, type Verdict } from './publicstatus.ts'

export interface PageState {
  /** The hero chip's state. Never `operational` unless a complete document said so. */
  readonly state: CellState
  /** The headline beside the chip. */
  readonly headline: string
  /** The paragraph under it. Always says what we do and do not know. */
  readonly detail: string
  /** The document to render below, or null when there is nothing trustworthy to draw. */
  readonly document: PublicStatus | null
  /**
   * True when `document` is older than the current attempt — a last-good copy kept across a
   * failed refresh. The page must label it, and `Observed` makes the age unavoidable.
   */
  readonly showingLastGood: boolean
  /** The observation time of whatever is being shown. */
  readonly asOf: string | null
}

const CANNOT_DETERMINE = 'We cannot currently determine status.'

/**
 * Reduce an outcome — plus any last-good document — to what the page shows.
 *
 * `lastGood` is shown when the current attempt failed, and it is shown as HISTORY: the verdict
 * chip goes to `unknown` regardless of what that older document said, because a document from
 * eleven minutes ago is not evidence about now. The document is still rendered underneath so the
 * reader keeps the incident timeline and the ninety-day history, which are true whenever they
 * were observed.
 */
export function pageState(
  outcome: StatusOutcome | null,
  lastGood: PublicStatus | null,
  lastGoodAt: string | null,
): PageState {
  if (outcome === null) {
    return {
      state: 'unknown',
      headline: 'Checking…',
      detail: 'Asking our status service. Nothing on this page is a verdict until it answers.',
      document: null,
      showingLastGood: false,
      asOf: null,
    }
  }

  if (outcome.kind === 'ok') {
    const answer: Verdict = verdict(outcome.status)
    return {
      state: answer.state,
      headline: headlineFor(answer),
      detail: detailFor(answer, outcome.status),
      document: outcome.status,
      showingLastGood: false,
      asOf: answer.asOf,
    }
  }

  const detail = failureDetail(outcome)
  return {
    state: 'unknown',
    headline: CANNOT_DETERMINE,
    detail:
      lastGood === null
        ? detail
        : `${detail} The history below is the last answer we received; it describes when it was observed, not now.`,
    document: lastGood,
    showingLastGood: lastGood !== null,
    asOf: lastGood === null ? null : lastGoodAt,
  }
}

function failureDetail(outcome: Exclude<StatusOutcome, { kind: 'ok' }>): string {
  switch (outcome.kind) {
    case 'unreachable':
      return `We could not reach our own status service — ${outcome.detail}. That is a fault on our side, or between you and us. It is not a statement that anything else is healthy.`
    case 'refused':
      return `Our status service answered with HTTP ${outcome.status} instead of a status document${
        outcome.requestId === null ? '' : ` (request ${outcome.requestId})`
      }. We are not able to tell you the state of the estate.`
    case 'unreadable':
      return `We received an answer we could not read — ${outcome.detail}. Rather than guess at it, we are telling you that we do not know.`
    default: {
      const exhaustive: never = outcome
      throw new Error(`unmapped outcome: ${JSON.stringify(exhaustive)}`)
    }
  }
}

function headlineFor(answer: Verdict): string {
  if (answer.state === 'unknown') return CANNOT_DETERMINE
  if (answer.state === 'operational') return 'All systems operational'
  if (answer.state === 'maintenance') return 'Planned maintenance in progress'
  if (answer.state === 'degraded') return 'Some systems degraded'
  return 'Active outage'
}

function detailFor(answer: Verdict, doc: PublicStatus): string {
  if (answer.state === 'unknown') {
    return `Our status service answered, but part of the answer was missing or unreadable${
      doc.omitted > 0 ? ` (${doc.omitted} ${doc.omitted === 1 ? 'entry' : 'entries'} refused)` : ''
    }. An incomplete answer can report a problem; it cannot report that there is none, so we do not.`
  }
  if (!answer.complete) {
    return `Part of the answer was missing or unreadable, so this describes what we can see and not necessarily everything. The state above is the worst thing we could establish.`
  }
  const groups = doc.groups.length
  return `Measured across ${groups} product ${groups === 1 ? 'group' : 'groups'}. Each figure below carries the time it was observed.`
}
