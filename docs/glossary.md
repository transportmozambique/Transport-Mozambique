# Glossary

The code, the database and the screens use Portuguese words, and the docs use English ones. This page maps one to the other, and explains the terms that are specific to the project.

**On this page:** [Network and people](#network-and-people) · [Fields that need explaining](#fields-that-need-explaining) · [Words on the screens](#words-on-the-screens) · [Transport in Maputo](#transport-in-maputo) · [Technical terms](#technical-terms)

---

## Network and people

| Portuguese (table) | English | What it is |
|---|---|---|
| Via (`Via`) | route | A bus line: its code (`214`, `C9`, `V034`), name, terminals, colour and path. |
| Paragem (`Paragem`) | stop | A place where buses stop: name, code (`PAR-0001`, `OSM-<id>`) and position. |
| `ViaParagem` | route–stop link | One row per stop a route serves. It has no order: the order comes from the path ([Database → Conventions](database.md#conventions-read-this-before-querying)). |
| Transporte (`Transporte`) | vehicle, bus | One vehicle: plate (`matricula`), make, model, seats, route, GPS fields. |
| Motorista (`Motorista`) | driver | A driver, with the vehicle they drive and their PIN. |
| Proprietário (`Proprietario`) | owner | A vehicle's owner; `TransporteProprietario` links them. |
| Utente (`Utente`) | passenger | A passenger account, made on the web or by USSD option 1. |
| `MISSION` | arrival alert | "Tell me by SMS when a bus is near this stop". The name comes from the first data model. |
| Tarifa (`Tarifa`) | fare rule | Minimum fare, price per km and the speeds the estimates use. One is active. |
| Província, Município, Cidade | province, municipality, city | Where routes belong. `Cidade` is empty. |
| Administrador (`Administrador`) | administrator | A back-office account. |
| `GeoLocation` | (legacy) | Positions from the first data import. Only the legacy Telerivet USSD route reads them; positions now come from `Transporte`. |

## Fields that need explaining

| Field | Meaning |
|---|---|
| `Via.geoLocationPath` | The route's path on the roads, `lng,lat;lng,lat;…`, in one direction; buses go out along it and come back along it. |
| `Via.terminalPartida`, `terminalChegada` | The route's start and end, as names. |
| `codigo`, `codigoVia`, `codigoParagem` | Human-readable codes, repeated next to the real foreign keys. Join on the `…Id` columns. |
| `Transporte.currGeoLocation` | The vehicle's last GPS point, `lat,lng`. |
| `gpsAtualizadoEm` | When that point was received. Under 3 minutes old, it is "live". |
| `gpsDispositivoHash` | The SHA-256 of the vehicle's GPS device code. The code itself is never stored. |
| `Motorista.emViagem`, `viagemIniciadaEm` | The driver is on a trip, since when. |
| `Motorista.status` | The account state (`ativo`, `inativo`, `suspenso`), not the trip. |
| `MISSION.notificadoEm` | When the arrival SMS was sent. |
| `fonte` (API) | Where a bus position comes from: `gps` (a live fix) or `horario` (the timetable model). |

## Words on the screens

| Screen text | Meaning |
|---|---|
| Partida, Destino | start, destination (passenger app) |
| Acompanhar | follow (a bus or a journey on the map) |
| "Avisar-me por SMS…" | ask for an arrival SMS (creates a `MISSION`) |
| Iniciar viagem, Encerrar viagem | start trip, end trip (driver portal, USSD option 6) |
| Rastreador GPS, "Gerar código do dispositivo" | GPS tracker, generate the device code (admin, vehicle page) |
| Nova Via, Redesenhar percurso | new route, redraw the path (admin) |
| Atribuir Transporte | put a vehicle on a route (admin) |
| Encontrar transporte, Procurar rotas, Calcular tarifa, Rastrear autocarro | USSD options 1, 2, 4 and 5: find a journey, routes from a place, fare, find a bus by plate |
| Próximo, Anterior, Voltar | next page, previous page, back (USSD keys 7, 8, 0) |
| MT | meticais, the currency |

## Transport in Maputo

| Term | Meaning |
|---|---|
| chapa | the minibuses (most often a Toyota Hiace) that carry most passengers |
| machimbombo | a bus |
| EMTPM | Maputo's municipal bus company |
| Baixa | Maputo's downtown, where many routes start |
| Chapas, EMTPM, Corujas, REM, RCM | the networks as OpenStreetMap tags them; the import brings all of them ([Database](database.md#importing-stops-and-routes-from-openstreetmap)) |

## Technical terms

| Term | Meaning |
|---|---|
| timetable model | How a bus is placed without GPS: it shuttles along its path from 05:00 to 21:00 at the fare rule's speed ([GPS tracking](gps-tracking.md#how-a-position-is-chosen)). |
| USSD | The `*…#` menus any phone can use without data. `CON` keeps the session open, `END` closes it ([USSD service](ussd.md)). |
| service code, channel | `*384*848080#`: channel `848080` on Africa's Talking's shared code `*384#`. |
| sandbox | Africa's Talking's free test environment: USSD and SMS reach only the simulator ([Africa's Talking](africas-talking.md)). |
| callback key | `USSD_CALLBACK_KEY`, the secret in the callback URL that lets only Africa's Talking drive the menus. |
| GSM-7 | The character set of plain SMS and USSD. One character outside it makes a message Unicode, which halves its length. |
| OSM, relation | OpenStreetMap, and its record of one bus line in one direction (`214i`, `214v`). |
| OSRM, FOSSGIS | The open routing engine, and the public servers that run it, used to put paths on the roads. |
| Neon branch | An instant copy of the database, for trying a change ([Neon guide](neon-guide.md)). |
| pooled, direct host | The two addresses of the Neon database: pooled for the apps, direct for scripts and `psql`. |
| Preview, Production | A branch's deployment on Vercel, and the live one ([Vercel guide](vercel-guide.md)). |
| `waitUntil` | Lets a Vercel function send the SMS after it has answered the phone. |
| device code | The 20-character code a GPS tracker sends with each position ([GPS tracking](gps-tracking.md#connecting-a-device)). |
| PIN | A driver's sign-in code, generated by an administrator ([Driver portal](driver-portal.md)). |

---

[← Architecture](architecture.md) · [Documentation index](README.md) · Next: [Project status →](project-status.md)
