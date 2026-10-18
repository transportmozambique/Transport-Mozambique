# Known limitations

What is incomplete, estimated or legacy on 2026-10-17, so that you do not mistake it for a bug, or build on it without knowing. Security gaps have their own list in [Security → Known gaps](security.md#known-gaps).

**On this page:** [Positions and times](#positions-and-times) · [Journeys](#journeys) · [Notifications](#notifications) · [Data](#data) · [Admin](#admin) · [Driver portal](#driver-portal) · [USSD and SMS](#ussd-and-sms) · [Code and repository](#code-and-repository)

---

## Positions and times

- **Most positions are estimates.** Without a GPS fix from the last 3 minutes, a bus's position comes from the timetable model: it shuttles along its route from 05:00 to 21:00 at the fare rule's speed ([GPS tracking](gps-tracking.md#how-a-position-is-chosen)). It is not a published schedule, and real buses do not follow it. Arrival times are as good as that model until vehicles report GPS.
- **Few GPS devices.** Real positions need a device code per vehicle and a phone or tracker that reports. Until vehicles are equipped, the map shows timetable positions.
- **No position history.** Each GPS fix overwrites the last one; there is no track to replay or analyse. `GeoLocation` holds rows from the initial import only.
- **Distances use the stored path.** A route without `geoLocationPath` falls back to straight lines between stops × `fatorEstrada` (1.3 by default).
- **Same speed everywhere.** Traffic, time of day and stop dwell times are not modelled; only the 5-minute stop at each terminal is.

## Journeys

- **Journey times are estimates** from the same model as above, for each bus at the moment you reach its stop. A late first bus makes you miss the next one; the planner does not know.
- **Walks are planned as straight lines**, timed at 4.5 km/h with a quarter added for streets. The planner walks up to 400 m to change buses, 300 m at either end to a stop near the one chosen, and 800 m from your position. A river or a motorway between two stops is not seen. The map draws walks along the streets, but the distance and minutes shown stay the planner's.
- **Street paths for walks depend on a free public router** (FOSSGIS, one request a second, light use only). When it is busy or down, walks are drawn as straight lines. Heavy traffic would need our own router (an OSRM or Valhalla server with the Mozambique OpenStreetMap extract), set with `WALK_ROUTER_URL`.
- **Some places are not connected.** Two small groups of routes (VIA-071, VIA-073, VIA-075 and VIA-111; and V111 in Manhiça) share no stop within 400 m with the other 256 routes. Journeys between them and the rest answer "Não há ligação" ([Data flow → Journey planning](data-flow.md#journey-planning)).
- **The network is cached 5 minutes** per server instance: a new stop, route or vehicle appears in the planner within 5 minutes.
- **The position is sent in the URL** of `/api/journeys` and so lands in Vercel's request logs ([Security → Public endpoints](security.md#public-endpoints)).

## Notifications

- **The arrival-SMS check needs traffic.** It runs while someone has the passenger map open, or asks for a stop or a journey (at most every 30 s per server instance), not on a timer ([Data flow → Arrival alert](data-flow.md#arrival-alert-and-sms)). With nobody on the web app, passengers waiting through USSD get no arrival SMS. A scheduled call to `POST /api/simulation {"action":"check"}` (Vercel Cron, or any external scheduler) would remove that dependency.
- Alerts older than 24 hours are ignored, and an alert sends at most one SMS every 30 minutes.

## Data

- **Stop names repeat.** Many stops carry the street name, so one route can list "Rua do Cajueiro (Fedel Castro)" eight times, and some terminals have names like "120". Users see these names on the web, in USSD and in SMS.
- **Imported routes** ([Database → OpenStreetMap](database.md#importing-stops-and-routes-from-openstreetmap)):
  - their vehicles (plates from `ADA-001M`) move on the timetable model until operators register the real ones with a GPS device;
  - both directions follow the outbound path, so on one-way streets the return trip is drawn on the wrong street; its stops more than 60 m from that path are left out;
  - the fare rule (10 MT per km by default) gives long routes fares well above what chapas charge.
- **Stop order is computed.** `ViaParagem` has no order column; stops are ordered by projecting them onto the route's path. A stop far from its path can land in the wrong place.
- **Coordinates are text.** Points are `"lat,lng"` strings and paths `"lng,lat;…"` (note the order); there is no PostGIS and no spatial index ([Database → Conventions](database.md#conventions-read-this-before-querying)).
- **`Cidade` is empty** and has no screen; municipalities link to provinces directly.
- **The fare rule has no screen.** Change `Tarifa` with SQL ([Configuration → Fare rule](configuration.md#fare-rule-tarifa)).
- **Owners' "Data de Início de Operações"** is stored in the `birthDate` column.

## Admin

- **Owner certificates are not stored.** The owner form's "Upload do Certificado (PDF)" is read in the browser but the API drops it; storing it needs file storage (for example Vercel Blob).
- **"Raio de Cobertura"** on the province and municipality forms only sizes the circle on the form's map.
- **Reports:** "Histórico", "Agendar", the custom report and the report preview pages only say "em desenvolvimento". The report preview shows the first 8 fields of up to 100 rows, and PDFs come from the browser's print dialog.
- **The dashboard is cached 5 minutes** per server instance; list pages are not.
- **A route's path cannot be redrawn** on its edit page; create a new route.
- **Searching for a phone** in the header search matches the digits as stored, with spaces (`87 183`).
- **No roles:** every administrator can do everything.

## Driver portal

- **The bus marker does not move.** The portal's map draws the route and places the bus at the start of the path ([Driver portal → Dashboard](driver-portal.md#dashboard-dashboard)).
- **Browser GPS stops in the background.** Sharing the phone's position from the portal only works while the page is open and the screen on; use Traccar Client for continuous tracking ([GPS tracking](gps-tracking.md#traccar-client-on-a-phone)).
- **Stale route after reassignment.** The route and vehicle are those of the sign-in; after the admin moves the driver, the driver signs out and in again.
- **Trip state does not affect positions.** "Iniciar" and "Finalizar" are a flag shared with USSD; they do not start or stop the bus on the map.

## USSD and SMS

- **Sandbox only.** USSD and SMS reach Africa's Talking's simulator, not real phones ([Africa's Talking → Going live](africas-talking.md#going-live)).
- **182 characters per screen.** Long names are cut with `..`, and accents are removed (GSM-7).
- **Telerivet** (`/api/ussd-telerivet`) is a second, unused gateway integration with older menus.

## Code and repository

- **Legacy root app.** `app/`, `lib/`, the root `package.json` and `vercel.json` are an older variant of the passenger app. No Vercel project builds it, it has diverged from `transport-client`, and its admin endpoints have no authentication. Do not deploy it.
- **One-off scripts.** 100 `.js` files at the repository root (including 24 `test-*.js`), 4 in `scripts/`, 38 at the root of `transport-admin` and 84 in `transport-admin/scripts`. They come from the initial data import and earlier fixes; several write to whatever `DATABASE_URL` points at. Read one before running it.
- **Three copies of the schema.** `prisma/schema.prisma` is the source of truth; `transport-client/prisma/schema.prisma` must be kept identical and `transport-admin/prisma/schema.prisma` differs only in its generator block. Change all three together.
- **Two copies of the position code.** `lib/vehiclePosition.ts` exists in the passenger app and the admin; a change to the timetable rules must go into both.
- **No CI and many old lint findings** ([Testing](testing.md#type-checks-and-lint)). The passenger app and driver portal have no automated tests.
- **Production has no migration history** (`_prisma_migrations`), so migrations are applied by hand ([Deployment → Database changes](deployment.md#database-changes-in-production)).
- **Mixed languages.** The UI and most identifiers are Portuguese; newer code comments and this documentation are English.

---

[← Troubleshooting](troubleshooting.md) · [Documentation index](README.md) · [Project home →](../README.md)
