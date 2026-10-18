# transport-admin: painel de administração

Publicado como `transport-mz-admin` em https://transport-mz-admin.vercel.app. Os administradores gerem a rede (províncias, municípios, rotas, paragens), a frota (veículos, motoristas, proprietários), os passageiros, os PIN dos motoristas, os rastreadores GPS e a regra de tarifa.

Tem a sua própria API (`app/api`) sobre a mesma base de dados da aplicação dos passageiros, toda atrás de uma sessão de administrador (`proxy.ts`). Porquê uma aplicação separada: um erro no painel não derruba o que os passageiros usam, e toda a API pode exigir sessão sem excepções.

Como se usa, passo a passo: [docs/painel-admin.md](../docs/painel-admin.md).

## Correr

```bash
npm install
npm run dev -- -p 3002   # http://localhost:3002 (a porta 3000 é da aplicação dos passageiros)
node create-admin.js     # o primeiro administrador; pergunta nome, email e palavra-passe
```

Precisa de um `.env` com `DATABASE_URL` ([docs/configuracao.md](../docs/configuracao.md)). A compilação (`npm run build`) também precisa de `DATABASE_URL`.

## Testes

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/transport_test npm test   # Jest: API e base de dados
npm run test:e2e                                                             # Playwright: a interface
```

Os dois só correm contra uma base de dados local ([docs/testes.md](../docs/testes.md), [e2e/README.md](e2e/README.md)).

## Onde está cada coisa

| Pasta | O que tem |
|---|---|
| `app/<entidade>/` | as páginas de cada entidade (lista, detalhe, novo, editar) |
| `app/api/<entidade>/` | a API de cada entidade |
| `app/components/` | o desenho das rotas (`RouteDrawer.tsx`), o PIN (`DriverPinCard.tsx`), o GPS (`GpsTrackerCard.tsx`), o menu e o cabeçalho |
| `lib/` | sessão (`adminSession.ts`), cliente Prisma sem o hash do PIN (`prisma.ts`), posições (`vehiclePosition.ts`) |
| `__tests__/`, `e2e/` | testes Jest e Playwright |

Cada ficheiro, com o que faz e onde é explicado: [docs/mapa-do-codigo.md](../docs/mapa-do-codigo.md#painel-de-administração-transport-admin).

Os ficheiros `*.js` da raiz desta pasta (menos `create-admin.js` e as configurações) e a pasta `scripts/` são scripts antigos de uso único, não publicados ([docs/limitacoes.md](../docs/limitacoes.md#código-e-repositório)).
