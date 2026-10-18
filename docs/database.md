# Database

The whole platform uses one PostgreSQL database: Neon in production, running PostgreSQL 18. The schema is defined once, in `prisma/schema.prisma` at the repository root, and accessed through Prisma 5.22. This page describes every table and the storage conventions you need to read the data correctly. It also shows how to connect and gives example queries that were run against a copy of the production data.

**On this page:** [Entity diagram](#entity-diagram) · [Tables](#tables) · [Conventions](#conventions-read-this-before-querying) · [Connecting](#connecting) · [Example queries](#example-queries) · [Changing data](#changing-data) · [Importing from OpenStreetMap](#importing-stops-and-routes-from-openstreetmap) · [Schema changes and migrations](#schema-changes-and-migrations) · [Size](#size-at-the-time-of-writing)

---

## Entity diagram

```mermaid
erDiagram
  Administrador ||--o{ Provincia : "manages (optional)"
  Administrador ||--o{ Municipio : "manages (optional)"
  Administrador ||--o{ Via : "manages (optional)"
  Administrador ||--o{ Paragem : "manages (optional)"
  Provincia ||--o{ Cidade : has
  Provincia ||--o{ Municipio : has
  Cidade ||--o{ Municipio : has
  Municipio ||--o{ Via : has
  Via ||--o{ ViaParagem : "stops of the route"
  Paragem ||--o{ ViaParagem : "routes through the stop"
  Via ||--o{ Transporte : "vehicles on the route"
  Transporte ||--o| Motorista : "driven by (one)"
  Transporte ||--o{ TransporteProprietario : "owned by"
  Proprietario ||--o{ TransporteProprietario : owns
  Transporte ||--o{ GeoLocation : "legacy position history"
  Utente ||--o{ MISSION : "waits at"
  Paragem ||--o{ MISSION : "alerts at"

  Via {
    string id PK
    string codigo UK
    string nome
    string terminalPartida
    string terminalChegada
    string geoLocationPath "lng,lat;lng,lat;…"
    string municipioId FK
  }
  Paragem {
    string id PK
    string codigo UK
    string nome
    string geoLocation "lat,lng"
  }
  ViaParagem {
    string id PK
    string viaId FK
    string paragemId FK
    boolean terminalBoolean
  }
  Transporte {
    string id PK
    string matricula UK
    int codigo UK
    string viaId FK
    string currGeoLocation "lat,lng"
    string gpsDispositivoHash UK "sha256"
    datetime gpsAtualizadoEm
  }
  Motorista {
    string id PK
    string telefone
    string password "bcrypt PIN or null"
    boolean emViagem
    string transporteId FK "unique"
  }
  Utente {
    string id PK
    string telefone UK
    string senha "bcrypt or temp"
  }
  MISSION {
    string id PK
    string utenteId FK
    string paragemId FK
    datetime createdAt
    datetime notificadoEm
  }
  Tarifa {
    string id PK
    string nome UK
    int tarifaMinima
    float precoPorKm
    boolean ativa
  }
```

`Tarifa` stands alone: no foreign keys point to it. The diagram shows the key columns only; every column is listed below.

## Tables

Prisma maps each model to a table of the same name, so names are mixed-case and must be **double-quoted in SQL** (`"Transporte"`, `"viaId"`). Every `id` is a [cuid](https://github.com/paralleldrive/cuid) string. Most tables have `createdAt` and `updatedAt`.

### Network

| Table | One row is | Key columns |
|---|---|---|
| `Provincia` | a province | `nome`, `codigo` (unique), `geoLocation` (`lat,lng` centre), `administradorId` |
| `Cidade` | a city (unused: no UI, 0 rows) | `nome`, `codigo`, `provinciaId` |
| `Municipio` | a municipality (Maputo, Matola) | `nome`, `codigo` (unique), `geoLocation`, `endereco`, `contacto1`, `provinciaId`, `cidadeId` |
| `Via` | a route (one direction of a line, or both) | `codigo` (unique, e.g. `V063`), `nome`, `cor` (hex colour on maps), `terminalPartida`, `terminalChegada` (names of the end points), `geoLocationPath` (the road path), `municipioId`, `codigoMunicipio` |
| `Paragem` | a stop | `codigo` (unique, e.g. `PAR-0869`), `nome`, `geoLocation` |
| `ViaParagem` | "this stop is on this route" | `viaId`, `paragemId` (unique together; both cascade on delete), `terminalBoolean`, `codigoVia`, `codigoParagem` |

### Fleet and people

| Table | One row is | Key columns |
|---|---|---|
| `Transporte` | a vehicle | `matricula` (plate, unique), `codigo` (unique number), `marca`, `modelo`, `cor`, `lotacao` (seats), `viaId` + `codigoVia` (its route), `currGeoLocation` (last stored position), `routePath` (stale, see below), `gpsDispositivoHash`, `gpsAtualizadoEm`, `gpsVelocidade` (km/h), `gpsDirecao` (degrees, 0 = north) |
| `Motorista` | a driver | `nome`, `telefone`, `email` (unique), `bi` (ID number, unique), `cartaConducao` (licence, unique), `categoriaCarta`, `experienciaAnos`, licence and ID dates, emergency contact, `foto` (URL), `status` (`ativo`/`inativo`/`suspenso`: the account), `password` (bcrypt hash of the PIN, or null = cannot sign in), `emViagem` + `viagemIniciadaEm` (trip in progress), `transporteId` (unique: one vehicle per driver and one driver per vehicle) |
| `Proprietario` | a vehicle owner (person or company) | `nome`, `bi` (unique), `nacionalidade`, `birthDate`, `endereco`, `contacto1`, `contacto2`, `tipoProprietario` (`Indivíduo`/`Empresa`) |
| `TransporteProprietario` | "this owner owns this vehicle" | `transporteId`, `proprietarioId` (unique together), `codigoTransporte`, `idProprietario` |
| `Administrador` | an admin account | `nome`, `email` (unique), `senha` (bcrypt) |

### Passengers and operations

| Table | One row is | Key columns |
|---|---|---|
| `Utente` | a passenger | `nome`, `email` (unique), `telefone` (unique), `senha` (bcrypt hash, or the placeholder `temp` for accounts created by USSD), `mISSION` (unique reference code), `subscrito`, `dataSubscricao` |
| `MISSION` | an arrival alert: "this passenger waits at this stop" | `utenteId`, `paragemId`, `createdAt` (alerts older than 24 h are ignored), `notificadoEm` (last arrival SMS), `geoLocationParagem`, `codigoParagem`, `mISSIONUtente` |
| `Tarifa` | the fare and speed rule | `nome` (unique), `tarifaMinima` (MT), `precoPorKm` (MT/km), `fatorEstrada`, `velocidadeViagemKmh`, `velocidadeChegadaKmh`, `ativa`. The newest active row is used ([Configuration](configuration.md#fare-rule-tarifa)) |
| `GeoLocation` | legacy position history (current position plus 3 previous ones) | filled by the initial import; nothing deployed writes it. Positions now live on `Transporte` |

## Conventions (read this before querying)

- **Points are text `"lat,lng"`.** Examples: `Paragem.geoLocation`, `Transporte.currGeoLocation`, `MISSION.geoLocationParagem`, `Municipio.geoLocation` (`"-25.8388631,32.5536334"`). Split with `split_part(col, ',', 1)::float` for latitude and `split_part(col, ',', 2)::float` for longitude.
- **Paths are text `"lng,lat;lng,lat;…"`, in the reverse order (GeoJSON order).** `Via.geoLocationPath` is the road path a route's buses drive, with a point every ~50 m (up to 1,450 points). It is the reference for positions, distances and fares. `Transporte.routePath` uses the same format but is **stale on most vehicles** (it was copied between routes during the import). Use the route's path.
- **No PostGIS.** Coordinates are plain text, with no spatial index. Distances are computed in the apps (haversine, `lib/fares.ts`) or in SQL ([example](#stops-within-500-m-of-a-point)).
- **`ViaParagem` has no order column.** Insertion order is not travel order. The apps order a route's stops by where each one projects onto `Via.geoLocationPath` (`orderStopsAlongRoute` in `transport-client/lib/fares.ts`).
- **Times are UTC, stored without a time zone** (`timestamp(3) without time zone`). Start every SQL session with `SET TIME ZONE 'UTC';`. Otherwise comparisons with `now()` are shifted by your session's offset. Convert for display with `(col AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Maputo'`. Maputo is UTC+2 all year.
- **Phone numbers come in several formats.** Drivers look like `+258 87 183 1581`. Passengers who registered on the web look like `849990777`, and accounts created by USSD look like `+258849990777`. The apps compare numbers after removing spaces and the `+258` prefix.
- **The `codigo*` and `id*` text columns repeat foreign keys** (`codigoVia`, `codigoParagem`, `codigoMunicipio`, `codigoTransporte`, `idProprietario`). They are human-readable codes kept for the original data model. Join on the real foreign keys (`viaId`, `paragemId`, `municipioId`, `transporteId`, `proprietarioId`).
- **`Motorista.status` is the account state; `emViagem` is the trip.** A driver can be `ativo` and not on a trip.
- **Fresh GPS means `gpsAtualizadoEm` within the last 3 minutes.** Older positions are ignored by every reader. In that case `currGeoLocation` is only the last known point, not where the vehicle is now (see [GPS tracking](gps-tracking.md#how-a-position-is-chosen)).

## Connecting

### Production (Neon)

The connection strings are in the Vercel projects' environment variables (`DATABASE_URL`), and in the Neon console under the project's **Connect** button. Neon gives two hosts for the same database:

| Host | Looks like | Use it for |
|---|---|---|
| Pooled | `ep-…-pooler.<region>.aws.neon.tech` | the apps (serverless functions open many short connections) |
| Direct | `ep-….<region>.aws.neon.tech` (no `-pooler`) | `psql` sessions, `pg_dump`, schema changes (`prisma db execute`), anything that uses session state |

Four ways in:

1. **Neon console → SQL Editor.** Runs SQL in the browser against a chosen branch, with nothing to install. Good for quick reads.
2. **`psql "<direct connection string>"`.** Neon requires TLS, and the string already contains `sslmode=require`.
3. **Prisma Studio.** A table browser pointed at the database through `DATABASE_URL` ([below](#prisma-studio)).
4. **Prisma Client in a script.** Ready-made lists that join tables, or your own ([below](#prisma-client-in-a-script)).

#### Neon console

[Viewing the data in Neon](neon-guide.md) walks through the console step by step, with a screenshot for each step and queries that follow each data flow. In short:

Sign in at https://console.neon.tech, open the **TransportMZ** project, and check the branch at the top left (`production` is the live data).

- **SQL Editor** (left menu): choose the database `neondb`, paste a query from [Example queries](#example-queries), press **Run**. The editor opens with Neon's own sample `CREATE TABLE … INSERT …`; replace it rather than running it, or it creates a table in production.

  ![Neon SQL Editor: the busiest stops](images/neon-sql-editor.png)

- **Tables** (left menu): browse a table page by page, with filters and sorting, without SQL. It can also edit and add rows: on `production`, prefer the admin dashboard, which keeps the related rows consistent.

  ![Neon Tables view: the Paragem table](images/neon-tables.png)

- **Branches**: create a branch of `production` to try a change on a copy. **Connect** shows the connection strings, including the password: do not screenshot or share it.

For people who only need to read, create a read-only role (Neon console → Roles, or SQL as the owner) instead of sharing the owner's credentials:

```sql
CREATE ROLE analyst WITH LOGIN PASSWORD 'choose-a-strong-password';
GRANT CONNECT ON DATABASE <database> TO analyst;
GRANT USAGE ON SCHEMA public TO analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analyst;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO analyst;
```

For experiments that write, use a Neon **branch** of production: an instant copy-on-write clone you can delete afterwards ([Getting started](getting-started.md#working-with-a-copy-of-production-data)).

### Local

```bash
psql "postgresql://postgres:postgres123@localhost:5433/transport_db"   # docker compose database
```

### Prisma Studio

```bash
cd transport-client
npx prisma studio --schema ../prisma/schema.prisma    # opens http://localhost:5555
```

It lists every model with its row count. The screenshot below is from a copy of the production data.

![Prisma Studio: every model with its row count](images/studio-models.png)

Opening a model shows its rows; relation columns link to the related rows:

![Prisma Studio: the Transporte table](images/studio-transporte.png)

### Prisma Client in a script

Prisma Studio shows one table at a time. For a list that combines tables (routes with their number of stops, a route's stops in travel order, vehicles with their driver), use Prisma Client, the library the apps themselves query with. `transport-client/scripts/queries.ts` has ready-made lists. It only reads.

Run it from `transport-client`. It takes `DATABASE_URL` from `transport-client/.env`, or from the environment:

```bash
cd transport-client
npx tsx scripts/queries.ts routes matola
DATABASE_URL="<connection string>" npx tsx scripts/queries.ts drivers    # another database, without editing .env
```

| Command | Lists |
|---|---|
| `npx tsx scripts/queries.ts counts` | Rows in the main tables |
| `npx tsx scripts/queries.ts routes [municipality]` | Routes with their number of stops and vehicles; `routes matola` lists Matola's only |
| `npx tsx scripts/queries.ts stops <route code>` | A route's stops in travel order, ordered the way the apps order them (`stops V034`) |
| `npx tsx scripts/queries.ts vehicles [route code]` | Vehicles with their route, driver, trip state and GPS state (`sem dispositivo`, `ativo`, `sem sinal`) |
| `npx tsx scripts/queries.ts drivers` | Drivers: account state, whether they have a PIN, trip, vehicle and route |
| `npx tsx scripts/queries.ts alerts` | Arrival alerts of the last 24 hours, by stop, without passenger data |

Output of `npx tsx scripts/queries.ts stops V034` on a copy of production (first rows):

```text
Av. das Indústrias - Rua da Igreja
┌─────────┬───────┬────────────┬──────────────────────────┬──────────────────────────────────────────┐
│ (index) │ ordem │ codigo     │ nome                     │ coordenadas                              │
├─────────┼───────┼────────────┼──────────────────────────┼──────────────────────────────────────────┤
│ 0       │ 1     │ 'PAR-0792' │ 'Av. das Indústrias'     │ '-25.8889299,32.4342488'                 │
│ 1       │ 2     │ 'PAR-0791' │ 'Av. das Indústrias'     │ '-25.8888211,32.4342692'                 │
│ 2       │ 3     │ 'PAR-0301' │ 'Avenida das Indústrias' │ '-25.893347300000002,32.442886200000004' │
```

**Adding a list.** Each list is a function in the `lists` object of `scripts/queries.ts`. A Prisma query names the model (`prisma.via`, `prisma.paragem`, `prisma.transporte`, `prisma.motorista`, `prisma.mISSION`, …), and then:

- `where` filters, including through relations;
- `select` picks columns and related rows;
- `_count` counts related rows;
- `orderBy` sorts.

For example, the routes of a municipality that have at least one vehicle:

```ts
async busyRoutes(municipio) {
  const vias = await prisma.via.findMany({
    where: {
      municipio: { nome: { contains: municipio ?? '', mode: 'insensitive' } },
      transportes: { some: {} },
    },
    select: { codigo: true, nome: true, _count: { select: { transportes: true } } },
    orderBy: { codigo: 'asc' },
  });
  console.table(vias.map((v) => ({ codigo: v.codigo, nome: v.nome, autocarros: v._count.transportes })));
},
```

Model and field names are those of `prisma/schema.prisma` ([Tables](#tables)). The query syntax is documented in [Prisma's CRUD reference](https://www.prisma.io/docs/orm/prisma-client/queries/crud). Keep these scripts read-only: changes to network data belong in the admin dashboard ([Changing data](#changing-data)).

## Example queries

Every query below was run with `psql` against a copy of the production data on 2026-10-17, and the outputs are real. Paste them into the Neon SQL Editor or a `psql` session ([Connecting](#connecting)). Outputs that would show passengers' names or phone numbers are left out. Start the session with:

```sql
SET TIME ZONE 'UTC';
```

### Rows per table

```sql
SELECT 'Via' AS tabela, count(*) FROM "Via"
UNION ALL SELECT 'Paragem', count(*) FROM "Paragem"
UNION ALL SELECT 'ViaParagem', count(*) FROM "ViaParagem"
UNION ALL SELECT 'Transporte', count(*) FROM "Transporte"
UNION ALL SELECT 'Motorista', count(*) FROM "Motorista"
UNION ALL SELECT 'Tarifa', count(*) FROM "Tarifa";
```

```text
   tabela   | count
------------+-------
 Via        |    91
 Paragem    |  1079
 ViaParagem |  3312
 Transporte |   111
 Motorista  |   111
 Tarifa     |     1
```

### Routes with their stops, vehicles and path size

```sql
SELECT v.codigo, v.nome, m.nome AS municipio,
       count(DISTINCT vp."paragemId") AS paragens,
       count(DISTINCT t.id)           AS autocarros,
       array_length(string_to_array(v."geoLocationPath", ';'), 1) AS pontos_no_percurso
FROM "Via" v
JOIN "Municipio" m        ON m.id = v."municipioId"
LEFT JOIN "ViaParagem" vp ON vp."viaId" = v.id
LEFT JOIN "Transporte" t  ON t."viaId" = v.id
GROUP BY v.id, m.nome
ORDER BY autocarros DESC, paragens DESC
LIMIT 5;
```

```text
 codigo  |          nome          | municipio | paragens | autocarros | pontos_no_percurso
---------+------------------------+-----------+----------+------------+--------------------
 VIA-109 | Rota 109               | Maputo    |       15 |          3 |               1450
 V102    | Moamba - Rua da Escola | Matola    |      149 |          2 |               1144
 V101    | Moamba - Djimomposse   | Matola    |      149 |          2 |                969
 V100    | Moamba - 2 Igreja      | Matola    |      133 |          2 |                933
 V099    | Moamba - Cololuene     | Matola    |      127 |          2 |                891
```

### A vehicle with its driver and route

```sql
SELECT t.matricula, t.marca, t.modelo, t.lotacao,
       mo.nome AS motorista, mo."emViagem", mo."viagemIniciadaEm",
       v.codigo AS via, v."terminalPartida", v."terminalChegada"
FROM "Transporte" t
LEFT JOIN "Motorista" mo ON mo."transporteId" = t.id
LEFT JOIN "Via" v        ON v.id = t."viaId"
WHERE t.matricula = 'ACI-004M';
```

```text
 matricula | marca  | modelo | lotacao |  motorista  | emViagem | viagemIniciadaEm | via  |        terminalPartida         | terminalChegada
-----------+--------+--------+---------+-------------+----------+------------------+------+--------------------------------+------------------
 ACI-004M  | Toyota | Hiace  |      15 | Pedro Tembe | f        |                  | V063 | Rua do Cajueiro (Fedel Castro) | Estrada Circular
```

### The stops of a route, with coordinates

```sql
SELECT p.codigo, p.nome, vp."terminalBoolean" AS terminal,
       split_part(p."geoLocation", ',', 1)::float AS lat,
       split_part(p."geoLocation", ',', 2)::float AS lng
FROM "ViaParagem" vp
JOIN "Paragem" p ON p.id = vp."paragemId"
JOIN "Via" v     ON v.id = vp."viaId"
WHERE v.codigo = 'V063';
```

The rows come back in no particular order. For the travel order, use the API (`GET /api/stops/{id}` lists, for each route through a stop, the stops in both directions in travel order: [API reference](api-reference.md#get-apistopsid)).

### Stops served by the most routes

```sql
SELECT p.nome, p.codigo, count(*) AS rotas
FROM "ViaParagem" vp JOIN "Paragem" p ON p.id = vp."paragemId"
GROUP BY p.id ORDER BY rotas DESC LIMIT 5;
```

```text
      nome       |  codigo  | rotas
-----------------+----------+-------
 Michafutene     | PAR-0468 |    22
 Portão          | PAR-0469 |    22
 Igreja          | PAR-0467 |    22
 Rua do boquisso | PAR-0491 |    20
 Rua do boquisso | PAR-0490 |    20
```

### Stops within 500 m of a point

Haversine in plain SQL. No extension is needed.

```sql
SELECT nome, codigo, round(dist) AS metros FROM (
  SELECT p.nome, p.codigo,
         2 * 6371000 * asin(sqrt(
           power(sin(radians(split_part(p."geoLocation", ',', 1)::float - (-25.8389)) / 2), 2) +
           cos(radians(-25.8389)) * cos(radians(split_part(p."geoLocation", ',', 1)::float)) *
           power(sin(radians(split_part(p."geoLocation", ',', 2)::float - 32.5536) / 2), 2))) AS dist
  FROM "Paragem" p
) s WHERE dist < 500 ORDER BY dist LIMIT 5;
```

```text
              nome              |  codigo  | metros
--------------------------------+----------+--------
 Esquina                        | PAR-0869 |      5
 Rua do Cajueiro (Fedel Castro) | PAR-0868 |     11
 Pt                             | PAR-0867 |    343
 Rua do Cajueiro (Fedel Castro) | PAR-0870 |    386
 Rua do Cajueiro (Fedel Castro) | PAR-0907 |    397
```

### Vehicles with a GPS device, and whether their position is fresh

```sql
SELECT matricula, "currGeoLocation", "gpsVelocidade", "gpsDirecao",
       ("gpsAtualizadoEm" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Maputo' AS ultima_posicao_maputo,
       ("gpsAtualizadoEm" > now() - interval '3 minutes') AS gps_fresco
FROM "Transporte"
WHERE "gpsDispositivoHash" IS NOT NULL
ORDER BY "gpsAtualizadoEm" DESC NULLS LAST;
```

### Arrival alerts of the last 24 hours

```sql
SELECT ms."createdAt", ms."notificadoEm", p.nome AS paragem, u.nome AS utente
FROM "MISSION" ms
JOIN "Paragem" p ON p.id = ms."paragemId"
JOIN "Utente" u  ON u.id = ms."utenteId"
WHERE ms."createdAt" > now() - interval '24 hours'
ORDER BY ms."createdAt" DESC;
```

These are the alerts the arrival check still considers. `notificadoEm` is set once an SMS was sent.

### The active fare rule

```sql
SELECT nome, "tarifaMinima", "precoPorKm", "fatorEstrada",
       "velocidadeViagemKmh", "velocidadeChegadaKmh", ativa, "updatedAt"
FROM "Tarifa" WHERE ativa ORDER BY "updatedAt" DESC LIMIT 1;
```

```text
  nome  | tarifaMinima | precoPorKm | fatorEstrada | velocidadeViagemKmh | velocidadeChegadaKmh | ativa |       updatedAt
--------+--------------+------------+--------------+---------------------+----------------------+-------+------------------------
 padrao |           10 |         10 |          1.3 |                  30 |                   45 | t     | 2026-10-15 10:45:41.13
```

### Drivers: PIN, trip and vehicle

```sql
SELECT count(*) AS motoristas,
       count(*) FILTER (WHERE password IS NULL)       AS sem_pin,
       count(*) FILTER (WHERE "emViagem")             AS em_viagem,
       count(*) FILTER (WHERE "transporteId" IS NULL) AS sem_veiculo
FROM "Motorista";
```

### Passengers created by USSD (no password yet)

```sql
SELECT count(*) FILTER (WHERE senha NOT LIKE '$2%') AS so_ussd,
       count(*) FILTER (WHERE senha LIKE '$2%')     AS com_senha
FROM "Utente";
```

A USSD-only account becomes a full account when the same phone number registers on the web ([Passenger web app](passenger-web.md#account-and-sign-in)).

## Changing data

- **Use the admin dashboard** for network and fleet data: routes, stops, vehicles, drivers, owners. It keeps the related rows consistent (for example, the `codigo*` columns and the `ViaParagem` links).
- **The fare rule** is changed on the admin's Tarifa page ([Admin dashboard → Fare rule](admin-dashboard.md#fare-rule-tarifa)), or with SQL. The apps pick up the change within 60 s:

  ```sql
  UPDATE "Tarifa" SET "precoPorKm" = 12, "updatedAt" = now() WHERE ativa;
  ```

- **Never run a seed script against production.** Every seed starts by deleting every row of every table.
- Wrap manual multi-statement changes in `BEGIN; … COMMIT;` and check the row counts before committing.

## Importing stops and routes from OpenStreetMap

The original network left much of central Maputo out. For example, it had one stop within 2 km of Av. Eduardo Mondlane. OpenStreetMap maps the city's buses and chapas: the Chapas, EMTPM, Corujas, REM and RCM networks. `transport-client/scripts/import-osm.mjs` brings them in.

```bash
cd transport-client
node scripts/import-osm.mjs --fetch                       # download from Overpass into osm-data/ (git-ignored)
DATABASE_URL=… node scripts/import-osm.mjs --verbose       # dry run: lists what it would add, writes nothing
DATABASE_URL=… node scripts/import-osm.mjs --apply --buses 2                 # local databases only
DATABASE_URL=… node scripts/import-osm.mjs --apply --buses 2 --production    # a remote database
```

What it does:

- **Area.** The Maputo, Matola, Boane and Marracuene box (−26.10, 32.30 to −25.70, 32.75).
- **Stops.** Every `highway=bus_stop`, bus platform and bus station.
  - A `stop_position` (the point on the road) becomes the stop beside it, within 35 m.
  - Same-name stops within 30 m are one stop.
  - A stop already in the database is reused: the same name within 30 m, or any stop within 15 m.
  - New stops get the code `OSM-<node id>`.
  - Only stops some route serves are imported.
- **Routes.** OSM has one relation per direction, for example `X12i` and `X12v`. Both become one `Via`, coded with the route's number (`X12`, `37-0`, `C8`), because the network runs every route both ways.
  - The path goes through the first direction's stops, in travel order, on the roads: a public OSRM car router ([below](#putting-route-paths-on-the-roads)) answers stop to stop. A stop the router can only reach by going round a block (on the far side of a dual carriageway) is passed by. A relation with fewer than two stops keeps its ways, joined in order.
  - The stops are the relations' stops near that path, plus any stop within 20 m of it, ordered along the path.
  - The municipality is where the route starts.
- **No duplicates.** A route whose path runs within 60 m of an existing route's path is not added again: 85% of its length one way, 70% the other. Both the road path and the ways joined in order are compared, and a route with the same code and name is the same route, so a run after the paths were corrected adds nothing. Its stops are attached to the existing route instead. Existing routes also get the imported stops within 20 m of their path.
- **Vehicles.** The journey planner only uses routes that have a vehicle. `--buses N` gives each new route N vehicles, as the original routes have:
  - Toyota Hiace (15 seats) for chapas, and Mercedes-Benz Sprinter (22) for EMTPM and Corujas;
  - the next free plates from the `ADA-001M` series.

  Like every vehicle without a GPS device, they move on the timetable model ([GPS tracking](gps-tracking.md#how-a-position-is-chosen)). When an operator registers the real vehicle, edit the record or replace it.
- **Backup and undo.** `--apply` first saves every `Paragem`, `Via`, `ViaParagem` and `Transporte` row to `osm-data/backup-<time>.json`. Afterwards it lists what it created in `osm-data/created-<time>.json`: stop codes, route codes, plates, and the stops linked to existing routes. To undo the import, delete those rows.
- **Idempotent.** A second run adds nothing.

On a copy of production (2026-10-18), the OSM data had 1,529 stops after folding:

- 1,455 on a route: 823 new and 632 already in the database;
- 74 on no route, which were skipped.

That run still joined the ways in order. It added 170 routes (4,421 km) with 340 vehicles, and 651 stops to 35 existing routes. The network went from 91 to 261 routes and from 1,004 to 1,855 served stops. A destination list from Av. Eduardo Mondlane went from nothing to 1,095 places.

The same import ran on production on 2026-10-18, with the same result: 823 stops, 170 routes, 13,975 route-stop links and 340 vehicles (ADA-001M to ADA-340M). The backup and the list of created rows are in `transport-client/osm-data/` on the machine that ran it; they are not in the repository.

Speed after the import:

- a destination list or a journey takes about 0.3 s on a warm local server;
- against production, measured from outside, it takes 1 to 1.5 s, and up to 5 s on a cold start.

**Licence.** OpenStreetMap data is © OpenStreetMap contributors, under the [Open Database License](https://www.openstreetmap.org/copyright) (ODbL). The map already credits OpenStreetMap at the bottom right. Under the ODbL's share-alike terms, the imported stops and routes stay under the ODbL; this script and the OSM data it reads are the way to rebuild them.

## Putting route paths on the roads

Some stored paths (`Via.geoLocationPath`) cut across the map in a straight line: over blocks, fields or a river. There are two causes:

- **OpenStreetMap routes with holes, or listed out of order.** The first import joined a relation's ways in the order listed. Where a way was missing, or listed elsewhere, the path jumped straight from the end of one way to the start of the next. The import now goes through the stops instead ([above](#importing-stops-and-routes-from-openstreetmap)).
- **The first routes** were drawn stop to stop by the first data scripts. Their straight lines are cut into points a few tens of metres apart.

`transport-client/scripts/snap-paths.mjs` puts these jumps on the roads:

```bash
cd transport-client
DATABASE_URL=… node scripts/snap-paths.mjs                          # dry run: what would change, writes nothing
DATABASE_URL=… node scripts/snap-paths.mjs --apply                  # local databases only
DATABASE_URL=… node scripts/snap-paths.mjs --apply --production     # a remote database
```

How it works:

- **Straight stretches.** The path is read as straight stretches: consecutive points that lie within 3 m of one line. Every stretch of at least 300 m (`--min`) is checked. For each one, the script asks a public OSRM car router for the road between its two ends.
- **Kept: a straight road.** When the road stays within 50 m of the line, the road itself is straight (Av. das Indústrias, the Marginal), and the stretch is kept.
- **Replaced.** When the road stays within a quarter of the stretch's length of the line (at least 300 m), the stretch is replaced by the road.
- **Kept: a road cars cannot take straight.** A car road that strays further, or is more than 3 times as long (+500 m), may come from one-way rules: on a dual carriageway such as the N4, or a one-way street, cars are sent round. The FOSSGIS foot router, which ignores them and takes tracks, is asked too. When its road stays within 80 m of the line, there is a road along it, and the stretch is kept.
- **Kept and listed: no road along it.** Otherwise the line crosses blocks, and the car road is the router's own way between two far points, such as a ring road or the city centre: not the bus's. The stretch is kept. The dry run lists the routes left with a jump of 1 km or more: [`redraw-from-osm.mjs`](#redrawing-routes-from-their-openstreetmap-stops) rebuilds the OpenStreetMap ones, and the others are redrawn in the admin ([Vias → the route → Redesenhar percurso](admin-dashboard.md#routes-vias)).
- **Simplified.** The new path is simplified to 4 m and written only when it changed.
- **Routers.** The public routers allow light use, one request a second each. Car requests alternate between the FOSSGIS router and the OSRM demo router, and foot requests go to the FOSSGIS foot router, so a first run over the whole network takes about an hour. Their answers are kept in `osm-data/road-cache.json` (`scripts/roads.mjs`, shared by the three scripts), so a second run on the same data asks nothing again. Copy that file along to run on another copy of the same data.
- **Backup and undo.** `--apply` first saves every route's id, code and path to `osm-data/backup-paths-<time>.json`. To undo, write those paths back. A route whose path changed since it was read is skipped.

On a copy of production (2026-10-18), the script checked 5,650 stretches of 300 m or more on 261 routes:

| Result | Stretches |
|---|---|
| Straight roads, kept | 5,541 |
| Put on the road | 92 |
| No road along them, kept | 17 |

49 routes changed; 45 of them by less than a tenth of their length. Examples:

- X36 (Costa do Sol – Malhazine) went from 18.7 to 23.3 km. Its diagonal over the blocks now follows the streets.
- 203 (Baixa – Kongolote) went from 38.0 to 43.3 km. Its 16 km line over the airport now follows the N1.
- 47-0 (Baixa – Tchumene) no longer crosses the Rio Matola beside the N4.

10 routes still have a jump of 1 km or more. Nine are OpenStreetMap routes, redrawn by the next script; the tenth, V086, is redrawn by hand. The longest jumps:

- 214 (Tchumene – Magoanine), 18.7 km: the router went through the city centre, which its name rules out;
- 504 (Novo Cemitério – Praça dos Combatentes), 13.4 km;
- 216 (Patrice Lumumba – Praça dos Combatentes), 8.8 km.

47-0, 107 and X16 were listed too before the foot router was asked: their lines follow the N4 and other dual carriageways.

**Licence.** The roads come from OpenStreetMap (© OpenStreetMap contributors, ODbL), routed by OSRM on the FOSSGIS and OSRM demo servers.

## Redrawing routes from their OpenStreetMap stops

The jumps `snap-paths.mjs` leaves on OpenStreetMap routes come from the relation itself: its ways are listed out of order, or some are missing, so no single road can replace the jump. `transport-client/scripts/redraw-from-osm.mjs` rebuilds such a route's whole path from the relation's stops, the way the import now draws new routes. Run it after `snap-paths.mjs`, with the OSM data from `import-osm.mjs --fetch` and the same `osm-data/road-cache.json`:

```bash
cd transport-client
DATABASE_URL=… node scripts/redraw-from-osm.mjs                          # dry run: what would change, writes nothing
DATABASE_URL=… node scripts/redraw-from-osm.mjs --apply                  # local databases only
DATABASE_URL=… node scripts/redraw-from-osm.mjs --apply --production     # a remote database
DATABASE_URL=… node scripts/redraw-from-osm.mjs --routes 214,504         # only these routes
DATABASE_URL=… node scripts/redraw-from-osm.mjs --unlink-far 503,X05      # also unlink these routes' far stops
```

How it works:

- **Which routes.** The routes with a jump of 1 km or more that no road follows, by the same test as `snap-paths.mjs`, and that have an OpenStreetMap relation with their number (`214` → `214i`, `214v`). A route without one is kept and listed.
- **The path.** The car road through the stops of the "i" relation (the direction the import used), in travel order: the stop positions on the road, or the platforms when the relation has none. Like every stored path, it is one direction; the buses come back along it. A stop the router only reaches by going round a block is passed by.
- **Stops.** The relations' stops now on the path (a stop in the database within 35 m of the OSM stop, and within 30 m of the new path) are linked to the route if they were not. Stops already linked stay linked. The dry run counts, for each route, the linked stops now more than 100 m from the path (`--verbose` names them).
- **Unlinking far stops.** `--unlink-far 503,X05` unlinks, from the routes named only, the linked stops more than 100 m from the path. A far stop of the route's own OSM relations is kept: it is on the way back, which takes another street, and the stored path holds one direction. Each route is named on purpose, after reading the dry run; the route's "Redesenhar percurso" page in the admin does the same by hand.
- **Backup and undo.** `--apply` first saves the routes' paths and stop links to `osm-data/backup-redraw-<time>.json`, writes a path only if it is still the one read, and lists the links it added in `osm-data/created-redraw-<time>.json`. To undo, write the paths back and delete those links.

On a copy of production (2026-10-18), after `snap-paths.mjs`:

| Route | Before | After | Stops linked |
|---|---|---|---|
| 214 Tchumene – Magoanine | 80.0 km | 31.2 km | +38 |
| 503 FACIM – Praça dos Combatentes | 48.7 km | 28.0 km | |
| C6 Museu – Patrice Lumumba | 47.3 km | 29.3 km | +12 |
| 504 Novo Cemitério – Praça dos Combatentes | 39.6 km | 22.6 km | +2 |
| 216 Patrice Lumumba – Praça dos Combatentes | 32.4 km | 20.6 km | +18 |
| X05 Anjo Voador – Malhazine | 28.7 km | 16.0 km | |
| 114 Museu – Padaria Boane | 19.1 km | 18.9 km | +8 |
| 113 Baixa – Padaria Boane | 17.9 km | 17.7 km | +8 |
| X45 Praça dos Combatentes – Escola Graça Machel | 14.5 km | 7.8 km | |

With `--unlink-far 503,X05`, 5 stops the old jumps had picked up were unlinked: Dom Nhelete and Casa Branca from 503; Ronil, Cine África / Ministério and Cooperativa from X05. Entrada de Facim (503) and Correios (X05) stay: they are stops of 503v and X05v, the way back.

A second `snap-paths.mjs` dry run then lists one route: V086 (Rua dos Bons Amigos – Antena), which is not from OpenStreetMap. Its 2 km straight line is a real street that OpenStreetMap maps with a break, so no router follows it; it stays as drawn.

**New routes.** The import draws new routes through their stops, and the admin only saves a road path (on "Nova Via" and "Redesenhar percurso"), so straight jumps no longer come in. The legacy `create-*.js` scripts of the initial data ([Architecture](architecture.md)) still write straight stop-to-stop lines; do not use them for new routes.

## Drivers for the imported vehicles

The 340 vehicles added by the OpenStreetMap import had no driver. `transport-client/scripts/add-drivers.mjs` gives each vehicle without a driver a demo driver, like the 111 drivers of the first data:

```bash
cd transport-client
DATABASE_URL=… node scripts/add-drivers.mjs                          # dry run: who would be created
DATABASE_URL=… node scripts/add-drivers.mjs --apply                  # local databases only
DATABASE_URL=… node scripts/add-drivers.mjs --apply --production     # a remote database
```

- **The records.** Names come from common Mozambican first names and surnames. Each driver has the same fields as the first demo drivers:
  - BI `1102…` and licence `CC-<year>-…`;
  - an `@transport.co.mz` email, a phone and an address;
  - an emergency contact, issue and expiry dates, and the status `ativo`;
  - the vehicle it drives.
- **No photo and no PIN.** The apps show the initials instead of a photo. An administrator generates the PIN when a driver needs to sign in ([Admin dashboard](admin-dashboard.md#drivers-motoristas)).
- **No clashes.** Numbers and emails continue after the highest existing ones, and phones are checked against every existing driver. A fixed seed means the same data always gives the same drivers.
- **Backup and undo.** `--apply` first saves every `Motorista` row to `osm-data/backup-drivers-<time>.json`, then lists the created drivers' ids in `osm-data/created-drivers-<time>.json`. To undo, delete those drivers.
- **Idempotent.** A second run creates nothing, because every vehicle then has a driver.

On a copy of production (2026-10-18), it created 340 drivers: all 451 vehicles then had one, and the dashboard's "sem motorista" banner was gone. The same drivers were added to production that day ([Project status → The data](project-status.md#the-data)).

## Schema changes and migrations

The migration history lives in `prisma/migrations/` (six migrations, `20260430170348_init` to `20261016150000_vehicle_gps`). On a new database, `prisma migrate deploy` applies them all ([Getting started](getting-started.md#5-create-the-schema)).

**The production database has no `_prisma_migrations` table.** It was created with `db push`, before the migration history existed, so `prisma migrate deploy` would try to recreate every table. For this reason migrations are written to be safely re-runnable (`ADD COLUMN IF NOT EXISTS`, `CREATE … IF NOT EXISTS`). To change the production schema:

1. Edit `prisma/schema.prisma` and copy the change to `transport-client/prisma/schema.prisma` and `transport-admin/prisma/schema.prisma`. The admin copy keeps its `previewFeatures = ["omitApi"]` line.
2. Add a migration folder `prisma/migrations/<timestamp>_<name>/migration.sql` written with `IF NOT EXISTS`.
3. Test it on a local database and on a Neon branch of production.
4. See what production lacks, using the **direct** (non-pooler) URL:

   ```bash
   cd transport-client
   npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel ../prisma/schema.prisma --script
   ```

5. Apply the new migration's SQL:

   ```bash
   npx prisma db execute --url "$DIRECT_URL" --file ../prisma/migrations/<timestamp>_<name>/migration.sql
   ```

6. Run the diff again. It must print an empty migration.
7. Deploy the code that uses the new columns only after the columns exist.

## Size at the time of writing

Production on 2026-10-18, after the OpenStreetMap import:

| Table | Rows |
|---|---|
| Provincia / Cidade / Municipio | 11 / 0 / 2 |
| Via / Paragem / ViaParagem | 261 / 1,902 / 17,287 |
| Transporte / GeoLocation | 451 / 111 |
| Motorista | 451: the 111 of the first data and 340 demo drivers for the imported vehicles, added the same day ([above](#drivers-for-the-imported-vehicles)) |
| Proprietario / TransporteProprietario | 11 / 0 (no vehicle has an owner linked yet) |
| Tarifa | 1 |
| Administrador | 3 |

---

[← Data flow](data-flow.md) · [Documentation index](README.md) · Next: [Data sources →](data-sources.md)
