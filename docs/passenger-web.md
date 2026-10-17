# Passenger web app

**Live:** https://transport-mz.vercel.app · **Code:** `transport-client/app` · **Runs locally on:** http://localhost:3000

It works like a ride-hailing app (Uber, Bolt, Yango), but for public transport. The start is your position, or a place you pick. The app lists every place you can get to from there, by the time you would arrive, and says which stop to walk to for the first bus. Pick a destination C and the journey is laid out as **A → B → C**:

- **A** is where you are;
- **B** is the stop where you take the first bus;
- **C** is where you get off, with the changes of bus in between when one bus is not enough.

You can follow your bus until it arrives, and save a stop to get an SMS when a bus is close. Browsing and planning need no account; saving alerts and the account page need one. Every screen below is followed by the requests it makes. The full request and response formats are in the [API reference](api-reference.md#passenger-app-transport-client).

**On this page:** [How to use it](#how-to-use-it-step-by-step) · [The map](#the-map--and-search) · [Partida and destinations](#partida-and-destinations) · [Stops near you](#stops-near-you) · [A stop's destinations](#a-stops-destinations) · [Journeys](#journeys) · [Tracking a bus](#tracking-a-bus-trackid) · [Account and sign-in](#account-and-sign-in) · [Account page and alerts](#account-page-and-alerts-user-info) · [Browser storage](#what-the-browser-stores)

---

## How to use it, step by step

These screenshots were taken by driving the app in a browser (Playwright) against a copy of the database at 07:40 on a weekday. The position was set a few steps from the Portão stop.

**1. Open the app.** It asks for your location. The panel then shows:

- **Partida**: "A sua localização";
- **Para onde ir**: every place you can reach, earliest arrival first.

Each row says where to take the first bus ("Apanhe em Portão · 70 m a pé"), "Directo" or how many buses it takes, the routes, the arrival time and the minutes from now.

![Step 1: the start is your position, and every destination with the stop where the first bus is taken](images/passenger-home.png)

**2. Pick a destination**, from the list or by typing in "Para onde quer ir?". Results show how far each place is from the start.

![Step 2: typing a destination](images/passenger-search.png)

**3. See the journey: A → B → C.** It shows the walk to the stop (A → B), the bus with its plate, when it comes, and where and when to get off (B → C). The map draws the walk dashed and the bus in its route's colour. The other options are below, earliest arrival first.

![Step 3: walk 70 m to Portão, take bus ACF-004M at 07:51, get off at Makalela at 07:55](images/passenger-journey-direct.png)

**4. Follow the bus.** "Acompanhar este autocarro →" opens the tracking page: the wait, the distance to the bus, the arrival, the fare and the route map. These refresh every 10 seconds.

![Step 4: tracking the bus](images/passenger-track.png)

**5. Destinations that take more than one bus** are in the same list ("2 autocarros", with each route's code). "Ver mais destinos" shows more.

![Step 5: a destination two buses away, further down the list](images/passenger-destinations-several.png)

Opening one shows each bus in turn. You walk to the first stop, ride to the change, wait for the next bus there, and ride on. All times are worked out for the moment you reach each stop.

![A journey with one change: two buses, each with its plate and times](images/passenger-journey-transfer.png)

**6. Start somewhere else.** Tap **Partida** and type a stop or place. The list of destinations is then worked out from there, and each row says where to take the first bus. That is the start itself, or a stop a short walk away.

![Step 6: choosing another start](images/passenger-start.png)

![Every destination from Igreja; for Agostinho Neto the first bus is taken at Makalela, 240 m away](images/passenger-start-chosen.png)

![The journey from Igreja: walk 240 m to Makalela, then the bus to Agostinho Neto](images/passenger-journey-from-start.png)

"A sua localização" (under the Partida field) brings the start back to your position.

**7. The stops near you.** The "Paragens perto" tab lists them. Tapping one shows everything that stop reaches, and its routes ([A stop's destinations](#a-stops-destinations)).

![Step 7: the stops near you](images/passenger-nearby.png)

On a phone, the panel is a bottom sheet over the map:

<img src="images/passenger-home-mobile.png" alt="The app on a phone: Partida, destination and every destination with where to take the first bus" width="320"> <img src="images/passenger-journey-mobile.png" alt="A journey on a phone: walk to Portão, then the bus" width="320">

## The map (`/` and `/search`)

![Home page: the passenger's position, the stops near it and the live buses](images/passenger-home.png)

`/` and `/search` are the same page (`app/components/TripPlanner.tsx`); `/search` is where sign-in and registration lead. The title card shows the number of buses and "Entrar", or the passenger's avatar when signed in.

- **Buses.** Every bus with its position now: a real GPS position when fresh, otherwise the timetable position ([GPS tracking](gps-tracking.md#how-a-position-is-chosen)). Markers glide to their new position every 5 seconds. Tapping a bus draws its route and opens a card with "Acompanhar →".
- **Your position.** The browser asks for the location when the page opens. With it, the map centres on you once, and a blue pin follows you: it shows your initials when you are signed in, a person icon otherwise. The round button at the bottom right centres the map on you again, or asks again after a refusal. Positions more than 80 km from Maputo are not used to centre the map.
- **Stops.** Every stop is on the map at every zoom, and tapping one opens it:
  - the stops near you are green dots;
  - stops where buses pass are white dots;
  - stops no bus serves now (none of their routes has a vehicle) are grey. Their page says so, and they are not offered in the search or the nearby list.
- **The panel** is a card on the left on a computer, with the title (bus count, "Entrar" or the avatar) at its top. On a phone it is a bottom sheet, and the bar at its top folds it away.

| When | Request |
|---|---|
| Page opens | `GET /api/stops` (every stop served by a bus, with its routes, and the stops no bus serves now; cached 5 min) |
| Page opens | `GET /api/buses` (all buses with positions) |
| Every 5 s | `GET /api/buses?fields=position` (light: id, latitude, longitude, source, heading; also triggers the arrival SMS check) |

## Partida and destinations

The top of the panel has two fields:

- **Partida** is where the journey starts. It is "A sua localização" when the position is known. Tapping it lets you type a stop or place instead; the list says how far each result is. "A sua localização" puts your position back, and "Cancelar" keeps the current start. The start you pick is marked on the map, and the map moves to it.
- **"Para onde quer ir?"** searches every stop by name, without accents or capitals. Every typed word must start a word of the name: "av ind" finds "Av. das Indústrias". Stops with the same name within 400 m count as one place. Each result shows how far it is from the start, and the route name when two places share a name.

Below them, the **"Para onde ir"** tab lists every place reachable from the start, with up to 4 buses, earliest arrival first. Each row has:

- **where to take the first bus**: "Apanhe em Portão · 70 m a pé". From your position, this is the stop within 800 m that gets you there soonest, counting the walk. When the same bus passes a closer stop at most 2 minutes later, the closer stop is chosen. From a picked place, it is that place or a stop within 300 m.
- "Directo", or how many buses it takes ("2 autocarros");
- the codes of the routes, in their colours;
- the arrival ("Chega 07:54", "Chega amanhã 05:37") and the time from now.

The first 25 are shown, and "Ver mais destinos" adds 50 at a time. Places within a short walk of the start are left out.

Choosing a destination, from the list or the search, plans the journey from the start. Without a position and without a picked start, the list of destinations is not shown. The search then plans from the stop nearest the centre of the map.

| When | Request |
|---|---|
| Position known, or a start picked | `GET /api/destinos?lat=…&lng=…` (asked again after about 100 m) or `GET /api/destinos?from={stopIds}` |

## Stops near you

![The stops near you](images/passenger-nearby.png)

**"Onde vai apanhar o autocarro?"**: the stops where you can catch a bus. The panel lists up to 8 stops within 1.5 km, nearest first, with the distance, the walking time (4.5 km/h, a quarter added for streets) and the number of routes. With no stop that close, it lists the 3 nearest under "Paragens mais próximas", with a line saying none is within 1.5 km and without walking times. With a picked start, the list is about that start ("Paragens perto da partida"). Without a position (refused, unavailable, or far from Maputo), the list is about the centre of the map and follows it as you move the map, with a line saying why. This list is the second tab, "Paragens perto", when a start is known.

## A stop's destinations

![A stop: every destination it reaches, earliest arrival first](images/passenger-stop.png)

Tapping a stop (in the list or on the map) shows:

- its name, number of routes and, with a position, how far it is from you; "Apanhe o autocarro aqui" reminds you this is where you board;
- the Partida (this stop) and the destination search, where each result says **"Directo"** (a bus from this stop goes there) or **"Com transbordo"** (it needs a change). Changing the Partida here makes the new start the panel's start;
- **"Todos os destinos"** (the first tab): every place you can reach from this stop, with up to 4 buses, in the order you would get there.
  - Each row has the arrival ("Chega 10:17", "Chega amanhã 05:37") and the time from now.
  - It shows "Directo", or how many buses it takes ("3 autocarros"), and the codes of those routes in their colours.
  - The first 25 are shown; "Ver mais destinos" adds 50 at a time.

  Tapping a row opens that journey: the arrival is the same as on the row, or earlier.
- **"Por rota"** (the second tab): every route through the stop, under a header in the route's colour. For each direction ("Sentido Antena"):
  - the next bus's arrival ("Próximo autocarro 27 min", "às 17:58", "amanhã às 05:12");
  - its plate, drawn like a number plate on the right, so it is easy to match with the bus in the street;
  - the stops it goes to, in order, as a line in the route's colour; each has an "Ir" button.

  Consecutive stops with the same name are shown once; "Ver as N paragens" shows them all.

Tapping one of those stops, or a search result, plans the journey from this stop.

| When | Request |
|---|---|
| Stop opened | `GET /api/stops/{id}` |

## Journeys

![A direct journey: three options, the chosen one drawn on the map](images/passenger-journey-direct.png)

The top of the panel shows the Partida and the destination. Up to three options follow, earliest arrival first. When another option takes the same number of buses, needs less walking, and arrives at most 2 minutes later, it comes first. It is usually the same bus, caught at a closer stop, and it is the one the list of destinations showed. Each card shows the arrival ("Chega às 16:51", or "Chega amanhã às 06:32"), the total fare, "Directo" or the number of changes ("2 transbordos"), the total time from now and the walking distance, and the routes as coloured labels. The chosen option is drawn on the map: each bus in its route's colour, walks dashed, and only the buses of that journey stay on the map.

![A journey with one change, from the passenger's position](images/passenger-journey-transfer.png)

The chosen option lists its steps:

- **Walks**: "Caminhe 100 m (2 min) até Portão", from your position to the first stop, between two stops to change buses (up to 400 m), or from the last stop.
- **Buses**: the route and its direction, with the bus's plate as a number-plate badge on the right; where and when to take it ("Apanhe em Portão às 16:47 (daqui a 5 min)", and for the next buses the wait at the stop: "espera 35 min"); where and when to get off; the number of stops, time on board, distance and fare. "Acompanhar este autocarro →" opens the tracking page with that bus's two stops.
- When the journey only finishes the next morning (buses run 05:00–21:00), a note says so.

Each bus charges its own fare, with the fare rule (max(10 MT, ⌈km × 10 MT⌉) by default, [Configuration](configuration.md#fare-rule-tarifa)). Times use the same model as everywhere else: real GPS when fresh, else the timetable, worked out for the moment you reach each stop. How the options are found is in [Data flow → Journey planning](data-flow.md#journey-planning). When the two places are not connected by any chain of buses (a few routes form separate groups), the panel says "Não há ligação de autocarro entre estes dois locais".

| When | Request |
|---|---|
| From a stop or a picked start | `GET /api/journeys?from={stopIds}&to={stopIds}` |
| From your position | `GET /api/journeys?lat=…&lng=…&to={stopIds}` |

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
