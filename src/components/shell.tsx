/**
 * The chrome.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THIS IS THE ONE FRONTEND IN THE ESTATE THAT DOES NOT MOUNT `CloudsForgeBar`, AND THE REASON
 * IS THE POINT OF THE PAGE.**
 *
 * The shared bar always renders an account control: `AccountMenu` shows a "Sign in" button
 * whenever `account.signedIn` is false (`ui/packages/ui/src/index.tsx`). On every other
 * surface that is right. Here it is a dead end offered at the worst moment — the likeliest reason
 * somebody is reading this page is that identity is down, and a prominent button that sends them
 * to a portal which cannot answer makes the outage look like their fault. A button wired to
 * nothing would be worse still.
 *
 * So the chrome is the logo, the name and the navigation, and this bundle contains no session
 * concept at all: no token storage, no refresh, no `AuthProvider`, no `ProtectedRoute`. The logo
 * still links to the marketing site through `cloudsforgeHosts()`, so brand continuity survives
 * without importing the thing that can break.
 *
 * ── AND THE SAME ANSWER FOR THE BROWSER MINING CONTROL ────────────────────────────────────────
 *
 * The design system grew `MiningControl`, and on 2026-08-10 it went into the chrome of every other
 * surface in the estate: the owner reported that starting a browser miner was "hidden deep in
 * mining page", and the fix was to put it beside the account everywhere. It is deliberately not
 * here. Away from Forge Hub the control is an anchor to `hub.<apex>` — a surface whose state this
 * page may at that moment be reporting as an outage — so it is the same dead end as the sign-in,
 * one origin along. It would also be the only control on the page that is not about the estate's
 * health, and a status page that advertises is a status page people trust slightly less.
 *
 * `test/routes.test.ts` pins the absence so that the next estate-wide rollout has to answer this
 * paragraph rather than assume nobody thought about it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import {
  CloudsForgeFooter,
  CloudsForgeLogo,
  CookieBanner,
  MainRegion,
  SkipLink,
} from '@cloudsforge/ui'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { hosts, PRODUCT } from '../lib/hosts.ts'
import { applyMeta } from '../lib/meta.ts'
import { NAV } from '../lib/routes.ts'

export function AppShell() {
  return (
    <>
      {/*
        The skip link is the first focusable thing in the document, and it is now the SHARED one:
        `.st-skip` was a local reimplementation of a control sixteen other surfaces did not have at
        all, and moving it into @cloudsforge/ui is what gives them one.

        It still becomes VISIBLE on focus — a skip link that stays hidden when focused is worse
        than none, because the reader activates it and cannot tell whether anything happened. The
        shared rule does that with a transform rather than the `left: -9999px` this file used, and
        that is the better mechanism: an off-screen element is still in the tab order either way,
        but a transform leaves the focused state an ordinary visible element with an ordinary focus
        ring. See `.cf-skip` in ui.css and the note above it.
      */}
      <SkipLink>Skip to status</SkipLink>

      <DocumentMeta />

      <header className="st-head">
        <div className="st-head__inner">
          <a className="st-head__logo" href={hosts().site} aria-label="CloudsForge home">
            <CloudsForgeLogo size={20} />
          </a>
          <span className="st-head__sep" aria-hidden="true" />
          <span className="st-head__name">Status</span>
          <nav className="st-nav" aria-label="Status pages">
            {NAV.map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                end={route.path === '/'}
                className={({ isActive }) => `st-nav__link${isActive ? ' is-current' : ''}`}
              >
                {route.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/*
        `MainRegion` rather than a bare `<main>`, and the difference is the half that is easy to
        get wrong: it carries `tabIndex={-1}`, without which the skip link's fragment scrolls the
        page in Chrome and Safari and leaves focus on the link — so the reader's next Tab goes back
        to the second item in the header, which is precisely the block they asked to skip. It also
        owns the id (`MAIN_ID`, `cf-main`), so the link and its target cannot disagree.
      */}
      <MainRegion className="st-main">
        <Outlet />
      </MainRegion>

      {/*
        The company footer, from @cloudsforge/ui, REPLACING the `st-foot` this file used to write
        itself. The honesty paragraph is kept verbatim as `note`; the three links it carried are
        gone, and two of them were broken.

        ── THE LINKS WERE WRONG, AND HAD NO WAY OF BEING FOUND OUT ───────────────────────────────
        This footer pointed at `${hosts().site}/legal/terms` and `${hosts().site}/legal/privacy`.
        `micro-site` routes those pages at `/terms` and `/privacy` — its `ROUTES` table has no
        `legal` segment anywhere — so both links have been 404s. Measured through the estate
        gateway on 2026-08-04: `https://cloudsforge.localtest.me/legal/terms` → 404,
        `/terms` → 200.

        That is exactly the cost of a hand-written footer, and exactly what the shared one removes:
        the legal paths are now declared once, in `FOOTER_LEGAL_LINKS`, beside a test that reads
        `micro-site`'s own route table and fails if they disagree.

        NO `account` IS PASSED, and that is deliberate rather than an omission. This bundle
        contains no session concept at all — see the header of this file — so it has no roles to
        offer, and the footer's default with no account is to hide every operator surface. The
        safe default is the correct one here.
      */}
      <CloudsForgeFooter
        current={PRODUCT}
        note={
          <>
            This page is served independently of the systems it describes. If it is reachable and
            says nothing is wrong, that is a statement about what we can measure — not a promise.
          </>
        }
      />

      {/*
        LAST IN THE DOCUMENT, AND THEREFORE LAST IN THE TAB ORDER.

        The banner is a dialog and is explicitly NOT modal, which matters more on this page than on
        any other in the estate: the reader arrived to find out whether something is broken, and a
        consent dialog that trapped focus until they answered would stand between them and the one
        sentence they came for. They can ignore it, read the verdict, and answer afterwards.

        It renders NOTHING at all until it knows the reader has not already been asked, nothing on
        an origin where analytics would not report anyway (`analyticsAllowedHere()` refuses
        localhost, `.local` and `.localtest.me`), and nothing on a surface whose shell carries no
        measurement ID — which is why the three operator consoles in this batch mount the same
        component and never draw it.

        Neither button is styled as the primary one. `.cf-consent__choice` is one class with no
        modifier for both answers, and Reject comes first in the DOM so a reader scanning left to
        right meets the refusal before the acceptance. That is a compliance requirement rather than
        a preference; the argument is in ui.css above that rule.
      */}
      <CookieBanner />
    </>
  )
}

/**
 * The document head, from the route table.
 *
 * WAS `DocumentTitle`, and set only `document.title`. A status page is linked into chat threads
 * and pinned in tabs during an incident, so the tab title was the half that had been noticed —
 * but the link preview that appears when somebody pastes `/history` into that chat thread is drawn
 * from `og:title` and `og:description`, and those were typed once into `index.html` and described
 * the front page for all three routes.
 *
 * `applyMeta` now writes the title, the description, the robots directive, the Open Graph and
 * Twitter blocks and the canonical link, updating each tag in place so a client-side navigation
 * does not leave the previous route's description in the head beside the current one.
 *
 * `window.location.origin` is read HERE rather than inside the module: that is what keeps a
 * hostname out of the artefact, so one bundle serves localhost, a preview deployment and the apex
 * and composes correct absolute URLs on each.
 */
function DocumentMeta() {
  const { pathname } = useLocation()
  useEffect(() => {
    applyMeta(pathname, window.location.origin)
  }, [pathname])
  return null
}
