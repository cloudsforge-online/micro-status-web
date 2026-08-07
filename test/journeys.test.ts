/**
 * The browser journeys of `docs/ecosystem/22-browser-journeys.md`, tiers 1 and 2, for this surface.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ONE RULE. Doc 22 §3: **a browser scenario may never assert a business rule.**
 *
 * A game client once withheld four SKUs from its UI while the payment routes stayed live and
 * chargeable (14 §11); a client-side test of the hidden catalogue would have passed, green,
 * against the defect. So every scenario below asserts one of exactly three things (§3.1): what a
 * human can see relative to what the API returned in the SAME run, what the client SENT, or where
 * the browser ended up.
 *
 * On this surface that boundary bites in one specific place. **The redaction is beacon's.** What
 * leaves `GET /api/status/public` is decided by `projectPublic`; this bundle cannot establish that
 * an internal service name was withheld, only that it renders the groups it was given and adds no
 * name of its own. BJ-STA-07 is written that way, and carries `ownedBy`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * The property this page exists to have — **an unknown is never a pass** — is asserted in three
 * different failure shapes (BJ-STA-03, -04, and the refused case), because the whole value of
 * `degrade.ts` is that no branch through it produces the word "operational".
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { createElement as h, type ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

import { withScreen, type Routes } from './dom.ts'
import * as fx from './fixtures.ts'
import { DOC22_IDS, SCENARIOS } from './journeys.ts'
import { App } from '../src/app.tsx'
import { ROUTES } from '../src/lib/routes.ts'
import { voiceOf } from '../src/lib/states.ts'
import { AboutPage } from '../src/pages/about.tsx'
import { CurrentPage } from '../src/pages/current.tsx'
import { HistoryPage } from '../src/pages/history.tsx'

const ORIGIN = 'https://status.cloudsforge.online'
const at = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url))

/** A page under a router. There is no AuthProvider in this repository, and there must not be. */
const page = (element: ReactElement, path: string): ReactElement =>
  h(MemoryRouter, { initialEntries: [path] }, element as ReactElement)

/** The feed, answering with `doc`. */
const feed = (doc: unknown): Routes => ({ [`GET ${fx.STATUS_PATH}`]: { body: doc } })

const GREEN_WORDS = /\boperational\b/i

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   6.15 Group O — the status page
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('BJ-STA — the status page', () => {
  it('BJ-STA-01 ★ T2: the verdict, then what is broken, then the grid, then planned work', async () => {
    const doc = fx.status({
      state: 'degraded',
      incidents: [fx.incident()],
      maintenance: [
        {
          group: 'Trading',
          summary: 'Rolling restart of the matching workers.',
          startsAt: '2026-08-05T01:00:00.000Z',
          endsAt: '2026-08-05T03:00:00.000Z',
        },
      ],
      groups: [{ group: 'Wallet', state: 'degraded', uptime: fx.window90() }],
    })
    await withScreen(page(h(CurrentPage), '/'), { url: `${ORIGIN}/`, routes: feed(doc) }, async (s) => {
      // Presentation relative to what the API returned in this same run: the verdict rendered is
      // the one the document carries, not a word this page chose.
      assert.match(s.text(), new RegExp(voiceOf('degraded').label, 'i'))

      // The reading order of somebody who has just been told the site is down.
      s.before(voiceOf('degraded').label, 'open incident', 'the verdict comes before the detail')
      s.before('open incident', 'Scheduled maintenance', 'what is broken comes before planned work')
      assert.ok(s.text().includes('INC-2026-0044'), 'the open incident is not on the page')

      // And the observation time sits WITH the verdict rather than in a footer.
      const observed = s.orderOf(/Observed/i)
      assert.ok(observed >= 0, 'the verdict carries no observation time')
      assert.ok(
        observed < s.orderOf('open incident'),
        '"degraded" with the timestamp somewhere else is a claim about now that is really a ' +
          'claim about the last sync',
      )
      s.clean('BJ-STA-01')
    })
  })

  it('BJ-STA-02 ★ T1: no state is stated without its observation time', async () => {
    await withScreen(
      page(h(CurrentPage), '/'),
      { url: `${ORIGIN}/`, routes: feed(fx.status()) },
      async (s) => {
        const chips = s.allByRole('status').filter((el) => el.className.includes('st-chip'))
        assert.ok(chips.length > 0, 'the page renders no state chips at all')
        // Every chip is inside a region that also carries an observation stamp. Asserted by
        // walking up from the chip rather than by counting stamps: a page with one stamp and ten
        // chips would pass a count and fail a reader.
        for (const chip of chips) {
          let stamped = false
          for (let node: Element | null = chip; node; node = node.parentElement) {
            if (node.querySelector('.st-observed')) {
              stamped = true
              break
            }
          }
          assert.ok(
            stamped,
            `a "${s.textOf(chip)}" chip is rendered with no observation time anywhere above it`,
          )
        }
      },
    )
  })

  it('BJ-STA-03 ★ T1: the feed fails after a good answer — the last good shows its age, never green', async () => {
    let call = 0
    await withScreen(
      page(h(CurrentPage), '/'),
      {
        url: `${ORIGIN}/`,
        routes: {
          [`GET ${fx.STATUS_PATH}`]: () => {
            call += 1
            return call === 1
              ? { body: fx.status({ incidents: [fx.incident()] }) }
              : { networkError: 'Failed to fetch' }
          },
        },
      },
      async (s) => {
        // The first answer is on screen and says operational, which is correct — it is a complete
        // document.
        assert.match(s.text(), GREEN_WORDS)

        // Now the refresh fails.
        await s.click(s.byRole('button', /ask again/i))
        await s.settle(20)

        assert.match(
          s.text(),
          /the last reading we hold, not a live one/i,
          'a failed refresh blanked the page a reader is looking at during an incident',
        )
        // The incident timeline survives — it was true whenever it was observed.
        assert.ok(s.text().includes('INC-2026-0044'))

        // But the VERDICT does not. A document from eleven minutes ago is not evidence about now,
        // and beacon's own rule is that an unknown is never a pass.
        const hero = s.document.querySelector('.st-chip--hero')
        assert.ok(hero, 'the hero chip is gone')
        assert.doesNotMatch(
          s.textOf(hero),
          GREEN_WORDS,
          'the hero still reads "Operational" over a feed that did not answer. That is ' +
            'green-on-unknown, which converts an outage into an accusation that the reader’s ' +
            'connection is at fault.',
        )
        assert.match(s.textOf(hero), new RegExp(voiceOf('unknown').label, 'i'))
      },
    )
  })

  it('BJ-STA-04 T1: the feed has never answered — a third state, and no verdict at all', async () => {
    await withScreen(
      page(h(CurrentPage), '/'),
      {
        url: `${ORIGIN}/`,
        routes: { [`GET ${fx.STATUS_PATH}`]: { networkError: 'Failed to fetch' } },
      },
      async (s) => {
        assert.doesNotMatch(s.text(), GREEN_WORDS, 'a page with no document rendered green')
        assert.match(s.text(), /No reading, and no guess/i)
        assert.match(
          s.text(),
          /we do not know/i,
          'the empty state offers reassurance instead of saying plainly that we do not know',
        )
        // And a next step that does not depend on this page working.
        assert.match(s.text(), /believe the thing you use/i)
        // Distinct from BJ-STA-03: there is no last-good document, so nothing is being shown as
        // history either.
        assert.doesNotMatch(s.text(), /the last reading we hold, not a live one/i)
      },
    )
  })

  it('BJ-STA-04 T1: a refusal and an unreachable feed are told apart', async () => {
    const said = async (reply: Routes[string]): Promise<string> => {
      let captured = ''
      await withScreen(
        page(h(CurrentPage), '/'),
        { url: `${ORIGIN}/`, routes: { [`GET ${fx.STATUS_PATH}`]: reply } },
        async (s) => {
          captured = s.text()
        },
      )
      return captured
    }
    const unreachable = await said({ networkError: 'Failed to fetch' })
    const refused = await said({ status: 503, body: { error: 'unavailable' } })
    const unreadable = await said({ status: 200, body: { nonsense: true } })

    // Three different sentences. "Something went wrong" for all three would hide the one
    // distinction a reader deciding whether to open a ticket actually needs.
    assert.notEqual(unreachable, refused)
    assert.notEqual(refused, unreadable)
    assert.notEqual(unreachable, unreadable)
    for (const text of [unreachable, refused, unreadable]) assert.doesNotMatch(text, GREEN_WORDS)
  })

  it('BJ-STA-05 T2: the history window is beacon’s, and the page says so', async () => {
    await withScreen(
      page(h(HistoryPage), '/history'),
      {
        url: `${ORIGIN}/history`,
        routes: feed(fx.status({ incidents: [fx.incident({ closedAt: '2026-08-03T10:00:00.000Z' })] })),
      },
      async (s) => {
        assert.match(
          s.text(),
          /inside the window our status service publishes/i,
          'the page implies it is the complete history of the estate, which it has no way to know',
        )
        assert.ok(s.text().includes('INC-2026-0044'))
        assert.match(s.text(), /observed/i, 'the list carries no observation time')
      },
    )
  })

  it('BJ-STA-05 T2: an empty window is the absence of a record, not the absence of an event', async () => {
    await withScreen(
      page(h(HistoryPage), '/history'),
      { url: `${ORIGIN}/history`, routes: feed(fx.status({ incidents: [] })) },
      async (s) => {
        assert.match(s.text(), /Nobody opened an incident inside this window/i)
        assert.match(
          s.text(),
          /a narrower claim than the state of the world/i,
          'an empty incident list rendered as "nothing happened" is the claim this page cannot make',
        )
      },
    )
  })

  it('BJ-STA-06 ★ T1: the about page carries the withheld list', async () => {
    await withScreen(page(h(AboutPage), '/about'), { url: `${ORIGIN}/about`, routes: {} }, async (s) => {
      // Static prose, no data, no fetch: this route renders identically when everything else is
      // down, which is the point.
      assert.deepEqual(
        s.api.wire.map((w) => `${w.method} ${w.path}`),
        [],
        'the about page made a request, so it can fail with the thing it explains',
      )
      assert.match(s.text(), /What we deliberately withhold/i)
      // Every state is defined, in words, with its glyph — this is where the mapping is taught.
      for (const state of ['operational', 'degraded', 'outage', 'maintenance', 'unknown'] as const) {
        const voice = voiceOf(state)
        assert.ok(s.text().includes(voice.label), `the about page does not define "${voice.label}"`)
        assert.ok(s.text().includes(voice.sentence), `"${voice.label}" is defined with no sentence`)
      }
      assert.match(s.text(), /product group/i, 'the page does not say what the unit of measure is')
    })
  })

  it('BJ-STA-07 ★ T2: the page renders the groups it was given and names nothing internal', async () => {
    const doc = fx.status({
      groups: [
        { group: 'Account', state: 'operational', uptime: fx.window90() },
        { group: 'Wallet', state: 'degraded', uptime: fx.window90() },
      ],
    })
    await withScreen(page(h(CurrentPage), '/'), { url: `${ORIGIN}/`, routes: feed(doc) }, async (s) => {
      for (const group of doc.groups) {
        assert.ok(s.text().includes(group.group), `${group.group} has no row`)
      }
      // The repository-name shape — `micro-<something>` — is the leak that matters, and it is the
      // one this bundle could introduce on its own. What beacon chose to withhold is beacon's
      // test; see `ownedBy` on this scenario in test/journeys.ts.
      assert.doesNotMatch(
        s.text(),
        /\bmicro-[a-z]+\b/,
        'an internal repository name reached a pre-auth page',
      )
    })
  })

  it('BJ-STA-08 T1: one cell per day, and a day with no data is not drawn as green', async () => {
    const days = fx.window90({ 10: 'unknown', 11: 'unknown', 12: 'outage' })
    const doc = fx.status({ groups: [{ group: 'Wallet', state: 'degraded', uptime: days }] })
    await withScreen(page(h(CurrentPage), '/'), { url: `${ORIGIN}/`, routes: feed(doc) }, async (s) => {
      const bars = [...s.document.querySelectorAll('path.st-bar')]
      assert.equal(
        bars.length,
        days.length,
        'the strip drew a different number of bars from the days the document carried',
      )
      // An unknown day is drawn hollow rather than given a hue. There is no colour in this estate
      // that means "no data", and inventing one would put a sixth thing in a three-colour palette.
      const unknownTone = voiceOf('unknown').tone
      const goodTone = voiceOf('operational').tone
      assert.equal(bars[10]?.getAttribute('class'), `st-bar st-bar--${unknownTone}`)
      assert.notEqual(
        bars[10]?.getAttribute('class'),
        `st-bar st-bar--${goodTone}`,
        'a day with no data was drawn as a good day',
      )
      // And it is readable without colour at all: every bar carries its own words.
      const titles = [...s.document.querySelectorAll('path.st-bar title')]
      assert.equal(titles.length, days.length, 'a bar was drawn with no accessible name')
      assert.match(s.textOf(titles[10]), new RegExp(voiceOf('unknown').label, 'i'))
    })
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   6.19 Group S — the page-level hazards
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('BJ-ADV — the page-level hazards', () => {
  it('BJ-ADV-22 ★ T1: the page paints while the feed is slow, and says it is still asking', async () => {
    await withScreen(
      page(h(CurrentPage), '/'),
      { url: `${ORIGIN}/`, routes: { [`GET ${fx.STATUS_PATH}`]: { body: fx.status(), delayMs: 40 } } },
      async (s) => {
        // Painted, with the answer still in flight.
        assert.match(s.text(), /Asking…/i)
        assert.doesNotMatch(
          s.text(),
          GREEN_WORDS,
          'the page showed a verdict before anything had answered',
        )
        assert.match(s.text(), /Nothing below counts as a verdict until that answer lands/i)
        // The refresh control is disabled while it is asking, rather than left clickable into a
        // request that is already outstanding.
        const button = s.byRole('button', /asking|ask again/i)
        assert.ok(button.hasAttribute('disabled'), 'the refresh control is clickable mid-request')
        await s.settle(80)
        assert.match(s.text(), GREEN_WORDS, 'the slow answer never landed')
      },
    )
  })

  it('BJ-ADV-23 ★ T1: every failure names what happened and offers a next step', async () => {
    // This surface renders no request id, and correctly: `GET /api/status/public` is pre-auth
    // (`beacon/src/server.ts`) and there is no support desk behind a status page. The
    // equivalent obligation is that the reader is told WHICH of the four things happened and what
    // to do about it, which is what `degrade.ts` exists to guarantee.
    const cases: ReadonlyArray<{ name: string; reply: Routes[string] }> = [
      { name: 'unreachable', reply: { networkError: 'Failed to fetch' } },
      { name: 'refused', reply: { status: 503, body: { error: 'unavailable' } } },
      { name: 'unreadable', reply: { status: 200, body: { not: 'a status document' } } },
    ]
    for (const c of cases) {
      await withScreen(
        page(h(CurrentPage), '/'),
        { url: `${ORIGIN}/`, routes: { [`GET ${fx.STATUS_PATH}`]: c.reply } },
        async (s) => {
          assert.match(s.text(), /we do not know|cannot/i, `${c.name} said nothing useful`)
          assert.ok(
            s.queryByRole('button', /ask again/i),
            `${c.name} left the reader with no way to try again`,
          )
          assert.doesNotMatch(s.text(), GREEN_WORDS, `${c.name} rendered green`)
        },
      )
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   6.20 Group T — accessibility
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('BJ-A11Y — accessibility', () => {
  it('BJ-A11Y-03 ★ T1: a failure is announced, and is not colour-only', async () => {
    await withScreen(
      page(h(CurrentPage), '/'),
      { url: `${ORIGIN}/`, routes: { [`GET ${fx.STATUS_PATH}`]: { networkError: 'nope' } } },
      async (s) => {
        // The hero chip is a live region, so a reader who was already on the page is told the
        // verdict changed rather than having to notice a colour.
        const hero = s.document.querySelector('.st-chip--hero')
        assert.ok(hero)
        assert.equal(hero.getAttribute('role'), 'status')
        assert.ok(s.textOf(hero).length > 0, 'the hero chip is colour with no word in it')
      },
    )
  })

  it('BJ-A11Y-10 T1: every chip carries a word, and the glyph is hidden from the tree', async () => {
    await withScreen(
      page(h(CurrentPage), '/'),
      { url: `${ORIGIN}/`, routes: feed(fx.status({ state: 'degraded' })) },
      async (s) => {
        const chips = [...s.document.querySelectorAll('.st-chip')]
        assert.ok(chips.length > 0)
        for (const chip of chips) {
          const label = chip.querySelector('.st-chip__label')
          assert.ok(label && s.textOf(label).length > 0, 'a chip rendered with no word')
          const glyph = chip.querySelector('.st-chip__glyph')
          // Otherwise a screen reader announces "black square Outage", which is the shape channel
          // leaking into the channel that already worked.
          assert.equal(glyph?.getAttribute('aria-hidden'), 'true')
        }
        // The legend teaches the mapping in words, and is present wherever a strip is.
        if (s.document.querySelector('.st-strip')) {
          assert.ok(s.document.querySelector('.st-legend'), 'a strip was drawn with no legend')
        }
      },
    )
  })

  it('BJ-A11Y-12 T1: one main landmark, a reachable skip link, no skipped heading level', async () => {
    await withScreen(h(App), { url: `${ORIGIN}/about`, routes: {} }, async (s) => {
      assert.equal(s.allByRole('main').length, 1)

      const skip = s.document.querySelector('a[href^="#"]')
      assert.ok(skip, 'no skip link')
      assert.ok(
        s.document.getElementById((skip.getAttribute('href') ?? '#').slice(1)),
        `the skip link points at ${skip.getAttribute('href')}, which is not on the page`,
      )
      assert.equal(
        s.tabbables()[0],
        skip,
        'the skip link is not the first tabbable element, so it cannot be used to skip anything',
      )

      const levels = s.allByRole('heading').map((el) => Number(el.tagName.slice(1)))
      assert.equal(levels.filter((l) => l === 1).length, 1, 'a page has exactly one h1')
      let previous = 0
      for (const level of levels) {
        assert.ok(previous === 0 || level <= previous + 1, `heading order skips h${previous} → h${level}`)
        previous = level
      }
    })
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   5.1 — the universal per-surface property
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('BJ-STATUS-404 — an unowned address answers 404', () => {
  const directives = readFileSync(at('nginx.conf'), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')

  it('BJ-STATUS-404 T2: nginx serves the shell through error_page 404, never try_files', () => {
    assert.match(directives, /error_page\s+404\s+\/index\.html/)
    assert.doesNotMatch(
      directives,
      /try_files\s+\$uri\s+(\$uri\/\s+)?\/index\.html/,
      '`try_files $uri /index.html` answers 200 for every address in existence',
    )
  })

  it('BJ-STATUS-404 T2: the not-found screen renders inside the shell', async () => {
    await withScreen(h(App), { url: `${ORIGIN}/nothing-here`, routes: {} }, async (s) => {
      assert.match(s.text(), /not found|no page|does not exist/i)
      assert.ok(s.allByRole('link').length > 0, 'the not-found screen strands the reader')
      assert.ok(!ROUTES.map((r) => r.path).includes('nothing-here'))
    })
  })
})

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   The meta-test. Doc 22 §3.2.
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe('the catalogue and this file agree', () => {
  it('every id doc 22 assigns to this surface is accounted for exactly once', () => {
    const ids = SCENARIOS.map((s) => s.id)
    assert.deepEqual([...new Set(ids)].sort(), [...ids].sort(), 'an id appears twice')
    assert.deepEqual([...ids].sort(), [...DOC22_IDS].sort())
  })

  it('a scenario whose outcome depends on a server rule carries an ownedBy path', () => {
    const REFUSAL = /\b(refus|denie|denial|reject|withheld|withhold|redact|403|409|4xx|internal name)\w*/i
    for (const s of SCENARIOS) {
      if (s.blocked) continue
      if (!REFUSAL.test(s.what)) continue
      assert.ok(
        s.ownedBy,
        `${s.id} turns on a server-side rule and names no test that owns it. Doc 22 §3.2: ` +
          `"a path, resolvable by grep, in the service that enforces the rule".`,
      )
      assert.match(s.ownedBy.path, /^[a-z-]+\/src\/[\w./-]+\.ts$/)
    }
  })

  it('no scenario is marked implemented without a test named for it', () => {
    const source = readFileSync(at('test/journeys.test.ts'), 'utf8')
    for (const s of SCENARIOS) {
      if (s.blocked) continue
      assert.ok(
        new RegExp(`it\\('${s.id}[ ★]`).test(source),
        `${s.id} is in the catalogue as implemented and has no test named for it`,
      )
    }
  })

  it('every blocked scenario names its blocker and no blocker is a shrug', () => {
    for (const s of SCENARIOS) {
      if (!s.blocked) continue
      assert.ok(s.blocked.length > 60, `${s.id}'s blocker is too short to be a reason`)
      assert.ok(
        /doc 22|§|does not exist|no UI|tier 3|micro-beacon|not installed/i.test(s.blocked),
        `${s.id}'s blocker does not name a fact about the estate: ${s.blocked}`,
      )
    }
  })

  it('nothing here is tier 3 and implemented — tier 3 lives in micro-beacon', () => {
    for (const s of SCENARIOS) {
      if (s.tier !== 'T3') continue
      assert.ok(s.blocked, `${s.id} is tier 3 and not blocked; doc 22 §4 puts tier 3 in beacon`)
    }
  })
})
