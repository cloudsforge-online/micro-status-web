/**
 * The ninety-day strip, and the arithmetic under it.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **A DAY BEACON DID NOT SEND IS NOT A GOOD DAY.**
 *
 * `dailyUptime` (`beacon/src/publicstatus.ts:387-397`) selects FROM `check_rollups` and groups by
 * day. A day with no rollup row — Beacon was down, the scheduler had stopped, the group did not
 * exist yet, the database was restored from a backup — produces no row at all, and the array
 * simply skips it. So a naive strip that renders `uptime.map(...)` draws 84 bars where 90 belong,
 * every one of them green, silently sliding six days of history sideways.
 *
 * `buildWindow()` below fills the window by DATE rather than by position: it walks ninety calendar
 * days back from the end of the window and looks each one up. A day that is absent is `unknown`,
 * which renders as a hollow bar — visibly not green, visibly not a value, and counted separately
 * everywhere a count appears.
 *
 * This is the same discipline as Beacon's own metrics plane, where a probe that has never run
 * publishes NOTHING rather than 0 (`beacon/src/server.ts:775-777`): "a gap in a graph is readable;
 * a series that reads 0 for a probe that has never run makes every deploy look like an outage".
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * **AND NO INVENTED PERCENTAGE.** `summarise()` reports counts, and a ratio only over the days
 * that actually carry data, with that denominator returned alongside it so the caller is obliged
 * to show it. "99.98% uptime" computed over a window that is a third empty is a number nobody can
 * act on and everybody quotes.
 */
import type { CellState, PublicDay } from './publicstatus.ts'

/** Ninety bars — the window `beacon/src/publicstatus.ts:383` serves by default (`days = 90`). */
export const WINDOW_DAYS = 90

/** `YYYY-MM-DD` for an instant, in UTC. The same spelling `dailyUptime` emits. */
export function dayKey(at: Date): string {
  return at.toISOString().slice(0, 10)
}

/** `n` days before `day`, as a key. Pure calendar arithmetic in UTC; no local zone anywhere. */
export function shiftDay(day: string, delta: number): string {
  const at = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(at.getTime())) return day
  at.setUTCDate(at.getUTCDate() + delta)
  return dayKey(at)
}

/**
 * A filled window of exactly `days` entries, oldest first, ending on `endDay`.
 *
 * Duplicated dates from upstream collapse to the WORST of the duplicates rather than to the last
 * one seen. Beacon groups by day so duplicates should not occur — but "should not occur" is how a
 * silent last-write-wins hides an outage, and taking the worse of two readings can only ever be
 * conservative.
 */
export function buildWindow(
  entries: readonly PublicDay[],
  endDay: string,
  days: number = WINDOW_DAYS,
): PublicDay[] {
  const byDate = new Map<string, CellState>()
  for (const entry of entries) {
    const held = byDate.get(entry.date)
    byDate.set(entry.date, held === undefined ? entry.state : worseOf(held, entry.state))
  }

  const out: PublicDay[] = []
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = shiftDay(endDay, -index)
    // The lookup is by DATE. Nothing here reads `entries[i]`, which is the bug this function
    // exists to make unwritable.
    out.push({ date, state: byDate.get(date) ?? 'unknown' })
  }
  return out
}

/**
 * The worse of two day states, for the duplicate case above.
 *
 * `unknown` is NOT the worst here, unlike in `verdict()`. A day for which we hold both a reading
 * and a gap is a day we have a reading for; treating the gap as worse would discard evidence. The
 * asymmetry is deliberate: in a VERDICT an unknown is a failure to establish, in a DAY OF HISTORY
 * it is one absent row beside a present one.
 */
const DAY_ORDER: readonly CellState[] = ['operational', 'maintenance', 'degraded', 'outage']

export function worseOf(a: CellState, b: CellState): CellState {
  if (a === 'unknown') return b
  if (b === 'unknown') return a
  return DAY_ORDER.indexOf(b) > DAY_ORDER.indexOf(a) ? b : a
}

export interface UptimeSummary {
  readonly operational: number
  readonly degraded: number
  readonly outage: number
  readonly maintenance: number
  /** Days with no rollup at all. Never folded into any of the four above. */
  readonly unknown: number
  /** The four known counts added up. The honest denominator for any ratio. */
  readonly measured: number
  /** The whole window, measured or not. */
  readonly total: number
  /**
   * Fully-operational days as a fraction of MEASURED days, or null when nothing was measured.
   *
   * Null rather than 0, and null rather than 1. A window with no data supports no ratio, and both
   * of the numbers a lazy implementation would reach for are assertions this page cannot make.
   */
  readonly operationalRatio: number | null
}

/** Count a window. Every state is counted; nothing is inferred from what is missing. */
export function summarise(days: readonly PublicDay[]): UptimeSummary {
  let operational = 0
  let degraded = 0
  let outage = 0
  let maintenance = 0
  let unknown = 0
  for (const day of days) {
    if (day.state === 'operational') operational += 1
    else if (day.state === 'degraded') degraded += 1
    else if (day.state === 'outage') outage += 1
    else if (day.state === 'maintenance') maintenance += 1
    else unknown += 1
  }
  const measured = operational + degraded + outage + maintenance
  return {
    operational,
    degraded,
    outage,
    maintenance,
    unknown,
    measured,
    total: days.length,
    operationalRatio: measured === 0 ? null : operational / measured,
  }
}

/**
 * A ratio as a percentage string, to one decimal place, or the em dash for "no figure".
 *
 * **Never rounds up to 100.0%.** A window with one bad day in nine hundred is 99.888…%, and
 * printing "100.0%" beside a visible red bar is the page contradicting itself. Anything short of
 * exactly whole is clamped to 99.9%, which is both true and the highest claim the data supports.
 */
export function percentText(ratio: number | null): string {
  if (ratio === null) return '—'
  if (ratio >= 1) return '100%'
  const percent = ratio * 100
  return `${(percent >= 99.9 ? 99.9 : Math.round(percent * 10) / 10).toFixed(1)}%`
}

/**
 * The bar's height as a fraction of the track, by state.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **HEIGHT IS THE REDUNDANT CHANNEL, AND IT IS NOT DECORATION.**
 *
 * The design system's three reserved status hues are `--cf-viz-good #7fae5c`,
 * `--cf-viz-warn #f4a63c` and `--cf-viz-crit #d2543a` (`ui/packages/ui/src/tokens.css:261-263`).
 * Validated as a categorical set on the panel surface they FAIL colourblind separation: good
 * against warn measures ΔE 4.6 under protanopia. The tokens file says as much itself and draws
 * the right conclusion — "never colour alone: every status mark ships icon + label + colour,
 * because the status page is the one surface a colourblind reader reads under stress".
 *
 * A ninety-bar strip cannot carry a word per bar, so the second channel here is HEIGHT, which is
 * ordinal exactly as the states are: the worse the day, the shorter the bar. It survives total
 * colour loss, greyscale printing and forced-colours mode. The third channel is the legend and the
 * per-bar `<title>`, which say the state in words.
 *
 * An unknown day is drawn at full height and HOLLOW — an outline, not a fill. Drawing it short
 * would rank a gap as a bad day, and drawing it filled would rank it as any day at all.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export function barHeight(state: CellState): number {
  switch (state) {
    case 'operational':
      return 1
    case 'maintenance':
      return 0.7
    case 'degraded':
      return 0.55
    case 'outage':
      return 0.3
    case 'unknown':
      return 1
    default: {
      // Exhaustive. A sixth state must be given a height by a person, not by a fallthrough.
      const exhaustive: never = state
      throw new Error(`unmapped state: ${String(exhaustive)}`)
    }
  }
}
