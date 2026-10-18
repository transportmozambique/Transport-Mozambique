# API reference

Every HTTP endpoint of the two apps that have an API. The driver portal has none: it calls the passenger app ([Architecture](architecture.md#how-the-parts-connect)).

The example responses were recorded on a local copy of the production data on 2026-10-17, with long arrays cut to two items (`"… (238 items)"`) and long strings shortened (`…`).

**On this page:** [Conventions](#conventions) · [Passenger app](#passenger-app-transport-client) ([map and journeys](#map-and-journeys) · [passenger account](#passenger-account) · [driver](#driver) · [GPS](#gps) · [USSD](#ussd)) · [Admin app](#admin-app-transport-admin) ([session](#session) · [lists and records](#lists-and-records) · [vehicles](#vehicles) · [drivers](#drivers) · [statistics](#statistics))

---

## Conventions

| | Passenger app | Admin app |
|---|---|---|
| Base URL | `https://transport-mz.vercel.app` (local: `http://localhost:3000`) | `https://transport-mz-admin.vercel.app` (local: `http://localhost:3002`) |
| Code | `transport-client/app/api/**/route.ts` | `transport-admin/app/api/**/route.ts` |
| Authentication | Mostly public. Passenger and driver endpoints take `Authorization: Bearer <token>` ([Security](security.md)). | Every endpoint except sign-in needs the `admin_session` cookie. |
| Cross-origin | `Access-Control-Allow-Origin: *` on `/api/driver/*` and `/api/gps` only | none (same-origin only) |

- Bodies are JSON (`Content-Type: application/json`), except USSD (form-encoded in, `text/plain` out) and GPS (also accepts query parameters and forms).
- Errors are JSON `{"error": "…"}`, sometimes with `"details"`, and the message is in Portuguese. Typical statuses: 400 invalid input, 401 no or bad session, 404 not found, 500 server or database error.
- Ids are Prisma `cuid`s (`cmovfwlry0a5z14lnnytqzom2`).
- Coordinates: response fields `latitude`/`longitude` are numbers. Stored strings keep the database's formats: points `"lat,lng"`, paths `"lng,lat;lng,lat;…"`. `routeCoords` and `routePath` arrays are `[lng, lat]` pairs ([Database → Conventions](database.md#conventions-read-this-before-querying)).
- Times are ISO 8601 in UTC; Maputo is UTC+2.

---

## Passenger app (`transport-client`)

### Map and journeys

#### `GET /api/startup`

Starts an arrival-SMS check in the background ([Data flow → Arrival alert](data-flow.md#arrival-alert-and-sms)) and reports the position mode. No page calls it any more (the map's position refresh triggers the same check).

```json
{"success": true, "status": {"mode": "gps-or-timetable", "busCount": 111, "withFreshGps": 0, "lastArrivalCheck": null}}
```

#### `GET /api/stops`

Every stop served by a bus, with the routes through it, for the map and the name search. Each stop lists its routes as indexes into `vias`. `semAutocarro` lists the other stops (none of their routes has a vehicle), as `{"id", "nome", "lat", "lng"}`, so the map can still show them. Cached 5 minutes (`Cache-Control: public, s-maxage=300`), about 280 KB (70 KB compressed).

```json
{
 "vias": [{"id": "cmoveu8as00yr14lnpndpwdqj", "codigo": "V086", "nome": "Rua Dos Bons Amigos - Antena", "cor": "#F7DC6F"}, "… (261 items)"],
 "paragens": [{"id": "cmoveoy8l00d214lnk8uwxf8t", "nome": "Portão", "lat": -25.784395699999997, "lng": 32.58930225,
               "v": [0, 3, 12, 13, "…"]}, "… (1855 items)"]
}
```

#### `GET /api/stops/{id}`

A stop's routes, and for each direction of each route the next bus and the stops it goes to, in order. `destinos` lists every place reachable from the stop with up to 4 buses, earliest arrival first ([Data flow → Journey planning](data-flow.md#journey-planning)). `para` names the direction by the stop at that end of the route. `minutos` follows the same rules as everywhere else ([Data flow → Arrival time](data-flow.md#arrival-time)); `proximo` is `null` when no bus of the route can come.

```json
{
 "paragem": {"id": "cmoveoy8l00d214lnk8uwxf8t", "nome": "Portão", "lat": -25.784395699999997, "lng": 32.58930225, "codigo": "PAR-0469"},
 "rotas": [{
   "via": {"id": "cmoveu8as00yr14lnpndpwdqj", "codigo": "V086", "nome": "Rua Dos Bons Amigos - Antena", "cor": "#F7DC6F"},
   "sentidos": [{
     "para": "Antena",
     "proximo": {"minutos": 10, "matricula": "ACK-145M", "transporteId": "cmozbudx900049ounfhdlny9a"},
     "paragens": [{"id": "cmoveoy0q00d114lnzprias6n", "nome": "Michafutene", "lat": -25.7843419, "lng": 32.5924715}, "… (27 items)"]
   }, "… (other direction)"]
 }, "… (22 routes)"],
 "destinos": [
   {"ids": ["cmoveoy0q00d114lnzprias6n"], "nome": "Michafutene", "chegada": "2026-10-18T03:03:23.221Z", "minutos": 334,
    "transbordos": 0, "vias": [{"codigo": "V101", "nome": "Moamba - Djimomposse", "cor": "#FF6B6B"}],
    "embarque": {"id": "cmoveoy8l00d214lnk8uwxf8t", "nome": "Portão", "lat": -25.784395699999997, "lng": 32.58930225}, "metrosAtePrimeira": 0},
   {"ids": ["cmoveqpvj00kv14lnwb9sor5u", "… (6 stops of one place)"], "nome": "Estrada Circular - Rua Baixo dos Fios 380 m",
    "chegada": "2026-10-18T03:34:23.221Z", "minutos": 365, "transbordos": 2,
    "vias": [{"codigo": "V052", "nome": "Rua 15 - Barraca Azul", "cor": "#F1FAEE"}, {"codigo": "V076", "…": "…"}, {"codigo": "V089", "…": "…"}],
    "embarque": {"id": "cmoveoy0q00d114lnzprias6n", "nome": "Michafutene", "…": "…"}, "metrosAtePrimeira": 280},
   "… (408 places)"
 ]
}
```

`ids` are the place's stops (pass them as `to` to `/api/journeys`), `nome` tells same-name places apart, and `vias` are the buses' routes in the order they are taken. `embarque` is the stop where the first bus is taken: this stop, or one within 300 m. `metrosAtePrimeira` is the walk to it.

Errors: 404 `Paragem não encontrada`.

#### `GET /api/destinos`

Every place reachable from a start with up to 4 buses, earliest arrival first, for the panel's "Para onde ir" list. Each entry says where to take the first bus: B in A → B → C ([Data flow → Journey planning](data-flow.md#journey-planning)).

| Query | Meaning |
|---|---|
| `lat`, `lng` | the passenger's position; the first bus is taken at whichever of the 8 nearest stops within 800 m gets there soonest, walk included |
| `from` | instead of a position: a stop id, or several, comma-separated, for one place |

The entries have the same fields as `destinos` in [`GET /api/stops/{id}`](#get-apistopsid). The panel asks again when the position has moved about 100 m.

```json
{
 "destinos": [
   {"ids": ["cmoveoxsu00d014ln67l0uot1"], "nome": "Igreja - Makalela", "chegada": "2026-10-19T05:54:02.831Z", "minutos": 10,
    "transbordos": 0, "vias": [{"codigo": "V052", "nome": "Rua 15 - Barraca Azul", "cor": "#F1FAEE"}],
    "embarque": {"id": "cmoveoy8l00d214lnk8uwxf8t", "nome": "Portão", "lat": -25.784395699999997, "lng": 32.58930225},
    "metrosAtePrimeira": 69},
   {"ids": ["cmovem8oo001c14ln40xsj3g0", "… (4 stops of one place)"], "nome": "Maputo - Wintbank - Tricamo 1730 m",
    "chegada": "2026-10-19T08:01:02.831Z", "minutos": 137, "transbordos": 1,
    "vias": [{"codigo": "V080", "…": "…"}, {"codigo": "V051", "…": "…"}],
    "embarque": {"id": "cmovenf64006i14lnul7e0xjz", "nome": "Michafutene (508)", "lat": -25.784588999999997, "lng": 32.5860694},
    "metrosAtePrimeira": 286},
   "… (404 places)"
 ]
}
```

A position with no stop within 800 m gives `{"destinos": []}`. Errors: 400 `Indique a partida (from, ou lat e lng)`; 404 `Paragem não encontrada` (no `from` id is a stop with a bus); 500 `Erro ao listar destinos`.

#### `GET /api/journeys`

Journeys to a destination, with changes of bus when no single bus goes there ([Data flow → Journey planning](data-flow.md#journey-planning)).

| Query | Meaning |
|---|---|
| `to` | destination stop id; several, comma-separated, for one place (same-name stops) |
| `from` | origin stop id, or several for one place (a start picked in the Partida field) |
| `lat`, `lng` | instead of `from`: the passenger's position; the journey starts with a walk to one of the 8 nearest stops within 800 m |

Up to 3 options, earliest arrival first. Times are ISO dates (UTC). `partida` is when the first bus is boarded, `chegada` the arrival at the destination stop, and `duracaoMin` counts from now, walks and waits included; `esperaMin` is the wait at that stop once the passenger is there. Each bus leg has its own `tarifa`, and `percurso` is its road path as `[lng, lat]` points.

```json
{
 "origem": {"id": "cmoveoy8l00d214lnk8uwxf8t", "nome": "Portão", "lat": -25.784395699999997, "lng": 32.58930225},
 "destino": {"id": "cmoveoxl100cz14lnx9owv74d", "nome": "Makalela", "lat": -25.7798167, "lng": 32.60249235},
 "opcoes": [{
   "transbordos": 0, "partida": "2026-10-17T15:07:20.984Z", "chegada": "2026-10-17T15:11:20.984Z",
   "duracaoMin": 14, "tarifa": 16, "metrosAPe": 0,
   "etapas": [{
     "tipo": "autocarro",
     "via": {"id": "cmoveu8as00yr14lnpndpwdqj", "codigo": "V086", "nome": "Rua Dos Bons Amigos - Antena", "cor": "#F7DC6F"},
     "transporte": {"id": "cmozbudx900049ounfhdlny9a", "matricula": "ACK-145M"},
     "sentido": "Antena",
     "de": {"id": "cmoveoy8l00d214lnk8uwxf8t", "nome": "Portão", "lat": -25.784395699999997, "lng": 32.58930225},
     "para": {"id": "cmoveoxl100cz14lnx9owv74d", "nome": "Makalela", "lat": -25.7798167, "lng": 32.60249235},
     "esperaMin": 10, "embarque": "2026-10-17T15:07:20.984Z", "chegada": "2026-10-17T15:11:20.984Z",
     "viagemMin": 4, "metros": 1510, "paragens": 3, "tarifa": 16,
     "percurso": [[32.589304, -25.784361], [32.590143, -25.784347], "… (32 items)"]
   }]
 }, "… (2 more)"]
}
```

A walk is `{"tipo": "pe", "de", "para", "metros", "minutos"}`; from a position, the first walk starts at `{"id": "", "nome": "A sua localização", "lat", "lng"}`. No connection: `"opcoes": []`. Errors: 400 when `to`, or both `from` and `lat`/`lng`, are missing; 404 `Paragem não encontrada`.

#### `GET /api/buses`

Three uses, chosen by the query:

**1. All buses, for the live map** (no query):

```json
{
 "buses": [{
   "id": "cmozbuqta00189ounhmm7x4d6", "matricula": "ACK-185M", "via": "Rota 85",
   "latitude": -26.0503637, "longitude": 32.3397297, "fonte": "horario", "status": "Em Circulação", "fare": 50,
   "routePath": [[32.293904, -25.988661], "… (612 items)"],
   "stops": [{"id": "cmoveqjxi00k514ln4nojifju", "nome": "Segundo Portão da Rádio Marconi",
              "latitude": -25.9886584, "longitude": 32.2938877, "isTerminal": true}, "… (15 items)"]
 }, "… (111 items)"],
 "total": 111
}
```

`fonte` is `gps` (a fix younger than 3 minutes) or `horario` (timetable) ([GPS tracking](gps-tracking.md#how-a-position-is-chosen)). `fare` here is the fare for the whole route.

**2. Positions only, polled every 5 s** (`?fields=position`). Also triggers the arrival-SMS check (at most every 30 s per instance). Route paths are cached 5 minutes per instance.

```json
{"buses": [{"id": "cmozbuqta00189ounhmm7x4d6", "latitude": -26.0503789, "longitude": 32.3397508, "fonte": "horario", "direcao": 128.63}, "… (111 items)"], "total": 111}
```

`direcao` is the heading in degrees (0 = north), or `null`.

**3. Search: buses that serve an origin and a destination** (`?paragemId=ORIGIN&destinoId=DEST`, optionally `&viaIds=A,B` or the older `&viaId=A`). Without route ids, every vehicle is considered. Results are sorted by arrival time.

```json
{
 "buses": [{
   "id": "cmovfwlry0a5z14lnnytqzom2", "matricula": "ACI-004M",
   "via": "Rua do Cajueiro (Fedel Castro) - Estrada Circular", "viaId": "cmoveturn00xh14lnebtzwv1x",
   "direcao": "Rua do Cajueiro (Fedel Castro) → Farmácia",
   "distancia": 2336, "tempoEstimado": 42, "tempoViagem": 5, "velocidade": 30, "fare": 24,
   "latitude": -25.8272823, "longitude": 32.5702438, "fonte": "horario", "status": "Em Circulação",
   "routeCoords": [[32.549758, -25.839792], "… (238 items)"],
   "stops": ["… (12 items)"]
 }],
 "origem": {"id": "cmoverp1d00p714lng507qgbw", "nome": "Rua do Cajueiro (Fedel Castro)", "latitude": -25.8398513, "longitude": 32.54965},
 "destino": {"id": "cmoverg4e00o314lnyory44cw", "nome": "Petanengue", "latitude": -25.8391986, "longitude": 32.561543}
}
```

| Field | Meaning |
|---|---|
| `tempoEstimado` | minutes until the bus reaches the origin in the direction of travel |
| `distancia` | metres of the **trip** from origin to destination, along the road path |
| `tempoViagem` | minutes on board |
| `fare` | MT, by the active fare rule |
| `velocidade` | km/h now: the GPS speed when fresh, else the fare rule's travel speed (0 when parked) |
| `direcao` | the bus's direction, as "first stop → last stop" of that leg |

Errors: 400 `paragemId (origem) and destinoId are required`; 404 `Origem not found` / `Destino not found`.

#### `GET /api/viagem`

Following a journey: the same buses, leg after leg, timed again now. The page calls it every 10 seconds and whenever the step changes ([Passenger web app → Following a journey](passenger-web.md#following-a-journey-viagem)).

| Query | Meaning |
|---|---|
| `b` | the journey's buses, comma-separated, each `BUS~BOARDING_STOP~ALIGHTING_STOP` |
| `lat`, `lng` | the passenger's position now: the walk to the next bus is measured from it |
| `de` | the start stop, when the journey started at a stop |
| `para` | the destination stop, for the last walk |
| `a` | the leg the passenger is on, from 0; `a` = the number of buses means every bus is done |
| `bordo` | `1` when the passenger is on that leg's bus |

Each step has `estado`: `feito`, `agora` or `depois`. Times are ISO dates (UTC):

- `embarque` is `null` once the passenger is on board;
- `chegada` is `null` for a bus already done.

`autocarro` is where the bus is now. `trecho` says where it is on this leg: `antes` (still to reach the boarding stop), `entre` (between the two stops, going the passenger's way) or `depois` (past the alighting stop). `perde` is true when the bus will pass the boarding stop before the passenger can be there; the times shown are then its next pass.

```json
{"viagem": {
 "chegada": "2026-10-19T05:49:28.153Z", "duracaoMin": 9, "tarifa": 32, "atualizadoEm": "2026-10-19T05:40:28.153Z",
 "etapas": [
  {"tipo": "pe", "estado": "agora", "de": {"id": "", "nome": "A sua localização", "lat": -25.9655, "lng": 32.58},
   "para": {"id": "cmvcydc4b001qac7zobizic5z", "nome": "Pandora", "lat": -25.9658942, "lng": 32.5795913}, "metros": 60, "minutos": 1},
  {"tipo": "autocarro", "estado": "agora",
   "via": {"id": "cmvcydd2906u1ac7z7f709kvg", "codigo": "409", "nome": "Baixa - Costa do Sol", "cor": "#1ABC9C"},
   "transporte": {"id": "cmvcydd2n06w9ac7zd1q8j5t0", "matricula": "ADA-190M"}, "sentido": "P. Trabalhadores",
   "de": {"id": "cmvcydc4b001qac7zobizic5z", "nome": "Pandora", "…": "…"}, "para": {"id": "cmvcydc4e00knac7zeu34eck1", "nome": "P. Trabalhadores (C9)", "…": "…"},
   "embarque": "2026-10-19T05:43:28.153Z", "chegada": "2026-10-19T05:48:28.153Z", "perde": false,
   "viagemMin": 5, "metros": 2164, "tarifa": 22,
   "paragens": [{"id": "cmvcydc4b001rac7z7vi09sdj", "nome": "Pandora", "lat": -25.966035, "lng": 32.5790374}, "…"],
   "percurso": [[32.57954182989588, -25.96596586559796], "…"],
   "autocarro": {"lat": -25.9687197, "lng": 32.5671726, "heading": 212.86, "fonte": "horario", "trecho": "antes",
                 "minutosAteEmbarque": 3, "metrosAteEmbarque": 1250}},
  "… (the next bus, the last walk)"
 ]
}}
```

With one bus and no alighting stop (`b=BUS`, or `b=BUS~STOP`), it answers that bus on its own. `proximas` lists the next 12 stops in the direction it is going, with the minutes until it passes each. `paragem`, when a stop was given, is its next pass there, in either direction.

```json
{"autocarro": {
 "transporte": {"id": "cmvcydd2n06w9ac7zd1q8j5t0", "matricula": "ADA-190M"},
 "via": {"id": "cmvcydd2906u1ac7z7f709kvg", "codigo": "409", "nome": "Baixa - Costa do Sol", "cor": "#1ABC9C"},
 "sentido": "P. Trabalhadores",
 "autocarro": {"lat": -25.9687364, "lng": 32.5671605, "heading": 212.86, "fonte": "horario"},
 "percurso": [[32.565032, -25.971083], "…"],
 "proximas": [{"paragem": {"id": "cmvcydc4b001dac7zvyzznlww", "nome": "Laurentina", "lat": -25.9695161, "lng": 32.5669147}, "minutos": 0}, "…"],
 "paragem": {"paragem": {"id": "cmvcydc4b001qac7zobizic5z", "nome": "Pandora", "…": "…"}, "minutos": 10, "sentido": "Costa do Sol"},
 "atualizadoEm": "2026-10-19T05:43:28.419Z"
}}
```

Errors: 400 `Indique os autocarros (b)`, `Cada autocarro precisa de BUS~DE~PARA`; 404 `Autocarro não encontrado`, `Paragem não encontrada`, `Paragem fora da rota deste autocarro`; 500 `Erro ao acompanhar viagem`.

#### `GET /api/bus/{id}`

One bus, with the trip figures between two stops when `?paragem=ORIGIN&destino=DEST` is given. The web app no longer calls it ([`GET /api/viagem`](#get-apiviagem) replaced it); it stays for scripts and tests.

```json
{
 "id": "cmovfwlry0a5z14lnnytqzom2", "matricula": "ACI-004M",
 "via": "Rua do Cajueiro (Fedel Castro) - Estrada Circular", "viaId": "cmoveturn00xh14lnebtzwv1x",
 "direcao": "Rua do Cajueiro (Fedel Castro) → Farmácia", "velocidade": 30,
 "latitude": -25.8272469, "longitude": 32.5702499, "fonte": "horario", "direcaoGraus": 8.87,
 "posicaoEm": "2026-10-17T09:43:53.332Z", "status": "Em Circulação",
 "routeCoords": [[32.549758, -25.839792], "… (238 items)"],
 "stops": [{"id": "cmoverp1d00p714lng507qgbw", "nome": "Rua do Cajueiro (Fedel Castro)", "latitude": -25.8398513,
            "longitude": 32.54965, "isTerminal": false, "isPickup": true, "isDestination": false}, "… (12 items)"],
 "tempoEstimado": 42, "distancia": 15635, "jaPassou": true,
 "tempoViagem": 5, "distanciaViagem": 2336, "fare": 24
}
```

Here `distancia` is the distance the **bus** still drives to reach the origin, `distanciaViagem` the trip's. `jaPassou` is true when the bus has passed the origin and comes back on its next lap. `posicaoEm` is the time of the GPS fix, or of the computation for a timetable position.

Errors: 404 `Bus not found`; 400 `Route (via) not assigned to this transport`.

#### `GET /api/simulation`, `POST /api/simulation`

`GET` reports the same status as `/api/startup`, with the last arrival check:

```json
{"success": true, "status": {"mode": "gps-or-timetable", "busCount": 111, "withFreshGps": 0,
 "lastArrivalCheck": {"checkedAt": "2026-10-17T09:43:52.729Z", "missions": 4, "notified": 2}}}
```

`POST {"action": "check"}` runs the arrival-SMS check now and answers with `notified` (SMS sent) and the status. Any other action answers 400. The endpoint is public, but the check only sends SMS that are due.

### Passenger account

Sign-in and registration return a token valid 90 days. Every `/api/user/*` call sends it as `Authorization: Bearer <token>` and only reaches the token owner's data; anything else answers 401 `Sessão inválida ou expirada. Entre de novo.` ([Security → Passengers](security.md#passengers)).

#### `POST /api/auth/register`

`{"nome", "email", "telefone", "senha"}`; the password needs at least 6 characters. A phone that already has a passwordless USSD account completes that account. Answers like sign-in.

Errors (400): missing field; `A senha deve ter no mínimo 6 caracteres`; `Este número de telefone já está registado`; `Este email já está registado`. 500 `Sessão indisponível. Tente mais tarde.` when `USER_SESSION_SECRET` is missing in production.

#### `POST /api/auth/login`

`{"telefone": "849990777", "senha": "…"}`. The phone matches with or without `+258`.

```json
{"success": true, "utente": {"id": "cmvbi8o050004rhtj7h310jh9", "nome": "Ana Demo", "email": "ana.demo@local.test",
 "telefone": "849990777", "subscrito": true, "createdAt": "2026-10-16T21:53:47.909Z",
 "token": "cmvbi8o050004rhtj7h310jh9.1800006233.TKuBsQa1…"}}
```

Errors: 400 missing field; 401 `Telefone ou senha incorretos`; 401 `Este número ainda não tem senha. Faça o registo para criar uma.` (USSD-only account).

#### `GET /api/user/{id}`, `PUT /api/user/{id}`

`GET` returns the profile: `id`, `nome`, `email`, `telefone`, `mISSION`, `subscrito`, `dataSubscricao`, `createdAt`. `PUT {"nome"}` changes the name and returns the profile. `{id}` must be the token's passenger.

#### `POST /api/user/{id}/change-password`

`{"currentPassword", "newPassword"}` (at least 6 characters) → `{"success": true, "message": "Senha alterada com sucesso"}`. 401 `Senha atual incorreta`.

#### `GET /api/user/missions`

The passenger's arrival alerts, newest first:

```json
{"missions": [{"id": "cmvbi8o0w0006rhtjp4m58zy1", "mISSIONUtente": "USER-1792226227453", "codigoParagem": "PAR-0906",
  "geoLocationParagem": "-25.8398513,32.54965", "createdAt": "2026-10-17T08:20:00.000Z",
  "notificadoEm": "2026-10-17T09:29:34.496Z", "utenteId": "cmvbi8o050004rhtj7h310jh9", "paragemId": "cmoverp1d00p714lng507qgbw",
  "paragem": {"nome": "Rua do Cajueiro (Fedel Castro)", "codigo": "PAR-0906", "geoLocation": "-25.8398513,32.54965"}}]}
```

`notificadoEm` is when the last arrival SMS for it went out.

#### `POST /api/user/missions/save`

`{"transporteId", "paragemId"}`: wait for a bus at this stop. Creates the alert, or restarts an existing one for the same stop (new `createdAt`, `notificadoEm` cleared): `{"message": "Transporte adicionado aos seus favoritos" | "Transporte já está nos seus favoritos", "missao": {…}}`.

#### `DELETE /api/user/missions/{id}`

Removes one of the passenger's alerts → `{"message": "Missão removida com sucesso"}`. 404 if it does not exist or belongs to someone else.

### Driver

All three answer `Access-Control-Allow-Origin: *` and `OPTIONS` 204, because the driver portal is on another domain. The session token (30 days) goes in `Authorization: Bearer`.

#### `POST /api/driver/login`

`{"telefone": "871831581", "password": "<PIN>"}`. The phone matches whatever its stored format (`+258 87 183 1581`).

```json
{
 "token": "cmovfxigd0adp14lntwnug7fe.1794822233.yhzzTZt5…",
 "id": "cmovfxigd0adp14lntwnug7fe", "nome": "Pedro Tembe", "bi": "110200000083F", "telefone": "+258 87 183 1581",
 "email": "pedro.tembe.motorista84@transport.co.mz", "foto": "https://images.pexels.com/…", "status": "ativo",
 "emViagem": false, "viagemIniciadaEm": null, "categoriaCarta": "D", "experienciaAnos": 11,
 "transporte": {"id": "cmovfwlry0a5z14lnnytqzom2", "matricula": "ACI-004M", "marca": "Toyota", "modelo": "Hiace",
                "cor": "Branco", "lotacao": 15, "currGeoLocation": "-25.827216,32.570255"},
 "via": {"id": "cmoveturn00xh14lnebtzwv1x", "nome": "Rua do Cajueiro (Fedel Castro) - Estrada Circular", "codigo": "V063",
         "terminalPartida": "Rua do Cajueiro (Fedel Castro)", "terminalChegada": "Estrada Circular",
         "geoLocationPath": "32.549758,-25.839792;…", "municipio": "Matola",
         "paragens": [{"id": "cmoverp9500p814ln9nwz5p61", "nome": "Rua do Cajueiro (Fedel Castro)",
                       "geoLocation": "-25.8398116,32.5497614", "isTerminal": true}, "… (12 items)"]}
}
```

`via.paragens` are in travel order. Errors: 400 missing field; 401 `Motorista não encontrado. Contacte o administrador.`, `Ainda não tem PIN. Peça ao administrador para gerar o seu PIN.`, `PIN incorreto`; 500 `Sessão indisponível. Contacte o administrador.` (no `DRIVER_SESSION_SECRET`).

#### `GET /api/driver/trip`, `POST /api/driver/trip`

`GET` → `{"emViagem": false, "viagemIniciadaEm": null}`. `POST {"action": "iniciar"}` or `{"action": "encerrar"}` → the new state, e.g. `{"emViagem": true, "viagemIniciadaEm": "2026-10-17T09:43:53.862Z"}`. Starting a running trip keeps its start time. 400 for another action; 401 `Sessão inválida ou expirada. Entre de novo.`; 404 `Motorista não encontrado`.

#### `GET /api/driver/seguidores`

Passengers waiting along the driver's route: arrival alerts of the last 3 hours per stop, in travel order.

```json
{"total": 3, "paragens": [{"nome": "Rua do Cajueiro (Fedel Castro)", "aEspera": 0}, {"nome": "Rua do Cajueiro (Fedel Castro)", "aEspera": 1}, "… (12 items)"]}
```

### GPS

#### `GET|POST /api/gps`

Positions from a vehicle's device, authenticated by its device code (`?id=` or `Authorization: Bearer`). The full protocol, field aliases, units and rules are in [GPS tracking → Protocol](gps-tracking.md#protocol).

| Request | Answer |
|---|---|
| `GET /api/gps?id=<code>&lat=-25.8305&lon=32.5693&speed=12&bearing=80&timestamp=1792230233` | 200 `{"ok": true}` (stored; 12 knots = 22.2 km/h) |
| `POST` JSON with a timestamp older than the last fix | 200 `{"ok": true, "ignored": "posição mais antiga do que a última"}` |
| unknown code | 401 `{"error": "Dispositivo desconhecido"}` |

### USSD

#### `POST /api/ussd`

The Africa's Talking callback. Form-encoded `sessionId`, `serviceCode`, `phoneNumber`, `text`; answers `text/plain`. When `USSD_CALLBACK_KEY` is set, the URL must carry `?key=<value>`, otherwise 403 ([Security → USSD callback](security.md#ussd-callback)). The first screen (`text` empty):

```text
CON Transportes Mocambique
1. Encontrar transporte
2. Procurar rotas
3. Paragens de uma rota
4. Calcular tarifa
5. Rastrear autocarro
6. Area do motorista
7. Ajuda
```

Every menu, with real screens, is in [USSD service](ussd.md).

#### `POST /api/ussd-telerivet`

The same menus for the Telerivet gateway, which is not in use. It checks `TELERIVET_SECRET` when that variable is set.

---

## Admin app (`transport-admin`)

Without a valid `admin_session` cookie, every endpoint below except sign-in and sign-out answers:

```http
HTTP/1.1 401 Unauthorized

{"error": "Sessão expirada. Inicie sessão novamente."}
```

### Session

| Endpoint | Body | Answer |
|---|---|---|
| `POST /api/auth/admin/login` | `{"email", "senha"}` | the profile, and `Set-Cookie: admin_session=…; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax` (`Secure` in production); 401 `Email ou senha incorretos`; 500 without `ADMIN_SESSION_SECRET` in production |
| `GET /api/auth/admin/session` | | `{"admin": {"id", "nome", "email", "role": "admin"}}` |
| `POST /api/auth/admin/logout` | | clears the cookie |

### Lists and records

Each entity has a list endpoint and a record endpoint:

| Entity | List (`GET`, `POST`) | Record (`GET`, update, `DELETE`) | Update method |
|---|---|---|---|
| Provinces | `/api/provincias` | `/api/provincias/{id}` | `PATCH` |
| Municipalities | `/api/municipios` | `/api/municipios/{id}` | `PATCH` |
| Routes | `/api/vias` | `/api/vias/{id}` | `PATCH` |
| Stops | `/api/paragens` | `/api/paragens/{id}` | `PATCH` |
| Vehicles | `/api/transportes` | `/api/transportes/{id}` | `PUT` (all fields), `PATCH` (route only) |
| Drivers | `/api/motoristas` | `/api/motoristas/{id}` | `PUT` |
| Owners | `/api/proprietarios` | `/api/proprietarios/{id}` | `PUT` |
| Passengers | `/api/utentes` | `/api/utentes/{id}` | `PUT` |
| Administrators | `/api/administradores` | `/api/administradores/{id}` | `PATCH` |

**List query parameters:**

| Parameter | Lists | Meaning |
|---|---|---|
| `page`, `limit` | all except vehicles | page number (from 1) and size; default 10 (passengers and administrators: 25) |
| `limit` | vehicles | maximum rows; default 1000 |
| `search` | all | text filter; case-insensitive except owners. Routes also match the municipality; vehicles match plate, model, make and route name; drivers match name, ID, licence and phone. |
| `countOnly=true` | provinces, municipalities, routes, stops, drivers, owners | counts only, e.g. `{"total": 91}` |
| `filter` | drivers | `ativos`, `inativos` or `comTransporte` |
| `availableOnly=true`, `includeTransportId` | vehicles | vehicles without a driver (plus one given vehicle), for the driver form |

Paged lists answer `{"data": [...], "pagination": {"page", "limit", "total", "totalPages"}}`; the vehicle list answers `{"data": [...], "total": n}`. The route list adds `"totals": {"transportes", "paragens"}` over every route matching the search. `GET /api/vias?limit=1&search=matola` (which matches the municipality):

```json
{"data": [{"id": "cmovetglw00w314lng0gzjlh2", "nome": "120 - Avenida Eduardo Mondlane", "codigo": "V038", "cor": "#F4A261",
  "terminalPartida": "120", "terminalChegada": "Avenida Eduardo Mondlane", "geoLocationPath": "32.433702,-25.89366;…",
  "municipioId": "cmovaprzr000113rkhmw2aazp", "municipio": {"nome": "Matola"}, "_count": {"paragens": 43, "transportes": 1}}],
 "pagination": {"page": 1, "limit": 1, "total": 70, "totalPages": 70}, "totals": {"transportes": 84, "paragens": 2997}}
```

**Deleting.** Records with dependants are refused with 400 and the reason in `error` and `details`:

| Entity | Refused while | `?force=true` (sent by the admin pages) | Also removes |
|---|---|---|---|
| Province | it has municipalities | detaches the municipalities first (`provinciaId = NULL`) | |
| Municipality | it has routes (or stops through them) | not accepted: every route needs a municipality | |
| Vehicle | it has a driver or an owner | | its imported `GeoLocation` rows |
| Driver | they are assigned to a vehicle | unassigns them first | |
| Owner | they own vehicles | removes the owner–vehicle links first | |
| Passenger | they have arrival alerts | deletes the alerts first | |
| Route | | | its stop links; its vehicles lose their route (`viaId = NULL`) |
| Stop | | | its route links and the arrival alerts at it (`{"success": true, "alertasRemovidos": n}`) |

Passwords and PINs are never returned: administrator and passenger queries leave out `senha`, and the admin's Prisma client omits `Motorista.password` from every query.

### Vehicles

#### `PATCH /api/transportes/{id}`

`{"viaId": "<route id>"}` moves the vehicle onto a route; `{"viaId": null}` takes it off. Answers `{"id", "matricula", "viaId", "codigoVia"}`; 404 for an unknown vehicle or route.

#### `GET /api/transportes/estado`

What every vehicle is doing now, for the list's "Agora" column:

```json
{"cmozbuqta00189ounhmm7x4d6": {"estado": "circulacao", "gps": false}, "…": {"estado": "terminal", "gps": false}}
```

`estado` is `circulacao`, `terminal`, `fora-de-servico` or `sem-posicao`.

#### `GET /api/transportes/{id}/posicao`

```json
{"latitude": -25.8305, "longitude": 32.5693, "fonte": "gps", "emMovimento": true, "foraDeServico": false,
 "velocidadeKmh": 22.2, "atualizadoEm": "2026-10-17T09:43:53.000Z", "proximaParagem": "Farmácia", "minutosAteProxima": 33}
```

#### `GET /api/transportes/{id}/operacao`

The vehicle's day by the timetable:

```json
{"comprimentoKm": 10, "minutosPorSentido": 20, "paragens": 12,
 "horasHoje": 6.7, "kmHoje": 162, "kmPlaneado": 385, "viagensHoje": 16, "viagensPlaneadas": 38,
 "porHora": [{"hora": "05h", "km": 25, "kmAcumulado": 25, "viagens": 2}, "… (16 items)"],
 "passagens": [{"nome": "Rua do Cajueiro (Fedel Castro)", "km": 0, "ida": "2026-10-17T10:25:08.258Z", "volta": "2026-10-17T10:20:08.258Z"}, "… (12 items)"],
 "ida": "Estrada Circular", "volta": "Rua do Cajueiro (Fedel Castro)"}
```

`passagens` are the next passes at each stop towards each terminal (`ida` towards the route's last terminal, `volta` back).

#### `GET|POST|DELETE /api/transportes/{id}/gps`

| Method | Answer |
|---|---|
| `GET` | `{"configurado": true, "ultimaPosicaoEm": "2026-10-17T09:43:53.000Z", "ativo": true, "velocidadeKmh": 22.2, "servidor": "https://transport-mz.vercel.app/api/gps"}` |
| `POST` | a new device code, shown once: `{"codigo": "<20 characters>", "servidor": "…"}` |
| `DELETE` | revokes the code and clears the GPS fields: `{"ok": true}` |

#### Assigning people to a vehicle

| Endpoint | Body |
|---|---|
| `POST /api/transportes/{id}/atribuir-motorista` | `{"motoristaId"}` |
| `DELETE /api/transportes/{id}/atribuir-motorista` | removes the driver |
| `POST /api/transportes/{id}/atribuir-proprietario` | `{"proprietarioId"}` (adds an owner) |
| `DELETE /api/transportes/{id}/atribuir-proprietario`, `POST`/`DELETE /api/transportes/{id}/proprietario` | remove or set the owner link |

### Drivers

#### `GET|POST|DELETE /api/motoristas/{id}/pin`

| Method | Answer |
|---|---|
| `GET` | `{"definido": true}` |
| `POST` | a new 6-digit PIN, shown once: `{"pin": "123456"}`. Stores its bcrypt hash; the previous PIN stops working. |
| `DELETE` | removes the PIN (the driver can no longer sign in): `{"definido": false}` |

#### `GET|POST|DELETE /api/motoristas/atribuir`

`GET` lists vehicles without a driver and active drivers without a vehicle; `POST {"motoristaId", "transporteId"}` pairs them; `DELETE` undoes a pairing.

### Statistics

| Endpoint | Content |
|---|---|
| `GET /api/dashboard/stats` | Everything the dashboard shows: counters, vehicles per municipality, every route with its path and vehicle count, routes and stops per municipality. Cached 5 minutes per instance. |
| `GET /api/relatorios/stats` | The "Estatísticas Gerais" report: `{"totalTransportes": 111, "totalVias": 91, "totalParagens": 1079, "totalProprietarios": 11, "totalMotoristas": 111, "totalProvincias": 11, "totalMunicipios": 2, "totalUtentes": 8, "transportComMotorista": 111, "transportSemMotorista": 0, "motoristasAtivos": 111, "utentesSubscritos": 6}` |

---

[← Africa's Talking](africas-talking.md) · [Documentation index](README.md) · Next: [Deployment →](deployment.md)
