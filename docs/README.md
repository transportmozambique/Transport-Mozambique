# Documentation

Transport Mozambique is a public-transport information platform for the Maputo–Matola area. Passengers find buses and arrival times on the web or by USSD on any phone. Drivers run their trips from a phone. Administrators manage the network from a back office. This folder explains how every part works, how the parts connect, and how to run, configure, query and deploy them.

Each topic has its own page. The pages assume a technical reader: they cite file paths, endpoints, table names and the commands that were used to check them. Every page ends with **← previous · index · next →** links, so the whole folder can be read in order, top to bottom of the list below.

**On this page:** [Pages](#pages) · [Find it fast](#find-it-fast) · [Suggested reading paths](#suggested-reading-paths) · [Language](#language)

---

## Pages

### 1. Start here

| Page | What it covers |
|---|---|
| [Getting started](getting-started.md) | Run the whole platform locally from an empty database, sign in to every app, try USSD and GPS with `curl`. |
| [Architecture](architecture.md) | The three deployed apps, what each one owns, how they talk to each other and to the outside services, the tech stack and the repository layout. |
| [Glossary](glossary.md) | The Portuguese words of the code, the database and the screens in English (`Via`, `Paragem`, `chapa`…), and the project's own terms. |
| [Project status](project-status.md) | What runs today, the production data, what is waiting for the owner to act, next steps, and the history of the pull requests. |

### 2. How it works

| Page | What it covers |
|---|---|
| [Data flow](data-flow.md) | Sequence diagrams for every flow: journey planning and arrival time, live map, arrival SMS, USSD session, driver trip, GPS position, admin changes. |
| [Database](database.md) | Entity diagram, every table, storage conventions, how to connect (psql, Prisma Studio, Neon console), tested example queries, migrations, and the data scripts (OpenStreetMap import, paths on the roads, demo drivers). |
| [GPS tracking](gps-tracking.md) | How positions are produced (real GPS or timetable), setting up a tracker or Traccar Client, the ingestion protocol. |

### 3. Using each app

| Page | What it covers |
|---|---|
| [Passenger web app](passenger-web.md) | Live map with your position, stops near you, a stop's destinations, journeys with changes of bus, following a journey with all its buses, account and arrival alerts, with the API call behind each screen. |
| [USSD service](ussd.md) | How the handler treats each keypress, the full menu tree with real screens, pagination rules, what each option reads, writes and sends by SMS, and how to test it. |
| [Driver portal](driver-portal.md) | PIN sign-in, starting and ending a trip (shared with USSD), sharing the phone's GPS, passengers waiting along the route. |
| [Admin dashboard](admin-dashboard.md) | Every back-office page: network data, redrawing a route's path, vehicles with live position, GPS trackers, driver PINs, reports. |

### 4. Step-by-step guides, with screenshots

| Page | What it covers |
|---|---|
| [Africa's Talking](africas-talking.md) | How the USSD channel and SMS were set up, step by step; using the menu in the simulator, screen by screen; how a request reaches the code; logs; going live. |
| [Viewing the data in Neon](neon-guide.md) | Open the project, paste and run SQL, download results, browse a table, and follow each data flow through the tables. |
| [Vercel, step by step](vercel-guide.md) | The three projects, adding environment variables (Secret or Config), deployments, redeploy and rollback, reading the logs. |

### 5. Reference and operations

| Page | What it covers |
|---|---|
| [Configuration](configuration.md) | Every environment variable of every app, Vercel and Neon settings, the fare rule, timetable constants. |
| [API reference](api-reference.md) | Every HTTP endpoint of the passenger app and the admin app: method, authentication, parameters, real responses. |
| [Deployment](deployment.md) | How a change reaches production, database changes in production, checking a deploy. |
| [Testing](testing.md) | Admin Jest and Playwright suites, type checks, testing USSD, GPS and the APIs by hand. |
| [Security](security.md) | Sessions and tokens of each app, secrets, public endpoints, what is stored hashed, rotation, known gaps. |
| [Troubleshooting](troubleshooting.md) | Symptoms, causes and fixes for the problems you are most likely to meet. |
| [Known limitations](known-limitations.md) | What is incomplete, simulated or legacy, so you do not mistake it for a bug, or build on it. |

## Find it fast

| Question | Where |
|---|---|
| What does `Via`, `Paragem`, `MISSION` or "chapa" mean? | [Glossary](glossary.md) |
| What is left to do, and what changed recently? | [Project status](project-status.md) |
| How was Africa's Talking configured? | [Africa's Talking → How it was set up](africas-talking.md#how-it-was-set-up-step-by-step) |
| How do I try the USSD menu? | [Africa's Talking → Use the menu in the simulator](africas-talking.md#use-the-menu-in-the-simulator) |
| What happens to one USSD keypress, from the phone to the database? | [USSD → Inside the handler](ussd.md#inside-the-handler) |
| How does a passenger's request become a journey and an arrival time? | [Data flow](data-flow.md) |
| How do I run SQL on the production data? | [Viewing the data in Neon](neon-guide.md) |
| Which key or setting goes where? | [Configuration](configuration.md), then [Vercel → Environment variables](vercel-guide.md#environment-variables) |
| Where does a bus's position come from? | [GPS tracking → How a position is chosen](gps-tracking.md#how-a-position-is-chosen) |
| A route's line does not follow the roads. | [Database → Putting route paths on the roads](database.md#putting-route-paths-on-the-roads), [Admin → Routes](admin-dashboard.md#routes-vias) |
| A deploy broke something. | [Vercel → Deployments](vercel-guide.md#deployments) (Instant Rollback), then [Troubleshooting](troubleshooting.md) |
| Which endpoint does a screen call? | [API reference](api-reference.md) |

## Suggested reading paths

- **You want to see it working:** open the [live apps](../README.md#live-apps), try the [USSD menu in the simulator](africas-talking.md#use-the-menu-in-the-simulator), then follow [Getting started](getting-started.md) to run it locally.
- **You are new to the project:** [Architecture](architecture.md) → [Glossary](glossary.md) → [Project status](project-status.md) → [Data flow](data-flow.md).
- **You will change the code:** [Architecture](architecture.md) → [Data flow](data-flow.md) → [Database](database.md) → [API reference](api-reference.md) → [Testing](testing.md).
- **You will query or analyse the data:** [Viewing the data in Neon](neon-guide.md) (step by step) → [Database](database.md) (connection, conventions, example SQL) → [GPS tracking](gps-tracking.md) (how positions are derived).
- **You will operate the platform:** [Project status → Waiting for action](project-status.md#waiting-for-action) → [Configuration](configuration.md) → [Vercel, step by step](vercel-guide.md) → [Deployment](deployment.md) → [Africa's Talking](africas-talking.md) → [Security](security.md) → [Troubleshooting](troubleshooting.md).

## Language

The documentation is in English. The apps' user interface is in Portuguese; UI labels are quoted as they appear (for example "Para onde quer ir?", "Gerar PIN"). Database tables and fields keep their Portuguese names (`Via` = route, `Paragem` = stop, `Transporte` = vehicle, `Motorista` = driver, `Utente` = passenger, `Proprietario` = owner, `MISSION` = arrival alert, `Tarifa` = fare rule); the [Glossary](glossary.md) has them all.

---

[← Project home](../README.md) · Next: [Getting started →](getting-started.md)
