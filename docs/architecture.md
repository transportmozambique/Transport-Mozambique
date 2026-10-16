# 🏗️ Arquitetura do Sistema

Esta página descreve a arquitetura real do **Sistema de Transportes de Moçambique**: as aplicações que o compõem, como comunicam entre si, a stack tecnológica, os fluxos de dados principais, a implantação e os riscos técnicos conhecidos.

> 📄 Existe uma versão alargada deste documento em PDF: **[architecture.pdf](architecture.pdf)** (em inglês, com diagramas, catálogo de APIs e análise de segurança). Descreve o código no *snapshot* de maio de 2026; a secção 1.2 indica o estado atual de cada problema encontrado.

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
             │ OSRM (raiz e motorista) · OpenFreeMap (tiles vetoriais)    │
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
| **`transport-client/`** | Portal do passageiro (web) + USSD + API do motorista | 17 | 6 | Aplicação mais ativa. Implantada no Vercel com *Root Directory* = `transport-client`. Usa `@vercel/functions` (`waitUntil`) para enviar SMS após responder ao USSD. Serve `/api/driver/login` e `/api/driver/trip` ao portal do motorista. |
| **`app/` + `lib/` + `prisma/` (raiz)** | Variante paralela (legada) do portal do passageiro e *hub* de backend | 28 | 14 | **Não está implantada.** Contém o simulador com OSRM, uma versão antiga de `/api/driver/login`, `/api/admin/*` sem autenticação (já não usado pelo `transport-admin`) e um painel admin legado em `app/admin/*`. `prisma/migrations` (raiz) é a fonte das migrações. |
| **`transport-admin/`** | Back-office | 27 | 47 | CRUD completo de províncias, municípios, vias, paragens, transportes, motoristas, proprietários, utentes e administradores. Dashboard e relatórios com Recharts, todos sobre a sua própria API, protegida por sessão (`proxy.ts`). Testes Jest em `__tests__/api`. |
| **`transport-driver/`** | Portal do motorista | 0 | 6 | Não tem API nem acesso à BD. Usa `${NEXT_PUBLIC_API_URL}/api/driver/login` e `/api/driver/trip` do `transport-client`, guarda a sessão em `localStorage`, sincroniza a viagem com `/api/driver/trip` a cada 30 s e desenha a rota com OSRM + MapLibre num mapa 3D inclinado (pitch 60°, edifícios extrudidos). |

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
| Rotas | **OSRM** (servidor público `router.project-osrm.org`) | Usado pelo simulador da raiz e pelo portal do motorista. O `transport-client` desenha o percurso guardado (`Via.geoLocationPath`), que já segue as estradas. |
| USSD / SMS | **Africa's Talking** (SDK `africastalking`), **Telerivet** | USSD sem estado; SMS de chegada e recibos. |
| Autenticação | **bcryptjs**, cookie de sessão HMAC | Hash de senhas de utentes e administradores; sessão do admin num cookie `HttpOnly` assinado com `ADMIN_SESSION_SECRET`. |
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
* `MISSION` = paragem onde um utente espera, usada para notificações de chegada; `notificadoEm` regista o último SMS enviado.
* `ViaParagem` não tem coluna de ordem e a ordem dos `id` **não** é a ordem de viagem na maioria das vias. As distâncias ordenam as paragens ao longo de `Via.geoLocationPath` (`orderStopsAlongRoute` em `transport-client/lib/fares.ts`).
* `Tarifa` guarda a regra de preço ativa (tarifa mínima, MT/km, fator de estrada, velocidades), partilhada pela web e pelo USSD.
* `Motorista.status` é o estado da conta (ativo/inativo/suspenso); a viagem em curso está em `Motorista.emViagem` + `viagemIniciadaEm`, partilhada pelo USSD e pelo portal do motorista.
* Existem **três cópias** do `schema.prisma`, com diferenças reais:

| Campo | raiz `prisma/` | `transport-client` | `transport-admin` |
|---|---|---|---|
| `Proprietario.birthDate` | `DateTime` | — | `DateTime` |
| `Proprietario.dataInicioOperacoes` | — | `DateTime` | — |
| `Proprietario.foto` / `certificado` | — | `String?` | — |
| `Motorista.password` | `String?` | `String?` | — |

  A BD segue o schema da raiz. O `transport-client` não consulta `Proprietario`, por isso a diferença não tem efeito em execução, mas o seu `prisma/seed.ts` só funciona com aquela cópia. A ausência de `password` no admin é intencional: `GET /api/motoristas` não a devolve.
* `prisma/migrations` (raiz) reproduz exatamente `prisma/schema.prisma` desde `20261015130000_assessment_fixes`. A BD de produção não tem a tabela `_prisma_migrations` (as alterações foram aplicadas fora do `migrate`), por isso as migrações são escritas para poderem ser repetidas sem efeito (`IF NOT EXISTS`).

Detalhes campo a campo em **[Estrutura da Base de Dados](database.md)**.

---

## 🔄 Fluxos Principais

### 1. Simulação de posição dos autocarros
As posições **não vêm de GPS real** — são geradas por um simulador no servidor.
1. A página inicial do passageiro chama `GET /api/startup`.
2. `initializeBusPositions()` lê todos os `Transporte`, converte `routePath` (ou `Via.geoLocationPath`) em *waypoints* e pede ao OSRM a geometria por estrada (com *cache* em memória).
3. Cada autocarro recebe velocidade aleatória de 25–45 km/h, ponto de partida e sentido aleatórios.
4. `startBusSimulation()` corre um `setInterval` (30 s na raiz) que interpola a posição ao longo da linha, escreve `Transporte.currGeoLocation` e atualiza/cria o registo `GeoLocation` (sentido `Indo`/`Voltando`).
5. No mesmo ciclo, `checkAndNotifyUsers()` procura `MISSION` das últimas 24 h e envia SMS quando um autocarro da via está a menos de 1 km da paragem — no máximo um SMS por missão a cada 30 min (`MISSION.notificadoEm`).

### 2. Pesquisa e ETA (web)
1. `/search` → `GET /api/available-routes` devolve apenas municípios/vias/paragens que têm autocarros.
2. `GET /api/buses?paragemId=&viaId=&destinationId=` valida a ligação `ViaParagem`, lê os autocarros da via e calcula cada viagem com `estimateTrip` (`lib/fares.ts`):
   * distância por **Haversine** somada entre paragens consecutivas, com as paragens ordenadas ao longo do percurso desenhado;
   * **ETA** e **tarifa** pela regra ativa em `Tarifa`: por omissão chegada a 45 km/h, viagem a 30 km/h, tarifa = máx(10 MT, ⌈km × 10⌉);
   * um autocarro que já passou a paragem (`jaPassou`) conta o resto da volta + 10 min de retorno.
3. O resultado é ordenado por ETA e desenhado no MapLibre a partir do percurso guardado. O mapa inicial atualiza os marcadores a cada 15 s com `GET /api/buses?fields=position`.
4. A página `/track/[id]` relê `GET /api/bus/[id]` a cada 10 s e desliza o marcador até à nova posição; os tempos mostrados são os do servidor. A mesma função serve o USSD, por isso web e USSD dão os mesmos números.

### 3. USSD
1. O operador (Africa's Talking) faz `POST /api/ussd` com `sessionId`, `phoneNumber`, `text`.
2. O servidor é **sem estado**: reconstrói a navegação dividindo `text` por `*`. As teclas `7`/`8`/`0` são interpretadas como Próximo/Anterior/Voltar pelo motor de paginação (6 itens por página). Cada ecrã é cortado a **182 caracteres** e os acentos são removidos (GSM-7).
3. Menu principal (`transport-client`): 1 Encontrar transporte · 2 Procurar rotas · 3 Paragens de uma rota · 4 Calcular tarifa · 5 Rastrear autocarro · 6 Área do motorista · 7 Ajuda.
4. A opção 1 escolhe o autocarro que chega primeiro, com as paragens da sua própria via, e usa `estimateTrip` como a web; regista a `MISSION` na paragem de origem para o SMS de chegada. A opção 4 usa a mesma regra `Tarifa` e a distância ao longo da via; sem percurso conhecido, usa linha reta × `fatorEstrada`.
5. A opção 5 aceita parte da matrícula (lista as correspondências) e indica a paragem mais próxima do autocarro.
6. A opção 6 (Área do Motorista) inicia/encerra a viagem em `Motorista.emViagem`, o mesmo estado que o portal do motorista mostra.
7. Respostas `CON …` mantêm a sessão; `END …` terminam-na. Os resultados são também enviados por SMS com `waitUntil(sendSMS(...))` (na opção 1, a pedido). Sem `AFRICASTALKING_API_KEY`, `sendSMS` regista e não envia.
8. `/api/ussd-telerivet` implementa o mesmo fluxo para o Telerivet (valida `TELERIVET_SECRET`).

### 4. Portal do Motorista
1. Login por telefone + senha em `POST /api/driver/login` do `transport-client` (mesma regra de senha do USSD).
2. A resposta (motorista, transporte, via, paragens e estado da viagem) é guardada em `localStorage['motorista']`.
3. O botão Iniciar/Finalizar chama `POST /api/driver/trip` (`action: iniciar|encerrar`); o painel lê `GET /api/driver/trip` ao abrir e a cada 30 s, por isso uma viagem iniciada ou encerrada no USSD aparece no portal e vice-versa. O contador conta a partir de `viagemIniciadaEm`.
4. O painel mostra a rota (OSRM no cliente) e o mapa 3D inclinado. A geolocalização do navegador só alimenta o **velocímetro** — a posição **não é enviada** ao servidor.

### 5. Administração
1. Login em `POST /api/auth/admin/login` (bcrypt) → cookie de sessão `admin_session` (`HttpOnly`, 12 h, assinado com `ADMIN_SESSION_SECRET`). O `AuthContext` pergunta a `GET /api/auth/admin/session` quem está autenticado; `localStorage['admin']` só guarda o perfil mostrado.
2. `proxy.ts` rejeita com 401 qualquer `/api/*` sem sessão válida (exceto login e logout); um 401 termina a sessão no navegador.
3. As páginas CRUD e os relatórios chamam apenas a API do próprio `transport-admin` (`/api/relatorios/stats` para as estatísticas gerais).

---

## 🚀 Implantação e Ambientes

| Item | Valor |
|---|---|
| Hospedagem | Vercel (`transport-client` como *Root Directory*; `vercel.json` na raiz constrói a app da raiz) |
| Base de dados | Neon PostgreSQL (mesma `DATABASE_URL` para raiz, cliente e admin) |
| Local | `docker compose up -d` → Postgres em `localhost:5433` |
| Variáveis | Cliente: `DATABASE_URL`, `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_SHORTCODE`, `TELERIVET_SECRET`. Admin: `DATABASE_URL`, `ADMIN_SESSION_SECRET` (obrigatória em produção). Motorista: `NEXT_PUBLIC_API_URL`. |

Portas em desenvolvimento — os scripts e o `start-all.bat` **não coincidem**:

| App | `start-all.bat` diz | Script `npm run dev` real |
|---|---|---|
| `transport-admin` | 3001 | `next dev` (3000 por omissão) |
| `transport-client` | 3000 | `next dev` (3000 por omissão) |
| raiz `app/` | — | `next dev -p 3000` |
| `transport-driver` | 3002 | `next dev -p 3001` |

---

## 🔐 Segurança (estado atual)

* **APIs do admin protegidas por sessão** — `proxy.ts` exige o cookie `admin_session`. Sem `ADMIN_SESSION_SECRET` em produção, nenhuma sessão é aceite (falha fechada).
* Removidos os endpoints públicos de depuração e escrita em massa (`debug-*`, `test-*`, `create-transportes`, `assign-transportes`, `check-assignments`) e o `/api/admin/seed` do cliente, que apagava e voltava a criar a BD sem autenticação. Na app da raiz, só ficou o `GET` de estado do seed.
* **Login do motorista** aceita a senha universal `123456` e qualquer senha quando `password` é `null`; as senhas são guardadas e comparadas em texto simples.
* `Motorista.password` só existe no schema da raiz (nenhuma migração o cria). Por isso:
  * motoristas criados no `transport-admin` ficam com `password = NULL` e entram no portal web com **qualquer** senha;
  * o USSD e o `/api/driver/login` do `transport-client` aplicam a mesma regra: senha guardada, `123456`, ou qualquer senha quando `password` é `NULL`.
* Login de utente devolve dados mas **não emite sessão/token**; as rotas `/api/user/*` do cliente não verificam quem chama.
* `/api/driver/trip` não tem autenticação: quem souber o `id` de um motorista pode iniciar/encerrar a sua viagem (o mesmo já era possível chamando `/api/ussd` com o telefone do motorista e `123456`).
* `Access-Control-Allow-Origin: *` em `/api/driver/*` do `transport-client` e em `/api/buses`, `/api/driver/login` e `/api/admin/*` da raiz (não implantada; devolve, sem autenticação, email e telefone de todos os utentes).
* `/api/ussd-telerivet` só valida o segredo se `TELERIVET_SECRET` estiver definido.

---

## ⚠️ Riscos Técnicos Conhecidos

* **Simulador em processo** (`setInterval` em memória) não funciona de forma fiável em *serverless* (Vercel): cada instância tem o seu próprio estado e pode correr simulações concorrentes ou nenhuma.
* **Código duplicado**: `app/` vs `transport-client/`, tabela de ruas codificada em `lib/busLocationService.ts` e no USSD, três `schema.prisma`.
* `prisma.$disconnect()` em blocos `finally` sobre o cliente *singleton* ainda existe em algumas rotas do admin (`administradores`, `vias`) e da raiz.
* Datas de histórico em `GeoLocation` são fictícias (agora − 5/10/15 min).
* **Dados**: várias paragens repetem o nome da rua (ex.: "ESTRADA NACIONAL NÚMERO 1" 8 vezes na mesma via) e alguns terminais têm nomes como "120" ou "60", que aparecem assim no USSD.
* O carregamento do certificado do proprietário no admin não é guardado: a API ignora o campo `certificado` (precisa de armazenamento de ficheiros, ex.: Vercel Blob).
* Páginas do portal do motorista ainda simuladas: `/stats`, `/report`, `/support` e os passageiros/ganhos do painel.
* Cerca de 230 scripts de manutenção pontuais (`check-*`, `fix-*`, `create-*`) espalhados pela raiz e pelo `transport-admin`.

---

## 🗺️ Navegação da Documentação
* 🏠 **[Página Principal (Home)](../README.md)**
* 🏁 **[Guia de Início Rápido](getting-started.md)**
* 🏗️ **[Arquitetura do Sistema (Esta Página)](architecture.md)**
* 🗄️ **[Estrutura da Base de Dados](database.md)**
