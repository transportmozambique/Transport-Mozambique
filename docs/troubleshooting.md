# Troubleshooting

Symptoms, their usual causes and the fix, grouped by where you notice them. For logs: Vercel → project → **Logs** (or `vercel logs <deployment url>`); for data: [Database → Connecting](database.md#connecting).

**On this page:** [Sign-in](#sign-in) · [USSD](#ussd) · [SMS](#sms) · [Positions and GPS](#positions-and-gps) · [Passenger web app](#passenger-web-app) · [Admin](#admin) · [Builds and deploys](#builds-and-deploys) · [Database](#database) · [Local development and tests](#local-development-and-tests)

---

## Sign-in

| Symptom | Cause | Fix |
|---|---|---|
| Driver: "Ainda não tem PIN. Peça ao administrador para gerar o seu PIN." | The driver has no PIN. Every production driver lost their old shared password on 2026-10-16. | Admin → Motoristas → the driver → "Gerar PIN" ([Admin dashboard → Drivers](admin-dashboard.md#drivers-motoristas)). |
| Driver: "Motorista não encontrado. Contacte o administrador." | No driver has that phone number. | Check the phone on the driver's page; `+258` and spaces do not matter. |
| Driver: "PIN incorreto" | Wrong PIN, or a newer PIN was generated. | Generate a new PIN and give it to the driver. |
| Driver: "Sessão indisponível. Contacte o administrador." (500) | `DRIVER_SESSION_SECRET` missing on `transport-mz`. | Set it and redeploy ([Configuration](configuration.md#environment-variables)). |
| Driver portal: "Erro de conexão. Verifique se o servidor está a funcionar." | The portal cannot reach `NEXT_PUBLIC_API_URL`, or the variable is wrong. It is fixed **at build time**. | Fix the variable on `transport-mz-driver` and redeploy (a rebuild, not just a restart). |
| Driver sent back to the sign-in page | The token expired (30 days), `DRIVER_SESSION_SECRET` was rotated, or the driver was deleted. | Sign in again. |
| Passenger: "Este número ainda não tem senha. Faça o registo para criar uma." | The account was created by USSD and has no password. | Register with the same phone; the account and its alerts are kept. |
| Passenger: "Sessão indisponível. Tente mais tarde." (500) | `USER_SESSION_SECRET` missing on `transport-mz`. | Set it and redeploy. |
| Passenger: "Telefone ou senha incorretos" | Wrong password; there is no reset by email or SMS. | Admin → Utentes → the passenger → edit, and set a new password. |
| Admin: "Servidor sem configuração de sessão" (500) | `ADMIN_SESSION_SECRET` missing on `transport-mz-admin`. | Set it and redeploy. |
| Admin: thrown back to `/login` | The 12-hour session ended, or the secret was rotated. | Sign in again. |
| Admin: nobody can sign in | No administrator exists, or the password is lost. | `node create-admin.js` in `transport-admin` with `DATABASE_URL` set ([Admin dashboard → Sign-in](admin-dashboard.md#sign-in-and-session)). |

## USSD

| Symptom | Cause | Fix |
|---|---|---|
| "END Erro ao processar pedido. Tente novamente." | An exception in the menu code, often the database (unreachable, or waking up). | Read the `❌ USSD Error` entry in the logs of `transport-mz`. |
| Every request gets `403 Forbidden` | `USSD_CALLBACK_KEY` is set but the callback URL in Africa's Talking has no `?key=`, or a different one. | Make the URL's key match the variable ([Security → USSD callback](security.md#ussd-callback)). |
| Sessions "Incomplete" in Africa's Talking | The phone left before an `END` screen, or the callback answered too late. A Neon database that scaled to zero adds a few seconds to the first request. | Retry. If it repeats, check the function duration in the Vercel logs. |
| Simulator shows nothing, or AT's default error | Callback URL wrong in AT, or the deployment is down. | AT → USSD → Service Codes; open the URL in a browser (a `GET` answers 405, which proves it is up). |
| A driver cannot use option 6 | Wrong PIN or no PIN; or the phone calling is not the driver's number. | Option 6 identifies the driver by the calling number. Check both in the admin. |
| Text cut with `..` | Screens are limited to 182 characters. | Expected ([USSD service](ussd.md#how-a-session-works)). |

## SMS

| Symptom | Cause | Fix |
|---|---|---|
| Log: `SMS não enviado para … AFRICASTALKING_API_KEY não configurada` | No API key in this environment. Previews never have one. | Set the key on `transport-mz` Production ([Africa's Talking](africas-talking.md#sms)). |
| Log: "The supplied authentication is invalid" | A key generated minutes ago, or a key of another app or account, or the username does not match the key's app. | Wait a few minutes; check `AFRICASTALKING_USERNAME`. |
| Log: "The server was not able to produce a timely response" | AT's sandbox messaging API is slow at times. | Nothing on our side; the SMS is not retried. |
| SMS sent but no phone receives it | The sandbox only delivers to the simulator. | Expected until [going live](africas-talking.md#going-live). |
| No arrival SMS for a waiting passenger | The check only runs while someone uses the web app; the alert is older than 24 h; an SMS for it went out in the last 30 min; or no **moving** bus on a route through the stop is within 1 km. | Trigger the check: `curl -X POST https://transport-mz.vercel.app/api/simulation -H "Content-Type: application/json" -d '{"action":"check"}'` and read `lastArrivalCheck` ([Known limitations](known-limitations.md#notifications)). |

## Positions and GPS

| Symptom | Cause | Fix |
|---|---|---|
| All buses parked at terminals | Outside service hours (before 05:00 or after 21:00, Maputo time). | Expected ([GPS tracking](gps-tracking.md#how-a-position-is-chosen)). |
| A bus stands still for a few minutes | It is at a terminal (5 minutes per stop). | Expected. |
| A bus jumps between two places | Its GPS device reports less often than every 3 minutes, so it alternates between GPS and timetable. | Report more often (Traccar Client: 15 s). |
| Device gets 401 "Código do dispositivo em falta" | The request carries no code (no `id`, `deviceid` or `Authorization: Bearer`). | Enter the code as the device identifier ([GPS tracking](gps-tracking.md#traccar-client-on-a-phone)). |
| Device gets 401 "Dispositivo desconhecido" | The code was mistyped, regenerated or revoked. | Generate a new code and enter it on the device. |
| Device gets 400 "Coordenadas inválidas" | Missing coordinates, or 0,0 (no fix yet). | Wait for a fix; check the device's location permission. |
| `{"ok":true,"ignored":"precisão insuficiente"}` | Reported accuracy worse than 200 m. | Better sky view; "high accuracy" in the app. |
| `{"ok":true,"ignored":"posição mais antiga do que a última"}` | A queued or repeated fix older than the stored one, or the device clock is behind. | Usually harmless. If constant, check the device's clock. |
| Admin says "GPS ativo" but passengers see the timetable position | Positions arrive with a timestamp more than 3 minutes old (device clock behind). | Fix the device clock or send no timestamp. |
| A bus is missing from the map (admin list: "Sem rota") | Its route has no path and it has no stored position, or it has no route. | Give the vehicle a route that has a path. |

## Passenger web app

| Symptom | Cause | Fix |
|---|---|---|
| A stop is grey on the map and missing from the search | None of its routes has a vehicle. | Assign a vehicle to one of its routes. |
| "Não há ligação de autocarro entre estes dois locais" | No chain of buses joins the two places. A few routes form separate groups with no stop within 400 m of the rest ([Data flow → Journey planning](data-flow.md#journey-planning)). | Choose a stop near the destination, or connect the groups in the admin (a shared stop, or a route between them). |
| "A localização está desativada…" | The browser's location permission was refused. The list then follows the map centre. | Allow the location in the site settings, then the round button at the bottom right. Browsers only give the location on HTTPS or localhost. |
| "Está fora da área servida" | The position is more than 80 km from Maputo. | Expected outside the area: move the map or tap a stop. |
| Stops listed in an odd order | The order is computed along the route's path; a stop far from the path can move. | Check the stop's position and the path in the admin. |
| "Entre na sua conta para receber o SMS." | No session when asking for the SMS alert while following a journey. | Sign in at `/auth`. |
| Times say "amanhã às 05:12" | Evening or night search: buses run 05:00–21:00. | Expected. |

## Admin

| Symptom | Cause | Fix |
|---|---|---|
| Dashboard numbers out of date | The statistics are cached 5 minutes per server instance. | Wait, or check the list pages. |
| "Nova Via": "Não foi possível calcular o percurso pelas estradas" | The public OSRM router did not answer (down or rate-limited). | Move or add a point to retry later. |
| Map tiles missing | OpenFreeMap or OpenStreetMap blocked by the network. | Check access to `tiles.openfreemap.org`. |
| "Não é possível eliminar …" | Deleting a record that still has dependants (a province with municipalities, a vehicle with a driver, …). | Remove the dependants first ([API reference → Deleting](api-reference.md#lists-and-records)). |
| Header search does not find a driver by phone | Phones are matched as stored, with their spaces. | Type a part without spaces (`1581`) or with the stored spacing. |

## Builds and deploys

| Symptom | Cause | Fix |
|---|---|---|
| Build fails with a TypeScript error | Vercel type-checks during `next build`. | Run `npx tsc --noEmit` locally and fix. |
| Admin build: `Invalid value undefined for datasource "db"` | `DATABASE_URL` missing at build time. | Set it for the environment being built. |
| Admin build runs out of memory | The build needs a 4 GB heap. | Keep `NODE_OPTIONS=--max-old-space-size=4096` in the build script. |
| A changed environment variable has no effect | Variables apply to new deployments only; `NEXT_PUBLIC_*` are inlined at build. | Redeploy ([Deployment](deployment.md#deploying-by-hand)). |

## Database

| Symptom | Cause | Fix |
|---|---|---|
| `The column … does not exist` / `The table … does not exist` | Code deployed before its migration was applied in production. | Apply the migration ([Deployment → Database changes](deployment.md#database-changes-in-production)), or roll back the code. |
| `Can't reach database server` (P1001) | Wrong host, or the Neon project is suspended or over quota. | Check the Neon console and `DATABASE_URL`. |
| Too many connections | Serverless functions using the direct host. | Use the pooled host (`-pooler`) in the apps; the direct host only for tools. |
| `prisma migrate deploy` wants to recreate everything | Production has no migration history. | Never run it on production; follow [Deployment → Database changes](deployment.md#database-changes-in-production). |

## Local development and tests

| Symptom | Cause | Fix |
|---|---|---|
| Two apps want port 3000 | The admin's `npm run dev` has no port. | `npm run dev -- -p 3002` ([Getting started → Run](getting-started.md#7-run-the-apps)). |
| Driver sign-in fails locally under `next start` | Production mode refuses sessions without `DRIVER_SESSION_SECRET`. | Set it (any value) or use `npm run dev`. |
| Playwright: "Could not find a production build" | The suite serves the built app. | `npm run build` first (with `DATABASE_URL` set). |
| Playwright or Jest: "refusing to run against …" | The suites only write to a local database. | Point `E2E_DATABASE_URL` / `DATABASE_URL` at a local copy ([Testing](testing.md#a-local-test-database)). |
| Playwright: port 3102 in use | A server from an earlier run is still up. | Stop it, or set `E2E_PORT`. |
| `pg_restore` fails on a production dump | The dump is from PostgreSQL 18; the tools or server are older. | Use PostgreSQL 18 tools and server ([Getting started → Production data](getting-started.md#working-with-a-copy-of-production-data)). |

---

[← Security](security.md) · [Documentation index](README.md) · Next: [Known limitations →](known-limitations.md)
