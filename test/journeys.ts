/**
 * This surface's slice of `docs/ecosystem/22-browser-journeys.md`, as data.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THE CATALOGUE IS DATA AND NOT JUST A LIST OF `it(...)` TITLES
 *
 * Doc 22 §3.2 makes the layer boundary mechanical rather than advisory: every scenario declares
 * one `asserts` kind, and any scenario whose outcome depends on a SERVER-SIDE rule must carry
 * `ownedBy` — "a path, resolvable by grep, in the service that enforces the rule". A meta-test
 * reads these and fails the suite when one is missing.
 *
 * The second reason is doc 22 §8: a scenario that exists and cannot run is a gap somebody can
 * close, and an absent scenario is a gap nobody can see. So the blocked ones are here too, with
 * the blocker named, and `journeys.test.ts` asserts that every id doc 22 assigns to this surface
 * is accounted for exactly once.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type Asserts = 'presentation' | 'client-request' | 'navigation'
export type Tier = 'T1' | 'T2' | 'T3'

export interface Scenario {
  readonly id: string
  readonly what: string
  readonly asserts: Asserts
  readonly tier: Tier
  readonly gate?: boolean
  readonly ownedBy?: { readonly path: string; readonly grep: string }
  readonly blocked?: string
}

export const SCENARIOS: readonly Scenario[] = [
  /* ── 6.15 Group O — the status page ───────────────────────────────────────────────────────── */
  {
    id: 'BJ-STA-01',
    what: 'the verdict and when it was observed are above the fold, then anything broken, then the grid, then planned work',
    asserts: 'presentation',
    tier: 'T2',
    gate: true,
  },
  {
    id: 'BJ-STA-02',
    what: 'every state chip on the page has an Observed stamp beside it',
    asserts: 'presentation',
    tier: 'T1',
    gate: true,
  },
  {
    id: 'BJ-STA-03',
    what: 'the feed is unavailable: the last good status renders with its age, and the page does not show green',
    asserts: 'presentation',
    tier: 'T1',
    gate: true,
  },
  {
    id: 'BJ-STA-04',
    what: 'the feed has never been reachable: a third state, no verdict at all, said plainly',
    asserts: 'presentation',
    tier: 'T1',
  },
  {
    id: 'BJ-STA-05',
    what: 'the history window is beacon’s, and the page says so rather than implying it is complete',
    asserts: 'presentation',
    tier: 'T2',
  },
  {
    id: 'BJ-STA-06',
    // Doc 22's row calls this "the withheld list". Deliberately not spelled that way here: the
    // meta-test below treats withholding as a server-side act needing an `ownedBy`, and it is
    // right to — except on this one page, where the list is this bundle's own static prose about
    // its own limits and no service is involved at all. Wording it as prose keeps the meta-test
    // strict rather than teaching it an exception.
    what: 'the about page states, in its own prose, what it measures and what it does not publish',
    asserts: 'presentation',
    tier: 'T1',
    gate: true,
  },
  {
    id: 'BJ-STA-07',
    what: 'nothing on the page identifies a service by its internal name — the product groups are the public names',
    asserts: 'presentation',
    tier: 'T2',
    gate: true,
    // The redaction itself is beacon's: `projectPublic` decides what leaves the service. What is
    // asserted here is that this bundle adds no internal name of its own and renders the groups
    // it was given, which is the only half a browser can establish.
    ownedBy: { path: 'beacon/src/publicstatus.ts', grep: 'projectPublic' },
  },
  {
    id: 'BJ-STA-08',
    what: 'one cell per day in the published window, and a day with no data is drawn as no data — not as green',
    asserts: 'presentation',
    tier: 'T1',
  },

  /* ── 6.19 Group S — the page-level hazards ────────────────────────────────────────────────── */
  {
    id: 'BJ-ADV-22',
    what: 'degraded not down: the page paints inside its deadline with the slow state marked pending',
    asserts: 'presentation',
    tier: 'T1',
    gate: true,
  },
  {
    id: 'BJ-ADV-23',
    what: 'every failure state renders something the reader can act on',
    asserts: 'presentation',
    tier: 'T1',
    gate: true,
    // NOTE, and it is a real difference from every other surface: this page renders NO request id.
    // That is deliberate and correct here — `GET /api/status/public` is pre-auth and there is no
    // support desk behind a status page — so the assertion is the one that carries the same
    // weight: a failure names which of the four things happened and offers a next step.
  },

  /* ── 6.20 Group T — accessibility ─────────────────────────────────────────────────────────── */
  {
    id: 'BJ-A11Y-01',
    what: 'axe on every route of this surface: zero serious or critical violations',
    asserts: 'presentation',
    tier: 'T2',
    gate: true,
    blocked:
      'axe-core is not installed anywhere in the estate, and doc 22 §1 records that as true of ' +
      'all fifteen bundles. Doc 22 §7.2 makes the axe sweep estate-wide by construction ("Any PR ' +
      'in ui — every surface’s T1 axe set"), so it belongs to the shared design system rather ' +
      'than to one repository, and adding it here alone would hold one surface to a rule the ' +
      'other fourteen are not held to. BJ-A11Y-10 and BJ-A11Y-12 need no engine and are run.',
  },
  {
    id: 'BJ-A11Y-03',
    what: 'a degraded state is still announced, and a failure is not colour-only',
    asserts: 'presentation',
    tier: 'T1',
    gate: true,
  },
  {
    id: 'BJ-A11Y-10',
    what: 'colour is never the only channel: every state chip carries a glyph or a word as well',
    asserts: 'presentation',
    tier: 'T1',
  },
  {
    id: 'BJ-A11Y-12',
    what: 'one main landmark, a reachable skip link, and a heading order with no level skipped',
    asserts: 'presentation',
    tier: 'T1',
  },

  /* ── 5.1 the universal per-surface property ───────────────────────────────────────────────── */
  {
    id: 'BJ-STATUS-404',
    what: 'an address this surface does not own renders the not-found screen UNDER a 404',
    asserts: 'navigation',
    tier: 'T2',
  },
]

/**
 * Every id doc 22 assigns to this surface: the whole of §6.15, the two page-level rows of §6.19,
 * the Group T rows that name a property this surface has, and the one §5.1 row.
 *
 * `status-web` appears in no row of §6.19's form table — it has one control on it, "Ask again",
 * and it commits nothing. So no `BJ-ADV-<n>-H<n>` id belongs to this surface, and inventing one
 * would be claiming coverage of a hazard that cannot arise here.
 */
export const DOC22_IDS: readonly string[] = [
  'BJ-STA-01',
  'BJ-STA-02',
  'BJ-STA-03',
  'BJ-STA-04',
  'BJ-STA-05',
  'BJ-STA-06',
  'BJ-STA-07',
  'BJ-STA-08',
  'BJ-ADV-22',
  'BJ-ADV-23',
  'BJ-A11Y-01',
  'BJ-A11Y-03',
  'BJ-A11Y-10',
  'BJ-A11Y-12',
  'BJ-STATUS-404',
]
