# Localização e GPS

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 3. Perceber como funciona › **Localização e GPS** (página 11 de 26)

Anterior: [Fluxos de dados](fluxos-de-dados.md) · [Índice](README.md) · Seguinte: [Serviço USSD](ussd.md)

<details>
<summary>Todas as páginas</summary>

- 0. Começar do zero: [Conceitos básicos](conceitos.md) · [Preparar o computador](preparar-o-computador.md)
- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · **Localização e GPS** · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md) · [Guia do cron-job.org](guia-cron-job.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

> **Em palavras simples:** Cada autocarro aparece no mapa num ponto. Se o autocarro tem um aparelho de [GPS](conceitos.md#gps "O sistema de satélites com que um telemóvel ou um aparelho sabe as suas coordenadas."), o ponto é a sua posição real; se não tem (hoje nenhum tem), a plataforma calcula onde ele está a partir da hora em que o motorista carregou em "Iniciar viagem". Sem viagem iniciada, o autocarro está parado e os passageiros não contam com ele. Esta página explica estes casos, e como ligar um telemóvel ou um aparelho de GPS a um autocarro.

Cada veículo tem sempre uma posição. Vem de um dispositivo GPS real quando um enviou posição nos últimos 3 minutos; senão vem da **viagem do motorista**: desde que ele carregou em "Iniciar viagem" (no [portal do motorista](portal-motorista.md) ou na opção 6 do [USSD](conceitos.md#ussd "Os menus que aparecem num telemóvel quando se marca um código como *384*848080#; funcionam em qualquer telemóvel, sem internet.")), o autocarro vai e volta ao longo da rota, e sem viagem está parado e fora de serviço. O portal do motorista, o mapa e as viagens da web, o USSD, os [SMS](conceitos.md#sms "As mensagens de texto curtas dos telemóveis.") e o painel usam esta mesma conta, por isso mostram o mesmo autocarro no mesmo sítio e no mesmo estado. Esta página explica como se escolhe a posição e porquê, como ligar um telemóvel ou um [rastreador](conceitos.md#rastreador "Um aparelho (ou um telemóvel com uma aplicação) que envia a posição de um veículo pela internet; o código do dispositivo é a sua 'palavra-passe'.") a um veículo, e o protocolo que a aplicação dos passageiros aceita.

**Nesta página:** [Como se escolhe uma posição](#como-se-escolhe-uma-posição) · [Onde se usam as posições](#onde-se-usam-as-posições) · [Ligar um dispositivo](#ligar-um-dispositivo) · [Protocolo](#protocolo) · [Verificar que funciona](#verificar-que-funciona) · [Revogar um dispositivo](#revogar-um-dispositivo) · [Limites](#limites)

---

## Como se escolhe uma posição

`vehiclePosition()` ([`transport-client/lib/vehiclePosition.ts`](../transport-client/lib/vehiclePosition.ts), com uma cópia em [`transport-admin/lib/vehiclePosition.ts`](../transport-admin/lib/vehiclePosition.ts)) decide, para qualquer veículo e qualquer momento:

```mermaid
flowchart TD
  A["vehiclePosition(veículo, percurso da rota, agora)"] --> B{"Posição GPS com menos de 3 min?<br/>(Transporte.gpsAtualizadoEm)"}
  B -- sim --> G["Posição GPS<br/>fonte = gps<br/>em serviço só com viagem iniciada"]
  B -- não --> T{"O motorista iniciou a viagem?<br/>(Motorista.emViagem)"}
  T -- não --> P["Parado, fora de serviço<br/>onde ficou, ou no terminal do início"]
  T -- sim --> C{"A rota tem percurso?<br/>(Via.geoLocationPath)"}
  C -- sim --> F{"Houve GPS nesta viagem,<br/>perto da rota?"}
  F -- sim --> D["A andar desde a última posição GPS<br/>fonte = horario, em serviço"]
  F -- não --> H["Posição pela viagem<br/>fonte = horario, em serviço"
  C -- não --> L["Último ponto guardado, parado<br/>(Transporte.currGeoLocation)"]
```

**Em serviço** quer dizer que o motorista iniciou a viagem (`Motorista.emViagem`). Só os autocarros em serviço entram nas viagens planeadas, nas horas de chegada, nos SMS e em "Em servico" do USSD. O mapa mostra também os parados, com o estado "Fora de serviço". Porquê: um autocarro sem motorista ao volante não vai chegar, e mostrá-lo a andar enganava o passageiro (era o que acontecia até Outubro de 2026, quando a posição vinha de um horário fixo, das 05:00 às 21:00, que ignorava o portal do motorista).

**1. GPS real.** Se `gpsAtualizadoEm` tem menos de 3 minutos (`GPS_FRESH_MS`), o veículo está em `currGeoLocation`:

- está **em movimento** quando a velocidade enviada é maior do que 0,5 km/h (ou desconhecida) **e** o motorista iniciou a viagem;
- o seu sítio na rota é o ponto mais próximo do percurso da rota;
- o **sentido** compara o rumo enviado com o rumo do troço do percurso onde o autocarro está (a projecção do ponto no percurso): até 90° quer dizer "para o fim do percurso", senão "de volta". Porquê o troço e não o ponto do percurso mais perto: perto de uma esquina, o ponto mais perto é o da esquina, e o troço que começa nele é o de depois da curva. Até 2026-10-28 o autocarro parecia ir ao contrário em cerca de 12% da X19, e a bordo isso contava como "já passou a paragem de saída": num teste, "Saia agora em Bassopa" chegou com o autocarro ainda no Hospital, 770 m antes;
- a velocidade mostrada é `gpsVelocidade`, a última enviada;
- as **horas de chegada** usam a velocidade média recente, `gpsVelocidadeMedia` ([abaixo](#a-velocidade-das-horas-de-chegada)).

Um rastreador ligado num autocarro sem viagem iniciada mostra onde ele está, mas o autocarro continua fora de serviço.

**2. Viagem iniciada, sem GPS.** O autocarro parte do [terminal](conceitos.md#terminal "A janela onde se escrevem instruções para o computador em texto, em vez de clicar.") de onde saiu à hora em que o motorista iniciou a viagem, e vai e volta ao longo do percurso da rota à velocidade de viagem da tarifa (`Tarifa.velocidadeViagemKmh`, 30 km/h por omissão), até o motorista encerrar a viagem ([`tripPosition`](../transport-client/lib/vehiclePosition.ts)):

| Regra | Valor |
|---|---|
| Início | `Motorista.viagemIniciadaEm`, gravado em "Iniciar viagem" |
| Terminal de partida | `Motorista.viagemSentido`: `1` o início do percurso, `-1` o fim. Escolhe-se ao iniciar: o terminal mais perto de onde o autocarro estava parado ([`startTrip`](../transport-client/lib/driverTrips.ts)) |
| Um ciclo | ida, 5 min no terminal do fim, volta, 5 min no terminal de partida, e outra vez |
| Duração de cada sentido | comprimento do percurso ÷ velocidade de viagem |
| Fim | "Encerrar viagem": o autocarro fica parado no ponto onde estava (gravado em `Transporte.currGeoLocation` quando não há GPS) |

O autocarro segue exactamente o percurso guardado: onde um percurso corta quarteirões, o autocarro no mapa também. Corrigir um percurso ([Base de dados → Pôr os percursos nas estradas](base-de-dados.md#pôr-os-percursos-das-rotas-nas-estradas), ou "Redesenhar percurso" no painel) muda logo as posições e as horas de chegada.

O resultado depende só da hora, da viagem (início e terminal de partida), do percurso e da velocidade. **Porquê assim:** todos os [endpoints](conceitos.md#api "Uma API é a lista de pedidos que um servidor aceita de outros programas; cada um desses pedidos, com o seu endereço, é um endpoint."), todas as instâncias [serverless](conceitos.md#serverless "Um pedaço de código que a Vercel arranca só quando chega um pedido, e desliga a seguir.") e os menus USSD calculam a mesma posição sem falarem uns com os outros, e nada corre em segundo plano (a [Vercel](conceitos.md#vercel "A empresa cujos servidores correm as três aplicações e as publicam a cada merge.") não tem processos sempre ligados). **O que se perde:** sem GPS é uma estimativa: o trânsito e as paragens longas não contam, e o autocarro real pode ir adiantado ou atrasado. O GPS real resolve-o ([Limitações](limitacoes.md)).

**2a. Viagem iniciada, o GPS calou-se.** Quando houve uma posição GPS depois de o motorista iniciar a viagem, a menos de 300 m do percurso, mas já tem mais de 3 minutos (o telemóvel perdeu o sinal, ou a aplicação fechou), o autocarro continua **a partir dessa última posição**:

- no sentido que o GPS mostrava nesse momento (parado ou sem rumo: o sentido que a viagem do motorista tinha a essa hora);
- à velocidade média do GPS nesse momento (ou à da tarifa, sem média);
- com as mesmas voltas e esperas de 5 min nos terminais da regra 2.

Porquê: a última posição real é mais certa do que onde a hora de início poria o autocarro. Antes, o autocarro "saltava" para essa posição quando o sinal falhava, e os avisos por SMS também. Uma posição GPS de antes da viagem em curso (de uma viagem anterior) não conta. O cálculo está em `sinceLastFix()`.

**3. Sem viagem.** O autocarro está parado e fora de serviço. Fica no último ponto guardado em `currGeoLocation` quando esse ponto está a menos de 300 m do percurso (onde a última viagem acabou); senão, no primeiro ponto do percurso (`parkedPosition`).

**4. Sem percurso.** Uma rota sem percurso guardado não se pode seguir. O veículo aparece parado no último `currGeoLocation` guardado; sem ele, não tem posição (o painel mostra "Sem rota").

Uma posição GPS não muda a forma da rota nem a viagem. Quando a posição passa os 3 minutos, o veículo continua a partir dela (regra 2a).

### A velocidade das horas de chegada

Todas as horas de chegada (os avisos por SMS, as viagens da web e do USSD, "chega em N min" no mapa, a próxima paragem no painel) dividem a distância ao longo do percurso por uma velocidade, a de cada posição (`speedKmh`, calculada em `etaSpeedKmh()`):

| Autocarro | Velocidade |
|---|---|
| Sem GPS nesta viagem | a de viagem da tarifa, `Tarifa.velocidadeViagemKmh` (30 km/h) |
| Com GPS, recente ou calado há pouco (2a) | a média recente do GPS, `gpsVelocidadeMedia`, mas nunca abaixo de metade nem acima de uma vez e meia a da tarifa (15 a 45 km/h com 30) |

**Como se calcula a média.** A cada posição nova, `/api/gps` mede a distância em linha recta desde a posição anterior e divide-a pelo tempo entre as duas ([`nextSpeedAverage()`](../transport-client/app/api/gps/route.ts)). Junta essa medida à média, a pesar mais as recentes: a média esquece as posições com uma constante de 5 minutos.

| Caso | A média |
|---|---|
| Primeira posição, ou mais de 10 min sem posições | recomeça (`null`): usa-se a velocidade da tarifa até à posição seguinte |
| Menos de 5 s desde a anterior | fica igual: tempo curto de mais para medir |
| Um salto mais rápido do que 100 km/h | fica igual: é um erro do GPS |
| Caso contrário | `média + (1 − e^(−segundos/300)) × (medida − média)` |

**Porquê a distância e não a velocidade enviada.** A média tem de contar o tempo parado nas paragens e nos semáforos, que é parte do tempo de um autocarro. Muitos telemóveis não enviam posições enquanto estão parados, e a velocidade enviada no momento diz pouco sobre os próximos minutos.

**Porquê os limites.** Um autocarro preso num semáforo, ou à espera no terminal, teria horas de chegada absurdas; uma média de poucos minutos não diz como vai ser o trânsito daqui a 15. Com os limites, o trânsito pode fazer as horas até duas vezes mais longas, ou um terço mais curtas.

Testado em 2026-10-28 numa cópia local, com uma sequência de posições: 308 m em 30 s deram 37 km/h; parado 30 s, 33,5; mais 30 s, 30,3; uma posição 2 s depois e um salto de 5 km não mudaram a média; depois de 12 min sem posições, recomeçou.

**Os estados**, iguais em todo o lado ([`statusLabel`](../transport-client/lib/vehiclePosition.ts)):

| Estado | Quando | Portal do motorista | Web | USSD (opção 5) |
|---|---|---|---|---|
| Em circulação | em viagem, a andar | "Em viagem"; "Os passageiros vêem: Em circulação" | "Em circulação" | `Em circulacao` |
| No terminal | em viagem, nos 5 min de espera num terminal | "Em viagem"; "Os passageiros vêem: No terminal" | "No terminal" | `No terminal` |
| Fora de serviço | sem viagem iniciada | "Parado"; "Os passageiros vêem: Fora de serviço" | "Fora de serviço" | `Parado, fora de servico` |

## Onde se usam as posições

| Quem usa | Endpoint ou código | Usa |
|---|---|---|
| Portal do motorista, "Os passageiros vêem" | `GET /api/driver/trip` (campo `autocarro`) | o estado, a posição e as próximas paragens que os passageiros vêem, a cada 10 s |
| Mapa ao vivo dos passageiros | `GET /api/buses?fields=map`, depois `GET /api/buses?fields=position` | posição, `fonte` (`gps` ou `horario`), rumo, estado |
| Resultados de pesquisa, acompanhar uma viagem | `GET /api/buses?paragemId=…`, `POST /api/viagem` | posição, sentido e sítio no percurso → hora de chegada (só autocarros em serviço) |
| Opções 1, 2, 4 e 5 do USSD | `/api/ussd` | viagens e horas (só em serviço), "Em servico: N de M", estado e paragem mais próxima |
| SMS de chegada e avisos das viagens acompanhadas | `checkAndNotifyUsers()` ([`lib/busSimulator.ts`](../transport-client/lib/busSimulator.ts)), `checkJourneyAlerts()` ([`lib/journeyAlerts.ts`](../transport-client/lib/journeyAlerts.ts)) | minutos até cada autocarro em serviço chegar à paragem |
| Lista de veículos e página do veículo no painel | `GET /api/transportes/estado`, `/posicao` | coluna "Agora", mapa ao vivo, etiqueta |
| "Próximas Passagens" e gráficos do painel | `GET /api/transportes/{id}/operacao` | a viagem em curso, desde que o motorista a iniciou |

As horas de chegada usam as mesmas regras: um autocarro que já passou a paragem, ou que vai no outro sentido, primeiro dá a volta num terminal (5 minutos lá) ([Fluxos de dados → Hora de chegada](fluxos-de-dados.md#hora-de-chegada)). Um autocarro parado não tem hora de chegada: quando nenhum autocarro de uma rota está em serviço, a web e o USSD dizem-no, em vez de inventar uma hora.

## Ligar um dispositivo

Há três tipos de dispositivo que podem enviar a posição de um veículo. Todos usam o **código do dispositivo** do veículo.

### 1. Criar o código do dispositivo

No painel, abrir **Transportes → o veículo → "Rastreador GPS"** e carregar em **"Gerar código do dispositivo"** ([Painel → Ligar um rastreador GPS](painel-admin.md#tarefa-gps)).

<img src="images/admin-gps-device-code.png" alt="Cartão Rastreador GPS logo depois de gerar um código, com a configuração do Traccar Client" width="640">

- O código tem 20 caracteres (15 bytes aleatórios em base64url, 120 bits).
- É mostrado **uma vez**, com o endereço do [servidor](conceitos.md#servidor "Um computador sempre ligado que recebe pedidos e responde a eles.") e a configuração do [Traccar Client](conceitos.md#traccar "Uma aplicação gratuita para telemóvel que envia a posição do telemóvel pelo protocolo OsmAnd."). Só o seu [hash](conceitos.md#hash "Uma 'impressão digital' de um texto, que se calcula num sentido e não se consegue desfazer.") SHA-256 fica guardado, em `Transporte.gpsDispositivoHash` (único). Porquê: quem ler a [base de dados](conceitos.md#base-de-dados "O sítio organizado onde a plataforma guarda tudo o que tem de durar: rotas, paragens, veículos, contas.") não consegue enviar posições falsas.
- "Gerar novo código" substitui-o: o código antigo deixa de funcionar logo, e todos os dispositivos que o usam recebem [401](conceitos.md#codigos-de-resposta "O número de três algarismos com que o servidor diz como correu o pedido.") até serem configurados outra vez.

O endereço do servidor mostrado é `GPS_SERVER_URL` do painel, por omissão `https://transport-mz.vercel.app/api/gps` ([Configuração](configuracao.md#transport-admin-painel-de-administração)).

### Traccar Client num telemóvel

O [Traccar Client](https://www.traccar.org/client/) é uma aplicação gratuita (Android e iOS) que envia a posição do telemóvel em segundo plano, também com o ecrã desligado. É a forma recomendada de seguir um veículo com o telemóvel do motorista. Porquê esta: é aberta, gratuita, e fala o protocolo [OsmAnd](conceitos.md#osmand "Uma forma combinada de um aparelho enviar a sua posição: abre um endereço com a posição escrita nos parâmetros."), que a plataforma aceita sem nada a mais.

| Configuração do Traccar Client | Valor |
|---|---|
| Server [URL](conceitos.md#url "O texto que diz ao navegador onde está uma página ou informação, como https://transport-mz.vercel.app/viagem.") | `https://transport-mz.vercel.app/api/gps` |
| Device identifier | o código do dispositivo do veículo |
| Location accuracy | High |
| Frequency | 15 segundos |

Depois, ligar o serviço de seguimento na aplicação. Envia cada posição com o protocolo OsmAnd ([abaixo](#parâmetros-osmand)) e guarda as posições em fila quando está sem rede. Quando as reenvia, o servidor ignora as mais antigas do que a última guardada, por isso o veículo fica na mais recente.

### O portal do motorista

O portal do motorista pode usar o [navegador](conceitos.md#navegador "O programa com que se abrem sites: Chrome, Firefox, Edge, Safari.") do telemóvel como rastreador durante uma viagem: o motorista guarda o código do dispositivo no painel de informações do portal. O navegador envia no máximo uma posição a cada 15 s, e só enquanto a página está aberta e à frente ([Portal do motorista → Partilhar o GPS do telemóvel](portal-motorista.md#partilhar-o-gps-do-telemóvel)). Para seguimento contínuo, preferir o Traccar Client: os navegadores param de enviar com o ecrã desligado.

### Um rastreador de hardware

Os rastreadores de veículos falam normalmente protocolos binários próprios para um servidor de seguimento, não [HTTP](conceitos.md#http "A forma combinada como o navegador (ou outro programa) pede algo a um servidor, e como o servidor responde."). Passam por um [servidor Traccar](https://www.traccar.org/), que reencaminha cada posição para `/api/gps` com o código do veículo como `id`, nos [parâmetros OsmAnd](#parâmetros-osmand). A configuração do reencaminhamento e os nomes dos campos dependem da versão do Traccar (ver a sua documentação de "position forwarding"). Este caminho ainda não foi testado com um rastreador real.

## Protocolo

`/api/gps` da aplicação dos passageiros ([`transport-client/app/api/gps/route.ts`](../transport-client/app/api/gps/route.ts)) aceita [`GET`](conceitos.md#get-e-post "GET pede para ver uma coisa; POST envia dados para o servidor fazer algo com eles.") e `POST`. Todas as respostas levam `Access-Control-Allow-Origin: *`, para um navegador noutro domínio (o portal do motorista) poder enviar. `OPTIONS` responde 204.

### Parâmetros OsmAnd

Usados pelo Traccar Client e pelo reencaminhamento do Traccar. Os campos podem vir na query ou num corpo de formulário.

```http
GET https://transport-mz.vercel.app/api/gps?id=<código>&lat=-25.9692&lon=32.5732&timestamp=1792225800&speed=10&bearing=90&accuracy=12
```

| Campo | Também aceite como | Unidade |
|---|---|---|
| `id` | `deviceid` | o código do dispositivo |
| `lat`, `lon` | `latitude`, `lng`, `longitude` | graus decimais |
| `timestamp` | `time` | segundos ou milissegundos desde 1970, ou uma data ISO 8601; opcional |
| `speed` | | **nós** (multiplicados por 1,852 para guardar km/h) |
| `bearing` | `heading`, `course` | graus, 0 = norte |
| `accuracy` | | metros; opcional |

### JSON com o código como "Bearer"

Para integrações próprias. O código vai no cabeçalho `Authorization` e o corpo é [JSON](conceitos.md#json "Uma forma de escrever dados em texto que qualquer programa lê: nomes entre aspas, valores depois de dois pontos, listas entre parênteses rectos."):

```http
POST https://transport-mz.vercel.app/api/gps
Authorization: Bearer <código>
Content-Type: application/json

{"latitude": -25.9655, "longitude": 32.5832, "timestamp": "2026-10-17T08:30:00Z", "speed": 23.4, "heading": 87, "accuracy": 12}
```

Os mesmos campos e nomes alternativos, mas `speed` em **km/h**. `timestamp` é opcional (ISO 8601, ou segundos ou milissegundos desde 1970).

### O que o servidor faz

| Caso | Resposta | Guardado |
|---|---|---|
| Sem código (sem `Authorization: Bearer`, sem `id`) | 401 `{"error": "Código do dispositivo em falta"}` | nada |
| [Latitude](conceitos.md#coordenadas "Dois números que dizem onde está um ponto na Terra.") ou longitude em falta, fora dos limites, ou exactamente 0,0 | 400 `{"error": "Coordenadas inválidas"}` | nada |
| Nenhum veículo tem este código | 401 `{"error": "Dispositivo desconhecido"}` | nada |
| `accuracy` acima de 200 m | 200 `{"ok": true, "ignored": "precisão insuficiente"}` | nada |
| Hora não mais recente do que a última posição guardada | 200 `{"ok": true, "ignored": "posição mais antiga do que a última"}` | nada |
| Caso contrário | 200 `{"ok": true}` | ver abaixo |

Porquê 200 nas posições ignoradas: o Traccar Client reenvia uma posição enquanto não receber 200, e uma posição antiga ou imprecisa não vale a pena reenviar.

Quando corre bem, a linha do veículo é actualizada:

| Coluna | Valor |
|---|---|
| `Transporte.currGeoLocation` | `"lat,lng"` com 6 casas decimais |
| `gpsAtualizadoEm` | a hora da posição; a hora do servidor se faltava ou estava mais de 2 minutos no futuro |
| `gpsVelocidade` | km/h, uma casa decimal, ou `NULL` se não veio velocidade |
| `gpsDirecao` | 0–360°, ou `NULL` |
| `gpsVelocidadeMedia` | km/h, a média recente ([A velocidade das horas de chegada](#a-velocidade-das-horas-de-chegada)) |

Os leitores decidem se a posição é recente por `gpsAtualizadoEm`, por isso uma posição que chega tarde com a sua hora original fica guardada mas pode já contar como antiga.

Depois de responder, uma posição guardada corre também a verificação de chegadas, no máximo uma vez a cada 30 s por instância: os avisos por SMS de quem espera este autocarro saem com a posição nova, sem esperar pelo pedido agendado de cada minuto ([Guia do cron-job.org → O cronjob não sabe onde estão os autocarros](guia-cron-job.md#o-cronjob-não-sabe-onde-estão-os-autocarros)). As posições ignoradas não a correm.

## Verificar que funciona

**Com [`curl`](conceitos.md#curl "Um comando que faz pedidos HTTP a partir do terminal, como um navegador sem janela.")**, de qualquer máquina (substituir o código; localmente usar `http://localhost:3000`):

```bash
curl -s "https://transport-mz.vercel.app/api/gps?id=<código>&lat=-25.9692&lon=32.5732&speed=10&bearing=90"
# {"ok":true}
```

**No painel**, a etiqueta "Rastreador GPS" do veículo passa a **"GPS ativo"** em 30 s e mostra "Última posição recebida", e a etiqueta do mapa diz "GPS real". No mapa dos passageiros o autocarro salta para o ponto enviado.

<img src="images/admin-transporte-gps-live.png" alt="Página do veículo com posição GPS ao vivo: etiqueta GPS real no mapa, GPS ativo no cartão do rastreador" width="640">

**Na base de dados:**

```sql
SELECT matricula, "currGeoLocation", "gpsAtualizadoEm", "gpsVelocidade", "gpsDirecao",
       now() - "gpsAtualizadoEm" < interval '3 minutes' AS recente
FROM "Transporte"
WHERE "gpsDispositivoHash" IS NOT NULL
ORDER BY "gpsAtualizadoEm" DESC NULLS LAST;
```

**Nos [registos](conceitos.md#registos "As linhas de texto que um programa escreve sobre o que está a fazer, para se perceber depois o que aconteceu.") da Vercel** de `transport-mz`, os pedidos falhados aparecem como "Erro ao receber posição GPS". As recusas (400, 401) não ficam no registo da função; ver o estado HTTP no registo de pedidos ([Guia da Vercel → Registos](guia-vercel.md#registos)).

## Revogar um dispositivo

"Revogar dispositivo" no cartão GPS do veículo (`DELETE /api/transportes/{id}/gps`) limpa o hash do código e `gpsAtualizadoEm`, `gpsVelocidade` e `gpsDirecao`. O dispositivo passa a receber 401, e o veículo volta logo à posição pela viagem do motorista (ou parado, sem viagem). Para passar um telemóvel para outro veículo, gerar um código no veículo novo e escrevê-lo no telemóvel.

## Limites

- **Recente quer dizer 3 minutos.** Um dispositivo que envia com menos frequência faz o autocarro saltar entre o ponto GPS e o ponto calculado pela viagem. Os 15 s do Traccar Client ficam bem dentro do limite.
- **O estado da viagem não trava os rastreadores.** O Traccar Client e os rastreadores enviam sempre que estão ligados, e a posição aparece no mapa. Mas o autocarro só fica em serviço (viagens, horas, SMS) depois de "Iniciar viagem". A partilha pelo navegador do portal do motorista também espera por "Iniciar viagem".
- **Sem GPS, a viagem começa sempre num terminal.** Quem inicia a viagem a meio da rota aparece no terminal mais perto, e o autocarro no mapa vai à frente ou atrás do real até a viagem acertar. Um GPS resolve-o.
- **Um dispositivo por veículo.** Um código novo substitui o anterior.
- **Sem histórico.** Cada posição substitui a anterior; não se guarda o trajecto. (`GeoLocation` só tem dados da importação inicial.)
- **Posições fora da rota aparecem onde estão.** A hora de chegada projecta-as no ponto mais próximo do percurso da rota.

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Fluxos de dados](fluxos-de-dados.md) · [Índice](README.md) · Seguinte: [Serviço USSD](ussd.md)
<!-- /navegação-fim -->
