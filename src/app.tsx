/**
 * The route table.
 *
 * Every route is public. There is no `ProtectedRoute` in this repository and no `AuthProvider`
 * wrapping this tree — a status page behind a login is not a status page, and a bundle that can
 * redirect to a sign-in portal is a bundle that can strand a reader when that portal is the thing
 * that is down.
 *
 * `ROUTES` in src/lib/routes.ts is the single list; nginx.conf enumerates the same paths so that
 * an address which is NOT here answers 404 rather than 200, and `test/routes.test.ts` fails if the
 * three ever disagree.
 */
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/shell.tsx'
import { AboutPage } from './pages/about.tsx'
import { CurrentPage } from './pages/current.tsx'
import { HistoryPage } from './pages/history.tsx'
import { NotFoundPage } from './pages/not-found.tsx'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<CurrentPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="about" element={<AboutPage />} />
          {/* Unknown paths render inside the shell, so the reader keeps the navigation they need
              to get back to a page that works. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
