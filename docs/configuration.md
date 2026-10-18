# Configuration

This page lists everything you can configure: environment variables per app, Vercel project settings, the database connection, the fare rule (a database row), and the constants fixed in code. For the Africa's Talking side (USSD channel and callback), see [Africa's Talking](africas-talking.md).

**On this page:** [Environment variables](#environment-variables) · [Where values live](#where-values-live) · [Vercel projects](#vercel-projects) · [Neon](#neon-database) · [Fare rule](#fare-rule-tarifa) · [Constants in code](#constants-in-code)

---

## Environment variables

### `transport-client` (passenger app, USSD, driver API, GPS intake)

| Variable | Required | What it does | If missing |
|---|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string used by Prisma. In production, the Neon **pooled** host. | Every API call fails; the build fails (Prisma validates it at build time). |
| `USER_SESSION_SECRET` | in production | HMAC key for passenger session tokens (90 days). | Production: registration and sign-in answer 500 "Sessão indisponível" and every `/api/user/*` call answers 401. Development: a fixed development-only key is used. |
| `DRIVER_SESSION_SECRET` | in production | HMAC key for driver session tokens (30 days). | Production: driver sign-in answers 500 and `/api/driver/trip` and `/api/driver/seguidores` answer 401. Development: a fixed development-only key. |
| `AFRICASTALKING_API_KEY` | for SMS | Africa's Talking API key. Sandbox keys only reach the simulator. | SMS are not sent; each one is logged as `SMS não enviado para … AFRICASTALKING_API_KEY não configurada`. USSD itself keeps working. |
| `AFRICASTALKING_USERNAME` | with the key | Africa's Talking app username. `sandbox` for the sandbox. | Defaults to `sandbox`. |
| `AFRICASTALKING_SHORTCODE` | no | Sender ID or short code used as `from` on outgoing SMS (live accounts only). | Africa's Talking's default sender. |
| `USSD_CALLBACK_KEY` | recommended | Key that `/api/ussd` requires as `?key=` in the callback URL, so only Africa's Talking can call it ([Security → USSD callback](security.md#ussd-callback)). | Anyone can call `/api/ussd`. |
| `WALK_ROUTER_URL` | no | OSRM route service used for walks along the streets, up to the profile (`…/route/v1/foot`). For a router of our own. | The FOSSGIS foot router, `https://routing.openstreetmap.de/routed-foot/route/v1/foot`. |
| `TELERIVET_SECRET` | no (legacy) | Shared secret checked by `/api/ussd-telerivet`, the unused Telerivet gateway endpoint. | That endpoint skips the check. |

### `transport-admin` (back office)

| Variable | Required | What it does | If missing |
|---|---|---|---|
| `DATABASE_URL` | yes | Same database as the passenger app. | Every API call fails. |
| `ADMIN_SESSION_SECRET` | in production | HMAC key for the `admin_session` cookie (12 hours). | Production: sign-in answers 500 "Servidor sem configuração de sessão" and every `/api/*` answers 401. Development: a fixed development-only key. |
| `GPS_SERVER_URL` | no | The URL shown to whoever configures a GPS device when a device code is created. | `https://transport-mz.vercel.app/api/gps` |
| `NEXT_PUBLIC_LOG_LEVEL` | no | Browser log level of `lib/logger.ts`: `error`, `warn`, `info` or `debug`. | `error` |
| `E2E_DATABASE_URL`, `E2E_PORT`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | tests only | Playwright settings ([Testing](testing.md#admin-end-to-end-tests-playwright)). | Local defaults. |

### `transport-driver` (driver portal)

| Variable | Required | What it does | If missing |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Base URL of the passenger app, whose `/api/driver/*` and `/api/gps` the portal calls. **Inlined at build time**: change it, then rebuild. | `http://127.0.0.1:3000` |

### Generating secrets

Use a different random value for each secret and each environment:

```bash
openssl rand -base64 32
```

Changing a session secret signs out everyone holding a token of that kind: passengers, drivers or admins. That is also how you revoke all sessions at once ([Security](security.md#rotating-secrets)).

## Where values live

| Environment | Where | How to read them |
|---|---|---|
| Production and preview | Vercel → project → Settings → Environment Variables | `vercel env ls` lists the names; `vercel env pull .env.local` downloads the values of the Development environment into a local file |
| Local development | `.env` in each app folder (git-ignored) | [Getting started](getting-started.md#3-environment-files) |

Variables set in production on 2026-10-17 (names only):

| Vercel project | Production | Preview |
|---|---|---|
| `transport-mz` | `DATABASE_URL`, `USER_SESSION_SECRET`, `DRIVER_SESSION_SECRET`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_USERNAME`, `TELERIVET_SECRET` | `DATABASE_URL`, `USER_SESSION_SECRET`, `DRIVER_SESSION_SECRET` |
| `transport-mz-admin` | `DATABASE_URL`, `ADMIN_SESSION_SECRET` | `DATABASE_URL`, `ADMIN_SESSION_SECRET` |
| `transport-mz-driver` | `NEXT_PUBLIC_API_URL` (= `https://transport-mz.vercel.app`) | `NEXT_PUBLIC_API_URL` |

Preview deployments of `transport-mz` have no Africa's Talking key, so they never send SMS. Previews have their own `DATABASE_URL` entry, stored as a sensitive value. Check which database it points to (production or a Neon branch) before testing anything that writes on a preview.

## Vercel projects

One Vercel project per app, all connected to this GitHub repository:

| Project | Root Directory | Framework | Build command | Production domain |
|---|---|---|---|---|
| `transport-mz` | `transport-client` | Next.js | `prisma generate && next build` (`npm run build`) | `transport-mz.vercel.app` |
| `transport-mz-admin` | `transport-admin` | Next.js | `prisma generate && next build` (with a 4 GB heap) | `transport-mz-admin.vercel.app` |
| `transport-mz-driver` | `transport-driver` | Next.js | `next build` | `transport-mz-driver.vercel.app` |

The root `vercel.json` belongs to the legacy root app, which no project builds. `transport-client/vercel.json` only declares the framework. How deployments happen is in [Deployment](deployment.md).

## Neon database

- **Pooled vs direct.** The apps use the pooled host (`-pooler` in the host name). It routes through PgBouncer, which serverless functions need. For `psql`, `pg_dump` and schema changes, use the direct host: the same string without `-pooler` ([Database → Connecting](database.md#connecting)).
- **Scale to zero.** An idle Neon compute suspends after a few minutes, and the first query afterwards takes a moment longer while it resumes.
- **Branches.** A branch is an instant copy-on-write clone of a database. Use one for testing migrations or experimenting with production data, and delete it afterwards.
- **No migration history.** Production has no `_prisma_migrations` table. Apply schema changes as described in [Database → Schema changes](database.md#schema-changes-and-migrations).

## Fare rule (`Tarifa`)

Prices and the speeds used for arrival times live in the database, in the newest active `Tarifa` row. The web, USSD and the arrival SMS read it through `getFareRule()` (`transport-client/lib/fares.ts`). The admin reads the travel speed for its timetable views. Each server instance caches the rule for 60 s.

| Column | Default | Used for |
|---|---|---|
| `tarifaMinima` | 10 MT | Minimum fare. |
| `precoPorKm` | 10 MT | Fare = max(`tarifaMinima`, ⌈km × `precoPorKm`⌉), with km measured along the route's road path. |
| `fatorEstrada` | 1.3 | Straight line × factor ≈ road distance. Only used when a route has no path, or when USSD option 4 cannot match a route. |
| `velocidadeViagemKmh` | 30 km/h | Speed of the timetable buses, so it drives their positions, arrival times and trip times. |
| `velocidadeChegadaKmh` | 45 km/h | Arrival time in the fallback estimate used when a route has no path. |
| `ativa` | true | Only active rows are considered; the most recently updated one wins. |

There is no admin screen for it. Change it with SQL ([Database → Changing data](database.md#changing-data)), for example:

```sql
UPDATE "Tarifa" SET "precoPorKm" = 12, "updatedAt" = now() WHERE ativa;
```

If the table has no active row, the defaults above are used.

## Constants in code

These values are fixed in code. Change them with a code change and a deploy.

| Constant | Value | Where | Effect |
|---|---|---|---|
| `GPS_FRESH_MS` | 3 min | `transport-client/lib/vehiclePosition.ts`, `transport-admin/lib/vehiclePosition.ts` | A GPS fix newer than this replaces the timetable position. |
| `SERVICE_START_MIN`, `SERVICE_END_MIN` | 05:00, 21:00 (Maputo) | same files | Timetable buses run between these times and are parked at a terminal otherwise. |
| `TERMINAL_STOP_S` | 5 min | same files | Stop at each terminal before the next leg. |
| `MAX_ACCURACY_M` | 200 m | `transport-client/app/api/gps/route.ts` | Less precise fixes are ignored. |
| `MAX_FUTURE_MS` | 2 min | same file | A timestamp further in the future is replaced by the server time. |
| `NOTIFY_COOLDOWN_MS` | 30 min | `transport-client/lib/busSimulator.ts` | Minimum time between two arrival SMS for the same alert. |
| `CHECK_INTERVAL_MS` | 30 s | same file | Minimum time between two arrival checks in one server instance. |
| Alert window / SMS distance | 24 h / 1 km | same file | Alerts older than 24 h are ignored; the SMS goes when a moving bus is under 1 km away. |
| Waiting-passenger window | 3 h | `transport-client/app/api/driver/seguidores/route.ts` | Alerts counted on the driver portal. |
| `USSD_MAX`, `PAGE_SIZE` | 182 characters, 6 items | `transport-client/app/api/ussd/route.ts` | USSD screen length and list page size. |
| Fare rule cache | 60 s | `transport-client/lib/fares.ts` | |
| Walk paths | 2,000 kept in memory per instance; one router request a second per instance, skipped after a 2.5 s wait; 4 s timeout; CDN 7 days | `transport-client/lib/walkRoute.ts`, `app/api/walk/route.ts` | Walks along the streets on the maps. |
| Route path cache | 5 min | `transport-client/lib/vehiclePosition.ts` (`routePaths`) | Live map position polling. |
| Dashboard stats cache | 5 min | `transport-admin/app/api/dashboard/stats/route.ts` | |
| Session lifetimes | passenger 90 days, driver 30 days, admin 12 h | `lib/userSession.ts`, `lib/driverSession.ts`, `transport-admin/lib/adminSession.ts` | |
| Polling | home map 5 s, journey being followed 10 s, driver trip 30 s, waiting passengers 60 s, admin vehicle list 30 s, admin vehicle position 15 s, admin GPS card 30 s, admin vehicle operation 60 s, driver portal GPS send ≥ 15 s | page components | |

---

[← Viewing the data in Neon](neon-guide.md) · [Documentation index](README.md) · Next: [Passenger web app →](passenger-web.md)
