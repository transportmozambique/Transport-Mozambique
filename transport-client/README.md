# transport-client: aplicação dos passageiros

Publicada como `transport-mz` em https://transport-mz.vercel.app. Junta, numa só aplicação [Next.js](../docs/conceitos.md#nextjs "O Next.js é a 'estrutura' sobre a qual as três aplicações estão feitas; o React é a parte dele que desenha os ecrãs."):

- a **web dos passageiros**: o mapa ao vivo, os destinos alcançáveis, as viagens com [transbordos](../docs/glossario.md#palavras-dos-ecrãs "Mudança de autocarro a meio de uma viagem"), acompanhar uma viagem, a conta e os alertas de chegada ([docs/app-passageiros.md](../docs/app-passageiros.md));
- o **[callback](../docs/conceitos.md#callback "Um endereço que se dá a outro serviço para ele chamar sempre que algo acontece.") [USSD](../docs/conceitos.md#ussd "Os menus que aparecem num telemóvel quando se marca um código como *384*848080#; funcionam em qualquer telemóvel, sem internet.")** `/api/ussd`, chamado pela [Africa's Talking](../docs/conceitos.md#africas-talking "O gateway de USSD e SMS usado por este projecto.") ([docs/ussd.md](../docs/ussd.md));
- a **[API](../docs/conceitos.md#api "Uma API é a lista de pedidos que um servidor aceita de outros programas; cada um desses pedidos, com o seu endereço, é um endpoint.") do motorista** `/api/driver/*`, usada pelo portal do motorista ([docs/portal-motorista.md](../docs/portal-motorista.md));
- a **entrada das posições [GPS](../docs/conceitos.md#gps "O sistema de satélites com que um telemóvel ou um aparelho sabe as suas coordenadas.")** `/api/gps` ([docs/localizacao-gps.md](../docs/localizacao-gps.md));
- todos os **[SMS](../docs/conceitos.md#sms "As mensagens de texto curtas dos telemóveis.")** e a verificação de chegadas.

Porquê tudo junto: todas estas partes lêem a mesma rede e o mesmo estado das viagens, e uma só cópia do código das posições e das tarifas dá as mesmas respostas na web e no USSD.

## Correr

```bash
npm install          # também corre prisma generate
npm run dev          # http://localhost:3000
```

Precisa de um [`.env`](../docs/conceitos.md#variavel-de-ambiente "Uma definição que se dá a um programa de fora do código, como o endereço da base de dados ou uma palavra-passe.") com `DATABASE_URL` ([docs/configuracao.md](../docs/configuracao.md)). Do zero, com [dados de demonstração](../docs/conceitos.md#semente "Um conjunto pequeno de dados inventados que se carrega numa base de dados vazia para a experimentar."): [docs/primeiros-passos.md](../docs/primeiros-passos.md).

## Onde está cada coisa

| Pasta | O que tem |
|---|---|
| `app/` | as páginas (`page.tsx`) e a API (`app/api/**/route.ts`) |
| `app/components/` | o mapa e o planeador (`TripPlanner.tsx`), acompanhar a viagem (`JourneyFollow.tsx`), a folha arrastável (`Sheet.tsx`) |
| `lib/` | a lógica: posições (`vehiclePosition.ts`), viagens (`journeys.ts`), tarifas (`fares.ts`), pesquisa de nomes (`places.ts`), leitura das teclas USSD (`ussdSteps.ts`), SMS (`notifications.ts`), [sessões](../docs/conceitos.md#sessao "Depois de entrar, o servidor dá uma prova de quem se é (um token), e o navegador mostra-a a cada pedido para não ter de pedir a palavra-passe outra vez.") |
| `scripts/` | importação do [OpenStreetMap](../docs/conceitos.md#openstreetmap "Um mapa do mundo inteiro feito por voluntários, como uma Wikipédia dos mapas, que qualquer pessoa pode usar e corrigir."), percursos nas estradas, listas da [base de dados](../docs/conceitos.md#base-de-dados "O sítio organizado onde a plataforma guarda tudo o que tem de durar: rotas, paragens, veículos, contas."), ecrãs USSD |
| `prisma/` | cópia do [esquema](../docs/conceitos.md#migracao "O esquema é a lista das tabelas e colunas; uma migração é uma alteração a essa lista, escrita em SQL para se poder repetir.") (igual a `../prisma/schema.prisma`) e os dados de demonstração |

Cada ficheiro, com o que faz e onde é explicado: [docs/mapa-do-codigo.md](../docs/mapa-do-codigo.md#aplicação-dos-passageiros-transport-client).
