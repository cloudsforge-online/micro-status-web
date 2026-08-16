/**
 * The one call this page makes.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **`GET /api/status/public` — `beacon/src/server.ts`.**
 *
 * Verified by reading `buildRoutes()`, not by assuming. Three properties of that route govern
 * everything in this file, and each one is quoted where it is used below:
 *
 *   * **It is pre-auth.** `if (!deps.publicStatus) await authorise(...)` (`server.ts`) — when
 *     `BEACON_PUBLIC_STATUS` is on, no credential is consulted. So this client sends none: no
 *     bearer, no cookie, no `x-beacon-token`. There is no auth module in this repository at all.
 *   * **There is no `/v1` prefix and no query string.** The path is exactly
 *     `/api/status/public`; `handle()` matches on the full pathname (`server.ts`) and the
 *     handler reads nothing off `ctx.url.searchParams`. Two defects have already shipped in this
 *     estate from a client inventing a path — `micro-wallet` called `POST /v1/quotes` at a service
 *     that serves `/rates`, and `micro-market` called `POST /v1/decisions/market.listing` at a
 *     service with no `/v1` routes at all, which 403'd every listing. `test/beacon.test.ts`
 *     asserts the outgoing URL and method rather than the parsed response, for that reason.
 *   * **It answers `cache-control: no-store`** (`server.ts`). This client asks for the same,
 *     because a status page served from a cache is a status page that can be wrong for the
 *     duration of a TTL — but it asks through the request's `cache` MODE and not through a
 *     `cache-control` request header, which is not a stylistic preference. See
 *     `fetchPublicStatus` for the measurement that forced the distinction.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * **THE OUTCOME IS A UNION, NOT AN EXCEPTION.** Every caller has to name what it does about a
 * failure, and the four failures are genuinely different things to tell a reader: the page could
 * not reach us, we refused, we answered something unreadable, or we answered and it is here. A
 * `catch` block that collapsed them would collapse the copy along with them.
 */
import { APP_NAME, statusBase } from './hosts.ts'
import { report } from './obs.ts'
import { parseStatus, type PublicStatus } from './publicstatus.ts'

/** The path, exactly as `server.ts` registers it. Exported so the test can pin the string. */
export const PUBLIC_STATUS_PATH = '/api/status/public'

/**
 * How long to wait before calling Beacon unreachable.
 *
 * A hung request is the worst of the failure modes, because the page shows a spinner rather than
 * an answer — and "still loading" during an incident reads, to a reader who has given it fifteen
 * seconds, as "the status page is down too". Eight seconds is long enough for a cold container on
 * a bad connection and short enough that nobody waits for it twice.
 */
export const REQUEST_TIMEOUT_MS = 8000

export type StatusOutcome =
  | { readonly kind: 'ok'; readonly status: PublicStatus; readonly receivedAt: string }
  /** No answer at all: DNS, TLS, CORS, a dead gateway, an aeroplane. */
  | { readonly kind: 'unreachable'; readonly detail: string }
  /** An answer, with a status code that is not success. `status` is the HTTP code. */
  | { readonly kind: 'refused'; readonly status: number; readonly requestId: string | null }
  /** A 200 whose body is not a document this page can read. */
  | { readonly kind: 'unreadable'; readonly detail: string }

/**
 * Fetch and parse the public projection.
 *
 * Never throws — including on abort, which resolves as `unreachable` with a detail the caller can
 * discard. A status page whose data layer can throw is a status page with a blank screen in its
 * future.
 */
export async function fetchPublicStatus(signal?: AbortSignal): Promise<StatusOutcome> {
  const url = new URL(`${statusBase()}${PUBLIC_STATUS_PATH}`, originForRelative())
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const forward = () => controller.abort()
  signal?.addEventListener('abort', forward)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      // ══════════════════════════════════════════════════════════════════════════════════════
      // NO CACHED COPY — SAID IN THE ONE WAY THAT SURVIVES A CROSS-ORIGIN READ.
      //
      // This was a `cache-control: no-cache` REQUEST HEADER, described here as belt and braces
      // against an intermediary that ignores the `cache-control: no-store` the route already
      // answers with (`beacon/src/server.ts`). The braces cost the belt.
      //
      // `cache-control` is not on the browser's CORS-safelisted request-header list, so sending
      // it cross-origin makes the request PREFLIGHTED — and the estate's one CORS allowlist
      // (`deploy/gateway/dynamic/policy.yml`, `cf-cors`) does not name it. Measured on the live
      // gateway: `access-control-allow-headers: content-type, authorization, x-request-id,
      // traceparent, tracestate, baggage, idempotency-key`. So the browser refused the read
      // before Beacon ever saw it, and this page told a reader "We do not know the state of our
      // systems. Our own status service never answered" while the service it could not reach was
      // answering 200 with `state: operational`.
      //
      // The three variants, in a real Chromium on the live estate, from an
      // `https://status.cloudsforge.online` document reading `beacon-testnet.<apex>`, 2026-08-16:
      //
      //   cache-control: no-cache header   TypeError: Failed to fetch   (blocked at preflight)
      //   cache: 'no-store'                200 — one GET, no preflight
      //   neither                          200 — one GET, no preflight
      //
      // The mode says the same thing to the browser's own cache and says it more strongly — it
      // refuses the cache in both directions rather than asking for revalidation — and it costs
      // no preflight, because the `cache-control` and `pragma` the user agent then appends are
      // added after the CORS decision and are not CORS-unsafe request-header names.
      //
      // WHY THIS WAS INVISIBLE FOR AS LONG AS IT WAS: the serving estate's own read is RELATIVE
      // (`hosts.ts` returns `''`), so it is same-origin and is never preflighted at all. Only the
      // OTHER estate's read is cross-origin, and that read only exists since the combined view.
      // ══════════════════════════════════════════════════════════════════════════════════════
      cache: 'no-store',
      // ══════════════════════════════════════════════════════════════════════════════════════
      // NO CREDENTIALS, EVER. The route is pre-auth (`server.ts`), so a cookie or a bearer
      // buys this page nothing — and sending one would make the most-linked, least-trusted page
      // in the estate a CSRF surface for whatever that session can do. It also means this page
      // keeps working when identity is the thing that is broken, which is the most likely reason
      // somebody is reading it.
      // ══════════════════════════════════════════════════════════════════════════════════════
      credentials: 'omit',
      signal: controller.signal,
    })

    if (!res.ok) {
      // A 401 or 403 here is not a user problem to solve — it means `BEACON_PUBLIC_STATUS` is
      // false and the projection is gated (`server.ts`). It is reported as a refusal so the
      // page can say we cannot show status, rather than offering a sign-in this page does not do.
      return {
        kind: 'refused',
        status: res.status,
        requestId: res.headers.get('x-request-id'),
      }
    }

    let body: unknown
    try {
      body = await res.json()
    } catch (err) {
      // A non-JSON 200 means something in FRONT of Beacon answered — a gateway, a CDN, a
      // misrouted deploy — and the request never reached it. Nothing server-side logs that.
      report({
        app: APP_NAME,
        type: 'NonJsonStatusBody',
        message: `200 from ${url.pathname} was not JSON`,
        stack: err instanceof Error ? (err.stack ?? null) : null,
        statusCode: res.status,
        requestId: res.headers.get('x-request-id'),
        context: { contentType: res.headers.get('content-type') },
      })
      return { kind: 'unreadable', detail: 'the reply was not in the format we expect' }
    }

    const status = parseStatus(body)
    if (status === null) {
      // The document parsed as JSON and was still refused — in practice, no readable
      // `generatedAt`. Worth reporting: it means Beacon or something ahead of it changed shape.
      report({
        app: APP_NAME,
        type: 'UnreadableStatusDocument',
        message: 'the public status document could not be read',
        statusCode: res.status,
        requestId: res.headers.get('x-request-id'),
      })
      return { kind: 'unreadable', detail: 'the document arrived with no observation time on it' }
    }

    return { kind: 'ok', status, receivedAt: new Date().toISOString() }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    if (!aborted) {
      report({
        app: APP_NAME,
        type: 'StatusUnreachable',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? (err.stack ?? null) : null,
        context: { url: url.toString() },
      })
    }
    return {
      kind: 'unreachable',
      detail: aborted ? 'the request ran out of time' : 'the connection could not be opened',
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forward)
  }
}

/**
 * What a relative base resolves against.
 *
 * `statusBase()` returns `''` in production (see hosts.ts), so `new URL()` needs a base. Outside a
 * browser there is none — and in that case `statusBase()` has already returned an absolute URL, so
 * the placeholder is never actually used to build a request.
 */
function originForRelative(): string {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin
}
