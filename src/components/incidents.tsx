/**
 * One incident, as a customer is allowed to see it.
 *
 * Six fields and no seventh: `reference`, `group`, `severity`, `state`, `openedAt`/`closedAt` and
 * the public `updates` — the exact set `PUBLIC_INCIDENT_FIELDS` names at
 * `beacon/src/publicstatus.ts`. There is no `subject` here, no `cause`, no `lastError`,
 * no `detectedBy` and no failure count, because none of them exists in the document this
 * component is given. That is redaction by construction: this file could not render an internal
 * name if somebody wanted it to.
 *
 * `updates[].body` is the one free-text field on the page, and it is free text a HUMAN wrote:
 * `beacon/src/server.ts` only publishes an update when `public === true` was passed
 * explicitly, and 13-operational-model.md names the on-call operator as the only author. It
 * is rendered as text — never as markup — so a body containing HTML is shown, not run.
 */
import { Observed } from './observed.tsx'
import { incidentVoice, severityGloss, severityLabel } from '../lib/states.ts'
import type { PublicIncident } from '../lib/publicstatus.ts'
import { absoluteStamp } from '../lib/asof.ts'

export function IncidentCard({ incident, now }: { incident: PublicIncident; now?: Date }) {
  const lifecycle = incidentVoice(incident.state)
  const opened = absoluteStamp(incident.openedAt)
  const closed = absoluteStamp(incident.closedAt)
  const gloss = severityGloss(incident.severity)

  return (
    <article className="st-incident" aria-label={`${incident.group} incident`}>
      <header className="st-incident__head">
        <h3 className="st-incident__group">{incident.group}</h3>
        <span className="st-incident__state">
          <span aria-hidden="true">{lifecycle.glyph}</span> {lifecycle.label}
        </span>
        <span className="st-incident__severity" title={gloss ?? undefined}>
          {severityLabel(incident.severity)}
        </span>
      </header>

      <p className="st-incident__times">
        {/* Opened and closed are both absolute and both in UTC. An incident timeline in the
            reader's local zone is a timeline two people on a call cannot compare. */}
        Opened {opened ?? 'at an unstated time'}
        {closed !== null ? ` · Closed ${closed}` : ' · Not yet closed'}
      </p>

      {incident.reference !== null && (
        <p className="st-incident__ref">
          Reference <code>{incident.reference}</code>
        </p>
      )}

      {incident.updates.length === 0 ? (
        <p className="st-incident__quiet">
          No public update has been posted yet. We publish updates as we have them; silence here
          means nobody has written one, not that nothing is happening.
        </p>
      ) : (
        <ol className="st-updates">
          {/* Newest first: during an incident the last line is the one being refreshed for. */}
          {[...incident.updates]
            .sort((a, b) => b.at.localeCompare(a.at))
            .map((update) => (
              <li key={`${update.at}-${update.body.slice(0, 24)}`} className="st-update">
                <Observed at={update.at} verb="Posted" {...(now ? { now } : {})} />
                <p className="st-update__body">{update.body}</p>
              </li>
            ))}
        </ol>
      )}
    </article>
  )
}
