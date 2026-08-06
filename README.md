# micro-status-web

[![ci](https://github.com/cloudsforge-online/micro-status-web/actions/workflows/ci.yml/badge.svg)](https://github.com/cloudsforge-online/micro-status-web/actions/workflows/ci.yml)
![licence](https://img.shields.io/badge/licence-MIT-97CA00)
![node](https://img.shields.io/badge/node-%3E%3D22-5FA04E?logo=node.js&logoColor=white)
![typescript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![module](https://img.shields.io/badge/module-ESM-F7DF1E?logo=javascript&logoColor=black)
![tests](https://img.shields.io/badge/tests-in--process%20DOM-6E56CF)

The CloudsForge **public status page**. It renders one document — Beacon's redacted public
projection — and it is the only unauthenticated surface in the estate that shows internal health.

It is read by people who are not customers, usually during an incident, and often on the word of
somebody else that something is broken. Two properties follow from that, and everything in this
repository serves one of them.

---

## 1. Nothing internal may be renderable

Not internal target names, not hostnames, not incident subjects, not stack traces, not customer
identifiers.

The estate has already had this failure. `02-target-architecture.md` records that the frozen
implementation's `redactStatus` leaked: `stack/infra/beacon/server.js` emitted internal target
names and incident subjects — `pay.rates`, `hearth.seed`.

The new `beacon/src/publicstatus.ts` fixes that at the source, by construction: a separate public
type, an explicit field allowlist, a runtime `seal()` and a compile-time `Exact<>` check. This
repository **re-states the same allowlist on the reading side**, and that is not redundancy:

- **Versions skew.** This bundle is cached in browsers and served from a CDN; Beacon is redeployed
  on its own schedule. A field added upstream reaches an *old* page, and the only thing that can
  refuse to render it is this code.
- **Beacon is not the only thing that can answer.** A gateway, a cache, a misrouted deploy or a
  compromised upstream can all put a document on this wire. `parseStatus` treats the response as
  hostile input.
- **`as` is not a check.** Nothing here casts a parsed value. Every field is read by name.

There is no spread, no `Object.assign`, no `...rest` and no `as` on parsed data anywhere in
`src/lib/publicstatus.ts`. `test/publicstatus.test.ts` bolts internal fields onto every level of a
well-formed document and asserts that the key set on the way out is unchanged and that none of the
injected values appears in `renderableStrings()` — plus the opposite direction, that the same
search *does* find the values which are meant to be public.

### Exactly what is rendered

Every field, and the allowlist in `beacon/src/publicstatus.ts` that permits it. The allowlist is
named rather than cited by line, because a line names a position in a file this repository does not
own and nothing here runs when micro-beacon edits it.

| Rendered | Source |
| --- | --- |
| `generatedAt`, `state`, `groups`, `incidents`, `maintenance` | `PUBLIC_STATUS_FIELDS` |
| `group`, `state`, `uptime` | `PUBLIC_GROUP_FIELDS` |
| `date`, `state` | `PUBLIC_DAY_FIELDS` |
| `reference`, `group`, `severity`, `state`, `openedAt`, `closedAt`, `updates` | `PUBLIC_INCIDENT_FIELDS` |
| `at`, `body` | `PUBLIC_UPDATE_FIELDS` |
| `group`, `summary`, `startsAt`, `endsAt` | `PUBLIC_MAINTENANCE_FIELDS` |

Nothing else exists in the document to render. `subject`, `cause`, `lastError`, `failures`,
`detectedBy`, `scope` and the internal `id` are absent from the public projection upstream.

### The one leak the projection can still carry

A **product group name**. `productGroup` is free text written by whoever registered the probe —
`PUT /v1/probes/:name` takes it straight from the request body (`beacon/src/server.ts`) — so a
mistyped or copy-pasted registration would put `pay.rates` on the most public page in the estate.
Beacon's field allowlist cannot catch that: the *field* is allowed, the *value* is not.

So `readGroupLabel()` checks the value for the shape of a display label. Letters, digits, spaces
and three punctuation marks; a dot, slash, colon or underscore is refused outright, because every
internal name in this estate is dotted and no product group is. It is a shape rule rather than a
frozen list of the seven known groups, so an eighth group appears the day it is added. A refusal is
**counted** (`omitted`), never silent — and any omission makes the page unwilling to claim health.

---

## 2. It never renders green on unknown

Green-on-unknown is the worst failure a status page can have: it converts an outage into an
accusation that the reader's connection is at fault, at the moment trust is most expensive.

The rule is structural rather than remembered:

> **An incomplete answer may report a problem. It may never report health.**

A known outage is still true when part of the document was unreadable — suppressing it would be its
own dishonesty. "Everything is fine" is a claim about the *absence* of problems, and absence is
exactly what an incomplete document cannot establish. So `verdict()` degrades a would-be
`operational` to `unknown`, and passes a real outage through unchanged.

`src/lib/degrade.ts` is a pure function with no branch that can produce `operational`, and
`test/degrade.test.ts` drives every failure outcome through it and asserts universally: none yields
green, none yields copy that reads like reassurance, and the one sentence that mentions health does
so only behind a negation (with a self-check proving the detector can fail).

Beacon is built fail-closed for the same reason: at the release gate an unmeasured thing refuses
rather than promotes.

### The four failures, named separately

| Outcome | What happened | What the page says |
| --- | --- | --- |
| `unreachable` | no answer: DNS, TLS, CORS, timeout | we cannot reach our own status service |
| `refused` | a non-2xx | our status service refused, with the code and request id |
| `unreadable` | a 200 we could not parse | we got an answer we could not read |
| `ok` | a document | the document, with its observation time |

They are not collapsed into "something went wrong", because a reader deciding whether to open a
ticket is entitled to the difference.

---

## The call

One route, verified by reading `buildRoutes()`:

```
GET /api/status/public      beacon/src/server.ts
```

- **Pre-auth** when `BEACON_PUBLIC_STATUS` is on (`server.ts`), so this client sends **no
  credential of any kind** — no bearer, no cookie (`credentials: 'omit'`), no `x-beacon-token`.
  There is no auth module in this repository at all.
- **No `/v1` prefix and no query string.** `test/beacon.test.ts` asserts the outgoing URL, method
  and headers rather than the parsed response — two defects have already shipped in this estate
  from a client built against an imagined surface.
- **8s timeout.** A hung request shows a spinner, and "still loading" during an incident reads as
  "the status page is down too".

### Where the request goes

This app's API is not its own host, which is the one way it differs from every other frontend here.
`src/lib/hosts.ts` resolves:

| Page served from | Request |
| --- | --- |
| the status surface (production) | relative — `/api/status/public` |
| Beacon's own origin | relative |
| Vite (`pnpm dev`) or anywhere else | absolute — Beacon's origin, `:4011` locally |

Relative in production is deliberate: one hostname, one certificate, no CORS preflight. Every extra
origin is another way for the status page to fail during the event it exists to describe.

> **Deploy dependency, not yet in place.** `deploy/gateway/dynamic/policy.yml` has **no route for
> the Beacon subdomain at all**, so neither the same-origin path rule nor a cross-origin call is
> currently wired. The gateway needs one rule: `/api/status/public` on the status host, routed to
> Beacon. Reported, not fixed — this agent does not modify the deploy repository.

---

## The uptime strip

Ninety bars, one per day, per product group. Three properties are load-bearing:

1. **The window is filled by DATE, never by position.** `dailyUptime` selects from `check_rollups`
   (`beacon/src/publicstatus.ts`), so a day with no rollup produces no row and the array
   simply skips it. Mapping it positionally draws 84 green bars where 90 belong and slides history
   sideways. A missing day is `unknown`, drawn **hollow**.
2. **No invented percentage.** The ratio is over *measured* days only, and the denominator is
   printed beside it. `percentText` never rounds up to 100% while a bad day is visible.
3. **Colour is never the only channel.** Height is ordinal — the worse the day, the shorter the bar
   — and every mark carries a word in its `<title>`, in the legend and in the exceptions table.

That third point is measured, not stylistic. The design system's reserved status hues
(`tokens.css`) run through the palette validator against the panel surface give
**ΔE 4.6 between good and warn under protanopia**. `tokens.css` independently refuses to
add a fourth status hue for the same class of reason. So maintenance takes the neutral diverging
midpoint plus an outline, "not measured" is hollow, and there is no fourth or fifth status colour.

---

## What is deliberately not here

- **No authentication.** No token storage, no refresh, no `AuthProvider`, no `ProtectedRoute`. A
  status page behind a login is not a status page, and the likeliest reason somebody is reading
  this one is that identity is down. Enforced by `test/routes.test.ts` and by a CI grep.
- **No `CloudsForgeBar`.** The shared bar always renders a "Sign in" button when there is no
  session (`ui/packages/ui/src/index.tsx`). Here that is a dead end offered at the worst
  moment. The chrome is the logo, the name and the navigation.
- **No error budgets or SLO figures.** There is no public route for them: `GET /v1/slos` requires
  `beacon:read` (`beacon/src/server.ts`). Rather than invent a number, the page shows only
  what the public projection carries.
- **No build-time configuration.** No `.env`, no `define`, no `VITE_`. Hosts resolve at runtime
  from `window.location.hostname`, so one image serves localhost, staging and production.

---

## Running it

```bash
pnpm install          # ../ui must be installed first; see the note in package.json
pnpm dev              # http://localhost:5188, talking to Beacon on :4011
pnpm typecheck
pnpm test             # node:test only. No Vitest, no React Testing Library.
pnpm build
```

The image:

```bash
docker build -t status-web --build-context uipkg=../ui .
docker run --rm -p 55550:8080 status-web
```

`nginx.conf` enumerates the app's routes and answers **404** for everything else, serving the shell
through `error_page 404 /index.html` so the status line stays honest. CI probes a running container
for that, and for the security headers on both the shell and a hashed asset — nginx's `add_header`
is all-or-nothing per level, and a location that sets `Cache-Control` silently drops every
inherited header. That defect shipped in the web template and was only found by probing a real
response.

---

## Provenance

The code in this repository was written by **Claude Opus 5** and **Claude Fable 5**, assets
generated with **FLUX 2 Pro**, under human direction and review.
