# Admin end-to-end tests (Playwright)

`crud.spec.ts` drives the admin UI in Chromium. For each of the nine entities (províncias,
municípios, paragens, vias, proprietários, motoristas, transportes, utentes, administradores)
it creates a row through the form, finds it with the list search, opens its detail page, edits
it, and deletes it through the confirmation dialog. It also checks that the API answers 401
without a session.

The other specs: `gps.spec.ts` (live position and GPS device codes), `pin.spec.ts` (driver PIN),
`search.spec.ts` (header search, and phones found by their digits) and `tarifa.spec.ts` (the
fare page; it puts the original values back).

The tests write to the database, so they only run against a **local** database:
`e2e/global-setup.ts` stops if `E2E_DATABASE_URL` points anywhere else. Rows are named
`E2E …` and every test deletes what it created.

## Run

1. Start a local PostgreSQL and create the schema:

   ```bash
   DATABASE_URL=postgresql://postgres@127.0.0.1:55432/transport_test npx prisma db push --schema ../prisma/schema.prisma
   ```

   Load data into it (the forms need at least one province, municipality and route in their
   dropdowns), e.g. a copy of the production data.

2. Build the app and run the tests (Playwright starts `next start` on port 3102 with the test
   database and a test session secret):

   ```bash
   npm run build
   npx playwright install chromium   # first time only
   npm run test:e2e
   ```

   `npx playwright show-report e2e/report` opens the HTML report; failed tests keep a trace and
   a screenshot in `e2e/test-results/`.

## Settings

| Variable | Default |
|---|---|
| `E2E_DATABASE_URL` | `postgresql://postgres@127.0.0.1:55432/transport_test` |
| `E2E_PORT` | `3102` |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | `e2e-admin@local.test` / `e2e-local-only-pass` |

The test admin is created (or its password reset) in the local database before each run. It
does not exist in production, so a server that is not using the test database fails the login
and no test runs.

The route test answers the public OSRM routing request itself, so it does not depend on that
service. Map tiles still load from the internet.
