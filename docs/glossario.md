# Glossário

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 1. Conhecer o projecto › **Glossário** (página 2 de 23)

Anterior: [Visão geral](visao-geral.md) · [Índice](README.md) · Seguinte: [Fontes de dados](fontes-de-dados.md)

<details>
<summary>Todas as páginas</summary>

- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · **Glossário** · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

O código, a base de dados e os ecrãs usam palavras portuguesas, algumas com um sentido próprio no projecto (`MISSION` é um alerta de chegada, `Via` é uma rota). Esta página explica cada termo, com o nome em inglês entre parênteses para quem procurar documentação externa. Os nomes das tabelas e campos estão escritos como no código.

**Nesta página:** [A rede e as pessoas](#a-rede-e-as-pessoas) · [Campos que precisam de explicação](#campos-que-precisam-de-explicação) · [Palavras dos ecrãs](#palavras-dos-ecrãs) · [Transportes em Maputo](#transportes-em-maputo) · [Termos técnicos](#termos-técnicos)

---

## A rede e as pessoas

Cada tabela está definida em [`prisma/schema.prisma`](../prisma/schema.prisma); os campos todos estão em [Base de dados → Tabelas](base-de-dados.md#tabelas).

| Tabela | O que é |
|---|---|
| `Via` (route) | Uma rota de autocarro: código (`214`, `C9`, `V034`), nome, terminais, cor e percurso. No texto desta documentação, "via" e "rota" dizem o mesmo. |
| `Paragem` (stop) | Um sítio onde os autocarros param: nome, código (`PAR-0001`, `OSM-<id>`) e posição. |
| `ViaParagem` | A ligação de uma paragem a uma via: uma linha por paragem que a via serve. Não tem ordem; a ordem vem do percurso ([Base de dados → Convenções](base-de-dados.md#convenções-ler-antes-de-consultar)). |
| `Transporte` (vehicle) | Um veículo: matrícula (`matricula`), marca, modelo, lugares, via e campos de GPS. |
| `Motorista` (driver) | Um motorista, com o veículo que conduz e o hash do seu PIN. |
| `Proprietario` (owner) | O dono de veículos; `TransporteProprietario` liga-os. |
| `Utente` (passenger) | Uma conta de passageiro, criada na web ou pela opção 1 do USSD. |
| `MISSION` (arrival alert) | "Avise-me por SMS quando um autocarro estiver perto desta paragem". O nome vem do primeiro modelo de dados e ficou. |
| `Tarifa` (fare rule) | Tarifa mínima, preço por km e as velocidades das estimativas. Uma está activa. |
| `Provincia`, `Municipio`, `Cidade` | Onde as vias pertencem. `Cidade` está vazia. |
| `Administrador` | Uma conta do painel de administração. |
| `GeoLocation` | Antiga: posições da primeira importação de dados. Nenhum código a lê; as posições vêm agora de `Transporte`. |

## Campos que precisam de explicação

| Campo | Significado |
|---|---|
| `Via.geoLocationPath` | O percurso da via pelas estradas, `lng,lat;lng,lat;…`, num só sentido; os autocarros vão por ele e voltam por ele. Atenção: longitude primeiro. |
| `Via.terminalPartida`, `terminalChegada` | O início e o fim da via, como nomes. |
| `codigo`, `codigoVia`, `codigoParagem` | Códigos legíveis, repetidos ao lado das chaves estrangeiras verdadeiras. As junções fazem-se pelas colunas `…Id`. |
| `Transporte.currGeoLocation` | O último ponto GPS do veículo, `lat,lng` (latitude primeiro, ao contrário do percurso). |
| `gpsAtualizadoEm` | Quando esse ponto chegou. Com menos de 3 minutos, está "ao vivo". |
| `gpsDispositivoHash` | O SHA-256 do código do dispositivo GPS do veículo. O código em si nunca é guardado. |
| `Motorista.emViagem`, `viagemIniciadaEm` | O motorista está em viagem, e desde quando. |
| `Motorista.status` | O estado da conta (`ativo`, `inativo`, `suspenso`), não o da viagem. |
| `Motorista.password` | O hash bcrypt do PIN. O nome ficou do primeiro modelo, em que os motoristas tinham palavra-passe. |
| `MISSION.notificadoEm` | Quando foi enviado o SMS de chegada. |
| `fonte` (API) | De onde vem a posição de um autocarro: `gps` (posição ao vivo) ou `horario` (o modelo de horário). |

## Palavras dos ecrãs

| Texto no ecrã | Significado |
|---|---|
| Partida, Destino | início e destino da viagem (aplicação dos passageiros) |
| Acompanhar viagem | seguir uma viagem no mapa, passo a passo (`/viagem`) |
| "Avisar-me por SMS…" | pedir um SMS de chegada (cria um `MISSION`) |
| Iniciar viagem, Encerrar viagem | portal do motorista e opção 6 do USSD |
| Rastreador GPS, "Gerar código do dispositivo" | painel, página do veículo |
| Nova Via, Redesenhar percurso | painel, vias |
| Atribuir Transportes | pôr veículos numa via (painel) |
| Encontrar transporte, Procurar rotas, Paragens de uma rota, Calcular tarifa, Rastrear autocarro, Area do motorista | as opções 1 a 6 do USSD ([Serviço USSD](ussd.md)) |
| Proximo, Anterior, Voltar | página seguinte, anterior, voltar (teclas 7, 8 e 0 do USSD) |
| transbordo | mudança de autocarro numa viagem |
| MT | meticais, a moeda |

## Transportes em Maputo

| Termo | Significado |
|---|---|
| chapa | os minibuses (quase sempre Toyota Hiace) que levam a maior parte dos passageiros |
| machimbombo | autocarro |
| EMTPM | a Empresa Municipal de Transporte Público de Maputo |
| Baixa | o centro de Maputo, onde começam muitas rotas |
| Chapas, EMTPM, Corujas, REM, RCM | as redes como o OpenStreetMap as marca; a importação traz todas ([Base de dados → Importar do OpenStreetMap](base-de-dados.md#importar-paragens-e-rotas-do-openstreetmap)) |

## Termos técnicos

| Termo | Significado |
|---|---|
| modelo de horário | Como se põe um autocarro no mapa sem GPS: vai e volta ao longo do percurso das 05:00 às 21:00 à velocidade da tarifa ([Localização e GPS](localizacao-gps.md#como-se-escolhe-uma-posição)). |
| USSD | Os menus `*…#` que qualquer telemóvel usa sem dados. `CON` mantém a sessão aberta, `END` fecha-a ([Serviço USSD](ussd.md)). |
| código de serviço, canal | `*384*848080#`: o canal `848080` no código partilhado `*384#` da Africa's Talking. |
| sandbox | O ambiente de testes gratuito da Africa's Talking: o USSD e os SMS só chegam ao simulador ([Africa's Talking](africas-talking.md)). |
| chave do callback | `USSD_CALLBACK_KEY`, o segredo no URL de resposta que deixa só a Africa's Talking conduzir os menus ([Segurança](seguranca.md#resposta-ussd-callback)). |
| GSM-7 | O conjunto de caracteres dos SMS e do USSD simples. Um carácter fora dele põe a mensagem em Unicode, o que reduz o seu tamanho para menos de metade. |
| pesquisa tolerante | A pesquisa de nomes que aceita abreviaturas, palavras de ligação, grafias que soam igual e um erro por palavra ([Serviço USSD → Pesquisa tolerante](ussd.md#pesquisa-tolerante)). |
| RAPTOR | O algoritmo do planeador de viagens: ronda a ronda, um autocarro mais por ronda ([Fluxos de dados → Planear uma viagem](fluxos-de-dados.md#planear-uma-viagem)). |
| OSM, relação | OpenStreetMap, e o seu registo de uma linha de autocarro num sentido (`214i`, `214v`). |
| OSRM, FOSSGIS | O motor de caminhos aberto, e os servidores públicos que o correm, usados para pôr os percursos nas estradas. |
| Overpass, Nominatim | O serviço de consultas do OpenStreetMap (para descarregar paragens e rotas) e o seu geocodificador (para dar nome às primeiras paragens) ([Fontes de dados](fontes-de-dados.md)). |
| ODbL | A licença dos dados do OpenStreetMap: uso livre com atribuição; uma base de dados derivada partilhada fica sob a mesma licença. |
| OpenFreeMap | Os mosaicos vectoriais gratuitos sobre os quais as três aplicações desenham. |
| dados de demonstração | Os veículos, motoristas e proprietários inventados ([Fontes de dados → Veículos, motoristas e proprietários](fontes-de-dados.md#veículos-motoristas-e-proprietários)). |
| ramo (branch) da Neon | Uma cópia instantânea da base de dados, para experimentar uma alteração ([Guia da Neon](guia-neon.md)). |
| endereço pooled, directo | Os dois endereços da base de dados na Neon: pooled para as aplicações, directo para scripts e `psql`. |
| Preview, Production | A publicação de um ramo na Vercel, e a publicação ao vivo ([Guia da Vercel](guia-vercel.md)). |
| `waitUntil` | Deixa uma função da Vercel enviar o SMS depois de responder ao telemóvel. |
| código do dispositivo | O código de 20 caracteres que um rastreador GPS envia com cada posição ([Localização e GPS](localizacao-gps.md#ligar-um-dispositivo)). |
| PIN | O código de entrada de um motorista, gerado por um administrador ([Portal do motorista](portal-motorista.md)). |
| serverless | Funções que a Vercel arranca a cada pedido, sem servidor sempre ligado: não guardam memória entre pedidos, e é por isso que o USSD e as posições não dependem de estado guardado. |

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Visão geral](visao-geral.md) · [Índice](README.md) · Seguinte: [Fontes de dados](fontes-de-dados.md)
<!-- /navegação-fim -->
