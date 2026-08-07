/**
 * What this page measures, and what it deliberately does not show.
 *
 * A status page that explains its own limits is more useful than one that implies omniscience.
 * Everything stated here is checkable against the source it names — the withheld list is
 * 13-operational-model.md verbatim in substance, and the "no green on unknown" rule is
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
        If something you use is broken, this page tells you whether we already know. It draws one
        document: our monitoring service builds it, strips out everything private, and hands over
        what is left. There is no account here, no session, and no tie to our sign-in system — so
        it keeps answering on the day sign-in is the thing that broke.
      </p>

      <p>
        CloudsForge is one platform with several products on it: a wallet, trading, a market,
        games, and a chain of its own. Everything below applies to all of them.
      </p>

      <h2>What the states mean</h2>
      <p>
        Five words, and only five. Four of them describe your service. The fifth describes what we
        managed to find out about it.
      </p>
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

      <h2>“Not determined” is an answer, not a loading state</h2>
      <p>
        When this page cannot get a reading, it has two options: say so, or paint the screen green
        and hope nobody checks. It says so.
      </p>
      <p>
        “Not determined” means we asked, came back empty-handed, and stopped. The page has
        finished. Reloading will not turn it into a colour, and waiting will not either.
      </p>
      <p>
        It does not mean your service is down. It does not mean your service is well. It means the
        measurement is missing, and we would rather hand you a hole than fill it with a guess.
      </p>
      <p>
        A partial answer is still allowed to report a fault — a known outage stays true whatever
        else went astray. It is never allowed to report health. “Nothing is wrong” is a claim about
        the absence of faults, and absence is the one thing a partial answer cannot establish.
      </p>

      <h2>The unit is a product group, not a service</h2>
      <p>
        Every state here belongs to a product group — Account, Wallet, Trading and the rest — and
        never to one service inside it. A group takes the state of whichever part of it is worst.
        Which part that was stays with us.
      </p>

      <h2>What we deliberately withhold</h2>
      <p>
        You will not find per-service latency here, and you will not find error rates, internal
        service names, replica counts, the names of individual checks, or the error text a failing
        system printed. Line those up and you have a map of where to push. We would rather run a
        duller page than draw that map for whoever is looking for it.
      </p>

      <h2>Missing is missing</h2>
      <p>
        A day we did not measure is drawn as a hollow bar and kept out of every percentage. That is
        why the count of measured days is printed beside every percentage. A gap is never filled
        with a zero, and it is never filled with a success.
      </p>

      <h2>Colour is never the only signal</h2>
      <p>
        Every state carries a shape and a word alongside its colour, and each bar in a strip
        encodes its day in height as well as fill. Two of our status hues sit ΔE 4.6 apart for
        readers with the commonest form of colour blindness — ΔE being the measured distance
        between two colours, and 4.6 being close enough to read as one colour. The answer to that
        is more channels, not a repaint.
      </p>

      <h2>How current this is</h2>
      <p>
        While this tab is in front of you, the page asks again once a minute. Every figure prints
        the moment it was observed, in UTC, so two people on a call quote the same time. If a
        figure is older than a few minutes we say so beside it — a cached document served as though
        it were live is the one way this page can be confidently wrong.
      </p>

      <h2>What an outage here does not touch</h2>
      <p>
        This page covers services we run, and services we run can fail. Two parts of CloudsForge do
        not sit behind them the way the rest does.
      </p>
      <p>
        Foresight settles on chain. It takes your stake in Bitcoin, Ethereum, Litecoin, Solana,
        XRP, EMBER or any token launched on this chain, and a winner claims the payout straight
        from the contract — with every CloudsForge server switched off.
      </p>
      <p>
        Mining pays a key we never hold. EMBER can be mined from an ordinary browser tab, and the
        key it pays goes nowhere near us. Whatever breaks on our side, those earnings were never
        ours to move.
      </p>
    </div>
  )
}
