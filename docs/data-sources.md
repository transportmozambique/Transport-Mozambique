# Data sources

Where every piece of data in the platform came from, how it was brought in, under which terms, and what is made up. Read it before you present the data as real, or before you replace part of it.

**On this page:** [Summary](#summary) · [Stops and routes](#stops-and-routes) · [Road paths](#road-paths) · [Provinces and municipalities](#provinces-and-municipalities) · [Vehicles, drivers and owners](#vehicles-drivers-and-owners) · [Passengers](#passengers) · [Fare rule](#fare-rule) · [Data produced while running](#data-produced-while-running) · [Maps on screen](#maps-on-screen) · [Services](#services) · [Software](#software) · [Reference files in the repository](#reference-files-in-the-repository) · [Credits to show](#credits-to-show)

---

## Summary

Production on 2026-10-18:

| Data | Rows | Source | Real or made up | Terms |
|---|---|---|---|---|
| Stops (`Paragem`) | 1,079 `PAR-…` | An OpenStreetMap export of bus stops, named by reverse geocoding (Nominatim) | Real places; names are the nearest street | ODbL |
| | 823 `OSM-…` | OpenStreetMap, through the Overpass API | Real, as mapped by OpenStreetMap contributors | ODbL |
| Routes (`Via`) | 91 (`V…` and `VIA-…`) | The first data scripts, modelled on Maputo's EMTPM routes | Plausible routes, not an official list | |
| | 170 (`OSM` route refs such as `X12`, `C5`, `503`) | OpenStreetMap route relations (Chapas, EMTPM, Corujas, REM, RCM networks) | Real, as mapped | ODbL |
| Route paths | 261 | OSRM routing on OpenStreetMap roads (FOSSGIS and OSRM demo servers) | Computed | ODbL (the roads) |
| Provinces / municipalities | 11 / 2 | Written by the first data scripts | Real names (Mozambique's 11 provinces; Maputo, Matola) | |
| Vehicles (`Transporte`) | 111 | The first data scripts | Made up | |
| | 340 `ADA-001M`–`ADA-340M` | `import-osm.mjs --buses` | Made up | |
| Drivers (`Motorista`) | 111 | The first data scripts, with stock photos from Pexels | Made up | Pexels licence (photos) |
| | 340 | `add-drivers.mjs`, Mozambican name lists | Made up | |
| Owners (`Proprietario`) | 11 | The first data scripts | Made up | |
| Passengers (`Utente`) | 8 | People who signed up on the web or used USSD while testing | Real accounts | personal data ([Security](security.md)) |
| Fare rule (`Tarifa`) | 1 | Chosen by the team (10 MT minimum, 10 MT/km, 30 km/h) | An assumption, not an official tariff | |

## Stops and routes

### The first data (2026, before the code was imported here)

- **Stops.** `maputo-stops-data.json` (1,346 rows) and `matola-stops-data.json` (691 rows), at the repository root, are tab-separated exports of OpenStreetMap bus stops (`@id @lat @lon name`), despite the `.json` extension. `transport-admin/scripts/seed-with-geocoding.js` read them, removed the duplicates, and named each stop with **Nominatim** reverse geocoding (`nominatim.openstreetmap.org/reverse`, one request a second, as Nominatim's usage policy requires): the stop takes the name of its street or place. That is why many stops share a street's name ([Known limitations → Data](known-limitations.md#data)). They are the 1,079 stops with `PAR-` codes.
- **Routes.** `transport-admin/reorganize-vias-emtpm-routes.js` and the other `reorganize-vias-*.js` scripts at the root of `transport-admin` built 91 routes modelled on the routes of **EMTPM** (Empresa Municipal de Transporte Público de Maputo) and on the chapa corridors between Maputo and Matola, and linked the stops within 50 m of each. 70 have `V…` codes and 21 `VIA-…` codes. Their lines were drawn stop to stop, then put on the roads in 2026-10 ([Road paths](#road-paths)).

### OpenStreetMap import (2026-10-18)

`transport-client/scripts/import-osm.mjs` ([Database → Importing from OpenStreetMap](database.md#importing-stops-and-routes-from-openstreetmap)):

| | |
|---|---|
| Source | The **Overpass API**, the read-only query service of OpenStreetMap: `overpass-api.de`, with `maps.mail.ru` and `overpass.private.coffee` as fallbacks |
| Area | Bounding box -26.10, 32.30 to -25.70, 32.75: Maputo, Matola, Boane and Marracuene |
| Stops | Nodes tagged `highway=bus_stop`, `public_transport=platform` or `stop_position` with `bus=yes`, and `amenity=bus_station` |
| Routes | Relations `type=route` with `route=bus`, `minibus`, `share_taxi` or `trolleybus`. They belong to the networks OpenStreetMap tags as Chapas, EMTPM, Corujas, REM and RCM. |
| Added | 823 stops (`OSM-` codes), 170 routes (4,421 km), 13,975 route–stop links, and 651 stops linked to 35 existing routes |
| Download | `osm-data/` (git-ignored), so the same download can be imported again |

**Licence.** OpenStreetMap data is © OpenStreetMap contributors, available under the [Open Database License](https://www.openstreetmap.org/copyright) (ODbL). Using it in the apps is allowed with the credit shown on the maps. A database derived from it and shared publicly must be shared under the ODbL too.

## Road paths

Every route's `geoLocationPath` follows the roads. The paths were computed, not drawn by hand:

- **OSRM** (Open Source Routing Machine) on two public servers: the FOSSGIS server (`routing.openstreetmap.de`, car and foot profiles, run by the FOSSGIS association for the OpenStreetMap community) and the OSRM project's demo server (`router.project-osrm.org`). Both route on OpenStreetMap's roads and allow light use, one request a second.
- `transport-client/scripts/snap-paths.mjs` put the straight stretches of the first routes on the roads, and `scripts/redraw-from-osm.mjs` rebuilt the OpenStreetMap routes whose relation was out of order. Their answers are cached in `osm-data/road-cache.json` ([Database → Putting route paths on the roads](database.md#putting-route-paths-on-the-roads)).
- A route drawn in the admin ("Nova Via", "Redesenhar percurso") asks the same two servers from the administrator's browser.
- Walks on the passenger map are drawn with the FOSSGIS foot router, asked by the passenger app's server (`/api/walk`).

## Provinces and municipalities

The 11 provinces of Mozambique (Maputo Cidade, Maputo, Gaza, Inhambane, Sofala, Manica, Tete, Zambézia, Nampula, Cabo Delgado, Niassa) and the municipalities of Maputo and Matola were written by the first data scripts (`transport-admin/scripts/seed-provincias.js` and the seeds), with a centre point each. Every route belongs to one of the two municipalities. `Cidade` is empty.

## Vehicles, drivers and owners

**All of them are made up**, to demonstrate the platform. No record is a real vehicle, person or company.

| Rows | Made by | What |
|---|---|---|
| 111 vehicles | the first data scripts | Toyota, Mercedes-Benz, Mitsubishi, Volkswagen, Nissan, Isuzu and Hyundai minibuses and buses, with invented plates (`ACI-004M`…), one per first route or more |
| 340 vehicles | `import-osm.mjs --buses 2` | Toyota Hiace (15 seats) for chapas, Mercedes-Benz Sprinter (22) for EMTPM and Corujas, plates `ADA-001M` to `ADA-340M` |
| 111 drivers | the first data scripts | Invented names, ID (BI) and licence numbers, phones and `@transport.co.mz` emails. Photos are stock portraits from **Pexels** (`images.pexels.com`), free to use under the [Pexels licence](https://www.pexels.com/license/); they do not show the people named. |
| 340 drivers | `transport-client/scripts/add-drivers.mjs` | Common Mozambican first names and surnames, combined with a fixed seed (2026) so the same data always gives the same drivers; no photo ([Database → Drivers for the imported vehicles](database.md#drivers-for-the-imported-vehicles)) |
| 11 owners | the first data scripts | Invented transport companies; none is linked to a vehicle yet |

Phone numbers are in the Mozambican format (`+258 8x …`). Some may belong to real people by chance: never send SMS to drivers' numbers from the demo data.

## Passengers

`Utente` rows are created by people: registering on the web app, or using USSD option 1, which creates a passwordless account for the phone number. The 8 in production were created on the web and through USSD during development and testing. They are personal data ([Security](security.md)).

## Fare rule

The one `Tarifa` row, `padrao`, holds values chosen by the team, not an official tariff: 10 MT minimum, 10 MT per km along the route, buses at 30 km/h, 45 km/h for the arrival estimate on routes without a path, and a road factor of 1.3. Change them on the admin's Tarifa page ([Admin dashboard → Fare rule](admin-dashboard.md#fare-rule-tarifa)).

## Data produced while running

| Data | Produced by |
|---|---|
| Bus positions without GPS | Computed from the route's path, the time of day and the fare rule's speed (the timetable model, [GPS tracking](gps-tracking.md#how-a-position-is-chosen)). Not a published timetable. |
| GPS positions | Trackers, the Traccar Client app, or the driver portal on a phone, through `POST /api/gps`. None reports in production yet. |
| Arrival times, journeys, fares | Computed on each request from the above and the fare rule. |
| Arrival alerts (`MISSION`) | Passengers, on the web or by USSD. |
| Trip state (`emViagem`) | Drivers, in the portal or by USSD. |

## Maps on screen

| Use | Source | Terms |
|---|---|---|
| Vector map of all three apps (MapLibre GL) | **OpenFreeMap** (`tiles.openfreemap.org`): the `liberty` and `positron` styles and the `planet` vector tiles, built with the OpenMapTiles schema from OpenStreetMap data | Free, no key; credit OpenFreeMap, OpenMapTiles and OpenStreetMap (MapLibre shows it in the corner of each map) |
| Raster map on some admin pages (province, municipality and stop pages, and the route drawing pages) | **OpenStreetMap's tile server** (`tile.openstreetmap.org`) | The OpenStreetMap Foundation's [tile usage policy](https://operations.osmfoundation.org/policies/tiles/): light use, with credit. Fine for a few administrators; a busy public page would need another tile provider. |

## Services

| Service | Used for | Plan |
|---|---|---|
| [Africa's Talking](https://africastalking.com) | USSD menus and SMS ([Africa's Talking](africas-talking.md)) | Sandbox |
| [Vercel](https://vercel.com) | Hosting of the three apps ([Vercel, step by step](vercel-guide.md)) | Hobby |
| [Neon](https://neon.tech) | PostgreSQL database ([Viewing the data in Neon](neon-guide.md)) | Free |
| [GitHub](https://github.com/transportmozambique/Transport-Mozambique) | Code, pull requests, CI and the arrival-check schedule (GitHub Actions) | Free, public repository |
| [Traccar Client](https://www.traccar.org/client/) | Free, open-source Android and iOS app that turns a phone into a GPS tracker ([GPS tracking](gps-tracking.md#traccar-client-on-a-phone)) | |
| OSRM servers of FOSSGIS and of the OSRM project | Road and walking paths ([Road paths](#road-paths)) | Free, light use |
| Overpass API and Nominatim | One-off downloads of OpenStreetMap data and stop names, when the data was built | Free, light use |

## Software

The main open-source libraries: Next.js and React (all three apps), Prisma (database access), MapLibre GL (maps), Leaflet (the admin's stop page), Recharts (admin charts), Tailwind CSS (styles), bcryptjs (password and PIN hashes), the `africastalking` Node.js SDK, and Playwright and Jest (tests). The driver portal uses the Geist font (Google Fonts, SIL Open Font License). Versions are in each app's `package.json`.

## Reference files in the repository

These came with the original codebase. No running code uses them:

| File | What it is |
|---|---|
| `transport-admin/app/components/TruRoute-USSD-XML-Interface-1.4.pdf`, `…-1_5.pdf`, `TruRoute-SMPP-Interface-1.7.8.pdf`, `SSMI-1_7_4.pdf` | Interface specifications of USSD and SMS gateways, kept as reference from an earlier gateway plan. The platform uses Africa's Talking instead. |
| `neighborhood-mappings.json` | An early grouping of stops into Maputo neighbourhoods, made by `generate-neighborhood-mappings.js`. |
| `maputo-stops-data.json`, `matola-stops-data.json` | The stop exports described [above](#the-first-data-2026-before-the-code-was-imported-here). |

## Credits to show

When you present the platform or its data:

- **Maps and data:** "© OpenStreetMap contributors" (ODbL), "© OpenFreeMap", "© OpenMapTiles". The maps already show these.
- **Routing:** "OSRM / FOSSGIS". The passenger map's walks and the admin's route drawing already show it.
- **Demo data:** say that vehicles, drivers and owners are made up, and that times without GPS are estimates.

---

[← Database](database.md) · [Documentation index](README.md) · Next: [GPS tracking →](gps-tracking.md)
