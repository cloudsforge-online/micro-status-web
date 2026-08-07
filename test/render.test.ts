/**
 * THE RENDER LAYER ITSELF.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * `publicstatus.test.ts` proves the PARSER drops everything it was not told to keep. This file
 * proves the thing that actually matters to a reader: the HTML that leaves these components
 * contains none of it either.
 *
 * The two are not the same assertion. A component could reach past the parsed object — read a
 * field off a raw response it was handed, interpolate a debug value, print an error object — and
 * every parser test would still be green. So the document is parsed, rendered to static markup,
 * and the markup is searched for the internal values.
 *
 * `react-dom/server` is used rather than a DOM emulator. It is part of a dependency this app
 * already ships, it needs no jsdom (a second browser implementation to keep current) and no React
 * Testing Library, and it produces exactly the artefact under test: the string of HTML. The
 * components are constructed with `createElement` rather than JSX so this stays a `.ts` file that
 * the estate's plain `node --import tsx --test test/*.test.ts` runner picks up unchanged.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AboutPage } from '../src/pages/about.tsx'
import { CurrentPage } from '../src/pages/current.tsx'
import { HistoryPage } from '../src/pages/history.tsx'
import { NotFoundPage } from '../src/pages/not-found.tsx'
import { IncidentCard } from '../src/components/incidents.tsx'
import { Observed } from '../src/components/observed.tsx'
import { StateChip, StateLegend } from '../src/components/state.tsx'
import { UptimeStrip } from '../src/components/uptime.tsx'
import { parseStatus, type CellState } from '../src/lib/publicstatus.ts'
import { buildWindow } from '../src/lib/uptime.ts'

const NOW = new Date('2026-07-31T09:00:00.000Z')

/** The strings that must never appear in any markup this app produces. */
const INTERNAL = [
  'pay.rates',
  'hearth.seed',
  'ECONNREFUSED 10.4.2.19:5432',
  'postgres primary lost quorum',
  'ledger-postings-primary',
  'user_01HZX9Q2',
  'a deposit credits within one block',
]

/** A contaminated document: every internal field bolted onto every level. */
function contaminated(): Record<string, unknown> {
  const extras = {
    subject: 'pay.rates',
    otherSubject: 'hearth.seed',
    lastError: 'ECONNREFUSED 10.4.2.19:5432',
    cause: 'postgres primary lost quorum',
    target: 'ledger-postings-primary',
    customer: 'user_01HZX9Q2',
    proves: 'a deposit credits within one block',
  }
  return {
    ...extras,
    generatedAt: '2026-07-31T09:00:00.000Z',
    state: 'outage',
    groups: [
      {
        ...extras,
        group: 'Wallet',
        state: 'outage',
        uptime: [
          { ...extras, date: '2026-07-30', state: 'degraded' },
          { ...extras, date: '2026-07-31', state: 'outage' },
        ],
      },
    ],
    incidents: [
      {
        ...extras,
        reference: '4c1f8b2a-0000-4000-8000-000000000001',
        group: 'Wallet',
        severity: 'sev1',
        state: 'identified',
        openedAt: '2026-07-31T08:30:00.000Z',
        closedAt: null,
        updates: [{ ...extras, at: '2026-07-31T08:45:00.000Z', body: 'Deposits are failing.' }],
      },
    ],
    maintenance: [
      {
        ...extras,
        group: 'Trading',
        summary: 'Routine database maintenance.',
        startsAt: '2026-08-02T01:00:00.000Z',
        endsAt: '2026-08-02T03:00:00.000Z',
      },
    ],
  }
}

function markupOfEverything(): string {
  const doc = parseStatus(contaminated())
  assert.ok(doc)
  const parts: string[] = []
  for (const group of doc.groups) {
    parts.push(renderToStaticMarkup(createElement(StateChip, { state: group.state })))
    parts.push(
      renderToStaticMarkup(
        createElement(UptimeStrip, {
          days: buildWindow(group.uptime, '2026-07-31'),
          group: group.group,
        }),
      ),
    )
  }
  for (const incident of doc.incidents) {
    parts.push(renderToStaticMarkup(createElement(IncidentCard, { incident, now: NOW })))
  }
  parts.push(renderToStaticMarkup(createElement(Observed, { at: doc.generatedAt, now: NOW })))
  return parts.join('\n')
}

describe('no internal value survives to the markup', () => {
  it('renders a contaminated document without any of the internal strings', () => {
    const markup = markupOfEverything()
    for (const value of INTERNAL) {
      assert.equal(markup.includes(value), false, `"${value}" reached the rendered HTML`)
    }
  })

  it('does render the values that are meant to be public', () => {
    // The direction that proves the search above can fail.
    const markup = markupOfEverything()
    assert.ok(markup.includes('Wallet'))
    assert.ok(markup.includes('Deposits are failing.'))
    assert.ok(markup.includes('SEV1'))
  })

  it('renders operator prose as TEXT, never as markup', () => {
    const doc = parseStatus({
      generatedAt: '2026-07-31T09:00:00.000Z',
      state: 'degraded',
      groups: [],
      incidents: [
        {
          reference: 'abc',
          group: 'Wallet',
          severity: 'sev3',
          state: 'monitoring',
          openedAt: '2026-07-31T08:30:00.000Z',
          closedAt: null,
          updates: [{ at: '2026-07-31T08:45:00.000Z', body: '<img src=x onerror=alert(1)>' }],
        },
      ],
      maintenance: [],
    })
    assert.ok(doc)
    const incident = doc.incidents[0]
    assert.ok(incident)
    const markup = renderToStaticMarkup(createElement(IncidentCard, { incident, now: NOW }))
    // The body is a human's paragraph, so it is shown. It is shown ESCAPED.
    assert.equal(markup.includes('<img src=x'), false)
    assert.ok(markup.includes('&lt;img src=x'))
  })
})

describe('every state renders its word, not only its colour', () => {
  it('names the state in the chip for all five', () => {
    for (const [state, word] of [
      ['operational', 'Operational'],
      ['degraded', 'Degraded'],
      ['outage', 'Outage'],
      ['maintenance', 'Maintenance'],
      ['unknown', 'Not determined'],
    ] as const) {
      const markup = renderToStaticMarkup(createElement(StateChip, { state: state as CellState }))
      assert.ok(markup.includes(word), `the ${state} chip did not print "${word}"`)
    }
  })

  it('hides the glyph from assistive technology so it is not announced twice', () => {
    const markup = renderToStaticMarkup(createElement(StateChip, { state: 'outage' }))
    assert.match(markup, /aria-hidden="true"/)
  })

  it('prints every state word in the legend', () => {
    const markup = renderToStaticMarkup(createElement(StateLegend, {}))
    for (const word of ['Operational', 'Maintenance', 'Degraded', 'Outage', 'Not determined']) {
      assert.ok(markup.includes(word), `the legend omits "${word}"`)
    }
  })
})

describe('the strip draws ninety bars, and says what it does not know', () => {
  it('draws one path per day even when upstream sent two rows', () => {
    const doc = parseStatus(contaminated())
    assert.ok(doc)
    const group = doc.groups[0]
    assert.ok(group)
    const markup = renderToStaticMarkup(
      createElement(UptimeStrip, { days: buildWindow(group.uptime, '2026-07-31'), group: 'Wallet' }),
    )
    assert.equal((markup.match(/<path/g) ?? []).length, 90)
  })

  it('marks the eighty-eight days with no rollup as not measured, in words', () => {
    const doc = parseStatus(contaminated())
    assert.ok(doc)
    const group = doc.groups[0]
    assert.ok(group)
    const markup = renderToStaticMarkup(
      createElement(UptimeStrip, { days: buildWindow(group.uptime, '2026-07-31'), group: 'Wallet' }),
    )
    assert.ok(markup.includes('88 days we never measured'))
    // And the percentage is over the two measured days, neither of which was operational.
    assert.ok(markup.includes('0.0% of 2 measured days'))
  })

  it('never prints a percentage without its denominator', () => {
    const markup = renderToStaticMarkup(
      createElement(UptimeStrip, {
        days: buildWindow([{ date: '2026-07-31', state: 'operational' }], '2026-07-31'),
        group: 'Wallet',
      }),
    )
    const percents = markup.match(/\d+(\.\d)?%/g) ?? []
    for (const percent of percents) {
      const at = markup.indexOf(percent)
      assert.match(markup.slice(at, at + 40), /measured day/)
    }
  })
})

describe('an observation stamp is never silently absent', () => {
  it('prints the moment and how long ago it was', () => {
    const markup = renderToStaticMarkup(
      createElement(Observed, { at: '2026-07-31T08:56:00.000Z', now: NOW }),
    )
    assert.ok(markup.includes('31 Jul 2026, 08:56 UTC'))
    assert.ok(markup.includes('4 minutes ago'))
    // Case-insensitive: React 19 emits the attribute as `dateTime`, and HTML attribute names are
    // ASCII case-insensitive so the browser reads it as `datetime` either way. The property under
    // test is that the machine-readable instant is in the markup at all — a screen reader and a
    // scraper get the unambiguous form rather than the prose one.
    assert.match(markup, /datetime="2026-07-31T08:56:00\.000Z"/i)
  })

  it('says so in words when there is no observation time, rather than rendering nothing', () => {
    const markup = renderToStaticMarkup(createElement(Observed, { at: null, now: NOW }))
    assert.ok(markup.includes('No observation time'))
    assert.ok(markup.length > 40)
  })

  it('warns when the document is older than we expect', () => {
    const stale = new Date(NOW.getTime() - 20 * 60_000).toISOString()
    const markup = renderToStaticMarkup(createElement(Observed, { at: stale, now: NOW }))
    assert.ok(markup.includes('Older than our polling should ever leave it'))
  })

  it('says an hour-old document is history rather than status', () => {
    const ancient = new Date(NOW.getTime() - 3 * 60 * 60_000).toISOString()
    const markup = renderToStaticMarkup(createElement(Observed, { at: ancient, now: NOW }))
    assert.ok(markup.includes('Read it as a record of that moment'))
  })
})

describe('the whole page tree constructs, and its first paint is not green', () => {
  /**
   * The pages are rendered through the real router. `useStatus` runs its fetch in an effect, which
   * `renderToStaticMarkup` does not execute — so this is precisely the FIRST PAINT, before any
   * answer has arrived. That is the state a reader sees on a slow connection during an incident,
   * and the assertion is that it claims nothing.
   *
   * It also catches the class of failure no unit test can: a bad import, a hook called
   * conditionally, a component reading a field off undefined. Those throw here.
   */
  const page = (path: string): string =>
    renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(
          Routes,
          null,
          createElement(Route, { index: true, element: createElement(CurrentPage) }),
          createElement(Route, { path: 'history', element: createElement(HistoryPage) }),
          createElement(Route, { path: 'about', element: createElement(AboutPage) }),
          createElement(Route, { path: '*', element: createElement(NotFoundPage) }),
        ),
      ),
    )

  it('renders the current page before any answer, claiming nothing', () => {
    const markup = page('/')
    assert.ok(markup.includes('Asking our status service'))
    assert.ok(markup.includes('Not determined'))
    // The words that would be a lie at this moment.
    assert.equal(markup.includes('Nothing we watch is failing'), false)
    assert.equal(markup.includes('st-chip--good'), false)
  })

  it('renders the history page before any answer, with no history invented', () => {
    const markup = page('/history')
    assert.ok(markup.includes('Incident history'))
    assert.equal(markup.includes('st-chip--good'), false)
  })

  it('renders the methodology page with no data at all, which is the point of it', () => {
    // This route makes no request. It is the page that still works when Beacon is unreachable.
    const markup = page('/about')
    assert.ok(markup.includes('How we measure'))
    assert.ok(markup.includes('deliberately withhold'))
    assert.ok(markup.includes('Missing is missing'))
  })

  it('renders a real not-found page for an address it does not own', () => {
    const markup = page('/nope/not/a/route')
    assert.ok(markup.includes('Page not found'))
    // And it says explicitly that a 404 is not a statement about the estate's health.
    assert.ok(markup.includes('whether the estate is healthy'))
  })
})
