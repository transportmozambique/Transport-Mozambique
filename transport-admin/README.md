# transport-admin: painel de administração

Publicado como `transport-mz-admin` em https://transport-mz-admin.vercel.app. Os administradores gerem a rede (províncias, municípios, rotas, paragens), a frota (veículos, motoristas, proprietários), os passageiros, os PIN dos motoristas, os [rastreadores GPS](../docs/conceitos.md#rastreador "Um aparelho (ou um telemóvel com uma aplicação) que envia a posição de um veículo pela internet; o código do dispositivo é a sua 'palavra-passe'.") e a regra de tarifa.

Tem a sua própria [API](../docs/conceitos.md#api "Uma API é a lista de pedidos que um servidor aceita de outros programas; cada um desses pedidos, com o seu endereço, é um endpoint.") (`app/api`) sobre a mesma [base de dados](../docs/conceitos.md#base-de-dados "O sítio organizado onde a plataforma guarda tudo o que tem de durar: rotas, paragens, veículos, contas.") da aplicação dos passageiros, toda atrás de uma [sessão](../docs/conceitos.md#sessao "Depois de entrar, o servidor dá uma prova de quem se é (um token), e o navegador mostra-a a cada pedido para não ter de pedir a palavra-passe outra vez.") de administrador (`proxy.ts`). Porquê uma aplicação separada: um erro no painel não derruba o que os passageiros usam, e toda a API pode exigir sessão sem excepções.

Como se usa, passo a passo: [docs/painel-admin.md](../docs/painel-admin.md).

## Correr

```bash
npm install
npm run dev -- -p 3002   # http://localhost:3002 (a porta 3000 é da aplicação dos passageiros)
node create-admin.js     # o primeiro administrador; pergunta nome, email e palavra-passe
```

Precisa de um [`.env`](../docs/conceitos.md#variavel-de-ambiente "Uma definição que se dá a um programa de fora do código, como o endereço da base de dados ou uma palavra-passe.") com `DATABASE_URL` ([docs/configuracao.md](../docs/configuracao.md)). A compilação ([`npm run build`](../docs/conceitos.md#npm "O npm descarrega e instala os pacotes (código feito por outros) de que cada aplicação precisa.")) também precisa de `DATABASE_URL`.

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
| `app/components/` | o desenho das rotas (`RouteDrawer.tsx`), o PIN (`DriverPinCard.tsx`), o [GPS](../docs/conceitos.md#gps "O sistema de satélites com que um telemóvel ou um aparelho sabe as suas coordenadas.") (`GpsTrackerCard.tsx`), o menu e o cabeçalho |
| `lib/` | sessão (`adminSession.ts`), cliente [Prisma](../docs/conceitos.md#prisma "A ferramenta com que o código fala com a base de dados sem escrever SQL à mão.") sem o [hash](../docs/conceitos.md#hash "Uma 'impressão digital' de um texto, que se calcula num sentido e não se consegue desfazer.") do PIN (`prisma.ts`), posições (`vehiclePosition.ts`) |
| `__tests__/`, `e2e/` | testes [Jest](../docs/conceitos.md#testes "Programas que experimentam as aplicações sozinhos e avisam quando algo deixou de funcionar.") e Playwright |

Cada ficheiro, com o que faz e onde é explicado: [docs/mapa-do-codigo.md](../docs/mapa-do-codigo.md#painel-de-administração-transport-admin).
