# Primeiros passos

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 2. Montar localmente › **Primeiros passos** (página 5 de 23)

Anterior: [Estado do projecto](estado-do-projecto.md) · [Índice](README.md) · Seguinte: [Base de dados](base-de-dados.md)

<details>
<summary>Todas as páginas</summary>

- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: **Primeiros passos** · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

Esta página leva de uma máquina vazia às três aplicações a correr localmente, com dados de demonstração. Depois entra-se em cada aplicação e experimenta-se o USSD e o GPS na linha de comandos. Cada comando foi corrido numa base de dados nova ao escrever esta página.

> **Só para ver?** A plataforma está ao vivo: [README → Aplicações ao vivo](../README.md#aplicações-ao-vivo). Nada desta página é preciso para a usar.

**Nesta página:** [Pré-requisitos](#pré-requisitos) · [1. Clonar](#1-clonar) · [2. Base de dados](#2-arrancar-uma-base-de-dados) · [3. Ficheiros .env](#3-ficheiros-de-ambiente-env) · [4. Instalar](#4-instalar-as-dependências) · [5. Esquema](#5-criar-o-esquema) · [6. Dados de demonstração](#6-carregar-os-dados-de-demonstração) · [7. Correr](#7-correr-as-aplicações) · [8. Entrar](#8-entrar-em-cada-aplicação) · [9. USSD](#9-experimentar-o-menu-ussd) · [10. GPS](#10-enviar-uma-posição-gps) · [11. Ver os dados](#11-ver-os-dados) · [Cópia da produção](#trabalhar-com-uma-cópia-dos-dados-de-produção)

---

## Pré-requisitos

| Ferramenta | Versão | Porquê |
|---|---|---|
| Node.js | 20 ou mais recente (verificado com 22.23) | Cada aplicação é um projecto Next.js 16, com o seu próprio `node_modules`. |
| npm | o que vem com o Node | Instala as dependências de cada aplicação. |
| Git | qualquer | Para clonar e contribuir. |
| PostgreSQL | 16 ou mais recente | A base de dados. Usar o Docker (`docker compose`, abaixo) ou uma instalação nativa. A produção corre PostgreSQL 18 na Neon. |
| `psql` | opcional | Para consultar a base de dados à mão ([Base de dados → Ligar](base-de-dados.md#ligar-à-base-de-dados)). |

## 1. Clonar

```bash
git clone https://github.com/transportmozambique/Transport-Mozambique.git
cd Transport-Mozambique
```

O repositório tem as três aplicações publicadas (`transport-client`, `transport-admin`, `transport-driver`), o esquema Prisma partilhado e as migrações em `prisma/`, e uma aplicação antiga na raiz que não é publicada ([Visão geral → Estrutura do repositório](visao-geral.md#estrutura-do-repositório)).

## 2. Arrancar uma base de dados

**Com o Docker** (usa o [`docker-compose.yml`](../docker-compose.yml) da raiz):

```bash
docker compose up -d
# PostgreSQL 16 em localhost:5433, utilizador postgres, palavra-passe postgres123, base de dados transport_db
```

Endereço de ligação: `postgresql://postgres:postgres123@localhost:5433/transport_db`

**Com um PostgreSQL nativo**, criar uma base de dados vazia e usar o seu endereço, por exemplo `postgresql://postgres@localhost:5432/transport_dev`.

Porquê uma base de dados local: os dados de demonstração apagam tudo antes de inserir (passo 6), e os testes do painel criam e apagam linhas. Nada disto deve tocar na produção.

## 3. Ficheiros de ambiente (`.env`)

Criar um ficheiro `.env` por aplicação. O Next.js e o Prisma lêem o `.env`, e todos os `.env*` estão fora do git (nunca são publicados). A lista completa das variáveis, com o que cada uma faz, está em [Configuração](configuracao.md).

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

Gerar segredos com `openssl rand -base64 32` (ou `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).

## 4. Instalar as dependências

```bash
cd transport-client && npm install && cd ..   # também corre "prisma generate" (postinstall)
cd transport-admin  && npm install && npx prisma generate && cd ..
cd transport-driver && npm install && cd ..
```

O `transport-admin` não tem `postinstall`, por isso o cliente Prisma gera-se uma vez à mão (o seu `npm run build` também o faz). Porquê um `node_modules` por aplicação: cada uma é publicada sozinha na Vercel e instala só o que precisa.

## 5. Criar o esquema

O esquema e as migrações estão em [`prisma/`](../prisma). Aplicam-se com o Prisma da aplicação dos passageiros:

```bash
cd transport-client
npx prisma migrate deploy --schema ../prisma/schema.prisma
```

Fim esperado: `All migrations have been successfully applied.` Correm seis migrações, de `20260430170348_init` a `20261016150000_vehicle_gps`, que criam todas as tabelas, incluindo a regra de tarifa por omissão (`Tarifa`). Para confirmar que a base de dados corresponde ao esquema:

```bash
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel ../prisma/schema.prisma --exit-code
# código de saída 0 = nenhuma diferença
```

(`$DATABASE_URL` tem de estar exportada na shell para este comando; os outros lêem-na do `.env`.)

**Atenção:** `prisma migrate deploy` serve só para bases de dados novas. A produção não tem histórico de migrações e nunca se corre lá ([Publicação → Alterações à base de dados](publicacao.md#alterações-à-base-de-dados-em-produção)).

## 6. Carregar os dados de demonstração

```bash
# ainda em transport-client
npm run db:seed
```

**Atenção:** a semente ([`prisma/seed.ts`](../transport-client/prisma/seed.ts)) **apaga todas as linhas** de todas as tabelas antes de inserir. Nunca a apontar para uma base de dados com dados que interessem.

Os dados de demonstração são pequenos mas completos:

| Criado | Quantos |
|---|---|
| Administrador | 1 (`admin@transportmz.com` / `admin123`) |
| Províncias / municípios | 2 / 2 (Maputo, Matola) |
| Rotas (`Via`) | 18, com percursos rectos de 3 a 4 pontos |
| Paragens (`Paragem`) / ligações rota–paragem | 32 / 62 |
| Veículos (`Transporte`) | 25, todos numa rota |
| Motoristas (`Motorista`) | 5, cada um com um veículo, **ainda sem PIN** |
| Passageiros (`Utente`) | 3 (`+258840000001`, `+258850000002`, `+258860000003`, palavra-passe `123456`) |
| Proprietários (`Proprietario`) | 2 |

Estas contas só existem na base de dados local. A produção é muito maior (261 rotas pelas estradas, 1 902 paragens, 451 veículos); para trabalhar com ela, ver [Trabalhar com uma cópia dos dados de produção](#trabalhar-com-uma-cópia-dos-dados-de-produção).

## 7. Correr as aplicações

Abrir três terminais:

```bash
# Terminal 1: web dos passageiros, USSD, API do motorista, entrada de GPS
cd transport-client && npm run dev            # http://localhost:3000

# Terminal 2: painel de administração (o seu script também usaria a porta 3000)
cd transport-admin && npm run dev -- -p 3002  # http://localhost:3002

# Terminal 3: portal do motorista (o seu script fixa a porta 3001)
cd transport-driver && npm run dev            # http://localhost:3001
```

No Windows, [`start-all.bat`](../start-all.bat) abre as três, cada uma na sua janela.

| Aplicação | Local | Produção |
|---|---|---|
| Passageiros (`transport-client`) | http://localhost:3000 | https://transport-mz.vercel.app |
| Painel (`transport-admin`) | http://localhost:3002 | https://transport-mz-admin.vercel.app |
| Portal do motorista (`transport-driver`) | http://localhost:3001 | https://transport-mz-driver.vercel.app |

Para correr as versões de produção, usar `npm run build && npx next start -p <porta>` em cada pasta. O portal do motorista lê `NEXT_PUBLIC_API_URL` **na compilação**, por isso compila-se outra vez depois de mudar essa variável.

## 8. Entrar em cada aplicação

**Painel:** abrir http://localhost:3002/login e entrar com `admin@transportmz.com` / `admin123`. A sessão é um cookie `HttpOnly` válido 12 horas ([Segurança → Painel de administração](seguranca.md#painel-de-administração)).

<img src="images/admin-login.png" alt="Página de entrada do painel" width="480">

**Passageiro:** abrir http://localhost:3000/auth, escolher "Entrar", e entrar com o telefone `840000001` e a palavra-passe `123456`. O `+258` é opcional. Na mesma página pode registar-se uma conta nova.

<img src="images/passenger-auth.png" alt="Página de entrada e registo dos passageiros" width="480">

**Motorista:** os motoristas entram com um PIN gerado pelo administrador; ninguém escolhe o seu. Porquê: PINs escolhidos repetem-se (datas, 123456) e adivinham-se.

1. No painel, abrir **Motoristas**, abrir um motorista (por exemplo "Ana Sitoe", telefone `+258 84 567 8901`) e carregar em **"Gerar PIN"** no cartão "PIN de Acesso". O PIN de 6 algarismos é mostrado **uma vez**; só o seu hash bcrypt fica guardado.

   <img src="images/admin-driver-pin.png" alt="Cartão PIN de Acesso logo depois de gerar um PIN" width="280">

2. Abrir http://localhost:3001 e entrar com o telefone `845678901` e esse PIN.

   <img src="images/driver-login.png" alt="Entrada no portal do motorista: telefone e PIN" width="280">

3. Carregar em **"Iniciar viagem"**. O mesmo estado de viagem aparece no menu USSD do motorista ([Portal do motorista](portal-motorista.md)).

   <img src="images/driver-trip-active.png" alt="Portal do motorista com uma viagem em curso" width="280">

## 9. Experimentar o menu USSD

Há duas formas, sem a Africa's Talking.

**A. Com o script dos ecrãs** ([`scripts/ussd-ecras.ts`](../transport-client/scripts/ussd-ecras.ts)), que chama o handler directamente, sem servidor:

```bash
cd transport-client
npx tsx scripts/ussd-ecras.ts "" "1" "1*museu"
```

Cada argumento é o `text` que a Africa's Talking enviaria: todas as teclas até agora, separadas por `*` ([Serviço USSD → Leitura das teclas](ussd.md#leitura-das-teclas)). `USSD_HORA="2026-10-19T08:30:00+02:00"` fixa o relógio, para ver horários de dia mesmo à noite.

**B. Com `curl`, contra o servidor do passo 7** (o mesmo pedido que a Africa's Talking faz):

```bash
curl -s -X POST http://localhost:3000/api/ussd \
  --data-urlencode "sessionId=teste-1" --data-urlencode "serviceCode=*384*848080#" \
  --data-urlencode "phoneNumber=+258840000001" --data-urlencode "text="
```

A resposta é o menu principal, a começar por `CON`. Mudar `text` para `1`, depois `1*<nome de uma paragem>`, e assim por diante. Todos os ecrãs estão em [Serviço USSD](ussd.md).

Sem `AFRICASTALKING_API_KEY`, os SMS que os menus enviam ficam no terminal (`SMS não enviado para ...`).

## 10. Enviar uma posição GPS

1. No painel, abrir **Transportes**, abrir um veículo e carregar em **"Gerar código do dispositivo"** no cartão "Rastreador GPS". Copiar o código: só aparece uma vez.
2. Enviar uma posição como o Traccar Client faria (protocolo OsmAnd, velocidade em nós):

```bash
curl -s "http://localhost:3000/api/gps?id=<código do dispositivo>&lat=-25.9692&lon=32.5732&speed=10&bearing=90"
# {"ok":true}
```

Nos 3 minutos seguintes o veículo aparece nesse ponto no mapa dos passageiros e no painel; depois volta à posição pelo horário. O protocolo completo está em [Localização e GPS](localizacao-gps.md).

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

[Base de dados](base-de-dados.md) explica cada tabela, cada forma de ligar (incluindo o editor de SQL da Neon para a produção) e tem consultas de exemplo testadas.

---

## Trabalhar com uma cópia dos dados de produção

Os dados de demonstração são pequenos e as rotas são linhas rectas. Para ver a rede real localmente, é preciso acesso de leitura à base de dados de produção. O endereço está nas variáveis de ambiente do projecto na Vercel ([Configuração → Onde estão os valores](configuracao.md#onde-estão-os-valores)). Há duas opções:

**A. Um ramo (branch) da Neon (recomendado).** Na consola da Neon, criar um ramo do ramo de produção: é uma cópia instantânea, e a produção não é tocada. Pôr o endereço do ramo nos ficheiros `.env`. Apagar o ramo no fim ([Guia da Neon](guia-neon.md)).

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
