/**
 * The document head: the static one a link-preview fetcher gets, and the runtime one a crawler
 * that executes JavaScript gets. They must agree.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY TWO COPIES EXIST AT ALL, WHICH IS NOT A DESIGN SO MUCH AS AN INHERITANCE
 *
 * This is a single-page application with one `index.html`. `@cloudsforge/ui/seo` says so in its own
 * header (`seo.ts`): the tags it applies are written by script, which browsers and the
 * crawlers that execute JavaScript see, and which the link-preview fetchers used by chat clients
 * generally do not — those get whatever the shell carries. On a status page that trade is louder
 * than elsewhere, because the shell IS what a reader gets when the bundle is still arriving over a
 * connection that is losing it, which is a normal condition on the page people open during an
 * outage.
 *
 * So the static tags stay, and the cost of them staying is drift. `site/index.html` carries a
 * comment recording that its shell and its application disagreed about the home page's own
 * description for as long as it took somebody to open the served HTML rather than the page. This
 * file is the check that stops that here.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ROBOTS DIRECTIVE IS TWO DECISIONS, AND ONLY ONE OF THEM IS THIS REPOSITORY'S
 *
 *   `index, follow`  — DERIVED. `robotsDirective()` (`seo.ts`) reads `servesUi` and
 *                      `adminOnly` and nothing else, and the `status` row (`surfaces.ts`)
 *                      carries `servesUi: true` and no `adminOnly`. The assertions below re-derive
 *                      it from the registry rather than comparing two typed strings, so a change of
 *                      mind in the registry fails here rather than shipping silently.
 *
 *   `noarchive, nosnippet, max-snippet:0`
 *                    — THIS SURFACE'S OWN, and the reason `surfaceMeta()`'s `robots` override
 *                      parameter exists (`seo.ts`). A status page's content is true for
 *                      about a minute. A search result quoting "All systems operational", scraped
 *                      last week and rendered under the link during today's outage, is worse than
 *                      no result: it is a confident answer from a source the reader trusts, and it
 *                      is wrong. The page is findable; the page's WORDS are not quotable.
 *
 * `max-image-preview:large` from the derived string is deliberately not carried over. It asks for a
 * larger rendering of exactly the snapshot the three directives beside it refuse.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { Window } from 'happy-dom'
import { robotsDirective } from '@cloudsforge/ui/seo'
import { surface } from '@cloudsforge/ui/surfaces'
import { applyMeta, metaFor, ROBOTS } from '../src/lib/meta.ts'
import { PRODUCT } from '../src/lib/hosts.ts'
import { descriptionFor, NOT_FOUND_TITLE, ROUTES, titleFor } from '../src/lib/routes.ts'

const at = (p: string): string => fileURLToPath(new URL(`../${p}`, import.meta.url))
const HTML = readFileSync(at('index.html'), 'utf8')

/**
 * The shell with its comments removed.
 *
 * `index.html` EXPLAINS in prose why it carries no analytics tag, and does so by naming the script
 * it refuses to load — so a grep over the raw text matches the explanation and fails a correct
 * file. `test/routes.test.ts` had to do exactly this for the same reason and records the
 * argument; `nginx.conf`'s assertions strip comments too. The stripper is asserted to be
 * load-bearing below, because a stripper that had stopped working would turn every one of these
 * into a test that passes for the wrong reason.
 */
const MARKUP = HTML.replace(/<!--[\s\S]*?-->/g, ' ')

/** The same, for a TypeScript module whose header argues about the identifiers it forbids. */
const code = (file: string): string =>
  readFileSync(at(file), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

/** The `content` of a `<meta name="…">` in the static shell. */
function staticMeta(name: string): string | null {
  return new RegExp(`<meta name="${name}" content="([^"]*)"`).exec(MARKUP)?.[1] ?? null
}

describe('the static head and the runtime head do not drift', () => {
  it('spells the robots directive identically in both', () => {
    // The failure this whole file exists for. A crawler that does not execute JavaScript reads the
    // static tag and nothing else; one that does reads the runtime tag. Two spellings means two
    // policies, and which one applies depends on the crawler.
    assert.equal(staticMeta('robots'), ROBOTS)
    assert.equal(metaFor('/').robots, ROBOTS)
  })

  it('carries the same title in the shell as the front page composes', () => {
    const title = /<title>([^<]*)<\/title>/.exec(MARKUP)?.[1] ?? null
    assert.equal(title, titleFor('/'))
  })
})

describe('the robots directive is derived where it can be', () => {
  it('reads the registry rather than this file for the invitation half', () => {
    /*
     * `status` is the ONE surface of the four consoles in this batch that a crawler is invited to,
     * and it is the registry that says so. Asserting the two registry fields directly is what makes
     * that checkable: a later edit adding `adminOnly: true` to the row would flip
     * `robotsDirective()`, contradict `SITEMAP_SURFACES` — which lists this surface in the estate
     * sitemap `site` serves — and this test is where that is caught.
     */
    const s = surface(PRODUCT)
    assert.equal(s.servesUi, true, 'status no longer serves a UI; the whole head needs re-reading')
    assert.notEqual(s.adminOnly, true, 'status has become adminOnly; robots and the sitemap disagree')
    assert.match(robotsDirective(s), /^index, follow/)
    assert.match(ROBOTS, /^index, follow/)
  })

  it('adds the snapshot refusal, and refuses the snapshot in all three ways', () => {
    // Three directives because three crawlers honour different ones: `noarchive` for the cached
    // copy, `nosnippet` for the description under the link, `max-snippet:0` for the engines that
    // read a length rather than a boolean.
    for (const directive of ['noarchive', 'nosnippet', 'max-snippet:0']) {
      assert.ok(ROBOTS.includes(directive), `robots does not carry ${directive}`)
    }
  })

  it('does not ask for a large image preview of the snapshot it just refused', () => {
    assert.equal(ROBOTS.includes('max-image-preview'), false)
  })
})

describe('every route gets its own head', () => {
  it('gives each route its own title and its own description', () => {
    for (const route of ROUTES) {
      const meta = metaFor(route.path)
      assert.equal(meta.title, route.title)
      assert.equal(meta.description, route.description)
      assert.equal(meta.path, route.path)
    }
    const descriptions = ROUTES.map((route) => route.description)
    assert.equal(new Set(descriptions).size, descriptions.length, 'two routes share a description')
  })

  it('keeps this repository’s title rather than the registry’s single word', () => {
    // `surfaceMeta()` composes `Page — <registry name>`, and this surface's registry name is the
    // bare word `Status`. That is right for a switcher entry and wrong for a browser tab: this page
    // is pinned in tabs and pasted into chat threads DURING an incident, beside twenty others, and
    // "History — Status" is not findable among them where "History — CloudsForge Status" is.
    for (const route of ROUTES) assert.match(metaFor(route.path).title, /CloudsForge Status/)
    assert.equal(metaFor('/nope').title, NOT_FOUND_TITLE)
  })

  it('collapses a trailing slash rather than minting a second canonical', () => {
    // `/history/` and `/history` are one page: nginx accepts both — `location ~ ^/(history|about)(/|$)`
    // — and react-router matches both. Without `normalise()` the trailing-slash spelling would take
    // the not-found title AND its own canonical, which is the classic way one page splits its own
    // indexing between two addresses.
    assert.deepEqual(metaFor('/history/'), metaFor('/history'))
    assert.deepEqual(metaFor('//'), metaFor('/'))
    assert.equal(metaFor('/history/').path, '/history')
  })

  it('gives an unowned address a description that says where the reader is', () => {
    const meta = metaFor('/nope')
    assert.equal(meta.description, descriptionFor('/nope'))
    assert.match(meta.description, /status page/i)
  })

  it('names no hostname anywhere in the composed metadata', () => {
    // The origin is supplied at the call site, from `window.location.origin`, which is what lets
    // one image serve localhost, a preview deployment, the apex and an emergency mirror.
    for (const route of [...ROUTES.map((r) => r.path), '/nope']) {
      const meta = metaFor(route)
      const text = `${meta.title} ${meta.description} ${meta.path} ${meta.image}`
      assert.equal(/https?:\/\//.test(text), false, `${route} composes an absolute URL`)
    }
  })
})

describe('applying it writes into a real document', () => {
  /**
   * The seam, driven rather than reasoned about.
   *
   * `metaFor()` is pure and everything above asserts it without a DOM, which is the right shape for
   * a decision table. But the thing that actually reaches a crawler is `applyHead()` mutating a
   * head that already contains the static tags — and the property that matters there is that it
   * UPDATES them rather than appending a second one, because in a browser the first matching tag
   * wins and a duplicate is invisible.
   */
  function inDocument(fn: () => void): Window {
    const win = new Window({ url: 'https://status.cloudsforge.online/history' })
    win.document.write(HTML)
    const g = globalThis as unknown as Record<string, unknown>
    const saved = new Map<string, PropertyDescriptor | undefined>()
    for (const key of ['window', 'document']) {
      saved.set(key, Object.getOwnPropertyDescriptor(g, key))
      Object.defineProperty(g, key, {
        configurable: true,
        writable: true,
        value: (win as unknown as Record<string, unknown>)[key],
      })
    }
    try {
      fn()
    } finally {
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(g, key, descriptor)
        else delete g[key]
      }
    }
    return win
  }

  it('updates the shell’s tags in place, leaving exactly one of each', () => {
    const win = inDocument(() => {
      applyMeta('/history', 'https://status.cloudsforge.online')
    })
    const doc = win.document
    assert.equal(doc.title, titleFor('/history'))
    for (const name of ['robots', 'description']) {
      const tags = doc.querySelectorAll(`meta[name="${name}"]`)
      assert.equal(tags.length, 1, `${tags.length} copies of meta[name="${name}"] after a navigation`)
    }
    assert.equal(doc.querySelector('meta[name="robots"]')?.getAttribute('content'), ROBOTS)
    assert.equal(
      doc.querySelector('meta[name="description"]')?.getAttribute('content'),
      descriptionFor('/history'),
    )
  })

  it('writes an absolute canonical from the origin it was handed', () => {
    const win = inDocument(() => {
      applyMeta('/history', 'https://status.cloudsforge.online')
    })
    assert.equal(
      win.document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      'https://status.cloudsforge.online/history',
    )
  })

  it('leaves the shell’s own tags alone where it has nothing to say about them', () => {
    // The three attributes on <html> and the analytics id are set statically and must survive a
    // navigation: `applyHead()` sets `lang` and the meta tags, and touches nothing else.
    const win = inDocument(() => {
      applyMeta('/about', 'https://status.cloudsforge.online')
    })
    const html = win.document.documentElement
    assert.equal(html.getAttribute('data-cf-product'), 'status')
    assert.equal(html.getAttribute('data-cf-substrate'), 'warm')
    assert.equal(html.getAttribute('data-cf-scheme'), 'auto')
    assert.equal(html.getAttribute('lang'), 'en-GB')
    assert.equal(
      win.document.querySelector('meta[name="cf-analytics"]')?.getAttribute('content'),
      'G-NB8DNLTKZQ',
    )
  })
})

describe('the shell declares the scheme, and the scheme only', () => {
  it('opts into the shared light scheme with data-cf-scheme', () => {
    // Statically, on <html>, for the same reason the other two attributes are: a page that paints
    // before the attribute lands flashes one scheme and then changes. It matters more here than
    // anywhere — this page is opened on a phone, outdoors, at whatever brightness the phone chose,
    // by somebody trying to establish whether their money is safe.
    assert.match(MARKUP, /<html[^>]*\sdata-cf-scheme="auto"/)
  })

  it('spells color-scheme the way the standard spells it, not the way the estate writes prose', () => {
    // It was `colour-scheme` — correct English and INERT, matched by no browser, so the tag meant
    // to tell the browser which control sets to draw did nothing since the surface shipped.
    assert.equal(staticMeta('color-scheme'), 'dark light')
    assert.equal(MARKUP.includes('name="colour-scheme"'), false, 'the inert British spelling is back')
  })

  it('does not pin the document dark from the local stylesheet', () => {
    /*
     * `color-scheme: dark` was on the `body` rule. It is a browser-level declaration: it pins the
     * native form controls, the scrollbars and the focus ring to the dark set regardless of what
     * the token layer resolves, so a reader on `auto` in a light environment would have had a light
     * page with dark scrollbars. A local `prefers-color-scheme` block would fight the shared token
     * layer the same way from the other direction.
     */
    const css = readFileSync(at('src/styles.css'), 'utf8')
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
    assert.equal(/color-scheme\s*:/.test(declarations), false, 'styles.css declares color-scheme')
    assert.equal(/prefers-color-scheme/.test(declarations), false, 'styles.css has a local scheme block')
  })
})

describe('analytics is a measurement id and never a tag', () => {
  it('carries the id as a meta tag, read at runtime', () => {
    // A meta tag rather than a build-time variable, for the reason no-build-time-config.test.ts
    // gives: an artefact with an environment frozen into it is not the artefact that passed CI. The
    // id is an identity — it names the property, it does not say where the bundle is running.
    assert.equal(staticMeta('cf-analytics'), 'G-NB8DNLTKZQ')
  })

  it('is checked against files that really do discuss the tag in prose', () => {
    // Proves both strippers are load-bearing rather than decorative: the raw text DOES name the
    // thing the assertions below forbid, and the stripped text must not.
    assert.match(HTML, /googletagmanager/)
    assert.equal(MARKUP.includes('googletagmanager'), false)
    assert.match(readFileSync(at('src/main.tsx'), 'utf8'), /no request, no cookie, no script/)
    assert.equal(code('src/main.tsx').includes('no request, no cookie, no script'), false)
  })

  it('loads no third-party script and sets no cookie on boot', () => {
    /*
     * THE ASSERTION THAT MAKES THE ABSENCE GREPPABLE. The stock GA snippet fetches a third-party
     * script and sets `_ga` on load — before any banner has been drawn, let alone answered — and
     * under ePrivacy Art. 5(3) an analytics cookie set before consent is a violation that a banner
     * underneath it does not cure. `grantConsent()` in @cloudsforge/ui/consent is the only call
     * site that injects the tag, and it is reachable only from Accept.
     *
     * On this surface there is a second reason, which is the reason for the whole page: nothing on
     * boot may issue a network request to something that can be slow or down. `initAnalytics()`
     * pushes two entries onto a plain array and returns. A `<script src>` here would put a
     * third-party fetch in the critical path of the page people load when the platform is broken.
     */
    assert.equal(MARKUP.includes('googletagmanager'), false, 'index.html loads the analytics tag')
    assert.equal(MARKUP.includes('gtag('), false, 'index.html carries the gtag snippet')
    // The one `<script>` this shell may carry is its own module entry point. Anything else with a
    // `src` is a third party in the critical path.
    const sources = [...MARKUP.matchAll(/<script[^>]*\ssrc="([^"]*)"/g)].map((m) => m[1] ?? '')
    assert.deepEqual(sources, ['/src/main.tsx'])
  })

  it('primes consent before React mounts, and issues nothing while doing it', () => {
    const main = code('src/main.tsx')
    const init = main.indexOf('initAnalytics()')
    // `createRoot(` with the parenthesis: the bare name also appears in the import above, and an
    // import is not a mount. That distinction is the whole assertion.
    const render = main.indexOf('createRoot(')
    assert.ok(init > -1, 'main.tsx never calls initAnalytics()')
    assert.ok(init < render, 'consent is primed after React mounts, which is a race a cookie wins')
    // The denied default has to be in place before any tag could arrive. `initObs()` still runs
    // first, so a crash in any of this is reported rather than lost.
    assert.ok(main.indexOf('initObs()') < init, 'observability no longer comes first')
    assert.equal(/fetch\(|XMLHttpRequest/.test(main), false, 'boot issues a request')
  })
})

describe('the chrome is ordered for a keyboard', () => {
  const shell = readFileSync(at('src/components/shell.tsx'), 'utf8')
  /** Comments stripped: this file argues about each of these controls in prose above it. */
  const markup = shell.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

  it('puts the skip link first, before anything else focusable', () => {
    assert.ok(markup.indexOf('<SkipLink>') > -1, 'the shell has no skip link')
    assert.ok(markup.indexOf('<SkipLink>') < markup.indexOf('<header'))
  })

  it('puts the outlet inside MainRegion, which is what the skip link lands in', () => {
    // `MainRegion` carries `tabIndex={-1}` and owns `MAIN_ID`, so the link and its target cannot
    // disagree. A bare `<main id="main">` was half the pattern: following the link scrolled the
    // page, left focus on the link, and sent the next Tab back into the header.
    assert.match(markup, /<MainRegion[^>]*>\s*<Outlet \/>\s*<\/MainRegion>/)
    assert.equal(markup.includes('<main'), false, 'a bare <main> is back beside MainRegion')
  })

  it('puts the cookie banner last, so it is last in the tab order', () => {
    /*
     * The banner is a dialog and is deliberately NOT modal, which matters more on this page than
     * anywhere: the reader arrived to find out whether something is broken, and a consent dialog
     * that trapped focus until they answered would stand between them and the one sentence they
     * came for. Last in the document is what makes it ignorable.
     */
    const banner = markup.indexOf('<CookieBanner />')
    assert.ok(banner > -1, 'the shell mounts no cookie banner')
    assert.ok(banner > markup.indexOf('<CloudsForgeFooter'))
    assert.ok(banner > markup.indexOf('<MainRegion'))
  })
})
