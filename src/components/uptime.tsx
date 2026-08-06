/**
 * The ninety-day strip.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THREE CHANNELS PER BAR: HEIGHT, FILL AND WORDS.**
 *
 *   * HEIGHT is ordinal and matches the ordering of the states — the worse the day, the shorter
 *     the bar (`barHeight()`, and the reasoning is written there). It is the channel that survives
 *     greyscale, forced-colours mode and protanopia, where the reserved good/warn pair collapses
 *     to ΔE 4.6.
 *   * FILL is the reserved status palette, which is the fastest channel for the readers who have
 *     it. An unknown day is not given a hue at all: it is drawn HOLLOW, as an outline on the
 *     neutral. There is no colour in this estate that means "no data", and inventing one would
 *     put a sixth thing in a three-colour palette.
 *   * WORDS are the per-bar `<title>` (which is the hover tooltip and the accessible name), the
 *     legend beneath, and the counted summary sentence. Nothing here can be read by colour alone.
 *
 * The strip is deliberately NOT a percentage bar and carries no number per day. `dailyUptime`
 * publishes a coarse per-day verdict and nothing finer (`beacon/src/publicstatus.ts`:
 * "Deliberately coarse: a percentage per day per group invites the question 'which service was
 * that', which is the question this projection exists not to answer"). Drawing a partial bar to
 * suggest "97% of that day" would be this page inventing a figure Beacon refused to publish.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { barPath } from '@cloudsforge/ui/charts'
import { dayLabel } from '../lib/asof.ts'
import type { PublicDay } from '../lib/publicstatus.ts'
import { voiceOf } from '../lib/states.ts'
import { barHeight, percentText, summarise } from '../lib/uptime.ts'
import { StateLegend } from './state.tsx'

/** Geometry. A 2px gap between marks, per the mark spec; the bars are thin on purpose. */
const BAR_W = 6
const GAP = 2
const TRACK_H = 36

export interface UptimeStripProps {
  days: readonly PublicDay[]
  /** Named in the accessible description, so a screen reader knows whose history this is. */
  group: string
}

export function UptimeStrip({ days, group }: UptimeStripProps) {
  const summary = summarise(days)
  const width = days.length * (BAR_W + GAP) - GAP
  const first = days[0]
  const last = days[days.length - 1]

  return (
    <figure className="st-strip">
      <svg
        className="st-strip__svg"
        viewBox={`0 0 ${Math.max(width, 1)} ${TRACK_H}`}
        role="img"
        aria-label={describe(group, summary.total)}
        preserveAspectRatio="xMidYMid meet"
      >
        {days.map((day, index) => {
          const voice = voiceOf(day.state)
          const height = Math.max(barHeight(day.state) * TRACK_H, 3)
          const x = index * (BAR_W + GAP)
          // Anchored to the BASELINE, not centred: a bar that shrinks from both ends encodes its
          // value twice as weakly and reads as a floating tick.
          const y = TRACK_H - height
          const label = dayLabel(day.date) ?? day.date
          return (
            <path
              key={day.date}
              d={barPath(x, y, BAR_W, height, 2)}
              className={`st-bar st-bar--${voice.tone}`}
            >
              {/* The tooltip and the accessible name for this mark, in words. */}
              <title>{`${label} — ${voice.label}`}</title>
            </path>
          )
        })}
      </svg>

      <figcaption className="st-strip__caption">
        <span className="st-strip__end">{first ? (dayLabel(first.date) ?? first.date) : '—'}</span>
        <span className="st-strip__figure">
          {/*
            The ratio and its denominator, always together. A percentage over a window that is
            partly empty is the number this page must never print alone — see `summarise()`.
          */}
          {percentText(summary.operationalRatio)} of {summary.measured} measured{' '}
          {summary.measured === 1 ? 'day' : 'days'} came back clean
          {summary.unknown > 0 && (
            <span className="st-strip__gap">
              {' '}
              · {summary.unknown} {summary.unknown === 1 ? 'day' : 'days'} we never measured
            </span>
          )}
        </span>
        <span className="st-strip__end">{last ? (dayLabel(last.date) ?? last.date) : '—'}</span>
      </figcaption>

      <StateLegend />

      <ExceptionTable days={days} />
    </figure>
  )
}

function describe(group: string, total: number): string {
  return `${group}: ${total} days, one bar each, every bar showing the worst state that day reached.`
}

/**
 * The table view — the days that were not fully operational, and the days with no data.
 *
 * Every chart on this page needs a form that does not depend on seeing it. A ninety-row table is
 * noise, so this lists the exceptions, which is what a reader is looking for anyway: it answers
 * "when was it last broken" without them counting bars.
 *
 * Rendered `<details>`-collapsed rather than omitted on small screens: content that exists only
 * at one viewport is content that is missing for somebody.
 */
function ExceptionTable({ days }: { days: readonly PublicDay[] }) {
  const exceptions = days.filter((day) => day.state !== 'operational')
  if (exceptions.length === 0) {
    return (
      <p className="st-strip__none">
        Every day in this window was measured, and every one of them came back clean.
      </p>
    )
  }
  return (
    <details className="st-table">
      <summary>
        {exceptions.length} {exceptions.length === 1 ? 'day' : 'days'} worth a look
      </summary>
      <table>
        <caption className="st-visually-hidden">
          Every day in this window that fell short of clean, or that we never measured
        </caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody>
          {exceptions.map((day) => {
            const voice = voiceOf(day.state)
            return (
              <tr key={day.date}>
                <td>{dayLabel(day.date) ?? day.date}</td>
                <td>
                  <span className={`st-dot st-dot--${voice.tone}`} aria-hidden="true">
                    {voice.glyph}
                  </span>{' '}
                  {voice.label}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </details>
  )
}
