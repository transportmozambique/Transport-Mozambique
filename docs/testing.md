# Testing

What can be checked automatically, how to run it, and how to test by hand the parts that have no automated tests (passenger app, USSD, GPS, driver portal). There is no CI: run the checks below before opening a pull request. Vercel's build then type-checks again ([Deployment → Builds](deployment.md#builds)).

**On this page:** [Summary](#summary) · [A local test database](#a-local-test-database) · [Type checks and lint](#type-checks-and-lint) · [Admin: Jest](#admin-api-and-database-tests-jest) · [Admin: Playwright](#admin-end-to-end-tests-playwright) · [Passenger app and USSD by hand](#passenger-app-and-ussd-by-hand) · [GPS by hand](#gps-by-hand) · [Driver portal by hand](#driver-portal-by-hand) · [Legacy scripts](#legacy-test-scripts)

---

## Summary

| Check | Where | Command | Database | State on 2026-10-17 |
|---|---|---|---|---|
| Type check | each app | `npx tsc --noEmit` | none | passes in all three |
| Lint | each app | `npm run lint` | none | many old findings, so not a gate ([below](#type-checks-and-lint)) |
| Jest (API and database) | `transport-admin` | `npm test` | local only | 17 tests pass |
| Playwright (end to end) | `transport-admin` | `npm run test:e2e` | local only | 16 tests pass |
| Passenger app, USSD, GPS, driver portal | `transport-client`, `transport-driver` | by hand, below | local or production (read-only) | no automated tests |

## A local test database

Both admin suites write to the database, and both **refuse to run unless the database host is local** (`localhost`, `127.0.0.1` or `::1`). The forms need real-looking data (provinces, municipalities, routes with road paths, stops), so use a copy of production:

1. Restore a copy into a local PostgreSQL ([Getting started → Production data](getting-started.md#working-with-a-copy-of-production-data)), or use the demo seed for a quick run ([Getting started → 6](getting-started.md#6-load-demo-data)).
2. Point the suites at it. Playwright's default is `postgresql://postgres@127.0.0.1:55432/transport_test`; set `E2E_DATABASE_URL` for another one. Jest reads `DATABASE_URL` (environment, or `transport-admin/.env`).

The tests clean up the rows they create (all named `E2E …`), but a failing run can leave some behind. Never point a seed or a test at production.

## Type checks and lint

```bash
cd transport-client && npx tsc --noEmit
cd transport-admin  && npx tsc --noEmit
cd transport-driver && npx tsc --noEmit
```

All three pass. Vercel runs the same check during `next build`, so a type error blocks the deploy.

`npm run lint` (ESLint with the Next.js config) reports older findings in code that predates the current work, most of them `any` types and unescaped quotes in JSX:

| App | Errors | Warnings |
|---|---|---|
| `transport-admin` | 202 | 155 |
| `transport-client` | 15 | 23 |
| `transport-driver` | 2 | 2 |

Lint is therefore not a gate. Keep new and changed code free of findings: `npx eslint <files you changed>`.

## Admin: API and database tests (Jest)

`transport-admin/__tests__/api/`, 17 tests, run with `npm test` (`jest.config.js`, `ts-jest`):

| Suite | Checks |
|---|---|
| `database.test.ts` | the connection; counting and reading routes, stops and vehicles with their relations |
| `crud.test.ts` | reading each entity with the relations the pages use |
| `auth.test.ts` | creates an administrator, checks bcrypt hashing and lookup by email, deletes it |

They use Prisma directly, not HTTP. `jest.setup.js` stops the run if `DATABASE_URL` is not local:

```bash
cd transport-admin
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/transport_test npm test
```

## Admin: end-to-end tests (Playwright)

`transport-admin/e2e/`, 16 tests in Chromium against a production build of the admin. Details and options are in `transport-admin/e2e/README.md`.

| Spec | Covers |
|---|---|
| `crud.spec.ts` | For each of the nine entities: create through the form, find with the list search, open, edit, delete through the confirmation dialog. Also: drawing a route on the map (the OSRM call is answered locally), "Atribuir Transporte" on a route, deleting an owner who has a vehicle, deleting a stop that has a passenger alert, and 401 from the API without a session. |
| `gps.spec.ts` | The vehicle page's live position, and creating, using and revoking a GPS device code. |
| `pin.spec.ts` | Generating a driver PIN, shown once. |
| `search.spec.ts` | The header search: vehicles, routes and drivers, Enter, no results. |

```bash
cd transport-admin
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/transport_test npm run build   # the build needs a DATABASE_URL
npx playwright install chromium                                                     # first time only
npm run test:e2e
npx playwright show-report e2e/report                                               # HTML report
```

Playwright starts `next start` on port 3102 with the test database and a test session secret, and creates (or resets) the test administrator `e2e-admin@local.test`. Stop anything else on port 3102 first, or set `E2E_PORT`. A failed test keeps a trace and a screenshot in `e2e/test-results/`.

## Passenger app and USSD by hand

Start the passenger app on the local database (`npm run dev`, or `npm run build && npx next start -p 3000` with `USER_SESSION_SECRET` and `DRIVER_SESSION_SECRET` set, since production mode requires them).

**APIs.** Every endpoint and its expected answer is in the [API reference](api-reference.md#passenger-app-transport-client). A quick pass:

```bash
B=http://localhost:3000
curl -s "$B/api/simulation"                              # status, busCount
curl -s "$B/api/buses?fields=position" | head -c 300     # positions
curl -s "$B/api/stops" | head -c 300                     # stops and routes
TO=$(curl -s "$B/api/stops" | node -pe 'JSON.parse(require("fs").readFileSync(0)).paragens.find(p => p.nome === "Makalela").id')
curl -s "$B/api/journeys?lat=-25.7844&lng=32.5893&to=$TO" | head -c 300   # journeys from a position near Portão
```

**Web pages.** Open `/` (allow the location, or refuse it to see the map-centre list), tap a stop, type a destination, open a journey and "Acompanhar viagem" (the journey followed on `/viagem`), `/auth` (sign in with a seeded passenger) and `/user-info`. What each screen should show is in [Passenger web app](passenger-web.md).

**USSD.** Post the form fields Africa's Talking sends, with the whole answer history in `text`:

```bash
ussd() { curl -s -X POST "$B/api/ussd" --data-urlencode "sessionId=t1" \
  --data-urlencode "phoneNumber=+258840000001" --data-urlencode "text=$1"; echo; }
ussd ""         # main menu
ussd "2"        # Procurar rotas: places
ussd "2*1"      # routes from the first place
ussd "4*1"      # Calcular tarifa
ussd "7"        # Ajuda
```

Check that each screen starts with `CON` or `END` and stays within 182 characters. The menu tree with real screens is in [USSD service](ussd.md). To test with the real gateway, use the [Africa's Talking simulator](africas-talking.md#try-it-in-the-simulator), which talks to production.

## GPS by hand

1. In the admin, generate a device code for a vehicle ("Rastreador GPS").
2. Send a position as Traccar Client would:

   ```bash
   curl -s "$B/api/gps?id=<code>&lat=-25.9692&lon=32.5732&speed=10&bearing=90"   # {"ok":true}
   ```

3. The vehicle's card shows "GPS ativo"; `GET /api/bus/{id}` answers `"fonte": "gps"` at that point for 3 minutes.
4. Check the rejections: a wrong code (401), `lat=0&lon=0` (400), `accuracy=500` (ignored), an old `timestamp` (ignored). See [GPS tracking → Protocol](gps-tracking.md#protocol).
5. "Revogar dispositivo" afterwards.

## Driver portal by hand

Build the portal with `NEXT_PUBLIC_API_URL` pointing at the local passenger app (it is read at build time), generate a PIN for a driver in the admin, then sign in on a phone-sized window:

- "Iniciar viagem" and "Terminar viagem" change the trip; USSD `6*<PIN>*2` shows the same state, and `6*<PIN>*1*1` toggles it ([Driver portal](driver-portal.md)).
- With a device code saved in the info panel and location allowed, a trip sends positions; the admin's vehicle card turns "GPS ativo".
- A wrong PIN answers "PIN incorreto"; a driver without a PIN gets "Ainda não tem PIN…".

## Legacy test scripts

The repository root holds 24 `test-*.js` scripts (`test-ussd-*.js`, `test-api-*.js`, …) and `transport-admin` holds 16 more `test-*.js` and `check-*.js` scripts from the initial data import. They target older versions of the flows, some hard-code URLs or data, and several write to whatever `DATABASE_URL` points at. They are not part of the test suite; read one before running it ([Known limitations](known-limitations.md)).

---

[← Deployment](deployment.md) · [Documentation index](README.md) · Next: [Security →](security.md)
