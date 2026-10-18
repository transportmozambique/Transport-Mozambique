# Limitações

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 6. Manter › **Limitações** (página 23 de 23)

Anterior: [Resolução de problemas](resolucao-de-problemas.md) · [Índice](README.md)

<details>
<summary>Todas as páginas</summary>

- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · **Limitações**

</details>
<!-- /navegação -->

O que está incompleto, estimado ou antigo em 2026-10-18, para não ser confundido com um erro, nem se construir em cima disso sem saber. Cada item diz como contorná-lo agora, ou o que seria preciso para o tirar. As falhas de segurança têm a sua lista em [Segurança → Falhas conhecidas](seguranca.md#falhas-conhecidas).

**Nesta página:** [Corrigido em 2026-10-18](#corrigido-em-2026-10-18) · [Posições e horas](#posições-e-horas) · [Viagens](#viagens) · [Notificações](#notificações) · [Dados](#dados) · [Painel](#painel) · [Portal do motorista](#portal-do-motorista) · [USSD e SMS](#ussd-e-sms) · [Código e repositório](#código-e-repositório)

---

## Corrigido em 2026-10-18

Estavam nesta lista e já não são limitações:

| Era | Agora |
|---|---|
| Os SMS de chegada só saíam enquanto alguém usava a web | Um agendamento do GitHub Actions corre a verificação a cada 5 minutos ([Fluxos de dados → Alerta de chegada](fluxos-de-dados.md#alerta-de-chegada-e-sms)). |
| A regra de tarifa só se mudava com SQL | Painel → Configuração → **Tarifa** ([Painel → Tarifa](painel-admin.md#tarifa)). |
| O portal do motorista guardava a rota e o veículo da entrada | Pergunta outra vez ao abrir e a cada 5 minutos (`GET /api/driver/me`). |
| Desenhar uma rota dependia só do router de demonstração do OSRM | O painel pergunta primeiro ao router da FOSSGIS e ao de demonstração quando falha. |
| Pesquisar um telefone precisava do espaçamento guardado (`87 183`) | Quaisquer 3 ou mais algarismos, com qualquer espaçamento, com ou sem `258`. |
| A posição exacta do passageiro ia no URL de `/api/journeys` e `/api/viagem`, e por isso nos registos dos pedidos | A web envia-a no corpo de um `POST` ([Segurança → Endpoints públicos](seguranca.md#endpoints-públicos)). |
| "Histórico" e "Agendar" na página dos relatórios levavam a páginas "em desenvolvimento" | Os botões saíram. |
| 340 veículos não tinham motorista | Cada um tem um motorista de demonstração ([Base de dados → Motoristas para os veículos importados](base-de-dados.md#motoristas-para-os-veículos-importados)). |
| 51 percursos de rotas desenhavam linhas rectas a cortar quarteirões | Postos nas estradas; o troço recto mais longo que resta tem 7,2 km na EN1, onde a estrada é recta ([Base de dados → Pôr os percursos nas estradas](base-de-dados.md#pôr-os-percursos-das-rotas-nas-estradas)). |
| Sem CI | Cada pull request verifica os tipos das três aplicações, compara os três esquemas e confirma as ligações e a navegação da documentação ([Testes → CI no GitHub](testes.md#ci-no-github)). |
| No USSD, um nome mal escrito ("chipamanine", "makalala") não encontrava nada, e uma lista errada obrigava a voltar atrás | A pesquisa aceita abreviaturas, sons iguais e erros, e escrever outro nome numa lista faz uma nova pesquisa ([Serviço USSD → Pesquisa tolerante](ussd.md#pesquisa-tolerante)). |
| A documentação e os comentários do código estavam em inglês | Estão em português, com o porquê de cada escolha; só os ficheiros antigos por apagar ficam em inglês ([abaixo](#código-e-repositório)). |
| A V086 (Rua dos Bons Amigos – Antena) parecia cortar 2 km em linha recta | A linha já segue a rua: o router dá o mesmo comprimento quando passa pelos pontos do percurso. Nada a redesenhar ([Base de dados → Uma rota listada que já está na estrada](base-de-dados.md#uma-rota-listada-que-já-está-na-estrada-v086)). |
| `USER_SESSION_SECRET` e `DRIVER_SESSION_SECRET` estavam como variáveis legíveis na Vercel | Valores novos, guardados como Secret ([Segurança → Mudar segredos](seguranca.md#mudar-segredos)). |

## Posições e horas

- **A maior parte das posições é estimada.** Sem uma posição GPS dos últimos 3 minutos, a posição de um autocarro vem do modelo do horário: vai e volta ao longo da rota das 05:00 às 21:00 à velocidade da regra de tarifa ([Localização e GPS](localizacao-gps.md#como-se-escolhe-uma-posição)). Não é um horário publicado, e os autocarros reais não o seguem.
  *Contornar:* dar GPS aos veículos. Cada um precisa de um código de dispositivo e de um rastreador ou de um telemóvel com o Traccar Client ([Painel → Ligar um GPS](painel-admin.md#tarefa-gps)). Cada veículo equipado passa sozinho às posições reais; nada mais muda.
- **Sem histórico de posições.** Cada posição GPS substitui a anterior; não há um trajecto para rever ou analisar. `GeoLocation` só tem linhas da importação inicial.
  *Contornar:* juntar uma tabela de posições (veículo, hora, ponto, velocidade), escrita por `POST /api/gps` ao lado da actualização que já faz, e apagar as linhas antigas num agendamento. O plano gratuito da Neon guarda cerca de 0,5 GB, por isso guardam-se semanas, não anos.
- **As distâncias usam o percurso guardado.** Uma rota sem `geoLocationPath` usa linhas rectas entre paragens × `fatorEstrada` (1,3 por omissão).
  *Contornar:* todas as rotas de produção têm percurso. "Nova Via" no painel guarda sempre um.
- **Os routers são serviços públicos gratuitos.** Desenhar rotas no painel e as caminhadas no mapa dos passageiros usam os servidores da FOSSGIS e de demonstração do OSRM, que só permitem uso leve. Quando os dois estão em baixo, "Nova Via" e "Redesenhar percurso" não gravam, e as caminhadas desenham-se como linhas rectas.
  *Contornar:* esperar e tentar outra vez, o que chega para um administrador. Para muito tráfego, correr um servidor OSRM ou Valhalla com o extracto de Moçambique do OpenStreetMap (chega uma máquina virtual pequena) e definir `WALK_ROUTER_URL` para as caminhadas; os routers do painel são `ROUTERS` em [`RouteDrawer.tsx`](../transport-admin/app/components/RouteDrawer.tsx).
- **A mesma velocidade em todo o lado.** O trânsito, a hora do dia e o tempo parado nas paragens não estão no modelo; só a paragem de 5 minutos em cada terminal.
  *Contornar:* a velocidade está na página Tarifa do painel; baixá-la se os autocarros andam em geral abaixo de 30 km/h. Velocidades por hora ou por rota precisariam de colunas novas e de uma alteração nas duas cópias de `lib/vehiclePosition.ts`. Os veículos com GPS não são afectados.

## Viagens

- **Os tempos das viagens são estimados** com o mesmo modelo, para cada autocarro no momento em que se chega à sua paragem. Um primeiro autocarro atrasado faz perder o seguinte; o planeador não sabe.
  *Contornar:* GPS nos veículos, como acima. "Acompanhar viagem" calcula a viagem outra vez a cada 10 segundos, por isso um passageiro que a acompanha vê um atraso logo que aparece.
- **As caminhadas planeiam-se em linha recta**, a 4,5 km/h mais um quarto pelas ruas. O planeador anda até 400 m para mudar de autocarro, 300 m no fim, e 800 m a partir da posição do passageiro. Um rio ou uma auto-estrada entre duas paragens não se vê. O mapa desenha as caminhadas pelas ruas, mas a distância e os minutos mostrados continuam a ser os do planeador.
  *Contornar:* raramente conta a estas distâncias. Uma correcção pediria ao router a pé as caminhadas das 3 opções mostradas antes de responder, ao custo de até um segundo por pesquisa.
- **Alguns locais não estão ligados.** Dois pequenos grupos de rotas (VIA-071, VIA-073, VIA-075 e VIA-111; e V111 na Manhiça) não partilham nenhuma paragem a menos de 400 m com as outras 256 rotas. As viagens entre eles e o resto respondem "Não há ligação" ([Fluxos de dados → Planear uma viagem](fluxos-de-dados.md#planear-uma-viagem)).
  *Contornar:* se essas rotas se cruzam mesmo com outras, ligar uma paragem partilhada às duas no painel (Paragens → a paragem → Editar → marcar as rotas), ou redesenhar as rotas para passarem na paragem partilhada.
- **A rede fica em cache 5 minutos** por instância do servidor: uma paragem, rota ou veículo novo aparece no planeador em 5 minutos.
  *Contornar:* esperar 5 minutos, ou publicar outra vez `transport-mz` para arrancar instâncias novas.
- **A lista dos pontos de partida ainda envia uma posição arredondada no URL.** `/api/destinos` recebe a posição arredondada a cerca de 110 m, que fica nos registos dos pedidos.
  *Contornar:* a mesma alteração de `/api/journeys` (um corpo `POST`). Ficou assim porque o ponto já é grosseiro.

## Notificações

- **A verificação agendada pode atrasar-se ou ficar suspensa.** O GitHub arranca os workflows agendados alguns minutos mais tarde quando está ocupado, e suspende-os num repositório sem actividade durante 60 dias.
  *Contornar:* ligá-lo outra vez em Actions → "Verificação de chegadas (SMS)" → Enable workflow. Para um horário mais apertado, usar um agendador externo (cron-job.org, por exemplo) que envie `POST https://transport-mz.vercel.app/api/simulation` com `{"action":"check"}`, ou o Vercel Cron num plano pago.
- Os alertas com mais de 24 horas são ignorados, e um alerta envia no máximo um SMS a cada 30 minutos. É de propósito: o passageiro pede outra vez para uma viagem nova.

## Dados

- **Os dados são uma demonstração.** As paragens e as rotas vêm do OpenStreetMap e de um primeiro conjunto de dados feito à imagem das rotas da EMTPM; os veículos, os motoristas e os proprietários são inventados ([Fontes de dados](fontes-de-dados.md)).
  *Contornar:* substituí-los pela frota e pelos motoristas reais dos operadores, no painel. Comparar as rotas e as paragens com as listas dos próprios operadores e corrigi-las no painel.
- **Os nomes das paragens repetem-se.** Muitas paragens têm o nome da rua, por isso uma rota pode listar "Rua do Cajueiro (Fedel Castro)" oito vezes, e alguns terminais têm nomes como "120". Os utilizadores vêem estes nomes na web, no USSD e nos SMS.
  *Contornar:* mudar o nome das paragens no painel (Paragens → a paragem → Editar). A maior parte dos nomes vem de geocodificação inversa (a rua mais próxima), por isso quem conhece os pontos de referência ("Mercado Xipamanine", uma escola, uma igreja) é a pessoa certa para o fazer.
- **Rotas importadas** ([Base de dados → Importar do OpenStreetMap](base-de-dados.md#importar-paragens-e-rotas-do-openstreetmap)):
  - os seus veículos (matrículas `ADA-001M` a `ADA-340M`) e motoristas são dados de demonstração;
  - os dois sentidos seguem o percurso de ida, por isso nas ruas de sentido único a volta desenha-se na rua errada; as suas paragens a mais de 60 m desse percurso ficam de fora;
  - a regra de tarifa (10 MT por km por omissão) dá às rotas longas tarifas bem acima do que os chapas cobram.

  *Contornar:* substituir os veículos e os motoristas pelos reais no painel. Para as tarifas, baixar o "Preço por km" na página Tarifa, ou subir o mínimo e baixar o preço por km, até as rotas longas ficarem certas; a página mostra o efeito antes de gravar. Percursos de volta separados precisariam de uma segunda coluna de percurso em `Via`.
- **A ordem das paragens é calculada.** `ViaParagem` não tem coluna de ordem; as paragens ordenam-se projectando-as no percurso da rota. Uma paragem longe do percurso pode cair no sítio errado.
  *Contornar:* a página da rota no painel lista as paragens por esta ordem, por isso uma paragem fora do sítio vê-se lá. Mover a paragem para a estrada (Paragens → Editar), ou desligá-la dessa rota.
- **As coordenadas são texto.** Os pontos são textos `"lat,lng"` e os percursos `"lng,lat;…"` (atenção à ordem); não há PostGIS nem índice espacial ([Base de dados → Convenções](base-de-dados.md#convenções-ler-antes-de-consultar)). Chega a este tamanho (1 902 paragens).
  *Contornar:* não é preciso até a rede ser muitas vezes maior. A Neon aceita o PostGIS (`CREATE EXTENSION postgis`) se um dia for.
- **`Cidade` está vazia** e não tem ecrã; os municípios ligam-se directamente às províncias. A tabela ignora-se.
- **A "Data de Início de Operações" dos proprietários** guarda-se na coluna `birthDate`. Lê-se como essa data.

## Painel

- **Os certificados dos proprietários não se guardam.** O "Upload do Certificado (PDF)" do formulário dos proprietários é lido no navegador, mas a API deita-o fora.
  *Contornar:* guardar os certificados fora do sistema por agora. Guardá-los precisa de um armazenamento de ficheiros (o Vercel Blob tem um plano gratuito), de uma coluna para o endereço do ficheiro em `Proprietario`, e do envio na API dos proprietários.
- **O "Raio de Cobertura"** nos formulários das províncias e dos municípios só muda o tamanho do círculo no mapa do formulário. Nada o usa.
- **Os relatórios são listas para imprimir:** a pré-visualização mostra os primeiros 8 campos de até 100 linhas, e os PDF saem da janela de impressão do navegador ("Guardar como PDF").
  *Contornar:* para uma tabela completa, correr uma consulta no SQL Editor da Neon e descarregar o resultado ([Guia da Neon](guia-neon.md)).
- **O início fica em cache 5 minutos** por instância do servidor; as páginas das listas não. As páginas das listas estão sempre actualizadas.
- **Sem papéis:** qualquer administrador pode fazer tudo, incluindo criar e apagar administradores.
  *Contornar:* só criar contas de administrador para quem deve ter controlo total. Os papéis precisariam de uma coluna `role` em `Administrador` e de uma verificação em `proxy.ts` ou em cada API.

## Portal do motorista

- **O marcador do autocarro é a posição do telemóvel.** O mapa do portal põe o autocarro onde o telemóvel está, e no início do percurso da rota até o navegador dar uma posição. Não é a posição que os passageiros vêem, que vem do GPS do veículo ou do horário ([Portal do motorista → Painel](portal-motorista.md#painel-dashboard)).
- **O GPS do navegador pára em segundo plano.** Partilhar a posição do telemóvel a partir do portal só funciona com a página aberta e o ecrã ligado.
  *Contornar:* para seguir sem falhas, instalar o Traccar Client no telemóvel com o código do dispositivo do veículo ([Localização e GPS → Traccar Client](localizacao-gps.md#traccar-client-num-telemóvel)); continua a enviar com o ecrã desligado.
- **O estado da viagem não muda as posições.** "Iniciar viagem" e "Terminar viagem" são um estado partilhado com o USSD; não arrancam nem param o autocarro no mapa. As posições reais vêm do GPS.

## USSD e SMS

- **Só sandbox.** O USSD e os SMS chegam ao simulador da Africa's Talking, não a telemóveis reais.
  *Contornar:* ir ao vivo não precisa de mudar o código: uma aplicação paga da Africa's Talking, um código USSD nas redes moçambicanas, uma chave da API ao vivo na Vercel e crédito. Os passos, por ordem, estão em [Africa's Talking → Passar a produção](africas-talking.md#passar-a-produção).
- **182 caracteres por ecrã.** Os nomes longos cortam-se com `..`, e os acentos tiram-se (GSM-7). É um limite do próprio USSD; nomes de paragens mais curtos ajudam.
- **A pesquisa por nome tem limites.** Aceita abreviaturas, sons iguais e um ou dois erros, mas não nomes completamente diferentes (um nome popular que não está no nome da paragem) nem erros na primeira letra.
  *Contornar:* pôr o nome popular no nome da paragem no painel, ou juntá-lo às formas curtas de [`lib/places.ts`](../transport-client/lib/places.ts).
- **Telerivet** (`/api/ussd-telerivet`) é uma segunda integração de gateway, sem uso, com os menus antigos. Nada a chama.

## Código e repositório

- **A aplicação antiga da raiz.** `app/`, `lib/`, o `package.json` e o `vercel.json` da raiz são uma variante antiga da aplicação dos passageiros. Nenhum projecto da Vercel a compila e já é diferente de `transport-client`. Não se publica.
- **Scripts de uso único.** 100 ficheiros `.js` na raiz do repositório (incluindo 24 `test-*.js`), 4 em `scripts/`, 38 na raiz de `transport-admin` e 84 em `transport-admin/scripts`. Vêm da importação inicial dos dados e de correcções anteriores; vários escrevem na base de dados de `DATABASE_URL`. Lê-se um antes de o correr. Os scripts mantidos estão em `transport-client/scripts` ([Mapa do código → Scripts de dados](mapa-do-codigo.md#scripts-de-dados-scripts)).
- **Ficheiros que se podem apagar.** Os de cima, e também as cópias `*.backup` e `*.old` das rotas, os scripts `transport-client/*.js`, a pasta `scratch/`, a rota Telerivet, e `docs/architecture.pdf` (desactualizado, substituído por [Visão geral](visao-geral.md)). Ficaram em inglês e por apagar porque apagar ficheiros precisa da autorização explícita do dono do projecto. Porquê apagá-los: confundem quem chega ao repositório, e alguns escrevem na base de dados.
- **Três cópias do esquema.** `prisma/schema.prisma` é a referência; `transport-client/prisma/schema.prisma` tem de ser igual e `transport-admin/prisma/schema.prisma` só difere no bloco do generator. Mudam-se as três juntas; o CI falha quando diferem.
- **Duas cópias do código das posições.** `lib/vehiclePosition.ts` existe na aplicação dos passageiros e no painel; uma alteração às regras do horário tem de ir para as duas.
- **Muitos avisos antigos do lint** ([Testes](testes.md#tipos-e-lint)), por isso o lint não está no CI. A aplicação dos passageiros e o portal do motorista não têm testes automáticos; [Testes](testes.md#aplicação-dos-passageiros-e-ussd-à-mão) lista o que confirmar à mão.
- **A produção não tem histórico de migrações** (`_prisma_migrations`), por isso as alterações ao esquema aplicam-se à mão com SQL idempotente ([Publicação → Alterações à base de dados em produção](publicacao.md#alterações-à-base-de-dados-em-produção)).

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Resolução de problemas](resolucao-de-problemas.md) · [Índice](README.md)
<!-- /navegação-fim -->
