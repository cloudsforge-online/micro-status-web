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
  /** Whether it appears in the navigation. All of them do; the field keeps the intent explicit. */
  readonly inNav: boolean
}

export const ROUTES: readonly AppRoute[] = [
  {
    path: '/',
    label: 'Current',
    title: 'CloudsForge Status',
    inNav: true,
  },
  {
    path: '/history',
    label: 'History',
    title: 'History — CloudsForge Status',
    inNav: true,
  },
  {
    path: '/about',
    label: 'How we measure',
    title: 'How we measure — CloudsForge Status',
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

export function titleFor(pathname: string): string {
  const match = ROUTES.find((route) => route.path === pathname)
  return match ? match.title : NOT_FOUND_TITLE
}
