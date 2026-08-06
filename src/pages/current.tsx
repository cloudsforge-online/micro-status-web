/**
 * The page almost everybody reads: what is happening right now.
 *
 * The order is the reading order of somebody who has just been told "the site is down" — the
 * verdict and when it was observed, then anything currently broken, then the grid, then planned
 * work. Nothing above the fold requires scrolling to be understood, and nothing on the page states
 * a state without its observation time.
 */
import { IncidentCard } from '../components/incidents.tsx'
import { Observed } from '../components/observed.tsx'
import { StateChip } from '../components/state.tsx'
import { UptimeStrip } from '../components/uptime.tsx'
import { absoluteStamp } from '../lib/asof.ts'
import { pageState } from '../lib/degrade.ts'
import type { PublicIncident, PublicStatus } from '../lib/publicstatus.ts'
import { voiceOf } from '../lib/states.ts'
import { buildWindow, dayKey } from '../lib/uptime.ts'
import { useStatus } from '../lib/usestatus.ts'

export function CurrentPage() {
  const feed = useStatus()
  const page = pageState(
    feed.outcome,
    feed.lastGood === null ? null : feed.lastGood.status,
    feed.lastGood === null ? null : feed.lastGood.status.generatedAt,
  )
  const doc = page.document

  return (
    <div className="st-page">
      <section className="st-hero" aria-labelledby="verdict">
        <StateChip state={page.state} hero />
        <h1 className="st-hero__headline" id="verdict">
          {page.headline}
        </h1>
        <p className="st-hero__detail">{page.detail}</p>
        {/*
          The observation time sits with the verdict, not in a footer. "Operational" with the
          timestamp somewhere else is a claim about now that is really a claim about the last sync.
        */}
        <Observed at={page.asOf} />
        <p className="st-hero__actions">
          <button type="button" className="st-btn" onClick={feed.refresh} disabled={feed.loading}>
            {feed.loading ? 'Checking…' : 'Check again'}
          </button>
          {page.showingLastGood && (
            <span className="st-hero__stale">Showing the last answer we received.</span>
          )}
        </p>
      </section>

      {doc === null ? (
        <NothingToShow />
      ) : (
        <>
          <ActiveIncidents incidents={doc.incidents} />
          <Maintenance doc={doc} />
          <Groups doc={doc} />
        </>
      )}
    </div>
  )
}

/**
 * The empty state, which is the one that matters most.
 *
 * It offers no reassurance and no green. It says what we do not know, and it says where else to
 * look — because a reader who cannot get an answer here needs a next step that does not depend on
 * this page working.
 */
function NothingToShow() {
  return (
    <section className="st-void" aria-label="No status available">
      <h2>Nothing here is a verdict</h2>
      <p>
        We hold no status document we are willing to show you. Rather than draw an empty page in
        the colour of good news, we are saying plainly: we do not know.
      </p>
      <p>
        If you are checking because something you use is not working, treat that as the more
        reliable signal. This page failing does not mean the thing you are using has failed — and
        it certainly does not mean it is healthy.
      </p>
    </section>
  )
}

/** Open incidents — anything without a `closedAt`. Closed ones live on the History page. */
function ActiveIncidents({ incidents }: { incidents: readonly PublicIncident[] }) {
  const open = incidents.filter((incident) => incident.closedAt === null)
  if (open.length === 0) return null
  return (
    <section className="st-section" aria-labelledby="active">
      <h2 id="active">
        {open.length === 1 ? 'One open incident' : `${open.length} open incidents`}
      </h2>
      {[...open]
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
        .map((incident, index) => (
          <IncidentCard key={incident.reference ?? `${incident.group}-${index}`} incident={incident} />
        ))}
    </section>
  )
}

function Maintenance({ doc }: { doc: PublicStatus }) {
  if (doc.maintenance.length === 0) return null
  return (
    <section className="st-section" aria-labelledby="maintenance">
      <h2 id="maintenance">Scheduled maintenance</h2>
      <ul className="st-windows">
        {doc.maintenance.map((window) => (
          <li key={`${window.group}-${window.startsAt}`} className="st-window">
            <p className="st-window__head">
              <span className="st-window__group">{window.group}</span>
              <span className="st-window__when">
                {absoluteStamp(window.startsAt) ?? window.startsAt} —{' '}
                {absoluteStamp(window.endsAt) ?? window.endsAt}
              </span>
            </p>
            <p className="st-window__summary">{window.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The product-group grid.
 *
 * The unit of publication is the PRODUCT GROUP and never a service name — see the header of
 * `beacon/src/publicstatus.ts`. Each row carries its own strip, because a group that has
 * been fine for ninety days and a group that recovered an hour ago read identically from a chip.
 */
function Groups({ doc }: { doc: PublicStatus }) {
  if (doc.groups.length === 0) {
    return (
      <section className="st-section" aria-labelledby="groups">
        <h2 id="groups">Product groups</h2>
        <p className="st-quiet">
          The answer contained no product groups. That is not "everything is fine" — it is an
          answer we cannot read anything into, which is why the state above says so.
        </p>
      </section>
    )
  }
  // The window ends on the document's own observation day, not on the reader's clock: a reader
  // west of Greenwich late at night would otherwise be shown a trailing "unknown" bar for a day
  // Beacon had not reached yet.
  const endDay = dayKey(new Date(doc.generatedAt))

  return (
    <section className="st-section" aria-labelledby="groups">
      <h2 id="groups">Product groups</h2>
      <ul className="st-groups">
        {doc.groups.map((group) => (
          <li key={group.group} className="st-group">
            <div className="st-group__head">
              <h3 className="st-group__name">{group.group}</h3>
              <StateChip state={group.state} />
            </div>
            <p className="st-group__says">{voiceOf(group.state).sentence}</p>
            <UptimeStrip days={buildWindow(group.uptime, endDay)} group={group.group} />
          </li>
        ))}
      </ul>
      <Observed at={doc.generatedAt} verb="All groups observed" />
    </section>
  )
}
