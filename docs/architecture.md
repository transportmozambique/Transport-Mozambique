# 🏗️ Arquitetura do Sistema

Esta página descreve a arquitetura real do **Sistema de Transportes de Moçambique**: as aplicações que o compõem, como comunicam entre si, a stack tecnológica, os fluxos de dados principais, a implantação e os riscos técnicos conhecidos.

> 📄 Existe uma versão alargada deste documento em PDF: **[architecture.pdf](architecture.pdf)** (em inglês, com diagramas, catálogo de APIs e análise de segurança).

---

## 🗺️ Navegação da Documentação
* 🏠 **[Página Principal (Home)](../README.md)**
* 🏁 **[Guia de Início Rápido](getting-started.md)**
* 🏗️ **[Arquitetura do Sistema (Esta Página)](architecture.md)**
* 🗄️ **[Estrutura da Base de Dados](database.md)**

---

## 🧭 Visão Geral

O repositório contém **quatro aplicações Next.js 16 (App Router)** lado a lado — não é um monorepo com *workspaces*; cada aplicação tem o seu próprio `package.json`, `node_modules` e cópia do `schema.prisma`. Todas apontam para **uma única base de dados PostgreSQL** (Neon em produção, Docker em desenvolvimento) através do **Prisma ORM**.

```
             ┌──────────────────── Serviços Externos ────────────────────┐
             │ Africa's Talking (USSD + SMS) · Telerivet (USSD)           │
             │ OSRM (cálculo de rotas) · OpenFreeMap (tiles vetoriais)    │
             └──────┬──────────────────────────────┬──────────────────────┘
                    │ POST /api/ussd*               │ geometria de rotas / tiles
┌───────────────────▼───────────────┐  ┌───────────▼────────────────────────┐
│ transport-client/  (Passageiro)   │  │ app/ na raiz  (Passageiro + hub)   │
│ Implantado no Vercel              │  │ vercel.json na raiz                │
│ USSD mais recente (paginação,     │  │ Simulador OSRM, /api/driver/login, │
│ recibos SMS via waitUntil)        │  │ /api/admin/*, USSD com motorista   │
└───────────────┬───────────────────┘  └──────▲────────────▲───────┬───────┘
                │                             │            │       │
                │          /api/driver/login  │            │ /api/admin/stats
                │                   ┌─────────┴──────┐ ┌───┴───────┴────────┐
                │                   │transport-driver│ │ transport-admin    │
                │                   │ sem API/BD     │ │ API própria + CRUD │
                │                   │ localStorage   │ │ Recharts · Jest    │
                │                   └────────────────┘ └─────────┬──────────┘
                │          Prisma Client                         │ Prisma Client
                └──────────────────────┬─────────────────────────┘
                              ┌────────▼─────────┐
                              │ PostgreSQL 16    │
                              │ Neon (produção)  │
                              │ Docker :5433 (dev)│
                              └──────────────────┘
```

---

## 🧱 Aplicações

| Aplicação | Papel | Rotas API | Páginas | Notas |
|---|---|---|---|---|
| **`transport-client/`** | Portal do passageiro (web) + USSD + API do motorista | 20 | 7 | Aplicação mais ativa. Implantada no Vercel com *Root Directory* = `transport-client`. Usa `@vercel/functions` (`waitUntil`) para enviar SMS após responder ao USSD. Serve `/api/driver/login` e `/api/driver/trip` ao portal do motorista. |
| **`app/` + `lib/` + `prisma/` (raiz)** | Variante paralela do portal do passageiro e *hub* de backend | 25 | 14 | Contém o simulador com OSRM, uma versão antiga de `/api/driver/login` (já não usada pelo portal do motorista), `/api/admin/*` (usado pelos relatórios do admin) e um painel admin legado em `app/admin/*`. |
| **`transport-admin/`** | Back-office | 30 | 47 | CRUD completo de províncias, municípios, vias, paragens, transportes, motoristas, proprietários, utentes e administradores. Dashboard com Recharts. Testes Jest em `__tests__/api`. |
| **`transport-driver/`** | Portal do motorista | 0 | 6 | Não tem API nem acesso à BD. Usa `${NEXT_PUBLIC_API_URL}/api/driver/login` e `/api/driver/trip` do `transport-client`, guarda a sessão em `localStorage` e desenha a rota com OSRM + MapLibre num mapa 3D inclinado (pitch 60°, edifícios extrudidos). |

> ⚠️ `app/` (raiz) e `transport-client/` partilham a maior parte do código mas **divergiram**: cada uma tem rotas que a outra não tem, e `lib/busSimulator.ts` é diferente nas duas. Correções feitas numa não chegam à outra.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Uso no projeto |
|---|---|---|
| Framework | **Next.js 16.2.4** (App Router, Turbopack) | Páginas em `app/**/page.tsx`; backend em *Route Handlers* `app/api/**/route.ts`. |
| UI | **React 19.2**, **TypeScript 5** (`strict`) | Páginas são maioritariamente *Client Components* (`"use client"`) que chamam a API via `fetch`. |
| Estilos | **Tailwind CSS v4** (`@tailwindcss/postcss`) | Configuração CSS-first em `globals.css`. |
| ORM | **Prisma 5.22** | Cliente *singleton* em `lib/prisma.ts` (evita múltiplas ligações em *hot reload*). |
| Base de dados | **PostgreSQL 18** | Neon (`us-east-2`) em produção, uma única BD para web, USSD, admin e portal do motorista; `docker-compose.yml` expõe Postgres local na porta **5433**. |
| Mapas | **MapLibre GL 5** + tiles **OpenFreeMap** | Estilo `liberty`, edifícios 3D com camada `fill-extrusion`, `pitch` 45–60°. Leaflet, `mapbox-gl` e o *loader* do Google Maps continuam como dependências residuais. |
| 3D | **three.js 0.184** | Malha procedimental do autocarro (`Bus3D.tsx`, `Bus3DMarker.tsx`). Atualmente **nenhuma página importa** estes componentes. |
| Rotas | **OSRM** (servidor público `router.project-osrm.org`) | Converte *waypoints* em geometria que segue as estradas. |
| USSD / SMS | **Africa's Talking** (SDK `africastalking`), **Telerivet** | USSD sem estado; SMS de chegada e recibos. |
| Autenticação | **bcryptjs** | Hash de senhas de utentes e administradores. |
| Testes | **Jest 29** + `ts-jest` | Apenas no `transport-admin`, contra a BD real. |
| Gráficos | **Recharts 3** | Dashboard e relatórios do admin. |

---

## 🗄️ Modelo de Dados (resumo)

```
Provincia ─< Cidade ─< Municipio ─< Via >─< Paragem        (junção: ViaParagem)
                                     │          │
                                Transporte      └─< MISSION >─ Utente
                                 │  │  └── Motorista (1:1, transporteId @unique)
                                 │  └─< GeoLocation (posição atual + 3 históricos)
                                 └─< TransporteProprietario >─ Proprietario
Administrador ── possui ── Provincia / Municipio / Via / Paragem
```

Convenções importantes:
* Coordenadas são guardadas como **texto**: pontos `"lat,lng"`; percursos (`Via.geoLocationPath`, `Transporte.routePath`) como `"lng,lat;lng,lat;..."` (ordem invertida). Não há índice espacial.
* `MISSION` = paragem guardada por um utente, usada para notificações de chegada.
* `ViaParagem` não tem coluna de ordem e a ordem dos `id` **não** é a ordem de viagem na maioria das vias. As distâncias ordenam as paragens ao longo de `Via.geoLocationPath` (`orderStopsAlongRoute` em `transport-client/lib/fares.ts`).
* `Tarifa` guarda a regra de preço ativa (tarifa mínima, MT/km, fator de estrada, velocidades), partilhada pela web e pelo USSD.
* `Motorista.status` é o estado da conta (ativo/inativo/suspenso); a viagem em curso está em `Motorista.emViagem` + `viagemIniciadaEm`, partilhada pelo USSD e pelo portal do motorista.
* Existem **três cópias** do `schema.prisma`, com diferenças reais:

| Campo | raiz `prisma/` | `transport-client` | `transport-admin` |
|---|---|---|---|
| `Municipio.geoLocation` | — | — | `String?` |
| `Proprietario.birthDate` | `DateTime` | — | `DateTime` |
| `Proprietario.dataInicioOperacoes` | — | `DateTime` | — |
| `Proprietario.foto` / `certificado` | — | `String?` | — |
| `Motorista.password` | `String?` | `String?` | — |

  Consequência: a BD tem `Proprietario.birthDate` e não tem `Municipio.geoLocation`, por isso as consultas a `Proprietario` do `transport-client` e a `Municipio` do `transport-admin` falham. A ausência de `password` no admin é intencional: `GET /api/motoristas` não a devolve.

Detalhes campo a campo em **[Estrutura da Base de Dados](database.md)**.

---

## 🔄 Fluxos Principais

### 1. Simulação de posição dos autocarros
As posições **não vêm de GPS real** — são geradas por um simulador no servidor.
1. A página inicial do passageiro chama `GET /api/startup`.
2. `initializeBusPositions()` lê todos os `Transporte`, converte `routePath` (ou `Via.geoLocationPath`) em *waypoints* e pede ao OSRM a geometria por estrada (com *cache* em memória).
3. Cada autocarro recebe velocidade aleatória de 25–45 km/h, ponto de partida e sentido aleatórios.
4. `startBusSimulation()` corre um `setInterval` (30 s na raiz) que interpola a posição ao longo da linha, escreve `Transporte.currGeoLocation` e atualiza/cria o registo `GeoLocation` (sentido `Indo`/`Voltando`).
5. No mesmo ciclo, `checkAndNotifyUsers()` procura `MISSION` das últimas 24 h e envia SMS quando um autocarro da via está a menos de 1 km da paragem.

### 2. Pesquisa e ETA (web)
1. `/search` → `GET /api/available-routes` devolve apenas municípios/vias/paragens que têm autocarros.
2. `GET /api/buses?paragemId=&viaId=&destinationId=` valida a ligação `ViaParagem`, lê os autocarros da via e calcula:
   * distância por **Haversine** somada entre paragens consecutivas, com as paragens ordenadas ao longo do percurso desenhado;
   * **ETA** e **tarifa** pela regra ativa em `Tarifa` (`lib/fares.ts`): por omissão chegada a 45 km/h, viagem a 30 km/h, tarifa = máx(10 MT, ⌈km × 10⌉).
3. O resultado é ordenado por ETA e desenhado no MapLibre.
4. Na página `/track/[id]`, o movimento é **animado no navegador** a cada 5 s em direção à paragem (não volta a consultar a API).

### 3. USSD
1. O operador (Africa's Talking) faz `POST /api/ussd` com `sessionId`, `phoneNumber`, `text`.
2. O servidor é **sem estado**: reconstrói a navegação dividindo `text` por `*`. As teclas `7`/`8`/`0` são interpretadas como Próximo/Anterior/Voltar pelo motor de paginação (6 itens por página).
3. Menu principal (`transport-client`): 1 Encontrar Transporte · 2 Procurar Rotas · 3 Paragens Próximas · 4 Calcular Tarifa · 5 Rastrear Autocarro · 6 Área do Motorista · 7 Ajuda.
4. As opções 1 (Encontrar Transporte) e 4 (Calcular Tarifa) usam a mesma regra `Tarifa` e a mesma distância ao longo da via que a web; sem percurso conhecido, usam linha reta × `fatorEstrada`.
5. A opção 6 (Área do Motorista) inicia/encerra a viagem em `Motorista.emViagem`, o mesmo estado que o portal do motorista mostra.
6. Respostas `CON …` mantêm a sessão; `END …` terminam-na. Respostas finais são também enviadas por SMS com `waitUntil(sendSMS(...))`.
7. `/api/ussd-telerivet` implementa o mesmo fluxo para o Telerivet (valida `TELERIVET_SECRET`).

### 4. Portal do Motorista
1. Login por telefone + senha em `POST /api/driver/login` do `transport-client` (mesma regra de senha do USSD).
2. A resposta (motorista, transporte, via, paragens e estado da viagem) é guardada em `localStorage['motorista']`.
3. O botão Iniciar/Finalizar chama `POST /api/driver/trip` (`action: iniciar|encerrar`); o painel lê `GET /api/driver/trip` ao abrir e a cada 30 s, por isso uma viagem iniciada ou encerrada no USSD aparece no portal e vice-versa. O contador conta a partir de `viagemIniciadaEm`.
4. O painel mostra a rota (OSRM no cliente) e o mapa 3D inclinado. A geolocalização do navegador só alimenta o **velocímetro** — a posição **não é enviada** ao servidor.

### 5. Administração
1. Login em `POST /api/auth/admin/login` (bcrypt) → dados guardados em `localStorage['admin']` e lidos pelo `AuthContext`.
2. As páginas CRUD chamam a API do próprio `transport-admin`.
3. A página de relatórios chama `${NEXT_PUBLIC_API_URL}/api/admin/stats`, que só existe na app da raiz.

---

## 🚀 Implantação e Ambientes

| Item | Valor |
|---|---|
| Hospedagem | Vercel (`transport-client` como *Root Directory*; `vercel.json` na raiz constrói a app da raiz) |
| Base de dados | Neon PostgreSQL (mesma `DATABASE_URL` para raiz, cliente e admin) |
| Local | `docker compose up -d` → Postgres em `localhost:5433` |
| Variáveis | `DATABASE_URL`, `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_SHORTCODE`, `TELERIVET_SECRET`, `ADMIN_SECRET`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_LOG_LEVEL` |

Portas em desenvolvimento — os scripts e o `start-all.bat` **não coincidem**:

| App | `start-all.bat` diz | Script `npm run dev` real |
|---|---|---|
| `transport-admin` | 3001 | `next dev` (3000 por omissão) |
| `transport-client` | 3000 | `next dev` (3000 por omissão) |
| raiz `app/` | — | `next dev -p 3000` |
| `transport-driver` | 3002 | `next dev -p 3001` |

---

## 🔐 Segurança (estado atual)

* **APIs do admin sem autenticação no servidor** — a proteção existe apenas no navegador (`localStorage`); qualquer pessoa pode chamar os endpoints CRUD diretamente.
* **Login do motorista** aceita a senha universal `123456` e qualquer senha quando `password` é `null`; as senhas são guardadas e comparadas em texto simples.
* `Motorista.password` só existe no schema da raiz (nenhuma migração o cria). Por isso:
  * motoristas criados no `transport-admin` ficam com `password = NULL` e entram no portal web com **qualquer** senha;
  * o USSD e o `/api/driver/login` do `transport-client` aplicam a mesma regra: senha guardada, `123456`, ou qualquer senha quando `password` é `NULL`.
* Login de utente/admin devolve dados mas **não emite sessão/token**.
* `/api/driver/trip` não tem autenticação: quem souber o `id` de um motorista pode iniciar/encerrar a sua viagem (o mesmo já era possível chamando `/api/ussd` com o telefone do motorista e `123456`).
* `Access-Control-Allow-Origin: *` em `/api/driver/*` do `transport-client` e em `/api/buses`, `/api/driver/login` e `/api/admin/*` da raiz (que devolve, sem autenticação, email e telefone de todos os utentes).
* `/api/admin/seed` exige `ADMIN_SECRET` no campo `authorization` do corpo JSON.
* `/api/ussd-telerivet` só valida o segredo se `TELERIVET_SECRET` estiver definido.

---

## ⚠️ Riscos Técnicos Conhecidos

* **Simulador em processo** (`setInterval` em memória) não funciona de forma fiável em *serverless* (Vercel): cada instância tem o seu próprio estado e pode correr simulações concorrentes ou nenhuma.
* **SMS repetidos**: `checkAndNotifyUsers()` não guarda quem já foi notificado, logo reenvia a cada ciclo enquanto o autocarro estiver a < 1 km.
* **Código duplicado**: `app/` vs `transport-client/`, tabela de ruas codificada em `lib/busLocationService.ts` e no USSD, três `schema.prisma`.
* `prisma.$disconnect()` em blocos `finally` sobre o cliente *singleton* força novas ligações a cada pedido.
* `transport-admin/app/api/transportes` filtra por `motoristaId`, campo que não existe em `Transporte` (`?availableOnly=true` falha).
* Datas de histórico em `GeoLocation` são fictícias (agora − 5/10/15 min).
* Cerca de 230 scripts de manutenção pontuais (`check-*`, `fix-*`, `create-*`) espalhados pela raiz e pelo `transport-admin`.

---

## 🗺️ Navegação da Documentação
* 🏠 **[Página Principal (Home)](../README.md)**
* 🏁 **[Guia de Início Rápido](getting-started.md)**
* 🏗️ **[Arquitetura do Sistema (Esta Página)](architecture.md)**
* 🗄️ **[Estrutura da Base de Dados](database.md)**
