/**
 * The sitemap and robots.txt nginx serves for this surface.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THE BODIES ARE IN nginx.conf AT ALL
 *
 * A sitemap must carry ABSOLUTE URLs — the spec requires it and a crawler discards a relative
 * `<loc>` — and nothing built in this repository may name a hostname. `no-build-time-config.test.ts`
 * is that rule, and its header says why it bites harder here than anywhere else in the estate:
 * this is the image that must be promotable unchanged and servable from anywhere, "including a
 * static mirror put up because the primary is down". A hostname frozen into the artefact is
 * precisely what stops that working, in the one situation the artefact exists for.
 *
 * nginx is the component that can do it anyway. It has `$host` on every request, so the addresses
 * are composed per request and the artefact stays environment-free.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * AND WHY THIS SURFACE DOES NOT USE `sitemapXml()` FROM THE DESIGN SYSTEM
 *
 * THE SHARED GENERATOR IS FOR THE APEX. It composes each sibling surface as `<subdomain>.$host`,
 * which is right on the marketing site, where `$host` IS the apex. Here `$host` is already
 * `status.<apex>`, so the same call would emit `hub.status.<apex>` — the two-label shape
 * `@cloudsforge/ui`'s `surfaces.ts` records at length as unreachable, because the edge's Universal
 * SSL is a one-label wildcard and every two-label name fails the handshake.
 *
 * So this surface publishes ITS OWN public routes, derived from the same `ROUTES` table the
 * navigation, the router and nginx's enumerated locations all come from — and `robots.txt`, which
 * has no such problem, IS generated from the design system and compared byte for byte.
 *
 * The estate sitemap still lists this surface, and that is the other half of the same decision:
 * `SITEMAP_SURFACES` (`sitemap.ts:47-49`) filters on `servesUi && adminOnly !== true`, and the
 * `status` row carries `servesUi: true` and no `adminOnly` (`surfaces.ts:672-687`). `sitemap.ts`
 * records at 15-17 that a sitemap is an invitation and a robots directive is an instruction, and
 * that the two must not disagree — which is the reason the `Allow: /` below is not a matter of
 * local taste. Changing it would put this file in contradiction with a document `site` serves.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * AND WHY EITHER NEEDS A TEST
 *
 * A body pasted into a config file is a copy, and this estate has been bitten by exactly one of
 * those: `site/index.html`'s title drifted from its application's, the suite stayed green, and
 * every search result carried a sentence the owner had asked to have removed until somebody opened
 * the served HTML rather than the page. The block is therefore treated as GENERATED OUTPUT that
 * happens to live in a config file.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { ENV_LABELS } from '@cloudsforge/ui'
import { robotsTxt } from '@cloudsforge/ui/sitemap'
import { NAV, ROUTES } from '../src/lib/routes.ts'

const nginx = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8')

/**
 * Every address of this surface a crawler should be handed, derived rather than restated.
 *
 * `NAV` is the routes that carry a navigation label, which on this surface is every route there
 * is: three static addresses, no parameterised family, nothing behind a session. That is unusual
 * enough in this estate to be worth stating — the sibling consoles all have at least one unbounded
 * `/:id` route that has to be deliberately kept out of a sitemap — and it is the same fact the
 * analytics decision in `index.html` rests on. `NAV` rather than `ROUTES` all the same, so that a
 * route added later without a navigation label is excluded by construction rather than by somebody
 * remembering this file.
 */
const PUBLIC_PATHS: readonly string[] = NAV.map((route) => route.path)

/** The single-quoted body of a `return 200 '…';` inside an exact-match location. */
function servedBody(path: string): string {
  const block = new RegExp(`location = ${path.replace('.', '\\.')} \\{([\\s\\S]*?)\\n    \\}`).exec(
    nginx,
  )
  assert.ok(block, `nginx.conf has no exact-match location for ${path}`)
  // Anchored to a `return` at the start of its own line: `/robots.txt` also carries a CONDITIONAL
  // `if ($cf_env) { return 200 '…'; }` above it, and a regex that took the first match would read
  // the non-mainnet body and report the mainnet one as drifted.
  const body = /\n {8}return 200 '([\s\S]*?)';/.exec(block[1] ?? '')
  assert.ok(body, `the ${path} location does not return an unconditional literal body`)
  return body[1] ?? ''
}

describe('the sitemap nginx serves', () => {
  it('names no hostname — every address is composed from $host', () => {
    /*
     * THE ASSERTION THAT KEEPS THE ARTEFACT ENVIRONMENT-FREE, and the reason a document with
     * absolute URLs in it is allowed in this repository at all. A single literal apex would make
     * the image wrong on a preview deployment, on testnet and on the emergency mirror, silently,
     * in the one document a crawler treats as authoritative.
     */
    const xml = servedBody('/sitemap.xml')
    assert.ok(!xml.includes('cloudsforge.online'), 'the sitemap names the production apex')
    assert.ok(!xml.includes('localhost'), 'the sitemap names localhost')
    const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1] ?? '')
    assert.ok(locs.length > 0, 'the sitemap lists nothing at all')
    for (const loc of locs) {
      // No subdomain is composed here, unlike the apex's sitemap: `$host` IS this surface.
      assert.match(loc, /^\$scheme:\/\/\$host(\/|$)/, `a <loc> is not composed: ${loc}`)
    }
  })

  it('lists every route this surface offers, so a crawler is not left to guess', () => {
    const xml = servedBody('/sitemap.xml')
    for (const path of PUBLIC_PATHS) {
      const address = path === '/' ? '$scheme://$host' : `$scheme://$host${path}`
      assert.ok(xml.includes(`<loc>${address}</loc>`), `${path} is missing from the sitemap`)
    }
  })

  it('lists nothing else — no /healthz, and no address this app does not own', () => {
    // The other direction, and the one that catches a hand-edit. `/healthz` in particular is a
    // real address nginx answers 200 to and is NOT a page: it is the container probe, it says the
    // server is up rather than that the estate is, and a crawler indexing it would publish a
    // permanent "ok" under this surface's name.
    const xml = servedBody('/sitemap.xml')
    const listed = [...xml.matchAll(/<loc>\$scheme:\/\/\$host([^<]*)<\/loc>/g)].map((m) =>
      m[1] === '' ? '/' : (m[1] ?? ''),
    )
    assert.deepEqual([...listed].sort(), [...PUBLIC_PATHS].sort())
    assert.ok(!xml.includes('/healthz'), 'the sitemap lists the container probe')
  })

  it('is a well-formed urlset in the only schema crawlers implement', () => {
    const xml = servedBody('/sitemap.xml')
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/)
    assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
    assert.match(xml, /<\/urlset>$/)
  })

  it('is served as XML, because a sitemap sent as text/html is a sitemap nobody reads', () => {
    // `types { }` as well as `default_type`: without emptying the table for this location, nginx
    // maps the `.xml` in the URI to `text/xml` from its own mime types and `default_type` never
    // applies.
    assert.match(
      nginx,
      /location = \/sitemap\.xml \{[\s\S]*?types \{ \}[\s\S]*?default_type application\/xml;/,
    )
  })

  it('is derived from the route table rather than typed a fourth time', () => {
    // `src/lib/routes.ts` already decides the router, the navigation and nginx's enumerated
    // locations. This asserts the derivation above is real rather than a coincidence of ordering,
    // and pins the fact that on THIS surface every route is a destination — the property that
    // makes both the sitemap and the analytics decision in index.html simple.
    assert.deepEqual(PUBLIC_PATHS, ['/', '/history', '/about'])
    assert.deepEqual(
      NAV.map((route) => route.path),
      ROUTES.map((route) => route.path),
      'a route is no longer a destination; the sitemap derivation needs re-reading',
    )
  })
})

describe('an environment that is not mainnet', () => {
  /**
   * The `map` that decides it, and the alternation of labels inside it.
   *
   * A testnet estate carries test EMBER, a faucet and deliberately broken services. A status page
   * for THAT estate, indexed beside the real one, is a confident wrong answer to the single
   * question this surface exists to answer, from a source the reader trusts — which is worse here
   * than the equivalent on the marketing site, not merely equivalent to it.
   */
  function alternation(): string[] {
    const map = /map \$host \$cf_env \{[\s\S]*?~\^[^\n]*?\(\?:([^)]*)\)\\\./.exec(nginx)
    assert.ok(map, 'the $cf_env map is missing from nginx.conf')
    return (map[1] ?? '').split('|')
  }

  it('recognises exactly the labels the registry reserves', () => {
    /*
     * ENV_LABELS is the estate's single list — `deploy/scripts/check-apex-prefix.py` reads the
     * same export. An alternation here that had drifted from it would either miss an environment
     * (and index it) or refuse a surface (and de-index a real one), and both fail silently.
     */
    assert.deepEqual(alternation().sort(), [...ENV_LABELS].sort())
  })

  it('refuses every crawler and serves no sitemap', () => {
    // Both halves matter and neither is sufficient: robots.txt stops the fetch, and a sitemap that
    // still answered would be an invitation contradicting the instruction beside it.
    assert.match(nginx, /if \(\$cf_env\) \{ return 200 'User-agent: \*\\nDisallow: \/\\n'; \}/)
    assert.match(nginx, /location = \/sitemap\.xml \{[\s\S]*?if \(\$cf_env\) \{ return 404; \}/)
  })

  it('matches a suffixed subdomain as well as a bare environment apex', () => {
    // The environment is a SUFFIX on the first label now (`status-testnet.`) and was an apex
    // prefix (`testnet.`) before, which put this surface at the two-label `status.testnet.<apex>`.
    // Both shapes still resolve — surfaces.ts keeps the old one deliberately — so the pattern has
    // to catch both or half the estate stays indexable.
    const map = /map \$host \$cf_env \{[\s\S]*?\n\}/.exec(nginx)
    assert.ok(map, 'the $cf_env map is missing')
    assert.match(map[0], /\(\?:\[\^\.\]\+-\)\?/, 'the map does not allow a suffixed subdomain')
  })

  it('is declared in http context, above the server block, which is the only place it is legal', () => {
    // `map` is an http-context directive. The Dockerfile installs this file at
    // /etc/nginx/conf.d/default.conf and conf.d is included FROM http, so it is legal at the top of
    // this file and nginx refuses to start if it is moved inside `server { }`. That failure is
    // loud, but it arrives at container start rather than at review, so it is pinned here.
    const map = nginx.indexOf('map $host $cf_env')
    const server = nginx.indexOf('server {')
    assert.ok(map > -1, 'the $cf_env map is missing')
    assert.ok(map < server, 'the map is inside the server block, where nginx will refuse it')
  })
})

describe('robots.txt', () => {
  it('is exactly what the design system generates', () => {
    // Compared with its trailing newline intact: robots.txt is a line-oriented format and a parser
    // that reads the last line only when it is terminated is a parser that silently loses the
    // Sitemap directive.
    assert.equal(
      servedBody('/robots.txt'),
      robotsTxt({ indexable: true, sitemapUrl: '$scheme://$host/sitemap.xml' }),
    )
  })

  it('says Allow, which is this surface’s exception and not an oversight', () => {
    /*
     * THE ASSERTION THAT DOCUMENTS A DECISION RATHER THAN A MECHANISM, and the one most likely to
     * be "tidied" by somebody applying the pattern from the three sibling consoles in this batch.
     *
     * `admin`, `lantern` and `beacon` all carry `adminOnly: true` and derive `noindex, nofollow`,
     * because publishing an operator console's address and purpose is reconnaissance handed over
     * for free. `status` carries `servesUi: true` and no `adminOnly` — the row is at
     * `surfaces.ts:672-687`, the blurb is "Public status, no account needed" — and derives
     * `index, follow`. That is the whole point of the surface: the reader who needs it most is the
     * one who cannot reach the platform, and somebody who is not already holding the link finds
     * this page by searching for it.
     */
    assert.match(servedBody('/robots.txt'), /^Allow: \/$/m)
    assert.equal(/^Disallow: \/$/m.test(servedBody('/robots.txt')), false)
  })

  it('points at the sitemap with an absolute address, composed rather than typed', () => {
    // A relative `Sitemap:` line is invalid per the standard and is ignored; a literal one bakes in
    // a hostname. `$scheme://$host` is the only form that is both valid and environment-free.
    assert.match(servedBody('/robots.txt'), /^Sitemap: \$scheme:\/\/\$host\/sitemap\.xml$/m)
  })

  it('is not a static file, which an exact-match location would have shadowed', () => {
    /*
     * `location = /robots.txt` wins over the `location /` prefix that serves the static tree, so a
     * file in `public/` would be deployed, unreachable, and edited by the next reader to no effect
     * — the worst of the three states, worse than either serving it or not having it. This surface
     * had neither file before, so nothing was deleted; the assertion is here to stop one arriving.
     */
    for (const name of ['robots.txt', 'sitemap.xml']) {
      let present = true
      try {
        readFileSync(new URL(`../public/${name}`, import.meta.url))
      } catch {
        present = false
      }
      assert.equal(present, false, `public/${name} exists, and nginx will never serve it`)
    }
  })
})

describe('the security headers on the documents this file adds', () => {
  it('are repeated in both new locations, because add_header does not accumulate', () => {
    // A location that declares ANY add_header inherits NONE from the server level. Both blocks set
    // Cache-Control, so both have to restate the three security headers or ship without them.
    // `routes.test.ts` already asserts this over every block that sets Cache-Control; it is
    // restated here against these two by name, because that test's sweep would still pass if a
    // future edit dropped Cache-Control from one of them and quietly cached a stale sitemap.
    for (const path of ['/sitemap.xml', '/robots.txt']) {
      const block = new RegExp(
        `location = ${path.replace('.', '\\.')} \\{([\\s\\S]*?)\\n    \\}`,
      ).exec(nginx)
      assert.ok(block, `no location for ${path}`)
      const body = block[1] ?? ''
      assert.match(body, /X-Content-Type-Options "nosniff"/)
      assert.match(body, /X-Frame-Options "SAMEORIGIN"/)
      assert.match(body, /Referrer-Policy "strict-origin-when-cross-origin"/)
      assert.match(body, /Cache-Control "public, max-age=3600"/)
    }
  })
})
