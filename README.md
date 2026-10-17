# Transport Mozambique

A public-transport information platform for the Maputo–Matola area. Passengers find buses, fares and arrival times on the web or by USSD on any phone, and can ask for an SMS when their bus is close. Drivers start and end trips from their phone. Administrators manage routes, stops, vehicles, drivers and GPS trackers from a back office.

The network in production has 91 routes, about 1,080 stops and 111 vehicles in two municipalities (October 2026).

<img src="docs/images/passenger-home.png" alt="Passenger web app: live map of Maputo with buses on their routes" width="720">

## Live apps

| App | URL | Who uses it |
|---|---|---|
| Passenger web app | https://transport-mz.vercel.app | anyone; an account is only needed for arrival alerts |
| USSD service | `*384*848080#` in the [Africa's Talking simulator](https://developers.africastalking.com/simulator) (sandbox) | passengers without a smartphone; drivers (option 6) |
| Driver portal | https://transport-mz-driver.vercel.app | drivers, with their phone number and the PIN an administrator generated |
| Admin dashboard | https://transport-mz-admin.vercel.app | administrators |

USSD and SMS run on the Africa's Talking **sandbox**: they reach the simulator, not real phones ([Going live](docs/africas-talking.md#going-live)). Bus positions come from GPS where a vehicle reports one and from a timetable model otherwise ([GPS tracking](docs/gps-tracking.md)).

## How it fits together

Three Next.js apps share one PostgreSQL database (Neon) through Prisma, and each is its own Vercel project:

| Folder | Vercel project | What it serves |
|---|---|---|
| [`transport-client`](transport-client) | `transport-mz` | passenger web app, the USSD callback, the driver API, GPS intake, all SMS |
| [`transport-driver`](transport-driver) | `transport-mz-driver` | driver portal; calls the passenger app's driver API |
| [`transport-admin`](transport-admin) | `transport-mz-admin` | back office and its own API |

There is no message bus and no background worker: vehicle positions are computed when they are read, and the arrival-SMS check runs while the web app is in use. Details and diagrams: [Architecture](docs/architecture.md) and [Data flow](docs/data-flow.md).

```
.
├── transport-client/    passenger app + USSD + driver API + GPS intake
├── transport-driver/    driver portal
├── transport-admin/     admin dashboard (with the Jest and Playwright suites)
├── prisma/              schema.prisma: source of truth for the database
├── docs/                documentation
├── start-all.bat        starts the three apps on Windows (ports 3000, 3001, 3002)
└── app/, lib/, *.js     legacy root app and one-off scripts: not deployed
```

## Run it locally

You need Node.js 20 or newer and PostgreSQL 16 or newer. [Getting started](docs/getting-started.md) goes from an empty database to all three apps running, with demo data, sign-ins, a USSD session and a GPS position sent with `curl`. In short, after creating each app's `.env` ([Configuration](docs/configuration.md)):

```bash
cd transport-client && npm install && npm run dev            # http://localhost:3000
cd transport-driver && npm install && npm run dev            # http://localhost:3001
cd transport-admin  && npm install && npm run dev -- -p 3002 # http://localhost:3002
```

On Windows, `start-all.bat` opens the three in their own windows.

## Documentation

The [documentation index](docs/README.md) lists every page with reading paths. Most used:

- [Architecture](docs/architecture.md) · [Data flow](docs/data-flow.md) · [Database](docs/database.md)
- [Passenger web app](docs/passenger-web.md) · [USSD service](docs/ussd.md) · [Driver portal](docs/driver-portal.md) · [Admin dashboard](docs/admin-dashboard.md)
- [API reference](docs/api-reference.md) · [Deployment](docs/deployment.md) · [Testing](docs/testing.md) · [Security](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md) · [Known limitations](docs/known-limitations.md)

## Contributing

1. Branch from `main`. Every push builds a preview of the three apps on Vercel; merging to `main` deploys production ([Deployment](docs/deployment.md)).
2. Before pushing, run `npx tsc --noEmit` in each app you changed, and the admin suites when you touch the admin ([Testing](docs/testing.md)). The suites refuse to run against anything but a local database.
3. Schema changes go into all three `schema.prisma` copies. **Never run `prisma migrate deploy` on production**: it has no migration history. Apply changes as described in [Deployment → Database changes](docs/deployment.md#database-changes-in-production).

The UI is in Portuguese; code comments and documentation are in English.

---

Transport Mozambique © 2026 · [Documentation →](docs/README.md)
