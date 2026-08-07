/**
 * The boot sequence.
 *
 * Two steps, and the missing third is the interesting one: there is no `bootstrapSession()` here,
 * because this bundle has no session to bootstrap. Every other frontend in the estate redeems an
 * SSO hand-off code before React mounts; this one has no auth module at all, so the page paints as
 * soon as the bundle arrives and never waits on a network call to a service that may be down.
 *
 *   1. Observability first, so an exception thrown by anything below is reported rather than lost.
 *      A crash during the first render of the page people read during an outage is the single most
 *      valuable event this app can send.
 *   2. Consent, primed denied. See the note beside `initAnalytics()`.
 *   3. Render.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@cloudsforge/ui/tokens.css'
import '@cloudsforge/ui/ui.css'
import './styles.css'
import { initAnalytics } from '@cloudsforge/ui/consent'
import { App } from './app.tsx'
import { initObs } from './lib/obs.ts'

initObs()

/*
 * Consent Mode is primed with every category DENIED before anything else runs — two pushes onto a
 * plain array, no request, no cookie, no script — and the analytics tag is loaded ONLY if this
 * reader granted consent on a previous visit. A first-time reader gets nothing until they press
 * Accept, and `readConsent()` is `null` rather than `'granted'` for them, which is the branch that
 * makes that structural rather than remembered.
 *
 * It goes HERE, before React mounts, rather than inside a component, because the denied default
 * has to be in place before any tag could conceivably arrive; a default installed after a script
 * has begun running is a race, and the losing branch of that race sets a cookie.
 *
 * On this page there is a second reason to keep it out of the render path. Everything below is
 * arranged so the verdict paints as soon as the bundle arrives and never waits on a network call
 * to a service that may be down — there is no `bootstrapSession()` here for exactly that reason.
 * `initAnalytics()` issues no request either, so it does not compromise that; it would if it were
 * ever allowed to become a fetch.
 */
initAnalytics()

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
