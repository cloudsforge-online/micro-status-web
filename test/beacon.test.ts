/**
 * THE REQUEST, not the response.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A stub answers whatever it is told to answer, no matter what path it was asked for. So a test
 * that checks the parsed body proves the parser and nothing else — and that is exactly the shape
 * of test that let two defects ship in this estate:
 *
 *   - `micro-wallet` called `POST /v1/quotes`. `micro-pricing` serves `/rates`.
 *   - `micro-market` called `POST /v1/decisions/market.listing`. `micro-policy` has no `/v1`
 *     routes at all and registers `market.listing.create`. Every listing 403'd. Suite green.
 *
 * So this file asserts the OUTGOING call: the exact URL, the method, the headers and — the one
 * that matters most here — that no credential of any kind is attached. Each expectation carries
 * the line of `beacon/src/server.ts` it was verified against, read from `buildRoutes()`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetch, installWindow, json, removeWindow, type FetchStub } from './browser-stubs.ts'
import { fetchPublicStatus, PUBLIC_STATUS_PATH } from '../src/lib/beacon.ts'
import { __resetObs } from '../src/lib/obs.ts'

/** Beacon's dev port, from the surface registry: `ui/packages/ui/src/surfaces.ts`. */
const BEACON_DEV = 'http://localhost:4011'

let fetchStub: FetchStub

function onlyCall(): { url: URL; method: string; headers: Record<string, string> } {
  assert.equal(fetchStub.calls.length, 1, `expected exactly one request, saw ${fetchStub.calls.length}`)
  const call = fetchStub.calls[0]
  assert.ok(call)
  return { url: new URL(call.url), method: call.method, headers: call.headers }
}

/** A minimal document the parser accepts, so a request test is not also a parse test. */
function document(): Record<string, unknown> {
  return { generatedAt: '2026-07-31T09:00:00.000Z', state: 'operational', groups: [], incidents: [], maintenance: [] }
}

beforeEach(() => {
  __resetObs()
})

afterEach(() => {
  fetchStub.restore()
  removeWindow()
  __resetObs()
})

describe('GET /api/status/public — beacon/src/server.ts', () => {
  beforeEach(() => {
    // Under `pnpm dev` the page is on Vite's port, so the request is absolute and cross-origin.
    installWindow('http://localhost:5180/')
    fetchStub = installFetch(() => json(200, document()))
  })

  it('asks for exactly /api/status/public', async () => {
    await fetchPublicStatus()
    const call = onlyCall()
    assert.equal(call.url.pathname, '/api/status/public')
    assert.equal(call.url.pathname, PUBLIC_STATUS_PATH)
  })

  it('has no /v1 anywhere in the path — this route is not versioned', async () => {
    // `define('GET', '/api/status/public', …)` at server.ts. The gate and the probe routes are
    // under /v1; this one is not, and inventing a prefix is the defect that shipped twice.
    await fetchPublicStatus()
    assert.equal(onlyCall().url.pathname.includes('/v1'), false)
  })

  it('is a GET — asking must not change anything', async () => {
    await fetchPublicStatus()
    assert.equal(onlyCall().method, 'GET')
  })

  it('sends no query string — the handler reads none', async () => {
    // server.ts never touches `ctx.url.searchParams`.
    await fetchPublicStatus()
    assert.equal(onlyCall().url.search, '')
  })

  it('goes to Beacon, not to the status surface, when the page is on Vite', async () => {
    await fetchPublicStatus()
    assert.equal(onlyCall().url.origin, BEACON_DEV)
  })
})

describe('the request carries no credential of any kind', () => {
  beforeEach(() => {
    installWindow('http://localhost:5180/')
    fetchStub = installFetch(() => json(200, document()))
  })

  it('attaches no Authorization header', async () => {
    // The route is pre-auth (`server.ts`), so there is nothing a bearer would buy — and this
    // bundle has no token storage to take one from.
    await fetchPublicStatus()
    const headers = onlyCall().headers
    const names = Object.keys(headers).map((name) => name.toLowerCase())
    assert.equal(names.includes('authorization'), false)
  })

  it('attaches no x-beacon-token — the static break-glass credential is not the page’s', async () => {
    // `server.ts` reads this header. A public bundle holding it would be publishing it.
    await fetchPublicStatus()
    const names = Object.keys(onlyCall().headers).map((name) => name.toLowerCase())
    assert.equal(names.includes('x-beacon-token'), false)
  })

  it('sends no cookies', async () => {
    await fetchPublicStatus()
    const call = fetchStub.calls[0]
    assert.ok(call)
    // `credentials: 'omit'` is the property under test; the stub records init, so read it back.
    assert.equal(fetchStub.credentials[0], 'omit')
  })

  it('asks for JSON, and for no cached copy through the request MODE', async () => {
    // This asserted `headers['cache-control'] === 'no-cache'` until 2026-08-16. See the block
    // below, and `src/lib/beacon.ts`: that header is what made the cross-environment read
    // impossible, and the refusal of a cached document is unchanged — it is stated on the
    // request rather than in a header the browser has to ask permission to send.
    await fetchPublicStatus()
    assert.equal(onlyCall().headers['accept'], 'application/json')
    assert.equal(fetchStub.cacheModes[0], 'no-store')
  })
})

/**
 * THE READ IS A *SIMPLE* REQUEST, AND ON THIS PAGE THAT IS A FUNCTIONAL REQUIREMENT.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * Since the combined view, a reader on `status.cloudsforge.online` can switch to Testnet, and this
 * page then reads `beacon-testnet.<apex>` — CROSS-ORIGIN, from a mainnet document. Every header
 * outside the browser's CORS safelist turns that into a preflight, and a preflight is a permission
 * the gateway grants by NAME: `deploy/gateway/dynamic/policy.yml` lists seven header names and
 * refuses everything else.
 *
 * That refusal is silent in the worst possible way. Traefik does not log it, Beacon never sees the
 * request, nothing in the estate records it, and what a reader gets is this page's own
 * `unreachable` copy — "We do not know the state of our systems" — over a service that is up. It
 * shipped, it was measured on 2026-08-16, and it made the estate's most-linked page report an
 * outage that was its own request header.
 *
 * The estate has now made this mistake twice: `idempotency-key` on foresight's deploy route
 * (`deploy/gateway/dynamic/policy.yml`) and `cache-control` here. The two fixes went in opposite
 * directions on purpose — foresight's header is REQUIRED by the server, so the allowlist had to
 * grow; this one is read by nobody, so it went away.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
describe('nothing on this request makes the browser ask permission first', () => {
  /** The CORS-safelisted request-header names, per the Fetch standard. */
  const SAFELISTED = ['accept', 'accept-language', 'content-language', 'content-type', 'range']

  beforeEach(() => {
    // The mainnet document — which is where the cross-environment read is made FROM.
    installWindow('https://status.cloudsforge.online/')
    fetchStub = installFetch(() => json(200, document()))
  })

  it('sends no request header outside the CORS safelist', async () => {
    await fetchPublicStatus()
    const names = Object.keys(onlyCall().headers).map((name) => name.toLowerCase())
    const unsafe = names.filter((name) => !SAFELISTED.includes(name))
    assert.deepEqual(unsafe, [], `each of these preflights the read: ${unsafe.join(', ')}`)
  })

  it('and cache-control in particular, which is the one that shipped', async () => {
    // Named on its own so the failure says which header, rather than only that there is one.
    await fetchPublicStatus()
    const names = Object.keys(onlyCall().headers).map((name) => name.toLowerCase())
    assert.equal(names.includes('cache-control'), false)
    assert.equal(names.includes('pragma'), false)
  })
})

describe('where the request goes, per environment', () => {
  it('is relative when the page is served from the status surface', async () => {
    installWindow('https://status.cloudsforge.online/history')
    fetchStub = installFetch(() => json(200, document()))
    await fetchPublicStatus()
    const call = onlyCall()
    // Same origin: one hostname, one certificate, no CORS. See the header of src/lib/hosts.ts.
    assert.equal(call.url.origin, 'https://status.cloudsforge.online')
    assert.equal(call.url.pathname, '/api/status/public')
  })

  it('is relative when the page is served from Beacon itself', async () => {
    installWindow('https://beacon.cloudsforge.online/')
    fetchStub = installFetch(() => json(200, document()))
    await fetchPublicStatus()
    assert.equal(onlyCall().url.origin, 'https://beacon.cloudsforge.online')
  })
})

describe('the outcome union', () => {
  beforeEach(() => {
    installWindow('http://localhost:5180/')
  })

  it('is ok, with a parsed document and a receipt time, on a 200', async () => {
    fetchStub = installFetch(() => json(200, document()))
    const outcome = await fetchPublicStatus()
    assert.equal(outcome.kind, 'ok')
    if (outcome.kind !== 'ok') return
    assert.equal(outcome.status.generatedAt, '2026-07-31T09:00:00.000Z')
    assert.ok(outcome.receivedAt)
  })

  it('is refused, with the code and the request id, on a non-2xx', async () => {
    // 401 here means BEACON_PUBLIC_STATUS is false and the projection is gated (server.ts).
    fetchStub = installFetch(() => json(401, { error: { code: 'unauthenticated' } }, 'req-4242'))
    const outcome = await fetchPublicStatus()
    assert.equal(outcome.kind, 'refused')
    if (outcome.kind !== 'refused') return
    assert.equal(outcome.status, 401)
    assert.equal(outcome.requestId, 'req-4242')
  })

  it('is refused on a 503, which is what a verifier outage looks like', async () => {
    fetchStub = installFetch(() => json(503, { error: { code: 'verifier_unavailable' } }))
    const outcome = await fetchPublicStatus()
    assert.equal(outcome.kind, 'refused')
  })

  it('is unreachable when fetch throws', async () => {
    fetchStub = installFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    const outcome = await fetchPublicStatus()
    assert.equal(outcome.kind, 'unreachable')
  })

  it('is unreadable when a 200 body is not JSON', async () => {
    fetchStub = installFetch(
      () =>
        new Response('<html>502 Bad Gateway</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    )
    const outcome = await fetchPublicStatus()
    assert.equal(outcome.kind, 'unreadable')
  })

  it('is unreadable when a 200 body is JSON the parser refuses', async () => {
    // A document with no readable observation time. Never "ok with defaults".
    fetchStub = installFetch(() => json(200, { state: 'operational', groups: [] }))
    const outcome = await fetchPublicStatus()
    assert.equal(outcome.kind, 'unreadable')
  })

  it('is unreachable, not a throw, when the caller aborts', async () => {
    const controller = new AbortController()
    fetchStub = installFetch(
      () =>
        new Promise<Response>((_resolve, reject) => {
          setTimeout(() => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), 1)
        }),
    )
    const promise = fetchPublicStatus(controller.signal)
    controller.abort()
    const outcome = await promise
    assert.equal(outcome.kind, 'unreachable')
  })

  it('never throws, whatever comes back', async () => {
    for (const answer of [
      () => json(200, null),
      () => json(200, []),
      () => json(500, {}),
      () => {
        throw new Error('boom')
      },
    ]) {
      fetchStub.restore()
      fetchStub = installFetch(answer as () => Response)
      const outcome = await fetchPublicStatus()
      assert.ok(['ok', 'refused', 'unreachable', 'unreadable'].includes(outcome.kind))
    }
  })
})
