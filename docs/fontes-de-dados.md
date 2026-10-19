# Fontes de dados

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 1. Conhecer o projecto › **Fontes de dados** (página 3 de 23)

Anterior: [Glossário](glossario.md) · [Índice](README.md) · Seguinte: [Estado do projecto](estado-do-projecto.md)

<details>
<summary>Todas as páginas</summary>

- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · **Fontes de dados** · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

De onde veio cada dado da plataforma, como foi trazido, com que licença, e o que é inventado. Ler antes de apresentar os dados como reais, ou antes de substituir uma parte deles.

**Nesta página:** [Resumo](#resumo) · [Paragens e rotas](#paragens-e-rotas) · [Percursos pelas estradas](#percursos-pelas-estradas) · [Províncias e municípios](#províncias-e-municípios) · [Veículos, motoristas e proprietários](#veículos-motoristas-e-proprietários) · [Passageiros](#passageiros) · [Regra de tarifa](#regra-de-tarifa) · [Dados produzidos em funcionamento](#dados-produzidos-em-funcionamento) · [Mapas no ecrã](#mapas-no-ecrã) · [Serviços](#serviços) · [Software](#software) · [Ficheiros de referência](#ficheiros-de-referência-no-repositório) · [Créditos a mostrar](#créditos-a-mostrar)

---

## Resumo

Produção em 2026-10-18:

| Dados | Linhas | Fonte | Real ou inventado | Licença |
|---|---|---|---|---|
| Paragens (`Paragem`) | 1 079 `PAR-…` | Uma exportação do OpenStreetMap de paragens de autocarro, com nome por geocodificação inversa (Nominatim) | Sítios reais; o nome é o da rua mais próxima | ODbL |
| | 823 `OSM-…` | OpenStreetMap, pela API Overpass | Reais, como os contribuidores do OpenStreetMap as mapearam | ODbL |
| Rotas (`Via`) | 91 (`V…` e `VIA-…`) | Os primeiros scripts de dados, à semelhança das rotas da EMTPM | Rotas plausíveis, não uma lista oficial | |
| | 170 (refs do OSM como `X12`, `C5`, `503`) | Relações de rota do OpenStreetMap (redes Chapas, EMTPM, Corujas, REM, RCM) | Reais, como mapeadas | ODbL |
| Percursos das rotas | 261 | Caminhos do OSRM nas estradas do OpenStreetMap (servidores FOSSGIS e de demonstração do OSRM) | Calculados | ODbL (as estradas) |
| Províncias / municípios | 11 / 2 | Escritos pelos primeiros scripts de dados | Nomes reais (as 11 províncias de Moçambique; Maputo, Matola) | |
| Veículos (`Transporte`) | 111 | Os primeiros scripts de dados | Inventados | |
| | 340 `ADA-001M`–`ADA-340M` | `import-osm.mjs --buses` | Inventados | |
| Motoristas (`Motorista`) | 111 | Os primeiros scripts de dados, com fotografias de banco de imagens (Pexels) | Inventados | Licença Pexels (fotografias) |
| | 340 | `add-drivers.mjs`, listas de nomes moçambicanos | Inventados | |
| Proprietários (`Proprietario`) | 11 | Os primeiros scripts de dados | Inventados | |
| Passageiros (`Utente`) | poucos | Pessoas que se registaram na web ou usaram o USSD durante os testes | Contas reais | dados pessoais ([Segurança](seguranca.md)) |
| Regra de tarifa (`Tarifa`) | 1 | Escolhida pela equipa (10 MT mínimo, 10 MT/km, 30 km/h) | Uma suposição, não um tarifário oficial | |

## Paragens e rotas

### Os primeiros dados (2026, antes de o código vir para este repositório)

- **Paragens.** [`maputo-stops-data.json`](../maputo-stops-data.json) (1 346 linhas) e [`matola-stops-data.json`](../matola-stops-data.json) (691 linhas), na raiz do repositório, são exportações do OpenStreetMap separadas por tabulações (`@id @lat @lon name`), apesar da extensão `.json`. O script [`transport-admin/scripts/seed-with-geocoding.js`](https://github.com/transportmozambique/Transport-Mozambique/blob/bd007cf/transport-admin/scripts/seed-with-geocoding.js) (apagado em 2026-10-19 com o [código antigo](visao-geral.md#código-antigo-apagado)) leu-as, tirou os duplicados e deu nome a cada paragem pela geocodificação inversa do **Nominatim** (`nominatim.openstreetmap.org/reverse`, um pedido por segundo, como a política de uso do Nominatim exige): a paragem fica com o nome da sua rua ou do sítio. É por isso que muitas paragens partilham o nome de uma rua ([Limitações → Dados](limitacoes.md#dados)). São as 1 079 paragens com código `PAR-`.
- **Rotas.** [`transport-admin/reorganize-vias-emtpm-routes.js`](https://github.com/transportmozambique/Transport-Mozambique/blob/bd007cf/transport-admin/reorganize-vias-emtpm-routes.js) e os outros `reorganize-vias-*.js` da raiz de `transport-admin` (apagados em 2026-10-19, no histórico do git) criaram 91 rotas à semelhança das rotas da **EMTPM** (Empresa Municipal de Transporte Público de Maputo) e dos corredores de chapas entre Maputo e a Matola, e ligaram as paragens a menos de 50 m de cada uma. 70 têm códigos `V…` e 21 códigos `VIA-…`. As suas linhas foram desenhadas de paragem em paragem e depois postas nas estradas em 2026-10 ([Percursos pelas estradas](#percursos-pelas-estradas)).

### Importação do OpenStreetMap (2026-10-18)

[`transport-client/scripts/import-osm.mjs`](../transport-client/scripts/import-osm.mjs), passo a passo em [Base de dados → Importar do OpenStreetMap](base-de-dados.md#importar-paragens-e-rotas-do-openstreetmap). Porquê o OpenStreetMap: é a fonte aberta mais completa das rotas de chapas e da EMTPM, mantida por pessoas que as usam, e a licença permite reutilizar os dados com atribuição.

| | |
|---|---|
| Fonte | A **API Overpass**, o serviço de consulta só de leitura do OpenStreetMap: `overpass-api.de`, com `maps.mail.ru` e `overpass.private.coffee` de recurso |
| Área | Rectângulo -26.10, 32.30 a -25.70, 32.75: Maputo, Matola, Boane e Marracuene |
| Paragens | Nós com `highway=bus_stop`, `public_transport=platform` ou `stop_position` com `bus=yes`, e `amenity=bus_station` |
| Rotas | Relações `type=route` com `route=bus`, `minibus`, `share_taxi` ou `trolleybus`, das redes que o OpenStreetMap marca como Chapas, EMTPM, Corujas, REM e RCM |
| Juntado | 823 paragens (códigos `OSM-`), 170 rotas (4 421 km), 13 975 ligações rota–paragem, e 651 paragens ligadas a 35 rotas existentes |
| Descarga | `osm-data/` (fora do git), para a mesma descarga poder ser importada outra vez |

**Licença.** Os dados do OpenStreetMap são © contribuidores do OpenStreetMap, sob a [Open Database License](https://www.openstreetmap.org/copyright) (ODbL). Usá-los nas aplicações é permitido com o crédito que os mapas mostram. Uma base de dados derivada e partilhada publicamente tem de ser partilhada também sob a ODbL.

## Percursos pelas estradas

O `geoLocationPath` de cada rota segue as estradas. Os percursos foram calculados, não desenhados à mão:

- **OSRM** (Open Source Routing Machine) em dois servidores públicos: o da FOSSGIS (`routing.openstreetmap.de`, perfis de carro e a pé, mantido pela associação FOSSGIS para a comunidade OpenStreetMap) e o servidor de demonstração do projecto OSRM (`router.project-osrm.org`). Os dois calculam caminhos nas estradas do OpenStreetMap e só permitem uso leve, um pedido por segundo.
- [`transport-client/scripts/snap-paths.mjs`](../transport-client/scripts/snap-paths.mjs) pôs nas estradas os troços rectos das primeiras rotas, e [`redraw-from-osm.mjs`](../transport-client/scripts/redraw-from-osm.mjs) reconstruiu as rotas do OpenStreetMap cuja relação estava fora de ordem. As respostas ficam em `osm-data/road-cache.json` ([`roads.mjs`](../transport-client/scripts/roads.mjs); [Base de dados → Pôr os percursos nas estradas](base-de-dados.md#pôr-os-percursos-das-rotas-nas-estradas)).
- Uma rota desenhada no painel ("Nova Via", "Redesenhar percurso") pergunta aos mesmos dois servidores, a partir do navegador do administrador ([`RouteDrawer.tsx`](../transport-admin/app/components/RouteDrawer.tsx)).
- As caminhadas no mapa dos passageiros desenham-se com o router a pé da FOSSGIS, pedido pelo servidor da aplicação ([`/api/walk`](../transport-client/app/api/walk/route.ts)).

Porquê percursos pelas estradas e não linhas entre paragens: a distância ao longo da estrada dá a tarifa e o tempo de viagem; uma linha recta daria valores errados e desenharia autocarros a atravessar quarteirões.

## Províncias e municípios

As 11 províncias de Moçambique (Maputo Cidade, Maputo, Gaza, Inhambane, Sofala, Manica, Tete, Zambézia, Nampula, Cabo Delgado, Niassa) e os municípios de Maputo e da Matola foram escritos pelos primeiros scripts de dados ([`transport-admin/scripts/seed-provincias.js`](https://github.com/transportmozambique/Transport-Mozambique/blob/bd007cf/transport-admin/scripts/seed-provincias.js), apagado em 2026-10-19, e as sementes), com um ponto central cada. Cada rota pertence a um dos dois municípios. `Cidade` está vazia.

## Veículos, motoristas e proprietários

**São todos inventados**, para demonstrar a plataforma. Nenhum registo é um veículo, uma pessoa ou uma empresa reais.

| Linhas | Feitas por | O quê |
|---|---|---|
| 111 veículos | os primeiros scripts de dados | Minibuses e autocarros Toyota, Mercedes-Benz, Mitsubishi, Volkswagen, Nissan, Isuzu e Hyundai, com matrículas inventadas (`ACI-004M`…), um por rota inicial ou mais |
| 340 veículos | `import-osm.mjs --buses 2` | Toyota Hiace (15 lugares) para chapas, Mercedes-Benz Sprinter (22) para a EMTPM e os Corujas, matrículas `ADA-001M` a `ADA-340M` |
| 111 motoristas | os primeiros scripts de dados | Nomes, números de BI e de carta, telefones e emails `@transport.co.mz` inventados. As fotografias são retratos de banco de imagens do **Pexels** (`images.pexels.com`), de uso livre sob a [licença Pexels](https://www.pexels.com/license/); não mostram as pessoas nomeadas. |
| 340 motoristas | [`transport-client/scripts/add-drivers.mjs`](../transport-client/scripts/add-drivers.mjs) | Nomes próprios e apelidos moçambicanos comuns, combinados com uma semente fixa (2026) para os mesmos dados darem sempre os mesmos motoristas; sem fotografia ([Base de dados → Motoristas para os veículos importados](base-de-dados.md#motoristas-para-os-veículos-importados)) |
| 11 proprietários | os primeiros scripts de dados | Empresas de transporte inventadas; nenhuma ligada a um veículo ainda |

Os números de telefone estão no formato moçambicano (`+258 8x …`). Alguns podem, por acaso, ser de pessoas reais: nunca enviar SMS para os números dos motoristas dos dados de demonstração.

## Passageiros

As linhas de `Utente` são criadas por pessoas: ao registar-se na aplicação web, ou ao usar a opção 1 do USSD, que cria uma conta sem palavra-passe para o número de telefone. As de produção foram criadas na web e por USSD durante o desenvolvimento e os testes. São dados pessoais ([Segurança](seguranca.md)).

## Regra de tarifa

A única linha de `Tarifa`, `padrao`, tem valores escolhidos pela equipa, não um tarifário oficial: 10 MT mínimo, 10 MT por km ao longo da rota, autocarros a 30 km/h, 45 km/h para a estimativa de chegada nas rotas sem percurso, e um factor de estrada de 1,3. Mudam-se na página "Tarifa" do painel ([Painel de administração → Tarifa](painel-admin.md#tarifa)).

## Dados produzidos em funcionamento

| Dados | Produzidos por |
|---|---|
| Posições dos autocarros sem GPS | Calculadas a partir do percurso da rota, da hora do dia e da velocidade da tarifa (o modelo de horário, [Localização e GPS](localizacao-gps.md#como-se-escolhe-uma-posição)). Não é um horário publicado. |
| Posições GPS | Rastreadores, a aplicação Traccar Client, ou o portal do motorista num telemóvel, por `POST /api/gps`. Nenhum envia em produção ainda. |
| Horas de chegada, viagens, tarifas | Calculadas a cada pedido a partir do que está acima e da regra de tarifa. |
| Alertas de chegada (`MISSION`) | Passageiros, na web ou por USSD. |
| Estado da viagem (`emViagem`) | Motoristas, no portal ou por USSD. |

## Mapas no ecrã

| Uso | Fonte | Condições |
|---|---|---|
| Mapa vectorial das três aplicações (MapLibre GL) | **OpenFreeMap** (`tiles.openfreemap.org`): estilos `liberty` e `positron` e mosaicos vectoriais `planet`, feitos com o esquema OpenMapTiles a partir dos dados do OpenStreetMap | Gratuito, sem chave; crédito à OpenFreeMap, OpenMapTiles e OpenStreetMap (o MapLibre mostra-o no canto de cada mapa) |
| Mapa raster em algumas páginas do painel (províncias, municípios, paragens e desenho de rotas) | **Servidor de mosaicos do OpenStreetMap** (`tile.openstreetmap.org`) | A [política de uso de mosaicos](https://operations.osmfoundation.org/policies/tiles/) da OpenStreetMap Foundation: uso leve, com crédito. Chega para poucos administradores; uma página pública com muito tráfego precisaria de outro fornecedor. |

## Serviços

| Serviço | Para quê | Plano |
|---|---|---|
| [Africa's Talking](https://africastalking.com) | Menus USSD e SMS ([Africa's Talking](africas-talking.md)) | Sandbox (testes) |
| [Vercel](https://vercel.com) | Alojamento das três aplicações ([Guia da Vercel](guia-vercel.md)) | Hobby (gratuito) |
| [Neon](https://neon.tech) | Base de dados PostgreSQL ([Guia da Neon](guia-neon.md)) | Gratuito |
| [GitHub](https://github.com/transportmozambique/Transport-Mozambique) | Código, pull requests, CI e o agendamento da verificação de chegadas (GitHub Actions) | Gratuito, repositório público |
| [Traccar Client](https://www.traccar.org/client/) | Aplicação gratuita e aberta para Android e iOS que transforma um telemóvel num rastreador GPS ([Localização e GPS](localizacao-gps.md#traccar-client-num-telemóvel)) | |
| Servidores OSRM da FOSSGIS e do projecto OSRM | Caminhos de carro e a pé ([Percursos pelas estradas](#percursos-pelas-estradas)) | Gratuitos, uso leve |
| API Overpass e Nominatim | Descargas únicas de dados do OpenStreetMap e de nomes de paragens, quando os dados foram feitos | Gratuitos, uso leve |

## Software

As principais bibliotecas abertas: Next.js e React (as três aplicações), Prisma (acesso à base de dados), MapLibre GL (mapas), Leaflet (a página de paragem do painel), Recharts (gráficos do painel), Tailwind CSS (estilos), bcryptjs (hashes de palavras-passe e PINs), o SDK `africastalking` para Node.js, e Playwright e Jest (testes). O portal do motorista usa a fonte Geist (Google Fonts, SIL Open Font License). As versões estão no `package.json` de cada aplicação.

## Ficheiros de referência no repositório

Vieram com o código original. Nenhum código em funcionamento os usa:

| Ficheiro | O que é |
|---|---|
| `transport-admin/app/components/TruRoute-USSD-XML-Interface-1.4.pdf`, `…-1_5.pdf`, `TruRoute-SMPP-Interface-1.7.8.pdf`, `SSMI-1_7_4.pdf` | Especificações de gateways USSD e SMS, guardadas de um plano anterior de gateway. A plataforma usa a Africa's Talking. |
| `maputo-stops-data.json`, `matola-stops-data.json` | As exportações de paragens descritas [acima](#os-primeiros-dados-2026-antes-de-o-código-vir-para-este-repositório). |

## Créditos a mostrar

Ao apresentar a plataforma ou os seus dados:

- **Mapas e dados:** "© contribuidores do OpenStreetMap" (ODbL), "© OpenFreeMap", "© OpenMapTiles". Os mapas já os mostram.
- **Caminhos:** "OSRM / FOSSGIS". As caminhadas do mapa dos passageiros e o desenho de rotas do painel já o mostram.
- **Dados de demonstração:** dizer que os veículos, os motoristas e os proprietários são inventados, e que as horas sem GPS são estimativas.

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Glossário](glossario.md) · [Índice](README.md) · Seguinte: [Estado do projecto](estado-do-projecto.md)
<!-- /navegação-fim -->
