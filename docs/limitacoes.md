# Limitações

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 6. Manter › **Limitações** (página 26 de 26)

Anterior: [Resolução de problemas](resolucao-de-problemas.md) · [Índice](README.md)

<details>
<summary>Todas as páginas</summary>

- 0. Começar do zero: [Conceitos básicos](conceitos.md) · [Preparar o computador](preparar-o-computador.md)
- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md) · [Guia do cron-job.org](guia-cron-job.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · **Limitações**

</details>
<!-- /navegação -->

> **Em palavras simples:** Nem tudo está acabado. Esta página lista o que ainda é aproximado ou incompleto (por exemplo, as posições dos autocarros são estimadas), para não se confundir com um erro, e diz como contornar cada caso.

O que está incompleto, estimado ou antigo em 2026-10-18, para não ser confundido com um erro, nem se construir em cima disso sem saber. Cada item diz como contorná-lo agora, ou o que seria preciso para o tirar. As falhas de segurança têm a sua lista em [Segurança → Falhas conhecidas](seguranca.md#falhas-conhecidas).

**Nesta página:** [Já corrigido](#já-corrigido) · [Posições e horas](#posições-e-horas) · [Viagens](#viagens) · [Notificações](#notificações) · [Dados](#dados) · [Painel](#painel) · [Portal do motorista](#portal-do-motorista) · [USSD e SMS](#ussd-e-sms) · [Código e repositório](#código-e-repositório)

---

## Já corrigido

Estavam nesta lista e já não são limitações:

| Era | Agora |
|---|---|
| Os [SMS](conceitos.md#sms "As mensagens de texto curtas dos telemóveis.") de chegada só saíam enquanto alguém usava a web | Um [agendamento](conceitos.md#agendamento "Uma tarefa que corre sozinha a uma hora marcada, ou de tantos em tantos minutos.") do [GitHub Actions](conceitos.md#ci "Verificações que o GitHub corre sozinho a cada pull request, para nenhum erro conhecido chegar ao main.") corre a verificação a cada 5 minutos ([Fluxos de dados → Alerta de chegada](fluxos-de-dados.md#alerta-de-chegada-e-sms)). |
| A regra de tarifa só se mudava com [SQL](conceitos.md#sql "A linguagem com que se fazem perguntas e alterações a uma base de dados.") | Painel → Configuração → **Tarifa** ([Painel → Tarifa](painel-admin.md#tarifa)). |
| O portal do motorista guardava a rota e o veículo da entrada | Pergunta outra vez ao abrir e a cada 5 minutos (`GET /api/driver/me`). |
| Desenhar uma rota dependia só do [router](conceitos.md#router "Um serviço que, dados dois ou mais pontos, responde com o caminho pelas ruas entre eles e a distância.") de demonstração do OSRM | O painel pergunta primeiro ao router da FOSSGIS e ao de demonstração quando falha. |
| Pesquisar um telefone precisava do espaçamento guardado (`87 183`) | Quaisquer 3 ou mais algarismos, com qualquer espaçamento, com ou sem `258`. |
| A posição exacta do passageiro ia no [URL](conceitos.md#url "O texto que diz ao navegador onde está uma página ou informação, como https://transport-mz.vercel.app/viagem.") de `/api/journeys` e `/api/viagem`, e por isso nos [registos](conceitos.md#registos "As linhas de texto que um programa escreve sobre o que está a fazer, para se perceber depois o que aconteceu.") dos pedidos | A web envia-a no corpo de um [`POST`](conceitos.md#get-e-post "GET pede para ver uma coisa; POST envia dados para o servidor fazer algo com eles.") ([Segurança → Endpoints públicos](seguranca.md#endpoints-públicos)). |
| "Histórico" e "Agendar" na página dos relatórios levavam a páginas "em desenvolvimento" | Os botões saíram. |
| 340 veículos não tinham motorista | Cada um tem um motorista de demonstração ([Base de dados → Motoristas para os veículos importados](base-de-dados.md#motoristas-para-os-veículos-importados)). |
| 51 percursos de rotas desenhavam linhas rectas a cortar quarteirões | Postos nas estradas; o troço recto mais longo que resta tem 7,2 km na EN1, onde a estrada é recta ([Base de dados → Pôr os percursos nas estradas](base-de-dados.md#pôr-os-percursos-das-rotas-nas-estradas)). |
| Sem CI | Cada [pull request](conceitos.md#pull-request "Um pull request é o pedido para juntar um ramo ao main; o merge é a junção, quando o pedido é aceite.") verifica os tipos das três aplicações, compara os três [esquemas](conceitos.md#migracao "O esquema é a lista das tabelas e colunas; uma migração é uma alteração a essa lista, escrita em SQL para se poder repetir.") e confirma as ligações e a navegação da documentação ([Testes → CI no GitHub](testes.md#ci-no-github)). |
| No [USSD](conceitos.md#ussd "Os menus que aparecem num telemóvel quando se marca um código como *384*848080#; funcionam em qualquer telemóvel, sem internet."), um nome mal escrito ("chipamanine", "makalala") não encontrava nada, e uma lista errada obrigava a voltar atrás | A pesquisa aceita abreviaturas, sons iguais e erros, e escrever outro nome numa lista faz uma nova pesquisa ([Serviço USSD → Pesquisa tolerante](ussd.md#pesquisa-tolerante)). |
| A documentação e os comentários do código estavam em inglês | Estão em português, com o porquê de cada escolha. |
| A V086 (Rua dos Bons Amigos – Antena) parecia cortar 2 km em linha recta | A linha já segue a rua: o router dá o mesmo comprimento quando passa pelos pontos do percurso. Nada a redesenhar ([Base de dados → Uma rota listada que já está na estrada](base-de-dados.md#uma-rota-listada-que-já-está-na-estrada-v086)). |
| O [repositório](conceitos.md#repositorio "A pasta do projecto com todo o seu histórico no git.") guardava cerca de 340 ficheiros que não se publicavam: a aplicação antiga da raiz, a rota Telerivet, [scripts](conceitos.md#script "Um pequeno programa que se corre à mão, uma vez, para uma tarefa: importar dados, corrigir percursos, mostrar listas.") de uso único que escreviam na [base de dados](conceitos.md#base-de-dados "O sítio organizado onde a plataforma guarda tudo o que tem de durar: rotas, paragens, veículos, contas.") | Apagados em 2026-10-19; continuam no histórico do [git](conceitos.md#git "O programa que guarda o histórico de todas as versões do código, e quem mudou o quê e quando.") ([Visão geral → Código antigo](visao-geral.md#código-antigo-apagado)). |
| `USER_SESSION_SECRET` e `DRIVER_SESSION_SECRET` estavam como variáveis legíveis na [Vercel](conceitos.md#vercel "A empresa cujos servidores correm as três aplicações e as publicam a cada merge.") | Valores novos, guardados como Secret ([Segurança → Mudar segredos](seguranca.md#mudar-segredos)). |

## Posições e horas

- **A maior parte das posições é estimada.** Sem uma posição [GPS](conceitos.md#gps "O sistema de satélites com que um telemóvel ou um aparelho sabe as suas coordenadas.") dos últimos 3 minutos, a posição de um autocarro vem da viagem do motorista: desde que ele carregou em "Iniciar viagem", vai e volta ao longo da rota à velocidade da regra de tarifa, a partir do [terminal](conceitos.md#terminal "A janela onde se escrevem instruções para o computador em texto, em vez de clicar.") mais perto ([Localização e GPS](localizacao-gps.md#como-se-escolhe-uma-posição)). O trânsito e as paragens longas não contam, e um motorista que se esquece de iniciar ou terminar a viagem deixa os passageiros sem o autocarro, ou com um autocarro que já não anda.
  *Contornar:* dar GPS aos veículos. Cada um precisa de um código de dispositivo e de um [rastreador](conceitos.md#rastreador "Um aparelho (ou um telemóvel com uma aplicação) que envia a posição de um veículo pela internet; o código do dispositivo é a sua 'palavra-passe'.") ou de um telemóvel com o [Traccar Client](conceitos.md#traccar "Uma aplicação gratuita para telemóvel que envia a posição do telemóvel pelo protocolo OsmAnd.") ([Painel → Ligar um GPS](painel-admin.md#tarefa-gps)). Cada veículo equipado passa sozinho às posições reais; nada mais muda.
- **Sem histórico de posições.** Cada posição GPS substitui a anterior; não há um trajecto para rever ou analisar. `GeoLocation` só tem linhas da importação inicial.
  *Contornar:* juntar uma tabela de posições (veículo, hora, ponto, velocidade), escrita por `POST /api/gps` ao lado da actualização que já faz, e apagar as linhas antigas num agendamento. O plano gratuito da [Neon](conceitos.md#neon "A empresa que guarda a base de dados PostgreSQL da produção, na internet.") guarda cerca de 0,5 GB, por isso guardam-se semanas, não anos.
- **As distâncias usam o percurso guardado.** Uma rota sem `geoLocationPath` usa linhas rectas entre paragens × `fatorEstrada` (1,3 por omissão).
  *Contornar:* todas as rotas de produção têm percurso. "Nova Via" no painel guarda sempre um.
- **Os routers são serviços públicos gratuitos.** Desenhar rotas no painel e as caminhadas no mapa dos passageiros usam os [servidores](conceitos.md#servidor "Um computador sempre ligado que recebe pedidos e responde a eles.") da FOSSGIS e de demonstração do OSRM, que só permitem uso leve. Quando os dois estão em baixo, "Nova Via" e "Redesenhar percurso" não gravam, e as caminhadas desenham-se como linhas rectas.
  *Contornar:* esperar e tentar outra vez, o que chega para um administrador. Para muito tráfego, correr um servidor OSRM ou Valhalla com o extracto de Moçambique do [OpenStreetMap](conceitos.md#openstreetmap "Um mapa do mundo inteiro feito por voluntários, como uma Wikipédia dos mapas, que qualquer pessoa pode usar e corrigir.") (chega uma máquina virtual pequena) e definir `WALK_ROUTER_URL` para as caminhadas; os routers do painel são `ROUTERS` em [`RouteDrawer.tsx`](../transport-admin/app/components/RouteDrawer.tsx).
- **Percursos que passam duas vezes na mesma rua.** O percurso da X22 está desenhado ida e volta: em quase metade dele há outra parte do percurso a menos de 25 m, no outro sentido. Aí, uma posição GPS pode ficar no troço do outro sentido, e o autocarro aparece mais à frente ou mais atrás na rota, e no sentido contrário. Sem GPS (pela viagem do motorista) não há problema.
  *Contornar:* desenhar a X22 só de um terminal ao outro, como as outras rotas (os autocarros já vão e voltam por ele: [Rotas](painel-admin.md#rotas-vias)). Ou, no código, escolher entre os troços mais perto o que tem o rumo do GPS, para a posição e para o sentido, nas duas cópias de `lib/vehiclePosition.ts`.
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

- **O agendamento do [GitHub](conceitos.md#github "O site onde o repositório está guardado e partilhado, e onde se revêem as alterações.") não chega para os avisos de 15, 10 e 5 minutos.** O GitHub pede a verificação "a cada 5 minutos", mas num repositório público corre-a com grandes atrasos (em Outubro de 2026, a cada 40 a 50 minutos), e suspende-a num repositório sem actividade durante 60 dias. Sem tráfego na web, no USSD ou no portal, os avisos chegam tarde ou saltam passos.
  *Contornado* desde 2026-10-27: um cronjob do cron-job.org envia `POST https://transport-mz.vercel.app/api/simulation` com `{"action":"check"}` a cada minuto ([Guia do cron-job.org](guia-cron-job.md)). Outra forma seria o Vercel Cron num plano pago. Se o workflow ficar suspenso, ligá-lo outra vez em Actions → "Verificação de chegadas (SMS)" → Enable workflow.
- **O sistema não sabe quando o passageiro entra no autocarro.** Uma viagem acompanhada conta-o a bordo quando o autocarro anunciado sai da paragem de entrada. Quem o perdeu recebe a seguir os avisos de bordo desse autocarro.
  *Contornar:* o aviso "esta a chegar" diz quando chega o seguinte; o passageiro pede outra vez a viagem no USSD, o que começa um acompanhamento novo.
- Os alertas com mais de 24 horas são ignorados, e um alerta envia no máximo um SMS a cada 30 minutos. É de propósito: o passageiro pede outra vez para uma viagem nova.

## Dados

- **Os dados são uma demonstração.** As paragens e as rotas vêm do OpenStreetMap e de um primeiro conjunto de dados feito à imagem das rotas da [EMTPM](glossario.md#transportes-em-maputo "A Empresa Municipal de Transporte Público de Maputo"); os veículos, os motoristas e os proprietários são inventados ([Fontes de dados](fontes-de-dados.md)).
  *Contornar:* substituí-los pela frota e pelos motoristas reais dos operadores, no painel. Comparar as rotas e as paragens com as listas dos próprios operadores e corrigi-las no painel.
- **Os nomes das paragens repetem-se.** Muitas paragens têm o nome da rua, por isso uma rota pode listar "Rua do Cajueiro (Fedel Castro)" oito vezes, e alguns terminais têm nomes como "120". Os utilizadores vêem estes nomes na web, no USSD e nos SMS.
  *Contornar:* mudar o nome das paragens no painel (Paragens → a paragem → Editar). A maior parte dos nomes vem de [geocodificação](conceitos.md#geocodificacao "Transformar coordenadas no nome de um sítio (ou o contrário).") inversa (a rua mais próxima), por isso quem conhece os pontos de referência ("Mercado Xipamanine", uma escola, uma igreja) é a pessoa certa para o fazer.
- **Rotas importadas** ([Base de dados → Importar do OpenStreetMap](base-de-dados.md#importar-paragens-e-rotas-do-openstreetmap)):
  - os seus veículos (matrículas `ADA-001M` a `ADA-340M`) e motoristas são [dados de demonstração](conceitos.md#semente "Um conjunto pequeno de dados inventados que se carrega numa base de dados vazia para a experimentar.");
  - os dois sentidos seguem o percurso de ida, por isso nas ruas de sentido único a volta desenha-se na rua errada; as suas paragens a mais de 60 m desse percurso ficam de fora;
  - a regra de tarifa (10 MT por km por omissão) dá às rotas longas tarifas bem acima do que os [chapas](glossario.md#transportes-em-maputo "Os minibuses que levam a maior parte dos passageiros de Maputo") cobram.

  *Contornar:* substituir os veículos e os motoristas pelos reais no painel. Para as tarifas, baixar o "Preço por km" na página Tarifa, ou subir o mínimo e baixar o preço por km, até as rotas longas ficarem certas; a página mostra o efeito antes de gravar. Percursos de volta separados precisariam de uma segunda coluna de percurso em [`Via`](glossario.md#a-rede-e-as-pessoas "A tabela das rotas de autocarro (route)").
- **A ordem das paragens é calculada.** [`ViaParagem`](glossario.md#a-rede-e-as-pessoas "A ligação de uma paragem a uma rota") não tem coluna de ordem; as paragens ordenam-se projectando-as no percurso da rota. Uma paragem longe do percurso pode cair no sítio errado.
  *Contornar:* a página da rota no painel lista as paragens por esta ordem, por isso uma paragem fora do sítio vê-se lá. Mover a paragem para a estrada (Paragens → Editar), ou desligá-la dessa rota.
- **As [coordenadas](conceitos.md#coordenadas "Dois números que dizem onde está um ponto na Terra.") são texto.** Os pontos são textos `"lat,lng"` e os percursos `"lng,lat;…"` (atenção à ordem); não há PostGIS nem índice espacial ([Base de dados → Convenções](base-de-dados.md#convenções-ler-antes-de-consultar)). Chega a este tamanho (1 902 paragens).
  *Contornar:* não é preciso até a rede ser muitas vezes maior. A Neon aceita o PostGIS (`CREATE EXTENSION postgis`) se um dia for.
- **`Cidade` está vazia** e não tem ecrã; os municípios ligam-se directamente às províncias. A tabela ignora-se.
- **A "Data de Início de Operações" dos proprietários** guarda-se na coluna `birthDate`. Lê-se como essa data.

## Painel

- **Os certificados dos proprietários não se guardam.** O "Upload do Certificado (PDF)" do formulário dos proprietários é lido no [navegador](conceitos.md#navegador "O programa com que se abrem sites: Chrome, Firefox, Edge, Safari."), mas a [API](conceitos.md#api "Uma API é a lista de pedidos que um servidor aceita de outros programas; cada um desses pedidos, com o seu endereço, é um endpoint.") deita-o fora.
  *Contornar:* guardar os certificados fora do sistema por agora. Guardá-los precisa de um armazenamento de ficheiros (o Vercel Blob tem um plano gratuito), de uma coluna para o endereço do ficheiro em [`Proprietario`](glossario.md#a-rede-e-as-pessoas "A tabela dos donos dos veículos"), e do envio na API dos proprietários.
- **O "Raio de Cobertura"** nos formulários das províncias e dos municípios só muda o tamanho do círculo no mapa do formulário. Nada o usa.
- **Os relatórios são listas para imprimir:** a pré-visualização mostra os primeiros 8 campos de até 100 linhas, e os PDF saem da janela de impressão do navegador ("Guardar como PDF").
  *Contornar:* para uma tabela completa, correr uma consulta no SQL Editor da Neon e descarregar o resultado ([Guia da Neon](guia-neon.md)).
- **O início fica em cache 5 minutos** por instância do servidor; as páginas das listas não. As páginas das listas estão sempre actualizadas.
- **Sem papéis:** qualquer administrador pode fazer tudo, incluindo criar e apagar administradores.
  *Contornar:* só criar contas de administrador para quem deve ter controlo total. Os papéis precisariam de uma coluna `role` em [`Administrador`](glossario.md#a-rede-e-as-pessoas "A tabela das contas do painel de administração") e de uma verificação em `proxy.ts` ou em cada API.

## Portal do motorista

- **O autocarro no mapa do portal é o que os passageiros vêem, não o telemóvel.** Sem GPS, o portal põe o autocarro onde a viagem o calcula, que pode estar à frente ou atrás do autocarro real ([Portal do motorista → Painel](portal-motorista.md#painel-dashboard)).
  *Contornar:* partilhar o GPS do telemóvel no portal ou instalar o Traccar Client: o autocarro passa a estar onde o telemóvel está, para o motorista e para os passageiros.
- **O GPS do navegador pára em segundo plano.** Partilhar a posição do telemóvel a partir do portal só funciona com a página aberta e o ecrã ligado.
  *Contornar:* para seguir sem falhas, instalar o Traccar Client no telemóvel com o código do dispositivo do veículo ([Localização e GPS → Traccar Client](localizacao-gps.md#traccar-client-num-telemóvel)); continua a enviar com o ecrã desligado.
- **O estado da viagem não muda as posições.** "Iniciar viagem" e "Terminar viagem" são um estado partilhado com o USSD; não arrancam nem param o autocarro no mapa. As posições reais vêm do GPS.

## USSD e SMS

- **Só [sandbox](conceitos.md#africas-talking "O gateway de USSD e SMS usado por este projecto.").** O USSD e os SMS chegam ao simulador da Africa's Talking, não a telemóveis reais.
  *Contornar:* ir ao vivo não precisa de mudar o código: uma aplicação paga da Africa's Talking, um código USSD nas redes moçambicanas, uma [chave da API](conceitos.md#segredo "Um valor que só a plataforma deve saber, como uma palavra-passe: quem o tiver pode agir em nome dela.") ao vivo na Vercel e crédito. Os passos, por ordem, estão em [Africa's Talking → Passar a produção](africas-talking.md#passar-a-produção).
- **182 caracteres por ecrã.** Os nomes longos cortam-se com `..`, e os acentos tiram-se ([GSM-7](conceitos.md#gsm-7 "O conjunto de letras que todos os telemóveis mostram nos SMS e no USSD; não tem a maior parte das letras acentuadas.")). É um limite do próprio USSD; nomes de paragens mais curtos ajudam.
- **A pesquisa por nome tem limites.** Aceita abreviaturas, sons iguais e um ou dois erros, mas não nomes completamente diferentes (um nome popular que não está no nome da paragem) nem erros na primeira letra.
  *Contornar:* pôr o nome popular no nome da paragem no painel, ou juntá-lo às formas curtas de [`lib/places.ts`](../transport-client/lib/places.ts).

## Código e repositório

- **Três cópias do esquema.** `prisma/schema.prisma` é a referência; `transport-client/prisma/schema.prisma` tem de ser igual e `transport-admin/prisma/schema.prisma` só difere no bloco do generator. Mudam-se as três juntas; o CI falha quando diferem.
- **Duas cópias do código das posições.** `lib/vehiclePosition.ts` existe na aplicação dos passageiros e no painel; uma alteração às regras das posições tem de ir para as duas.
- **Muitos avisos antigos do lint** ([Testes](testes.md#tipos-e-lint)), por isso o lint não está no CI. A aplicação dos passageiros e o portal do motorista não têm [testes automáticos](conceitos.md#testes "Programas que experimentam as aplicações sozinhos e avisam quando algo deixou de funcionar."); [Testes](testes.md#aplicação-dos-passageiros-e-ussd-à-mão) lista o que confirmar à mão.
- **A produção não tem histórico de migrações** (`_prisma_migrations`), por isso as alterações ao esquema aplicam-se à mão com SQL idempotente ([Publicação → Alterações à base de dados em produção](publicacao.md#alterações-à-base-de-dados-em-produção)).

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Resolução de problemas](resolucao-de-problemas.md) · [Índice](README.md)
<!-- /navegação-fim -->
