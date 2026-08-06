/**
 * The public projection, as this page is allowed to see it.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THE ALLOWLIST IS ON THE READING SIDE TOO, AND THAT IS NOT REDUNDANT.**
 *
 * Beacon already redacts by construction: `beacon/src/publicstatus.ts` copies only allowlisted
 * keys through `seal()`, and its `Exact<>` check makes a divergence between the interface and the
 * tuple a compile error. That is a good guarantee and this file does not replace it. It duplicates it,
 * one process later, for three reasons that a server-side allowlist cannot cover:
 *
 *   1. **Versions skew.** This bundle is cached in browsers and served from a CDN; Beacon is
 *      redeployed on its own schedule. There will be minutes — during a rollback, hours — when a
 *      new Beacon is answering an old page. A field added upstream in that window reaches THIS
 *      code, and the only thing that can refuse to render it is this code.
 *   2. **Beacon is not the only thing that can answer.** A gateway, a cache, a misrouted deploy
 *      or a compromised upstream can all put a document on this wire. `parseStatus` below treats
 *      the response as hostile input rather than as a typed value it was promised.
 *   3. **`as` is not a check.** `(await res.json()) as PublicStatus` is the single most common way
 *      a frontend acquires a lie. Nothing here casts; every field is read, checked and copied by
 *      name.
 *
 * So: **no spread, no `Object.assign`, no `...rest`, and no `as` on a parsed value anywhere in
 * this file.** `test/publicstatus.test.ts` adds unexpected fields to every level of a well-formed
 * document and asserts that the exact key set on the way out is unchanged, and that no injected
 * value appears anywhere in `renderableStrings()`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * **WHAT THIS PAGE IS ALLOWED TO KNOW**, field by field, each verified by reading the projection:
 *
 * The right-hand column is the allowlist in `beacon/src/publicstatus.ts` that permits the field.
 * It names the CONSTANT and not a line: a line names a position in a file micro-beacon owns and is
 * free to edit, and nothing runs this suite when it does. A constant moves with the code.
 *
 * | field | beacon/src/publicstatus.ts |
 * | --- | --- |
 * | `generatedAt`, `state`, `groups`, `incidents`, `maintenance` | `PUBLIC_STATUS_FIELDS` |
 * | `group`, `state`, `uptime` | `PUBLIC_GROUP_FIELDS` |
 * | `date`, `state` | `PUBLIC_DAY_FIELDS` |
 * | `reference`, `group`, `severity`, `state`, `openedAt`, `closedAt`, `updates` | `PUBLIC_INCIDENT_FIELDS` |
 * | `at`, `body` | `PUBLIC_UPDATE_FIELDS` |
 * | `group`, `summary`, `startsAt`, `endsAt` | `PUBLIC_MAINTENANCE_FIELDS` |
 *
 * Nothing else exists to be rendered. In particular `subject`, `cause`, `lastError`, `failures`,
 * `detectedBy`, `scope` and the internal `id` are absent from the upstream projection
 * (`beacon/src/publicstatus.ts`) — which is exactly what the OLD implementation got
 * wrong: `redactStatus` in `stack/infra/beacon/server.js` published `t.name` and
 * `incidents[].subject`, both internal topology.
 */

/* ------------------------------------------------------------------ the vocabulary */

/**
 * The four states Beacon publishes — `beacon/src/publicstatus.ts`.
 *
 * Note what is NOT here: `up`, `down`, `pending`. Those are the internal probe words
 * (`beacon/src/probes.ts`), and a value from that vocabulary arriving on this wire means
 * something upstream is serving the internal record. It is refused rather than guessed at.
 */
export type PublicState = 'operational' | 'degraded' | 'outage' | 'maintenance'

/** `beacon/src/publicstatus.ts`. Never the internal `detected | declared | mitigated | …`. */
export type PublicIncidentState = 'investigating' | 'identified' | 'monitoring' | 'resolved'

/** `beacon/src/incidents.ts`. Published verbatim by `projectIncident` (`publicstatus.ts`). */
export type Severity = 'sev1' | 'sev2' | 'sev3' | 'sev4'

/**
 * What this page shows when it does not know.
 *
 * **`'unknown'` is a first-class state, and it is deliberately not in `PublicState`.** Beacon
 * cannot send it — there is no such member upstream — so it can only ever be produced HERE, by
 * this page failing to establish something. Keeping the two unions separate is what stops an
 * unknown from being compared, sorted or rendered as though it were a verdict Beacon gave.
 */
export type CellState = PublicState | 'unknown'

const PUBLIC_STATES: readonly PublicState[] = ['operational', 'degraded', 'outage', 'maintenance']
const INCIDENT_STATES: readonly PublicIncidentState[] = [
  'investigating',
  'identified',
  'monitoring',
  'resolved',
]
const SEVERITIES: readonly Severity[] = ['sev1', 'sev2', 'sev3', 'sev4']

/* ------------------------------------------------------------------ the exactness machinery */

/**
 * `Exact<A, B>` is `true` only when the two string unions are identical in both directions.
 *
 * Lifted from `beacon/src/publicstatus.ts` on purpose: the guarantee is only worth having
 * if it holds at both ends of the wire. Assigning `true` to it turns a divergence between an
 * interface and its allowlist into a compile error rather than into a field that quietly starts
 * being rendered.
 */
type Exact<A extends string, B extends string> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : never
  : never

/**
 * Copy exactly the allowlisted keys, and nothing else.
 *
 * The runtime half. TypeScript's excess-property check does not apply to spreads or to widened
 * values, so the type system alone cannot promise that an object handed to React carries only
 * what it should. This can.
 *
 * **Exported solely so it can be tested directly, and that is not a formality.** Every candidate
 * built in this file is already assembled field by field, so no current call site would notice if
 * this function were replaced by `{ ...candidate }` — a mutation that removes the guard passes the
 * entire suite. It is a backstop against a FUTURE mistake, and a backstop nothing exercises is a
 * backstop nobody will notice the loss of. `test/publicstatus.test.ts` hands it a candidate with
 * extra keys, which is the only way to make its removal visible.
 */
export function seal<T extends object>(fields: readonly (keyof T & string)[], candidate: T): T {
  const out: Record<string, unknown> = {}
  for (const field of fields) out[field] = candidate[field]
  return out as T
}

/* ------------------------------------------------------------------ the shapes */

export interface PublicUpdate {
  readonly at: string
  readonly body: string
}
export const PUBLIC_UPDATE_FIELDS = ['at', 'body'] as const satisfies readonly (keyof PublicUpdate)[]
const _updateExact: Exact<keyof PublicUpdate & string, (typeof PUBLIC_UPDATE_FIELDS)[number]> = true
void _updateExact

export interface PublicIncident {
  readonly reference: string | null
  readonly group: string
  readonly severity: Severity | null
  readonly state: PublicIncidentState | null
  readonly openedAt: string
  readonly closedAt: string | null
  readonly updates: readonly PublicUpdate[]
}
export const PUBLIC_INCIDENT_FIELDS = [
  'reference',
  'group',
  'severity',
  'state',
  'openedAt',
  'closedAt',
  'updates',
] as const satisfies readonly (keyof PublicIncident)[]
const _incidentExact: Exact<
  keyof PublicIncident & string,
  (typeof PUBLIC_INCIDENT_FIELDS)[number]
> = true
void _incidentExact

export interface PublicDay {
  readonly date: string
  readonly state: CellState
}
export const PUBLIC_DAY_FIELDS = ['date', 'state'] as const satisfies readonly (keyof PublicDay)[]
const _dayExact: Exact<keyof PublicDay & string, (typeof PUBLIC_DAY_FIELDS)[number]> = true
void _dayExact

export interface PublicGroup {
  readonly group: string
  readonly state: CellState
  readonly uptime: readonly PublicDay[]
}
export const PUBLIC_GROUP_FIELDS = [
  'group',
  'state',
  'uptime',
] as const satisfies readonly (keyof PublicGroup)[]
const _groupExact: Exact<keyof PublicGroup & string, (typeof PUBLIC_GROUP_FIELDS)[number]> = true
void _groupExact

export interface PublicMaintenance {
  readonly group: string
  readonly summary: string
  readonly startsAt: string
  readonly endsAt: string
}
export const PUBLIC_MAINTENANCE_FIELDS = [
  'group',
  'summary',
  'startsAt',
  'endsAt',
] as const satisfies readonly (keyof PublicMaintenance)[]
const _maintenanceExact: Exact<
  keyof PublicMaintenance & string,
  (typeof PUBLIC_MAINTENANCE_FIELDS)[number]
> = true
void _maintenanceExact

export interface PublicStatus {
  readonly generatedAt: string
  readonly state: CellState
  readonly groups: readonly PublicGroup[]
  readonly incidents: readonly PublicIncident[]
  readonly maintenance: readonly PublicMaintenance[]
  /**
   * How many entries were refused on the way in, and therefore are NOT in the lists above.
   *
   * This is the page's own bookkeeping, not Beacon's. It exists because dropping a malformed
   * entry silently is how a status page shows seven healthy groups when there were eight — and
   * `verdict()` reads it, so a document that lost anything can never present itself as a
   * confident "all operational".
   */
  readonly omitted: number
}
export const PUBLIC_STATUS_FIELDS = [
  'generatedAt',
  'state',
  'groups',
  'incidents',
  'maintenance',
  'omitted',
] as const satisfies readonly (keyof PublicStatus)[]
const _statusExact: Exact<keyof PublicStatus & string, (typeof PUBLIC_STATUS_FIELDS)[number]> = true
void _statusExact

/* ------------------------------------------------------------------ primitive readers */

/** A property of a plain object, or undefined. Never inherited, never from an array. */
function field(value: unknown, name: string): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  if (!Object.prototype.hasOwnProperty.call(value, name)) return undefined
  return (value as Record<string, unknown>)[name]
}

/**
 * The cap on any single rendered string.
 *
 * Not a security control — a correctness one. A megabyte in `summary` is a rendering failure, and
 * a page that locks up laying out one line of text during an incident has failed at its only job.
 */
const MAX_TEXT = 2000

/**
 * Control characters that are refused rather than stripped.
 *
 * Newline and tab are NOT in the set: an operator's incident update is a paragraph somebody typed,
 * and refusing it for containing a line break would drop exactly the updates this page exists to
 * carry. Everything else in the C0 and C1 ranges is refused, and so are the bidirectional
 * overrides — a status page has no use for a form feed, and U+202E in a summary is a spoofing
 * device rather than text.
 */
const FORBIDDEN_CONTROL =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/

/** A non-empty string, trimmed, bounded. Control characters are refused, not stripped. */
function readText(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (FORBIDDEN_CONTROL.test(trimmed)) return null
  return trimmed.length > max ? `${trimmed.slice(0, max)}\u2026` : trimmed
}

/**
 * A PRODUCT GROUP LABEL — and this is the strictest reader in the file.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * The one leak this projection can still carry is a group NAME, and the estate has already made
 * it once. `productGroup` is a free-text column written by whoever registered the probe
 * (`beacon/src/server.ts`, `PUT /v1/probes/:name` takes it straight from the body), so a
 * mistyped or lazily-copied registration puts `pay.rates` or `hearth.seed` — internal topology,
 * the exact strings named in 13-operational-model.md — on the most public page in the estate.
 * Beacon's field allowlist cannot catch that: the field IS allowed, it is the value that is not.
 *
 * So the value is checked for the SHAPE of a display label: letters, digits, spaces and the three
 * punctuation marks a product name legitimately uses. A dot, a slash, a colon or an underscore is
 * refused outright, because every internal name in this estate is dotted and no product group is.
 *
 * It is a shape rule rather than a list of the seven known groups on purpose: a list would drop
 * an eighth group the day one is added, and a group missing from a status page is its own defect.
 * A refusal here is COUNTED (`omitted`), never silent.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
const GROUP_LABEL = /^[A-Za-z][A-Za-z0-9 &'-]{0,47}$/

export function readGroupLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return GROUP_LABEL.test(trimmed) ? trimmed : null
}

/**
 * An incident reference: opaque, and checked to be opaque.
 *
 * `reference` is `incident.id` (`beacon/src/publicstatus.ts`). The comment above the field
 * calls it "opaque, stable, non-enumerable". This reader enforces the first of those
 * three — a reference that turns out to be a sentence, a path or a subject line is refused, and
 * the incident renders without one rather than rendering it.
 */
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

export function readReference(value: unknown): string | null {
  return typeof value === 'string' && REFERENCE.test(value) ? value : null
}

/**
 * An instant, checked by round-tripping it.
 *
 * `Date.parse` accepts a great deal that is not ISO-8601 and silently reinterprets some of it in
 * local time. Everything upstream is `toISOString()` (`beacon/src/publicstatus.ts`), so
 * requiring the canonical spelling costs nothing and refuses the ambiguous forms.
 */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/

export function readInstant(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : value
}

/** A `YYYY-MM-DD` day, as `dailyUptime` emits it (`beacon/src/publicstatus.ts`). */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export function readDay(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) return null
  return Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? null : value
}

/**
 * A member of a closed union, or null.
 *
 * **Null, never a default.** A `?? 'operational'` here is the whole failure this page is built to
 * avoid: it turns "Beacon said something I do not understand" into "everything is fine", which is
 * the single worst thing a status page can say.
 */
function readMember<T extends string>(value: unknown, members: readonly T[]): T | null {
  if (typeof value !== 'string') return null
  return members.find((member) => member === value) ?? null
}

/** An array, or an empty one. A non-array where a list was promised counts as an omission. */
function readList(value: unknown): { items: readonly unknown[]; omitted: number } {
  if (value === undefined || value === null) return { items: [], omitted: 0 }
  if (!Array.isArray(value)) return { items: [], omitted: 1 }
  return { items: value, omitted: 0 }
}

/* ------------------------------------------------------------------ the parse */

interface Tally {
  omitted: number
}

function parseUpdate(raw: unknown, tally: Tally): PublicUpdate | null {
  const at = readInstant(field(raw, 'at'))
  const body = readText(field(raw, 'body'))
  if (at === null || body === null) {
    tally.omitted += 1
    return null
  }
  return seal(PUBLIC_UPDATE_FIELDS, { at, body })
}

function parseIncident(raw: unknown, tally: Tally): PublicIncident | null {
  const group = readGroupLabel(field(raw, 'group'))
  const openedAt = readInstant(field(raw, 'openedAt'))
  // The group and the opening time are what make an incident renderable at all. Without either
  // there is no honest way to show it, so it is dropped AND counted — never shown unlabelled.
  if (group === null || openedAt === null) {
    tally.omitted += 1
    return null
  }
  const updates = readList(field(raw, 'updates'))
  tally.omitted += updates.omitted
  return seal(PUBLIC_INCIDENT_FIELDS, {
    reference: readReference(field(raw, 'reference')),
    group,
    // A severity or lifecycle word this page does not recognise renders as "not stated" rather
    // than as the nearest thing that compiles.
    severity: readMember(field(raw, 'severity'), SEVERITIES),
    state: readMember(field(raw, 'state'), INCIDENT_STATES),
    openedAt,
    closedAt: readInstant(field(raw, 'closedAt')),
    updates: updates.items
      .map((entry) => parseUpdate(entry, tally))
      .filter((entry): entry is PublicUpdate => entry !== null),
  })
}

function parseDay(raw: unknown, tally: Tally): PublicDay | null {
  const date = readDay(field(raw, 'date'))
  if (date === null) {
    tally.omitted += 1
    return null
  }
  const state = readMember(field(raw, 'state'), PUBLIC_STATES)
  // A day whose state is unreadable keeps its place in the strip as `unknown`. Dropping it would
  // shift every bar after it by one day, which silently rewrites when an outage happened.
  const cell: CellState = state ?? 'unknown'
  return seal(PUBLIC_DAY_FIELDS, { date, state: cell })
}

function parseGroup(raw: unknown, tally: Tally): PublicGroup | null {
  const group = readGroupLabel(field(raw, 'group'))
  if (group === null) {
    tally.omitted += 1
    return null
  }
  const state = readMember(field(raw, 'state'), PUBLIC_STATES)
  if (state === null) tally.omitted += 1
  const uptime = readList(field(raw, 'uptime'))
  tally.omitted += uptime.omitted
  const cell: CellState = state ?? 'unknown'
  return seal(PUBLIC_GROUP_FIELDS, {
    group,
    state: cell,
    uptime: uptime.items
      .map((entry) => parseDay(entry, tally))
      .filter((entry): entry is PublicDay => entry !== null),
  })
}

function parseMaintenance(raw: unknown, tally: Tally): PublicMaintenance | null {
  const group = readGroupLabel(field(raw, 'group'))
  const summary = readText(field(raw, 'summary'))
  const startsAt = readInstant(field(raw, 'startsAt'))
  const endsAt = readInstant(field(raw, 'endsAt'))
  if (group === null || summary === null || startsAt === null || endsAt === null) {
    tally.omitted += 1
    return null
  }
  return seal(PUBLIC_MAINTENANCE_FIELDS, { group, summary, startsAt, endsAt })
}

/**
 * Read a whole document, or refuse it.
 *
 * Returns `null` — meaning "we cannot currently determine status" — when `generatedAt` is
 * unreadable. **That field is load-bearing and its absence is fatal on purpose.** Every figure on
 * this page is a claim about a moment; a document that cannot say which moment is a document whose
 * every number is unattributable, and rendering it would be the "Operational, as of who knows
 * when" failure this page must never commit.
 *
 * The top-level `state` is NOT fatal. It is derivable from the groups, and Beacon derives it the
 * same way (`beacon/src/publicstatus.ts`) — so an unreadable one becomes `unknown` and
 * `verdict()` recomputes rather than trusting it.
 */
export function parseStatus(raw: unknown): PublicStatus | null {
  const generatedAt = readInstant(field(raw, 'generatedAt'))
  if (generatedAt === null) return null

  const tally: Tally = { omitted: 0 }
  const groups = readList(field(raw, 'groups'))
  const incidents = readList(field(raw, 'incidents'))
  const maintenance = readList(field(raw, 'maintenance'))
  tally.omitted += groups.omitted + incidents.omitted + maintenance.omitted

  const parsedGroups = groups.items
    .map((entry) => parseGroup(entry, tally))
    .filter((entry): entry is PublicGroup => entry !== null)
  const parsedIncidents = incidents.items
    .map((entry) => parseIncident(entry, tally))
    .filter((entry): entry is PublicIncident => entry !== null)
  const parsedMaintenance = maintenance.items
    .map((entry) => parseMaintenance(entry, tally))
    .filter((entry): entry is PublicMaintenance => entry !== null)

  const state = readMember(field(raw, 'state'), PUBLIC_STATES)
  if (state === null) tally.omitted += 1

  const cell: CellState = state ?? 'unknown'
  return seal(PUBLIC_STATUS_FIELDS, {
    generatedAt,
    state: cell,
    groups: parsedGroups,
    incidents: parsedIncidents,
    maintenance: parsedMaintenance,
    omitted: tally.omitted,
  })
}

/* ------------------------------------------------------------------ the verdict */

/**
 * Severity order, with `unknown` at the top.
 *
 * `unknown` outranks `outage` because of what the two mean to a reader: an outage is a thing we
 * are telling you about, and an unknown is a thing we might not be. Beacon's own order
 * (`beacon/src/publicstatus.ts`) has no `unknown` to place — it cannot produce one.
 */
const ORDER: readonly CellState[] = ['operational', 'maintenance', 'degraded', 'outage', 'unknown']

export function rank(state: CellState): number {
  return ORDER.indexOf(state)
}

/** The worst of a set. Empty is `unknown`: nothing measured is not everything healthy. */
export function worst(states: readonly CellState[]): CellState {
  if (states.length === 0) return 'unknown'
  let out: CellState = 'operational'
  for (const state of states) if (rank(state) > rank(out)) out = state
  return out
}

export interface Verdict {
  /** What the hero chip says. */
  readonly state: CellState
  /**
   * Whether every part of the answer was established. False means something was missing, refused
   * or unreadable, and the page says so in words next to the chip.
   */
  readonly complete: boolean
  /** The observation time to print beside the state. Null when there is nothing to attribute. */
  readonly asOf: string | null
}

/**
 * The estate's state, and whether we are entitled to claim it.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **GREEN ON UNKNOWN IS THE WORST FAILURE THIS PAGE CAN HAVE**, so it is a structural
 * impossibility rather than a branch somebody has to remember. One rule does it:
 *
 *     an incomplete document may report a PROBLEM, but may never report HEALTH.
 *
 * A known outage is still true when part of the document was unreadable — suppressing it would be
 * its own dishonesty. "Everything is fine", though, is a claim about the ABSENCE of problems, and
 * absence is exactly what an incomplete document cannot establish. So a non-empty problem survives
 * incompleteness and `operational` does not: it degrades to `unknown`.
 *
 * Beacon is fail-closed for the same reason at the gate — an unmeasured thing refuses rather than
 * promotes (`beacon/src/publicstatus.ts`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export function verdict(doc: PublicStatus | null): Verdict {
  if (doc === null) return { state: 'unknown', complete: false, asOf: null }

  // Recomputed from the groups rather than taken from `doc.state`. The two agree when the
  // document is whole; when it is not, the derived answer is the one that accounts for the parts
  // this page actually holds.
  const derived = worst(doc.groups.map((group) => group.state))
  const claimed = doc.state
  const complete =
    doc.omitted === 0 && doc.groups.length > 0 && claimed !== 'unknown' && derived === claimed

  const state = worst([derived, claimed === 'unknown' ? 'operational' : claimed])
  if (!complete && state === 'operational') {
    return { state: 'unknown', complete: false, asOf: doc.generatedAt }
  }
  return { state, complete, asOf: doc.generatedAt }
}

/* ------------------------------------------------------------------ the leak assertion */

/**
 * Every string in a parsed document, in document order.
 *
 * The render layer draws text and nothing else, so this is the complete set of things a reader
 * could ever see. `test/publicstatus.test.ts` injects internal values — target names, subjects,
 * error strings, customer identifiers — into a well-formed upstream document and asserts that not
 * one of them appears in this list. That is the test that fails if a field added upstream ever
 * becomes renderable here.
 */
export function renderableStrings(doc: PublicStatus): string[] {
  const out: string[] = [doc.generatedAt, doc.state]
  for (const group of doc.groups) {
    out.push(group.group, group.state)
    for (const day of group.uptime) out.push(day.date, day.state)
  }
  for (const incident of doc.incidents) {
    if (incident.reference !== null) out.push(incident.reference)
    out.push(incident.group)
    if (incident.severity !== null) out.push(incident.severity)
    if (incident.state !== null) out.push(incident.state)
    out.push(incident.openedAt)
    if (incident.closedAt !== null) out.push(incident.closedAt)
    for (const update of incident.updates) out.push(update.at, update.body)
  }
  for (const window of doc.maintenance) {
    out.push(window.group, window.summary, window.startsAt, window.endsAt)
  }
  return out
}
