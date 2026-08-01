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
 *   2. Render.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@cloudsforge/ui/tokens.css'
import '@cloudsforge/ui/ui.css'
import './styles.css'
import { App } from './app.tsx'
import { initObs } from './lib/obs.ts'

initObs()

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
