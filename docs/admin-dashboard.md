# Admin dashboard

**Live:** https://transport-mz-admin.vercel.app · **Code:** `transport-admin/app` · **Runs locally on:** http://localhost:3002

The back office. Administrators manage the network (provinces, municipalities, routes and stops), the fleet (vehicles, drivers, owners), passengers and other administrators. They also follow each vehicle live, set up GPS trackers, give drivers their PINs and print reports. The admin has its own API (`transport-admin/app/api`) on the same database as the passenger app. It never calls the passenger app ([Architecture](architecture.md#how-the-parts-connect)).

The interface is in Portuguese. Screenshots on this page were taken on a local copy of the production data, with phone and ID numbers blurred.

**On this page:** [Sign-in](#sign-in-and-session) · [Layout and search](#layout-and-search) · [Dashboard](#dashboard-dashboard) · [Vehicles](#vehicles-transportes) · [Routes](#routes-vias) · [Stops](#stops-paragens) · [Drivers](#drivers-motoristas) · [Owners](#owners-proprietarios) · [Provinces and municipalities](#provinces-and-municipalities) · [Passengers](#passengers-utentes) · [Administrators](#administrators-and-profile) · [Reports](#reports-relatorios) · [API used by each page](#api-used-by-each-page)

---

## Sign-in and session

<img src="images/admin-login.png" alt="Admin sign-in page: email, password, Entrar" width="560">

`/login` asks for email and password. `POST /api/auth/admin/login` checks the bcrypt hash in `Administrador.senha` and sets the `admin_session` cookie: `HttpOnly`, valid 12 hours, signed with `ADMIN_SESSION_SECRET`.

- `proxy.ts` answers **401** to every `/api/*` request without a valid cookie, except sign-in and sign-out. The browser app treats any 401 from the admin API as an expired session: it signs out and opens `/login`.
- Without `ADMIN_SESSION_SECRET` in production, sign-in answers 500 "Servidor sem configuração de sessão" and no session is accepted ([Configuration](configuration.md#transport-admin-back-office)).
- `localStorage['admin']` only keeps the profile shown in the header. It grants nothing.

**The first administrator** is created from a terminal, in `transport-admin`:

```bash
node create-admin.js   # asks for name, email and password (at least 10 characters, not echoed)
```

It writes to the database named by `DATABASE_URL` (environment or `.env`). Run it again with an existing email to set a new password. After that, administrators are managed in the app ([below](#administrators-and-profile)). All administrators have the same rights.

## Layout and search

The sidebar groups the sections:

| Group | Sections |
|---|---|
| Rede | Dashboard, Transportes, Vias, Paragens |
| Pessoas | Proprietários, Motoristas, Utentes, Administradores |
| Território | Províncias, Municípios |
| Análise | Relatórios |

On a computer the sidebar stays on the left; the arrow at its edge folds it down to icons. On a phone or a narrow window it is hidden: the button at the top left ("Abrir o menu") slides it in over the page, and choosing a section, tapping outside it or Esc closes it. The avatar menu at the top right has "Meu Perfil" and "Sair".

<img src="images/admin-dashboard-mobile.png" alt="Dashboard on a phone" width="300"> <img src="images/admin-menu-mobile.png" alt="The menu open on a phone" width="300">

The list tables show fewer columns on narrower screens, so that they fit without scrolling sideways; the detail page of each row has everything. On a phone the vehicle list becomes cards.

**The search box in the header** finds vehicles, routes and drivers from any page. Type at least 2 characters; 300 ms after the last keystroke it shows up to 5 matches of each kind:

| Group | Matches on | Opens |
|---|---|---|
| Transportes | plate, model, make, route name | `/transportes/{id}` |
| Vias | name, code, municipality | `/vias/{id}` |
| Motoristas | name, ID number (BI), licence number, phone | `/motoristas/{id}` |

Case does not matter. Enter opens the first match and Esc closes the list. Phones are matched as stored, with their spaces (`87 183`).

![Header search for "mat": vehicles on Matola routes, then Matola's routes](images/admin-header-search.png)

Every list page also has its own search box and pagination.

## Dashboard (`/dashboard`)

![Dashboard: greeting and shortcuts, counters, route map, what the vehicles are doing now, route list, bars and status](images/admin-dashboard-full.png)

At the top: a greeting with the admin's first name and the shortcuts "+ Transporte", "+ Via", "+ Motorista" (each opens its creation form) and "Actualizar" (reloads the numbers). When some vehicles have no driver, a banner says how many and links to `/motoristas/atribuir`.

Everything except "Agora" comes from one request, `GET /api/dashboard/stats`, **cached 5 minutes** per server instance. A change can take up to 5 minutes to show there, while the list pages show it at once.

| Block | What it counts |
|---|---|
| Transportes / Motoristas / Vias / Paragens | Rows of each table. Under Transportes: how many have no driver ("todos com motorista" when none). Under Motoristas: "activos" = drivers with status `ativo` **and** a vehicle. Under Vias: routes with at least one vehicle. Each card opens its list page. |
| Mapa de vias | Every route's stored road path, in the route's colour, on the OpenFreeMap street map. A route tapped in the "Vias" list is shown alone; tapping it again shows all. |
| Agora | What each vehicle is doing now, from `GET /api/transportes/estado` (GPS, or the timetable without GPS), refreshed every 30 seconds: Em circulação, Parados (at a terminal or out of service), Com GPS activo, Sem rota (no route path to place it on). Not cached. |
| Vias | Every route with its terminals and vehicle count, most vehicles first. |
| Vias por município | Routes per municipality. |
| Paragens por município | Distinct stops on each municipality's routes. A stop served by routes of both municipalities counts in both, and a stop on no route counts in neither. |
| Vias com mais veículos | The 5 routes with the most vehicles. |
| Estado | Transportes com motorista (and "sem"); Motoristas activos as above (and "disponíveis" = active drivers without a vehicle); Vias com veículos (and "sem"). |
| Proprietários, Províncias, Municípios | Rows of each table; each card opens its list page. |

## Vehicles (`/transportes`)

![Vehicle list with the "Agora" column](images/admin-transportes.png)

**List.** One row per vehicle: plate and number, model and make, driver, owner, route, capacity and **"Agora"**, what the vehicle is doing right now (model, owner and capacity only on wider screens):

| "Agora" | Meaning |
|---|---|
| Em circulação | Moving along its route (a fresh GPS fix with speed, or the timetable). |
| No terminal | Stopped at a terminal between two legs. |
| Fora de serviço | Outside service hours (before 05:00 or after 21:00, Maputo time), parked at a terminal. |
| Sem rota | Its route has no path and it has no stored position. |

The column comes from `GET /api/transportes/estado`, refreshed every 30 s. It uses the same position rules as the passenger app ([GPS tracking](gps-tracking.md#how-a-position-is-chosen)). The counters on top (Total, Em Circulação, Parados, GPS ativo) filter the list when clicked.

**Detail (`/transportes/{id}`).**

![Vehicle page with a live GPS position, the tracker card, charts and next passes](images/admin-transporte-gps-live.png)

| Block | Content | Source |
|---|---|---|
| Quilómetros Hoje, Tempo de Operação, Viagens Hoje | Kilometres, hours and terminal arrivals so far today, by the timetable (05:00–21:00 at the fare rule's speed), with the full day's figures underneath. | `GET /api/transportes/{id}/operacao`, every 60 s |
| Rota | Length of the route's path and its number of stops. | same |
| Localização e Rota | 3D map with the route and the vehicle. The badge says where the position comes from: "Em movimento · GPS real", "Parado no terminal · estimado pelo horário", and so on. Underneath: current speed, next stop, minutes to it. | `GET /api/transportes/{id}/posicao`, every 15 s |
| Rastreador GPS | The vehicle's GPS device ([below](#gps-tracker-card)). | `GET /api/transportes/{id}/gps`, every 30 s |
| Pessoas Associadas | The driver (× removes them from the vehicle) and the owners ("+ Atribuir"). | |
| Informações do Transporte | Plate, number, model, make, colour, capacity, route, status, registration date. | |
| Quilómetros ao Longo do Dia, Viagens por Hora | Cumulative kilometres and terminal arrivals per hour, by the timetable. | `operacao` |
| Próximas Passagens nas Paragens | For each stop in travel order: its distance from the start of the path, and the next time the vehicle passes it in each direction, by the timetable. With live GPS the vehicle can be early or late. | `operacao` |

<a id="gps-tracker-card"></a>**GPS tracker card.**

<img src="images/admin-gps-device-code.png" alt="Rastreador GPS card right after a device code was generated, with the Traccar Client settings" width="640">

| Badge | Meaning |
|---|---|
| Não configurado | No device code yet. The vehicle uses its timetable position. |
| Sem sinal recente | A code exists, but no position arrived in the last 3 minutes. |
| GPS ativo | A position arrived in the last 3 minutes. Passengers see it instead of the timetable. |

- **"Gerar código do dispositivo"** / **"Gerar novo código"** creates a 20-character code (`POST /api/transportes/{id}/gps`). It is shown **once** ("só é mostrado agora; guarde-o"), with the settings for the Traccar Client app. Only its SHA-256 is stored. A new code stops the old one at once.
- **"Revogar dispositivo"** (with confirmation) deletes the code and the stored GPS fields (`DELETE`). The vehicle goes back to its timetable position.

How to set up the phone or tracker is in [GPS tracking](gps-tracking.md#1-create-the-device-code).

**New and edit (`/transportes/novo`, `/transportes/{id}/editar`).** Plate, model, make, colour, year, capacity, status and route are required. Chassis and engine numbers, fuel type, tank size, total kilometres, next service and inspection dates, and a starting position are optional. A plate can only be used once.

## Routes (`/vias`)

![Route list with totals](images/admin-vias.png)

**List.** Code, name, municipality, terminals, colour, number of stops and vehicles. The counters on top are totals over every route matching the search: routes, stops (all stops in the system), vehicles on routes, and the average number of stops per route. The search matches name, code or municipality, ignoring case.

**Detail (`/vias/{id}`).**

![Route page: length, stops in travel order, map and vehicles](images/admin-via-detail.png)

- **Comprimento:** length of the stored road path.
- **Tempo Médio:** time for one direction at the fare rule's travel speed ("por sentido, a 30 km/h").
- **Paragens:** every stop in **travel order** (projected onto the path, since `ViaParagem` has no order column), terminals marked.
- **Mapa da Rota:** the stored path and the stops.
- **Transportes Atribuídos:** the vehicles on the route, with their driver.

**Drawing a route (`/vias/novo`).**

![New route: drawing the path on the map](images/admin-via-novo.png)

1. Fill in name, code and municipality. The terminals can stay empty: the first and last stop of the path are used.
2. Click the map, or a stop, to add a point. Drag a point to move it; click it to remove it. "Desfazer", "Refazer" and "Limpar Rota" work on the points.
3. After each change, the points are sent to the public OSRM router (`router.project-osrm.org`), which returns the road path through them. "Percurso pelas estradas" shows its length. If OSRM fails, the line is drawn dashed between the points and "Criar Via" refuses to save ("Não foi possível calcular o percurso pelas estradas…"); move or add a point to try again.
4. Stops within **50 m** of the road path are listed under "Paragens da Rota", in travel order, and are linked to the route when it is created. Untick any you do not want.
5. "Criar Via" stores the road path in `Via.geoLocationPath` as `lng,lat;lng,lat;…` ([Database → Conventions](database.md#conventions-read-this-before-querying)).

**Editing a route (`/vias/{id}/editar`)** changes its name, terminals, colour, municipality and linked stops, and **"Atribuir Transporte"** moves vehicles onto the route (`PATCH /api/transportes/{id}` with the route's id). The path has its own page:

**Redrawing a route's path (`/vias/{id}/percurso`)**, from **"Redesenhar percurso"** on the route's page. Use it when a route's line cuts across blocks instead of following the streets ([Database → Putting route paths on the roads](database.md#putting-route-paths-on-the-roads) lists them).

![Redrawing a route's path: the current path dashed in grey, the new road path in the route's colour](images/admin-via-percurso.png)

1. The current path is drawn dashed in grey, and the stops linked to the route are highlighted.
2. **"Começar pelo percurso atual"** puts up to 25 points along the current path (at its turns) and asks the router for the road through them. Or click the map or a stop to add points, as when drawing a new route. Drag, add or remove points where the road path leaves the bus's way.
3. Only a road path can be saved, as on "Nova Via": while the router has not answered, or when it failed (dashed line), "Guardar percurso" is disabled.
4. **"Paragens no novo percurso"** lists the stops within 50 m of the new path, in travel order, marked "ligada" (already linked) or "nova". **"Paragens ligadas fora do novo percurso"** lists the linked stops the new path no longer passes. Every ticked stop is linked to the route; untick the ones it does not serve.
5. "Guardar percurso" stores the path and the ticked stops (`PATCH /api/vias/{id}` with `geoLocationPath` and `paragensIds`). The links that stay are kept as they were. The timetable positions, arrival times and fares use the new path at once ([GPS tracking](gps-tracking.md#how-a-position-is-chosen)).

On a phone the map comes first, above the stop lists.

## Stops (`/paragens`)

**List.** Name, code, coordinates and routes; the search matches name or code, ignoring case. The counters show totals, terminals, regular stops and the average number of routes per stop.

![Stop list: totals, terminals, regular stops, and each stop with its routes, type and coordinates](images/admin-paragens.png)

**Detail (`/paragens/{id}`).**

![Stop page: coordinates, map and the routes through it](images/admin-paragem-detail.png)

Type (stop or terminal), number of routes, code, coordinates on an OpenStreetMap map, and the routes through the stop.

**New and edit.** Name, code, and a click on the map for the position (the latitude and longitude fields are read-only). The routes passing within **100 m** of the click are offered; tick the ones the stop belongs to. A click with no route within 100 m answers "Nenhuma via encontrada (raio de 100m)" with the nearest one. **"Esta paragem é um terminal"** is stored on each route link (`ViaParagem.terminalBoolean`), not on the stop.

**Deleting** a stop also removes its route links and any passenger arrival alerts at it, which could never fire again.

## Drivers (`/motoristas`)

![Driver list](images/admin-motoristas.png)

**List.** Name and address, ID and licence numbers, phone and email, vehicle, owner company and status, with counters (Total, Ativos, Inativos, Com Transporte) and a status filter.

**"Atribuir Motoristas"** (`/motoristas/atribuir`, from the list's header) pairs the active drivers who have no vehicle with the vehicles that have no driver. A driver can also be assigned on the vehicle's page or in the driver's form. A vehicle has at most one driver.

**Detail (`/motoristas/{id}`).**

![Driver page with the PIN card](images/admin-motorista-detail.png)

Personal data, ID and licence documents, contacts and emergency contact, experience, notes, the assigned vehicle and the **"PIN de Acesso"** card.

**PIN.** Drivers sign in to the [driver portal](driver-portal.md) and to USSD option 6 with a 6-digit PIN that only the administrator can create:

<img src="images/admin-driver-pin.png" alt="PIN de Acesso card right after a new PIN was generated" width="280">

| State | Meaning |
|---|---|
| "Sem PIN: não pode entrar" | No PIN: the driver cannot sign in anywhere. |
| "PIN definido" | A PIN exists. It cannot be shown again. |

"Gerar PIN" / "Gerar novo PIN" (`POST /api/motoristas/{id}/pin`) draws a random 6-digit PIN, stores its bcrypt hash in `Motorista.password` and shows the PIN once ("Novo PIN (só é mostrado agora)"). The previous PIN stops working at once, which is also how a forgotten PIN is reset. No API ever returns the hash: the admin's Prisma client omits `Motorista.password` from every query.

**New and edit.** Every personal and document field is required except disability and notes. There is no password field: after creating the driver, open their page and press "Gerar PIN". ID number, licence number and email must be unique.

## Owners (`/proprietarios`)

![Owner list](images/admin-proprietarios.png)

Companies or people who own vehicles. The detail page lists their vehicles; "Associar Transportes" links more (`POST /api/transportes/{id}/atribuir-proprietario`), and a vehicle can have several owners.

**Deleting an owner who still has vehicles** first answers "Não é Possível Eliminar … tem N transportes associados". **"Remover Associações e Eliminar"** then deletes the owner and their links to the vehicles (`DELETE /api/proprietarios/{id}?force=true`). The vehicles themselves stay.

The form's "Upload do Certificado (PDF)" is not stored ([Known limitations](known-limitations.md)). "Data de Início de Operações" is stored in the `birthDate` column.

## Provinces and municipalities

![Municipality list](images/admin-municipios.png)

`/provincias` and `/municipios` list, create, edit and delete them. A municipality belongs to a province; routes belong to a municipality. The forms' map ("Coordenadas do Centro") sets the stored centre point. The "Raio de Cobertura" slider only sizes the circle on the form's map and is not stored.

The municipality list counts its routes and the distinct stops on those routes.

![Province list](images/admin-provincias.png)

## Passengers (`/utentes`)

![Passenger list](images/admin-utentes.png)

**List.** Name and email, phone, `MISSION` code (`Utente.mISSION`, a unique reference), subscription, number of arrival alerts and registration date.

Passengers who have only used USSD appear with a placeholder email (`+258…@temp.com`), a `USSD-…` code, "Não subscrito" and no password. They complete their account by registering on the web with the same phone ([Passenger web app → Account](passenger-web.md#account-and-sign-in)).

**Detail.** Profile, status and the passenger's arrival alerts ("Missões") with their stop.

**New and edit.** The admin can create a passenger with a password (stored as a bcrypt hash) and change their data.

## Administrators and profile

![Administrator list](images/admin-administradores.png)

`/administradores` lists, creates, edits and deletes administrators. A new administrator needs name, email and a password of at least 6 characters, entered twice. Passwords are bcrypt hashes in `Administrador.senha`.

`/perfil` ("Meu Perfil" in the avatar menu) changes your own name and your password (the current one is required; at least 6 characters). The email cannot be changed there.

## Reports (`/relatorios`)

![Reports page](images/admin-relatorios.png)

Nine reports: one per entity (Transportes, Vias, Paragens, Proprietários, Motoristas, Províncias, Municípios, Utentes) plus "Estatísticas Gerais".

1. **"Gerar PDF"** loads the data: up to 5,000 rows from the entity's list API, or `GET /api/relatorios/stats` for the general statistics.
2. A preview opens with the first 8 fields of up to 100 rows (passwords are never shown).
3. **"Imprimir"** opens the browser's print dialog; choose "Save as PDF" to get the file.

The search and category filters on top choose among the report cards; they do not filter the data. "Histórico" and "Agendar" open pages that only say the feature is "em desenvolvimento" ([Known limitations](known-limitations.md)).

## API used by each page

All under `transport-admin/app/api`, all behind the session cookie. Request and response formats are in the [API reference](api-reference.md#admin-app-transport-admin).

| Page | Endpoints |
|---|---|
| Header search | `GET /api/transportes?search=`, `GET /api/vias?search=`, `GET /api/motoristas?search=` |
| Dashboard | `GET /api/dashboard/stats`, `GET /api/transportes/estado` |
| Vehicles | `GET/POST /api/transportes`, `GET/PUT/PATCH/DELETE /api/transportes/{id}`, `GET /api/transportes/estado`, `GET /api/transportes/{id}/posicao`, `GET /api/transportes/{id}/operacao`, `GET/POST/DELETE /api/transportes/{id}/gps`, `POST/DELETE /api/transportes/{id}/atribuir-motorista`, `POST/DELETE /api/transportes/{id}/atribuir-proprietario`, `POST/DELETE /api/transportes/{id}/proprietario` |
| Routes | `GET/POST /api/vias`, `GET/PATCH/DELETE /api/vias/{id}`, `PATCH /api/transportes/{id}`; the public OSRM router from the browser |
| Stops | `GET/POST /api/paragens`, `GET/PATCH/DELETE /api/paragens/{id}` |
| Drivers | `GET/POST /api/motoristas`, `GET/PUT/DELETE /api/motoristas/{id}`, `GET/POST/DELETE /api/motoristas/{id}/pin`, `GET/POST/DELETE /api/motoristas/atribuir` |
| Owners | `GET/POST /api/proprietarios`, `GET/PUT/DELETE /api/proprietarios/{id}` |
| Provinces, municipalities | `GET/POST /api/provincias`, `GET/PATCH/DELETE /api/provincias/{id}`, same for `/api/municipios` |
| Passengers | `GET/POST /api/utentes`, `GET/PUT/DELETE /api/utentes/{id}` |
| Administrators, profile | `GET/POST /api/administradores`, `GET/PATCH/DELETE /api/administradores/{id}`, `POST /api/administradores/{id}/change-password` |
| Reports | the list endpoints above with `?limit=5000`, `GET /api/relatorios/stats` |
| Sign-in | `POST /api/auth/admin/login`, `POST /api/auth/admin/logout`, `GET /api/auth/admin/session` |

---

[← Driver portal](driver-portal.md) · [Documentation index](README.md) · Next: [Africa's Talking →](africas-talking.md)
