# Database

The whole platform uses one PostgreSQL database: Neon in production, running PostgreSQL 18. The schema is defined once, in `prisma/schema.prisma` at the repository root, and accessed through Prisma 5.22. This page describes every table and the storage conventions you need to read the data correctly. It also shows how to connect and gives example queries that were run against a copy of the production data.

**On this page:** [Entity diagram](#entity-diagram) · [Tables](#tables) · [Conventions](#conventions-read-this-before-querying) · [Connecting](#connecting) · [Example queries](#example-queries) · [Changing data](#changing-data) · [Schema changes and migrations](#schema-changes-and-migrations) · [Size](#size-at-the-time-of-writing)

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

Three ways in:

1. **Neon console → SQL Editor.** Runs queries in the browser against a chosen branch. Good for quick reads.
2. **`psql "<direct connection string>"`.** Neon requires TLS, and the string already contains `sslmode=require`.
3. **Prisma Studio.** A table browser (below) pointed at the database through `DATABASE_URL`.

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

## Example queries

Every query below was run with `psql` against a copy of the production data on 2026-10-17, and the outputs are real. Outputs that would show passengers' names or phone numbers are left out. Start the session with:

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

The rows come back in no particular order. For the travel order, use the API (`GET /api/available-routes?municipioId=…&viaId=…`), which orders them along the path ([API reference](api-reference.md#get-apiavailable-routes)).

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
- **The fare rule has no UI.** Change it with SQL. The apps pick up the change within 60 s:

  ```sql
  UPDATE "Tarifa" SET "precoPorKm" = 12, "updatedAt" = now() WHERE ativa;
  ```

- **Never run a seed script against production.** Every seed starts by deleting every row of every table.
- Wrap manual multi-statement changes in `BEGIN; … COMMIT;` and check the row counts before committing.

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

Production on 2026-10-17:

| Table | Rows |
|---|---|
| Provincia / Cidade / Municipio | 11 / 0 / 2 |
| Via / Paragem / ViaParagem | 91 / 1,079 / 3,312 |
| Transporte / GeoLocation | 111 / 111 |
| Motorista | 111 (each assigned to a vehicle) |
| Proprietario / TransporteProprietario | 11 / 0 (no vehicle has an owner linked yet) |
| Tarifa | 1 |
| Administrador | 3 |

---

[← Data flow](data-flow.md) · [Documentation index](README.md) · Next: [Configuration →](configuration.md)
