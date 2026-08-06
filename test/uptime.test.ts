/**
 * The strip's arithmetic.
 *
 * The one test worth writing here is the gap test: `dailyUptime` emits no row for a day with no
 * rollup (`beacon/src/publicstatus.ts` selects FROM `check_rollups`), so a strip built by
 * position draws a short green run where a long partly-unmeasured one belongs. Everything else in
 * this file exists to stop a "fix" for that from quietly re-introducing a zero.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PublicDay } from '../src/lib/publicstatus.ts'
import {
  barHeight,
  buildWindow,
  dayKey,
  percentText,
  shiftDay,
  summarise,
  worseOf,
  WINDOW_DAYS,
} from '../src/lib/uptime.ts'

const day = (date: string, state: PublicDay['state']): PublicDay => ({ date, state })

describe('the window is filled by date, never by position', () => {
  it('is exactly ninety days long even when Beacon sent three', () => {
    const window = buildWindow(
      [day('2026-07-29', 'operational'), day('2026-07-30', 'outage'), day('2026-07-31', 'operational')],
      '2026-07-31',
    )
    assert.equal(window.length, WINDOW_DAYS)
    assert.equal(window[0]?.date, shiftDay('2026-07-31', -(WINDOW_DAYS - 1)))
    assert.equal(window[WINDOW_DAYS - 1]?.date, '2026-07-31')
  })

  it('marks a day with no row as unknown, not as operational', () => {
    const window = buildWindow([day('2026-07-31', 'operational')], '2026-07-31', 3)
    assert.deepEqual(window, [
      day('2026-07-29', 'unknown'),
      day('2026-07-30', 'unknown'),
      day('2026-07-31', 'operational'),
    ])
  })

  it('keeps a gap IN THE MIDDLE in its own place rather than closing it up', () => {
    // This is the failure a positional map produces: the outage slides a day earlier and the
    // window ends a day short, so the history reads as though the outage was yesterday.
    const window = buildWindow(
      [day('2026-07-29', 'outage'), day('2026-07-31', 'operational')],
      '2026-07-31',
      3,
    )
    assert.equal(window[0]?.state, 'outage')
    assert.equal(window[1]?.state, 'unknown')
    assert.equal(window[2]?.state, 'operational')
  })

  it('ignores a row outside the window rather than shifting the window to fit it', () => {
    const window = buildWindow(
      [day('2020-01-01', 'outage'), day('2026-07-31', 'operational')],
      '2026-07-31',
      2,
    )
    assert.deepEqual(window.map((entry) => entry.state), ['unknown', 'operational'])
  })

  it('takes the WORSE of duplicate rows for one date, not the last one seen', () => {
    const window = buildWindow(
      [day('2026-07-31', 'operational'), day('2026-07-31', 'outage')],
      '2026-07-31',
      1,
    )
    assert.equal(window[0]?.state, 'outage')
    // And in the other order, so this is not an accident of iteration.
    const reversed = buildWindow(
      [day('2026-07-31', 'outage'), day('2026-07-31', 'operational')],
      '2026-07-31',
      1,
    )
    assert.equal(reversed[0]?.state, 'outage')
  })

  it('prefers a reading over a gap when both exist for one date', () => {
    assert.equal(worseOf('unknown', 'operational'), 'operational')
    assert.equal(worseOf('operational', 'unknown'), 'operational')
    assert.equal(worseOf('unknown', 'unknown'), 'unknown')
  })

  it('is all unknown for an empty upstream list', () => {
    const window = buildWindow([], '2026-07-31', 5)
    assert.equal(window.length, 5)
    assert.ok(window.every((entry) => entry.state === 'unknown'))
  })
})

describe('calendar arithmetic is UTC and crosses month and year boundaries', () => {
  it('steps back across a month end', () => {
    assert.equal(shiftDay('2026-03-01', -1), '2026-02-28')
    assert.equal(shiftDay('2024-03-01', -1), '2024-02-29')
  })

  it('steps back across a year end', () => {
    assert.equal(shiftDay('2026-01-01', -1), '2025-12-31')
  })

  it('spans ninety days without drifting', () => {
    assert.equal(shiftDay('2026-07-31', -89), '2026-05-03')
  })

  it('reads an instant as its UTC day', () => {
    assert.equal(dayKey(new Date('2026-07-31T23:59:59.000Z')), '2026-07-31')
    assert.equal(dayKey(new Date('2026-08-01T00:00:00.000Z')), '2026-08-01')
  })
})

describe('summarise counts, and refuses to invent a ratio', () => {
  it('counts each state separately and never folds unknown into any of them', () => {
    const summary = summarise([
      day('2026-07-27', 'operational'),
      day('2026-07-28', 'degraded'),
      day('2026-07-29', 'outage'),
      day('2026-07-30', 'maintenance'),
      day('2026-07-31', 'unknown'),
    ])
    assert.equal(summary.operational, 1)
    assert.equal(summary.degraded, 1)
    assert.equal(summary.outage, 1)
    assert.equal(summary.maintenance, 1)
    assert.equal(summary.unknown, 1)
    assert.equal(summary.measured, 4)
    assert.equal(summary.total, 5)
  })

  it('divides by the MEASURED days, not by the window', () => {
    const summary = summarise([
      day('2026-07-29', 'operational'),
      day('2026-07-30', 'outage'),
      day('2026-07-31', 'unknown'),
    ])
    // Two measured days, one of them good. Not one third.
    assert.equal(summary.operationalRatio, 0.5)
  })

  it('is null, not zero and not one, when nothing was measured', () => {
    const summary = summarise([day('2026-07-31', 'unknown')])
    assert.equal(summary.operationalRatio, null)
    assert.equal(percentText(summary.operationalRatio), '—')
  })

  it('is null for an empty window', () => {
    assert.equal(summarise([]).operationalRatio, null)
  })
})

describe('percentText never rounds a bad day away', () => {
  it('prints 100% only for an exactly perfect window', () => {
    assert.equal(percentText(1), '100%')
  })

  it('clamps anything short of perfect below 100', () => {
    // 899/900 rounds to 99.9%, and the naive `toFixed(1)` of 99.888… is already 99.9 — the case
    // that matters is 8999/9000 = 99.988…, which would print "100.0%" beside a visible red bar.
    assert.equal(percentText(8999 / 9000), '99.9%')
    assert.equal(percentText(0.99999), '99.9%')
  })

  it('prints an ordinary figure to one decimal place', () => {
    assert.equal(percentText(0.5), '50.0%')
    assert.equal(percentText(0.9765), '97.7%')
    assert.equal(percentText(0), '0.0%')
  })
})

describe('bar height is the redundant channel', () => {
  it('is ordinal: the worse the day, the shorter the bar', () => {
    assert.ok(barHeight('operational') > barHeight('maintenance'))
    assert.ok(barHeight('maintenance') > barHeight('degraded'))
    assert.ok(barHeight('degraded') > barHeight('outage'))
  })

  it('draws an unmeasured day at full height, because it is not a bad day', () => {
    // Shortening it would rank a gap as an outage; the hollow fill is what says "no data".
    assert.equal(barHeight('unknown'), barHeight('operational'))
  })

  it('gives every state a height in the drawable range', () => {
    for (const state of ['operational', 'degraded', 'outage', 'maintenance', 'unknown'] as const) {
      const height = barHeight(state)
      assert.ok(height > 0 && height <= 1, `${state} height ${height}`)
    }
  })
})
