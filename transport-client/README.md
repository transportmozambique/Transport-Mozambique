# transport-client: aplicação dos passageiros

Publicada como `transport-mz` em https://transport-mz.vercel.app. Junta, numa só aplicação Next.js:

- a **web dos passageiros**: o mapa ao vivo, os destinos alcançáveis, as viagens com transbordos, acompanhar uma viagem, a conta e os alertas de chegada ([docs/app-passageiros.md](../docs/app-passageiros.md));
- o **callback USSD** `/api/ussd`, chamado pela Africa's Talking ([docs/ussd.md](../docs/ussd.md));
- a **API do motorista** `/api/driver/*`, usada pelo portal do motorista ([docs/portal-motorista.md](../docs/portal-motorista.md));
- a **entrada das posições GPS** `/api/gps` ([docs/localizacao-gps.md](../docs/localizacao-gps.md));
- todos os **SMS** e a verificação de chegadas.

Porquê tudo junto: todas estas partes lêem a mesma rede e o mesmo estado das viagens, e uma só cópia do código das posições e das tarifas dá as mesmas respostas na web e no USSD.

## Correr

```bash
npm install          # também corre prisma generate
npm run dev          # http://localhost:3000
```

Precisa de um `.env` com `DATABASE_URL` ([docs/configuracao.md](../docs/configuracao.md)). Do zero, com dados de demonstração: [docs/primeiros-passos.md](../docs/primeiros-passos.md).

## Onde está cada coisa

| Pasta | O que tem |
|---|---|
| `app/` | as páginas (`page.tsx`) e a API (`app/api/**/route.ts`) |
| `app/components/` | o mapa e o planeador (`TripPlanner.tsx`), acompanhar a viagem (`JourneyFollow.tsx`), a folha arrastável (`Sheet.tsx`) |
| `lib/` | a lógica: posições (`vehiclePosition.ts`), viagens (`journeys.ts`), tarifas (`fares.ts`), pesquisa de nomes (`places.ts`), leitura das teclas USSD (`ussdSteps.ts`), SMS (`notifications.ts`), sessões |
| `scripts/` | importação do OpenStreetMap, percursos nas estradas, listas da base de dados, ecrãs USSD |
| `prisma/` | cópia do esquema (igual a `../prisma/schema.prisma`) e os dados de demonstração |

Cada ficheiro, com o que faz e onde é explicado: [docs/mapa-do-codigo.md](../docs/mapa-do-codigo.md#aplicação-dos-passageiros-transport-client).
