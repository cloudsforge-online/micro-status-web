/**
 * Status is never conveyed by colour alone.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * The design system's reserved status hues are `--cf-viz-good #7fae5c`, `--cf-viz-warn #f4a63c`
 * and `--cf-viz-crit #d2543a`. Run through the palette validator against the panel surface they
 * fail colourblind separation: good against warn measures **ΔE 4.6 under protanopia**, well under
 * even the 6–8 floor that is legal only WITH secondary encoding. `tokens.css` reaches the
 * same conclusion from the other side and refuses to add a fourth hue for the same reason.
 *
 * So the secondary encoding is mandatory here, and these tests are what make it structural: every
 * state must have a glyph and a word, no two states may share either, and the CSS must not be able
 * to express a status mark that has only a colour.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import type { CellState } from '../src/lib/publicstatus.ts'
import {
  incidentVoice,
  severityGloss,
  severityLabel,
  STATE_ORDER,
  voiceOf,
} from '../src/lib/states.ts'

const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8')

const ALL: readonly CellState[] = ['operational', 'degraded', 'outage', 'maintenance', 'unknown']

describe('every state carries three channels', () => {
  it('has a glyph, a label and a sentence', () => {
    for (const state of ALL) {
      const voice = voiceOf(state)
      assert.ok(voice.glyph.length > 0, `${state} has no glyph`)
      assert.ok(voice.label.length > 0, `${state} has no label`)
      assert.ok(voice.sentence.length > 0, `${state} has no sentence`)
      assert.ok(voice.tone.length > 0, `${state} has no tone`)
    }
  })

  it('gives no two states the same glyph', () => {
    const glyphs = ALL.map((state) => voiceOf(state).glyph)
    assert.equal(new Set(glyphs).size, glyphs.length, `glyphs collide: ${glyphs.join(' ')}`)
  })

  it('gives no two states the same word', () => {
    const labels = ALL.map((state) => voiceOf(state).label)
    assert.equal(new Set(labels).size, labels.length)
  })

  it('gives no two states the same tone class', () => {
    const tones = ALL.map((state) => voiceOf(state).tone)
    assert.equal(new Set(tones).size, tones.length)
  })

  it('orders the legend best to worst, then the gap', () => {
    assert.deepEqual(STATE_ORDER, ['operational', 'maintenance', 'degraded', 'outage', 'unknown'])
    assert.equal(new Set(STATE_ORDER).size, ALL.length)
  })
})

describe('the words for "we do not know" never imply health or failure', () => {
  it('is not called "Unknown", which reads as a state of the estate', () => {
    const voice = voiceOf('unknown')
    assert.equal(voice.label, 'Not determined')
    assert.match(voice.sentence, /got no answer back/i)
    assert.match(voice.sentence, /not a claim either way/i)
  })

  it('does not describe an unknown with any word used for a healthy state', () => {
    const unknown = `${voiceOf('unknown').label} ${voiceOf('unknown').sentence}`.toLowerCase()
    for (const word of ['operational', 'healthy', 'fine', 'normal', 'up']) {
      assert.equal(unknown.includes(word), false, `"${word}" appears in the unknown copy`)
    }
  })
})

describe('the component layer always renders the word', () => {
  const chip = read('src/components/state.tsx')

  it('renders the label alongside the glyph in the chip', () => {
    assert.match(chip, /voice\.glyph/)
    assert.match(chip, /voice\.label/)
  })

  it('hides the glyph from the accessibility tree so it is not announced twice', () => {
    assert.match(chip, /st-chip__glyph"\s*aria-hidden="true"/s)
  })

  it('has no icon-only or colour-only variant', () => {
    // A prop that suppressed the label would be the single most consequential regression
    // available in this repository.
    assert.equal(/labelless|iconOnly|hideLabel|glyphOnly/i.test(chip), false)
  })

  it('renders a legend for the strip, since ninety bars cannot each carry a word', () => {
    assert.match(chip, /export function StateLegend/)
    assert.match(read('src/components/uptime.tsx'), /<StateLegend/)
  })

  it('gives every bar a title, which is its tooltip and its accessible name', () => {
    assert.match(read('src/components/uptime.tsx'), /<title>\{`\$\{label\} — \$\{voice\.label\}`\}<\/title>/)
  })
})

describe('the stylesheet cannot express a colour-only status page', () => {
  const css = read('src/styles.css')

  it('carries a forced-colours block, where every status hue stops existing', () => {
    assert.match(css, /@media \(forced-colors: active\)/)
  })

  it('draws the unmeasured bar hollow rather than in an invented hue', () => {
    assert.match(css, /\.st-bar--void \{[^}]*fill: none/s)
  })

  it('uses no literal colour anywhere — every colour follows the substrate', () => {
    // A hex here is a colour that stops following `data-cf-substrate`, and the status page is the
    // one page in the estate where an off-palette colour is a correctness problem.
    const hexes = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    assert.deepEqual(hexes, [], `literal colours in styles.css: ${hexes.join(', ')}`)
  })

  it('gives maintenance the neutral diverging midpoint rather than a fourth status hue', () => {
    assert.match(css, /\.st-bar--plan \{[^}]*--cf-viz-mid/s)
  })
})

describe('severity is shown in the estate’s own vocabulary, not an invented one', () => {
  it('shows the sev code itself', () => {
    assert.equal(severityLabel('sev1'), 'SEV1')
    assert.equal(severityLabel('sev4'), 'SEV4')
  })

  it('says "not stated" rather than guessing when there is no severity', () => {
    assert.equal(severityLabel(null), 'Severity not stated')
    assert.equal(severityGloss(null), null)
  })

  it('glosses each level without redefining it', () => {
    for (const severity of ['sev1', 'sev2', 'sev3', 'sev4'] as const) {
      const gloss = severityGloss(severity)
      assert.ok(gloss && gloss.length > 0)
    }
  })
})

describe('incident lifecycle words', () => {
  it('gives each of the four a glyph and a label', () => {
    const seen = new Set<string>()
    for (const state of ['investigating', 'identified', 'monitoring', 'resolved'] as const) {
      const voice = incidentVoice(state)
      assert.ok(voice.glyph && voice.label)
      seen.add(voice.glyph)
    }
    assert.equal(seen.size, 4)
  })

  it('says "not stated" for an unrecognised lifecycle rather than assuming investigating', () => {
    assert.equal(incidentVoice(null).label, 'Not stated')
  })
})
