/**
 * THE LEAK TESTS.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * This page is the most externally visible surface in the estate and the only unauthenticated one
 * that shows internal health. The failure it must never have is a field it was never meant to
 * render reaching the render layer, and the estate has already had that failure once: the frozen
 * implementation's `redactStatus` emitted `t.name` (`stack/infra/beacon/server.js:255`) and
 * `incidents[].subject` (`:265-268`) — `pay.rates`, `hearth.seed` — which is internal topology.
 *
 * So the central test here does not check that the parser copies the right fields. It checks the
 * opposite, which is the property that actually matters: a document carrying EXTRA fields at every
 * level, including fields named after the exact ones that leaked last time, produces a parsed
 * object whose key set is unchanged and whose renderable strings contain none of them.
 *
 * That test fails if somebody adds a spread. It fails if somebody adds a field to the allowlist
 * without adding it to the interface (the compile-time `Exact<>` catches the reverse). And it
 * fails if an upstream change starts sending something new, which is the case a server-side
 * allowlist cannot cover because this bundle is cached and Beacon is not.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  parseStatus,
  readDay,
  readGroupLabel,
  readInstant,
  readReference,
  renderableStrings,
  seal,
  verdict,
  worst,
  PUBLIC_DAY_FIELDS,
  PUBLIC_GROUP_FIELDS,
  PUBLIC_INCIDENT_FIELDS,
  PUBLIC_MAINTENANCE_FIELDS,
  PUBLIC_STATUS_FIELDS,
  PUBLIC_UPDATE_FIELDS,
  type PublicIncident,
  type PublicStatus,
} from '../src/lib/publicstatus.ts'

/**
 * A well-formed document, exactly as `projectStatus` builds one
 * (`beacon/src/publicstatus.ts:358-371`). Every key here is in one of Beacon's allowlist tuples.
 */
function wellFormed(): Record<string, unknown> {
  return {
    generatedAt: '2026-07-31T09:00:00.000Z',
    state: 'degraded',
    groups: [
      {
        group: 'Wallet',
        state: 'degraded',
        uptime: [
          { date: '2026-07-30', state: 'operational' },
          { date: '2026-07-31', state: 'degraded' },
        ],
      },
      { group: 'Trading', state: 'operational', uptime: [] },
    ],
    incidents: [
      {
        reference: '4c1f8b2a-0000-4000-8000-000000000001',
        group: 'Wallet',
        severity: 'sev2',
        state: 'identified',
        openedAt: '2026-07-31T08:30:00.000Z',
        closedAt: null,
        updates: [{ at: '2026-07-31T08:45:00.000Z', body: 'We are investigating.' }],
      },
    ],
    maintenance: [
      {
        group: 'Trading',
        summary: 'Routine database maintenance.',
        startsAt: '2026-08-02T01:00:00.000Z',
        endsAt: '2026-08-02T03:00:00.000Z',
      },
    ],
  }
}

/**
 * The values that must never be renderable. Each is a real internal field on the INTERNAL record
 * (`beacon/src/incidents.ts:53-67`) or a real internal name from 13-operational-model.md:340.
 */
const INTERNAL = {
  subject: 'pay.rates',
  otherSubject: 'hearth.seed',
  lastError: 'ECONNREFUSED 10.4.2.19:5432',
  cause: 'postgres primary lost quorum',
  target: 'ledger-postings-primary',
  detectedBy: 'probe',
  scope: 'probe',
  customer: 'user_01HZX9Q2',
  proves: 'a deposit credits within one block',
  // Distinctive digits on purpose. A needle of `3` finds itself inside a timestamp, so a
  // short numeric value would make the search below pass or fail for the wrong reason.
  latencyMs: 419_233_871,
  replicas: 77_777_701,
}

describe('the parsed key set is exactly the allowlist', () => {
  it('produces the five documented status fields, plus this page own omission count', () => {
    const doc = parseStatus(wellFormed())
    assert.ok(doc)
    assert.deepEqual(Object.keys(doc).sort(), [...PUBLIC_STATUS_FIELDS].sort())
  })

  it('produces exactly the group, day, incident, update and maintenance fields', () => {
    const doc = parseStatus(wellFormed())
    assert.ok(doc)
    const group = doc.groups[0]
    assert.ok(group)
    assert.deepEqual(Object.keys(group).sort(), [...PUBLIC_GROUP_FIELDS].sort())
    const day = group.uptime[0]
    assert.ok(day)
    assert.deepEqual(Object.keys(day).sort(), [...PUBLIC_DAY_FIELDS].sort())
    const incident = doc.incidents[0]
    assert.ok(incident)
    assert.deepEqual(Object.keys(incident).sort(), [...PUBLIC_INCIDENT_FIELDS].sort())
    const update = incident.updates[0]
    assert.ok(update)
    assert.deepEqual(Object.keys(update).sort(), [...PUBLIC_UPDATE_FIELDS].sort())
    const window = doc.maintenance[0]
    assert.ok(window)
    assert.deepEqual(Object.keys(window).sort(), [...PUBLIC_MAINTENANCE_FIELDS].sort())
  })
})

describe('a field added upstream cannot reach the render layer', () => {
  /** The same document, with every internal field bolted onto every level. */
  function contaminated(): Record<string, unknown> {
    const base = wellFormed()
    const extras = { ...INTERNAL }
    const groups = (base['groups'] as Record<string, unknown>[]).map((group) => ({
      ...group,
      ...extras,
      uptime: (group['uptime'] as Record<string, unknown>[]).map((day) => ({ ...day, ...extras })),
    }))
    const incidents = (base['incidents'] as Record<string, unknown>[]).map((incident) => ({
      ...incident,
      ...extras,
      updates: (incident['updates'] as Record<string, unknown>[]).map((update) => ({
        ...update,
        ...extras,
      })),
    }))
    const maintenance = (base['maintenance'] as Record<string, unknown>[]).map((window) => ({
      ...window,
      ...extras,
    }))
    return { ...base, ...extras, groups, incidents, maintenance }
  }

  it('drops every unexpected key at every level', () => {
    const doc = parseStatus(contaminated())
    assert.ok(doc)
    assert.deepEqual(Object.keys(doc).sort(), [...PUBLIC_STATUS_FIELDS].sort())
    for (const group of doc.groups) {
      assert.deepEqual(Object.keys(group).sort(), [...PUBLIC_GROUP_FIELDS].sort())
      for (const day of group.uptime) {
        assert.deepEqual(Object.keys(day).sort(), [...PUBLIC_DAY_FIELDS].sort())
      }
    }
    for (const incident of doc.incidents) {
      assert.deepEqual(Object.keys(incident).sort(), [...PUBLIC_INCIDENT_FIELDS].sort())
      for (const update of incident.updates) {
        assert.deepEqual(Object.keys(update).sort(), [...PUBLIC_UPDATE_FIELDS].sort())
      }
    }
    for (const window of doc.maintenance) {
      assert.deepEqual(Object.keys(window).sort(), [...PUBLIC_MAINTENANCE_FIELDS].sort())
    }
  })

  it('renders none of the internal values, anywhere', () => {
    const doc = parseStatus(contaminated())
    assert.ok(doc)
    const strings = renderableStrings(doc)
    const haystack = `${strings.join('\u0000')}\u0000${JSON.stringify(doc)}`
    for (const [name, value] of Object.entries(INTERNAL)) {
      assert.equal(
        haystack.includes(String(value)),
        false,
        `the internal value for "${name}" (${String(value)}) reached the render layer`,
      )
    }
  })

  it('is a real test — the same haystack DOES contain the values that are meant to be public', () => {
    // The direction that proves the assertion above can fail. A search that finds nothing because
    // it searches nothing is the commonest way a redaction test passes while leaking.
    const doc = parseStatus(contaminated())
    assert.ok(doc)
    const haystack = renderableStrings(doc).join('\u0000')
    assert.ok(haystack.includes('Wallet'))
    assert.ok(haystack.includes('We are investigating.'))
    assert.ok(haystack.includes('Routine database maintenance.'))
  })

  it('a whole extra nested object upstream is not carried through', () => {
    const raw = wellFormed()
    raw['chain'] = { height: 918_233, peers: 12, mempool: 4 }
    raw['targets'] = [{ name: 'pay.rates', state: 'down' }]
    const doc = parseStatus(raw)
    assert.ok(doc)
    assert.equal('chain' in doc, false)
    assert.equal('targets' in doc, false)
    assert.equal(JSON.stringify(doc).includes('pay.rates'), false)
  })
})

describe('a group label that is internal topology is refused, not drawn', () => {
  it('refuses the two names the old implementation actually leaked', () => {
    assert.equal(readGroupLabel('pay.rates'), null)
    assert.equal(readGroupLabel('hearth.seed'), null)
  })

  it('refuses anything else shaped like a service name', () => {
    for (const value of [
      'ledger/postings',
      'ledger_postings',
      'ledger:postings',
      'svc.ledger.postings',
      '10.4.2.19',
      'https://ledger.internal',
      '  ',
      '',
      42,
      null,
      { group: 'Wallet' },
    ]) {
      assert.equal(readGroupLabel(value), null, `expected ${JSON.stringify(value)} to be refused`)
    }
  })

  it('accepts the seven product groups the operational model names', () => {
    // 13-operational-model.md:325 — Account · Wallet · Trading · Worlds · Network · Create · Market
    for (const value of ['Account', 'Wallet', 'Trading', 'Worlds', 'Network', 'Create', 'Market']) {
      assert.equal(readGroupLabel(value), value)
    }
  })

  it('accepts a plausible eighth group, so the rule is a shape and not a frozen list', () => {
    assert.equal(readGroupLabel('Developer Platform'), 'Developer Platform')
    assert.equal(readGroupLabel('Search & Discovery'), 'Search & Discovery')
  })

  it('counts the refusal instead of silently shrinking the grid', () => {
    const raw = wellFormed()
    raw['groups'] = [
      { group: 'Wallet', state: 'operational', uptime: [] },
      { group: 'pay.rates', state: 'outage', uptime: [] },
    ]
    const doc = parseStatus(raw)
    assert.ok(doc)
    assert.equal(doc.groups.length, 1)
    assert.equal(doc.omitted, 1)
    // And the omission is what makes the page unwilling to claim health — see verdict().
    assert.equal(verdict(doc).complete, false)
  })
})

describe('unrecognised values become null, never a default', () => {
  it('refuses the INTERNAL probe vocabulary rather than mapping it', () => {
    // `up`/`down`/`pending` are `beacon/src/probes.ts` words. Seeing one means something upstream
    // is serving the internal record, and guessing at it would publish a state nobody chose.
    for (const internal of ['up', 'down', 'pending']) {
      const raw = wellFormed()
      raw['groups'] = [{ group: 'Wallet', state: internal, uptime: [] }]
      const doc = parseStatus(raw)
      assert.ok(doc)
      assert.equal(doc.groups[0]?.state, 'unknown')
      assert.equal(doc.omitted, 1)
    }
  })

  it('refuses an internal incident lifecycle word', () => {
    const raw = wellFormed()
    const incidents = raw['incidents'] as Record<string, unknown>[]
    const first = incidents[0]
    assert.ok(first)
    first['state'] = 'mitigated'
    first['severity'] = 'sev9'
    const doc = parseStatus(raw)
    assert.ok(doc)
    assert.equal(doc.incidents[0]?.state, null)
    assert.equal(doc.incidents[0]?.severity, null)
  })

  it('refuses a reference that is not opaque', () => {
    assert.equal(readReference('4c1f8b2a-0000-4000-8000-000000000001'), '4c1f8b2a-0000-4000-8000-000000000001')
    assert.equal(readReference('pay.rates'), null)
    assert.equal(readReference('Wallet deposits are failing'), null)
    assert.equal(readReference(''), null)
    assert.equal(readReference('a'.repeat(65)), null)
  })

  it('refuses a non-canonical instant and a non-ISO day', () => {
    assert.equal(readInstant('2026-07-31T09:00:00.000Z'), '2026-07-31T09:00:00.000Z')
    assert.equal(readInstant('2026-07-31T09:00:00Z'), '2026-07-31T09:00:00Z')
    // Local-time and loose forms are refused: `Date.parse` would reinterpret them silently.
    assert.equal(readInstant('2026-07-31T09:00:00'), null)
    assert.equal(readInstant('31 July 2026'), null)
    assert.equal(readInstant(1_753_952_400_000), null)
    assert.equal(readDay('2026-07-31'), '2026-07-31')
    assert.equal(readDay('2026-7-31'), null)
    assert.equal(readDay('2026-07-31T00:00:00Z'), null)
  })

  it('refuses text carrying control characters or a bidirectional override', () => {
    const raw = wellFormed()
    const windows = raw['maintenance'] as Record<string, unknown>[]
    const first = windows[0]
    assert.ok(first)
    first['summary'] = 'Routine‮maintenance'
    const doc = parseStatus(raw)
    assert.ok(doc)
    assert.equal(doc.maintenance.length, 0)
    assert.equal(doc.omitted, 1)
  })

  it('keeps a multi-line operator update, because that is prose somebody typed', () => {
    const raw = wellFormed()
    const incidents = raw['incidents'] as Record<string, unknown>[]
    const first = incidents[0]
    assert.ok(first)
    first['updates'] = [{ at: '2026-07-31T08:45:00.000Z', body: 'Line one.\nLine two.' }]
    const doc = parseStatus(raw)
    assert.ok(doc)
    assert.equal(doc.incidents[0]?.updates[0]?.body, 'Line one.\nLine two.')
  })

  it('bounds a hostile string rather than handing it to the layout engine', () => {
    const raw = wellFormed()
    const windows = raw['maintenance'] as Record<string, unknown>[]
    const first = windows[0]
    assert.ok(first)
    first['summary'] = 'x'.repeat(50_000)
    const doc = parseStatus(raw)
    assert.ok(doc)
    const summary = doc.maintenance[0]?.summary
    assert.ok(summary)
    assert.ok(summary.length <= 2001, `summary was ${summary.length} characters`)
  })
})

describe('a document with no readable observation time is refused whole', () => {
  it('returns null when generatedAt is missing, malformed or the wrong type', () => {
    for (const value of [undefined, null, '', 'yesterday', 1_753_952_400_000, {}]) {
      const raw = wellFormed()
      if (value === undefined) delete raw['generatedAt']
      else raw['generatedAt'] = value
      assert.equal(parseStatus(raw), null, `expected ${JSON.stringify(value)} to be refused`)
    }
  })

  it('returns null for the shapes a proxy or an error page produces', () => {
    for (const value of [null, undefined, '', 'not json', 42, [], { error: { code: 'not_found' } }]) {
      assert.equal(parseStatus(value), null)
    }
  })

  it('accepts a document whose lists are absent entirely', () => {
    const doc = parseStatus({ generatedAt: '2026-07-31T09:00:00.000Z', state: 'operational' })
    assert.ok(doc)
    assert.deepEqual(doc.groups, [])
    assert.deepEqual(doc.incidents, [])
    assert.deepEqual(doc.maintenance, [])
  })

  it('counts a list that arrived as something other than a list', () => {
    const raw = wellFormed()
    raw['groups'] = { Wallet: 'operational' }
    const doc = parseStatus(raw)
    assert.ok(doc)
    assert.deepEqual(doc.groups, [])
    assert.ok(doc.omitted >= 1)
  })

  it('ignores inherited properties — a prototype is not a document', () => {
    const proto = { generatedAt: '2026-07-31T09:00:00.000Z', state: 'operational' }
    assert.equal(parseStatus(Object.create(proto) as object), null)
  })
})

describe('worst() ranks an unknown above an outage', () => {
  it('is unknown for the empty set: nothing measured is not everything healthy', () => {
    assert.equal(worst([]), 'unknown')
  })

  it('ranks in the documented order', () => {
    assert.equal(worst(['operational', 'maintenance']), 'maintenance')
    assert.equal(worst(['operational', 'degraded', 'maintenance']), 'degraded')
    assert.equal(worst(['degraded', 'outage']), 'outage')
    assert.equal(worst(['outage', 'unknown']), 'unknown')
    assert.equal(worst(['operational', 'operational']), 'operational')
  })
})

describe('verdict() will not claim health from an incomplete answer', () => {
  function docWith(fields: Partial<PublicStatus>): PublicStatus {
    const base = parseStatus(wellFormed())
    assert.ok(base)
    return { ...base, ...fields }
  }

  it('REFUSES THE DOCUMENT THE ESTATE ACTUALLY SERVED ON 2026-08-04', () => {
    /*
     * ══════════════════════════════════════════════════════════════════════════════════════════
     * Not a constructed edge case. This is a transcription of what
     * `https://status.cloudsforge.online/api/status/public` returned at 21:45 UTC, on an estate
     * that was healthy — mainnet and testnet up, both chains mining, eleven of twelve scheduled
     * journeys green:
     *
     *     {"generatedAt":"2026-08-04T21:45:14.548Z","state":"operational","groups":[],
     *      "incidents":[{…"group":"Account","severity":"sev2","state":"investigating",
     *                    "openedAt":"2026-08-04T19:23:56.563Z","closedAt":null,"updates":[]}],
     *      "maintenance":[]}
     *
     * Beacon had no probes registered in that deployment, so it had measured nothing — and its
     * `worst([])` folded from its identity and published `operational` anyway. This page is the
     * second line of defence against exactly that, and the reason the header of
     * `src/lib/publicstatus.ts` argues the allowlist is not redundant on the reading side: the two
     * processes are deployed on their own schedules, and the page must be right even when the
     * service is wrong.
     *
     * Beacon now sends `state: null` for this case (`beacon/src/publicstatus.ts`, the note on
     * `PublicStatus.state`). BOTH shapes are pinned below, because a browser holding a cached
     * bundle will meet the old one for as long as its cache lives, and a rollback brings it back.
     * ══════════════════════════════════════════════════════════════════════════════════════════
     */
    const asServed = {
      generatedAt: '2026-08-04T21:45:14.548Z',
      groups: [],
      incidents: [
        {
          reference: 'e1ab13e9-902f-4bf3-b638-b3a8f7222d60',
          group: 'Account',
          severity: 'sev2',
          state: 'investigating',
          openedAt: '2026-08-04T19:23:56.563Z',
          closedAt: null,
          updates: [],
        },
      ],
      maintenance: [],
    }

    for (const claimed of ['operational', null]) {
      const doc = parseStatus({ ...asServed, state: claimed })
      assert.ok(doc, 'the document parses — it is readable, it is just not a verdict')
      const answer = verdict(doc)
      assert.equal(
        answer.state,
        'unknown',
        `beacon claimed ${JSON.stringify(claimed)} over zero groups and this page repeated it`,
      )
      assert.equal(answer.complete, false)
      // The incident survives. An incomplete answer may report a problem — suppressing a known
      // one would be its own dishonesty — and the reader still gets the reference to quote.
      assert.equal(doc.incidents.length, 1)
      assert.equal(doc.incidents[0]?.group, 'Account')
      // And the time is still attributed, so the page can say WHEN it failed to determine this.
      assert.equal(answer.asOf, '2026-08-04T21:45:14.548Z')
    }
  })

  it('claims operational only when the document is whole', () => {
    const raw = wellFormed()
    raw['state'] = 'operational'
    raw['groups'] = [
      { group: 'Wallet', state: 'operational', uptime: [] },
      { group: 'Trading', state: 'operational', uptime: [] },
    ]
    raw['incidents'] = []
    const doc = parseStatus(raw)
    assert.ok(doc)
    const answer = verdict(doc)
    assert.equal(answer.state, 'operational')
    assert.equal(answer.complete, true)
    assert.equal(answer.asOf, '2026-07-31T09:00:00.000Z')
  })

  it('degrades a would-be operational to unknown when anything was omitted', () => {
    const doc = docWith({
      state: 'operational',
      groups: [{ group: 'Wallet', state: 'operational', uptime: [] }],
      omitted: 1,
    })
    const answer = verdict(doc)
    assert.equal(answer.state, 'unknown')
    assert.equal(answer.complete, false)
  })

  it('degrades to unknown when there are no groups at all', () => {
    const doc = docWith({ state: 'operational', groups: [], omitted: 0 })
    assert.equal(verdict(doc).state, 'unknown')
  })

  it('still reports a KNOWN outage from an incomplete document', () => {
    // The asymmetry that makes this fail-closed rather than merely cautious: an incomplete answer
    // may report a problem, because a problem we can see is real. It may not report health,
    // because health is a claim about the absence of problems.
    const doc = docWith({
      state: 'outage',
      groups: [{ group: 'Wallet', state: 'outage', uptime: [] }],
      omitted: 3,
    })
    const answer = verdict(doc)
    assert.equal(answer.state, 'outage')
    assert.equal(answer.complete, false)
  })

  it('takes the worse of the claimed and the derived state', () => {
    // A document claiming operational while carrying a group in outage is contradictory. The
    // worse of the two is what is shown, and `complete` is false so the page says why.
    const doc = docWith({
      state: 'operational',
      groups: [{ group: 'Wallet', state: 'outage', uptime: [] }],
      omitted: 0,
    })
    const answer = verdict(doc)
    assert.equal(answer.state, 'outage')
    assert.equal(answer.complete, false)
  })

  it('is unknown, with no observation time, for no document at all', () => {
    const answer = verdict(null)
    assert.equal(answer.state, 'unknown')
    assert.equal(answer.complete, false)
    assert.equal(answer.asOf, null)
  })
})

describe('seal() is the runtime backstop, and it is tested directly', () => {
  /**
   * Every candidate built in `publicstatus.ts` is already assembled field by field, so replacing
   * `seal` with a plain spread changes nothing about today's behaviour and passes every other test
   * in this file — verified by mutation. The guard exists for the mistake somebody makes later:
   * writing `{ ...incident, group }`, which TypeScript permits because excess-property checking
   * does not apply to spreads. These four assertions are the only thing that would notice.
   */
  it('copies the allowlisted keys and drops everything else', () => {
    const sealed = seal(PUBLIC_UPDATE_FIELDS, {
      at: '2026-07-31T08:45:00.000Z',
      body: 'We are investigating.',
      // Not in the tuple. This is the shape a future `{ ...update }` would produce.
      subject: 'pay.rates',
      isPublic: false,
      author: 'user:1234',
    } as unknown as { at: string; body: string })
    assert.deepEqual(Object.keys(sealed).sort(), [...PUBLIC_UPDATE_FIELDS].sort())
    assert.equal(JSON.stringify(sealed).includes('pay.rates'), false)
    assert.equal(JSON.stringify(sealed).includes('user:1234'), false)
  })

  it('keeps the values of the keys it does copy', () => {
    const sealed = seal(PUBLIC_UPDATE_FIELDS, {
      at: '2026-07-31T08:45:00.000Z',
      body: 'We are investigating.',
    })
    assert.equal(sealed.at, '2026-07-31T08:45:00.000Z')
    assert.equal(sealed.body, 'We are investigating.')
  })

  it('holds for the incident tuple, which is the widest one', () => {
    const sealed = seal(PUBLIC_INCIDENT_FIELDS, {
      reference: 'abc',
      group: 'Wallet',
      severity: 'sev2',
      state: 'identified',
      openedAt: '2026-07-31T08:30:00.000Z',
      closedAt: null,
      updates: [],
      subject: 'hearth.seed',
      lastError: 'ECONNREFUSED',
      failures: 120,
    } as unknown as Parameters<typeof seal<PublicIncident>>[1])
    assert.deepEqual(Object.keys(sealed).sort(), [...PUBLIC_INCIDENT_FIELDS].sort())
    assert.equal(JSON.stringify(sealed).includes('hearth.seed'), false)
    assert.equal(JSON.stringify(sealed).includes('ECONNREFUSED'), false)
  })

  it('names an allowlisted key that is absent rather than omitting it', () => {
    // undefined, not missing: a caller that forgot a field gets a key with no value, which fails
    // loudly at the render site instead of quietly shrinking the object.
    const sealed = seal(PUBLIC_UPDATE_FIELDS, { at: 'x' } as unknown as { at: string; body: string })
    assert.deepEqual(Object.keys(sealed).sort(), [...PUBLIC_UPDATE_FIELDS].sort())
    assert.equal(sealed.body, undefined)
  })
})
