# Primeiros passos

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 2. Montar localmente › **Primeiros passos** (página 7 de 25)

Anterior: [Estado do projecto](estado-do-projecto.md) · [Índice](README.md) · Seguinte: [Base de dados](base-de-dados.md)

<details>
<summary>Todas as páginas</summary>

- 0. Começar do zero: [Conceitos básicos](conceitos.md) · [Preparar o computador](preparar-o-computador.md)
- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: **Primeiros passos** · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

> **Em palavras simples:** Esta página põe a plataforma a funcionar no próprio computador, com dados de exemplo, para a experimentar ou mudar sem tocar na versão verdadeira. Segue-se de cima para baixo, copiando os comandos; cada passo diz o que o comando faz. Antes, o computador tem de estar preparado: [Preparar o computador](preparar-o-computador.md).

Esta página leva de uma máquina vazia às três aplicações a correr localmente, com [dados de demonstração](conceitos.md#semente "Um conjunto pequeno de dados inventados que se carrega numa base de dados vazia para a experimentar."). Depois entra-se em cada aplicação e experimenta-se o [USSD](conceitos.md#ussd "Os menus que aparecem num telemóvel quando se marca um código como *384*848080#; funcionam em qualquer telemóvel, sem internet.") e o [GPS](conceitos.md#gps "O sistema de satélites com que um telemóvel ou um aparelho sabe as suas coordenadas.") na [linha de comandos](conceitos.md#terminal "A janela onde se escrevem instruções para o computador em texto, em vez de clicar."). Cada comando foi corrido numa [base de dados](conceitos.md#base-de-dados "O sítio organizado onde a plataforma guarda tudo o que tem de durar: rotas, paragens, veículos, contas.") nova ao escrever esta página.

> **Só para ver?** A plataforma está ao vivo: [README → Aplicações ao vivo](../README.md#aplicações-ao-vivo). Nada desta página é preciso para a usar.

**Nesta página:** [Pré-requisitos](#pré-requisitos) · [1. Clonar](#1-clonar) · [2. Base de dados](#2-arrancar-uma-base-de-dados) · [3. Ficheiros .env](#3-ficheiros-de-ambiente-env) · [4. Instalar](#4-instalar-as-dependências) · [5. Esquema](#5-criar-o-esquema) · [6. Dados de demonstração](#6-carregar-os-dados-de-demonstração) · [7. Correr](#7-correr-as-aplicações) · [8. Entrar](#8-entrar-em-cada-aplicação) · [9. USSD](#9-experimentar-o-menu-ussd) · [10. GPS](#10-enviar-uma-posição-gps) · [11. Ver os dados](#11-ver-os-dados) · [Cópia da produção](#trabalhar-com-uma-cópia-dos-dados-de-produção)

---

## Pré-requisitos

Como instalar cada um, passo a passo e sem conhecimentos prévios, e como abrir um terminal e ler os comandos: [Preparar o computador](preparar-o-computador.md). A tabela diz as versões e porquê.

| Ferramenta | Versão | Porquê |
|---|---|---|
| [Node.js](conceitos.md#nodejs "O programa que corre JavaScript fora do navegador, num computador ou num servidor.") | 20 ou mais recente (verificado com 22.23) | Cada aplicação é um projecto [Next.js](conceitos.md#nextjs "O Next.js é a 'estrutura' sobre a qual as três aplicações estão feitas; o React é a parte dele que desenha os ecrãs.") 16, com o seu próprio `node_modules`. |
| [npm](conceitos.md#npm "O npm descarrega e instala os pacotes (código feito por outros) de que cada aplicação precisa.") | o que vem com o Node | Instala as dependências de cada aplicação. |
| [Git](conceitos.md#git "O programa que guarda o histórico de todas as versões do código, e quem mudou o quê e quando.") | qualquer | Para [clonar](conceitos.md#clonar "Descarregar um repositório inteiro do GitHub para o computador, com o histórico.") e contribuir. |
| [PostgreSQL](conceitos.md#postgresql "O programa de base de dados que este projecto usa; gratuito e muito usado.") | 16 ou mais recente | A base de dados. Usar o [Docker](conceitos.md#docker "Um programa que corre outros programas dentro de 'contentores' já preparados, sem os instalar no computador.") (`docker compose`, abaixo) ou uma instalação nativa. A produção corre PostgreSQL 18 na [Neon](conceitos.md#neon "A empresa que guarda a base de dados PostgreSQL da produção, na internet."). |
| `psql` | opcional | Para consultar a base de dados à mão ([Base de dados → Ligar](base-de-dados.md#ligar-à-base-de-dados)). |

## 1. Clonar

```bash
git clone https://github.com/transportmozambique/Transport-Mozambique.git
cd Transport-Mozambique
```

O que faz: descarrega o código para uma pasta nova, `Transport-Mozambique`, e entra nela. Todos os passos seguintes partem desta pasta ([Preparar o computador → Descarregar o código](preparar-o-computador.md#descarregar-o-código)).

O [repositório](conceitos.md#repositorio "A pasta do projecto com todo o seu histórico no git.") tem as três aplicações publicadas (`transport-client`, `transport-admin`, `transport-driver`) e, em `prisma/`, o esquema [Prisma](conceitos.md#prisma "A ferramenta com que o código fala com a base de dados sem escrever SQL à mão.") partilhado e as migrações ([Visão geral → Estrutura do repositório](visao-geral.md#estrutura-do-repositório)).

## 2. Arrancar uma base de dados

**Com o Docker** (usa o [`docker-compose.yml`](../docker-compose.yml) da raiz):

```bash
docker compose up -d
# PostgreSQL 16 em localhost:5433, utilizador postgres, palavra-passe postgres123, base de dados transport_db
```

O que faz: arranca, em fundo (`-d`), a base de dados descrita no `docker-compose.yml`. O Docker Desktop tem de estar aberto. A base de dados fica a correr até se desligar o computador ou se correr `docker compose stop`; `docker compose up -d` arranca-a outra vez, com os dados que tinha.

Endereço de ligação: `postgresql://postgres:postgres123@localhost:5433/transport_db` ([o que é cada parte](preparar-o-computador.md#o-endereço-da-base-de-dados))

**Com um PostgreSQL instalado**, criar uma base de dados vazia e usar o seu endereço, por exemplo `postgresql://postgres:<palavra-passe>@localhost:5432/transport_dev` ([Preparar o computador → Opção B](preparar-o-computador.md#opção-b-instalar-o-postgresql) mostra como).

Porquê uma base de dados local: os dados de demonstração apagam tudo antes de inserir (passo 6), e os testes do painel criam e apagam linhas. Nada disto deve tocar na produção.

## 3. Ficheiros de ambiente (`.env`)

Criar um ficheiro [`.env`](conceitos.md#variavel-de-ambiente "Uma definição que se dá a um programa de fora do código, como o endereço da base de dados ou uma palavra-passe.") por aplicação, com o conteúdo abaixo. No VS Code: botão direito na pasta da aplicação → **New File…** → escrever `.env` → colar o conteúdo → Ctrl+S ([Preparar o computador → Instalar um editor de texto](preparar-o-computador.md#instalar-um-editor-de-texto)). Com a base de dados instalada (opção B), `DATABASE_URL` é o endereço dela em vez do do Docker. O Next.js e o Prisma lêem o `.env`, e todos os `.env*` estão fora do git (nunca são publicados). A lista completa das variáveis, com o que cada uma faz, está em [Configuração](configuracao.md).

`transport-client/.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres123@localhost:5433/transport_db"
# Opcionais em desenvolvimento: sem eles usa-se um segredo fixo só de desenvolvimento.
# Obrigatórios em produção (sem eles a entrada é recusada).
USER_SESSION_SECRET="um-texto-aleatorio-longo"
DRIVER_SESSION_SECRET="outro-texto-aleatorio-longo"
# Opcionais: sem chave da API, os SMS ficam só no registo da consola
# AFRICASTALKING_USERNAME="sandbox"
# AFRICASTALKING_API_KEY="..."
```

`transport-admin/.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres123@localhost:5433/transport_db"
ADMIN_SESSION_SECRET="um-terceiro-texto-aleatorio-longo"   # opcional em desenvolvimento
GPS_SERVER_URL="http://localhost:3000/api/gps"            # mostrado a quem configura um dispositivo GPS
```

`transport-driver/.env`:

```bash
# O portal do motorista não tem API própria: chama a aplicação dos passageiros
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

Gerar [segredos](conceitos.md#segredo "Um valor que só a plataforma deve saber, como uma palavra-passe: quem o tiver pode agir em nome dela.") com `openssl rand -base64 32` (ou `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). O comando escreve um texto aleatório no terminal, que se copia para o lugar de `um-texto-aleatorio-longo`. Para experimentar no próprio computador, os textos de exemplo também servem.

## 4. Instalar as dependências

```bash
cd transport-client && npm install && cd ..   # também corre "prisma generate" (postinstall)
cd transport-admin  && npm install && npx prisma generate && cd ..
cd transport-driver && npm install && cd ..
```

O que faz: entra em cada pasta, descarrega as dependências dessa aplicação para a sua pasta `node_modules`, e volta à pasta de cima (`cd ..`). Leva alguns minutos e escreve avisos (`npm warn …`), que se podem ignorar; um erro acaba com `npm error`.

O `transport-admin` não tem `postinstall`, por isso o cliente Prisma gera-se uma vez à mão (o seu `npm run build` também o faz). Porquê um `node_modules` por aplicação: cada uma é publicada sozinha na [Vercel](conceitos.md#vercel "A empresa cujos servidores correm as três aplicações e as publicam a cada merge.") e instala só o que precisa.

## 5. Criar o esquema

O esquema e as migrações estão em [`prisma/`](../prisma). Aplicam-se com o Prisma da aplicação dos passageiros:

```bash
cd transport-client
npx prisma migrate deploy --schema ../prisma/schema.prisma
```

O que faz: cria, na base de dados vazia, todas as tabelas, pela ordem das [migrações](conceitos.md#migracao). Fim esperado: `All migrations have been successfully applied.` Correm seis migrações, de `20260430170348_init` a `20261016150000_vehicle_gps`, que criam todas as tabelas, incluindo a regra de tarifa por omissão ([`Tarifa`](glossario.md#a-rede-e-as-pessoas "A regra de tarifa: preço mínimo, preço por km e velocidades")). Para confirmar que a base de dados corresponde ao esquema:

```bash
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel ../prisma/schema.prisma --exit-code
# código de saída 0 = nenhuma diferença
```

(Este comando lê `$DATABASE_URL` do terminal, e não do `.env`: antes, no mesmo terminal, `export DATABASE_URL="<o endereço do .env>"`. Os outros comandos lêem-na do `.env`.)

**Atenção:** `prisma migrate deploy` serve só para bases de dados novas. A produção não tem histórico de migrações e nunca se corre lá ([Publicação → Alterações à base de dados](publicacao.md#alterações-à-base-de-dados-em-produção)).

## 6. Carregar os dados de demonstração

```bash
# ainda em transport-client
npm run db:seed
```

O que faz: enche as tabelas com os dados de demonstração da tabela abaixo. Fim esperado: uma lista do que foi criado.

**Atenção:** a semente ([`prisma/seed.ts`](../transport-client/prisma/seed.ts)) **apaga todas as linhas** de todas as tabelas antes de inserir. Nunca a apontar para uma base de dados com dados que interessem.

Os dados de demonstração são pequenos mas completos:

| Criado | Quantos |
|---|---|
| Administrador | 1 (`admin@transportmz.com` / `admin123`) |
| Províncias / municípios | 2 / 2 (Maputo, Matola) |
| Rotas ([`Via`](glossario.md#a-rede-e-as-pessoas "A tabela das rotas de autocarro (route)")) | 18, com percursos rectos de 3 a 4 pontos |
| Paragens ([`Paragem`](glossario.md#a-rede-e-as-pessoas "A tabela das paragens (stop)")) / ligações rota–paragem | 32 / 62 |
| Veículos ([`Transporte`](glossario.md#a-rede-e-as-pessoas "A tabela dos veículos (vehicle)")) | 25, todos numa rota |
| Motoristas ([`Motorista`](glossario.md#a-rede-e-as-pessoas "A tabela dos motoristas e dos seus PIN")) | 5, cada um com um veículo, **ainda sem PIN** |
| Passageiros ([`Utente`](glossario.md#a-rede-e-as-pessoas "A tabela das contas de passageiros")) | 3 (`+258840000001`, `+258850000002`, `+258860000003`, palavra-passe `123456`) |
| Proprietários ([`Proprietario`](glossario.md#a-rede-e-as-pessoas "A tabela dos donos dos veículos")) | 2 |

Estas contas só existem na base de dados local. A produção é muito maior (261 rotas pelas estradas, 1 902 paragens, 451 veículos); para trabalhar com ela, ver [Trabalhar com uma cópia dos dados de produção](#trabalhar-com-uma-cópia-dos-dados-de-produção).

## 7. Correr as aplicações

Cada aplicação é um [servidor](conceitos.md#servidor "Um computador sempre ligado que recebe pedidos e responde a eles.") que fica a correr enquanto o seu terminal estiver aberto, por isso cada uma precisa do seu terminal. Abrir três terminais, todos na pasta `Transport-Mozambique`:

```bash
# Terminal 1: web dos passageiros, USSD, API do motorista, entrada de GPS
cd transport-client && npm run dev            # http://localhost:3000

# Terminal 2: painel de administração (o seu script também usaria a porta 3000)
cd transport-admin && npm run dev -- -p 3002  # http://localhost:3002

# Terminal 3: portal do motorista (o seu script fixa a porta 3001)
cd transport-driver && npm run dev            # http://localhost:3001
```

Cada uma escreve `Ready` quando está pronta; então abre-se o seu endereço no [navegador](conceitos.md#navegador "O programa com que se abrem sites: Chrome, Firefox, Edge, Safari."). Os terminais ficam abertos; Ctrl+C pára a aplicação desse terminal.

No Windows, um duplo clique em [`start-all.bat`](../start-all.bat), no Explorador de Ficheiros, abre as três, cada uma na sua janela.

| Aplicação | Local | Produção |
|---|---|---|
| Passageiros (`transport-client`) | http://localhost:3000 | https://transport-mz.vercel.app |
| Painel (`transport-admin`) | http://localhost:3002 | https://transport-mz-admin.vercel.app |
| Portal do motorista (`transport-driver`) | http://localhost:3001 | https://transport-mz-driver.vercel.app |

Para correr as versões de produção, usar `npm run build && npx next start -p <porta>` em cada pasta. O portal do motorista lê `NEXT_PUBLIC_API_URL` **na compilação**, por isso compila-se outra vez depois de mudar essa variável.

## 8. Entrar em cada aplicação

**Painel:** abrir http://localhost:3002/login e entrar com `admin@transportmz.com` / `admin123`. A [sessão](conceitos.md#sessao "Depois de entrar, o servidor dá uma prova de quem se é (um token), e o navegador mostra-a a cada pedido para não ter de pedir a palavra-passe outra vez.") é um cookie `HttpOnly` válido 12 horas ([Segurança → Painel de administração](seguranca.md#painel-de-administração)).

<img src="images/admin-login.png" alt="Página de entrada do painel" width="480">

**Passageiro:** abrir http://localhost:3000/auth, escolher "Entrar", e entrar com o telefone `840000001` e a palavra-passe `123456`. O `+258` é opcional. Na mesma página pode registar-se uma conta nova.

<img src="images/passenger-auth.png" alt="Página de entrada e registo dos passageiros" width="480">

**Motorista:** os motoristas entram com um PIN gerado pelo administrador; ninguém escolhe o seu. Porquê: PINs escolhidos repetem-se (datas, 123456) e adivinham-se.

1. No painel, abrir **Motoristas**, abrir um motorista (por exemplo "Ana Sitoe", telefone `+258 84 567 8901`) e carregar em **"Gerar PIN"** no cartão "PIN de Acesso". O PIN de 6 algarismos é mostrado **uma vez**; só o seu [hash](conceitos.md#hash "Uma 'impressão digital' de um texto, que se calcula num sentido e não se consegue desfazer.") bcrypt fica guardado.

   <img src="images/admin-driver-pin.png" alt="Cartão PIN de Acesso logo depois de gerar um PIN" width="280">

2. Abrir http://localhost:3001 e entrar com o telefone `845678901` e esse PIN.

   <img src="images/driver-login.png" alt="Entrada no portal do motorista: telefone e PIN" width="280">

3. Carregar em **"Iniciar viagem"**. O mesmo estado de viagem aparece no menu USSD do motorista ([Portal do motorista](portal-motorista.md)).

   <img src="images/driver-trip-active.png" alt="Portal do motorista com uma viagem em curso" width="280">

## 9. Experimentar o menu USSD

Há duas formas, sem a [Africa's Talking](conceitos.md#africas-talking "O gateway de USSD e SMS usado por este projecto.").

**A. Com o [script](conceitos.md#script "Um pequeno programa que se corre à mão, uma vez, para uma tarefa: importar dados, corrigir percursos, mostrar listas.") dos ecrãs** ([`scripts/ussd-ecras.ts`](../transport-client/scripts/ussd-ecras.ts)), que chama o handler directamente, sem servidor:

```bash
cd transport-client
npx tsx scripts/ussd-ecras.ts "" "1" "1*museu"
```

Cada argumento é o `text` que a Africa's Talking enviaria: todas as teclas até agora, separadas por `*` ([Serviço USSD → Leitura das teclas](ussd.md#leitura-das-teclas)). As viagens só contam com os autocarros cujo motorista iniciou a viagem: `USSD_TELEFONE="<telefone de um motorista>" npx tsx scripts/ussd-ecras.ts "6*<PIN>*1*1"` inicia uma ([Serviço USSD → Testar](ussd.md#testar)).

**B. Com [`curl`](conceitos.md#curl "Um comando que faz pedidos HTTP a partir do terminal, como um navegador sem janela."), contra o servidor do passo 7** (o mesmo pedido que a Africa's Talking faz):

```bash
curl -s -X POST http://localhost:3000/api/ussd \
  --data-urlencode "sessionId=teste-1" --data-urlencode "serviceCode=*384*848080#" \
  --data-urlencode "phoneNumber=+258840000001" --data-urlencode "text="
```

O que faz: envia à aplicação local o mesmo pedido que a Africa's Talking envia quando alguém marca o código. `sessionId` identifica a conversa, `phoneNumber` é quem marca, e `text` são as teclas carregadas até agora (vazio: acabou de marcar). A resposta é o menu principal, a começar por `CON`. Mudar `text` para `1`, depois `1*<nome de uma paragem>`, e assim por diante. Todos os ecrãs estão em [Serviço USSD](ussd.md).

Sem `AFRICASTALKING_API_KEY`, os [SMS](conceitos.md#sms "As mensagens de texto curtas dos telemóveis.") que os menus enviam ficam no terminal (`SMS não enviado para ...`).

## 10. Enviar uma posição GPS

1. No painel, abrir **Transportes**, abrir um veículo e carregar em **"Gerar [código do dispositivo](conceitos.md#rastreador "Um aparelho (ou um telemóvel com uma aplicação) que envia a posição de um veículo pela internet; o código do dispositivo é a sua 'palavra-passe'.")"** no cartão "Rastreador GPS". Copiar o código: só aparece uma vez.
2. Enviar uma posição como o [Traccar Client](conceitos.md#traccar "Uma aplicação gratuita para telemóvel que envia a posição do telemóvel pelo protocolo OsmAnd.") faria (protocolo OsmAnd, velocidade em nós):

```bash
curl -s "http://localhost:3000/api/gps?id=<código do dispositivo>&lat=-25.9692&lon=32.5732&speed=10&bearing=90"
# {"ok":true}
```

O que faz: abre o endereço `/api/gps` com a posição nos [parâmetros](conceitos.md#parametros "As três formas de um pedido levar informação: no endereço, no conteúdo, ou em etiquetas à parte."), como um rastreador faria ([Conceitos básicos → Protocolo OsmAnd](conceitos.md#osmand)); `{"ok":true}` quer dizer que a posição foi aceite. Nos 3 minutos seguintes o veículo aparece nesse ponto no mapa dos passageiros e no painel; depois volta à posição pelo horário. O protocolo completo está em [Localização e GPS](localizacao-gps.md).

## 11. Ver os dados

```bash
cd transport-client
npx prisma studio --schema ../prisma/schema.prisma   # http://localhost:5555
```

Ou com `psql`:

```bash
psql "postgresql://postgres:postgres123@localhost:5433/transport_db" \
  -c 'SELECT matricula, "viaId", "currGeoLocation" FROM "Transporte" LIMIT 5'
```

Ou como listas prontas que juntam tabelas (rotas, paragens de uma rota por ordem, veículos com motorista, motoristas com ou sem PIN), com [`scripts/queries.ts`](../transport-client/scripts/queries.ts):

```bash
cd transport-client
npx tsx scripts/queries.ts routes
npx tsx scripts/queries.ts stops VIA-1A     # um código de rota da lista acima
```

[Base de dados](base-de-dados.md) explica cada tabela, cada forma de ligar (incluindo o editor de [SQL](conceitos.md#sql "A linguagem com que se fazem perguntas e alterações a uma base de dados.") da Neon para a produção) e tem consultas de exemplo testadas.

---

## Trabalhar com uma cópia dos dados de produção

Os dados de demonstração são pequenos e as rotas são linhas rectas. Para ver a rede real localmente, é preciso acesso de leitura à base de dados de produção. O endereço está nas variáveis de ambiente do projecto na Vercel ([Configuração → Onde estão os valores](configuracao.md#onde-estão-os-valores)). Há duas opções:

**A. Um [ramo](conceitos.md#ramo "Uma linha de trabalho separada, onde se fazem mudanças sem tocar na versão principal.") (branch) da Neon (recomendado).** Na consola da Neon, criar um ramo do ramo de produção: é uma cópia instantânea, e a produção não é tocada. Pôr o endereço do ramo nos ficheiros `.env`. Apagar o ramo no fim ([Guia da Neon](guia-neon.md)).

**B. Uma cópia (dump) no PostgreSQL local.** O `pg_dump` tem de ser pelo menos tão recente como o servidor (PostgreSQL 18), por isso corre-se a partir da imagem Docker correspondente:

```bash
# Só lê da origem. Usar o endereço directo (sem "-pooler") para o pg_dump.
docker run --rm -v "$PWD:/out" postgres:18 \
  pg_dump "$PROD_DIRECT_URL" --no-owner --no-privileges -Fc -f /out/prod.dump

# Criar uma base de dados vazia, e restaurar para ela (também com as ferramentas do PostgreSQL 18).
# host.docker.internal chega à máquina a partir do contentor (no Linux, juntar
# --add-host=host.docker.internal:host-gateway ao docker run).
docker compose exec postgres createdb -U postgres transport_copy
docker run --rm -v "$PWD:/out" postgres:18 \
  pg_restore --no-owner --no-privileges \
  -d "postgresql://postgres:postgres123@host.docker.internal:5433/transport_copy" /out/prod.dump
```

Uma cópia do PostgreSQL 18 pode não restaurar bem num PostgreSQL 16. Com a base de dados Docker do passo 2, mudar a imagem para `postgres:18-alpine`, ou usar a opção A. A cópia tem nomes e telefones de passageiros: mantê-la fora de pastas partilhadas e apagá-la no fim.

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Estado do projecto](estado-do-projecto.md) · [Índice](README.md) · Seguinte: [Base de dados](base-de-dados.md)
<!-- /navegação-fim -->
