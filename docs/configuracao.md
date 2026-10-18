# Configuração

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 2. Montar localmente › **Configuração** (página 7 de 23)

Anterior: [Base de dados](base-de-dados.md) · [Índice](README.md) · Seguinte: [Fluxos de dados](fluxos-de-dados.md)

<details>
<summary>Todas as páginas</summary>

- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · **Configuração**
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

Tudo o que se configura: as variáveis de ambiente de cada aplicação, os projectos da Vercel, a ligação à base de dados, a regra de tarifa (uma linha da base de dados) e as constantes fixas no código, com o porquê de cada uma estar onde está. O lado da Africa's Talking (canal USSD e URL de resposta) está em [Africa's Talking](africas-talking.md).

**Nesta página:** [Variáveis de ambiente](#variáveis-de-ambiente) · [Onde estão os valores](#onde-estão-os-valores) · [Projectos da Vercel](#projectos-da-vercel) · [Neon](#base-de-dados-na-neon) · [Regra de tarifa](#regra-de-tarifa-tarifa) · [Constantes no código](#constantes-no-código)

---

## Variáveis de ambiente

Porquê variáveis de ambiente: segredos e endereços mudam entre o computador local, as pré-visualizações e a produção, e nunca devem ficar no código (que é público).

### `transport-client` (passageiros, USSD, API do motorista, GPS)

| Variável | Obrigatória | O que faz | Se faltar |
|---|---|---|---|
| `DATABASE_URL` | sim | Endereço PostgreSQL usado pelo Prisma ([`lib/prisma.ts`](../transport-client/lib/prisma.ts)). Em produção, o endereço **pooled** da Neon. | Todas as chamadas à API falham; a compilação falha (o Prisma valida-o ao compilar). |
| `USER_SESSION_SECRET` | em produção | Chave HMAC dos tokens de sessão dos passageiros, 90 dias ([`lib/userSession.ts`](../transport-client/lib/userSession.ts)). | Produção: registo e entrada respondem 500 "Sessão indisponível" e todos os `/api/user/*` respondem 401. Desenvolvimento: usa-se uma chave fixa só de desenvolvimento. |
| `DRIVER_SESSION_SECRET` | em produção | Chave HMAC dos tokens de sessão dos motoristas, 30 dias ([`lib/driverSession.ts`](../transport-client/lib/driverSession.ts)). | Produção: a entrada do motorista responde 500, e `/api/driver/trip` e `/api/driver/seguidores` respondem 401. Desenvolvimento: chave fixa de desenvolvimento. |
| `AFRICASTALKING_API_KEY` | para SMS | Chave da API da Africa's Talking ([`lib/notifications.ts`](../transport-client/lib/notifications.ts)). As chaves do sandbox só chegam ao simulador. | Os SMS não saem; cada um fica no registo como `SMS não enviado para … AFRICASTALKING_API_KEY não configurada`. O USSD continua a funcionar. |
| `AFRICASTALKING_USERNAME` | com a chave | Nome da aplicação na Africa's Talking. `sandbox` para o sandbox. | Usa `sandbox`. |
| `AFRICASTALKING_SHORTCODE` | não | Remetente ou código curto usado como `from` nos SMS (só contas de produção). | O remetente por omissão da Africa's Talking. |
| `USSD_CALLBACK_KEY` | recomendada | Chave que `/api/ussd` exige como `?key=` no URL de resposta, para só a Africa's Talking o poder chamar ([Segurança → Resposta USSD](seguranca.md#resposta-ussd-callback)). | Qualquer pessoa pode chamar `/api/ussd`. |
| `WALK_ROUTER_URL` | não | Serviço OSRM usado para as caminhadas pelas ruas, até ao perfil (`…/route/v1/foot`), para um router próprio ([`lib/walkRoute.ts`](../transport-client/lib/walkRoute.ts)). | O router a pé da FOSSGIS, `https://routing.openstreetmap.de/routed-foot/route/v1/foot`. |
| `TELERIVET_SECRET` | não (antiga) | Segredo partilhado verificado por `/api/ussd-telerivet`, o endpoint do gateway Telerivet sem uso. | Esse endpoint salta a verificação. |

### `transport-admin` (painel de administração)

| Variável | Obrigatória | O que faz | Se faltar |
|---|---|---|---|
| `DATABASE_URL` | sim | A mesma base de dados da aplicação dos passageiros. | Todas as chamadas à API falham. |
| `ADMIN_SESSION_SECRET` | em produção | Chave HMAC do cookie `admin_session`, 12 horas ([`lib/adminSession.ts`](../transport-admin/lib/adminSession.ts)). | Produção: a entrada responde 500 "Servidor sem configuração de sessão" e todos os `/api/*` respondem 401. Desenvolvimento: chave fixa de desenvolvimento. |
| `GPS_SERVER_URL` | não | O endereço mostrado a quem configura um dispositivo GPS, quando se cria um código ([`app/api/transportes/[id]/gps/route.ts`](../transport-admin/app/api/transportes/[id]/gps/route.ts)). | `https://transport-mz.vercel.app/api/gps` |
| `NEXT_PUBLIC_LOG_LEVEL` | não | Nível de registo no navegador de [`lib/logger.ts`](../transport-admin/lib/logger.ts): `error`, `warn`, `info` ou `debug`. | `error` |
| `E2E_DATABASE_URL`, `E2E_PORT`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_REUSE_SERVER` | só testes | Configuração do Playwright ([Testes](testes.md#testes-ponta-a-ponta-do-painel-playwright)). | Valores locais por omissão. |

### `transport-driver` (portal do motorista)

| Variável | Obrigatória | O que faz | Se faltar |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | sim | Endereço da aplicação dos passageiros, cujos `/api/driver/*` e `/api/gps` o portal chama ([`lib/api.ts`](../transport-driver/lib/api.ts)). **Posta no código na compilação**: depois de a mudar, compilar outra vez. Porquê: as variáveis `NEXT_PUBLIC_*` vão para o navegador, que não lê o ambiente do servidor. | `http://127.0.0.1:3000` |

### Gerar segredos

Um valor aleatório diferente para cada segredo e cada ambiente:

```bash
openssl rand -base64 32
```

Mudar um segredo de sessão faz sair todos os que têm um token desse tipo (passageiros, motoristas ou administradores). É também a forma de anular todas as sessões de uma vez ([Segurança → Mudar segredos](seguranca.md#mudar-segredos)).

## Onde estão os valores

| Ambiente | Onde | Como os ler |
|---|---|---|
| Produção e pré-visualização | Vercel → projecto → Settings → Environment Variables | `vercel env ls` lista os nomes; `vercel env pull .env.local` descarrega os valores do ambiente Development para um ficheiro local ([Guia da Vercel](guia-vercel.md#variáveis-de-ambiente)) |
| Desenvolvimento local | `.env` em cada pasta de aplicação (fora do git) | [Primeiros passos](primeiros-passos.md#3-ficheiros-de-ambiente-env) |

Variáveis definidas em produção em 2026-10-17 (só os nomes):

| Projecto na Vercel | Production | Preview |
|---|---|---|
| `transport-mz` | `DATABASE_URL`, `USER_SESSION_SECRET`, `DRIVER_SESSION_SECRET`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_USERNAME`, `USSD_CALLBACK_KEY`, `TELERIVET_SECRET` | `DATABASE_URL`, `USER_SESSION_SECRET`, `DRIVER_SESSION_SECRET` |
| `transport-mz-admin` | `DATABASE_URL`, `ADMIN_SESSION_SECRET` | `DATABASE_URL`, `ADMIN_SESSION_SECRET` |
| `transport-mz-driver` | `NEXT_PUBLIC_API_URL` (= `https://transport-mz.vercel.app`) | `NEXT_PUBLIC_API_URL` |

As pré-visualizações de `transport-mz` não têm chave da Africa's Talking, por isso nunca enviam SMS. Têm a sua própria entrada `DATABASE_URL`, guardada como valor sensível: confirmar para que base de dados aponta (produção ou um ramo da Neon) antes de testar numa pré-visualização algo que escreve.

## Projectos da Vercel

Um projecto da Vercel por aplicação, todos ligados a este repositório do GitHub:

| Projecto | Root Directory | Framework | Comando de compilação | Domínio de produção |
|---|---|---|---|---|
| `transport-mz` | `transport-client` | Next.js | `prisma generate && next build` (`npm run build`) | `transport-mz.vercel.app` |
| `transport-mz-admin` | `transport-admin` | Next.js | `prisma generate && next build` (com 4 GB de memória) | `transport-mz-admin.vercel.app` |
| `transport-mz-driver` | `transport-driver` | Next.js | `next build` | `transport-mz-driver.vercel.app` |

Porquê o `prisma generate` antes do `next build`: o cliente Prisma é gerado a partir do esquema e não vai no git. O `vercel.json` da raiz é da aplicação antiga, que nenhum projecto compila; `transport-client/vercel.json` só declara o framework. Como se publica está em [Publicação](publicacao.md).

## Base de dados na Neon

- **Pooled ou directo.** As aplicações usam o endereço pooled (`-pooler` no nome). Passa pelo PgBouncer, de que as funções serverless precisam porque abrem muitas ligações curtas. Para `psql`, `pg_dump` e alterações ao esquema, usar o endereço directo: o mesmo sem `-pooler` ([Base de dados → Ligar](base-de-dados.md#ligar-à-base-de-dados)).
- **Adormece sem uso.** Um computador da Neon parado suspende-se ao fim de alguns minutos, e a primeira consulta depois demora um pouco mais enquanto acorda. Porquê aceitar isto: é o que torna o plano gratuito possível.
- **Ramos (branches).** Um ramo é uma cópia instantânea de uma base de dados. Usar um para testar migrações ou experimentar com os dados de produção, e apagá-lo no fim.
- **Sem histórico de migrações.** A produção não tem a tabela `_prisma_migrations`. As alterações ao esquema aplicam-se como em [Base de dados → Alterações ao esquema](base-de-dados.md#alterações-ao-esquema-e-migrações).

## Regra de tarifa (`Tarifa`)

Os preços e as velocidades das horas de chegada estão na base de dados, na linha activa mais recente de `Tarifa`. A web, o USSD e os SMS de chegada lêem-na por `getFareRule()` ([`lib/fares.ts`](../transport-client/lib/fares.ts)); o painel lê a velocidade de viagem para as suas vistas de horário. Cada instância do servidor guarda a regra 60 s. Porquê na base de dados: mudar um preço não obriga a publicar código.

| Coluna | Por omissão | Para quê |
|---|---|---|
| `tarifaMinima` | 10 MT | Tarifa mínima. |
| `precoPorKm` | 10 MT | Tarifa = máx(`tarifaMinima`, ⌈km × `precoPorKm`⌉), com os km medidos ao longo do percurso da rota (`fareFor`). |
| `fatorEstrada` | 1,3 | Linha recta × factor ≈ distância por estrada (`estimatedRoadMeters`). Nenhum cálculo actual o usa: todas as distâncias seguem os percursos; fica para estimativas sem percurso. |
| `velocidadeViagemKmh` | 30 km/h | Velocidade dos autocarros no horário: decide as suas posições, horas de chegada e tempos de viagem. |
| `velocidadeChegadaKmh` | 45 km/h | Hora de chegada na estimativa de recurso usada quando uma rota não tem percurso. |
| `ativa` | true | Só contam as linhas activas; ganha a actualizada mais recentemente. |

Muda-se na página **Tarifa** do painel (barra lateral → Configuração → Tarifa, [Painel → Tarifa](painel-admin.md#tarifa)). A página verifica cada valor dentro de limites razoáveis e mostra quanto custam 2, 5 e 15 km com os valores escritos ([`app/api/tarifa/route.ts`](../transport-admin/app/api/tarifa/route.ts)). As aplicações usam os valores novos em 60 s. Com SQL ([Base de dados → Mudar dados](base-de-dados.md#mudar-dados)):

```sql
UPDATE "Tarifa" SET "precoPorKm" = 12, "updatedAt" = now() WHERE ativa;
```

Sem nenhuma linha activa usam-se os valores por omissão acima, e a página Tarifa oferece-os; guardar lá cria a linha.

## Constantes no código

Estes valores estão fixos no código: mudam-se com uma alteração ao código e uma publicação.

| Constante | Valor | Onde | Efeito |
|---|---|---|---|
| `GPS_FRESH_MS` | 3 min | [`transport-client/lib/vehiclePosition.ts`](../transport-client/lib/vehiclePosition.ts), [`transport-admin/lib/vehiclePosition.ts`](../transport-admin/lib/vehiclePosition.ts) | Uma posição GPS mais recente do que isto substitui a do horário. |
| `SERVICE_START_MIN`, `SERVICE_END_MIN` | 05:00, 21:00 (Maputo) | os mesmos | Os autocarros do horário andam entre estas horas e ficam parados num terminal fora delas. |
| `TERMINAL_STOP_S` | 5 min | os mesmos | Paragem em cada terminal antes da viagem seguinte. |
| `MAX_ACCURACY_M` | 200 m | [`app/api/gps/route.ts`](../transport-client/app/api/gps/route.ts) | Posições menos precisas são ignoradas. |
| `MAX_FUTURE_MS` | 2 min | o mesmo | Uma hora mais no futuro do que isto é substituída pela hora do servidor. |
| `NOTIFY_COOLDOWN_MS` | 30 min | [`lib/busSimulator.ts`](../transport-client/lib/busSimulator.ts) | Tempo mínimo entre dois SMS de chegada do mesmo alerta. |
| `CHECK_INTERVAL_MS` | 30 s | o mesmo | Tempo mínimo entre duas verificações de chegadas numa instância. |
| Janela dos alertas / distância do SMS | 24 h / 1 km | o mesmo | Alertas com mais de 24 h são ignorados; o SMS sai quando um autocarro em movimento está a menos de 1 km. |
| Janela dos passageiros à espera | 3 h | [`app/api/driver/seguidores/route.ts`](../transport-client/app/api/driver/seguidores/route.ts) | Alertas contados no portal do motorista. |
| `USSD_MAX`, `PAGE_SIZE` | 182 caracteres, 6 itens | [`lib/ussdSteps.ts`](../transport-client/lib/ussdSteps.ts) | Tamanho de um ecrã USSD e itens por página (4 nas listas de locais e rotas, em [`app/api/ussd/route.ts`](../transport-client/app/api/ussd/route.ts)). |
| Cache da regra de tarifa | 60 s | [`lib/fares.ts`](../transport-client/lib/fares.ts) | |
| Caminhadas | 2 000 em memória por instância; um pedido ao router por segundo por instância, desistindo depois de 2,5 s de espera; 4 s de limite; CDN 7 dias | [`lib/walkRoute.ts`](../transport-client/lib/walkRoute.ts), [`app/api/walk/route.ts`](../transport-client/app/api/walk/route.ts) | Caminhadas pelas ruas nos mapas. |
| Cache dos percursos das rotas | 5 min | `lib/vehiclePosition.ts` (`routePaths`) | Posições do mapa ao vivo. |
| Cache da rede do planeador | 5 min | [`lib/journeys.ts`](../transport-client/lib/journeys.ts) (`loadNetwork`) | Viagens, destinos, USSD. |
| Cache das estatísticas do painel | 5 min | [`app/api/dashboard/stats/route.ts`](../transport-admin/app/api/dashboard/stats/route.ts) | |
| Duração das sessões | passageiro 90 dias, motorista 30 dias, administrador 12 h | `lib/userSession.ts`, `lib/driverSession.ts`, `transport-admin/lib/adminSession.ts` | |
| Actualizações periódicas | mapa inicial 5 s, viagem acompanhada 10 s, viagem do motorista 30 s, passageiros à espera 60 s, perfil do motorista 5 min, lista de veículos do painel 30 s, posição do veículo no painel 15 s, cartão GPS 30 s, operação do veículo 60 s, envio de GPS do portal ≥ 15 s | componentes das páginas | |

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Base de dados](base-de-dados.md) · [Índice](README.md) · Seguinte: [Fluxos de dados](fluxos-de-dados.md)
<!-- /navegação-fim -->
