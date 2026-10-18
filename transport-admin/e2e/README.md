# Testes ponta a ponta do painel (Playwright)

`crud.spec.ts` conduz a interface do painel no Chromium. Para cada uma das nove entidades (províncias,
municípios, paragens, vias, proprietários, motoristas, transportes, utentes, administradores)
cria uma linha pelo formulário, encontra-a com a pesquisa da lista, abre a página de detalhe,
edita-a, e apaga-a pela janela de confirmação. Também confirma que a API responde 401 sem sessão.

Os outros ficheiros: `gps.spec.ts` (posição ao vivo e códigos de dispositivo GPS), `pin.spec.ts`
(PIN do motorista), `search.spec.ts` (pesquisa do cabeçalho, e telefones encontrados pelos
algarismos) e `tarifa.spec.ts` (a página da tarifa; volta a pôr os valores originais).

Porquê o Playwright: conduz um navegador real como um administrador, por isso apanha os erros que
só aparecem com as páginas, os mapas e a API juntos.

Os testes escrevem na base de dados, por isso só correm contra uma base de dados **local**:
`e2e/global-setup.ts` pára se `E2E_DATABASE_URL` apontar para outro sítio. As linhas chamam-se
`E2E …` e cada teste apaga o que criou.

## Correr

1. Arrancar um PostgreSQL local e criar o esquema:

   ```bash
   DATABASE_URL=postgresql://postgres@127.0.0.1:55432/transport_test npx prisma db push --schema ../prisma/schema.prisma
   ```

   Carregar dados (os formulários precisam de pelo menos uma província, um município e uma rota
   nas listas), por exemplo uma cópia dos dados de produção
   ([docs/primeiros-passos.md](../../docs/primeiros-passos.md#trabalhar-com-uma-cópia-dos-dados-de-produção)).

2. Compilar a aplicação e correr os testes (o Playwright arranca `next start` na porta 3102 com a
   base de dados de teste e um segredo de sessão de teste):

   ```bash
   npm run build
   npx playwright install chromium   # só da primeira vez
   npm run test:e2e
   ```

   `npx playwright show-report e2e/report` abre o relatório HTML; os testes que falham guardam um
   rasto e uma captura em `e2e/test-results/`.

## Definições

| Variável | Por omissão |
|---|---|
| `E2E_DATABASE_URL` | `postgresql://postgres@127.0.0.1:55432/transport_test` |
| `E2E_PORT` | `3102` |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | `e2e-admin@local.test` / `e2e-local-only-pass` |

O administrador de teste é criado (ou a sua palavra-passe reposta) na base de dados local antes de
cada corrida. Não existe na produção, por isso um servidor que não use a base de dados de teste
falha a entrada e nenhum teste corre.

O teste das rotas responde ele próprio ao pedido ao router OSRM público, por isso não depende
desse serviço. Os mosaicos do mapa continuam a vir da internet.

Mais: [docs/testes.md](../../docs/testes.md#testes-ponta-a-ponta-do-painel-playwright).
