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
 *   | `unreachable` | no answer: DNS, TLS, CORS, a dead gateway, a timeout | our own status service never answered |
 *   | `refused` | an answer with a non-2xx code | it replied with a code instead of a document |
 *   | `unreadable` | a 200 whose body we could not read | it sent something we could not make sense of |
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

const NO_READING = 'We do not know the state of our systems.'

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
      headline: 'Asking our status service.',
      detail: 'The request is in flight. Nothing below counts as a verdict until that answer lands.',
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
    headline: NO_READING,
    detail:
      lastGood === null
        ? detail
        : `${detail} What is drawn below is the last reading we managed to take, and it describes the moment stamped on it.`,
    document: lastGood,
    showingLastGood: lastGood !== null,
    asOf: lastGood === null ? null : lastGoodAt,
  }
}

function failureDetail(outcome: Exclude<StatusOutcome, { kind: 'ok' }>): string {
  switch (outcome.kind) {
    case 'unreachable':
      // The last sentence is written tightly on purpose: the negation sits immediately before the
      // claim it negates, so a reader skimming during an incident cannot take the tail of the
      // sentence for reassurance. `test/degrade.test.ts` enforces exactly that proximity.
      return `Our own status service never answered — ${outcome.detail}. The fault is ours, or it is on the road between you and us. That is not proof the rest is healthy.`
    case 'refused':
      return `Our status service replied HTTP ${outcome.status} rather than a document${
        outcome.requestId === null ? '' : ` (request ${outcome.requestId})`
      }. Nothing you did caused that, and nothing you were doing has been lost. Quote that reply code if you raise a ticket.`
    case 'unreadable':
      return `Our status service sent back something we could not make sense of — ${outcome.detail}. Rather than guess at what it meant, we are leaving the verdict blank.`
    default: {
      const exhaustive: never = outcome
      throw new Error(`unmapped outcome: ${JSON.stringify(exhaustive)}`)
    }
  }
}

function headlineFor(answer: Verdict): string {
  if (answer.state === 'unknown') return NO_READING
  if (answer.state === 'operational') return 'Nothing we watch is failing.'
  if (answer.state === 'maintenance') return 'Scheduled work is running.'
  if (answer.state === 'degraded') return 'Something is answering, but not properly.'
  return 'Something has stopped answering.'
}

function detailFor(answer: Verdict, doc: PublicStatus): string {
  if (answer.state === 'unknown') {
    return `The answer came back in pieces${
      doc.omitted > 0 ? ` (${doc.omitted} ${doc.omitted === 1 ? 'entry' : 'entries'} refused)` : ''
    }. A partial reading can still show you a fault, but it can never show you the absence of one — so we are not calling this clear.`
  }
  if (!answer.complete) {
    return `Part of the answer did not arrive, so what follows is what we can see rather than the whole picture. The verdict above is the worst fault we managed to confirm.`
  }
  const groups = doc.groups.length
  return `Read across ${groups} product ${groups === 1 ? 'group' : 'groups'}. Every figure below is stamped with the moment we took it.`
}
