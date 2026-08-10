/**
 * The route table, the navigation and nginx must agree.
 *
 * A route in the router but not in nginx.conf works under `pnpm dev` and 404s on the first hard
 * refresh in production — which is invisible until it is in front of a reader who followed a link
 * into the page during an incident. So this test reads the REAL nginx.conf from disk rather than a
 * copy of what it is supposed to say.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { NAV, NGINX_SEGMENTS, NOT_FOUND_TITLE, ROUTES, titleFor } from '../src/lib/routes.ts'

const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8')

const nginx = read('nginx.conf')
const app = read('src/app.tsx')
/** Directives only. The file's own comments quote the directive it forbids, on purpose. */
const directives = nginx
  .split('\n')
  .filter((line) => !/^\s*#/.test(line))
  .join('\n')

describe('every client route is enumerated in nginx', () => {
  it('matches / exactly', () => {
    assert.match(directives, /location = \/ \{/)
  })

  it('names every other route in the prefix group', () => {
    for (const segment of NGINX_SEGMENTS) {
      assert.ok(
        new RegExp(`location .*\\b${segment}\\b`).test(directives),
        `nginx.conf does not enumerate /${segment}`,
      )
    }
  })

  it('mounts every route in the router', () => {
    for (const route of ROUTES) {
      if (route.path === '/') {
        assert.match(app, /<Route index/)
        continue
      }
      assert.ok(
        app.includes(`path="${route.path.slice(1)}"`),
        `src/app.tsx does not mount ${route.path}`,
      )
    }
  })

  it('has a catch-all that renders the not-found page', () => {
    assert.match(app, /path="\*"/)
    assert.match(app, /NotFoundPage/)
  })
})

describe('an unknown address answers 404', () => {
  it('does not use the blanket SPA fallback', () => {
    // `try_files $uri /index.html` serves the bundle with a 200 for every address in existence:
    // crawlers index it, uptime checks call it healthy, and a deploy that drops a route looks
    // exactly like a deploy that did not.
    assert.equal(
      /try_files\s+\$uri\s+(\$uri\/\s+)?\/index\.html/.test(directives),
      false,
      'the blanket SPA fallback is present; unknown paths would answer 200',
    )
  })

  it('serves the shell through error_page instead, keeping the status line', () => {
    assert.match(directives, /error_page 404 \/index\.html/)
  })
})

describe('the security headers are restated in every location that sets Cache-Control', () => {
  /**
   * nginx's `add_header` is all-or-nothing per level: a location that declares ANY add_header
   * inherits NONE from its parent. This is the defect that shipped in the template and was fixed
   * hours before this repository was cut — `location /assets/` set Cache-Control and thereby
   * stripped nosniff from every hashed script.
   */
  const blocks = directives.split(/location\s/).slice(1)

  it('is checked against blocks that actually exist', () => {
    assert.ok(blocks.length >= 4, `only found ${blocks.length} location blocks`)
  })

  it('every location that sets Cache-Control also restates nosniff', () => {
    for (const block of blocks) {
      if (!block.includes('Cache-Control')) continue
      assert.ok(
        block.includes('X-Content-Type-Options'),
        `a location sets Cache-Control without restating nosniff:\n${block.slice(0, 120)}`,
      )
      assert.ok(block.includes('X-Frame-Options'), 'a location sets Cache-Control without X-Frame-Options')
      assert.ok(block.includes('Referrer-Policy'), 'a location sets Cache-Control without Referrer-Policy')
    }
  })

  it('the app shell is never cached, in every location that serves it', () => {
    for (const block of blocks) {
      if (!/try_files\s+\/index\.html/.test(block)) continue
      // `try_files` is a FILE LOOKUP, not an internal redirect, so serving /index.html here does
      // not re-enter `location = /index.html`. Each such block must declare no-store itself.
      assert.match(block, /Cache-Control "no-store"/)
    }
  })

  it('assets are immutable, because every build emits new hashed filenames', () => {
    assert.match(directives, /max-age=31536000, immutable/)
  })
})

describe('titles', () => {
  it('gives every route a distinct title', () => {
    const titles = ROUTES.map((route) => route.title)
    assert.equal(new Set(titles).size, titles.length)
    for (const route of ROUTES) assert.equal(titleFor(route.path), route.title)
  })

  it('names the status page in every title, because these tabs are pinned during incidents', () => {
    for (const route of ROUTES) assert.match(route.title, /CloudsForge Status/)
    assert.match(NOT_FOUND_TITLE, /CloudsForge Status/)
  })

  it('gives an unknown address the not-found title', () => {
    assert.equal(titleFor('/nope'), NOT_FOUND_TITLE)
  })
})

describe('the navigation is the route table', () => {
  it('lists every route marked for the nav, and nothing else', () => {
    assert.deepEqual(
      NAV.map((route) => route.path),
      ROUTES.filter((route) => route.inNav).map((route) => route.path),
    )
    assert.ok(NAV.length >= 2)
  })
})

describe('this bundle has no authentication in it at all', () => {
  /**
   * The property is architectural, not cosmetic: a status page must render when identity is the
   * thing that has broken. A grep is the right shape of test for "this must not exist anywhere",
   * because a unit test can only assert about the modules it imports.
   */
  const sources = ['src/app.tsx', 'src/main.tsx', 'src/components/shell.tsx', 'src/lib/beacon.ts']

  /**
   * The file with its comments removed.
   *
   * Every one of these files EXPLAINS in prose why it has no authentication, naming the very
   * identifiers the assertions below forbid — so a grep over the raw text matches the explanation
   * and fails a correct file. The nginx assertions above strip comments for the same reason.
   */
  const code = (file: string): string =>
    read(file)
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')

  it('is checked against files that really do discuss auth in prose', () => {
    // Proves the stripper is load-bearing rather than decorative: the raw text DOES contain the
    // forbidden words, and the stripped text must not.
    assert.match(read('src/app.tsx'), /ProtectedRoute/)
    assert.equal(/ProtectedRoute/.test(code('src/app.tsx')), false)
  })

  it('mounts no auth provider and no protected route', () => {
    for (const file of sources) {
      const text = code(file)
      assert.equal(/AuthProvider|ProtectedRoute|useSession/.test(text), false, `${file} imports auth`)
    }
  })

  it('never reads or writes a token', () => {
    for (const file of sources) {
      const text = code(file)
      assert.equal(/localStorage|accessToken|refreshToken|Bearer/.test(text), false, `${file} touches tokens`)
    }
  })

  it('does not mount the shared bar, which would offer a sign-in that leads nowhere', () => {
    assert.equal(code('src/components/shell.tsx').includes('<CloudsForgeBar'), false)
  })

  /**
   * AND IT DOES NOT MOUNT THE BROWSER MINING CONTROL EITHER.
   *
   * The design system grew one, and it went into the chrome of every other surface in the estate
   * on 2026-08-10 because the owner reported that starting a browser miner was "hidden deep in
   * mining page". This is the one surface it is deliberately left out of, and the reason wants
   * writing down where the next estate-wide rollout will read it — otherwise the absence looks
   * like an oversight and gets closed.
   *
   * Two arguments, and either is sufficient:
   *
   *   - The likeliest reason somebody is on this page is that something is down. The control is an
   *     anchor to `hub.<apex>`, a surface whose state this page may at that very moment be
   *     reporting as an outage. That is the same dead end the shared bar's sign-in would be, one
   *     origin along, and it is the argument the whole shell rests on.
   *   - It would be the only control on the page that is not about the estate's health. A status
   *     page that advertises is a status page people trust slightly less, and the trust is the
   *     entire product.
   *
   * The mining control does not appear in the estate's own account of what the chrome contains
   * without a decision being made about it, which is what this test forces.
   */
  it('does not offer browser mining, on the one page read during an outage', () => {
    const shell = code('src/components/shell.tsx')
    assert.equal(shell.includes('<MiningControl'), false)
    assert.equal(/miningOnHub/.test(shell), false)
  })
})
