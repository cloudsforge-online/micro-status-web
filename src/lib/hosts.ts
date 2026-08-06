/**
 * Where this page talks to, resolved at runtime.
 *
 * `cloudsforgeHosts()` reads `window.location.hostname` on every call, so the same bundle
 * addresses `http://localhost:4011` when served from Vite and a relative path when served from
 * `status.<apex>`. Nothing here reads a build-time constant; see the note in vite.config.ts.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THIS APP'S API IS NOT ITS OWN HOST.** That is the one way it differs from every other
 * frontend in the estate, and it is worth stating because the template's `resolveApiBase()` would
 * silently get it wrong.
 *
 * `status-web` is a bundle of static files served from `status.<apex>`
 * (ui/packages/ui/src/surfaces.ts, `devPort: 3013`). The document it renders is produced by
 * Beacon, whose own surface is `beacon.<apex>` (surfaces.ts, `devPort: 4011`). So "my API
 * base" is neither `hosts().status` — nothing serves an API there — nor unconditionally
 * `hosts().beacon`.
 *
 * The resolution below prefers a RELATIVE request in production, and the reason is the whole
 * point of this page: it must work when everything else is down.
 *
 *   * A relative `/api/status/public` needs one hostname to resolve, one TLS handshake and one
 *     certificate — the ones the reader has already completed by having the page on screen. A
 *     cross-origin request to `beacon.<apex>` needs a second DNS answer, a second certificate and
 *     a CORS preflight, and every one of those is a way for the status page to fail during the
 *     event it exists to describe.
 *   * It also needs no CORS at all. The gateway's allowlist
 *     (`deploy/gateway/dynamic/policy.yml`) does name the status surface's production origin as
 *     an ORIGIN that may call other services, but there is no route for the Beacon subdomain in
 *     that file at all — see the note in the README. A same-origin path rule is the smaller ask of
 *     the two, and the more robust.
 *
 * Under `pnpm dev` the page is on Vite's port, where nothing proxies, so the absolute Beacon
 * origin is the only address that answers.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { cloudsforgeHosts, type CloudsForgeHosts, type SurfaceKey } from '@cloudsforge/ui'

/** The surface this application IS. Matches `data-cf-product` in index.html. */
export const PRODUCT: SurfaceKey = 'status'

/** The surface whose API this application READS. It is deliberately not `PRODUCT`. */
export const UPSTREAM: SurfaceKey = 'beacon'

/** The name reported to the observability ingest and shown in error copy. */
export const APP_NAME = 'status-web'

/**
 * The base URL for Beacon's public projection.
 *
 * Returns `''` — meaning "relative, same origin" — when the page is being served from the status
 * surface itself, and the absolute Beacon origin otherwise. Pure, and exported so the test can
 * pin all three cases without a browser.
 */
export function resolveStatusBase(pageOrigin: string, hosts: CloudsForgeHosts): string {
  // With no page origin there is nothing for a relative URL to resolve against, so the absolute
  // form is the only correct answer.
  if (!pageOrigin) return hosts[UPSTREAM]
  // A surface may carry a basePath, so compare ORIGINS rather than whole URLs.
  if (new URL(hosts[PRODUCT]).origin === pageOrigin) return ''
  // Already on Beacon's own origin (someone serving the bundle from there): relative is still
  // right, and asking for the absolute form of the origin you are on is a pointless indirection.
  if (new URL(hosts[UPSTREAM]).origin === pageOrigin) return ''
  return hosts[UPSTREAM]
}

/** Every CloudsForge base URL, for the current environment. */
export function hosts(): CloudsForgeHosts {
  return cloudsforgeHosts()
}

/** Beacon's base, resolved now. Call it per request; never cache it in a module constant. */
export function statusBase(): string {
  return resolveStatusBase(pageOrigin(), cloudsforgeHosts())
}

/** The page origin, or a stable placeholder when there is no document (tests, prerender). */
export function pageOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin
}
