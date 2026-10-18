# Testes

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 6. Manter › **Testes** (página 21 de 23)

Anterior: [Africa's Talking](africas-talking.md) · [Índice](README.md) · Seguinte: [Resolução de problemas](resolucao-de-problemas.md)

<details>
<summary>Todas as páginas</summary>

- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md)
- 6. Manter: **Testes** · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

O que se verifica automaticamente, como se corre, e como se testam à mão as partes sem testes automáticos (aplicação dos passageiros, USSD, GPS, portal do motorista). O GitHub corre as verificações de tipos, a comparação dos esquemas e a verificação da documentação em cada pull request ([CI](#ci-no-github)); os testes do painel correm-se à mão antes de abrir um. A compilação da Vercel verifica os tipos outra vez ([Publicação → Compilações](publicacao.md#compilações)).

**Nesta página:** [Resumo](#resumo) · [CI no GitHub](#ci-no-github) · [Uma base de dados local de teste](#uma-base-de-dados-local-de-teste) · [Tipos e lint](#tipos-e-lint) · [Painel: Jest](#testes-da-api-e-da-base-de-dados-do-painel-jest) · [Painel: Playwright](#testes-ponta-a-ponta-do-painel-playwright) · [Passageiros e USSD à mão](#aplicação-dos-passageiros-e-ussd-à-mão) · [GPS à mão](#gps-à-mão) · [Portal do motorista à mão](#portal-do-motorista-à-mão) · [Scripts antigos](#scripts-de-teste-antigos)

---

## Resumo

| Verificação | Onde | Comando | Base de dados | Estado em 2026-10-18 |
|---|---|---|---|---|
| Tipos | cada aplicação, e CI | `npx tsc --noEmit` | nenhuma | passa nas três |
| Esquemas iguais | raiz do repositório, e CI | `node .github/scripts/check-schemas.mjs` | nenhuma | passa |
| Ligações da documentação | raiz do repositório, e CI | `python3 .github/scripts/check-doc-links.py .` | nenhuma | passa |
| Navegação da documentação | raiz do repositório, e CI | `python3 .github/scripts/docs-nav.py --check` | nenhuma | passa |
| Lint | cada aplicação | `npm run lint` | nenhuma | muitos avisos antigos, por isso não bloqueia ([abaixo](#tipos-e-lint)) |
| Jest (API e base de dados) | `transport-admin` | `npm test` | só local | 17 testes passam |
| Playwright (ponta a ponta) | `transport-admin` | `npm run test:e2e` | só local | 18 testes passam |
| Aplicação dos passageiros, USSD, GPS, portal do motorista | `transport-client`, `transport-driver` | à mão, abaixo | local ou produção (só leitura) | sem testes automáticos |

Porquê esta divisão: as verificações do CI não precisam de segredos nem de base de dados, por isso correm em qualquer cópia do repositório; os testes que escrevem precisam de uma base de dados descartável, que o CI não tem.

## CI no GitHub

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) ("Verificações") corre em cada pull request e em cada push para a `main`. O pull request mostra o resultado ao lado do da Vercel:

| Trabalho | O que verifica |
|---|---|
| Tipos (transport-client, transport-admin, transport-driver) | `npm ci`, `npx prisma generate` (menos no portal do motorista) e `npx tsc --noEmit` em cada aplicação. |
| Esquemas e documentação | [`check-schemas.mjs`](../.github/scripts/check-schemas.mjs): as três cópias do esquema Prisma descrevem a mesma base de dados. [`check-doc-links.py`](../.github/scripts/check-doc-links.py): cada ligação relativa e imagem em `README.md` e `docs/*.md` existe, e cada `#âncora` corresponde a um título. [`docs-nav.py --check`](../.github/scripts/docs-nav.py): a navegação no topo e no fim de cada página está actualizada. |

Os três scripts também correm localmente a partir da raiz do repositório, com os mesmos comandos. Depois de juntar ou mudar o nome de uma página da documentação, `python3 .github/scripts/docs-nav.py` (sem `--check`) escreve a navegação outra vez.

## Uma base de dados local de teste

As duas séries de testes do painel escrevem na base de dados, e as duas **recusam correr se o servidor da base de dados não for local** (`localhost`, `127.0.0.1` ou `::1`). Porquê: um teste que cria e apaga linhas nunca pode chegar à produção por engano. Os formulários precisam de dados com ar de reais (províncias, municípios, rotas com percursos pelas estradas, paragens), por isso usa-se uma cópia da produção:

1. Restaurar uma cópia num PostgreSQL local ([Primeiros passos → Cópia dos dados de produção](primeiros-passos.md#trabalhar-com-uma-cópia-dos-dados-de-produção)), ou usar os dados de demonstração para uma volta rápida ([Primeiros passos → 6](primeiros-passos.md#6-carregar-os-dados-de-demonstração)).
2. Apontar os testes para ela. O Playwright usa por omissão `postgresql://postgres@127.0.0.1:55432/transport_test`; `E2E_DATABASE_URL` escolhe outra. O Jest lê `DATABASE_URL` (ambiente, ou `transport-admin/.env`).

Os testes apagam as linhas que criam (todas com nomes `E2E …`), mas uma corrida que falhe pode deixar algumas. Nunca se aponta um seed ou um teste para a produção.

## Tipos e lint

```bash
cd transport-client && npx tsc --noEmit
cd transport-admin  && npx tsc --noEmit
cd transport-driver && npx tsc --noEmit
```

As três passam. A Vercel faz a mesma verificação durante `next build`, por isso um erro de tipos bloqueia a publicação.

`npm run lint` (ESLint com a configuração do Next.js) mostra avisos antigos em código anterior ao trabalho actual, a maior parte tipos `any` e aspas por escapar em JSX:

| Aplicação | Erros | Avisos |
|---|---|---|
| `transport-admin` | 202 | 155 |
| `transport-client` | 15 | 23 |
| `transport-driver` | 2 | 2 |

Por isso o lint não bloqueia. O código novo e alterado fica sem avisos: `npx eslint <ficheiros alterados>`.

## Testes da API e da base de dados do painel (Jest)

[`transport-admin/__tests__/api/`](../transport-admin/__tests__), 17 testes, correm com `npm test` (`jest.config.js`, `ts-jest`):

| Série | Verifica |
|---|---|
| `database.test.ts` | a ligação; contar e ler rotas, paragens e veículos com as suas relações |
| `crud.test.ts` | ler cada entidade com as relações que as páginas usam |
| `auth.test.ts` | cria um administrador, confirma o hash bcrypt e a procura por email, apaga-o |

Usam o Prisma directamente, não HTTP. `jest.setup.js` pára a corrida se `DATABASE_URL` não for local:

```bash
cd transport-admin
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/transport_test npm test
```

## Testes ponta a ponta do painel (Playwright)

[`transport-admin/e2e/`](../transport-admin/e2e), 18 testes no Chromium contra uma compilação de produção do painel. Os detalhes e as opções estão em [`transport-admin/e2e/README.md`](../transport-admin/e2e/README.md). Porquê o Playwright: conduz um navegador real como um administrador, por isso apanha erros que só aparecem com as páginas, os mapas e a API juntos.

| Ficheiro | Cobre |
|---|---|
| `crud.spec.ts` | Para cada uma das nove entidades: criar pelo formulário, encontrar com a pesquisa da lista, abrir, editar, apagar pela janela de confirmação. E também: desenhar uma rota no mapa (as respostas dos routers são dadas localmente), "Atribuir Transporte" numa rota, apagar um proprietário com um veículo, apagar uma paragem com um alerta de passageiro, e 401 da API sem sessão. |
| `gps.spec.ts` | A posição ao vivo na página do veículo, e criar, usar e revogar um código de dispositivo GPS. |
| `pin.spec.ts` | Gerar o PIN de um motorista, mostrado uma vez. |
| `search.spec.ts` | A pesquisa do cabeçalho: veículos, rotas e motoristas, Enter, sem resultados; um motorista encontrado pelos algarismos do telefone escritos de três formas. |
| `tarifa.spec.ts` | A página da tarifa: os valores actuais, a pré-visualização das tarifas, um valor fora do intervalo recusado, gravar (os valores originais voltam a pôr-se). |

```bash
cd transport-admin
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/transport_test npm run build   # a compilação precisa de um DATABASE_URL
npx playwright install chromium                                                     # só da primeira vez
npm run test:e2e
npx playwright show-report e2e/report                                               # relatório HTML
```

O Playwright arranca `next start` na porta 3102 com a base de dados de teste e um segredo de sessão de teste, e cria (ou repõe) o administrador de teste `e2e-admin@local.test`. Antes, pára-se o que estiver na porta 3102, ou define-se `E2E_PORT`. Um teste que falhe guarda um rasto e uma captura em `e2e/test-results/`.

## Aplicação dos passageiros e USSD à mão

Arrancar a aplicação dos passageiros com a base de dados local (`npm run dev`, ou `npm run build && npx next start -p 3000` com `USER_SESSION_SECRET` e `DRIVER_SESSION_SECRET` definidos, porque o modo de produção os exige).

**APIs.** Cada endpoint e a resposta esperada estão na [Referência da API](referencia-api.md#aplicação-dos-passageiros-transport-client). Uma volta rápida:

```bash
B=http://localhost:3000
curl -s "$B/api/simulation"                              # estado, busCount
curl -s "$B/api/buses?fields=position" | head -c 300     # posições
curl -s "$B/api/stops" | head -c 300                     # paragens e rotas
TO=$(curl -s "$B/api/stops" | node -pe 'JSON.parse(require("fs").readFileSync(0)).paragens.find(p => p.nome === "Makalela").id')
curl -s "$B/api/journeys?lat=-25.7844&lng=32.5893&to=$TO" | head -c 300   # viagens a partir de uma posição perto do Portão
```

**Páginas web.** Abrir `/` (permitir a localização, ou recusá-la para ver a lista do centro do mapa), tocar numa paragem, escrever um destino, abrir uma viagem e "Acompanhar viagem" (a viagem acompanhada em `/viagem`), `/auth` (entrar com um passageiro de demonstração) e `/user-info`. O que cada ecrã deve mostrar está em [Aplicação dos passageiros](app-passageiros.md).

**USSD, sem servidor.** [`scripts/ussd-ecras.ts`](../transport-client/scripts/ussd-ecras.ts) chama o handler directamente e mostra o ecrã de cada `text` ([Serviço USSD → Testar](ussd.md#testar)):

```bash
cd transport-client
npx tsx scripts/ussd-ecras.ts "" "1*museu" "1*museu*zimpeto" "2*X12" "3*X12*2" "4*museu*zimpeto" "5*ack" "7"
```

**USSD, pelo servidor.** Enviar os campos do formulário que a Africa's Talking envia, com todas as respostas em `text`:

```bash
ussd() { curl -s -X POST "$B/api/ussd" --data-urlencode "sessionId=t1" \
  --data-urlencode "phoneNumber=+258840000001" --data-urlencode "text=$1"; echo; }
ussd ""                  # menu principal
ussd "2*museu"           # Procurar rotas: as rotas que passam no Museu
ussd "2*museu*1"         # o resumo da primeira
ussd "4*museu*zimpeto"   # Calcular tarifa
ussd "1*chipamanine"     # pesquisa tolerante: encontra Xipamanine
ussd "7"                 # Ajuda
```

Confirmar que cada ecrã começa por `CON` ou `END` e cabe em 182 caracteres. A árvore dos menus com ecrãs reais está em [Serviço USSD](ussd.md). Para testar com o gateway real, usa-se o [simulador da Africa's Talking](africas-talking.md#usar-o-menu-no-simulador), que fala com a produção. O ecrã de viagem da opção 1 escreve (um alerta, e um passageiro para um telefone novo): no fim, apagam-se essas linhas de teste ([Base de dados → Passageiros criados por USSD](base-de-dados.md#passageiros-criados-por-ussd-ainda-sem-palavra-passe)).

## GPS à mão

1. No painel, gerar um código de dispositivo para um veículo ("Rastreador GPS").
2. Enviar uma posição como o Traccar Client faria:

   ```bash
   curl -s "$B/api/gps?id=<código>&lat=-25.9692&lon=32.5732&speed=10&bearing=90"   # {"ok":true}
   ```

3. O cartão do veículo mostra "GPS ativo"; `GET /api/bus/{id}` responde `"fonte": "gps"` nesse ponto durante 3 minutos.
4. Confirmar as recusas: um código errado (401), `lat=0&lon=0` (400), `accuracy=500` (ignorada), um `timestamp` antigo (ignorada). Ver [Localização e GPS → Protocolo](localizacao-gps.md#protocolo).
5. No fim, "Revogar dispositivo".

## Portal do motorista à mão

Compilar o portal com `NEXT_PUBLIC_API_URL` a apontar para a aplicação dos passageiros local (lê-se na compilação), gerar um PIN para um motorista no painel, e entrar numa janela do tamanho de um telemóvel:

- "Iniciar viagem" e "Terminar viagem" mudam a viagem; o USSD `6*<PIN>*2` mostra o mesmo estado, e `6*<PIN>*1*1` troca-o ([Portal do motorista](portal-motorista.md)).
- Com um código de dispositivo guardado no perfil e a localização permitida, uma viagem envia posições; o cartão do veículo no painel passa a "GPS ativo".
- Atribuir o motorista a outro veículo no painel, e recarregar o portal (ou esperar 5 minutos): a matrícula e a rota novas aparecem sem entrar outra vez.
- Um PIN errado responde "PIN incorreto"; um motorista sem PIN recebe "Ainda não tem PIN…".

## Scripts de teste antigos

A raiz do repositório tem 24 scripts `test-*.js` (`test-ussd-*.js`, `test-api-*.js`, …) e `transport-admin` tem mais 16 scripts `test-*.js` e `check-*.js` da primeira importação de dados. Testam versões antigas dos fluxos, alguns têm URLs ou dados fixos, e vários escrevem na base de dados de `DATABASE_URL`. Não fazem parte dos testes; lê-se um antes de o correr ([Limitações](limitacoes.md)).

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Africa's Talking](africas-talking.md) · [Índice](README.md) · Seguinte: [Resolução de problemas](resolucao-de-problemas.md)
<!-- /navegação-fim -->
