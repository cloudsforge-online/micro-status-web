/**
 * Observation time.
 *
 * The tests that matter are the ones about NOT knowing: a null instant, an unparseable one, and
 * one from the future. Each has an obvious wrong answer that a plausible implementation reaches —
 * printing nothing, printing "Invalid Date", and printing "in 4 minutes" — and each of those makes
 * the state beside it less trustworthy rather than more.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  absoluteStamp,
  ANCIENT_AFTER_MS,
  dayLabel,
  observedSentence,
  relativeAge,
  staleness,
  STALE_AFTER_MS,
} from '../src/lib/asof.ts'

const NOW = new Date('2026-07-31T09:00:00.000Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()

describe('staleness', () => {
  it('is fresh inside the threshold', () => {
    assert.equal(staleness(ago(0), NOW), 'fresh')
    assert.equal(staleness(ago(STALE_AFTER_MS - 1), NOW), 'fresh')
  })

  it('is stale past it, and ancient past the hour', () => {
    assert.equal(staleness(ago(STALE_AFTER_MS + 1), NOW), 'stale')
    assert.equal(staleness(ago(ANCIENT_AFTER_MS - 1), NOW), 'stale')
    assert.equal(staleness(ago(ANCIENT_AFTER_MS + 1), NOW), 'ancient')
  })

  it('is unknown for a null, an unparseable and a non-canonical instant', () => {
    assert.equal(staleness(null, NOW), 'unknown')
    assert.equal(staleness('yesterday', NOW), 'unknown')
  })

  it('is unknown rather than fresh for a timestamp in the future', () => {
    // Clock skew. "Observed in four minutes" destroys confidence in every other figure shown.
    const future = new Date(NOW.getTime() + 10 * 60_000).toISOString()
    assert.equal(staleness(future, NOW), 'unknown')
  })

  it('tolerates a minute of skew rather than crying wolf on every reader’s clock', () => {
    const barelyAhead = new Date(NOW.getTime() + 30_000).toISOString()
    assert.equal(staleness(barelyAhead, NOW), 'fresh')
  })
})

describe('the absolute stamp is UTC, always', () => {
  it('formats in a fixed locale and time zone', () => {
    assert.equal(absoluteStamp('2026-07-31T09:00:00.000Z'), '31 Jul 2026, 09:00 UTC')
  })

  it('does not shift with the machine’s zone', () => {
    // The same instant expressed with an offset must render identically.
    assert.equal(
      absoluteStamp('2026-07-31T09:00:00.000Z'),
      absoluteStamp(new Date('2026-07-31T11:00:00.000+02:00').toISOString()),
    )
  })

  it('is null for a null and for rubbish', () => {
    assert.equal(absoluteStamp(null), null)
    assert.equal(absoluteStamp('not a date'), null)
  })
})

describe('relative age is in whole units', () => {
  it('says "just now" under a minute rather than "0 minutes ago"', () => {
    assert.equal(relativeAge(ago(0), NOW), 'just now')
    assert.equal(relativeAge(ago(59_000), NOW), 'just now')
  })

  it('counts minutes, hours and days, singular and plural', () => {
    assert.equal(relativeAge(ago(60_000), NOW), '1 minute ago')
    assert.equal(relativeAge(ago(4 * 60_000), NOW), '4 minutes ago')
    assert.equal(relativeAge(ago(60 * 60_000), NOW), '1 hour ago')
    assert.equal(relativeAge(ago(5 * 60 * 60_000), NOW), '5 hours ago')
    assert.equal(relativeAge(ago(24 * 60 * 60_000), NOW), '1 day ago')
    assert.equal(relativeAge(ago(3 * 24 * 60 * 60_000), NOW), '3 days ago')
  })

  it('never prints a decimal', () => {
    for (const ms of [90_000, 5_400_000, 100_000_000]) {
      const text = relativeAge(ago(ms), NOW)
      assert.ok(text)
      assert.equal(/\d\.\d/.test(text), false, `"${text}" carries a precision it does not have`)
    }
  })

  it('is null for a future instant and for rubbish', () => {
    assert.equal(relativeAge(new Date(NOW.getTime() + 600_000).toISOString(), NOW), null)
    assert.equal(relativeAge('soon', NOW), null)
    assert.equal(relativeAge(null, NOW), null)
  })
})

describe('the sentence a figure carries', () => {
  it('is both the absolute moment and how long ago it was', () => {
    assert.equal(observedSentence(ago(4 * 60_000), NOW), '31 Jul 2026, 08:56 UTC (4 minutes ago)')
  })

  it('falls back to the absolute alone when the relative form is not meaningful', () => {
    const future = new Date(NOW.getTime() + 600_000).toISOString()
    assert.equal(observedSentence(future, NOW), '31 Jul 2026, 09:10 UTC')
  })

  it('is null when there is no observation time, so the caller must say so in words', () => {
    assert.equal(observedSentence(null, NOW), null)
    assert.equal(observedSentence('nonsense', NOW), null)
  })
})

describe('day labels are UTC', () => {
  it('labels a day without shifting it into the reader’s zone', () => {
    assert.equal(dayLabel('2026-07-31'), '31 Jul')
    assert.equal(dayLabel('2026-01-01'), '01 Jan')
  })

  it('is null for a malformed day', () => {
    assert.equal(dayLabel('31-07-2026'), null)
  })
})
