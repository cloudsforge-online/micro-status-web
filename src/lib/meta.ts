/**
 * The document head, derived from the surface registry and this app's own route table.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS REPLACES
 *
 * `components/shell.tsx` set `document.title` in an effect and nothing else. Everything else in
 * the head — the description, the Open Graph block, the Twitter card — was typed into
 * `index.html` once and never changed again, so all three client routes shared one description
 * and one `og:url`, and a link to `/history` pasted into a chat thread previewed as the front
 * page. `@cloudsforge/ui/seo` is the estate's answer to that, and it is an answer rather than a
 * seventeenth copy: `surfaceMeta()` composes from the registry row (`surfaces.ts`, key `status`)
 * and `applyHead()` updates the tags IN PLACE, so a client-side navigation does not leave the
 * previous page's description in the head beside the current one.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE TITLE IS STILL THIS REPOSITORY'S, AND THAT IS DELIBERATE
 *
 * `surfaceMeta()` composes a title as `Page — <registry name>`, and this surface's registry name
 * is the single word `Status`. That is the right name for a switcher entry and the wrong one for
 * a browser tab: this page is pinned in tabs and pasted into chat threads DURING an incident,
 * next to twenty other tabs, and "History — Status" is not findable among them where
 * "History — CloudsForge Status" is.
 *
 * So `titleFor()` in `lib/routes.ts` remains the one place a title is decided — it is the
 * declaration `test/routes.test.ts` already checks — and it is spread over the composed metadata
 * below. Everything else `surfaceMeta()` derives is taken unchanged.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ROBOTS: TWO DIRECTIVES THAT ARE NOT THE SAME DECISION
 *
 * `index, follow` is what the registry derives for this surface on its own — `status` is the one
 * of this estate's four consoles that is neither `servesUi: false` nor `adminOnly`, because a
 * public status page that cannot be found by searching for it has failed at its only job.
 *
 * `noarchive, nosnippet, max-snippet:0` is this surface's own addition and is the reason the
 * override parameter exists at all (`ui/packages/ui/src/seo.ts`). A status page's content
 * is true for about a minute; a search result quoting "All systems operational", scraped last
 * week and rendered under the link during today's outage, is worse than no result — it is a
 * confident answer from a source the reader trusts, and it is wrong.
 *
 * The string is exported rather than typed twice because `index.html` must carry the same one: a
 * crawler that does not execute JavaScript reads the static shell and never sees `applyHead()`.
 * `test/meta.test.ts` reads both and fails on a byte.
 */
import { applyHead, surfaceMeta, type SurfaceMeta } from '@cloudsforge/ui/seo'
import { PRODUCT } from './hosts.ts'
import { descriptionFor, normalise, titleFor } from './routes.ts'

/**
 * The robots directive this surface serves, in both copies of the head.
 *
 * `index, follow` is what `robotsDirective(surface('status'))` derives; the three that follow are
 * the snapshot refusal described in this module's header. It is written out in full rather than
 * composed from the derived value because a `<meta>` in a static HTML file cannot import, and the
 * test that compares the two is cheaper and more honest than a build step that would generate it.
 */
export const ROBOTS = 'index, follow, noarchive, nosnippet, max-snippet:0'

/** The head for an address, ready to apply. Pure, so a test can assert every route without a DOM. */
export function metaFor(pathname: string): SurfaceMeta {
  const path = normalise(pathname)
  return {
    ...surfaceMeta(PRODUCT, {
      description: descriptionFor(path),
      path,
      robots: ROBOTS,
    }),
    // See the header: the registry name is `Status` and a tab needs `CloudsForge Status`.
    title: titleFor(path),
  }
}

/** Write it into the document. The only impure thing here, and it is one line. */
export function applyMeta(pathname: string, origin: string): void {
  applyHead(metaFor(pathname), origin)
}
