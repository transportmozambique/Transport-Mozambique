# Referência da API

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 3. Perceber como funciona › **Referência da API** (página 14 de 26)

Anterior: [Segurança](seguranca.md) · [Índice](README.md) · Seguinte: [Mapa do código](mapa-do-codigo.md)

<details>
<summary>Todas as páginas</summary>

- 0. Começar do zero: [Conceitos básicos](conceitos.md) · [Preparar o computador](preparar-o-computador.md)
- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · **Referência da API** · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md) · [Guia do cron-job.org](guia-cron-job.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

> **Em palavras simples:** Os ecrãs das aplicações pedem e enviam dados ao [servidor](conceitos.md#servidor "Um computador sempre ligado que recebe pedidos e responde a eles.") por endereços próprios, como `/api/buses` (os autocarros) ou `/api/gps` (uma posição). Esta página lista todos esses endereços: o que se envia a cada um e o que ele responde. É sobretudo para quem programa; [Como ler esta página](#como-ler-esta-página) explica a forma, e como experimentar um endereço no [navegador](conceitos.md#navegador "O programa com que se abrem sites: Chrome, Firefox, Edge, Safari.").

Todos os [endpoints](conceitos.md#api "Uma API é a lista de pedidos que um servidor aceita de outros programas; cada um desses pedidos, com o seu endereço, é um endpoint.") [HTTP](conceitos.md#http "A forma combinada como o navegador (ou outro programa) pede algo a um servidor, e como o servidor responde.") das duas aplicações que têm API. O portal do motorista não tem: chama a aplicação dos passageiros ([Visão geral → Como as partes se ligam](visao-geral.md#como-as-partes-se-ligam)).

As respostas de exemplo foram gravadas numa cópia local dos dados de produção em 2026-10-17, com as listas longas cortadas a dois itens (`"… (238 itens)"`) e os textos longos encurtados (`…`).

**Nesta página:** [Como ler esta página](#como-ler-esta-página) · [Convenções](#convenções) · [Aplicação dos passageiros](#aplicação-dos-passageiros-transport-client) ([mapa e viagens](#mapa-e-viagens) · [conta do passageiro](#conta-do-passageiro) · [motorista](#motorista) · [GPS](#gps) · [USSD](#ussd)) · [Painel de administração](#painel-de-administração-transport-admin) ([sessão](#sessão) · [listas e registos](#listas-e-registos) · [rotas](#rotas) · [veículos](#veículos) · [motoristas](#motoristas) · [regra de tarifa](#regra-de-tarifa) · [administradores](#administradores) · [estatísticas](#estatísticas))

---

## Como ler esta página

Cada endpoint aparece assim:

```http
GET /api/buses?fields=position
```

- **A primeira palavra é o método** ([GET e POST](conceitos.md#get-e-post)): `GET` lê, `POST` envia dados, `PUT` e `PATCH` alteram, `DELETE` apaga.
- **Depois vem o caminho**, que se junta ao endereço base da aplicação (tabela abaixo): `https://transport-mz.vercel.app/api/buses?fields=position`.
- **`{id}` no caminho** substitui-se pelo identificador de uma linha da [base de dados](conceitos.md#base-de-dados "O sítio organizado onde a plataforma guarda tudo o que tem de durar: rotas, paragens, veículos, contas."), por exemplo o `id` de uma rota que veio noutra resposta.
- **Um corpo**, quando o pedido leva um, aparece a seguir, em [JSON](conceitos.md#json).
- **A resposta** mostra o [código de resposta](conceitos.md#codigos-de-resposta) e o JSON que vem de volta.

**Experimentar um `GET` da aplicação dos passageiros:** colar o endereço completo na barra do navegador. Por exemplo, https://transport-mz.vercel.app/api/buses?fields=position mostra as posições de todos os autocarros neste momento. O Firefox mostra o JSON arrumado; o Chrome mostra-o numa linha, com uma opção "Pretty-print" no topo.

**Experimentar um `POST`:** com [`curl`](conceitos.md#curl) num [terminal](conceitos.md#terminal). Por exemplo, as viagens entre duas paragens:

```bash
curl -s -X POST https://transport-mz.vercel.app/api/journeys \
  -H "Content-Type: application/json" \
  -d '{"from": "<id de uma paragem>", "to": "<id de outra paragem>"}'
```

Lê-se: "envia (`-X POST`) a este endereço, avisando que o corpo é JSON (`-H`), este corpo (`-d`)". Os `id` das paragens vêm da resposta de [`GET /api/stops`](#get-apistops), que se abre no navegador.

**Os endpoints do painel** só respondem a uma [sessão](conceitos.md#sessao "Depois de entrar, o servidor dá uma prova de quem se é (um token), e o navegador mostra-a a cada pedido para não ter de pedir a palavra-passe outra vez.") de administrador: experimentam-se pelo próprio painel, ou pelos testes ([Testes](testes.md)).

## Convenções

| | Aplicação dos passageiros | Painel de administração |
|---|---|---|
| [URL](conceitos.md#url "O texto que diz ao navegador onde está uma página ou informação, como https://transport-mz.vercel.app/viagem.") base | `https://transport-mz.vercel.app` (local: `http://localhost:3000`) | `https://transport-mz-admin.vercel.app` (local: `http://localhost:3002`) |
| Código | [`transport-client/app/api/**/route.ts`](../transport-client/app/api) | [`transport-admin/app/api/**/route.ts`](../transport-admin/app/api) |
| Autenticação | Quase tudo público. Os endpoints do passageiro e do motorista pedem `Authorization: Bearer <token>` ([Segurança](seguranca.md)). | Todos os endpoints, menos a entrada, precisam do cookie `admin_session`. |
| Outros domínios ([CORS](conceitos.md#cors "A regra dos navegadores que só deixa uma página falar com o servidor de outro site se esse servidor o permitir.")) | `Access-Control-Allow-Origin: *` só em `/api/driver/*` e `/api/gps` | nenhum (só o mesmo domínio) |

- Os corpos são JSON (`Content-Type: application/json`), menos o [USSD](conceitos.md#ussd "Os menus que aparecem num telemóvel quando se marca um código como *384*848080#; funcionam em qualquer telemóvel, sem internet.") (entra em formulário, sai `text/plain`) e o [GPS](conceitos.md#gps "O sistema de satélites com que um telemóvel ou um aparelho sabe as suas coordenadas.") (também aceita [parâmetros](conceitos.md#parametros "As três formas de um pedido levar informação: no endereço, no conteúdo, ou em etiquetas à parte.") no URL e formulários).
- Os erros são JSON `{"error": "…"}`, às vezes com `"details"`, e a mensagem está em português. Estados habituais: 400 dados inválidos, 401 sem sessão ou sessão inválida, 404 não encontrado, 500 erro do servidor ou da base de dados.
- Os ids são `cuid`s do [Prisma](conceitos.md#prisma "A ferramenta com que o código fala com a base de dados sem escrever SQL à mão.") (`cmovfwlry0a5z14lnnytqzom2`).
- [Coordenadas](conceitos.md#coordenadas "Dois números que dizem onde está um ponto na Terra."): os campos `latitude`/`longitude` das respostas são números. Os textos guardados mantêm os formatos da base de dados: pontos `"lat,lng"`, percursos `"lng,lat;lng,lat;…"`. As listas `routeCoords` e `routePath` são pares `[lng, lat]` ([Base de dados → Convenções](base-de-dados.md#convenções-ler-antes-de-consultar)). Porquê `[lng, lat]`: é a ordem do GeoJSON e do Leaflet ao desenhar linhas.
- As horas são ISO 8601 em UTC; Maputo está em UTC+2.

---

## Aplicação dos passageiros (`transport-client`)

### Mapa e viagens

#### `GET /api/startup`

Começa uma verificação de chegadas ([SMS](conceitos.md#sms "As mensagens de texto curtas dos telemóveis.")) em segundo plano ([Fluxos de dados → Alerta de chegada](fluxos-de-dados.md#alerta-de-chegada-e-sms)) e diz o modo das posições. Já nenhuma página o chama (a actualização das posições do mapa faz a mesma verificação). Código: [`app/api/startup/route.ts`](../transport-client/app/api/startup/route.ts).

```json
{"success": true, "status": {"mode": "gps-or-driver-trip", "busCount": 6, "inService": 4, "withFreshGps": 0, "following": 0, "lastArrivalCheck": null}}
```

#### `GET /api/stops`

Todas as paragens servidas por um autocarro, com as rotas que lá passam, para o mapa e a pesquisa de nomes. Cada paragem lista as suas rotas como posições na lista `vias` (porquê: repetir os dados de uma rota em cada paragem multiplicaria o tamanho). `semAutocarro` lista as outras paragens (nenhuma das suas rotas tem veículo), como `{"id", "nome", "lat", "lng"}`, para o mapa as poder mostrar. Guardado em cache 5 minutos (`Cache-Control: public, s-maxage=300`), cerca de 280 KB (70 KB comprimido). Código: [`app/api/stops/route.ts`](../transport-client/app/api/stops/route.ts).

```json
{
 "vias": [{"id": "cmoveu8as00yr14lnpndpwdqj", "codigo": "V086", "nome": "Rua Dos Bons Amigos - Antena", "cor": "#F7DC6F"}, "… (261 itens)"],
 "paragens": [{"id": "cmoveoy8l00d214lnk8uwxf8t", "nome": "Portão", "lat": -25.784395699999997, "lng": 32.58930225,
               "v": [0, 3, 12, 13, "…"]}, "… (1855 itens)"]
}
```

#### `GET /api/stops/{id}`

As rotas de uma paragem e, para cada sentido de cada rota, o próximo autocarro e as paragens para onde vai, por ordem. `destinos` lista todos os locais a que se chega a partir da paragem com até 4 autocarros, a chegada mais cedo primeiro ([Fluxos de dados → Planear uma viagem](fluxos-de-dados.md#planear-uma-viagem)). `para` dá o nome do sentido pela paragem nessa ponta da rota. `minutos` segue as mesmas regras de todo o lado ([Fluxos de dados → Hora de chegada](fluxos-de-dados.md#hora-de-chegada)); `proximo` é `null` quando nenhum autocarro da rota pode vir. Código: [`app/api/stops/[id]/route.ts`](../transport-client/app/api/stops/[id]/route.ts).

```json
{
 "paragem": {"id": "cmoveoy8l00d214lnk8uwxf8t", "nome": "Portão", "lat": -25.784395699999997, "lng": 32.58930225, "codigo": "PAR-0469"},
 "rotas": [{
   "via": {"id": "cmoveu8as00yr14lnpndpwdqj", "codigo": "V086", "nome": "Rua Dos Bons Amigos - Antena", "cor": "#F7DC6F"},
   "sentidos": [{
     "para": "Antena",
     "proximo": {"minutos": 10, "matricula": "ACK-145M", "transporteId": "cmozbudx900049ounfhdlny9a"},
     "paragens": [{"id": "cmoveoy0q00d114lnzprias6n", "nome": "Michafutene", "lat": -25.7843419, "lng": 32.5924715}, "… (27 itens)"]
   }, "… (o outro sentido)"]
 }, "… (22 rotas)"],
 "destinos": [
   {"ids": ["cmoveoy0q00d114lnzprias6n"], "nome": "Michafutene", "chegada": "2026-10-18T03:03:23.221Z", "minutos": 334,
    "transbordos": 0, "vias": [{"codigo": "V101", "nome": "Moamba - Djimomposse", "cor": "#FF6B6B"}],
    "embarque": {"id": "cmoveoy8l00d214lnk8uwxf8t", "nome": "Portão", "lat": -25.784395699999997, "lng": 32.58930225}, "metrosAtePrimeira": 0},
   {"ids": ["cmoveqpvj00kv14lnwb9sor5u", "… (6 paragens de um local)"], "nome": "Estrada Circular - Rua Baixo dos Fios 380 m",
    "chegada": "2026-10-18T03:34:23.221Z", "minutos": 365, "transbordos": 2,
    "vias": [{"codigo": "V052", "nome": "Rua 15 - Barraca Azul", "cor": "#F1FAEE"}, {"codigo": "V076", "…": "…"}, {"codigo": "V089", "…": "…"}],
    "embarque": {"id": "cmoveoy0q00d114lnzprias6n", "nome": "Michafutene", "…": "…"}, "metrosAtePrimeira": 280},
   "… (408 locais)"
 ]
}
```

`ids` são as paragens do local (passam-se como `to` a `/api/journeys`), `nome` distingue os locais com o mesmo nome, e `vias` são as rotas dos autocarros pela ordem em que se apanham. `embarque` é a paragem onde se apanha o primeiro autocarro: esta paragem. `metrosAtePrimeira` é a caminhada até lá (0 a partir de uma paragem; a partir de uma posição em `/api/destinos`, a caminhada desde essa posição).

Erros: 404 `Paragem não encontrada`.

#### `GET /api/destinos`

Todos os locais a que se chega a partir de uma partida com até 4 autocarros, a chegada mais cedo primeiro, para a lista "Para onde ir" do painel lateral. Cada entrada diz onde apanhar o primeiro autocarro: o B em A → B → C ([Fluxos de dados → Planear uma viagem](fluxos-de-dados.md#planear-uma-viagem)). Código: [`app/api/destinos/route.ts`](../transport-client/app/api/destinos/route.ts).

| Parâmetro | Significado |
|---|---|
| `lat`, `lng` | a posição do passageiro; o primeiro autocarro apanha-se na paragem, das 8 mais próximas a menos de 800 m, onde se chega mais cedo, contando a caminhada |
| `from` | em vez de uma posição: o id de uma paragem, ou vários separados por vírgulas, para um local |

As entradas têm os mesmos campos que `destinos` em [`GET /api/stops/{id}`](#get-apistopsid). O painel pergunta outra vez quando a posição se moveu cerca de 100 m.

```json
{
 "destinos": [
   {"ids": ["cmoveoxsu00d014ln67l0uot1"], "nome": "Igreja - Makalela", "chegada": "2026-10-19T05:54:02.831Z", "minutos": 10,
    "transbordos": 0, "vias": [{"codigo": "V052", "nome": "Rua 15 - Barraca Azul", "cor": "#F1FAEE"}],
    "embarque": {"id": "cmoveoy8l00d214lnk8uwxf8t", "nome": "Portão", "lat": -25.784395699999997, "lng": 32.58930225},
    "metrosAtePrimeira": 69},
   {"ids": ["cmovem8oo001c14ln40xsj3g0", "… (4 paragens de um local)"], "nome": "Maputo - Wintbank - Tricamo 1730 m",
    "chegada": "2026-10-19T08:01:02.831Z", "minutos": 137, "transbordos": 1,
    "vias": [{"codigo": "V080", "…": "…"}, {"codigo": "V051", "…": "…"}],
    "embarque": {"id": "cmovenf64006i14lnul7e0xjz", "nome": "Michafutene (508)", "lat": -25.784588999999997, "lng": 32.5860694},
    "metrosAtePrimeira": 286},
   "… (404 locais)"
 ]
}
```

Uma posição sem paragens a menos de 800 m dá `{"destinos": []}`. Erros: 400 `Indique a partida (from, ou lat e lng)`; 404 `Paragem não encontrada` (nenhum id de `from` é uma paragem com autocarro); 500 `Erro ao listar destinos`.

#### `GET|POST /api/journeys`

Viagens até um destino, com mudanças de autocarro quando nenhum vai directo ([Fluxos de dados → Planear uma viagem](fluxos-de-dados.md#planear-uma-viagem)). Código: [`app/api/journeys/route.ts`](../transport-client/app/api/journeys/route.ts) e [`lib/journeys.ts`](../transport-client/lib/journeys.ts).

A [aplicação web](conceitos.md#aplicacao-web "Um site que se usa como um programa: tem botões, mapas e contas, e muda conforme o que se faz.") envia um `POST` com um corpo JSON, para a posição do passageiro ficar fora dos [registos](conceitos.md#registos "As linhas de texto que um programa escreve sobre o que está a fazer, para se perceber depois o que aconteceu.") dos pedidos. `GET` aceita os mesmos campos no URL.

| Campo | Significado |
|---|---|
| `to` | id da paragem de destino; vários para um local (paragens com o mesmo nome): uma lista no corpo, separados por vírgulas no URL |
| `from` | id da paragem de origem, ou vários para um local (uma partida escolhida no campo Partida) |
| `lat`, `lng` | em vez de `from`: a posição do passageiro; a viagem começa com uma caminhada até uma das 8 paragens mais próximas a menos de 800 m |

```http
POST /api/journeys
Content-Type: application/json

{"to": ["cmoveoxl100cz14lnx9owv74d"], "lat": -25.7844, "lng": 32.5893}
```

Até 3 opções, a chegada mais cedo primeiro. As horas são datas ISO (UTC). `partida` é quando se entra no primeiro autocarro, `chegada` a chegada à paragem de destino, e `duracaoMin` conta a partir de agora, com caminhadas e esperas; `esperaMin` é a espera nessa paragem depois de o passageiro lá estar. Cada troço de autocarro tem a sua `tarifa`, e `percurso` é o seu caminho pela estrada em pontos `[lng, lat]`.

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
     "percurso": [[32.589304, -25.784361], [32.590143, -25.784347], "… (32 itens)"]
   }]
 }, "… (mais 2)"]
}
```

Uma caminhada é `{"tipo": "pe", "de", "para", "metros", "minutos"}`; a partir de uma posição, a primeira caminhada começa em `{"id": "", "nome": "A sua localização", "lat", "lng"}`. Sem ligação: `"opcoes": []`. Erros: 400 quando falta `to`, ou faltam `from` e `lat`/`lng`; 404 `Paragem não encontrada`.

#### `GET /api/buses`

Cinco usos, escolhidos pelos parâmetros. Código: [`app/api/buses/route.ts`](../transport-client/app/api/buses/route.ts) e [`lib/vehiclePosition.ts`](../transport-client/lib/vehiclePosition.ts).

**1. Todos os autocarros, cada um com o percurso e as paragens da sua rota** (sem parâmetros). Com 451 veículos eram cerca de 6 MB (1 MB comprimido), e por isso já nenhuma página o carrega (desde 2026-10-27 há 6); o mapa ao vivo usa `?fields=map`:

```json
{
 "buses": [{
   "id": "cmozbuqta00189ounhmm7x4d6", "matricula": "ACK-185M", "via": "Rota 85",
   "latitude": -26.0503637, "longitude": 32.3397297, "fonte": "horario", "status": "Em circulação", "fare": 50,
   "routePath": [[32.293904, -25.988661], "… (612 itens)"],
   "stops": [{"id": "cmoveqjxi00k514ln4nojifju", "nome": "Segundo Portão da Rádio Marconi",
              "latitude": -25.9886584, "longitude": 32.2938877, "isTerminal": true}, "… (15 itens)"]
 }, "… (111 itens)"],
 "total": 111
}
```

`fonte` é `gps` (uma posição com menos de 3 minutos) ou `horario` (calculada pela viagem do motorista; o nome ficou do antigo modelo de horário) ([Localização e GPS → Como se escolhe uma posição](localizacao-gps.md#como-se-escolhe-uma-posição)). `status` é `"Em circulação"`, `"No terminal"` ou `"Fora de serviço"` (o motorista não iniciou a viagem). Aqui `fare` é a tarifa do percurso todo. Só aparecem os veículos das rotas activas.

**1b. A primeira carga do mapa ao vivo** (`?fields=map`): o que um marcador e o seu balão mostram, cerca de 20 KB comprimido. A linha da rota de um autocarro tocado vem de [`GET /api/bus/{id}`](#get-apibusid) (`routeCoords`). Porquê separado: o mapa abre depressa mesmo numa ligação lenta, e só se descarrega o percurso que se vai ver.

```json
{"buses": [{"id": "cmvczf52j00xfjhtk3z0wv71x", "matricula": "ADA-014M", "via": "Xipamanine - Museu", "latitude": -25.975327887475753, "longitude": 32.58826561699251, "fonte": "horario", "status": "Fora de serviço"}, "… (6 itens)"], "total": 6}
```

**1c. Os autocarros cuja rota serve uma paragem** (`?servesStop=ID_DA_PARAGEM`): `{"buses": [{"id", "matricula", "via"}], "total"}`, por matrícula. Os alertas de chegada da página da conta usam-no para seguir um autocarro até à paragem guardada.

**2. Só as posições, pedidas a cada 5 s** (`?fields=position`). Também faz a verificação de chegadas (SMS), no máximo a cada 30 s por instância. Os percursos das rotas ficam em cache 5 minutos por instância.

```json
{"buses": [{"id": "cmvczf52j00xfjhtk3z0wv71x", "latitude": -25.975327887475753, "longitude": 32.58826561699251, "fonte": "horario", "direcao": null, "status": "Fora de serviço"}, "… (6 itens)"], "total": 6}
```

`direcao` é o rumo em graus (0 = norte), ou `null` (parado). `status` vem também aqui, para o mapa mudar um autocarro de "Fora de serviço" para "Em circulação" logo que o motorista inicia a viagem.

**3. Pesquisa: os autocarros que servem uma origem e um destino** (`?paragemId=ORIGEM&destinoId=DESTINO`, e opcionalmente `&viaIds=A,B` ou o antigo `&viaId=A`). Sem ids de rotas, consideram-se todos os veículos das rotas activas. Só entram os autocarros em viagem; os resultados vêm ordenados pela hora de chegada.

```json
{
 "buses": [{
   "id": "cmovfwlry0a5z14lnnytqzom2", "matricula": "ACI-004M",
   "via": "Rua do Cajueiro (Fedel Castro) - Estrada Circular", "viaId": "cmoveturn00xh14lnebtzwv1x",
   "direcao": "Rua do Cajueiro (Fedel Castro) → Farmácia",
   "distancia": 2336, "tempoEstimado": 42, "tempoViagem": 5, "velocidade": 30, "fare": 24,
   "latitude": -25.8272823, "longitude": 32.5702438, "fonte": "horario", "status": "Em circulação",
   "routeCoords": [[32.549758, -25.839792], "… (238 itens)"],
   "stops": ["… (12 itens)"]
 }],
 "origem": {"id": "cmoverp1d00p714lng507qgbw", "nome": "Rua do Cajueiro (Fedel Castro)", "latitude": -25.8398513, "longitude": 32.54965},
 "destino": {"id": "cmoverg4e00o314lnyory44cw", "nome": "Petanengue", "latitude": -25.8391986, "longitude": 32.561543}
}
```

| Campo | Significado |
|---|---|
| `tempoEstimado` | minutos até o autocarro chegar à origem no sentido da viagem |
| `distancia` | metros da **viagem** da origem ao destino, ao longo do percurso |
| `tempoViagem` | minutos a bordo |
| `fare` | MT, pela regra de tarifa activa |
| `velocidade` | km/h agora: a do GPS quando a posição é recente, senão a velocidade de viagem da regra de tarifa (0 quando parado ou fora de serviço) |
| `direcao` | o sentido do autocarro, como "primeira paragem → última paragem" desse troço |

Erros: 400 `Indique a origem (paragemId) e o destino (destinoId)`; 404 `Origem não encontrada` / `Destino não encontrado`.

#### `GET|POST /api/viagem`

Acompanhar uma viagem: os mesmos autocarros, troço a troço, com as horas calculadas outra vez agora. A página chama-o a cada 10 segundos e sempre que o passo muda ([Aplicação dos passageiros → Acompanhar uma viagem](app-passageiros.md#acompanhar-uma-viagem-viagem)). Código: [`app/api/viagem/route.ts`](../transport-client/app/api/viagem/route.ts) e [`lib/follow.ts`](../transport-client/lib/follow.ts).

A aplicação web envia um `POST` com os campos abaixo no URL e a posição num corpo JSON, `{"lat": -25.78, "lng": 32.59}` (ou `{}` antes de o navegador a dar), para a posição ficar fora dos registos dos pedidos. `GET` aceita `lat` e `lng` no URL.

| Campo | Significado |
|---|---|
| `b` | os autocarros da viagem, separados por vírgulas, cada um `AUTOCARRO~PARAGEM_DE_ENTRADA~PARAGEM_DE_SAÍDA` |
| `lat`, `lng` | a posição do passageiro agora: a caminhada até ao próximo autocarro mede-se a partir dela |
| `de` | a paragem de partida, quando a viagem começou numa paragem |
| `para` | a paragem de destino, para a última caminhada |
| `a` | o troço em que o passageiro está, a partir de 0; `a` = número de autocarros quer dizer que já fez todos |
| `bordo` | `1` quando o passageiro está no autocarro desse troço |

Porquê os autocarros no URL: o servidor não guarda viagens; quem acompanha a viagem diz em cada pedido quais são, e qualquer instância responde.

Cada passo tem `estado`: `feito`, `agora` ou `depois`. As horas são datas ISO (UTC):

- `embarque` é `null` depois de o passageiro entrar;
- `chegada` é `null` num autocarro já feito.

`autocarro` é onde o autocarro está agora. `trecho` diz onde ele está neste troço: `antes` (ainda vai chegar à paragem de entrada), `entre` (entre as duas paragens, no sentido do passageiro) ou `depois` (já passou a paragem de saída). `perde` é verdadeiro quando o autocarro vai passar na paragem de entrada antes de o passageiro lá conseguir estar; as horas mostradas são então as da passagem seguinte.

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
  "… (o autocarro seguinte, a última caminhada)"
 ]
}}
```

Com um só autocarro e sem paragem de saída (`b=AUTOCARRO`, ou `b=AUTOCARRO~PARAGEM`), responde esse autocarro sozinho. `proximas` lista as 12 paragens seguintes no sentido em que vai, com os minutos até passar em cada uma. `paragem`, quando se deu uma paragem, é a sua próxima passagem por lá, em qualquer sentido.

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

Erros: 400 `Indique os autocarros (b)`, `Cada autocarro precisa de BUS~DE~PARA`; 404 `Autocarro não encontrado`, `Paragem não encontrada`, `Paragem fora da rota deste autocarro`; 500 `Erro ao acompanhar viagem`.

#### `GET /api/walk`

Uma caminhada pelas ruas, para a desenhar no mapa ([Aplicação dos passageiros → Caminhadas pelas ruas](app-passageiros.md#caminhadas-pelas-ruas)). Código: [`app/api/walk/route.ts`](../transport-client/app/api/walk/route.ts) e [`lib/walkRoute.ts`](../transport-client/lib/walkRoute.ts).

| Parâmetro | Significado |
|---|---|
| `de` | início, `LAT,LNG` |
| `para` | fim, `LAT,LNG` |

Os dois pontos arredondam-se a 4 casas decimais (cerca de 11 m). A resposta é o caminho em pontos `[lng, lat]`, do início ao fim, e o seu comprimento pelas ruas:

```json
{"percurso": [[32.58, -25.9655], [32.579738, -25.965349], "… (12 itens)"], "metros": 459}
```

`{"percurso": null}` quando agora não há caminho pelas ruas: a caminhada tem mais de 3 km, ou o [router](conceitos.md#router "Um serviço que, dados dois ou mais pontos, responde com o caminho pelas ruas entre eles e a distância.") está ocupado, falha ou não encontra caminho. A CDN guarda um caminho uma semana (`s-maxage=604800`); `null` não se guarda. Porquê pelo servidor: o router da FOSSGIS vê o servidor e não o passageiro, e a cache serve outros passageiros com os mesmos pontos ([Segurança → Endpoints públicos](seguranca.md#endpoints-públicos)). Erros: 400 `Indique de=LAT,LNG e para=LAT,LNG`.

#### `GET /api/bus/{id}`

Um autocarro, com os números da viagem entre duas paragens quando se dá `?paragem=ORIGEM&destino=DESTINO`. A aplicação web já não o chama ([`/api/viagem`](#getpost-apiviagem) substituiu-o); fica para [scripts](conceitos.md#script "Um pequeno programa que se corre à mão, uma vez, para uma tarefa: importar dados, corrigir percursos, mostrar listas.") e testes. Código: [`app/api/bus/[id]/route.ts`](../transport-client/app/api/bus/[id]/route.ts).

```json
{
 "id": "cmovfwlry0a5z14lnnytqzom2", "matricula": "ACI-004M",
 "via": "Rua do Cajueiro (Fedel Castro) - Estrada Circular", "viaId": "cmoveturn00xh14lnebtzwv1x",
 "direcao": "Rua do Cajueiro (Fedel Castro) → Farmácia", "velocidade": 30,
 "latitude": -25.8272469, "longitude": 32.5702499, "fonte": "horario", "direcaoGraus": 8.87,
 "posicaoEm": "2026-10-17T09:43:53.332Z", "status": "Em circulação",
 "routeCoords": [[32.549758, -25.839792], "… (238 itens)"],
 "stops": [{"id": "cmoverp1d00p714lng507qgbw", "nome": "Rua do Cajueiro (Fedel Castro)", "latitude": -25.8398513,
            "longitude": 32.54965, "isTerminal": false, "isPickup": true, "isDestination": false}, "… (12 itens)"],
 "tempoEstimado": 42, "distancia": 15635, "jaPassou": true,
 "tempoViagem": 5, "distanciaViagem": 2336, "fare": 24
}
```

Aqui `distancia` é o que o **autocarro** ainda tem de andar até à origem, e `distanciaViagem` o da viagem. `jaPassou` é verdadeiro quando o autocarro já passou a origem e volta na volta seguinte. `posicaoEm` é a hora da posição GPS, ou do cálculo numa posição pela viagem. Num autocarro fora de serviço (o motorista não iniciou a viagem), `status` é `"Fora de serviço"`, `velocidade` 0, e `tempoEstimado`, `distancia`, `tempoViagem`, `distanciaViagem` e `fare` são `null`: um autocarro parado não tem hora de chegada.

Erros: 404 `Autocarro não encontrado`; 400 `Este transporte não tem via atribuída`.

#### `GET /api/simulation`, `POST /api/simulation`

`GET` dá o mesmo estado que `/api/startup`, com a última verificação de chegadas. Código: [`app/api/simulation/route.ts`](../transport-client/app/api/simulation/route.ts) e [`lib/busSimulator.ts`](../transport-client/lib/busSimulator.ts).

```json
{"success": true, "status": {"mode": "gps-or-driver-trip", "busCount": 6, "inService": 4, "withFreshGps": 0, "following": 1,
 "lastArrivalCheck": {"checkedAt": "2026-10-27T19:02:00.306Z", "missions": 0, "notified": 0, "journeys": 0}}}
```

| Campo | Significado |
|---|---|
| `busCount` | veículos das rotas activas |
| `inService` | desses, os que estão em viagem (o motorista iniciou-a) |
| `withFreshGps` | os que enviaram GPS nos últimos 3 minutos |
| `following` | viagens acompanhadas por SMS ainda a decorrer ([`Acompanhamento`](glossario.md#a-rede-e-as-pessoas "Uma viagem acompanhada por SMS: os avisos de cada autocarro até ao destino") sem `terminadoEm`) |
| `lastArrivalCheck` | a última verificação nesta instância: alertas de paragem lidos (`missions`), SMS enviados (`notified`), e desses os avisos das viagens acompanhadas (`journeys`); `null` antes da primeira |

`POST {"action": "check"}` corre já a verificação de chegadas e responde com `notified` (SMS enviados) e o estado. Outra acção responde 400. O endpoint é público, mas a verificação só envia os SMS que estão na hora, e nunca o mesmo duas vezes. Um pedido agendado externo deve chamá-lo a cada minuto ([Guia do cron-job.org](guia-cron-job.md)); o [GitHub Actions](conceitos.md#ci "Verificações que o GitHub corre sozinho a cada pull request, para nenhum erro conhecido chegar ao main.") também, como reserva ([Fluxos de dados → Alerta de chegada](fluxos-de-dados.md#alerta-de-chegada-e-sms)).

### Conta do passageiro

A entrada e o registo devolvem um token válido 90 dias. Cada chamada `/api/user/*` envia-o como `Authorization: Bearer <token>` e só chega aos dados do dono do token; o resto responde 401 `Sessão inválida ou expirada. Entre de novo.` ([Segurança → Passageiros](seguranca.md#passageiros)). Código: [`app/api/auth`](../transport-client/app/api/auth), [`app/api/user`](../transport-client/app/api/user) e [`lib/userSession.ts`](../transport-client/lib/userSession.ts).

#### `POST /api/auth/register`

`{"nome", "email", "telefone", "senha"}`; a palavra-passe precisa de pelo menos 6 caracteres. O telefone guarda-se sem espaços, com `+258` à frente de um número móvel moçambicano ([`lib/phones.ts`](../transport-client/lib/phones.ts)). Um telefone que já tem uma conta USSD sem palavra-passe completa essa conta. Responde como a entrada.

Erros (400): campo em falta; `A senha deve ter no mínimo 6 caracteres`; `Este número de telefone já está registado`; `Este email já está registado`. 500 `Sessão indisponível. Tente mais tarde.` quando falta `USER_SESSION_SECRET` em produção.

#### `POST /api/auth/login`

`{"telefone": "849990777", "senha": "…"}`. O telefone compara-se pelos algarismos, com ou sem `+258` e espaços (`84 999 0777`, `+258849990777`).

```json
{"success": true, "utente": {"id": "cmvbi8o050004rhtj7h310jh9", "nome": "Ana Demo", "email": "ana.demo@local.test",
 "telefone": "849990777", "subscrito": true, "createdAt": "2026-10-16T21:53:47.909Z",
 "token": "cmvbi8o050004rhtj7h310jh9.1800006233.TKuBsQa1…"}}
```

Erros: 400 campo em falta; 401 `Telefone ou senha incorretos`; 401 `Este número ainda não tem senha. Faça o registo para criar uma.` (conta só de USSD).

#### `GET /api/user/{id}`, `PUT /api/user/{id}`

`GET` devolve o perfil: `id`, `nome`, `email`, `telefone`, `mISSION`, `subscrito`, `dataSubscricao`, `createdAt`. `PUT {"nome"}` muda o nome e devolve o perfil. `{id}` tem de ser o passageiro do token.

#### `POST /api/user/{id}/change-password`

`{"currentPassword", "newPassword"}` (pelo menos 6 caracteres) → `{"success": true, "message": "Senha alterada com sucesso"}`. 401 `Senha atual incorreta`.

#### `GET /api/user/missions`

Os alertas de chegada do passageiro, os mais recentes primeiro:

```json
{"missions": [{"id": "cmvbi8o0w0006rhtjp4m58zy1", "mISSIONUtente": "USER-1792226227453", "codigoParagem": "PAR-0906",
  "geoLocationParagem": "-25.8398513,32.54965", "createdAt": "2026-10-17T08:20:00.000Z",
  "notificadoEm": "2026-10-17T09:29:34.496Z", "utenteId": "cmvbi8o050004rhtj7h310jh9", "paragemId": "cmoverp1d00p714lng507qgbw",
  "paragem": {"nome": "Rua do Cajueiro (Fedel Castro)", "codigo": "PAR-0906", "geoLocation": "-25.8398513,32.54965"}}]}
```

`notificadoEm` é quando saiu o último SMS de chegada desse alerta.

#### `POST /api/user/missions/save`

`{"transporteId", "paragemId"}`: esperar por um autocarro nesta paragem. Cria o alerta, ou recomeça um que já exista para a mesma paragem (`createdAt` novo, `notificadoEm` limpo): `{"message": "Transporte adicionado aos seus favoritos" | "Transporte já está nos seus favoritos", "missao": {…}}`.

#### `DELETE /api/user/missions/{id}`

Apaga um dos alertas do passageiro → `{"message": "Missão removida com sucesso"}`. 404 se não existe ou é de outra pessoa.

### Motorista

Os quatro respondem `Access-Control-Allow-Origin: *` e `OPTIONS` 204, porque o portal do motorista está noutro domínio. O token da sessão (30 dias) vai em `Authorization: Bearer`. Código: [`app/api/driver`](../transport-client/app/api/driver), [`lib/driverSession.ts`](../transport-client/lib/driverSession.ts) e [`lib/driverProfile.ts`](../transport-client/lib/driverProfile.ts).

#### `POST /api/driver/login`

`{"telefone": "871831581", "password": "<PIN>"}`. O telefone coincide seja qual for o formato guardado (`+258 87 183 1581`).

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
                       "geoLocation": "-25.8398116,32.5497614", "isTerminal": true}, "… (12 itens)"]}
}
```

`via.paragens` vêm pela ordem de viagem. Erros: 400 campo em falta; 401 `Motorista não encontrado. Contacte o administrador.`, `Ainda não tem PIN. Peça ao administrador para gerar o seu PIN.`, `PIN incorreto`; 500 `Sessão indisponível. Contacte o administrador.` (sem `DRIVER_SESSION_SECRET`).

#### `GET /api/driver/me`

O motorista com sessão, como a base de dados o tem agora: o mesmo objecto da resposta da entrada, sem `token`. O portal pede-o ao abrir e a cada 5 minutos, para um veículo ou uma rota novos definidos no painel aparecerem sem sair da conta. 401 `Sessão inválida ou expirada. Entre de novo.`; 404 `Motorista não encontrado` (o motorista foi apagado).

#### `GET /api/driver/trip`, `POST /api/driver/trip`

O estado da viagem do motorista, com o autocarro como os passageiros o vêem agora (a mesma posição e o mesmo estado da web e do USSD). Código: [`app/api/driver/trip/route.ts`](../transport-client/app/api/driver/trip/route.ts).

```json
{"emViagem": true, "viagemIniciadaEm": "2026-10-27T18:32:19.620Z",
 "autocarro": {"lat": -25.9589704554329, "lng": 32.58434848158363, "direcao": 32.69, "fonte": "horario",
   "estado": "Em circulação", "velocidade": 30, "sentido": "Praça dos Combatentes",
   "proximas": [{"nome": "Coop", "minutos": 1}, {"nome": "Esquina OMM", "minutos": 1}, {"nome": "OMM", "minutos": 2}]}}
```

`autocarro` é `null` quando o motorista não tem veículo ou a rota está desactivada. `estado` é `"Em circulação"`, `"No terminal"` ou `"Fora de serviço"`; `proximas` são as 3 paragens seguintes (vazio fora de serviço). O `GET` também dispara a verificação de chegadas (no máximo a cada 30 s por instância).

`POST {"action": "iniciar"}` ou `{"action": "encerrar"}` → o estado novo, no mesmo formato. Iniciar uma viagem já iniciada mantém a hora de início. Erros: 400 noutra acção; 401 `Sessão inválida ou expirada. Entre de novo.`; 404 `Motorista não encontrado`; 409 quando a viagem não pode começar: `Não tem veículo atribuído. Peça ao administrador.`, `O seu veículo não tem rota. Peça ao administrador.` ou `A rota do seu veículo está desactivada. Peça ao administrador.`

#### `GET /api/driver/seguidores`

Os passageiros à espera ao longo da rota do motorista, por paragem e pela ordem de viagem: os alertas de chegada da web das últimas 3 horas, e as viagens acompanhadas por SMS cujo passageiro espera um autocarro desta rota nessa paragem.

```json
{"total": 3, "paragens": [{"nome": "Rua do Cajueiro (Fedel Castro)", "aEspera": 0}, {"nome": "Rua do Cajueiro (Fedel Castro)", "aEspera": 1}, "… (12 itens)"]}
```

### GPS

#### `GET|POST /api/gps`

Posições do dispositivo de um veículo, autenticadas pelo [código do dispositivo](conceitos.md#rastreador "Um aparelho (ou um telemóvel com uma aplicação) que envia a posição de um veículo pela internet; o código do dispositivo é a sua 'palavra-passe'.") (`?id=` ou `Authorization: Bearer`). O protocolo completo, os nomes alternativos dos campos, as unidades e as regras estão em [Localização e GPS → Protocolo](localizacao-gps.md#protocolo). Código: [`app/api/gps/route.ts`](../transport-client/app/api/gps/route.ts).

| Pedido | Resposta |
|---|---|
| `GET /api/gps?id=<código>&lat=-25.8305&lon=32.5693&speed=12&bearing=80&timestamp=1792230233` | 200 `{"ok": true}` (guardada; 12 nós = 22,2 km/h) |
| `POST` JSON com uma hora mais antiga do que a última posição | 200 `{"ok": true, "ignored": "posição mais antiga do que a última"}` |
| código desconhecido | 401 `{"error": "Dispositivo desconhecido"}` |

### USSD

#### `POST /api/ussd`

O [callback](conceitos.md#callback "Um endereço que se dá a outro serviço para ele chamar sempre que algo acontece.") da [Africa's Talking](conceitos.md#africas-talking "O gateway de USSD e SMS usado por este projecto."). Recebe em formulário `sessionId`, `serviceCode`, `phoneNumber`, `text`; responde `text/plain`. Com `USSD_CALLBACK_KEY` definida, o URL tem de levar `?key=<valor>`, senão 403 ([Segurança → Resposta USSD](seguranca.md#resposta-ussd-callback)). O primeiro ecrã (`text` vazio):

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

Todos os menus, com ecrãs reais, e como se lê o campo `text`, estão em [Serviço USSD](ussd.md).

---

## Painel de administração (`transport-admin`)

Sem um cookie `admin_session` válido, todos os endpoints abaixo, menos a entrada e a saída, respondem ([`proxy.ts`](../transport-admin/proxy.ts)):

```http
HTTP/1.1 401 Unauthorized

{"error": "Sessão expirada. Inicie sessão novamente."}
```

### Sessão

| Endpoint | Corpo | Resposta |
|---|---|---|
| `POST /api/auth/admin/login` | `{"email", "senha"}` | o perfil, e `Set-Cookie: admin_session=…; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax` (`Secure` em produção); 401 `Email ou senha incorretos`; 500 sem `ADMIN_SESSION_SECRET` em produção |
| `GET /api/auth/admin/session` | | `{"admin": {"id", "nome", "email", "role": "admin"}}` |
| `POST /api/auth/admin/logout` | | apaga o cookie |

### Listas e registos

Cada entidade tem um endpoint de lista e um de registo (código em [`transport-admin/app/api`](../transport-admin/app/api), uma pasta por entidade):

| Entidade | Lista (`GET`, `POST`) | Registo (`GET`, alterar, `DELETE`) | Método para alterar |
|---|---|---|---|
| Províncias | `/api/provincias` | `/api/provincias/{id}` | `PATCH` |
| Municípios | `/api/municipios` | `/api/municipios/{id}` | `PATCH` |
| Rotas | `/api/vias` | `/api/vias/{id}` | `PATCH` |
| Paragens | `/api/paragens` | `/api/paragens/{id}` | `PATCH` |
| Veículos | `/api/transportes` | `/api/transportes/{id}` | `PUT` (todos os campos), `PATCH` (só a rota) |
| Motoristas | `/api/motoristas` | `/api/motoristas/{id}` | `PUT` |
| Proprietários | `/api/proprietarios` | `/api/proprietarios/{id}` | `PUT` |
| Passageiros | `/api/utentes` | `/api/utentes/{id}` | `PUT` |
| Administradores | `/api/administradores` | `/api/administradores/{id}` | `PATCH` |

**Parâmetros das listas:**

| Parâmetro | Listas | Significado |
|---|---|---|
| `page`, `limit` | todas menos veículos | número da página (a partir de 1) e tamanho; 10 por omissão (passageiros e administradores: 25) |
| `limit` | veículos | número máximo de linhas; 1000 por omissão |
| `search` | todas | filtro de texto; sem distinguir maiúsculas, menos nos proprietários. As rotas também coincidem pelo município; os veículos pela matrícula, modelo, marca e nome da rota; os motoristas pelo nome, BI, carta e telefone. Nos motoristas e passageiros, uma pesquisa só de algarismos (pelo menos 3, com espaços, `+` e `-` permitidos) também coincide com os algarismos do telefone, seja qual for o espaçamento guardado, com ou sem `258` ([`lib/phoneSearch.ts`](../transport-admin/lib/phoneSearch.ts)). |
| `countOnly=true` | províncias, municípios, rotas, paragens, motoristas, proprietários | só as contagens, por exemplo `{"total": 91}` |
| `ativa` | rotas | `true` só as activas (as que os passageiros vêem), `false` só as desactivadas; sem ele, todas. A página "Vias" envia `ativa=true` por omissão. As activas vêm primeiro. |
| `filter` | motoristas | `ativos`, `inativos` ou `comTransporte` |
| `availableOnly=true`, `includeTransportId` | veículos | veículos sem motorista (e mais um veículo dado), para o formulário do motorista |

As listas paginadas respondem `{"data": [...], "pagination": {"page", "limit", "total", "totalPages"}}`; a lista de veículos responde `{"data": [...], "total": n}`. A lista de rotas junta `"totals": {"transportes", "paragens"}` sobre todas as rotas que coincidem com a pesquisa. `GET /api/vias?limit=1&search=matola` (que coincide com o município):

```json
{"data": [{"id": "cmovetglw00w314lng0gzjlh2", "nome": "120 - Avenida Eduardo Mondlane", "codigo": "V038", "cor": "#F4A261",
  "terminalPartida": "120", "terminalChegada": "Avenida Eduardo Mondlane", "geoLocationPath": "32.433702,-25.89366;…",
  "municipioId": "cmovaprzr000113rkhmw2aazp", "municipio": {"nome": "Matola"}, "_count": {"paragens": 43, "transportes": 1}}],
 "pagination": {"page": 1, "limit": 1, "total": 70, "totalPages": 70}, "totals": {"transportes": 84, "paragens": 2997}}
```

**Apagar.** Os registos com dependentes são recusados com 400 e o motivo em `error` e `details`. Porquê recusar: apagar em cascata sem aviso deixaria, por exemplo, veículos sem motorista sem ninguém saber.

| Entidade | Recusado enquanto | `?force=true` (enviado pelas páginas do painel) | Também apaga |
|---|---|---|---|
| Província | tem municípios | primeiro solta os municípios (`provinciaId = NULL`) | |
| Município | tem rotas (ou paragens através delas) | não aceite: todas as rotas precisam de um município | |
| Veículo | tem motorista ou proprietário | | as suas linhas `GeoLocation` importadas |
| Motorista | está atribuído a um veículo | primeiro retira-o do veículo | |
| Proprietário | tem veículos | primeiro apaga as ligações proprietário–veículo | |
| Passageiro | tem alertas de chegada | primeiro apaga os alertas | |
| Rota | | | as ligações às paragens; os seus veículos ficam sem rota (`viaId = NULL`) |
| Paragem | | | as ligações às rotas e os alertas de chegada nela (`{"success": true, "alertasRemovidos": n}`) |

As palavras-passe e os PIN nunca se devolvem: as consultas de administradores e passageiros deixam `senha` de fora, e o cliente Prisma do painel omite `Motorista.password` em todas as consultas ([Segurança → Painel de administração](seguranca.md#painel-de-administração)).

### Rotas

#### `PATCH /api/vias/{id}`

Muda os campos enviados; os outros ficam. Código: [`app/api/vias/[id]/route.ts`](../transport-admin/app/api/vias/[id]/route.ts).

| Campo | Significado |
|---|---|
| `nome`, `terminalPartida`, `terminalChegada`, `cor`, `municipioId` | os dados da rota |
| `geoLocationPath` | um percurso novo: `"lng,lat;lng,lat;…"` ou `[[lng, lat], …]`, guardado como `lng,lat` com 6 casas decimais. Menos de dois pontos válidos: 400 `{"error": "O percurso da via precisa de pelo menos dois pontos válidos"}`. O painel só envia um percurso pelas estradas ([Painel → Redesenhar o percurso de uma rota](painel-admin.md#tarefa-redesenhar)). |
| `ativa` | `true` ou `false`: a rota aparece ou não aos passageiros (web, USSD, SMS). `{"ativa": false}` desactiva-a sem apagar nada ([Painel → Activar ou desactivar rotas](painel-admin.md#tarefa-activar-rotas)). |
| `paragensIds` | as paragens da rota passam a ser exactamente esta lista. As ligações a paragens que continuam na lista ficam como estão (com a marca de terminal); as outras apagam-se e criam-se as novas. |

`{"geoLocationPath": "32.57,-25.95;32.575,-25.955;32.6,-25.97"}` responde a rota actualizada com as suas paragens e contagens; 404 numa rota desconhecida.

### Veículos

#### `PATCH /api/transportes/{id}`

`{"viaId": "<id da rota>"}` põe o veículo numa rota; `{"viaId": null}` tira-o. Responde `{"id", "matricula", "viaId", "codigoVia"}`; 404 num veículo ou rota desconhecidos.

#### `GET /api/transportes/estado`

O que cada veículo está a fazer agora, para a coluna "Agora" da lista de veículos e o cartão "Agora" do início:

```json
{"cmozbuqta00189ounhmm7x4d6": {"estado": "circulacao", "gps": false}, "…": {"estado": "terminal", "gps": false}}
```

`estado` é `circulacao`, `terminal`, `fora-de-servico` (o motorista não iniciou a viagem) ou `sem-posicao`.

#### `GET /api/transportes/{id}/posicao`

```json
{"latitude": -25.8305, "longitude": 32.5693, "fonte": "gps", "emMovimento": true, "foraDeServico": false,
 "velocidadeKmh": 22.2, "atualizadoEm": "2026-10-17T09:43:53.000Z", "proximaParagem": "Farmácia", "minutosAteProxima": 33}
```

#### `GET /api/transportes/{id}/operacao`

A viagem em curso do veículo, desde que o motorista a iniciou:

```json
{"comprimentoKm": 6.2, "minutosPorSentido": 12, "paragens": 63, "ida": "Museu (X15)", "volta": "Xipamanine (X19)",
 "emViagem": true, "iniciadaEm": "2026-10-27T18:40:19.620Z", "horasHoje": 0.4, "kmHoje": 8, "viagensHoje": 1,
 "porHora": [{"hora": "20h", "km": 7, "kmAcumulado": 7, "viagens": 1}, {"hora": "21h", "km": 1, "kmAcumulado": 8, "viagens": 0}],
 "passagens": [{"nome": "Xipamanine (X19)", "km": 0, "ida": "2026-10-27T19:15:02.098Z", "volta": "2026-10-27T19:10:02.098Z"}, "… (63 itens)"]}
```

`horasHoje`, `kmHoje` e `viagensHoje` (chegadas a um terminal) contam desde `iniciadaEm`. `passagens` são as próximas passagens em cada paragem para cada terminal (`ida` para o último terminal da rota, `volta` de regresso). Sem viagem (`emViagem: false`), os números são 0, `porHora` vem vazio e `ida`/`volta` de cada passagem são `null`.

#### `GET|POST|DELETE /api/transportes/{id}/gps`

Código: [`app/api/transportes/[id]/gps/route.ts`](../transport-admin/app/api/transportes/[id]/gps/route.ts).

| Método | Resposta |
|---|---|
| `GET` | `{"configurado": true, "ultimaPosicaoEm": "2026-10-17T09:43:53.000Z", "ativo": true, "velocidadeKmh": 22.2, "servidor": "https://transport-mz.vercel.app/api/gps"}` |
| `POST` | um código de dispositivo novo, mostrado uma só vez: `{"codigo": "<20 caracteres>", "servidor": "…"}` |
| `DELETE` | revoga o código e limpa os campos de GPS: `{"ok": true}` |

#### Atribuir pessoas a um veículo

| Endpoint | Corpo |
|---|---|
| `POST /api/transportes/{id}/atribuir-motorista` | `{"motoristaId"}` |
| `DELETE /api/transportes/{id}/atribuir-motorista` | retira o motorista |
| `POST /api/transportes/{id}/atribuir-proprietario` | `{"proprietarioId"}` (junta um proprietário) |
| `DELETE /api/transportes/{id}/atribuir-proprietario`, `POST`/`DELETE /api/transportes/{id}/proprietario` | retiram ou definem a ligação ao proprietário |

### Motoristas

#### `GET|POST|DELETE /api/motoristas/{id}/pin`

Código: [`app/api/motoristas/[id]/pin/route.ts`](../transport-admin/app/api/motoristas/[id]/pin/route.ts).

| Método | Resposta |
|---|---|
| `GET` | `{"definido": true}` |
| `POST` | um PIN novo de 6 algarismos, mostrado uma só vez: `{"pin": "123456"}`. Guarda o seu [hash](conceitos.md#hash "Uma 'impressão digital' de um texto, que se calcula num sentido e não se consegue desfazer.") bcrypt; o PIN anterior deixa de funcionar. |
| `DELETE` | apaga o PIN (o motorista deixa de poder entrar): `{"definido": false}` |

#### `GET|POST|DELETE /api/motoristas/atribuir`

`GET` lista os veículos sem motorista e os motoristas activos sem veículo; `POST {"motoristaId", "transporteId"}` junta-os; `DELETE` desfaz um par.

### Regra de tarifa

#### `GET|PUT /api/tarifa`

A regra de tarifa activa ([`Tarifa`](glossario.md#a-rede-e-as-pessoas "A regra de tarifa: preço mínimo, preço por km e velocidades")), que todas as tarifas, tempos de viagem e posições dos autocarros em viagem usam ([Configuração → Regra de tarifa](configuracao.md#regra-de-tarifa-tarifa)). A página "Tarifa" lê-a e grava-a ([Painel → Tarifa](painel-admin.md#tarifa)). Código: [`app/api/tarifa/route.ts`](../transport-admin/app/api/tarifa/route.ts).

`GET` → a regra, `{"id", "nome": "padrao", "tarifaMinima": 10, "precoPorKm": 10, "fatorEstrada": 1.3, "velocidadeViagemKmh": 30, "velocidadeChegadaKmh": 45, "ativa": true, "createdAt", "updatedAt"}`; 404 `Não há tarifa activa` quando nenhuma linha está activa.

`PUT` com qualquer dos cinco valores actualiza a regra activa (a linha activa alterada mais recentemente), ou cria `padrao` quando não há nenhuma, e responde a linha gravada:

| Campo | Aceite |
|---|---|
| `tarifaMinima` | meticais inteiros, de 0 a 1000 |
| `precoPorKm` | meticais por km, de 0 a 1000 |
| `velocidadeViagemKmh`, `velocidadeChegadaKmh` | km/h, de 5 a 120 |
| `fatorEstrada` | de 1 a 3 |

Um valor fora do intervalo responde 400 com a regra do campo, por exemplo `Tarifa mínima: indique um número inteiro entre 0 e 1000`; um corpo sem nenhum dos campos responde 400 `Nada para alterar`. A aplicação dos passageiros e o USSD lêem a regra através de uma cache de 60 segundos ([`lib/fares.ts`](../transport-client/lib/fares.ts)), e por isso uma alteração demora até um minuto a chegar a todas as instâncias.

### Administradores

#### `POST /api/administradores/{id}/change-password`

`{"currentPassword", "newPassword"}` muda a palavra-passe do administrador (a página "Perfil"). A nova precisa de pelo menos 6 caracteres e guarda-se como hash bcrypt.

| Resposta | Quando |
|---|---|
| 200 `{"success": true, "message": "Senha alterada com sucesso"}` | mudou |
| 400 | falta um campo, ou a nova tem menos de 6 caracteres |
| 401 `{"error": "Senha atual incorreta"}` | a palavra-passe actual está errada |
| 404 | nenhum administrador com esse id |

### Estatísticas

| Endpoint | Conteúdo |
|---|---|
| `GET /api/dashboard/stats` | Tudo o que o início do painel mostra menos o cartão "Agora": contadores (`vias` conta só as rotas activas), veículos por município, as rotas activas com o percurso e o número de veículos, rotas e paragens por município. Em cache 5 minutos por instância. |
| `GET /api/relatorios/stats` | O relatório "Estatísticas Gerais": `{"totalTransportes": 451, "totalVias": 261, "totalParagens": 1902, "totalProprietarios": 11, "totalMotoristas": 451, "totalProvincias": 11, "totalMunicipios": 2, "totalUtentes": 8, "transportComMotorista": 451, "transportSemMotorista": 0, "motoristasAtivos": 451, "utentesSubscritos": 6}` (produção, 2026-10-18) |

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Segurança](seguranca.md) · [Índice](README.md) · Seguinte: [Mapa do código](mapa-do-codigo.md)
<!-- /navegação-fim -->
