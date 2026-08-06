/**
 * How a state is SAID. Three channels, never one.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **COLOUR IS THE LEAST RELIABLE CHANNEL ON THIS PAGE, SO IT IS NEVER THE ONLY ONE.**
 *
 * The design system reserves three status hues and says why there are only three:
 * `ui/packages/ui/src/tokens.css` records that a fourth step between warn and critical
 * "cannot clear the normal-vision floor against warn on this surface (#e8834f to #f4a63c is
 * ΔE 9.4)". Running the reserved three as a categorical set against the panel surface fails
 * harder still: good against warn is **ΔE 4.6 under protanopia**. A reader with the commonest form
 * of colour blindness cannot distinguish "operational" from "degraded" by fill.
 *
 * That is not a palette to fix — it is the correct palette, used with the encoding it requires.
 * Every state in this file therefore carries:
 *
 *   1. a GLYPH, which is a shape and survives greyscale, forced-colours mode and print;
 *   2. a WORD, which survives everything;
 *   3. a colour, which is the fastest channel for the readers who have it.
 *
 * Nothing in this repository renders `state` without going through here, and
 * `test/states.test.ts` asserts that every member of `CellState` has all three and that no two
 * states share a glyph or a label.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import type { CellState, PublicIncidentState, Severity } from './publicstatus.ts'

export interface StateVoice {
  /** The shape channel. One character, distinct across the set. */
  readonly glyph: string
  /** The word channel. Sentence case, because it is read as prose beside a time. */
  readonly label: string
  /** The sentence under a hero chip. Written to be true of the whole estate or of one group. */
  readonly sentence: string
  /** The modifier class, which is where the colour lives. Never an inline hex. */
  readonly tone: 'good' | 'warn' | 'crit' | 'plan' | 'void'
}

const VOICES: Readonly<Record<CellState, StateVoice>> = {
  operational: {
    glyph: '●',
    label: 'Operational',
    sentence: 'Every check we ran came back clean.',
    tone: 'good',
  },
  degraded: {
    glyph: '▲',
    label: 'Degraded',
    sentence: 'Requests are getting through, but slowly or only some of the time.',
    tone: 'warn',
  },
  outage: {
    glyph: '■',
    label: 'Outage',
    sentence: 'Requests are not getting through at all.',
    tone: 'crit',
  },
  maintenance: {
    glyph: '◆',
    label: 'Maintenance',
    sentence: 'Work we scheduled is running, so interruptions here are expected.',
    tone: 'plan',
  },
  unknown: {
    glyph: '?',
    // The words matter as much as anything else on this page. Not "Unknown", which reads as a
    // state of the estate — this is a state of OUR KNOWLEDGE, and the sentence says whose fault
    // that is. It never implies health and it never implies failure.
    label: 'Not determined',
    sentence:
      'We asked and got no answer back. That is a gap on our side, and not a claim either way about your service.',
    tone: 'void',
  },
}

export function voiceOf(state: CellState): StateVoice {
  return VOICES[state]
}

/** Every state, in the order a legend reads them: best to worst, then the gap. */
export const STATE_ORDER: readonly CellState[] = [
  'operational',
  'maintenance',
  'degraded',
  'outage',
  'unknown',
]

/**
 * The severity ladder, as words.
 *
 * `sev1`…`sev4` is the estate's internal spelling (`beacon/src/incidents.ts`) and Beacon
 * publishes it verbatim (`beacon/src/publicstatus.ts`). It is shown here as "SEV1" rather
 * than translated into an invented vocabulary of our own: a reader who has seen the term in a
 * post-incident review should meet the same term here, and inventing "Critical / Major / Minor"
 * would be this page making up a mapping nobody wrote down.
 *
 * The gloss beside it is descriptive, not a redefinition, and it is the only added word.
 */
const SEVERITY_GLOSS: Readonly<Record<Severity, string>> = {
  sev1: 'the worst grade we hand out',
  sev2: 'a major incident',
  sev3: 'a limited or partial incident',
  sev4: 'a small incident',
}

export function severityLabel(severity: Severity | null): string {
  return severity === null ? 'Severity not stated' : severity.toUpperCase()
}

export function severityGloss(severity: Severity | null): string | null {
  return severity === null ? null : SEVERITY_GLOSS[severity]
}

/**
 * Incident lifecycle, as words — `beacon/src/publicstatus.ts`.
 *
 * `null` is "not stated" rather than any of the four. An incident whose lifecycle word this page
 * does not recognise is an incident we can still show honestly; guessing "investigating" would be
 * a claim about what somebody is currently doing.
 */
const INCIDENT_VOICE: Readonly<Record<PublicIncidentState, { glyph: string; label: string }>> = {
  investigating: { glyph: '◌', label: 'Investigating' },
  identified: { glyph: '◍', label: 'Identified' },
  monitoring: { glyph: '◐', label: 'Monitoring' },
  resolved: { glyph: '◉', label: 'Resolved' },
}

export function incidentVoice(state: PublicIncidentState | null): {
  glyph: string
  label: string
} {
  return state === null ? { glyph: '·', label: 'Not stated' } : INCIDENT_VOICE[state]
}
