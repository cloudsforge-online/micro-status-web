/**
 * What this page measures, and what it deliberately does not show.
 *
 * A status page that explains its own limits is more useful than one that implies omniscience.
 * Everything stated here is checkable against the source it names — the withheld list is
 * 13-operational-model.md:330-336 verbatim in substance, and the "no green on unknown" rule is
 * implemented in `src/lib/degrade.ts` and tested in `test/degrade.test.ts`.
 *
 * Static prose, no data, no fetch: this route renders identically when everything else is down,
 * which is the point.
 */
import { STATE_ORDER, voiceOf } from '../lib/states.ts'

export function AboutPage() {
  return (
    <div className="st-page st-prose">
      <h1>How we measure</h1>

      <p className="st-lede">
        This page renders one document, produced by our monitoring service and redacted before it
        leaves it. It is served without an account, without a session and without any dependency on
        our sign-in system — so that it keeps working when that is the thing that has broken.
      </p>

      <h2>What the states mean</h2>
      <dl className="st-defs">
        {STATE_ORDER.map((state) => {
          const voice = voiceOf(state)
          return (
            <div key={state} className="st-defs__row">
              <dt>
                <span className={`st-dot st-dot--${voice.tone}`} aria-hidden="true">
                  {voice.glyph}
                </span>{' '}
                {voice.label}
              </dt>
              <dd>{voice.sentence}</dd>
            </div>
          )
        })}
      </dl>

      <h2>The unit is a product group, not a service</h2>
      <p>
        Every state on this page describes a product group — Account, Wallet, Trading and so on —
        and never an individual service. A group is as healthy as its unhealthiest part. We do not
        publish which part that is.
      </p>

      <h2>What we deliberately withhold</h2>
      <p>
        Per-service latency, error rates, internal service names, replica counts, the names of
        individual checks, and the error text a failing system produced. Together those are an
        availability map: a page that tells you which service fell over first tells the same thing
        to somebody looking for a way in. We would rather have a less impressive page.
      </p>

      <h2>Missing is missing</h2>
      <p>
        A day with no measurement is drawn as a hollow bar and excluded from every percentage, and
        the number of measured days is printed next to every percentage for that reason. We do not
        fill gaps with zero and we do not fill them with success.
      </p>

      <h2>We will not show you green when we do not know</h2>
      <p>
        If our status service cannot be reached, refuses, or answers something we cannot read, this
        page says that it cannot determine status. An incomplete answer is allowed to report a
        problem — a known outage is still true — but it is never allowed to report health, because
        "nothing is wrong" is a claim about the absence of problems, and absence is exactly what an
        incomplete answer cannot establish.
      </p>

      <h2>Colour is never the only signal</h2>
      <p>
        Every state carries a shape and a word as well as a colour, and the uptime bars encode the
        day's state in their height too. Our own palette measures as little as ΔE 4.6 apart between
        "operational" and "degraded" for readers with the commonest form of colour blindness, which
        is a reason to add channels rather than to change the palette.
      </p>

      <h2>How current this is</h2>
      <p>
        The page re-asks once a minute while it is visible, and every figure is printed with the
        time it was observed, in UTC. If that time is more than a few minutes old we say so beside
        it — an old document served from a cache is the one way this page can be confidently wrong.
      </p>
    </div>
  )
}
