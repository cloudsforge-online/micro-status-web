/**
 * The page's single source of data.
 *
 * One fetch, held once, shared by every screen — a status page that made the same call from three
 * components would triple the load on the one service it is describing, at the exact moment that
 * service is least able to take it.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THE STATE MACHINE HAS NO GREEN PATH THROUGH IT.** `outcome` starts null (meaning "we have not
 * asked yet") and every subsequent value is a `StatusOutcome`, three of whose four members are
 * failures. There is no field to default and no place to put a `?? 'operational'`, which is how
 * "green on unknown" is prevented structurally rather than by remembering.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * A LAST-GOOD DOCUMENT IS KEPT ACROSS A FAILED REFRESH, and shown as what it is: an observation
 * from a stated moment, not the current state. Blanking a page that is being read during an
 * incident because one poll timed out is worse than showing the last thing we actually knew — as
 * long as the page says how old it is, which `Observed` makes unavoidable.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPublicStatus, type StatusOutcome } from './beacon.ts'

/**
 * How often to re-ask.
 *
 * Sixty seconds against Beacon's own 30s scrape cadence: fast enough that a reader watching the
 * page sees a recovery without reloading, slow enough that a thousand people watching during an
 * incident are a thousand requests a minute rather than a load test.
 */
export const POLL_MS = 60_000

export interface StatusFeed {
  /** The most recent outcome, or null before the first attempt has settled. */
  readonly outcome: StatusOutcome | null
  /** The last outcome that carried a readable document, which may be older than `outcome`. */
  readonly lastGood: Extract<StatusOutcome, { kind: 'ok' }> | null
  readonly loading: boolean
  readonly refresh: () => void
}

export function useStatus(): StatusFeed {
  const [outcome, setOutcome] = useState<StatusOutcome | null>(null)
  const [lastGood, setLastGood] = useState<Extract<StatusOutcome, { kind: 'ok' }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void fetchPublicStatus(controller.signal).then((next) => {
      if (controller.signal.aborted || !mounted.current) return
      setOutcome(next)
      if (next.kind === 'ok') setLastGood(next)
      setLoading(false)
    })
    return () => controller.abort()
  }, [nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const timer = setInterval(() => {
      // A hidden tab does not poll. The reader is not looking, and a page left open for a week in
      // a background tab is otherwise ten thousand requests nobody reads.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      setNonce((n) => n + 1)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [])

  return { outcome, lastGood, loading, refresh }
}
