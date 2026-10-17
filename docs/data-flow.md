# Data flow

This page follows the data through each flow of the platform, from the first request to the rows it reads or writes. Each flow names the endpoint, the code that handles it (`transport-client/...` or `transport-admin/...`) and the tables involved. Table and field meanings are in [Database](database.md).

**On this page:** [Search and arrival time](#search-and-arrival-time) · [Live map](#live-map) · [Tracking page](#tracking-page) · [Arrival alert and SMS](#arrival-alert-and-sms) · [USSD session](#ussd-session) · [Driver sign-in and trip](#driver-sign-in-and-trip) · [GPS position](#gps-position) · [Admin changes](#admin-changes) · [PIN and device code](#driver-pin-and-gps-device-code) · [Who writes what](#who-writes-each-table)

---

## Search and arrival time

The search form narrows municipality → route → origin stop → destination. It only offers choices that have buses. The search then asks for every bus on the chosen route.

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (/search)
  participant C as transport-client
  participant DB as PostgreSQL
  B->>C: GET /api/available-routes
  C->>DB: Municipio with Via that have Transporte
  C-->>B: municipios
  B->>C: GET /api/available-routes?municipioId=…
  C-->>B: municipios + that municipality's routes (Via) that have buses
  B->>B: groups routes with the same terminals into one choice
  B->>C: GET /api/available-routes?municipioId=…&viaId=…
  C->>DB: ViaParagem + Paragem of the route's vias, ordered along Via.geoLocationPath
  C-->>B: stops in travel order
  B->>C: GET /api/buses?paragemId=ORIGIN&destinoId=DEST&viaIds=A,B
  C->>DB: Via + ViaParagem + Paragem + Transporte (+ active Tarifa, cached 60 s)
  Note over C: for each bus: vehiclePosition() = fresh GPS or timetable<br/>estimateBusTrip() = arrival, trip time and fare along the road path
  C-->>B: buses sorted by arrival time
  B->>B: "Acompanhar" → /track/{busId}?paragem=ORIGIN&destino=DEST
```

How the numbers are made (`lib/vehiclePosition.ts`, `lib/fares.ts`):

- **Stop order.** `ViaParagem` has no order column. Stops are ordered by projecting each one onto the route's path (`orderStopsAlongRoute`). Trips can run either way: a destination before the origin is a trip on the return leg.
- **Arrival ("Chega em").** The distance the bus still drives until it passes the origin in the right direction, plus a 5-minute stop at each terminal it turns around at, divided by the fare rule's travel speed (`velocidadeViagemKmh`, 30 km/h by default). Buses only run 05:00–21:00 (Maputo time). A pass that would come after 21:00, or a search made at night, gets the bus's first pass of the next morning. Waits of 60 minutes or more are shown as a clock time ("às 11:56", "amanhã às 05:12").
- **Trip distance, time and fare.** Measured along the road path between the origin and the destination. Fare = max(`tarifaMinima`, ⌈km × `precoPorKm`⌉), which is 10 MT minimum and 10 MT/km by default. A route with no path falls back to the stop-to-stop chain.

## Live map

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (/)
  participant C as transport-client
  participant DB as PostgreSQL
  B->>C: GET /api/startup
  C-->>B: {mode: "gps-or-timetable", busCount, withFreshGps}
  C--)C: waitUntil(maybeCheckArrivals())
  B->>C: GET /api/buses
  C->>DB: every Transporte with its Via path
  C-->>B: buses with position, route line, stops
  loop every 5 s
    B->>C: GET /api/buses?fields=position
    C->>DB: position fields only (route paths cached 5 min per instance)
    C--)C: waitUntil(maybeCheckArrivals())
    C-->>B: {buses:[{id, latitude, longitude, fonte, direcao}], total}
    B->>B: markers glide to the new positions
  end
```

`fonte` is `"gps"` when a real fix younger than 3 minutes exists, otherwise `"horario"` (timetable). The map opens on the area where the buses are: the 10th–90th percentile of their positions.

## Tracking page

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (/track/{id})
  participant C as transport-client
  participant DB as PostgreSQL
  loop every 10 s
    B->>C: GET /api/bus/{id}?paragem=ORIGIN&destino=DEST
    C->>DB: Transporte + Via + ViaParagem + Paragem + Tarifa
    C-->>B: position, route line, stops (isPickup / isDestination),<br/>tempoEstimado, distancia, tempoViagem, distanciaViagem, fare, jaPassou
  end
  opt passenger signed in
    B->>C: GET /api/user/missions (Bearer token)
    C-->>B: alerts, to mark this stop as already saved
  end
```

The same `estimateBusTrip()` serves `/api/buses`, `/api/bus/[id]` and USSD option 1, so the web and USSD always agree.

## Arrival alert and SMS

A `MISSION` row is "this passenger is waiting at this stop". There are two ways to create one:

- on the web: the tracking page's "Adicionar aos Meus Transportes" calls `POST /api/user/missions/save` with the passenger's token;
- by USSD: option 1's result screen. That screen also creates a passwordless `Utente` for the phone number if none exists.

```mermaid
sequenceDiagram
  autonumber
  participant T as Trigger (/api/startup or the 5-second position poll)
  participant C as transport-client (lib/busSimulator.ts)
  participant DB as PostgreSQL
  participant AT as Africa's Talking
  participant P as Passenger's phone
  T->>C: maybeCheckArrivals() (at most once every 30 s per instance)
  C->>DB: MISSION created in the last 24 h,<br/>notificadoEm null or older than 30 min
  C->>DB: Transporte on routes through those stops
  loop each alert
    C->>C: vehiclePosition() of each bus on the route
    alt a moving bus is less than 1 km from the stop
      C->>DB: UPDATE MISSION SET notificadoEm = now()
      C->>AT: SMS "Autocarro {matrícula} está a {n} minutos da {paragem}!"
      AT->>P: SMS
    end
  end
```

The alert is marked before the SMS is sent, so a failing SMS is not retried every 30 s. Asking again on the web for the same stop restarts the alert (new `createdAt`, `notificadoEm` cleared). USSD reuses an alert for that stop from the last 24 h, or creates a new one. `POST /api/simulation {"action":"check"}` runs the check on demand.

## USSD session

```mermaid
sequenceDiagram
  autonumber
  participant P as Phone
  participant AT as Africa's Talking
  participant C as transport-client /api/ussd
  participant DB as PostgreSQL
  P->>AT: dials *384*848080# (sandbox code)
  AT->>C: POST sessionId, serviceCode, phoneNumber, text=""
  C-->>AT: "CON Transportes Mocambique / 1. Encontrar transporte …"
  AT-->>P: menu
  P->>AT: 2
  AT->>C: POST text="2"
  C->>DB: origin places (Via.terminalPartida)
  C-->>AT: "CON Procurar rotas - origem: …"
  P->>AT: 3 then 1
  AT->>C: POST text="2*3*1"
  C->>DB: routes from that place, Tarifa
  C-->>AT: "END Rota 81 … Tarifa (percurso todo): 510 MT"
  C--)AT: waitUntil(send the same text by SMS)
  AT-->>P: final screen, then the SMS
```

Every request carries the full input history in `text`. The server splits it on `*`, replays navigation keys (`7` next page, `8` previous, `0` back), and answers within 182 characters. The full menu is in [USSD service](ussd.md).

## Driver sign-in and trip

```mermaid
sequenceDiagram
  autonumber
  participant D as Driver portal (browser)
  participant C as transport-client
  participant DB as PostgreSQL
  D->>C: POST /api/driver/login {telefone, password: PIN}
  C->>DB: Motorista by phone (ignores spaces and +258), bcrypt.compare(PIN)
  C-->>D: token (30 days) + driver, vehicle, route, stops, trip state
  D->>D: localStorage["motorista"] = response
  D->>C: POST /api/driver/trip {action: "iniciar"} (Bearer)
  C->>DB: UPDATE Motorista SET emViagem = true, viagemIniciadaEm = now()
  loop every 30 s
    D->>C: GET /api/driver/trip (Bearer)
    C-->>D: {emViagem, viagemIniciadaEm}
  end
  loop every 60 s
    D->>C: GET /api/driver/seguidores (Bearer)
    C->>DB: MISSION of the last 3 h at the route's stops
    C-->>D: {total, paragens:[{nome, aEspera}]}
  end
```

USSD option 6 (`6*PIN*1*1`) writes the same two fields, so a trip started on one side shows on the other within 30 s. See [Driver portal](driver-portal.md).

## GPS position

```mermaid
sequenceDiagram
  autonumber
  participant G as Traccar Client / tracker / driver portal
  participant C as transport-client /api/gps
  participant DB as PostgreSQL
  G->>C: GET or POST ?id=CODE&lat=…&lon=…&timestamp=…&speed=knots<br/>or POST JSON with Authorization: Bearer CODE (speed km/h)
  C->>DB: Transporte WHERE gpsDispositivoHash = sha256(CODE)
  alt unknown code
    C-->>G: 401
  else accuracy over 200 m, or older than the last fix
    C-->>G: 200 {ok:true, ignored:"…"}
  else
    C->>DB: UPDATE Transporte SET currGeoLocation, gpsAtualizadoEm, gpsVelocidade (km/h), gpsDirecao
    C-->>G: 200 {ok:true}
  end
```

Readers do not change. For 3 minutes after a fix, `vehiclePosition()` returns the GPS point instead of the timetable point, in every endpoint and in the admin. See [GPS tracking](gps-tracking.md).

## Admin changes

```mermaid
sequenceDiagram
  autonumber
  participant A as Admin browser
  participant X as transport-admin (proxy.ts)
  participant R as Route handler
  participant DB as PostgreSQL
  A->>X: POST /api/auth/admin/login {email, senha}
  X->>R: (public route)
  R->>DB: Administrador by email, bcrypt.compare
  R-->>A: Set-Cookie admin_session (HttpOnly, 12 h)
  A->>X: GET/POST/PUT/PATCH/DELETE /api/… (cookie)
  alt missing or invalid cookie
    X-->>A: 401 → the app signs out
  else
    X->>R: handler
    R->>DB: Prisma CRUD
    R-->>A: JSON
  end
```

The admin never calls the passenger app. A change to a route, stop, vehicle or fare shows up in the passenger app, USSD and driver portal on their next read. The fare rule is cached 60 s per instance, and route paths for the live map are cached 5 minutes per instance.

## Driver PIN and GPS device code

| Action (admin) | Endpoint | Stored | Returned once |
|---|---|---|---|
| "Gerar PIN" / "Gerar novo PIN" | `POST /api/motoristas/{id}/pin` | `Motorista.password` = bcrypt(6-digit PIN from `crypto.randomInt`) | `{"pin": "123456"}` |
| Remove PIN | `DELETE /api/motoristas/{id}/pin` | `Motorista.password` = null (driver cannot sign in) | `{"definido": false}` |
| "Gerar código do dispositivo" / "Gerar novo código" | `POST /api/transportes/{id}/gps` | `Transporte.gpsDispositivoHash` = sha256(20-character code, 120 random bits) | `{"codigo": "…", "servidor": GPS_SERVER_URL}` |
| "Revogar dispositivo" | `DELETE /api/transportes/{id}/gps` | hash and GPS fields cleared; the vehicle returns to timetable positions | `{"ok": true}` |

A new PIN or code replaces the old one at once.

## Who writes each table

| Table | Written by | Read by |
|---|---|---|
| `Administrador` | admin | admin |
| `Provincia`, `Cidade`, `Municipio` | admin (`Cidade` has no UI and is empty) | admin; passenger app (`Municipio` for the search filter) |
| `Via`, `Paragem`, `ViaParagem` | admin | everything |
| `Transporte` (network fields) | admin | everything |
| `Transporte` (GPS fields) | passenger app `/api/gps`; admin clears them on revoke | everything |
| `Motorista` (profile, PIN) | admin | admin; passenger app (sign-in, USSD) |
| `Motorista.emViagem`, `viagemIniciadaEm` | passenger app (`/api/driver/trip`, USSD option 6) | passenger app, admin |
| `Proprietario`, `TransporteProprietario` | admin | admin |
| `Utente` | passenger app (registration, profile, USSD option 1); admin | both |
| `MISSION` | passenger app (web alert, USSD option 1; `notificadoEm` by the arrival check) | passenger app, driver portal (waiting count), admin (passenger and stop pages) |
| `GeoLocation` | initial data import only | only the legacy Telerivet USSD route (positions now come from `Transporte`) |
| `Tarifa` | SQL by hand (no UI) | passenger app, admin |

---

[← Architecture](architecture.md) · [Documentation index](README.md) · Next: [Database →](database.md)
