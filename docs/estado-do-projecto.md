# Estado do projecto

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 1. Conhecer o projecto › **Estado do projecto** (página 4 de 23)

Anterior: [Fontes de dados](fontes-de-dados.md) · [Índice](README.md) · Seguinte: [Primeiros passos](primeiros-passos.md)

<details>
<summary>Todas as páginas</summary>

- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · **Estado do projecto**
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

Onde o projecto está em 2026-10-18: o que funciona, que dados tem, o que espera por alguém, os próximos passos e o histórico das alterações. Os limites que ficam por desenho estão em [Limitações](limitacoes.md).

**Nesta página:** [O que funciona hoje](#o-que-funciona-hoje) · [Os dados](#os-dados) · [À espera de acção](#à-espera-de-acção) · [Próximos passos](#próximos-passos) · [Histórico](#histórico)

---

## O que funciona hoje

| Parte | Estado |
|---|---|
| Aplicação dos passageiros | Ao vivo em https://transport-mz.vercel.app ([Aplicação dos passageiros](app-passageiros.md)). |
| Painel de administração | Ao vivo em https://transport-mz-admin.vercel.app ([Painel de administração](painel-admin.md)). |
| Portal do motorista | Ao vivo em https://transport-mz-driver.vercel.app. Os motoristas entram com um PIN gerado por um administrador ([Portal do motorista](portal-motorista.md)). |
| USSD e SMS | No **sandbox** da Africa's Talking: `*384*848080#` no simulador, não em telemóveis reais. O URL de resposta está protegido por uma chave ([Africa's Talking](africas-talking.md)). |
| Posições dos autocarros | O **modelo de horário** para todos os autocarros. A entrada de GPS funciona (`/api/gps`, Traccar Client, portal do motorista), mas nenhum veículo tem dispositivo ainda ([Localização e GPS](localizacao-gps.md)). |
| Base de dados | PostgreSQL na Neon, ramo `production` ([Guia da Neon](guia-neon.md)). |
| Alojamento | Três projectos na Vercel; cada merge na `main` publica-os ([Guia da Vercel](guia-vercel.md)). |
| Verificações e agendamento | GitHub Actions: "Verificações" em cada pull request ([Testes → CI](testes.md#ci-no-github)), e a "Verificação de chegadas (SMS)" a cada 5 minutos ([Publicação](publicacao.md#os-três-projectos)). |

## Os dados

Produção em 2026-10-18 ([contados na Neon](guia-neon.md#3-colar-uma-consulta-e-corrê-la)):

| | |
|---|---|
| Rotas | 261: as 91 primeiras, e 170 do OpenStreetMap |
| Paragens | 1 902, em Maputo (185 rotas) e na Matola (76) |
| Veículos | 451: os 111 primeiros, e 340 para as rotas importadas (matrículas `ADA-001M` a `ADA-340M`) |
| Motoristas | 451, um por veículo: os 111 primeiros, e 340 de demonstração para os veículos importados |
| Passageiros, alertas | poucos, todos dos testes |
| Regra de tarifa | 10 MT mínimo, 10 MT por km, 30 km/h; muda-se na página "Tarifa" do painel |

De onde veio cada parte, e o que é inventado: [Fontes de dados](fontes-de-dados.md).

As alterações dos scripts de dados foram aplicadas à produção em 2026-10-18, como uma só instrução SQL no [editor de SQL da Neon](guia-neon.md):

- 340 motoristas de demonstração ([add-drivers.mjs](base-de-dados.md#motoristas-para-os-veículos-importados));
- 51 percursos postos nas estradas ([snap-paths.mjs](base-de-dados.md#pôr-os-percursos-das-rotas-nas-estradas) e [redraw-from-osm.mjs](base-de-dados.md#redesenhar-rotas-a-partir-das-suas-paragens-do-openstreetmap));
- 86 paragens ligadas a 6 rotas redesenhadas, e 5 paragens longe desligadas das rotas 503 e X05.

O troço recto mais longo que resta numa rota tem 7,2 km, ao longo da EN1, que é recta até à Manhiça.

## À espera de acção

Coisas que se fazem nas aplicações ou nas contas, não no código:

1. **Mudar a palavra-passe da base de dados na Neon** e guardar o endereço novo como Secret. Porquê: em `transport-mz`, a `DATABASE_URL` de Production e Development é uma variável legível pelos membros do projecto, e um segredo que se pôde ler trata-se como conhecido; guardá-la como Secret sem mudar a palavra-passe deixava o valor antigo válido. Passo a passo:
   1. Neon → projecto → ramo **production** → **Roles** → `neondb_owner` → **Reset password** ([Guia da Neon → Repor a palavra-passe](guia-neon.md#8-repor-a-palavra-passe)). A partir daqui as aplicações dão erro até ao passo 4.
   2. Copiar o endereço de ligação novo com **Pooled connection** ligado.
   3. Vercel → `transport-mz` → **Settings → Environment Variables** → `DATABASE_URL`: apagar as linhas antigas e juntar uma nova, de tipo **Secret**, com o endereço novo, para Production e Preview. A de Development não volta: a Vercel não aceita Secret em Development, e localmente o endereço vem do `.env`. O mesmo em `transport-mz-admin` (Production e Preview). Os `.env` locais que apontam para a produção também mudam ([Guia da Vercel → Variáveis de ambiente](guia-vercel.md#variáveis-de-ambiente)).
   4. Publicar outra vez os dois projectos (**Deployments** → a última publicação → **Redeploy**) e confirmar o mapa e uma entrada no painel ([Publicação → Confirmar uma publicação](publicacao.md#confirmar-uma-publicação)).

## Próximos passos

Precisam de decisões, contas ou dinheiro, não de código:

- **Pôr o USSD e os SMS ao vivo** nas redes moçambicanas: uma aplicação de produção na Africa's Talking, um código de serviço, crédito ([Africa's Talking → Passar a produção](africas-talking.md#passar-a-produção)).
- **Equipar os veículos com GPS:** Traccar Client no telemóvel de cada motorista, ou rastreadores. O mapa passa a mostrar posições reais em vez do horário ([Localização e GPS → Ligar um dispositivo](localizacao-gps.md#ligar-um-dispositivo)).
- **Motoristas e veículos reais** no lugar dos de demonstração ([Fontes de dados](fontes-de-dados.md#veículos-motoristas-e-proprietários)), registados no painel ([Tarefas comuns](painel-admin.md#tarefas-comuns-passo-a-passo)).
- **Melhores nomes de paragens** onde o nome da rua se repete, por alguém que conheça as referências locais ([Limitações → Dados](limitacoes.md#dados)).
- **Tarifas iguais às que os chapas cobram**, na página "Tarifa".

## Histórico

Os pull requests juntados na `main` de [transportmozambique/Transport-Mozambique](https://github.com/transportmozambique/Transport-Mozambique/pulls?q=is%3Apr+is%3Amerged):

| # | Data | Alteração |
|---|---|---|
| 1 | 2026-10-16 | Estado da viagem do motorista e uma só regra de tarifa para a web e o USSD |
| 2 | 2026-10-16 | Avaliação: autenticação do painel, uma só estimativa de viagem, USSD refeito, correcções das notificações |
| 3 | 2026-10-16 | Percursos das rotas pelas estradas; testes CRUD do painel com Playwright |
| 4 | 2026-10-16 | GPS real dos veículos, e autocarros ao longo do dia (modelo de horário) |
| 5 | 2026-10-16 | Desfazer/refazer no desenho de rotas, PINs e sessões dos motoristas, passageiros por USSD |
| 6–9 | 2026-10-16 | Criação de administradores sem credenciais no código; portal do motorista sem dados inventados; ecrãs USSD do motorista em 182 caracteres; cada passageiro só vê os seus dados |
| 10–13 | 2026-10-17 | Correcções encontradas ao documentar; nenhum autocarro prometido depois das 21:00; as contas da semente entram; chave opcional do callback USSD; documentação completa |
| 14–17 | 2026-10-17 | Onde correr consultas; planeador de viagens; planear a partir de um início, como nas aplicações de transporte (A → B → C) |
| 18–21 | 2026-10-17 | Paragens e rotas importadas do OpenStreetMap, com veículos; um local por terminal |
| 22–27 | 2026-10-18 | Acompanhar uma viagem inteira num só mapa; caminhadas pelas ruas; folha arrastável nos telemóveis; novo portal do motorista; embarque numa paragem escolhida |
| 28 | 2026-10-18 | Painel: barra lateral em grupos, menu no telemóvel, novo painel inicial |
| 29 | 2026-10-18 | Scripts de dados: percursos nas estradas, motoristas para os veículos importados |
| 30 | 2026-10-18 | Passageiros que escreviam espaços no telefone não conseguiam entrar |
| 31–32 | 2026-10-18 | Correcção dos testes e2e do painel; componente de mapa sem uso removido |
| 33 | 2026-10-18 | Rotas com saltos redesenhadas a partir das paragens do OSM; "Redesenhar percurso" no painel |
| 34 | 2026-10-18 | Guia da Neon |
| 35 | 2026-10-18 | `--unlink-far` para as paragens longe de uma rota |
| 36 | 2026-10-18 | Listas de rotas no USSD começam pelo código; ordinais em GSM-7 |
| 37 | 2026-10-18 | Guias passo a passo da Africa's Talking e da Vercel, como se trata um pedido USSD, glossário, esta página, navegação da documentação |
| 38 | 2026-10-18 | Painel em branco, preto e cinzento; sem emojis nem setas decorativas |
| 39 | 2026-10-18 | Menu do painel em ecrã inteiro nos telemóveis e tablets |
| 40 | 2026-10-18 | Esta página: as correcções de dados aplicadas à produção |
| 41 | 2026-10-18 | O mapa inicial dos passageiros carrega 20 KB em vez de 1 MB; um autocarro tocado carrega a sua rota |
| 42 | 2026-10-18 | Página da tarifa; o portal do motorista acompanha mudanças de veículo; pesquisa de telefones pelos algarismos; desenho de rotas com um segundo router; posição do passageiro fora dos registos; verificação de chegadas a cada 5 min no GitHub Actions; CI; fontes de dados, tarefas passo a passo e como contornar cada limitação |
| 43 | 2026-10-18 | USSD: cada tecla lida pelo ecrã a que responde, pesquisa que aceita nomes mal escritos, escrever outro nome numa lista faz nova pesquisa; documentação toda em português, como guia passo a passo em seis partes, com o porquê das escolhas, mapa do código e navegação gerada; código, comentários e mensagens em português |
| 44 | 2026-10-18 | V086 confirmada na estrada (nada a redesenhar); segredos das sessões dos passageiros e dos motoristas trocados e guardados como Secret; SQL para apagar os passageiros de teste do USSD; os passos da mudança da palavra-passe da Neon |
| 46 | 2026-10-19 | Apagado o código que não se publicava (a aplicação antiga da raiz, a rota Telerivet, cerca de 250 scripts de uso único, cópias `*.backup` e `*.old`); os passageiros de teste do USSD apagados da produção no editor da Neon |

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Fontes de dados](fontes-de-dados.md) · [Índice](README.md) · Seguinte: [Primeiros passos](primeiros-passos.md)
<!-- /navegação-fim -->
