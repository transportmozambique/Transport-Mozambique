# Documentation

Transport Mozambique is a public-transport information platform for the Maputo–Matola area. Passengers find buses and arrival times on the web or by USSD on any phone. Drivers run their trips from a phone. Administrators manage the network from a back office. This folder explains how every part works, how the parts connect, and how to run, configure, query and deploy them.

Each topic has its own page. The pages assume a technical reader: they cite file paths, endpoints, table names and the commands that were used to check them.

## Pages

### Start here

| Page | What it covers |
|---|---|
| [Getting started](getting-started.md) | Run the whole platform locally from an empty database, sign in to every app, try USSD and GPS with `curl`. |
| [Architecture](architecture.md) | The three deployed apps, what each one owns, how they talk to each other and to the outside services, the tech stack and the repository layout. |
| [Data flow](data-flow.md) | Sequence diagrams for every flow: journey planning and arrival time, live map, arrival SMS, USSD session, driver trip, GPS position, admin changes. |
| [Database](database.md) | Entity diagram, every table, storage conventions, how to connect (psql, Prisma Studio, Neon console), tested example queries, migrations. |
| [Configuration](configuration.md) | Every environment variable of every app, Vercel and Neon settings, the fare rule, timetable constants. |

### Using each part

| Page | What it covers |
|---|---|
| [Passenger web app](passenger-web.md) | Live map with your position, stops near you, a stop's destinations, journeys with changes of bus, following a journey with all its buses, account and arrival alerts, with the API call behind each screen. |
| [USSD service](ussd.md) | The full menu tree with real screens, pagination rules, what each option reads, writes and sends by SMS, and how to test it. |
| [Driver portal](driver-portal.md) | PIN sign-in, starting and ending a trip (shared with USSD), sharing the phone's GPS, passengers waiting along the route. |
| [Admin dashboard](admin-dashboard.md) | Every back-office page: network data, vehicles with live position, GPS trackers, driver PINs, reports. |
| [GPS tracking](gps-tracking.md) | How positions are produced (real GPS or timetable), setting up a tracker or Traccar Client, the ingestion protocol. |
| [Africa's Talking](africas-talking.md) | The USSD channel and SMS: account, sandbox, callback URL, simulator walkthrough with screenshots, going live. |

### Reference and operations

| Page | What it covers |
|---|---|
| [API reference](api-reference.md) | Every HTTP endpoint of the passenger app and the admin app: method, authentication, parameters, real responses. |
| [Deployment](deployment.md) | The three Vercel projects, how a change reaches production, database migrations in production, checking a deploy. |
| [Testing](testing.md) | Admin Jest and Playwright suites, type checks, testing USSD, GPS and the APIs by hand. |
| [Security](security.md) | Sessions and tokens of each app, secrets, public endpoints, what is stored hashed, rotation. |
| [Troubleshooting](troubleshooting.md) | Symptoms, causes and fixes for the problems you are most likely to meet. |
| [Known limitations](known-limitations.md) | What is incomplete, simulated or legacy, so you do not mistake it for a bug, or build on it. |

## Suggested reading paths

- **You want to see it working:** open the [live apps](../README.md#live-apps), then follow [Getting started](getting-started.md).
- **You will change the code:** [Architecture](architecture.md) → [Data flow](data-flow.md) → [Database](database.md) → [API reference](api-reference.md) → [Testing](testing.md).
- **You will query or analyse the data:** [Database](database.md) (connection, conventions, example SQL) → [GPS tracking](gps-tracking.md) (how positions are derived).
- **You will operate the platform:** [Configuration](configuration.md) → [Deployment](deployment.md) → [Africa's Talking](africas-talking.md) → [Security](security.md) → [Troubleshooting](troubleshooting.md).

## Language

The documentation is in English. The apps' user interface is in Portuguese; UI labels are quoted as they appear (for example "Para onde quer ir?", "Gerar PIN"). Database tables and fields keep their Portuguese names (`Via` = route, `Paragem` = stop, `Transporte` = vehicle, `Motorista` = driver, `Utente` = passenger, `Proprietario` = owner, `MISSION` = arrival alert, `Tarifa` = fare rule).

---

[← Project home](../README.md) · Next: [Getting started →](getting-started.md)
