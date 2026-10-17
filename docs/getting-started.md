# Getting started

This page takes you from an empty machine to all three apps running locally on a seeded database. Then you sign in to each app and try USSD and GPS with `curl`. Every command below was run on a fresh database while writing this page.

> **Just want to look?** The platform is live. See [Live apps](../README.md#live-apps). Nothing on this page is needed to use it.

**On this page:** [Prerequisites](#prerequisites) · [1. Clone](#1-clone) · [2. Database](#2-start-a-database) · [3. Environment files](#3-environment-files) · [4. Install](#4-install-dependencies) · [5. Schema](#5-create-the-schema) · [6. Seed](#6-load-demo-data) · [7. Run](#7-run-the-apps) · [8. Sign in](#8-sign-in-to-each-app) · [9. USSD](#9-try-the-ussd-menu-with-curl) · [10. GPS](#10-send-a-gps-position) · [11. Look at the data](#11-look-at-the-data) · [Production data](#working-with-a-copy-of-production-data)

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 or newer (checked with 22.23) | Each app is a Next.js 16 project with its own `node_modules`. |
| npm | the one that ships with Node | |
| Git | any | |
| PostgreSQL | 16 or newer | Use Docker (`docker compose`, below) or a native install. Production runs PostgreSQL 18 on Neon. |
| `psql` | optional | To query the database by hand ([Database](database.md#connecting)). |

## 1. Clone

```bash
git clone https://github.com/transportmozambique/Transport-Mozambique.git
cd Transport-Mozambique
```

The repository holds three deployed apps, `transport-client`, `transport-admin` and `transport-driver`. It also holds the shared Prisma schema and migrations in `prisma/`, plus a legacy root app that is not deployed. See [Architecture → Repository layout](architecture.md#repository-layout).

## 2. Start a database

**With Docker** (uses `docker-compose.yml` at the repository root):

```bash
docker compose up -d
# PostgreSQL 16 on localhost:5433, user postgres, password postgres123, database transport_db
```

Connection string: `postgresql://postgres:postgres123@localhost:5433/transport_db`

**With a native PostgreSQL**, create an empty database and use its URL instead, for example `postgresql://postgres@localhost:5432/transport_dev`.

## 3. Environment files

Create one `.env` file per app. Next.js and the Prisma CLI both read `.env`, and every `.env*` file is git-ignored. The full list of variables, with what each one does, is in [Configuration](configuration.md).

`transport-client/.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres123@localhost:5433/transport_db"
# Optional in development: without them a fixed development-only secret is used.
# Required in production (sign-in fails closed without them).
USER_SESSION_SECRET="any-long-random-string"
DRIVER_SESSION_SECRET="another-long-random-string"
# Optional: without an API key SMS are logged to the console instead of sent
# AFRICASTALKING_USERNAME="sandbox"
# AFRICASTALKING_API_KEY="..."
```

`transport-admin/.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres123@localhost:5433/transport_db"
ADMIN_SESSION_SECRET="a-third-long-random-string"   # optional in development
GPS_SERVER_URL="http://localhost:3000/api/gps"     # shown to whoever sets up a GPS device
```

`transport-driver/.env`:

```bash
# The driver portal has no API of its own: it calls the passenger app
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

Generate secrets with `openssl rand -base64 32` (or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).

## 4. Install dependencies

```bash
cd transport-client && npm install && cd ..   # also runs "prisma generate" (postinstall)
cd transport-admin  && npm install && npx prisma generate && cd ..
cd transport-driver && npm install && cd ..
```

`transport-admin` has no `postinstall` hook, so generate its Prisma client once by hand (its `npm run build` also does it).

## 5. Create the schema

The schema and its migrations live in the root `prisma/` folder. Apply them through the client app's Prisma CLI:

```bash
cd transport-client
npx prisma migrate deploy --schema ../prisma/schema.prisma
```

Expected ending: `All migrations have been successfully applied.` Six migrations run, from `20260430170348_init` to `20261016150000_vehicle_gps`, and they create every table, including the default fare rule (`Tarifa`). To confirm the database matches the schema:

```bash
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel ../prisma/schema.prisma --exit-code
# exit code 0 = no difference
```

(`$DATABASE_URL` must be exported in your shell for this command. The others read it from `.env`.)

## 6. Load demo data

```bash
# still in transport-client
npm run db:seed
```

> ⚠️ The seed **deletes every row** of every table before inserting. Never point it at a database you care about.

The demo data is small but complete:

| Created | Count |
|---|---|
| Administrator | 1 (`admin@transportmz.com` / `admin123`) |
| Provinces / municipalities | 2 / 2 (Maputo, Matola) |
| Routes (`Via`) | 18, with straight 3–4-point paths |
| Stops (`Paragem`) / route–stop links | 32 / 62 |
| Vehicles (`Transporte`) | 25, all on a route |
| Drivers (`Motorista`) | 5, each assigned to a vehicle, **no PIN yet** |
| Passengers (`Utente`) | 3 (`+258840000001`, `+258850000002`, `+258860000003`, password `123456`) |
| Owners (`Proprietario`) | 2 |

These accounts exist only in your local database. Production data is much larger (91 routes that follow the roads, 1,079 stops, 111 vehicles). To work with it, see [Working with a copy of production data](#working-with-a-copy-of-production-data).

## 7. Run the apps

Open three terminals:

```bash
# Terminal 1: passenger web app, USSD, driver API, GPS intake
cd transport-client && npm run dev            # http://localhost:3000

# Terminal 2: admin dashboard (its script would also take port 3000)
cd transport-admin && npm run dev -- -p 3002  # http://localhost:3002

# Terminal 3: driver portal (its script fixes port 3001)
cd transport-driver && npm run dev            # http://localhost:3001
```

| App | Local URL | Production URL |
|---|---|---|
| Passenger web app (`transport-client`) | http://localhost:3000 | https://transport-mz.vercel.app |
| Admin dashboard (`transport-admin`) | http://localhost:3002 | https://transport-mz-admin.vercel.app |
| Driver portal (`transport-driver`) | http://localhost:3001 | https://transport-mz-driver.vercel.app |

To run production builds instead, use `npm run build && npx next start -p <port>` in each folder. The driver portal reads `NEXT_PUBLIC_API_URL` **at build time**, so rebuild it after changing that variable.

## 8. Sign in to each app

**Admin**: open http://localhost:3002/login and sign in with `admin@transportmz.com` / `admin123`. The session is an `HttpOnly` cookie valid for 12 hours ([Security](security.md#admin-dashboard)).

<img src="images/admin-login.png" alt="Admin sign-in page" width="480">

**Passenger**: open http://localhost:3000/auth, choose "Entrar", and sign in with phone `840000001` and password `123456`. The `+258` prefix is optional. You can also register a new account on the same page.

<img src="images/passenger-auth.png" alt="Passenger sign-in and registration page" width="480">

**Driver**: drivers sign in with a PIN the administrator generates; nobody chooses their own.

1. In the admin, open **Motoristas**, open a driver (for example "Ana Sitoe", phone `+258 84 567 8901`), and press **"Gerar PIN"** on the "PIN de Acesso" card. The 6-digit PIN is shown **once**; only its bcrypt hash is stored.

   <img src="images/admin-driver-pin.png" alt="PIN de Acesso card right after a new PIN was generated" width="280">

2. Open http://localhost:3001 and sign in with phone `845678901` and that PIN.

   <img src="images/driver-login.png" alt="Driver portal sign-in: phone number and PIN" width="280">

3. Press **"Iniciar"** to start a trip. The same trip state is visible in the USSD driver menu ([Driver portal](driver-portal.md)).

   <img src="images/driver-trip-active.png" alt="Driver portal with a trip in progress" width="280">

## 9. Try the USSD menu with `curl`

The USSD endpoint takes the same form fields Africa's Talking sends. `text` holds every answer so far, joined by `*` ([USSD service](ussd.md#how-a-session-works)).

```bash
# Main menu
curl -s -X POST http://localhost:3000/api/ussd \
  --data-urlencode "sessionId=test-1" --data-urlencode "serviceCode=*384*848080#" \
  --data-urlencode "phoneNumber=+258840000001" --data-urlencode "text="

# Option 1: type where you are, pick the stop, type the destination, pick it
curl -s -X POST http://localhost:3000/api/ussd \
  --data-urlencode "sessionId=test-1" --data-urlencode "phoneNumber=+258840000001" \
  --data-urlencode "text=1*portao"
```

```text
CON Qual paragem?
1. Portao
2. Segundo Portao da Radio Marconi
0. Voltar
```

`text=1*portao*1*makalela*1` then shows the first journey; [USSD → 1 Encontrar transporte](ussd.md#1-encontrar-transporte) has every screen.

Without `AFRICASTALKING_API_KEY`, the SMS the menus send are logged in the client's terminal (`SMS não enviado para ...`) instead of sent.

## 10. Send a GPS position

1. In the admin, open **Transportes**, open a vehicle, and press **"Gerar código do dispositivo"** on the "Rastreador GPS" card. Copy the code; it is shown once.
2. Send a position as a phone running Traccar Client would (OsmAnd protocol, speed in knots):

```bash
curl -s "http://localhost:3000/api/gps?id=<device code>&lat=-25.9692&lon=32.5732&speed=10&bearing=90"
# {"ok":true}
```

For the next 3 minutes the vehicle is shown at that point on the passenger map and in the admin. After that it returns to its timetable position. The whole protocol is in [GPS tracking](gps-tracking.md).

## 11. Look at the data

```bash
cd transport-client
npx prisma studio --schema ../prisma/schema.prisma   # http://localhost:5555
```

Or with `psql`:

```bash
psql "postgresql://postgres:postgres123@localhost:5433/transport_db" \
  -c 'SELECT matricula, "viaId", "currGeoLocation" FROM "Transporte" LIMIT 5'
```

Or as ready-made lists that join tables (routes, a route's stops in order, vehicles with their driver, drivers with or without a PIN):

```bash
cd transport-client
npx tsx scripts/queries.ts routes
npx tsx scripts/queries.ts stops VIA-1A     # a route code from the list above
```

[Database](database.md) explains every table, each way to connect (including the Neon SQL Editor for production) and has tested example queries.

---

## Working with a copy of production data

The demo seed is small and its routes are straight lines. To see the real network locally you need read access to the production database. Its connection string is in the Vercel project's environment variables ([Configuration](configuration.md#where-values-live)). Two options:

**A. A Neon branch (recommended).** In the Neon console, create a branch of the production branch. It is an instant copy-on-write clone, so production is untouched. Put the branch's connection string in your `.env` files. Delete the branch when you are done.

**B. A dump into your local PostgreSQL.** `pg_dump` must be at least as new as the server (PostgreSQL 18), so run it from the matching Docker image:

```bash
# Read-only on the source. Use the direct host (without "-pooler") for pg_dump.
docker run --rm -v "$PWD:/out" postgres:18 \
  pg_dump "$PROD_DIRECT_URL" --no-owner --no-privileges -Fc -f /out/prod.dump

# Create an empty database, then restore into it (also with PostgreSQL 18 tools).
# host.docker.internal reaches your machine from the container (on Linux add
# --add-host=host.docker.internal:host-gateway to the docker run).
docker compose exec postgres createdb -U postgres transport_copy
docker run --rm -v "$PWD:/out" postgres:18 \
  pg_restore --no-owner --no-privileges \
  -d "postgresql://postgres:postgres123@host.docker.internal:5433/transport_copy" /out/prod.dump
```

A dump from PostgreSQL 18 may not restore cleanly into PostgreSQL 16. If you use the Docker database from step 2, change its image to `postgres:18-alpine`, or use option A. The dump contains passengers' names and phone numbers: keep it off shared drives and delete it when done.

---

[← Documentation index](README.md) · Next: [Architecture →](architecture.md)
