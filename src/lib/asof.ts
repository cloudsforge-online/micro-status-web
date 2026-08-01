/**
 * Observation time. Every figure on this page carries one.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **"OPERATIONAL" WITH NO TIMESTAMP IS A CLAIM ABOUT NOW THAT IS REALLY A CLAIM ABOUT THE LAST
 * SYNC.** The two are the same thing for about a minute, and during exactly the event this page
 * exists for they are not. So the state and the moment it was observed are rendered together, as
 * one unit, and there is no component in this repository that renders a state without one.
 *
 * There is a second, sharper failure this file exists to prevent. Beacon stamps `generatedAt` at
 * the top of the handler (`beacon/src/server.ts:462`), so a document that arrives is by definition
 * fresh — unless something between here and there is serving a cached copy, in which case the page
 * shows a confident green chip describing a world that ended twenty minutes ago. `staleness()`
 * makes that visible instead: past a threshold the page stops presenting the document as current
 * and says how old it is.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Past this, a document is described as stale rather than as current.
 *
 * Beacon's own scrape cadence is 30s (`beacon/src/server.ts:760`), and the projection is built per
 * request, so anything older than a few minutes did not come from Beacon just now. Five minutes is
 * ten cadences: comfortably past noise, comfortably short of a reader forming a view from it.
 */
export const STALE_AFTER_MS = 5 * 60 * 1000

/** Past this, the document is too old to present as an answer at all. */
export const ANCIENT_AFTER_MS = 60 * 60 * 1000

export type Freshness = 'fresh' | 'stale' | 'ancient' | 'unknown'

/**
 * How old an observation is, and what to call that.
 *
 * A timestamp in the FUTURE is `unknown`, not `fresh`. Clock skew between Beacon's host and the
 * reader's laptop is real and one-sided rendering of it — "observed in 4 minutes" — destroys
 * confidence in every other number on the page. Past a minute of skew we say we cannot tell.
 */
export function staleness(observedAt: string | null, now: Date = new Date()): Freshness {
  if (observedAt === null) return 'unknown'
  const at = Date.parse(observedAt)
  if (Number.isNaN(at)) return 'unknown'
  const age = now.getTime() - at
  if (age < -60_000) return 'unknown'
  if (age > ANCIENT_AFTER_MS) return 'ancient'
  if (age > STALE_AFTER_MS) return 'stale'
  return 'fresh'
}

/**
 * The absolute stamp, in UTC, always.
 *
 * Fixed locale and an explicit time zone, for the same reason the estate's other frontends do it
 * (`web-template/src/lib/series.ts:828`): the same document must produce the same string on a
 * reader's phone, in a screenshot pasted into a ticket, and in CI. A status page read in the local
 * zone makes two people on a call disagree about when something happened, which is the one thing a
 * timestamp exists to settle.
 */
export function absoluteStamp(iso: string | null): string | null {
  if (iso === null) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  return `${at.toLocaleString('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })} UTC`
}

/**
 * "4 minutes ago", in whole units.
 *
 * Whole units only, and never a decimal: "1.7 hours ago" implies a precision this number does not
 * have. Under a minute reads "just now" rather than "0 minutes ago", which is the same fact
 * spelled like a measurement.
 */
export function relativeAge(iso: string | null, now: Date = new Date()): string | null {
  if (iso === null) return null
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return null
  const seconds = Math.floor((now.getTime() - at) / 1000)
  if (seconds < -60) return null
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/**
 * The full sentence a figure carries: the absolute moment, and how long ago that was.
 *
 * Both, not one. The absolute stamp is what somebody quotes in a ticket; the relative one is what
 * tells them at a glance whether to trust the page. Returning null means there is no observation
 * time, and a caller with null must say so in words rather than print nothing — see
 * `Observed` in components/observed.tsx.
 */
export function observedSentence(iso: string | null, now: Date = new Date()): string | null {
  const absolute = absoluteStamp(iso)
  if (absolute === null) return null
  const relative = relativeAge(iso, now)
  return relative === null ? absolute : `${absolute} (${relative})`
}

/**
 * A day label for the uptime strip: `03 Jun`.
 *
 * Parsed as UTC explicitly. `new Date('2026-06-03')` is UTC midnight but
 * `new Date('2026-06-03T00:00:00')` is local, and a reader west of Greenwich would see every bar
 * labelled with the previous day.
 */
export function dayLabel(day: string): string | null {
  const at = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(at.getTime())) return null
  return at.toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' })
}
