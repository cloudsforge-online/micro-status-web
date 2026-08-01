/**
 * Status marks: glyph, word, colour — in that order of importance.
 *
 * Every one of these renders the WORD. There is no icon-only variant and no colour-only variant,
 * and adding one would be the single most consequential regression available in this repository:
 * the estate's own tokens file records that the reserved status hues measure ΔE 4.6 apart under
 * protanopia (see the header of `src/lib/states.ts`), so a bare coloured dot conveys nothing at
 * all to a large minority of the people reading this page under stress.
 */
import type { CellState } from '../lib/publicstatus.ts'
import { STATE_ORDER, voiceOf } from '../lib/states.ts'

export interface StateChipProps {
  state: CellState
  /** Rendered larger, for the one hero chip at the top of the page. */
  hero?: boolean
}

export function StateChip({ state, hero = false }: StateChipProps) {
  const voice = voiceOf(state)
  return (
    <span
      className={`st-chip st-chip--${voice.tone}${hero ? ' st-chip--hero' : ''}`}
      // The accessible name is the WORD, and the glyph is hidden from the tree — otherwise a
      // screen reader announces "black square Outage", which is the shape channel leaking into
      // the channel that already worked.
      role="status"
    >
      <span className="st-chip__glyph" aria-hidden="true">
        {voice.glyph}
      </span>
      <span className="st-chip__label">{voice.label}</span>
    </span>
  )
}

/**
 * The legend. Present whenever the strip is, and never optional.
 *
 * A ninety-bar strip cannot label each bar, so the legend is the only place the shape/colour
 * mapping is written down in words. The heights here are the real ones from `barHeight()`, drawn
 * at the same scale as the strip, so the legend teaches the second channel rather than only the
 * first.
 */
export function StateLegend() {
  return (
    <ul className="st-legend" aria-label="What each bar means">
      {STATE_ORDER.map((state) => {
        const voice = voiceOf(state)
        return (
          <li key={state} className="st-legend__item">
            <span className={`st-legend__swatch st-legend__swatch--${voice.tone}`} aria-hidden="true" />
            <span className="st-legend__glyph" aria-hidden="true">
              {voice.glyph}
            </span>
            <span className="st-legend__label">{voice.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
