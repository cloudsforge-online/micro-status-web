/**
 * The route table, in one place, because three files have to agree about it.
 *
 * `src/app.tsx` mounts these paths, `src/components/shell.tsx` navigates to them, and
 * `nginx.conf` ENUMERATES them so that an address which is not here answers 404 rather than 200.
 * `test/routes.test.ts` reads nginx.conf and fails if the three disagree — a route in the router
 * but not in nginx works under `pnpm dev` and 404s on the first hard refresh in production, which
 * is the failure mode that is invisible until it is in front of a customer.
 */

export interface AppRoute {
  /** The path as react-router mounts it, leading slash, no trailing slash. */
  readonly path: string
  /** The word in the navigation. */
  readonly label: string
  /** `<title>`, which is what a browser tab and a shared link show. */
  readonly title: string
  /**
   * The meta description, and the Open Graph description with it.
   *
   * Added with @cloudsforge/ui 1.1. Before it, all three routes shared the one description typed
   * into `index.html`, so a link to `/history` pasted into a chat thread previewed as the front
   * page — the wrong page, at the moment somebody is trying to send a colleague to the right one.
   * `lib/meta.ts` reads this; `surfaceMeta()` would otherwise compose the registry blurb, which is
   * correct for `/` and says nothing about the other two.
   */
  readonly description: string
  /** Whether it appears in the navigation. All of them do; the field keeps the intent explicit. */
  readonly inNav: boolean
}

export const ROUTES: readonly AppRoute[] = [
  {
    path: '/',
    label: 'Current',
    title: 'CloudsForge Status',
    description:
      'Live availability of the CloudsForge estate, by product group. No account needed, and this page is served independently of the systems it describes.',
    inNav: true,
  },
  {
    path: '/history',
    label: 'History',
    title: 'History — CloudsForge Status',
    description:
      'Ninety days of daily availability for every CloudsForge product group, with the incidents and planned maintenance that shaped them.',
    inNav: true,
  },
  {
    path: '/about',
    label: 'How we measure',
    title: 'How we measure — CloudsForge Status',
    description:
      'What the states on this page mean, how often each system is probed, and what this page will not claim when it cannot establish an answer.',
    inNav: true,
  },
]

export const NAV = ROUTES.filter((route) => route.inNav)

/**
 * The nginx `location` segments, derived rather than restated.
 *
 * `/` is matched exactly and is therefore not in this list; everything else is a prefix group in
 * one regex. Exported so the test compares a DERIVED expectation against the real file instead of
 * comparing two hand-written lists, which drift together.
 */
export const NGINX_SEGMENTS: readonly string[] = ROUTES.filter((route) => route.path !== '/').map(
  (route) => route.path.slice(1),
)

/** The title for an address this app does not own. */
export const NOT_FOUND_TITLE = 'Page not found — CloudsForge Status'

/** The description for one, which says what the reader is looking at rather than what it is not. */
export const NOT_FOUND_DESCRIPTION =
  'This address is not part of the CloudsForge status page. Current status, the ninety-day history and how we measure are all one click away.'

/**
 * Collapse an address to the one spelling this app routes on.
 *
 * `/history/` and `/history` are one page. nginx accepts both — `location ~ ^/(history|about)(/|$)`
 * — and react-router matches both, so without this the trailing-slash spelling would get the
 * not-found title and, since @cloudsforge/ui 1.1 applies a canonical link, its own canonical URL.
 * One page with two canonicals is the classic way a page splits its own indexing between them, and
 * this is the one surface in the batch a crawler is invited to.
 */
export function normalise(pathname: string): string {
  if (!pathname.startsWith('/')) return normalise(`/${pathname}`)
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export function titleFor(pathname: string): string {
  const match = ROUTES.find((route) => route.path === normalise(pathname))
  return match ? match.title : NOT_FOUND_TITLE
}

export function descriptionFor(pathname: string): string {
  const match = ROUTES.find((route) => route.path === normalise(pathname))
  return match ? match.description : NOT_FOUND_DESCRIPTION
}
