/**
 * The documents the scenarios are run against.
 *
 * Every field here is one `PublicStatus` declares in `src/lib/publicstatus.ts`, which was itself
 * read out of `beacon/src/publicstatus.ts`. Typed against the client's own declarations so that a
 * drift between them is a type error here rather than a scenario quietly asserting a shape
 * nothing produces.
 */
import type { PublicDay, PublicIncident, PublicStatus } from '../src/lib/publicstatus.ts'

/** Ninety days, all operational unless overridden. `at` is the last day in the window. */
export function window90(
  over: Readonly<Record<number, PublicDay['state']>> = {},
  end = '2026-08-03',
): PublicDay[] {
  const last = new Date(`${end}T00:00:00.000Z`).getTime()
  return Array.from({ length: 90 }, (_v, i) => {
    const day = new Date(last - (89 - i) * 86_400_000)
    return {
      date: day.toISOString().slice(0, 10),
      state: over[i] ?? ('operational' as const),
    }
  })
}

export function incident(over: Partial<PublicIncident> = {}): PublicIncident {
  return {
    reference: 'INC-2026-0044',
    group: 'Wallet',
    severity: 'sev2',
    state: 'investigating',
    openedAt: '2026-08-03T08:00:00.000Z',
    closedAt: null,
    updates: [{ at: '2026-08-03T08:05:00.000Z', body: 'We are looking at deposit confirmations.' }],
    ...over,
  }
}

export function status(over: Partial<PublicStatus> = {}): PublicStatus {
  return {
    generatedAt: '2026-08-03T09:00:00.000Z',
    state: 'operational',
    groups: [
      { group: 'Account', state: 'operational', uptime: window90() },
      { group: 'Wallet', state: 'operational', uptime: window90() },
      { group: 'Trading', state: 'operational', uptime: window90() },
    ],
    incidents: [],
    maintenance: [],
    omitted: 0,
    ...over,
  }
}

/** The path this bundle calls, spelled once. `beacon/src/server.ts:460`. */
export const STATUS_PATH = '/api/status/public'
