/**
 * An address this app does not own.
 *
 * The document this renders inside was served with a real 404 — nginx enumerates the app's routes
 * and everything else falls through to `error_page 404 /index.html`, which keeps the status line
 * honest while still serving the shell. So this screen and the HTTP status agree, which is what
 * makes a monitor, a crawler and a link checker all reach the same conclusion a person does.
 */
import { Link } from 'react-router-dom'
import { NAV } from '../lib/routes.ts'

export function NotFoundPage() {
  return (
    <div className="st-page st-prose">
      <h1>Page not found</h1>
      <p className="st-lede">
        There is no page at this address. This is a 404 in the status line as well as on the screen
        — nothing about it says anything, either way, about whether the estate is healthy.
      </p>
      <ul className="st-links">
        {NAV.map((route) => (
          <li key={route.path}>
            <Link to={route.path}>{route.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
