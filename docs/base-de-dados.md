# Base de dados

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 2. Montar localmente › **Base de dados** (página 6 de 23)

Anterior: [Primeiros passos](primeiros-passos.md) · [Índice](README.md) · Seguinte: [Configuração](configuracao.md)

<details>
<summary>Todas as páginas</summary>

- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · **Base de dados** · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

Toda a plataforma usa uma só base de dados PostgreSQL: a Neon em produção, com PostgreSQL 18. O esquema está definido uma vez, em [`prisma/schema.prisma`](../prisma/schema.prisma), e é acedido pelo Prisma 5.22. Esta página descreve cada tabela e as convenções de armazenamento que é preciso conhecer para ler bem os dados; depois mostra como ligar, consultas de exemplo testadas numa cópia da produção, e os scripts que construíram os dados.

**Nesta página:** [Diagrama](#diagrama-das-entidades) · [Tabelas](#tabelas) · [Convenções](#convenções-ler-antes-de-consultar) · [Ligar](#ligar-à-base-de-dados) · [Consultas de exemplo](#consultas-de-exemplo) · [Mudar dados](#mudar-dados) · [Importar do OpenStreetMap](#importar-paragens-e-rotas-do-openstreetmap) · [Percursos nas estradas](#pôr-os-percursos-das-rotas-nas-estradas) · [Redesenhar a partir do OSM](#redesenhar-rotas-a-partir-das-suas-paragens-do-openstreetmap) · [Motoristas de demonstração](#motoristas-para-os-veículos-importados) · [Alterações ao esquema](#alterações-ao-esquema-e-migrações) · [Tamanho](#tamanho)

---

## Diagrama das entidades

```mermaid
erDiagram
  Administrador ||--o{ Provincia : "gere (opcional)"
  Administrador ||--o{ Municipio : "gere (opcional)"
  Administrador ||--o{ Via : "gere (opcional)"
  Administrador ||--o{ Paragem : "gere (opcional)"
  Provincia ||--o{ Cidade : tem
  Provincia ||--o{ Municipio : tem
  Cidade ||--o{ Municipio : tem
  Municipio ||--o{ Via : tem
  Via ||--o{ ViaParagem : "paragens da rota"
  Paragem ||--o{ ViaParagem : "rotas que passam"
  Via ||--o{ Transporte : "veículos da rota"
  Transporte ||--o| Motorista : "conduzido por (um)"
  Transporte ||--o{ TransporteProprietario : "pertence a"
  Proprietario ||--o{ TransporteProprietario : "é dono de"
  Transporte ||--o{ GeoLocation : "histórico antigo"
  Utente ||--o{ MISSION : "espera em"
  Paragem ||--o{ MISSION : "alertas em"

  Via {
    string id PK
    string codigo UK
    string nome
    string terminalPartida
    string terminalChegada
    string geoLocationPath "lng,lat;lng,lat;…"
    string municipioId FK
  }
  Paragem {
    string id PK
    string codigo UK
    string nome
    string geoLocation "lat,lng"
  }
  ViaParagem {
    string id PK
    string viaId FK
    string paragemId FK
    boolean terminalBoolean
  }
  Transporte {
    string id PK
    string matricula UK
    int codigo UK
    string viaId FK
    string currGeoLocation "lat,lng"
    string gpsDispositivoHash UK "sha256"
    datetime gpsAtualizadoEm
  }
  Motorista {
    string id PK
    string telefone
    string password "PIN em bcrypt, ou null"
    boolean emViagem
    string transporteId FK "único"
  }
  Utente {
    string id PK
    string telefone UK
    string senha "bcrypt, ou temp"
  }
  MISSION {
    string id PK
    string utenteId FK
    string paragemId FK
    datetime createdAt
    datetime notificadoEm
  }
  Tarifa {
    string id PK
    string nome UK
    int tarifaMinima
    float precoPorKm
    boolean ativa
  }
```

`Tarifa` está sozinha: nenhuma chave estrangeira aponta para ela. O diagrama mostra só as colunas principais; todas estão listadas abaixo.

## Tabelas

O Prisma liga cada modelo a uma tabela com o mesmo nome, por isso os nomes misturam maiúsculas e minúsculas e **têm de estar entre aspas duplas no SQL** (`"Transporte"`, `"viaId"`). Cada `id` é um texto [cuid](https://github.com/paralleldrive/cuid). A maior parte das tabelas tem `createdAt` e `updatedAt`.

### Rede

| Tabela | Uma linha é | Colunas principais |
|---|---|---|
| `Provincia` | uma província | `nome`, `codigo` (único), `geoLocation` (centro `lat,lng`), `administradorId` |
| `Cidade` | uma cidade (sem uso: sem interface, 0 linhas) | `nome`, `codigo`, `provinciaId` |
| `Municipio` | um município (Maputo, Matola) | `nome`, `codigo` (único), `geoLocation`, `endereco`, `contacto1`, `provinciaId`, `cidadeId` |
| `Via` | uma rota (um sentido de uma linha, ou os dois) | `codigo` (único, ex: `V063`), `nome`, `cor` (cor hexadecimal nos mapas), `terminalPartida`, `terminalChegada` (nomes das pontas), `geoLocationPath` (o percurso pelas estradas), `municipioId`, `codigoMunicipio` |
| `Paragem` | uma paragem | `codigo` (único, ex: `PAR-0869`), `nome`, `geoLocation` |
| `ViaParagem` | "esta paragem está nesta rota" | `viaId`, `paragemId` (únicos em conjunto; os dois apagam em cascata), `terminalBoolean`, `codigoVia`, `codigoParagem` |

### Frota e pessoas

| Tabela | Uma linha é | Colunas principais |
|---|---|---|
| `Transporte` | um veículo | `matricula` (única), `codigo` (número único), `marca`, `modelo`, `cor`, `lotacao` (lugares), `viaId` + `codigoVia` (a rota), `currGeoLocation` (última posição guardada), `routePath` (desactualizado, ver abaixo), `gpsDispositivoHash`, `gpsAtualizadoEm`, `gpsVelocidade` (km/h), `gpsDirecao` (graus, 0 = norte) |
| `Motorista` | um motorista | `nome`, `telefone`, `email` (único), `bi` (único), `cartaConducao` (única), `categoriaCarta`, `experienciaAnos`, datas da carta e do BI, contacto de emergência, `foto` (URL), `status` (`ativo`/`inativo`/`suspenso`: a conta), `password` (hash bcrypt do PIN, ou null = não pode entrar), `emViagem` + `viagemIniciadaEm` (viagem em curso), `transporteId` (único: um veículo por motorista e um motorista por veículo) |
| `Proprietario` | um dono de veículos (pessoa ou empresa) | `nome`, `bi` (único), `nacionalidade`, `birthDate`, `endereco`, `contacto1`, `contacto2`, `tipoProprietario` (`Indivíduo`/`Empresa`) |
| `TransporteProprietario` | "este proprietário é dono deste veículo" | `transporteId`, `proprietarioId` (únicos em conjunto), `codigoTransporte`, `idProprietario` |
| `Administrador` | uma conta do painel | `nome`, `email` (único), `senha` (bcrypt) |

### Passageiros e operação

| Tabela | Uma linha é | Colunas principais |
|---|---|---|
| `Utente` | um passageiro | `nome`, `email` (único), `telefone` (único), `senha` (hash bcrypt, ou `temp` nas contas criadas por USSD), `mISSION` (código de referência único), `subscrito`, `dataSubscricao` |
| `MISSION` | um alerta de chegada: "este passageiro espera nesta paragem" | `utenteId`, `paragemId`, `createdAt` (alertas com mais de 24 h são ignorados), `notificadoEm` (último SMS de chegada), `geoLocationParagem`, `codigoParagem`, `mISSIONUtente` |
| `Tarifa` | a regra de tarifa e velocidades | `nome` (único), `tarifaMinima` (MT), `precoPorKm` (MT/km), `fatorEstrada`, `velocidadeViagemKmh`, `velocidadeChegadaKmh`, `ativa`. Usa-se a linha activa mais recente ([Configuração](configuracao.md#regra-de-tarifa-tarifa)) |
| `GeoLocation` | histórico antigo de posições (a actual e as 3 anteriores) | preenchida pela importação inicial; nada publicado escreve nela. As posições vivem agora em `Transporte` |

## Convenções (ler antes de consultar)

Estas convenções vêm do primeiro modelo de dados e ficaram porque mudá-las obrigaria a migrar todas as aplicações ao mesmo tempo. Cada uma diz como a ler.

- **Os pontos são texto `"lat,lng"`.** Exemplos: `Paragem.geoLocation`, `Transporte.currGeoLocation`, `MISSION.geoLocationParagem`, `Municipio.geoLocation` (`"-25.8388631,32.5536334"`). Separar com `split_part(col, ',', 1)::float` para a latitude e `split_part(col, ',', 2)::float` para a longitude.
- **Os percursos são texto `"lng,lat;lng,lat;…"`, na ordem inversa (a ordem do GeoJSON).** `Via.geoLocationPath` é o percurso que os autocarros da rota fazem, com um ponto a cada ~50 m (até 1 450 pontos). É a referência para posições, distâncias e tarifas. `Transporte.routePath` usa o mesmo formato mas está **desactualizado na maioria dos veículos** (foi copiado entre rotas na importação): usar o da rota.
- **Sem PostGIS.** As coordenadas são texto, sem índice espacial. As distâncias calculam-se nas aplicações (haversine, [`lib/fares.ts`](../transport-client/lib/fares.ts)) ou em SQL ([exemplo](#paragens-a-menos-de-500-m-de-um-ponto)). Porquê: com 2 000 paragens tudo cabe em memória, e a rede é lida uma vez e guardada 5 minutos por instância ([`lib/journeys.ts`](../transport-client/lib/journeys.ts)).
- **`ViaParagem` não tem coluna de ordem.** A ordem de inserção não é a ordem de viagem. As aplicações ordenam as paragens de uma rota pelo sítio onde cada uma se projecta em `Via.geoLocationPath` (`orderStopsAlongRoute` em [`lib/fares.ts`](../transport-client/lib/fares.ts)). Porquê assim: a ordem acompanha o percurso sozinha quando o percurso é redesenhado.
- **As horas são UTC, guardadas sem fuso horário** (`timestamp(3) without time zone`). Começar cada sessão de SQL com `SET TIME ZONE 'UTC';`, senão as comparações com `now()` ficam desviadas pelo fuso da sessão. Para mostrar: `(col AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Maputo'`. Maputo é UTC+2 todo o ano.
- **Os números de telefone vêm em vários formatos.** Os dos motoristas são como `+258 87 183 1581`; os passageiros registados na web, `849990777`; as contas criadas por USSD, `+258849990777`. As aplicações comparam os números depois de tirar espaços e o `+258` ([`lib/phones.ts`](../transport-client/lib/phones.ts)).
- **As colunas de texto `codigo*` e `id*` repetem chaves estrangeiras** (`codigoVia`, `codigoParagem`, `codigoMunicipio`, `codigoTransporte`, `idProprietario`). São códigos legíveis do modelo original. As junções fazem-se pelas chaves verdadeiras (`viaId`, `paragemId`, `municipioId`, `transporteId`, `proprietarioId`).
- **`Motorista.status` é o estado da conta; `emViagem` é a viagem.** Um motorista pode estar `ativo` e não estar em viagem.
- **GPS recente quer dizer `gpsAtualizadoEm` nos últimos 3 minutos.** Todos os leitores ignoram posições mais antigas; nesse caso `currGeoLocation` é só o último ponto conhecido, não onde o veículo está ([Localização e GPS](localizacao-gps.md#como-se-escolhe-uma-posição)).

## Ligar à base de dados

### Produção (Neon)

Os endereços de ligação estão nas variáveis de ambiente dos projectos da Vercel (`DATABASE_URL`) e na consola da Neon, no botão **Connect** do projecto. A Neon dá dois endereços para a mesma base de dados:

| Endereço | Parece-se com | Para quê |
|---|---|---|
| Pooled | `ep-…-pooler.<região>.aws.neon.tech` | as aplicações (as funções serverless abrem muitas ligações curtas, e o pooler partilha-as) |
| Directo | `ep-….<região>.aws.neon.tech` (sem `-pooler`) | sessões `psql`, `pg_dump`, alterações ao esquema (`prisma db execute`), tudo o que use estado de sessão |

Quatro formas de entrar:

1. **Consola da Neon → SQL Editor.** Corre SQL no navegador contra o ramo escolhido, sem instalar nada. Bom para leituras rápidas.
2. **`psql "<endereço directo>"`.** A Neon exige TLS, e o endereço já tem `sslmode=require`.
3. **Prisma Studio.** Um navegador de tabelas ligado por `DATABASE_URL` ([abaixo](#prisma-studio)).
4. **Prisma Client num script.** Listas prontas que juntam tabelas, ou outras ([abaixo](#prisma-client-num-script)).

#### Consola da Neon

O [Guia da Neon](guia-neon.md) percorre a consola passo a passo, com uma imagem por passo e consultas que seguem cada fluxo de dados. Em resumo:

Entrar em https://console.neon.tech, abrir o projecto **TransportMZ** e confirmar o ramo no canto superior esquerdo (`production` são os dados ao vivo).

- **SQL Editor** (menu da esquerda): escolher a base de dados `neondb`, colar uma consulta das [Consultas de exemplo](#consultas-de-exemplo), carregar em **Run**. O editor abre com o exemplo da própria Neon (`CREATE TABLE … INSERT …`): substituí-lo em vez de o correr, senão cria uma tabela na produção.

  ![Editor de SQL da Neon: as paragens com mais rotas](images/neon-sql-editor.png)

- **Tables** (menu da esquerda): percorrer uma tabela página a página, com filtros e ordenação, sem SQL. Também edita e junta linhas: em `production`, preferir o painel de administração, que mantém as linhas relacionadas coerentes.

  ![Vista Tables da Neon: a tabela Paragem](images/neon-tables.png)

- **Branches**: criar um ramo de `production` para experimentar uma alteração numa cópia. **Connect** mostra os endereços, incluindo a palavra-passe: não o fotografar nem partilhar.

Para quem só precisa de ler, criar um papel só de leitura (consola da Neon → Roles, ou SQL como dono) em vez de partilhar as credenciais do dono:

```sql
CREATE ROLE analista WITH LOGIN PASSWORD 'escolher-uma-palavra-passe-forte';
GRANT CONNECT ON DATABASE <base de dados> TO analista;
GRANT USAGE ON SCHEMA public TO analista;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analista;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO analista;
```

Para experiências que escrevem, usar um **ramo** da produção: uma cópia instantânea que se apaga no fim ([Primeiros passos](primeiros-passos.md#trabalhar-com-uma-cópia-dos-dados-de-produção)).

### Local

```bash
psql "postgresql://postgres:postgres123@localhost:5433/transport_db"   # base de dados do docker compose
```

### Prisma Studio

```bash
cd transport-client
npx prisma studio --schema ../prisma/schema.prisma    # abre http://localhost:5555
```

Lista cada modelo com o número de linhas. A imagem abaixo é de uma cópia dos dados de produção.

![Prisma Studio: cada modelo com o número de linhas](images/studio-models.png)

Abrir um modelo mostra as linhas; as colunas de relação ligam às linhas relacionadas:

![Prisma Studio: a tabela Transporte](images/studio-transporte.png)

### Prisma Client num script

O Prisma Studio mostra uma tabela de cada vez. Para uma lista que junta tabelas (rotas com o número de paragens, as paragens de uma rota pela ordem de viagem, veículos com o motorista), usa-se o Prisma Client, a mesma biblioteca com que as aplicações consultam. [`transport-client/scripts/queries.ts`](../transport-client/scripts/queries.ts) tem listas prontas e só lê.

Corre-se em `transport-client`. Lê `DATABASE_URL` de `transport-client/.env`, ou do ambiente:

```bash
cd transport-client
npx tsx scripts/queries.ts routes matola
DATABASE_URL="<endereço>" npx tsx scripts/queries.ts drivers    # outra base de dados, sem mexer no .env
```

| Comando | Lista |
|---|---|
| `npx tsx scripts/queries.ts counts` | Linhas nas tabelas principais |
| `npx tsx scripts/queries.ts routes [município]` | Rotas com o número de paragens e de veículos; `routes matola` lista só as da Matola |
| `npx tsx scripts/queries.ts stops <código da rota>` | As paragens de uma rota pela ordem de viagem, ordenadas como as aplicações as ordenam (`stops V034`) |
| `npx tsx scripts/queries.ts vehicles [código da rota]` | Veículos com a rota, o motorista, o estado da viagem e do GPS (`sem dispositivo`, `ativo`, `sem sinal`) |
| `npx tsx scripts/queries.ts drivers` | Motoristas: estado da conta, se têm PIN, viagem, veículo e rota |
| `npx tsx scripts/queries.ts alerts` | Alertas de chegada das últimas 24 horas, por paragem, sem dados de passageiros |

Saída de `npx tsx scripts/queries.ts stops V034` numa cópia da produção (primeiras linhas):

```text
Av. das Indústrias - Rua da Igreja
┌─────────┬───────┬────────────┬──────────────────────────┬──────────────────────────────────────────┐
│ (index) │ ordem │ codigo     │ nome                     │ coordenadas                              │
├─────────┼───────┼────────────┼──────────────────────────┼──────────────────────────────────────────┤
│ 0       │ 1     │ 'PAR-0792' │ 'Av. das Indústrias'     │ '-25.8889299,32.4342488'                 │
│ 1       │ 2     │ 'PAR-0791' │ 'Av. das Indústrias'     │ '-25.8888211,32.4342692'                 │
│ 2       │ 3     │ 'PAR-0301' │ 'Avenida das Indústrias' │ '-25.893347300000002,32.442886200000004' │
```

**Juntar uma lista.** Cada lista é uma função do objecto `lists` de `scripts/queries.ts`. Uma consulta Prisma indica o modelo (`prisma.via`, `prisma.paragem`, `prisma.transporte`, `prisma.motorista`, `prisma.mISSION`, …) e depois:

- `where` filtra, também através das relações;
- `select` escolhe colunas e linhas relacionadas;
- `_count` conta linhas relacionadas;
- `orderBy` ordena.

Por exemplo, as rotas de um município que têm pelo menos um veículo:

```ts
async busyRoutes(municipio) {
  const vias = await prisma.via.findMany({
    where: {
      municipio: { nome: { contains: municipio ?? '', mode: 'insensitive' } },
      transportes: { some: {} },
    },
    select: { codigo: true, nome: true, _count: { select: { transportes: true } } },
    orderBy: { codigo: 'asc' },
  });
  console.table(vias.map((v) => ({ codigo: v.codigo, nome: v.nome, autocarros: v._count.transportes })));
},
```

Os nomes dos modelos e campos são os de `prisma/schema.prisma` ([Tabelas](#tabelas)). A sintaxe está na [referência CRUD do Prisma](https://www.prisma.io/docs/orm/prisma-client/queries/crud). Estes scripts ficam só de leitura: as alterações aos dados da rede fazem-se no painel ([Mudar dados](#mudar-dados)).

## Consultas de exemplo

Cada consulta abaixo foi corrida com `psql` numa cópia dos dados de produção em 2026-10-17, e as saídas são reais. Colá-las no editor de SQL da Neon ou numa sessão `psql` ([Ligar](#ligar-à-base-de-dados)). As saídas que mostrariam nomes ou telefones de passageiros ficaram de fora. Começar a sessão com:

```sql
SET TIME ZONE 'UTC';
```

### Linhas por tabela

```sql
SELECT 'Via' AS tabela, count(*) FROM "Via"
UNION ALL SELECT 'Paragem', count(*) FROM "Paragem"
UNION ALL SELECT 'ViaParagem', count(*) FROM "ViaParagem"
UNION ALL SELECT 'Transporte', count(*) FROM "Transporte"
UNION ALL SELECT 'Motorista', count(*) FROM "Motorista"
UNION ALL SELECT 'Tarifa', count(*) FROM "Tarifa";
```

```text
   tabela   | count
------------+-------
 Via        |    91
 Paragem    |  1079
 ViaParagem |  3312
 Transporte |   111
 Motorista  |   111
 Tarifa     |     1
```

(Antes da importação do OpenStreetMap; os números de hoje estão em [Tamanho](#tamanho).)

### Rotas com paragens, veículos e tamanho do percurso

```sql
SELECT v.codigo, v.nome, m.nome AS municipio,
       count(DISTINCT vp."paragemId") AS paragens,
       count(DISTINCT t.id)           AS autocarros,
       array_length(string_to_array(v."geoLocationPath", ';'), 1) AS pontos_no_percurso
FROM "Via" v
JOIN "Municipio" m        ON m.id = v."municipioId"
LEFT JOIN "ViaParagem" vp ON vp."viaId" = v.id
LEFT JOIN "Transporte" t  ON t."viaId" = v.id
GROUP BY v.id, m.nome
ORDER BY autocarros DESC, paragens DESC
LIMIT 5;
```

```text
 codigo  |          nome          | municipio | paragens | autocarros | pontos_no_percurso
---------+------------------------+-----------+----------+------------+--------------------
 VIA-109 | Rota 109               | Maputo    |       15 |          3 |               1450
 V102    | Moamba - Rua da Escola | Matola    |      149 |          2 |               1144
 V101    | Moamba - Djimomposse   | Matola    |      149 |          2 |                969
 V100    | Moamba - 2 Igreja      | Matola    |      133 |          2 |                933
 V099    | Moamba - Cololuene     | Matola    |      127 |          2 |                891
```

### Um veículo com o motorista e a rota

```sql
SELECT t.matricula, t.marca, t.modelo, t.lotacao,
       mo.nome AS motorista, mo."emViagem", mo."viagemIniciadaEm",
       v.codigo AS via, v."terminalPartida", v."terminalChegada"
FROM "Transporte" t
LEFT JOIN "Motorista" mo ON mo."transporteId" = t.id
LEFT JOIN "Via" v        ON v.id = t."viaId"
WHERE t.matricula = 'ACI-004M';
```

```text
 matricula | marca  | modelo | lotacao |  motorista  | emViagem | viagemIniciadaEm | via  |        terminalPartida         | terminalChegada
-----------+--------+--------+---------+-------------+----------+------------------+------+--------------------------------+------------------
 ACI-004M  | Toyota | Hiace  |      15 | Pedro Tembe | f        |                  | V063 | Rua do Cajueiro (Fedel Castro) | Estrada Circular
```

### As paragens de uma rota, com coordenadas

```sql
SELECT p.codigo, p.nome, vp."terminalBoolean" AS terminal,
       split_part(p."geoLocation", ',', 1)::float AS lat,
       split_part(p."geoLocation", ',', 2)::float AS lng
FROM "ViaParagem" vp
JOIN "Paragem" p ON p.id = vp."paragemId"
JOIN "Via" v     ON v.id = vp."viaId"
WHERE v.codigo = 'V063';
```

As linhas vêm sem ordem. Para a ordem de viagem usar `npx tsx scripts/queries.ts stops V063`, ou a API (`GET /api/stops/{id}` lista, para cada rota que passa numa paragem, as paragens nos dois sentidos pela ordem de viagem: [Referência da API](referencia-api.md#get-apistopsid)).

### As paragens com mais rotas

```sql
SELECT p.nome, p.codigo, count(*) AS rotas
FROM "ViaParagem" vp JOIN "Paragem" p ON p.id = vp."paragemId"
GROUP BY p.id ORDER BY rotas DESC LIMIT 5;
```

```text
      nome       |  codigo  | rotas
-----------------+----------+-------
 Michafutene     | PAR-0468 |    22
 Portão          | PAR-0469 |    22
 Igreja          | PAR-0467 |    22
 Rua do boquisso | PAR-0491 |    20
 Rua do boquisso | PAR-0490 |    20
```

### Paragens a menos de 500 m de um ponto

Haversine em SQL simples, sem extensões.

```sql
SELECT nome, codigo, round(dist) AS metros FROM (
  SELECT p.nome, p.codigo,
         2 * 6371000 * asin(sqrt(
           power(sin(radians(split_part(p."geoLocation", ',', 1)::float - (-25.8389)) / 2), 2) +
           cos(radians(-25.8389)) * cos(radians(split_part(p."geoLocation", ',', 1)::float)) *
           power(sin(radians(split_part(p."geoLocation", ',', 2)::float - 32.5536) / 2), 2))) AS dist
  FROM "Paragem" p
) s WHERE dist < 500 ORDER BY dist LIMIT 5;
```

```text
              nome              |  codigo  | metros
--------------------------------+----------+--------
 Esquina                        | PAR-0869 |      5
 Rua do Cajueiro (Fedel Castro) | PAR-0868 |     11
 Pt                             | PAR-0867 |    343
 Rua do Cajueiro (Fedel Castro) | PAR-0870 |    386
 Rua do Cajueiro (Fedel Castro) | PAR-0907 |    397
```

### Veículos com dispositivo GPS, e se a posição é recente

```sql
SELECT matricula, "currGeoLocation", "gpsVelocidade", "gpsDirecao",
       ("gpsAtualizadoEm" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Maputo' AS ultima_posicao_maputo,
       ("gpsAtualizadoEm" > now() - interval '3 minutes') AS gps_recente
FROM "Transporte"
WHERE "gpsDispositivoHash" IS NOT NULL
ORDER BY "gpsAtualizadoEm" DESC NULLS LAST;
```

### Alertas de chegada das últimas 24 horas

```sql
SELECT ms."createdAt", ms."notificadoEm", p.nome AS paragem, u.nome AS utente
FROM "MISSION" ms
JOIN "Paragem" p ON p.id = ms."paragemId"
JOIN "Utente" u  ON u.id = ms."utenteId"
WHERE ms."createdAt" > now() - interval '24 hours'
ORDER BY ms."createdAt" DESC;
```

São os alertas que a verificação de chegadas ainda considera. `notificadoEm` fica preenchido quando o SMS foi enviado.

### A regra de tarifa activa

```sql
SELECT nome, "tarifaMinima", "precoPorKm", "fatorEstrada",
       "velocidadeViagemKmh", "velocidadeChegadaKmh", ativa, "updatedAt"
FROM "Tarifa" WHERE ativa ORDER BY "updatedAt" DESC LIMIT 1;
```

```text
  nome  | tarifaMinima | precoPorKm | fatorEstrada | velocidadeViagemKmh | velocidadeChegadaKmh | ativa |       updatedAt
--------+--------------+------------+--------------+---------------------+----------------------+-------+------------------------
 padrao |           10 |         10 |          1.3 |                  30 |                   45 | t     | 2026-10-15 10:45:41.13
```

### Motoristas: PIN, viagem e veículo

```sql
SELECT count(*) AS motoristas,
       count(*) FILTER (WHERE password IS NULL)       AS sem_pin,
       count(*) FILTER (WHERE "emViagem")             AS em_viagem,
       count(*) FILTER (WHERE "transporteId" IS NULL) AS sem_veiculo
FROM "Motorista";
```

### Passageiros criados por USSD (ainda sem palavra-passe)

```sql
SELECT count(*) FILTER (WHERE senha NOT LIKE '$2%') AS so_ussd,
       count(*) FILTER (WHERE senha LIKE '$2%')     AS com_senha
FROM "Utente";
```

Uma conta só de USSD passa a conta completa quando o mesmo número se regista na web ([Aplicação dos passageiros → Conta e entrada](app-passageiros.md#conta-e-entrada)).

## Mudar dados

- **Usar o painel de administração** para os dados da rede e da frota: rotas, paragens, veículos, motoristas, proprietários. Porquê: mantém as linhas relacionadas coerentes (as colunas `codigo*`, as ligações `ViaParagem`).
- **A regra de tarifa** muda-se na página "Tarifa" do painel ([Painel → Tarifa](painel-admin.md#tarifa)), ou com SQL. As aplicações vêem a alteração em 60 s:

  ```sql
  UPDATE "Tarifa" SET "precoPorKm" = 12, "updatedAt" = now() WHERE ativa;
  ```

- **Nunca correr uma semente contra a produção.** Todas começam por apagar todas as linhas de todas as tabelas.
- Envolver alterações manuais de várias instruções em `BEGIN; … COMMIT;` e verificar os números de linhas antes do `COMMIT`.

## Importar paragens e rotas do OpenStreetMap

A rede original deixava de fora boa parte do centro de Maputo: tinha, por exemplo, uma só paragem a menos de 2 km da Av. Eduardo Mondlane. O OpenStreetMap mapeia os autocarros e chapas da cidade (as redes Chapas, EMTPM, Corujas, REM e RCM), e [`transport-client/scripts/import-osm.mjs`](../transport-client/scripts/import-osm.mjs) trá-las.

Passo a passo:

```bash
cd transport-client
node scripts/import-osm.mjs --fetch                       # 1. descarregar do Overpass para osm-data/ (fora do git)
DATABASE_URL=… node scripts/import-osm.mjs --verbose       # 2. ensaio: lista o que juntaria, não escreve nada
DATABASE_URL=… node scripts/import-osm.mjs --apply --buses 2                 # 3. só bases de dados locais
DATABASE_URL=… node scripts/import-osm.mjs --apply --buses 2 --production    # 3b. uma base de dados remota
```

Porquê o ensaio primeiro e `--production` à parte: o script escreve muito, e um engano numa base de dados remota custa caro. Sem `--production`, recusa qualquer servidor que não seja local.

O que faz:

- **Área.** O rectângulo de Maputo, Matola, Boane e Marracuene (−26.10, 32.30 a −25.70, 32.75).
- **Paragens.** Todos os `highway=bus_stop`, plataformas e estações de autocarro.
  - Um `stop_position` (o ponto na estrada) passa a ser a paragem ao lado, a menos de 35 m.
  - Paragens com o mesmo nome a menos de 30 m são uma só.
  - Uma paragem que já está na base de dados é reutilizada: o mesmo nome a menos de 30 m, ou qualquer paragem a menos de 15 m.
  - As paragens novas recebem o código `OSM-<id do nó>`.
  - Só se importam paragens servidas por alguma rota.
- **Rotas.** O OSM tem uma relação por sentido, por exemplo `X12i` e `X12v`. As duas passam a uma só `Via`, com o número da rota (`X12`, `37-0`, `C8`), porque a rede trata todas as rotas como indo nos dois sentidos.
  - O percurso passa pelas paragens do primeiro sentido, pela ordem de viagem, nas estradas: um router OSRM público de carro responde de paragem em paragem ([abaixo](#pôr-os-percursos-das-rotas-nas-estradas)). Uma paragem a que o router só chega dando a volta a um quarteirão (do outro lado de uma estrada com separador) é saltada. Uma relação com menos de duas paragens fica com as suas vias juntas por ordem.
  - As paragens são as das relações perto desse percurso, mais qualquer paragem a menos de 20 m dele, ordenadas ao longo do percurso.
  - O município é onde a rota começa.
- **Sem duplicados.** Uma rota cujo percurso passa a menos de 60 m do percurso de uma rota existente (85% do comprimento num sentido, 70% no outro) não é juntada outra vez. Comparam-se o percurso pelas estradas e as vias juntas por ordem, e uma rota com o mesmo código e nome é a mesma rota, por isso uma corrida depois de corrigir os percursos não junta nada. As suas paragens ficam ligadas à rota existente, e as rotas existentes recebem também as paragens importadas a menos de 20 m do seu percurso.
- **Veículos.** O planeador só usa rotas que têm veículo. `--buses N` dá a cada rota nova N veículos, como as rotas originais têm:
  - Toyota Hiace (15 lugares) para chapas, e Mercedes-Benz Sprinter (22) para a EMTPM e os Corujas;
  - as próximas matrículas livres da série `ADA-001M`.

  Como todos os veículos sem dispositivo GPS, andam pelo modelo de horário ([Localização e GPS](localizacao-gps.md#como-se-escolhe-uma-posição)). Quando um operador registar o veículo real, edita-se o registo ou substitui-se.
- **Cópia e desfazer.** `--apply` guarda primeiro todas as linhas de `Paragem`, `Via`, `ViaParagem` e `Transporte` em `osm-data/backup-<hora>.json`. No fim lista o que criou em `osm-data/created-<hora>.json`: códigos de paragens, códigos de rotas, matrículas e as paragens ligadas a rotas existentes. Para desfazer a importação, apagar essas linhas.
- **Idempotente.** Uma segunda corrida não junta nada.

Numa cópia da produção (2026-10-18), os dados do OSM tinham 1 529 paragens depois de juntadas:

- 1 455 numa rota: 823 novas e 632 já na base de dados;
- 74 sem rota, saltadas.

Essa corrida ainda juntava as vias por ordem. Juntou 170 rotas (4 421 km) com 340 veículos, e 651 paragens a 35 rotas existentes. A rede passou de 91 para 261 rotas e de 1 004 para 1 855 paragens servidas. Uma lista de destinos a partir da Av. Eduardo Mondlane passou de nada para 1 095 locais.

A mesma importação correu na produção em 2026-10-18, com o mesmo resultado: 823 paragens, 170 rotas, 13 975 ligações rota-paragem e 340 veículos (ADA-001M a ADA-340M). A cópia e a lista de linhas criadas estão em `transport-client/osm-data/` na máquina que a correu; não estão no repositório.

Rapidez depois da importação:

- uma lista de destinos ou uma viagem demora cerca de 0,3 s num servidor local já aquecido;
- contra a produção, medido de fora, demora 1 a 1,5 s, e até 5 s num arranque a frio.

**Licença.** Os dados do OpenStreetMap são © contribuidores do OpenStreetMap, sob a [Open Database License](https://www.openstreetmap.org/copyright) (ODbL). O mapa já dá o crédito ao OpenStreetMap no canto inferior direito. Pelas condições de partilha da ODbL, as paragens e rotas importadas ficam sob a ODbL; este script e os dados do OSM que lê são a forma de as reconstruir.

## Pôr os percursos das rotas nas estradas

Alguns percursos guardados (`Via.geoLocationPath`) atravessavam o mapa em linha recta: por cima de quarteirões, campos ou um rio. Tinham duas causas:

- **Rotas do OpenStreetMap com buracos, ou listadas fora de ordem.** A primeira importação juntava as vias de uma relação pela ordem listada. Onde faltava uma via, ou estava listada noutro sítio, o percurso saltava a direito do fim de uma via para o início da seguinte. A importação passa agora pelas paragens ([acima](#importar-paragens-e-rotas-do-openstreetmap)).
- **As primeiras rotas** foram desenhadas de paragem em paragem pelos primeiros scripts de dados. As suas linhas rectas estão cortadas em pontos a poucas dezenas de metros uns dos outros.

[`transport-client/scripts/snap-paths.mjs`](../transport-client/scripts/snap-paths.mjs) põe esses saltos nas estradas:

```bash
cd transport-client
DATABASE_URL=… node scripts/snap-paths.mjs                          # ensaio: o que mudaria, não escreve nada
DATABASE_URL=… node scripts/snap-paths.mjs --apply                  # só bases de dados locais
DATABASE_URL=… node scripts/snap-paths.mjs --apply --production     # uma base de dados remota
```

Como funciona:

```mermaid
flowchart TD
  A["Troço recto de pelo menos 300 m"] --> B["Pedir ao router de carro<br/>a estrada entre as duas pontas"]
  B --> C{"A estrada fica a menos<br/>de 50 m da linha?"}
  C -- sim --> K1["A estrada é recta:<br/>o troço fica"]
  C -- não --> D{"Fica a menos de 1/4 do<br/>comprimento (min. 300 m)<br/>e é no máx. 3x mais longa?"}
  D -- sim --> R["O troço é substituído<br/>pela estrada"]
  D -- não --> E["Pedir ao router a pé<br/>(ignora sentidos únicos)"]
  E --> F{"O caminho a pé fica<br/>a menos de 80 m da linha?"}
  F -- sim --> K2["Há estrada ao longo dele<br/>(separador, sentido único):<br/>o troço fica"]
  F -- não --> K3["Sem estrada ao longo:<br/>o troço fica e é listado"]
```

- **Troços rectos.** O percurso é lido como troços rectos: pontos seguidos a menos de 3 m de uma linha. Cada troço de pelo menos 300 m (`--min`) é verificado.
- **Fica: uma estrada recta.** Quando a estrada fica a menos de 50 m da linha, a estrada é mesmo recta (Av. das Indústrias, a Marginal).
- **Substituído.** Quando a estrada fica a menos de um quarto do comprimento do troço (pelo menos 300 m) da linha, o troço passa a ser a estrada.
- **Fica: uma estrada que os carros não fazem a direito.** Uma estrada de carro que se afasta mais, ou é mais de 3 vezes mais longa (+500 m), pode vir das regras de sentido: numa estrada com separador como a N4, ou numa rua de sentido único, os carros dão a volta. Pergunta-se também ao router a pé da FOSSGIS, que as ignora e usa caminhos. Quando o seu caminho fica a menos de 80 m da linha, há estrada ao longo dela, e o troço fica.
- **Fica e é listado: sem estrada ao longo.** Senão a linha atravessa quarteirões, e a estrada de carro é o caminho do router entre dois pontos longe (uma circular, o centro da cidade), não o do autocarro. O troço fica. O ensaio lista as rotas que ficam com um salto de 1 km ou mais: [`redraw-from-osm.mjs`](#redesenhar-rotas-a-partir-das-suas-paragens-do-openstreetmap) reconstrói as do OpenStreetMap, e as outras redesenham-se no painel ([Painel → Corrigir o percurso de uma rota](painel-admin.md#tarefa-redesenhar)).
- **Simplificado.** O novo percurso é simplificado a 4 m e só é escrito quando mudou.
- **Routers.** Os routers públicos só aceitam uso leve, um pedido por segundo cada. Os pedidos de carro alternam entre o router da FOSSGIS e o de demonstração do OSRM, e os pedidos a pé vão para o router a pé da FOSSGIS, por isso uma primeira corrida sobre a rede inteira demora cerca de uma hora. As respostas ficam em `osm-data/road-cache.json` ([`scripts/roads.mjs`](../transport-client/scripts/roads.mjs), partilhado pelos três scripts), por isso uma segunda corrida com os mesmos dados não pergunta nada outra vez. Copiar esse ficheiro para correr noutra cópia dos mesmos dados.
- **Cópia e desfazer.** `--apply` guarda primeiro o id, o código e o percurso de cada rota em `osm-data/backup-paths-<hora>.json`. Para desfazer, escrever esses percursos de volta. Uma rota cujo percurso mudou desde que foi lido é saltada.

Numa cópia da produção (2026-10-18), o script verificou 5 650 troços de 300 m ou mais em 261 rotas:

| Resultado | Troços |
|---|---|
| Estradas rectas, ficaram | 5 541 |
| Postos na estrada | 92 |
| Sem estrada ao longo, ficaram | 17 |

Mudaram 49 rotas; 45 delas em menos de um décimo do comprimento. Exemplos:

- X36 (Costa do Sol – Malhazine) passou de 18,7 para 23,3 km: a diagonal por cima dos quarteirões segue agora as ruas.
- 203 (Baixa – Kongolote) passou de 38,0 para 43,3 km: a linha de 16 km por cima do aeroporto segue agora a N1.
- 47-0 (Baixa – Tchumene) já não atravessa o Rio Matola ao lado da N4.

Ficaram 10 rotas com um salto de 1 km ou mais. Nove são rotas do OpenStreetMap, redesenhadas pelo script seguinte; a décima, V086, redesenha-se à mão. Os saltos mais longos eram:

- 214 (Tchumene – Magoanine), 18,7 km: o router ia pelo centro da cidade, que o nome da rota exclui;
- 504 (Novo Cemitério – Praça dos Combatentes), 13,4 km;
- 216 (Patrice Lumumba – Praça dos Combatentes), 8,8 km.

As 47-0, 107 e X16 também apareciam antes de se perguntar ao router a pé: as suas linhas seguem a N4 e outras estradas com separador.

**Licença.** As estradas vêm do OpenStreetMap (© contribuidores do OpenStreetMap, ODbL), com caminhos do OSRM nos servidores da FOSSGIS e de demonstração do OSRM.

## Redesenhar rotas a partir das suas paragens do OpenStreetMap

Os saltos que o `snap-paths.mjs` deixa nas rotas do OpenStreetMap vêm da própria relação: as vias estão fora de ordem, ou faltam algumas, por isso nenhuma estrada sozinha substitui o salto. [`transport-client/scripts/redraw-from-osm.mjs`](../transport-client/scripts/redraw-from-osm.mjs) reconstrói o percurso inteiro dessa rota a partir das paragens da relação, como a importação desenha agora as rotas novas. Corre-se depois do `snap-paths.mjs`, com os dados do OSM de `import-osm.mjs --fetch` e o mesmo `osm-data/road-cache.json`:

```bash
cd transport-client
DATABASE_URL=… node scripts/redraw-from-osm.mjs                          # ensaio: o que mudaria, não escreve nada
DATABASE_URL=… node scripts/redraw-from-osm.mjs --apply                  # só bases de dados locais
DATABASE_URL=… node scripts/redraw-from-osm.mjs --apply --production     # uma base de dados remota
DATABASE_URL=… node scripts/redraw-from-osm.mjs --routes 214,504         # só estas rotas
DATABASE_URL=… node scripts/redraw-from-osm.mjs --unlink-far 503,X05      # também desligar as paragens longe destas rotas
```

Como funciona:

- **Que rotas.** As que têm um salto de 1 km ou mais que nenhuma estrada segue, pelo mesmo teste do `snap-paths.mjs`, e que têm uma relação no OpenStreetMap com o seu número (`214` → `214i`, `214v`). Uma rota sem relação fica e é listada.
- **O percurso.** A estrada de carro pelas paragens da relação "i" (o sentido que a importação usou), pela ordem de viagem: os stop positions na estrada, ou as plataformas quando a relação não os tem. Como todos os percursos guardados, tem um só sentido; os autocarros voltam por ele. Uma paragem a que o router só chega dando a volta a um quarteirão é saltada.
- **Paragens.** As paragens das relações que agora ficam no percurso (uma paragem da base de dados a menos de 35 m da paragem do OSM, e a menos de 30 m do novo percurso) são ligadas à rota se não estavam. As que já estavam ligadas continuam. O ensaio conta, por rota, as paragens ligadas que ficam a mais de 100 m do percurso (`--verbose` diz os nomes).
- **Desligar paragens longe.** `--unlink-far 503,X05` desliga, só das rotas indicadas, as paragens ligadas a mais de 100 m do percurso. Uma paragem longe que é das próprias relações OSM da rota fica: está no regresso, que vai por outra rua, e o percurso guardado só tem um sentido. Porquê rota a rota: cada remoção é uma decisão tomada depois de ler o ensaio; a página "Redesenhar percurso" do painel faz o mesmo à mão.
- **Cópia e desfazer.** `--apply` guarda primeiro os percursos e as ligações às paragens em `osm-data/backup-redraw-<hora>.json`, só escreve um percurso se ainda for o que foi lido, e lista as ligações juntadas em `osm-data/created-redraw-<hora>.json`. Para desfazer, escrever os percursos de volta e apagar essas ligações.

Numa cópia da produção (2026-10-18), depois do `snap-paths.mjs`:

| Rota | Antes | Depois | Paragens ligadas |
|---|---|---|---|
| 214 Tchumene – Magoanine | 80,0 km | 31,2 km | +38 |
| 503 FACIM – Praça dos Combatentes | 48,7 km | 28,0 km | |
| C6 Museu – Patrice Lumumba | 47,3 km | 29,3 km | +12 |
| 504 Novo Cemitério – Praça dos Combatentes | 39,6 km | 22,6 km | +2 |
| 216 Patrice Lumumba – Praça dos Combatentes | 32,4 km | 20,6 km | +18 |
| X05 Anjo Voador – Malhazine | 28,7 km | 16,0 km | |
| 114 Museu – Padaria Boane | 19,1 km | 18,9 km | +8 |
| 113 Baixa – Padaria Boane | 17,9 km | 17,7 km | +8 |
| X45 Praça dos Combatentes – Escola Graça Machel | 14,5 km | 7,8 km | |

Com `--unlink-far 503,X05` foram desligadas 5 paragens que os saltos antigos tinham apanhado: Dom Nhelete e Casa Branca da 503; Ronil, Cine África / Ministério e Cooperativa da X05. Entrada de Facim (503) e Correios (X05) ficam: são paragens da 503v e da X05v, o regresso.

Um segundo ensaio do `snap-paths.mjs` lista então uma só rota: V086 (Rua dos Bons Amigos – Antena), que não é do OpenStreetMap. A sua linha recta de 2 km é uma rua real que o OpenStreetMap mapeia com uma interrupção, por isso nenhum router a segue; fica como desenhada até ser redesenhada à mão.

**Rotas novas.** A importação desenha as rotas novas pelas suas paragens, e o painel só guarda percursos pelas estradas ("Nova Via", "Redesenhar percurso"), por isso já não entram saltos rectos. Os scripts antigos `create-*.js` dos primeiros dados ([Visão geral → Código antigo](visao-geral.md#código-antigo-não-publicado)) ainda escrevem linhas rectas de paragem em paragem: não os usar para rotas novas.

## Motoristas para os veículos importados

Os 340 veículos juntados pela importação do OpenStreetMap não tinham motorista. [`transport-client/scripts/add-drivers.mjs`](../transport-client/scripts/add-drivers.mjs) dá a cada veículo sem motorista um motorista de demonstração, como os 111 dos primeiros dados:

```bash
cd transport-client
DATABASE_URL=… node scripts/add-drivers.mjs                          # ensaio: quem seria criado
DATABASE_URL=… node scripts/add-drivers.mjs --apply                  # só bases de dados locais
DATABASE_URL=… node scripts/add-drivers.mjs --apply --production     # uma base de dados remota
```

- **Os registos.** Os nomes vêm de nomes próprios e apelidos moçambicanos comuns. Cada motorista tem os mesmos campos dos primeiros:
  - BI `1102…` e carta `CC-<ano>-…`;
  - um email `@transport.co.mz`, um telefone e uma morada;
  - um contacto de emergência, datas de emissão e validade, e o estado `ativo`;
  - o veículo que conduz.
- **Sem fotografia e sem PIN.** As aplicações mostram as iniciais em vez da fotografia. Um administrador gera o PIN quando o motorista precisar de entrar ([Painel → Dar um PIN a um motorista](painel-admin.md#tarefa-pin)).
- **Sem colisões.** Os números e emails continuam a seguir aos mais altos existentes, e os telefones são comparados com todos os motoristas existentes. Uma semente fixa faz os mesmos dados darem sempre os mesmos motoristas.
- **Cópia e desfazer.** `--apply` guarda primeiro todas as linhas de `Motorista` em `osm-data/backup-drivers-<hora>.json`, e lista os ids dos motoristas criados em `osm-data/created-drivers-<hora>.json`. Para desfazer, apagar esses motoristas.
- **Idempotente.** Uma segunda corrida não cria nada, porque todos os veículos já têm motorista.

Numa cópia da produção (2026-10-18) criou 340 motoristas: os 451 veículos passaram todos a ter um, e o aviso "sem motorista" do painel desapareceu. Os mesmos motoristas foram juntados à produção nesse dia ([Estado do projecto → Os dados](estado-do-projecto.md#os-dados)).

## Alterações ao esquema e migrações

O histórico de migrações está em [`prisma/migrations/`](../prisma/migrations) (seis migrações, `20260430170348_init` a `20261016150000_vehicle_gps`). Numa base de dados nova, `prisma migrate deploy` aplica-as todas ([Primeiros passos](primeiros-passos.md#5-criar-o-esquema)).

**A base de dados de produção não tem a tabela `_prisma_migrations`.** Foi criada com `db push`, antes de existir histórico de migrações, por isso `prisma migrate deploy` tentaria criar outra vez todas as tabelas. Por essa razão as migrações escrevem-se para poderem correr outra vez sem dano (`ADD COLUMN IF NOT EXISTS`, `CREATE … IF NOT EXISTS`). Para mudar o esquema de produção, passo a passo:

1. Editar `prisma/schema.prisma` e copiar a alteração para `transport-client/prisma/schema.prisma` e `transport-admin/prisma/schema.prisma` (a cópia do painel mantém a linha `previewFeatures = ["omitApi"]`). O CI recusa as três diferentes.
2. Juntar uma pasta de migração `prisma/migrations/<data>_<nome>/migration.sql` escrita com `IF NOT EXISTS`.
3. Testá-la numa base de dados local e num ramo da produção na Neon.
4. Ver o que falta à produção, com o endereço **directo** (sem pooler):

   ```bash
   cd transport-client
   npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel ../prisma/schema.prisma --script
   ```

5. Aplicar o SQL da nova migração:

   ```bash
   npx prisma db execute --url "$DIRECT_URL" --file ../prisma/migrations/<data>_<nome>/migration.sql
   ```

6. Correr o `diff` outra vez: tem de imprimir uma migração vazia.
7. Publicar o código que usa as colunas novas só depois de as colunas existirem.

## Tamanho

Produção em 2026-10-18, depois da importação do OpenStreetMap:

| Tabela | Linhas |
|---|---|
| Provincia / Cidade / Municipio | 11 / 0 / 2 |
| Via / Paragem / ViaParagem | 261 / 1 902 / 17 287 |
| Transporte / GeoLocation | 451 / 111 |
| Motorista | 451: os 111 dos primeiros dados e 340 de demonstração para os veículos importados ([acima](#motoristas-para-os-veículos-importados)) |
| Proprietario / TransporteProprietario | 11 / 0 (nenhum veículo tem proprietário ligado ainda) |
| Tarifa | 1 |
| Administrador | 3 |

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Primeiros passos](primeiros-passos.md) · [Índice](README.md) · Seguinte: [Configuração](configuracao.md)
<!-- /navegação-fim -->
