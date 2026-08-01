/**
 * The chrome.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THIS IS THE ONE FRONTEND IN THE ESTATE THAT DOES NOT MOUNT `CloudsForgeBar`, AND THE REASON
 * IS THE POINT OF THE PAGE.**
 *
 * The shared bar always renders an account control: `AccountMenu` shows a "Sign in" button
 * whenever `account.signedIn` is false (`ui/packages/ui/src/index.tsx:623-631`). On every other
 * surface that is right. Here it is a dead end offered at the worst moment — the likeliest reason
 * somebody is reading this page is that identity is down, and a prominent button that sends them
 * to a portal which cannot answer makes the outage look like their fault. A button wired to
 * nothing would be worse still.
 *
 * So the chrome is the logo, the name and the navigation, and this bundle contains no session
 * concept at all: no token storage, no refresh, no `AuthProvider`, no `ProtectedRoute`. The logo
 * still links to the marketing site through `cloudsforgeHosts()`, so brand continuity survives
 * without importing the thing that can break.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { CloudsForgeLogo } from '@cloudsforge/ui'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { hosts } from '../lib/hosts.ts'
import { NAV, titleFor } from '../lib/routes.ts'

export function AppShell() {
  return (
    <>
      {/* The skip link is the first focusable thing in the document, and it becomes VISIBLE on
          focus — a skip link that stays hidden when focused is worse than none. */}
      <a className="st-skip" href="#main">
        Skip to status
      </a>

      <DocumentTitle />

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

      <main className="st-main" id="main">
        <Outlet />
      </main>

      <footer className="st-foot">
        <p>
          This page is served independently of the systems it describes. If it is reachable and
          says nothing is wrong, that is a statement about what we can measure — not a promise.
        </p>
        <p className="st-foot__links">
          <a href={hosts().site}>CloudsForge</a>
          {' · '}
          <a href={`${hosts().site}/legal/terms`}>Terms</a>
          {' · '}
          <a href={`${hosts().site}/legal/privacy`}>Privacy</a>
        </p>
      </footer>
    </>
  )
}

/**
 * The tab title, from the route table.
 *
 * A status page is linked into chat threads and pinned in tabs during an incident; a tab that
 * reads "Vite App" on every route is one nobody can find again among thirty others.
 */
function DocumentTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = titleFor(pathname)
  }, [pathname])
  return null
}
