# Project status

Where the project stands on 2026-10-18: what runs, what data it has, what is waiting for someone to act, and what changed recently. The limits that stay by design are in [Known limitations](known-limitations.md).

**On this page:** [What runs today](#what-runs-today) · [The data](#the-data) · [Waiting for action](#waiting-for-action) · [Next steps](#next-steps) · [History](#history)

---

## What runs today

| Part | State |
|---|---|
| Passenger web app | Live at https://transport-mz.vercel.app ([Passenger web app](passenger-web.md)). |
| Admin dashboard | Live at https://transport-mz-admin.vercel.app ([Admin dashboard](admin-dashboard.md)). |
| Driver portal | Live at https://transport-mz-driver.vercel.app. Drivers sign in with a PIN an administrator generates ([Driver portal](driver-portal.md)). |
| USSD and SMS | On the Africa's Talking **sandbox**: `*384*848080#` in the simulator, not on real phones. The callback is protected by a key ([Africa's Talking](africas-talking.md)). |
| Bus positions | The **timetable model** for every bus. GPS intake works (`/api/gps`, Traccar Client, the driver portal), but no vehicle has a device yet ([GPS tracking](gps-tracking.md)). |
| Database | Neon Postgres, branch `production` ([Neon guide](neon-guide.md)). |
| Hosting | Three Vercel projects; every merge into `main` deploys them ([Vercel guide](vercel-guide.md)). |

## The data

Production on 2026-10-18 ([counted in Neon](neon-guide.md#3-paste-a-query-and-run-it)):

| | |
|---|---|
| Routes | 261: the 91 first ones, and 170 from OpenStreetMap |
| Stops | 1,902, in Maputo (185 routes) and Matola (76) |
| Vehicles | 451: the 111 first ones, and 340 for the imported routes (plates `ADA-001M` to `ADA-340M`) |
| Drivers | 111, so the 340 imported vehicles have none yet |
| Passengers, alerts | 8 passengers, 3 arrival alerts, all from testing |
| Fare rule | 10 MT minimum, 10 MT per km, 30 km/h |

## Waiting for action

Changes that are merged and tested on a copy of production, but that only the owner can run on production, plus account settings:

1. **Run the data scripts on production.** Back up first (Neon → Branches → create a branch of `production`). Then, from `transport-client` with `DATABASE_URL` set to the direct connection string, run each script as a dry run, then with `--apply --production`:

   | Script | Effect | Details |
   |---|---|---|
   | `add-drivers.mjs` | a demo driver for each of the 340 vehicles without one | [Database](database.md#drivers-for-the-imported-vehicles) |
   | `snap-paths.mjs` | 49 routes' straight jumps put on the roads | [Database](database.md#putting-route-paths-on-the-roads) |
   | `redraw-from-osm.mjs --unlink-far 503,X05` | 9 routes redrawn from their OSM stops, 86 stops linked, 5 far stops unlinked | [Database](database.md#redrawing-routes-from-their-openstreetmap-stops) |

   A last `snap-paths.mjs` dry run should then list only V086.
2. **Redraw V086 by hand** (Rua dos Bons Amigos – Antena), in the admin: the route → "Redesenhar percurso" ([Admin dashboard](admin-dashboard.md#routes-vias)).
3. **Reset the Neon database password**, then update `DATABASE_URL` in `transport-mz` and `transport-mz-admin` and redeploy both ([Vercel guide](vercel-guide.md#environment-variables)).
4. **Store the session secrets as Secrets.** Vercel marks `USER_SESSION_SECRET` and `DRIVER_SESSION_SECRET` on `transport-mz` "Needs Attention" because they are readable Config values ([Vercel guide](vercel-guide.md#environment-variables)).

## Next steps

These need decisions, accounts or money, not code:

- **Go live with USSD and SMS** on the Mozambican networks: a production Africa's Talking app, a service code, credit ([Africa's Talking → Going live](africas-talking.md#going-live)).
- **Equip vehicles with GPS:** Traccar Client on each driver's phone, or trackers. The map then shows real positions instead of the timetable ([GPS tracking → Connecting a device](gps-tracking.md#connecting-a-device)).
- **Real drivers and vehicles** for the imported routes, in place of the demo ones.
- **Arrival SMS without web traffic:** a scheduled call to the arrival check ([Known limitations](known-limitations.md)).

## History

The pull requests merged into `main` of [transportmozambique/Transport-Mozambique](https://github.com/transportmozambique/Transport-Mozambique/pulls?q=is%3Apr+is%3Amerged):

| # | Date | Change |
|---|---|---|
| 1 | 2026-10-16 | Driver trip state and one fare rule shared by web and USSD |
| 2 | 2026-10-16 | Assessment: admin authentication, one trip estimate, USSD rebuilt, notification fixes |
| 3 | 2026-10-16 | Route paths follow the roads; Playwright CRUD tests for the admin |
| 4 | 2026-10-16 | Real vehicle GPS, and buses placed along the day (timetable model) |
| 5 | 2026-10-16 | Route drawing undo/redo, driver PINs and sessions, USSD passengers |
| 6–9 | 2026-10-16 | Admin creation without hardcoded credentials; driver portal without invented data; USSD driver screens within 182 characters; passengers only see their own data |
| 10–13 | 2026-10-17 | Fixes found while documenting; no bus promised after 21:00; seeded accounts sign in; optional USSD callback key; complete English docs |
| 14–17 | 2026-10-17 | Where to run queries; trip planner; planning from a start like ride-hailing (A → B → C) |
| 18–21 | 2026-10-17 | Stops and routes imported from OpenStreetMap, with vehicles; one place per terminal |
| 22–27 | 2026-10-18 | Following a whole journey on one map; walks along the streets; draggable sheet on phones; new driver portal layout; boarding at a chosen stop |
| 28 | 2026-10-18 | Admin: grouped sidebar, phone menu, new dashboard |
| 29 | 2026-10-18 | Data scripts: route paths on the roads, drivers for the imported vehicles |
| 30 | 2026-10-18 | Passengers who typed spaces in their phone could not sign in |
| 31–32 | 2026-10-18 | Admin e2e fix; unused map component removed |
| 33 | 2026-10-18 | Jumping routes redrawn from their OSM stops; "Redesenhar percurso" in the admin |
| 34 | 2026-10-18 | Neon guide |
| 35 | 2026-10-18 | `--unlink-far` for a route's far stops |
| 36 | 2026-10-18 | USSD route lists start with the route's code; ordinals in GSM-7 |
| 37 | 2026-10-18 | Step-by-step guides for Africa's Talking and Vercel, how a USSD request is handled, glossary, this page, documentation navigation |

---

[← Glossary](glossary.md) · [Documentation index](README.md) · Next: [Data flow →](data-flow.md)
