# Passenger web app

**Live:** https://transport-mz.vercel.app · **Code:** `transport-client/app` · **Runs locally on:** http://localhost:3000

Passengers see every bus on a live map with their own position and the stops around them. Tapping a stop shows where its buses go; choosing or typing a destination shows how to get there, with changes of bus when no single bus goes there. They can follow one bus until it arrives, and save stops to get an SMS when a bus is close. Browsing and planning need no account. Saving alerts and the account page need one. Every screen below is followed by the requests it makes; the full request and response formats are in the [API reference](api-reference.md#passenger-app-transport-client).

**On this page:** [The map](#the-map--and-search) · [Stops near you](#stops-near-you) · [A stop's destinations](#a-stops-destinations) · [Journeys](#journeys) · [Tracking a bus](#tracking-a-bus-trackid) · [Account and sign-in](#account-and-sign-in) · [Account page and alerts](#account-page-and-alerts-user-info) · [Browser storage](#what-the-browser-stores)

---

## The map (`/` and `/search`)

![Home page: the passenger's position, the stops near it and the live buses](images/passenger-home.png)

`/` and `/search` are the same page (`app/components/TripPlanner.tsx`); `/search` is where sign-in and registration lead. The title card shows the number of buses and "Entrar", or the passenger's avatar when signed in.

- **Buses.** Every bus with its position now: a real GPS position when fresh, otherwise the timetable position ([GPS tracking](gps-tracking.md#how-a-position-is-chosen)). Markers glide to their new position every 5 seconds. Tapping a bus draws its route and opens a card with "Acompanhar →".
- **Your position.** The browser asks for the location when the page opens. With it, the map centres on you once, and the blue dot moves as you move. The round button at the bottom right centres the map on you again, or asks again after a refusal. Positions more than 80 km from Maputo are not used to centre the map.
- **Stops.** The stops near you are green dots. Every other stop appears as a small white dot from zoom 13; tapping any stop opens its destinations.
- **The panel** is a side panel on a computer and a bottom sheet on a phone (the bar at its top folds it away).

| When | Request |
|---|---|
| Page opens | `GET /api/stops` (every stop served by a bus, with its routes; cached 5 min) |
| Page opens | `GET /api/buses` (all buses with positions) |
| Every 5 s | `GET /api/buses?fields=position` (light: id, latitude, longitude, source, heading; also triggers the arrival SMS check) |

On a phone:

<img src="images/passenger-home-mobile.png" alt="The map on a phone, with the stops near the passenger in a bottom sheet" width="320">

## Stops near you

The panel lists up to 8 stops within 1.5 km, nearest first, with the distance, the walking time (4.5 km/h, a quarter added for streets) and the number of routes. With no stop that close, it lists the 3 nearest. Without a position (refused, unavailable, or far from Maputo), the list is about the centre of the map and follows it as you move the map, with a line saying why.

**"Para onde quer ir?"** on top searches every stop by name, without accents or capitals, and every typed word must start a word of the name ("av ind" finds "Av. das Indústrias"). Stops with the same name within 400 m count as one place. Choosing a result plans the journey **from your position**: a walk to one of the stops within 800 m, then the buses. Without a position, from the nearest stop to the centre of the map.

## A stop's destinations

![A stop: its routes, each direction's next bus and the stops it goes to](images/passenger-stop.png)

Tapping a stop (in the list or on the map) shows:

- its name, number of routes and, with a position, how far it is from you;
- the same destination search, where each result says **"Directo"** (a bus from this stop goes there) or **"Com transbordo"** (it needs a change);
- every route through the stop, and for each direction ("Sentido Antena"): the next bus with its plate and arrival ("próximo autocarro 27 min", "às 17:58", "amanhã às 05:12"), and the stops it goes to in order. Consecutive stops with the same name are shown once; "Ver as N paragens" shows them all.

Tapping one of those stops, or a search result, plans the journey from this stop.

| When | Request |
|---|---|
| Stop opened | `GET /api/stops/{id}` |

## Journeys

![A direct journey: three options, the chosen one drawn on the map](images/passenger-journey-direct.png)

Up to three options, earliest arrival first. Each card shows the arrival ("Chega às 16:51", or "Chega amanhã às 06:32"), the total fare, "Directo" or the number of changes ("2 transbordos"), the total time from now and the walking distance, and the routes as coloured labels. The chosen option is drawn on the map: each bus in its route's colour, walks dashed, and only the buses of that journey stay on the map.

![A journey with two changes, from the passenger's position](images/passenger-journey-transfer.png)

The chosen option lists its steps:

- **Walks**: "Caminhe 100 m (2 min) até Portão", from your position to the first stop, between two stops to change buses (up to 400 m), or from the last stop.
- **Buses**: the route, its direction and the bus's plate; where and when to take it ("Apanhe em Portão às 16:47 (daqui a 5 min)", and for the next buses the wait at the stop: "espera 35 min"); where and when to get off; the number of stops, time on board, distance and fare. "Acompanhar este autocarro →" opens the tracking page with that bus's two stops.
- When the journey only finishes the next morning (buses run 05:00–21:00), a note says so.

Each bus charges its own fare, with the fare rule (max(10 MT, ⌈km × 10 MT⌉) by default, [Configuration](configuration.md#fare-rule-tarifa)). Times use the same model as everywhere else: real GPS when fresh, else the timetable, worked out for the moment you reach each stop. How the options are found is in [Data flow → Journey planning](data-flow.md#journey-planning). When the two places are not connected by any chain of buses (a few routes form separate groups), the panel says "Não há ligação de autocarro entre estes dois locais".

| When | Request |
|---|---|
| From a stop | `GET /api/journeys?from={stopId}&to={stopIds}` |
| From your position | `GET /api/journeys?lat=…&lng=…&to={stopIds}` |

On a phone:

<img src="images/passenger-journey-mobile.png" alt="A journey with changes on a phone" width="320">

## Tracking a bus (`/track/[id]`)

![Tracking page: arrival time, distances, price and the route map](images/passenger-track.png)

- **Status banner.** For example "Chegando — O transporte está próximo da sua paragem", or "Transporte já passou" when the bus passed your stop and comes back on its next lap.
- **Six figures:**
  - **Tempo de chegada** and **Distância autocarro**: the wait, and how far the bus still drives to reach you;
  - **Chegada ao destino**: the expected clock time at your destination;
  - **Preço**;
  - **Tempo de viagem** and **Distância viagem**: minutes and distance on board.
- **Rota completa.** The route's road path. The bus marker glides along it; your origin and destination are highlighted. The full-screen button enlarges the map.
- **"Adicionar aos Meus Transportes"** saves an arrival alert for your origin stop. You get an SMS when a bus on a route through that stop is less than 1 km away ([Data flow → Arrival alert](data-flow.md#arrival-alert-and-sms)). Without a session the button answers "Você precisa estar logado para salvar transportes". An expired session clears the stored account so you can sign in again.
- **"Parar Rastreamento"** goes back to the map (`/search`). The footer shows the refresh period and the time of the last update.

| When | Request |
|---|---|
| Every 10 s | `GET /api/bus/{id}?paragem=ORIGIN&destino=DEST` |
| Signed in, on open | `GET /api/user/missions` (Bearer) to show whether the stop is already saved |
| "Adicionar aos Meus Transportes" | `POST /api/user/missions/save` (Bearer) `{"transporteId", "paragemId"}` |

On a phone:

<img src="images/passenger-track-mobile.png" alt="Tracking page on a phone" width="320">

## Account and sign-in

![Sign-in page](images/passenger-auth.png)

`/auth` signs in with **phone number and password**, or registers with name, email, phone and password ("Registe-se").

- The phone can be typed with or without `+258`. Accounts created by USSD are stored with the prefix and are still found.
- Someone who has only used USSD already has a passwordless account (created by option 1). Registering with the same phone **completes that account** and keeps their alerts. Signing in before registering answers "Este número ainda não tem senha. Faça o registo para criar uma."
- The password needs at least 6 characters and is stored as a bcrypt hash.
- Sign-in and registration return a **session token** (HMAC-signed, valid 90 days). Every `/api/user/*` request sends it as `Authorization: Bearer <token>` and can only read or change that passenger's own data ([Security](security.md#passengers)).

| Action | Request |
|---|---|
| "Entrar" | `POST /api/auth/login` `{"telefone", "senha"}` |
| "Registar" | `POST /api/auth/register` `{"nome", "email", "telefone", "senha"}` |

## Account page and alerts (`/user-info`)

![Account page: saved alerts](images/passenger-alerts.png)

Three tabs, each reachable directly with `?tab=`:

| Tab | `?tab=` | What it does | Requests |
|---|---|---|---|
| **Perfil** | `perfil` | Shows the profile; the name can be changed | `GET /api/user/{id}`, `PUT /api/user/{id}` `{"nome"}` |
| **Missões** | `missoes` | Saved stops (arrival alerts). "Ver Detalhes" opens the tracking page of the first bus that serves that stop; "Remover" deletes the alert. | `GET /api/user/missions`, `DELETE /api/user/missions/{id}`, `GET /api/buses` |
| **Segurança** | `seguranca` | Changes the password (the current one is required) | `POST /api/user/{id}/change-password` |

![Account page: profile](images/passenger-profile.png)

`/my-transports` is an old address. It redirects (HTTP 307) to `/user-info?tab=missoes`.

## What the browser stores

| `localStorage` key | Content | Set by |
|---|---|---|
| `utente` | The passenger's profile (id, name, email, phone, subscription) plus the session `token` | sign-in and registration; refreshed by the account page |

Signing out (avatar menu) clears it. A token that is expired or signed with a rotated secret makes `/api/user/*` answer 401. The account and tracking pages then clear the stored account, and the passenger signs in again.

---

[← Configuration](configuration.md) · [Documentation index](README.md) · Next: [USSD service →](ussd.md)
