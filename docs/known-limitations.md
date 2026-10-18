# Known limitations

What is incomplete, estimated or legacy on 2026-10-18, so that you do not mistake it for a bug, or build on it without knowing. Each item says how to work around it now, or what it would take to remove it. Security gaps have their own list in [Security → Known gaps](security.md#known-gaps).

**On this page:** [Fixed on 2026-10-18](#fixed-on-2026-10-18) · [Positions and times](#positions-and-times) · [Journeys](#journeys) · [Notifications](#notifications) · [Data](#data) · [Admin](#admin) · [Driver portal](#driver-portal) · [USSD and SMS](#ussd-and-sms) · [Code and repository](#code-and-repository)

---

## Fixed on 2026-10-18

These were on this list and are no longer limitations:

| Was | Now |
|---|---|
| Arrival SMS only went out while someone used the web app | A GitHub Actions schedule runs the check every 5 minutes ([Data flow → Arrival alert](data-flow.md#arrival-alert-and-sms)). |
| The fare rule could only be changed with SQL | Admin → Configuração → **Tarifa** ([Admin dashboard → Fare rule](admin-dashboard.md#fare-rule-tarifa)). |
| The driver portal kept the route and vehicle of the sign-in | It asks again on open and every 5 minutes (`GET /api/driver/me`). |
| Drawing a route depended on the OSRM demo router alone | The admin asks the FOSSGIS router first and the demo router when it fails. |
| Searching for a phone needed the stored spacing (`87 183`) | Any 3 or more digits, in any spacing, with or without `258`. |
| The passenger's exact position was in the URL of `/api/journeys` and `/api/viagem`, and so in the request logs | The web app sends it in a `POST` body ([Security → Public endpoints](security.md#public-endpoints)). |
| "Histórico" and "Agendar" on the reports page led to "em desenvolvimento" pages | The buttons are gone. |
| 340 vehicles had no driver | Each has a demo driver ([Database → Drivers for the imported vehicles](database.md#drivers-for-the-imported-vehicles)). |
| 51 route paths drew straight lines across blocks | Snapped to the roads; the longest straight stretch left is 7.2 km on the EN1, where the road is straight ([Database → Putting route paths on the roads](database.md#putting-route-paths-on-the-roads)). |
| No CI | Every pull request type-checks the three apps, compares the three schemas and checks the documentation's links ([Testing → CI](testing.md#ci-on-github)). |

## Positions and times

- **Most positions are estimates.** Without a GPS fix from the last 3 minutes, a bus's position comes from the timetable model: it shuttles along its route from 05:00 to 21:00 at the fare rule's speed ([GPS tracking](gps-tracking.md#how-a-position-is-chosen)). It is not a published schedule, and real buses do not follow it.
  *Overcome:* give vehicles GPS. Each needs a device code and a tracker or a phone with Traccar Client ([Admin → Make a vehicle report GPS](admin-dashboard.md#task-gps)). Every equipped vehicle switches to real positions on its own; nothing else changes.
- **No position history.** Each GPS fix overwrites the last one; there is no track to replay or analyse. `GeoLocation` holds rows from the initial import only.
  *Overcome:* add a table of fixes (vehicle, time, point, speed), written by `POST /api/gps` next to the update it does now, and delete old rows on a schedule. Neon's free plan holds about 0.5 GB, so keep weeks, not years.
- **Distances use the stored path.** A route without `geoLocationPath` falls back to straight lines between stops × `fatorEstrada` (1.3 by default).
  *Overcome:* every route in production has a path. "Nova Via" in the admin always stores one.
- **One route path still cuts a corner.** V086 (Rua dos Bons Amigos – Antena) keeps a 2 km straight line: the street exists, but OpenStreetMap maps it with a break, so no router follows it.
  *Overcome:* Admin → Vias → V086 → **Redesenhar percurso** → "Começar pelo percurso atual", then drag the points of the straight stretch onto the streets the bus takes ([Admin → Fix a route](admin-dashboard.md#task-redraw)). Or join the two pieces of the street in OpenStreetMap (anyone with an account can edit it) and rerun `scripts/snap-paths.mjs` later.
- **The routers are free public services.** Drawing routes in the admin and the walks on the passenger map use the FOSSGIS and OSRM demo servers, which allow light use only. When both are down, "Nova Via" and "Redesenhar percurso" cannot save, and walks are drawn as straight lines.
  *Overcome:* wait and try again, which is enough for an admin. For heavy traffic, run an OSRM or Valhalla server with the Mozambique OpenStreetMap extract (a small VM is enough) and set `WALK_ROUTER_URL` for the walks; the admin's routers are `ROUTERS` in `transport-admin/app/components/RouteDrawer.tsx`.
- **Same speed everywhere.** Traffic, time of day and stop dwell times are not modelled; only the 5-minute stop at each terminal is.
  *Overcome:* the speed is on the admin's Tarifa page; lower it if buses are generally slower than 30 km/h. Speeds by time of day or by route would need new columns and a change in both copies of `lib/vehiclePosition.ts`. Vehicles with GPS are not affected.

## Journeys

- **Journey times are estimates** from the same model as above, for each bus at the moment you reach its stop. A late first bus makes you miss the next one; the planner does not know.
  *Overcome:* GPS on the vehicles, as above. "Acompanhar viagem" re-times the journey every 10 seconds, so a passenger following it sees a delay as soon as it shows.
- **Walks are planned as straight lines**, timed at 4.5 km/h with a quarter added for streets. The planner walks up to 400 m to change buses, 300 m at the end, and 800 m from your position. A river or a motorway between two stops is not seen. The map draws walks along the streets, but the distance and minutes shown stay the planner's.
  *Overcome:* rarely matters at these distances. A fix would ask the walking router for the walks of the 3 options shown before answering, at the cost of up to a second per search.
- **Some places are not connected.** Two small groups of routes (VIA-071, VIA-073, VIA-075 and VIA-111; and V111 in Manhiça) share no stop within 400 m with the other 256 routes. Journeys between them and the rest answer "Não há ligação" ([Data flow → Journey planning](data-flow.md#journey-planning)).
  *Overcome:* if those routes really meet others, link a shared stop to both in the admin (Paragens → the stop → Editar → tick the routes), or redraw the routes so they pass the shared stop.
- **The network is cached 5 minutes** per server instance: a new stop, route or vehicle appears in the planner within 5 minutes.
  *Overcome:* wait 5 minutes, or redeploy `transport-mz` to start fresh instances.
- **The start-point list still sends a rounded position in the URL.** `/api/destinos` gets the position rounded to about 110 m, which is in the request logs.
  *Overcome:* the same change as for `/api/journeys` (a `POST` body). It was left as it is because the point is already coarse.

## Notifications

- **The scheduled check can be late or paused.** GitHub starts scheduled workflows a few minutes late when it is busy, and pauses them in a repository with no activity for 60 days.
  *Overcome:* turn it back on under Actions → "Arrival SMS check" → Enable workflow. For a tighter schedule, use an external scheduler (cron-job.org, for example) that sends `POST https://transport-mz.vercel.app/api/simulation` with `{"action":"check"}`, or Vercel Cron on a paid plan.
- Alerts older than 24 hours are ignored, and an alert sends at most one SMS every 30 minutes. That is by design: passengers ask again for a new trip.

## Data

- **The data is a demonstration.** Stops and routes come from OpenStreetMap and from a first data set modelled on EMTPM's routes; vehicles, drivers and owners are made up ([Data sources](data-sources.md)).
  *Overcome:* replace them with the operators' real fleet and drivers through the admin. Check routes and stops against the operators' own lists and correct them in the admin.
- **Stop names repeat.** Many stops carry the street name, so one route can list "Rua do Cajueiro (Fedel Castro)" eight times, and some terminals have names like "120". Users see these names on the web, in USSD and in SMS.
  *Overcome:* rename stops in the admin (Paragens → the stop → Editar). Most names come from reverse geocoding (the nearest street), so someone who knows the landmarks ("Mercado Xipamanine", a school, a church) is the right person to do it.
- **Imported routes** ([Database → OpenStreetMap](database.md#importing-stops-and-routes-from-openstreetmap)):
  - their vehicles (plates `ADA-001M` to `ADA-340M`) and drivers are demonstration data;
  - both directions follow the outbound path, so on one-way streets the return trip is drawn on the wrong street; its stops more than 60 m from that path are left out;
  - the fare rule (10 MT per km by default) gives long routes fares well above what chapas charge.

  *Overcome:* replace the vehicles and drivers with real ones in the admin. For fares, lower "Preço por km" on the Tarifa page, or raise the minimum and lower the price per km, until the long routes look right; the page shows the effect before saving. Separate return paths would need a second path column on `Via`.
- **Stop order is computed.** `ViaParagem` has no order column; stops are ordered by projecting them onto the route's path. A stop far from its path can land in the wrong place.
  *Overcome:* the route's page in the admin lists the stops in this order, so a stop out of place shows there. Move the stop onto the road (Paragens → Editar), or unlink it from that route.
- **Coordinates are text.** Points are `"lat,lng"` strings and paths `"lng,lat;…"` (note the order); there is no PostGIS and no spatial index ([Database → Conventions](database.md#conventions-read-this-before-querying)). Fine at this size (1,902 stops).
  *Overcome:* not needed until the network is many times bigger. Neon supports PostGIS (`CREATE EXTENSION postgis`) if it ever is.
- **`Cidade` is empty** and has no screen; municipalities link to provinces directly. Ignore the table.
- **Owners' "Data de Início de Operações"** is stored in the `birthDate` column. Read it as that date.

## Admin

- **Owner certificates are not stored.** The owner form's "Upload do Certificado (PDF)" is read in the browser but the API drops it.
  *Overcome:* keep the certificates outside the system for now. Storing them needs file storage (Vercel Blob has a free tier), a column for the file's address on `Proprietario`, and the upload in the owner API.
- **"Raio de Cobertura"** on the province and municipality forms only sizes the circle on the form's map. Nothing uses it.
- **Reports are lists to print:** the preview shows the first 8 fields of up to 100 rows, and PDFs come from the browser's print dialog ("Save as PDF").
  *Overcome:* for a full table, run a query in the Neon SQL Editor and download the result ([Neon guide](neon-guide.md)).
- **The dashboard is cached 5 minutes** per server instance; list pages are not. The list pages are always current.
- **No roles:** every administrator can do everything, including adding and deleting administrators.
  *Overcome:* only create administrator accounts for people who should have full control. Roles would need a `role` column on `Administrador` and a check in `proxy.ts` or in each API.

## Driver portal

- **The bus marker is the phone's position.** The portal's map places the bus where the phone is, and at the start of the route's path until the browser gives a position. It is not the position passengers see, which comes from the vehicle's GPS or the timetable ([Driver portal → Dashboard](driver-portal.md#dashboard-dashboard)).
- **Browser GPS stops in the background.** Sharing the phone's position from the portal only works while the page is open and the screen on.
  *Overcome:* for continuous tracking, install Traccar Client on the phone with the vehicle's device code ([GPS tracking → Traccar Client](gps-tracking.md#traccar-client-on-a-phone)); it keeps sending with the screen off.
- **Trip state does not affect positions.** "Iniciar viagem" and "Terminar viagem" are a flag shared with USSD; they do not start or stop the bus on the map. Real positions come from GPS.

## USSD and SMS

- **Sandbox only.** USSD and SMS reach Africa's Talking's simulator, not real phones.
  *Overcome:* going live needs no code change: a paid Africa's Talking app, a USSD code on the Mozambican networks, a live API key on Vercel and credit. The steps, in order, are in [Africa's Talking → Going live](africas-talking.md#going-live).
- **182 characters per screen.** Long names are cut with `..`, and accents are removed (GSM-7). A limit of USSD itself; shorter stop names help.
- **Telerivet** (`/api/ussd-telerivet`) is a second, unused gateway integration with older menus. Nothing calls it.

## Code and repository

- **Legacy root app.** `app/`, `lib/`, the root `package.json` and `vercel.json` are an older variant of the passenger app. No Vercel project builds it and it has diverged from `transport-client`. Do not deploy it.
- **One-off scripts.** 100 `.js` files at the repository root (including 24 `test-*.js`), 4 in `scripts/`, 38 at the root of `transport-admin` and 84 in `transport-admin/scripts`. They come from the initial data import and earlier fixes; several write to whatever `DATABASE_URL` points at. Read one before running it. The maintained scripts are in `transport-client/scripts` ([Database](database.md)).
- **Three copies of the schema.** `prisma/schema.prisma` is the source of truth; `transport-client/prisma/schema.prisma` must be kept identical and `transport-admin/prisma/schema.prisma` differs only in its generator block. Change all three together; CI fails when they differ.
- **Two copies of the position code.** `lib/vehiclePosition.ts` exists in the passenger app and the admin; a change to the timetable rules must go into both.
- **Many old lint findings** ([Testing](testing.md#type-checks-and-lint)), so lint is not part of CI. The passenger app and driver portal have no automated tests; [Testing](testing.md#passenger-app-and-ussd-by-hand) lists what to check by hand.
- **Production has no migration history** (`_prisma_migrations`), so schema changes are applied by hand with idempotent SQL ([Deployment → Database changes](deployment.md#database-changes-in-production)).
- **Mixed languages.** The UI and most identifiers are Portuguese; newer code comments and this documentation are English.

---

[← Troubleshooting](troubleshooting.md) · [Documentation index](README.md) · [Project home →](../README.md)
