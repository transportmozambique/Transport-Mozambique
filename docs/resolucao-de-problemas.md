# Resolução de problemas

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 6. Manter › **Resolução de problemas** (página 22 de 23)

Anterior: [Testes](testes.md) · [Índice](README.md) · Seguinte: [Limitações](limitacoes.md)

<details>
<summary>Todas as páginas</summary>

- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md)
- 6. Manter: [Testes](testes.md) · **Resolução de problemas** · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

Sintomas, as causas habituais e a correcção, agrupados por onde se notam. Para os registos: Vercel → projecto → **Logs** (ou `vercel logs <url da publicação>`, [Guia da Vercel → Registos](guia-vercel.md#registos)); para os dados: [Base de dados → Ligar à base de dados](base-de-dados.md#ligar-à-base-de-dados).

**Como procurar.** Primeiro, onde se nota o problema (uma aplicação, um SMS, uma compilação); depois, a mensagem exacta. As mensagens da aplicação estão em português e podem procurar-se no código (`grep -rn "PIN incorreto" transport-client`) para chegar à linha que as escreve.

**Nesta página:** [Entrada](#entrada) · [USSD](#ussd) · [SMS](#sms) · [Posições e GPS](#posições-e-gps) · [Aplicação dos passageiros](#aplicação-dos-passageiros) · [Painel](#painel) · [Compilações e publicações](#compilações-e-publicações) · [Base de dados](#base-de-dados) · [Desenvolvimento local e testes](#desenvolvimento-local-e-testes)

---

## Entrada

| Sintoma | Causa | Correcção |
|---|---|---|
| Motorista: "Ainda não tem PIN. Peça ao administrador para gerar o seu PIN." | O motorista não tem PIN. Todos os motoristas de produção perderam a antiga palavra-passe partilhada em 2026-10-16. | Painel → Motoristas → o motorista → "Gerar PIN" ([Painel → Dar um PIN a um motorista](painel-admin.md#tarefa-pin)). |
| Motorista: "Motorista não encontrado. Contacte o administrador." | Nenhum motorista tem esse número. | Confirmar o telefone na página do motorista; `+258` e os espaços não contam. |
| Motorista: "PIN incorreto" | PIN errado, ou foi gerado um PIN mais novo. | Gerar um PIN novo e dá-lo ao motorista. |
| Motorista: "Sessão indisponível. Contacte o administrador." (500) | Falta `DRIVER_SESSION_SECRET` em `transport-mz`. | Defini-lo e publicar outra vez ([Configuração](configuracao.md#variáveis-de-ambiente)). |
| Portal do motorista: "Erro de conexão. Verifique se o servidor está a funcionar." | O portal não chega a `NEXT_PUBLIC_API_URL`, ou a variável está errada. É fixada **na compilação**. | Corrigir a variável em `transport-mz-driver` e publicar outra vez (uma compilação nova, não só um reinício). |
| Motorista volta à página de entrada | O token expirou (30 dias), `DRIVER_SESSION_SECRET` mudou, ou o motorista foi apagado. | Entrar outra vez. |
| Passageiro: "Este número ainda não tem senha. Faça o registo para criar uma." | A conta foi criada pelo USSD e não tem palavra-passe. | Registar-se com o mesmo telefone; a conta e os alertas ficam. |
| Passageiro: "Sessão indisponível. Tente mais tarde." (500) | Falta `USER_SESSION_SECRET` em `transport-mz`. | Defini-lo e publicar outra vez. |
| Passageiro: "Telefone ou senha incorretos" | Palavra-passe errada; não há recuperação por email nem SMS. | Painel → Utentes → o passageiro → editar, e definir uma palavra-passe nova. |
| Painel: "Servidor sem configuração de sessão" (500) | Falta `ADMIN_SESSION_SECRET` em `transport-mz-admin`. | Defini-lo e publicar outra vez. |
| Painel: volta a `/login` | A sessão de 12 horas acabou, ou o segredo mudou. | Entrar outra vez. |
| Painel: ninguém consegue entrar | Não existe nenhum administrador, ou a palavra-passe perdeu-se. | `node create-admin.js` em `transport-admin` com `DATABASE_URL` definida ([Painel → Entrada](painel-admin.md#entrada-e-sessão)). |

## USSD

| Sintoma | Causa | Correcção |
|---|---|---|
| "END Erro ao processar pedido. Tente novamente." | Uma excepção no código dos menus, muitas vezes a base de dados (inacessível, ou a acordar). | Ler a entrada `Erro USSD` nos registos de `transport-mz`. |
| Todos os pedidos recebem `403 Forbidden` | `USSD_CALLBACK_KEY` está definida mas o URL do callback na Africa's Talking não tem `?key=`, ou tem outro. | Pôr no URL a mesma chave da variável ([Segurança → Resposta USSD](seguranca.md#resposta-ussd-callback)). |
| `Nenhuma paragem com "…"` para um nome que existe | O nome escrito não coincide com nenhuma palavra do nome, nem a soar igual, nem com um erro ([Serviço USSD → Pesquisa tolerante](ussd.md#pesquisa-tolerante)). | Escrever só uma parte do nome (`zimp`), ou outra palavra dele. Se um nome comum falhar sempre, juntar a forma escrita às abreviaturas de [`lib/places.ts`](../transport-client/lib/places.ts). |
| Sessões "Incomplete" na Africa's Talking | O telemóvel saiu antes de um ecrã `END`, ou o callback respondeu tarde. Uma base de dados da Neon a dormir junta alguns segundos ao primeiro pedido. | Tentar outra vez. Se se repetir, ver a duração da função nos registos da Vercel. |
| O simulador não mostra nada, ou o erro da Africa's Talking | URL do callback errado na Africa's Talking, ou a publicação está em baixo. | AT → USSD → Service Codes; abrir o URL num navegador (um `GET` responde 405, o que prova que está no ar). |
| Um motorista não consegue usar a opção 6 | PIN errado ou sem PIN; ou o telemóvel que liga não é o número do motorista. | A opção 6 identifica o motorista pelo número que liga. Confirmar os dois no painel. |
| Texto cortado com `..` | Os ecrãs têm no máximo 182 caracteres. | Esperado ([Serviço USSD → Dentro do handler](ussd.md#dentro-do-handler)). |

## SMS

| Sintoma | Causa | Correcção |
|---|---|---|
| Registo: `SMS não enviado para … AFRICASTALKING_API_KEY não configurada` | Não há chave da API neste ambiente. As pré-visualizações nunca têm. | Pôr a chave em `transport-mz` Production ([Africa's Talking](africas-talking.md#sms)). |
| Registo: "The supplied authentication is invalid" | Uma chave gerada há minutos, ou a chave de outra aplicação ou conta, ou o nome de utilizador não é o da aplicação da chave. | Esperar alguns minutos; confirmar `AFRICASTALKING_USERNAME`. |
| Registo: "The server was not able to produce a timely response" | A API de mensagens do sandbox da Africa's Talking às vezes é lenta. | Nada do nosso lado; o SMS não se repete. |
| SMS enviado mas nenhum telemóvel o recebe | O sandbox só entrega no simulador. | Esperado até [passar a produção](africas-talking.md#passar-a-produção). |
| Nenhum SMS de chegada para um passageiro à espera | A verificação corre a cada 5 minutos (GitHub Actions) e com o tráfego do mapa, mas: o alerta tem mais de 24 h; já saiu um SMS para ele nos últimos 30 min; nenhum autocarro **em movimento** numa rota que passa na paragem está a menos de 1 km; ou o agendamento do GitHub está suspenso. | Correr a verificação: `curl -X POST https://transport-mz.vercel.app/api/simulation -H "Content-Type: application/json" -d '{"action":"check"}'` e ler `lastArrivalCheck`; confirmar o separador Actions do GitHub ([Publicação](publicacao.md#os-três-projectos); [Limitações → Notificações](limitacoes.md#notificações)). |

## Posições e GPS

| Sintoma | Causa | Correcção |
|---|---|---|
| Todos os autocarros parados nos terminais | Fora do horário de serviço (antes das 05:00 ou depois das 21:00, hora de Maputo). | Esperado ([Localização e GPS](localizacao-gps.md#como-se-escolhe-uma-posição)). |
| Um autocarro fica parado alguns minutos | Está num terminal (5 minutos em cada um). | Esperado. |
| Um autocarro salta entre dois sítios | O seu dispositivo GPS envia menos de uma vez a cada 3 minutos, por isso alterna entre GPS e horário. | Enviar mais vezes (Traccar Client: 15 s). |
| O dispositivo recebe 401 "Código do dispositivo em falta" | O pedido não leva código (sem `id`, `deviceid` nem `Authorization: Bearer`). | Pôr o código como identificador do dispositivo ([Localização e GPS](localizacao-gps.md#traccar-client-num-telemóvel)). |
| O dispositivo recebe 401 "Dispositivo desconhecido" | O código foi mal escrito, gerado outra vez ou revogado. | Gerar um código novo e pô-lo no dispositivo. |
| O dispositivo recebe 400 "Coordenadas inválidas" | Faltam as coordenadas, ou são 0,0 (ainda sem posição). | Esperar uma posição; confirmar a permissão de localização do dispositivo. |
| `{"ok":true,"ignored":"precisão insuficiente"}` | A precisão enviada é pior do que 200 m. | Melhor vista do céu; "alta precisão" na aplicação. |
| `{"ok":true,"ignored":"posição mais antiga do que a última"}` | Uma posição em fila ou repetida, mais antiga do que a guardada, ou o relógio do dispositivo está atrasado. | Normalmente inofensivo. Se for constante, confirmar o relógio do dispositivo. |
| O painel diz "GPS ativo" mas os passageiros vêem a posição do horário | As posições chegam com uma hora com mais de 3 minutos (relógio do dispositivo atrasado). | Acertar o relógio do dispositivo ou não enviar a hora. |
| Um autocarro não aparece no mapa (lista do painel: "Sem rota") | A sua rota não tem percurso e não há posição guardada, ou não tem rota. | Dar ao veículo uma rota com percurso. |

## Aplicação dos passageiros

| Sintoma | Causa | Correcção |
|---|---|---|
| Uma paragem cinzenta no mapa e ausente da pesquisa | Nenhuma das suas rotas tem veículo. | Atribuir um veículo a uma das suas rotas. |
| "Não há ligação de autocarro entre estes dois locais" | Nenhuma cadeia de autocarros liga os dois locais. Algumas rotas formam grupos separados sem paragens a menos de 400 m do resto ([Fluxos de dados → Planear uma viagem](fluxos-de-dados.md#planear-uma-viagem)). | Escolher uma paragem perto do destino, ou ligar os grupos no painel (uma paragem partilhada, ou uma rota entre eles). |
| "A localização está desativada…" | A permissão de localização do navegador foi recusada. A lista segue então o centro do mapa. | Permitir a localização nas definições do site, e depois o botão redondo em baixo à direita. Os navegadores só dão a localização em HTTPS ou em localhost. |
| "Está fora da área servida" | A posição está a mais de 80 km de Maputo. | Esperado fora da área: mover o mapa ou tocar numa paragem. |
| Paragens por uma ordem estranha | A ordem calcula-se ao longo do percurso da rota; uma paragem longe do percurso pode mudar de lugar. | Confirmar a posição da paragem e o percurso no painel. |
| "Entre na sua conta para receber o SMS." | Sem sessão ao pedir o alerta por SMS a acompanhar uma viagem. | Entrar em `/auth`. |
| As horas dizem "amanhã às 05:12" | Pesquisa ao fim do dia ou à noite: os autocarros andam das 05:00 às 21:00. | Esperado. |

## Painel

| Sintoma | Causa | Correcção |
|---|---|---|
| Números do início desactualizados | As estatísticas ficam em cache 5 minutos por instância do servidor. | Esperar, ou ver as páginas das listas. |
| "Nova Via": "Não foi possível calcular o percurso pelas estradas" | O router OSRM público não respondeu (em baixo ou com limite de pedidos). | Mover ou juntar um ponto para tentar mais tarde. |
| Faltam os mosaicos do mapa | A OpenFreeMap ou o OpenStreetMap estão bloqueados pela rede. | Confirmar o acesso a `tiles.openfreemap.org`. |
| "Não é possível eliminar …" | Apagar um registo que ainda tem dependentes (uma província com municípios, um veículo com motorista, …). | Tirar primeiro os dependentes ([Referência da API → Listas e registos](referencia-api.md#listas-e-registos)). |
| A pesquisa do cabeçalho não encontra um motorista pelo telefone | Menos de 3 algarismos, ou letras misturadas: só uma pesquisa de algarismos (com espaços, `+` e `-` permitidos) se compara com os algarismos do telefone. | Escrever pelo menos 3 algarismos do número, por exemplo `8718315` ou `+258 87 183`. |

## Compilações e publicações

| Sintoma | Causa | Correcção |
|---|---|---|
| A compilação falha com um erro de TypeScript | A Vercel verifica os tipos durante `next build`. | Correr `npx tsc --noEmit` localmente e corrigir. |
| Compilação do painel: `Invalid value undefined for datasource "db"` | Falta `DATABASE_URL` na compilação. | Defini-la no ambiente que se compila. |
| A compilação do painel fica sem memória | A compilação precisa de 4 GB de memória. | Manter `NODE_OPTIONS=--max-old-space-size=4096` no script de compilação. |
| Uma variável de ambiente alterada não faz efeito | As variáveis só se aplicam às publicações novas; as `NEXT_PUBLIC_*` ficam no código na compilação. | Publicar outra vez ([Publicação → Publicar à mão](publicacao.md#publicar-à-mão)). |
| Publicação recusada com "rate limited" | O plano Hobby da Vercel limita as publicações por dia. | Esperar e juntar as alterações num só push ([Publicação](publicacao.md#como-uma-alteração-chega-à-produção)). |
| O CI falha em "As ligações e âncoras da documentação existem" ou na navegação | Uma ligação aponta para uma página ou um título que mudou, ou uma página nova sem navegação. | Corrigir a ligação; correr `python3 .github/scripts/docs-nav.py` ([Testes → CI no GitHub](testes.md#ci-no-github)). |

## Base de dados

| Sintoma | Causa | Correcção |
|---|---|---|
| `The column … does not exist` / `The table … does not exist` | Código publicado antes de a sua migração ser aplicada na produção. | Aplicar a migração ([Publicação → Alterações à base de dados em produção](publicacao.md#alterações-à-base-de-dados-em-produção)), ou voltar atrás com o código. |
| `Can't reach database server` (P1001) | Servidor errado, ou o projecto da Neon está suspenso ou acima da quota, ou a palavra-passe mudou. | Ver a consola da Neon e `DATABASE_URL` ([Guia da Neon](guia-neon.md)). |
| Demasiadas ligações | Funções serverless a usar o endereço directo. | Usar o endereço com pooler (`-pooler`) nas aplicações; o directo só nas ferramentas. |
| `prisma migrate deploy` quer criar tudo outra vez | A produção não tem histórico de migrações. | Nunca o correr na produção; seguir [Publicação → Alterações à base de dados em produção](publicacao.md#alterações-à-base-de-dados-em-produção). |

## Desenvolvimento local e testes

| Sintoma | Causa | Correcção |
|---|---|---|
| Duas aplicações querem a porta 3000 | O `npm run dev` do painel não tem porta. | `npm run dev -- -p 3002` ([Primeiros passos → 7](primeiros-passos.md#7-correr-as-aplicações)). |
| A entrada do motorista falha localmente com `next start` | O modo de produção recusa sessões sem `DRIVER_SESSION_SECRET`. | Defini-lo (qualquer valor) ou usar `npm run dev`. |
| Playwright: "Could not find a production build" | Os testes servem a aplicação compilada. | `npm run build` primeiro (com `DATABASE_URL` definida). |
| Playwright ou Jest: recusa correr contra uma base de dados | Os testes só escrevem numa base de dados local. | Apontar `E2E_DATABASE_URL` / `DATABASE_URL` para uma cópia local ([Testes](testes.md#uma-base-de-dados-local-de-teste)). |
| Playwright: porta 3102 ocupada | Ainda está a correr um servidor de uma corrida anterior. | Pará-lo, ou definir `E2E_PORT`. |
| `pg_restore` falha numa cópia da produção | A cópia é do PostgreSQL 18; as ferramentas ou o servidor são mais antigos. | Usar as ferramentas e o servidor do PostgreSQL 18 ([Primeiros passos → Cópia dos dados de produção](primeiros-passos.md#trabalhar-com-uma-cópia-dos-dados-de-produção)). |

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Testes](testes.md) · [Índice](README.md) · Seguinte: [Limitações](limitacoes.md)
<!-- /navegação-fim -->
