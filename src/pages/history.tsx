/**
 * History: every incident in the window Beacon publishes, and where each one sits.
 *
 * The window is Beacon's, not ours. `GET /api/status/public` returns `listRecent(sql,
 * deps.incidentWindowDays)` (`beacon/src/server.ts`), so this page shows what that call
 * returned and says so — rather than implying it is the complete history of the estate, which it
 * is not and which this page has no way to establish.
 */
import { IncidentCard } from '../components/incidents.tsx'
import { Observed } from '../components/observed.tsx'
import { pageState } from '../lib/degrade.ts'
import { useStatus } from '../lib/usestatus.ts'

export function HistoryPage() {
  const feed = useStatus()
  const page = pageState(
    feed.outcome,
    feed.lastGood === null ? null : feed.lastGood.status,
    feed.lastGood === null ? null : feed.lastGood.status.generatedAt,
  )
  const doc = page.document

  return (
    <div className="st-page">
      <h1>Incident history</h1>

      {doc === null ? (
        <section className="st-void">
          <h2>We hold no history to show</h2>
          <p>{page.detail}</p>
          <Observed at={page.asOf} />
        </section>
      ) : (
        <>
          <p className="st-lede">
            Every incident our status service published in its current window, newest first. An
            incident appears here whether or not anybody wrote a public update for it.
          </p>
          <Observed at={page.asOf} verb="This list observed" />

          {doc.incidents.length === 0 ? (
            <p className="st-quiet">
              No incidents in the published window. That is the absence of a record, which is not
              quite the same claim as the absence of an event — an incident nobody opened does not
              appear here.
            </p>
          ) : (
            <ol className="st-history">
              {[...doc.incidents]
                .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
                .map((incident, index) => (
                  <li key={incident.reference ?? `${incident.group}-${index}`}>
                    <IncidentCard incident={incident} />
                  </li>
                ))}
            </ol>
          )}
        </>
      )}
    </div>
  )
}
