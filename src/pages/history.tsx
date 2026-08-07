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
          <h2>The incident list did not reach us</h2>
          <p>{page.detail}</p>
          <p>
            Nothing has been deleted. The record sits with our status service, and this page will
            draw it as soon as that service answers.
          </p>
          <Observed at={page.asOf} />
        </section>
      ) : (
        <>
          <p className="st-lede">
            Newest first, this is every incident inside the window our status service publishes.
            An incident is listed whether or not anybody wrote a public update on it. Anything
            older than that window is absent, and this page has no way to tell you what.
          </p>
          <Observed at={page.asOf} verb="This incident list observed" />

          {doc.incidents.length === 0 ? (
            <p className="st-quiet">
              Nobody opened an incident inside this window. What you are reading is the state of
              the record, which is a narrower claim than the state of the world — an event no
              operator logged never reaches this list.
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
