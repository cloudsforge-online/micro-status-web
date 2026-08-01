/**
 * THE DEGRADATION BRANCHES.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * Green on unknown is the worst failure a status page can have, so the test for it is written the
 * strong way: rather than checking a handful of failures, `pageState` is driven through EVERY
 * failure outcome and the assertion is universal — none of them may produce `operational`, and
 * none of them may produce a headline that reads like reassurance.
 *
 * The opposite direction is tested too, because a page that says "we cannot determine status" for
 * a perfectly good document is broken in the other direction and would be discovered much later.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { StatusOutcome } from '../src/lib/beacon.ts'
import { pageState } from '../src/lib/degrade.ts'
import { parseStatus, type PublicStatus } from '../src/lib/publicstatus.ts'

function healthy(): PublicStatus {
  const doc = parseStatus({
    generatedAt: '2026-07-31T09:00:00.000Z',
    state: 'operational',
    groups: [
      { group: 'Wallet', state: 'operational', uptime: [] },
      { group: 'Trading', state: 'operational', uptime: [] },
    ],
    incidents: [],
    maintenance: [],
  })
  assert.ok(doc)
  return doc
}

/** Every non-ok outcome `fetchPublicStatus` can return. */
const FAILURES: readonly Exclude<StatusOutcome, { kind: 'ok' }>[] = [
  { kind: 'unreachable', detail: 'the request timed out' },
  { kind: 'unreachable', detail: 'the request could not be made' },
  { kind: 'refused', status: 401, requestId: 'req-1' },
  { kind: 'refused', status: 403, requestId: null },
  { kind: 'refused', status: 500, requestId: 'req-2' },
  { kind: 'refused', status: 503, requestId: null },
  { kind: 'unreadable', detail: 'the response was not JSON' },
  { kind: 'unreadable', detail: 'the document carried no readable observation time' },
]

/**
 * Fail unless every mention of health in `copy` sits behind a negation.
 *
 * Looks back thirty characters from each occurrence for a "not", "never", "cannot" or "no". Crude,
 * and crude is right: the rule it enforces is that this page never states health it has not
 * established, and a sentence too convoluted for this check to read is a sentence too convoluted
 * for somebody reading it during an outage.
 */
function assertHealthOnlyNegated(copy: string, label: string): void {
  const text = copy.toLowerCase()
  for (let at = text.indexOf('healthy'); at !== -1; at = text.indexOf('healthy', at + 1)) {
    const lead = text.slice(Math.max(0, at - 30), at)
    assert.ok(
      /\b(not|never|cannot|no)\b/.test(lead),
      `the ${label} copy asserts health: "…${text.slice(Math.max(0, at - 30), at + 8)}"`,
    )
  }
}

describe('no failure branch can produce green', () => {
  it('every failure outcome yields unknown, with no document', () => {
    for (const outcome of FAILURES) {
      const page = pageState(outcome, null, null)
      assert.equal(page.state, 'unknown', `${outcome.kind} produced ${page.state}`)
      assert.equal(page.document, null)
      assert.equal(page.headline, 'We cannot currently determine status.')
    }
  })

  it('every failure outcome yields unknown even when a last-good document is held', () => {
    // The one that would be easy to get wrong: a cached healthy document is still a document
    // about the PAST, and the verdict chip must not inherit its green.
    for (const outcome of FAILURES) {
      const page = pageState(outcome, healthy(), '2026-07-31T09:00:00.000Z')
      assert.equal(page.state, 'unknown', `${outcome.kind} with last-good produced ${page.state}`)
      assert.equal(page.showingLastGood, true)
      assert.ok(page.document)
    }
  })

  it('no failure copy contains a phrase that asserts health', () => {
    // Deliberately blunt. It fails the day somebody softens the copy into "everything looks fine,
    // we just could not check" — which is the same lie in a kinder voice.
    const forbidden = ['operational', 'all systems', 'no issues', 'everything is fine', 'working normally']
    for (const outcome of FAILURES) {
      for (const withLastGood of [null, healthy()]) {
        const page = pageState(outcome, withLastGood, '2026-07-31T09:00:00.000Z')
        const copy = `${page.headline} ${page.detail}`.toLowerCase()
        for (const word of forbidden) {
          assert.equal(copy.includes(word), false, `"${word}" appeared in the ${outcome.kind} copy`)
        }
      }
    }
  })

  it('mentions health only under a negation, never as an assertion', () => {
    // "healthy" cannot go on the blunt list above, because the most careful sentence in the
    // failure copy is "it is not a statement that anything else is healthy" — a NEGATED mention,
    // which is the opposite of the failure being guarded against. So the rule is sharper: the
    // word may appear, and only ever behind a negation.
    for (const outcome of FAILURES) {
      const page = pageState(outcome, null, null)
      assertHealthOnlyNegated(`${page.headline} ${page.detail}`, outcome.kind)
    }
  })

  it('and that negation check would itself catch an affirmative claim', () => {
    // The direction that proves the assertion above can fail. Without this, a detector that never
    // matched anything would pass the test above for ever.
    assert.throws(() => assertHealthOnlyNegated('Everything else is healthy.', 'synthetic'))
    assert.doesNotThrow(() => assertHealthOnlyNegated('This is not a claim that it is healthy.', 'synthetic'))
  })

  it('says which failure it was, because the four are not the same thing to a reader', () => {
    assert.match(pageState(FAILURES[0]!, null, null).detail, /could not reach/i)
    assert.match(pageState(FAILURES[2]!, null, null).detail, /HTTP 401/)
    assert.match(pageState(FAILURES[2]!, null, null).detail, /req-1/)
    assert.match(pageState(FAILURES[6]!, null, null).detail, /could not read/i)
  })

  it('the pre-first-answer state is unknown and says nothing is a verdict yet', () => {
    const page = pageState(null, null, null)
    assert.equal(page.state, 'unknown')
    assert.equal(page.document, null)
    assert.equal(page.asOf, null)
    assert.match(page.detail, /verdict until it answers/i)
  })
})

describe('a good document is not treated as a failure', () => {
  it('reports operational, with the observation time, for a complete healthy document', () => {
    const page = pageState({ kind: 'ok', status: healthy(), receivedAt: '2026-07-31T09:00:01.000Z' }, null, null)
    assert.equal(page.state, 'operational')
    assert.equal(page.headline, 'All systems operational')
    assert.equal(page.asOf, '2026-07-31T09:00:00.000Z')
    assert.equal(page.showingLastGood, false)
    assert.ok(page.document)
  })

  it('never reports operational without an observation time', () => {
    // Structural: `asOf` is `doc.generatedAt`, and a document without a readable one never parses.
    const page = pageState({ kind: 'ok', status: healthy(), receivedAt: 'x' }, null, null)
    assert.equal(page.state === 'operational' && page.asOf === null, false)
    assert.ok(page.asOf)
  })

  it('names the outage rather than hiding behind unknown', () => {
    const doc = parseStatus({
      generatedAt: '2026-07-31T09:00:00.000Z',
      state: 'outage',
      groups: [{ group: 'Wallet', state: 'outage', uptime: [] }],
      incidents: [],
      maintenance: [],
    })
    assert.ok(doc)
    const page = pageState({ kind: 'ok', status: doc, receivedAt: 'x' }, null, null)
    assert.equal(page.state, 'outage')
    assert.equal(page.headline, 'Active outage')
  })

  it('reports degraded and maintenance with their own headlines', () => {
    for (const [state, headline] of [
      ['degraded', 'Some systems degraded'],
      ['maintenance', 'Planned maintenance in progress'],
    ] as const) {
      const doc = parseStatus({
        generatedAt: '2026-07-31T09:00:00.000Z',
        state,
        groups: [{ group: 'Wallet', state, uptime: [] }],
        incidents: [],
        maintenance: [],
      })
      assert.ok(doc)
      assert.equal(pageState({ kind: 'ok', status: doc, receivedAt: 'x' }, null, null).headline, headline)
    }
  })

  it('an ok answer that was partly unreadable reports unknown and says how many entries went', () => {
    const doc = parseStatus({
      generatedAt: '2026-07-31T09:00:00.000Z',
      state: 'operational',
      groups: [
        { group: 'Wallet', state: 'operational', uptime: [] },
        { group: 'pay.rates', state: 'operational', uptime: [] },
      ],
      incidents: [],
      maintenance: [],
    })
    assert.ok(doc)
    const page = pageState({ kind: 'ok', status: doc, receivedAt: 'x' }, null, null)
    assert.equal(page.state, 'unknown')
    assert.match(page.detail, /1 entry refused/)
    // The document is still rendered — the reader keeps the group that DID parse.
    assert.ok(page.document)
  })
})
