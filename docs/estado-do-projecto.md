# Estado do projecto

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 1. Conhecer o projecto › **Estado do projecto** (página 6 de 26)

Anterior: [Fontes de dados](fontes-de-dados.md) · [Índice](README.md) · Seguinte: [Primeiros passos](primeiros-passos.md)

<details>
<summary>Todas as páginas</summary>

- 0. Começar do zero: [Conceitos básicos](conceitos.md) · [Preparar o computador](preparar-o-computador.md)
- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · **Estado do projecto**
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md) · [Guia do cron-job.org](guia-cron-job.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

> **Em palavras simples:** O ponto da situação: o que já funciona, que dados existem, o que falta alguém fazer, o que se pode fazer a seguir, e a lista das mudanças feitas até hoje.

Onde o projecto está em 2026-10-18: o que funciona, que dados tem, o que espera por alguém, os próximos passos e o histórico das alterações. Os limites que ficam por desenho estão em [Limitações](limitacoes.md).

**Nesta página:** [O que funciona hoje](#o-que-funciona-hoje) · [Os dados](#os-dados) · [À espera de acção](#à-espera-de-acção) · [Próximos passos](#próximos-passos) · [Histórico](#histórico)

---

## O que funciona hoje

| Parte | Estado |
|---|---|
| Aplicação dos passageiros | Ao vivo em https://transport-mz.vercel.app ([Aplicação dos passageiros](app-passageiros.md)). |
| Painel de administração | Ao vivo em https://transport-mz-admin.vercel.app ([Painel de administração](painel-admin.md)). |
| Portal do motorista | Ao vivo em https://transport-mz-driver.vercel.app. Os motoristas entram com um PIN gerado por um administrador ([Portal do motorista](portal-motorista.md)). |
| [USSD](conceitos.md#ussd "Os menus que aparecem num telemóvel quando se marca um código como *384*848080#; funcionam em qualquer telemóvel, sem internet.") e [SMS](conceitos.md#sms "As mensagens de texto curtas dos telemóveis.") | No **[sandbox](conceitos.md#africas-talking "O gateway de USSD e SMS usado por este projecto.")** da Africa's Talking: `*384*848080#` no simulador, não em telemóveis reais. O [URL](conceitos.md#url "O texto que diz ao navegador onde está uma página ou informação, como https://transport-mz.vercel.app/viagem.") de resposta está protegido por uma chave ([Africa's Talking](africas-talking.md)). |
| Posições dos autocarros | Pela **viagem do motorista** para todos os autocarros: parados até o motorista carregar em "Iniciar viagem", depois a ir e voltar ao longo da rota. A entrada de [GPS](conceitos.md#gps "O sistema de satélites com que um telemóvel ou um aparelho sabe as suas coordenadas.") funciona (`/api/gps`, [Traccar Client](conceitos.md#traccar "Uma aplicação gratuita para telemóvel que envia a posição do telemóvel pelo protocolo OsmAnd."), portal do motorista), mas nenhum veículo tem dispositivo ainda ([Localização e GPS](localizacao-gps.md)). |
| [Base de dados](conceitos.md#base-de-dados "O sítio organizado onde a plataforma guarda tudo o que tem de durar: rotas, paragens, veículos, contas.") | [PostgreSQL](conceitos.md#postgresql "O programa de base de dados que este projecto usa; gratuito e muito usado.") na [Neon](conceitos.md#neon "A empresa que guarda a base de dados PostgreSQL da produção, na internet."), [ramo](conceitos.md#ramo "Uma linha de trabalho separada, onde se fazem mudanças sem tocar na versão principal.") `production` ([Guia da Neon](guia-neon.md)). |
| Alojamento | Três projectos na [Vercel](conceitos.md#vercel "A empresa cujos servidores correm as três aplicações e as publicam a cada merge."); cada [merge](conceitos.md#pull-request "Um pull request é o pedido para juntar um ramo ao main; o merge é a junção, quando o pedido é aceite.") na `main` publica-os ([Guia da Vercel](guia-vercel.md)). |
| Verificações e [agendamento](conceitos.md#agendamento "Uma tarefa que corre sozinha a uma hora marcada, ou de tantos em tantos minutos.") | [GitHub Actions](conceitos.md#ci "Verificações que o GitHub corre sozinho a cada pull request, para nenhum erro conhecido chegar ao main."): "Verificações" em cada pull request ([Testes → CI](testes.md#ci-no-github)), e a "Verificação de chegadas (SMS)", de reserva ([Publicação](publicacao.md#os-três-projectos)). A verificação a cada minuto é um cronjob no cron-job.org ([Guia do cron-job.org](guia-cron-job.md)). |

## Os dados

Produção em 2026-10-18, com as mudanças de 2026-10-27 ([contados na Neon](guia-neon.md#3-colar-uma-consulta-e-corrê-la)):

| | |
|---|---|
| Rotas | 261, das quais **3 activas** desde 2026-10-27 (X19, 411 e X22, com 2 autocarros cada; [Base de dados → Rotas activas](base-de-dados.md#rotas-activas)): as 91 primeiras, e 170 do [OpenStreetMap](conceitos.md#openstreetmap "Um mapa do mundo inteiro feito por voluntários, como uma Wikipédia dos mapas, que qualquer pessoa pode usar e corrigir.") |
| Paragens | 1 902, em Maputo (185 rotas) e na Matola (76) |
| Veículos | 6, os 2 de cada rota activa: ADA-013M e ADA-014M (X19), ADA-193M e ADA-194M (411), ADA-169M e ADA-170M (X22). Até 2026-10-27 eram 451 (os 111 primeiros, e 340 para as rotas importadas); os das rotas desactivadas foram apagados ([Base de dados → Veículos e motoristas das rotas desactivadas](base-de-dados.md#veículos-e-motoristas-das-rotas-desactivadas)) |
| Motoristas | 6, um por veículo, todos com PIN. Até 2026-10-27 eram 451 |
| Passageiros, alertas | poucos, todos dos testes |
| Regra de tarifa | 10 MT mínimo, 10 MT por km, 30 km/h; muda-se na página "Tarifa" do painel |

De onde veio cada parte, e o que é inventado: [Fontes de dados](fontes-de-dados.md).

As alterações dos [scripts](conceitos.md#script "Um pequeno programa que se corre à mão, uma vez, para uma tarefa: importar dados, corrigir percursos, mostrar listas.") de dados foram aplicadas à produção em 2026-10-18, como uma só instrução [SQL](conceitos.md#sql "A linguagem com que se fazem perguntas e alterações a uma base de dados.") no [editor de SQL da Neon](guia-neon.md):

- 340 motoristas de demonstração ([add-drivers.mjs](base-de-dados.md#motoristas-para-os-veículos-importados));
- 51 percursos postos nas estradas ([snap-paths.mjs](base-de-dados.md#pôr-os-percursos-das-rotas-nas-estradas) e [redraw-from-osm.mjs](base-de-dados.md#redesenhar-rotas-a-partir-das-suas-paragens-do-openstreetmap));
- 86 paragens ligadas a 6 rotas redesenhadas, e 5 paragens longe desligadas das rotas 503 e X05.

O troço recto mais longo que resta numa rota tem 7,2 km, ao longo da EN1, que é recta até à Manhiça.

## À espera de acção

Coisas que se fazem nas aplicações ou nas contas, não no código:

1. **Iniciar as viagens.** Os 6 motoristas têm PIN desde 2026-10-27. Sem viagem iniciada, nenhum autocarro está em serviço: o USSD responde "Nenhum autocarro em servico agora" e não saem avisos. Cada motorista entra no [portal do motorista](portal-motorista.md) com o telefone e o PIN e carrega em **Iniciar viagem**; no fim, **Terminar viagem**. Um PIN só se mostra uma vez: quem o perdeu recebe outro em Painel → Motoristas → **Gerar PIN** ([Painel → Dar um PIN](painel-admin.md#tarefa-pin)).
2. **Mudar a palavra-passe da base de dados na Neon** e guardar o endereço novo como Secret. Porquê: em `transport-mz`, a `DATABASE_URL` de Production e Development é uma variável legível pelos membros do projecto, e um [segredo](conceitos.md#segredo "Um valor que só a plataforma deve saber, como uma palavra-passe: quem o tiver pode agir em nome dela.") que se pôde ler trata-se como conhecido; guardá-la como Secret sem mudar a palavra-passe deixava o valor antigo válido. Passo a passo:
   1. Neon → projecto → ramo **production** → **Roles** → `neondb_owner` → **Reset password** ([Guia da Neon → Repor a palavra-passe](guia-neon.md#8-repor-a-palavra-passe)). A partir daqui as aplicações dão erro até ao passo 4.
   2. Copiar o endereço de ligação novo com **Pooled connection** ligado.
   3. Vercel → `transport-mz` → **Settings → Environment Variables** → `DATABASE_URL`: apagar as linhas antigas e juntar uma nova, de tipo **Secret**, com o endereço novo, para Production e Preview. A de Development não volta: a Vercel não aceita Secret em Development, e localmente o endereço vem do [`.env`](conceitos.md#variavel-de-ambiente "Uma definição que se dá a um programa de fora do código, como o endereço da base de dados ou uma palavra-passe."). O mesmo em `transport-mz-admin` (Production e Preview). Os `.env` locais que apontam para a produção também mudam ([Guia da Vercel → Variáveis de ambiente](guia-vercel.md#variáveis-de-ambiente)).
   4. Publicar outra vez os dois projectos (**Deployments** → a última [publicação](conceitos.md#publicacao "Pôr uma versão nova do código a funcionar nos servidores, ao vivo, para toda a gente.") → **Redeploy**) e confirmar o mapa e uma entrada no painel ([Publicação → Confirmar uma publicação](publicacao.md#confirmar-uma-publicação)).

## Próximos passos

Precisam de decisões, contas ou dinheiro, não de código:

- **Pôr o USSD e os SMS ao vivo** nas redes moçambicanas: uma aplicação de produção na Africa's Talking, um código de serviço, crédito ([Africa's Talking → Passar a produção](africas-talking.md#passar-a-produção)).
- **Equipar os veículos com GPS:** Traccar Client no telemóvel de cada motorista, ou [rastreadores](conceitos.md#rastreador "Um aparelho (ou um telemóvel com uma aplicação) que envia a posição de um veículo pela internet; o código do dispositivo é a sua 'palavra-passe'."). O mapa passa a mostrar posições reais em vez das calculadas pela viagem ([Localização e GPS → Ligar um dispositivo](localizacao-gps.md#ligar-um-dispositivo)).
- **Motoristas e veículos reais** no lugar dos de demonstração ([Fontes de dados](fontes-de-dados.md#veículos-motoristas-e-proprietários)), registados no painel ([Tarefas comuns](painel-admin.md#tarefas-comuns-passo-a-passo)).
- **Melhores nomes de paragens** onde o nome da rua se repete, por alguém que conheça as referências locais ([Limitações → Dados](limitacoes.md#dados)).
- **Tarifas iguais às que os [chapas](glossario.md#transportes-em-maputo "Os minibuses que levam a maior parte dos passageiros de Maputo") cobram**, na página "Tarifa".

## Histórico

Os pull requests juntados na `main` de [transportmozambique/Transport-Mozambique](https://github.com/transportmozambique/Transport-Mozambique/pulls?q=is%3Apr+is%3Amerged):

| # | Data | Alteração |
|---|---|---|
| 1 | 2026-10-16 | Estado da viagem do motorista e uma só regra de tarifa para a web e o USSD |
| 2 | 2026-10-16 | Avaliação: autenticação do painel, uma só estimativa de viagem, USSD refeito, correcções das notificações |
| 3 | 2026-10-16 | Percursos das rotas pelas estradas; testes CRUD do painel com [Playwright](conceitos.md#testes "Programas que experimentam as aplicações sozinhos e avisam quando algo deixou de funcionar.") |
| 4 | 2026-10-16 | GPS real dos veículos, e autocarros ao longo do dia (modelo de horário) |
| 5 | 2026-10-16 | Desfazer/refazer no desenho de rotas, PINs e [sessões](conceitos.md#sessao "Depois de entrar, o servidor dá uma prova de quem se é (um token), e o navegador mostra-a a cada pedido para não ter de pedir a palavra-passe outra vez.") dos motoristas, passageiros por USSD |
| 6–9 | 2026-10-16 | Criação de administradores sem credenciais no código; portal do motorista sem dados inventados; ecrãs USSD do motorista em 182 caracteres; cada passageiro só vê os seus dados |
| 10–13 | 2026-10-17 | Correcções encontradas ao documentar; nenhum autocarro prometido depois das 21:00; as contas da [semente](conceitos.md#semente "Um conjunto pequeno de dados inventados que se carrega numa base de dados vazia para a experimentar.") entram; chave opcional do [callback](conceitos.md#callback "Um endereço que se dá a outro serviço para ele chamar sempre que algo acontece.") USSD; documentação completa |
| 14–17 | 2026-10-17 | Onde correr consultas; planeador de viagens; planear a partir de um início, como nas aplicações de transporte (A → B → C) |
| 18–21 | 2026-10-17 | Paragens e rotas importadas do OpenStreetMap, com veículos; um local por [terminal](conceitos.md#terminal "A janela onde se escrevem instruções para o computador em texto, em vez de clicar.") |
| 22–27 | 2026-10-18 | Acompanhar uma viagem inteira num só mapa; caminhadas pelas ruas; folha arrastável nos telemóveis; novo portal do motorista; embarque numa paragem escolhida |
| 28 | 2026-10-18 | Painel: barra lateral em grupos, menu no telemóvel, novo painel inicial |
| 29 | 2026-10-18 | Scripts de dados: percursos nas estradas, motoristas para os veículos importados |
| 30 | 2026-10-18 | Passageiros que escreviam espaços no telefone não conseguiam entrar |
| 31–32 | 2026-10-18 | Correcção dos testes e2e do painel; componente de mapa sem uso removido |
| 33 | 2026-10-18 | Rotas com saltos redesenhadas a partir das paragens do OSM; "Redesenhar percurso" no painel |
| 34 | 2026-10-18 | Guia da Neon |
| 35 | 2026-10-18 | `--unlink-far` para as paragens longe de uma rota |
| 36 | 2026-10-18 | Listas de rotas no USSD começam pelo código; ordinais em [GSM-7](conceitos.md#gsm-7 "O conjunto de letras que todos os telemóveis mostram nos SMS e no USSD; não tem a maior parte das letras acentuadas.") |
| 37 | 2026-10-18 | Guias passo a passo da Africa's Talking e da Vercel, como se trata um pedido USSD, glossário, esta página, navegação da documentação |
| 38 | 2026-10-18 | Painel em branco, preto e cinzento; sem emojis nem setas decorativas |
| 39 | 2026-10-18 | Menu do painel em ecrã inteiro nos telemóveis e tablets |
| 40 | 2026-10-18 | Esta página: as correcções de dados aplicadas à produção |
| 41 | 2026-10-18 | O mapa inicial dos passageiros carrega 20 KB em vez de 1 MB; um autocarro tocado carrega a sua rota |
| 42 | 2026-10-18 | Página da tarifa; o portal do motorista acompanha mudanças de veículo; pesquisa de telefones pelos algarismos; desenho de rotas com um segundo [router](conceitos.md#router "Um serviço que, dados dois ou mais pontos, responde com o caminho pelas ruas entre eles e a distância."); posição do passageiro fora dos [registos](conceitos.md#registos "As linhas de texto que um programa escreve sobre o que está a fazer, para se perceber depois o que aconteceu."); verificação de chegadas a cada 5 min no GitHub Actions; CI; fontes de dados, tarefas passo a passo e como contornar cada limitação |
| 43 | 2026-10-18 | USSD: cada tecla lida pelo ecrã a que responde, pesquisa que aceita nomes mal escritos, escrever outro nome numa lista faz nova pesquisa; documentação toda em português, como guia passo a passo em seis partes, com o porquê das escolhas, mapa do código e navegação gerada; código, comentários e mensagens em português |
| 44 | 2026-10-18 | V086 confirmada na estrada (nada a redesenhar); segredos das sessões dos passageiros e dos motoristas trocados e guardados como Secret; SQL para apagar os passageiros de teste do USSD; os passos da mudança da palavra-passe da Neon |
| 46 | 2026-10-19 | Apagado o código que não se publicava (a aplicação antiga da raiz, a rota Telerivet, cerca de 250 scripts de uso único, cópias `*.backup` e `*.old`); os passageiros de teste do USSD apagados da produção no editor da Neon |
| 47 | 2026-10-19 | Documentação para quem nunca programou: uma parte 0 com [Conceitos básicos](conceitos.md) e [Preparar o computador](preparar-o-computador.md); um resumo "Em palavras simples" no topo de cada página; cada termo técnico ligado à sua explicação, por um script verificado no CI; o que faz cada comando dos Primeiros passos; como ler e experimentar a Referência da [API](conceitos.md#api "Uma API é a lista de pedidos que um servidor aceita de outros programas; cada um desses pedidos, com o seu endereço, é um endpoint.") |
| 48 | 2026-10-27 | Só 3 rotas activas (X19, 411, X22), escolhidas no painel; a viagem do motorista decide onde está o autocarro e se está em serviço, igual no portal, na web, no USSD e no painel; "Acompanhar por SMS" no USSD, com avisos a 15, 10 e 5 min, a chegar, a bordo, [transbordos](glossario.md#palavras-dos-ecrãs "Mudança de autocarro a meio de uma viagem") e destino; a tarifa do USSD sem autocarros em viagem |
| 49 | 2026-10-27 | Apagados os 445 veículos e 445 motoristas das rotas desactivadas; o cronjob da verificação de chegadas na documentação |
| 50–51 | 2026-10-28 | [Guia do cron-job.org](guia-cron-job.md), com capturas da configuração e do histórico; o cronjob é só o relógio, a posição do autocarro escolhe o aviso |
| 52 | 2026-10-28 | Uma posição GPS nova corre a verificação de chegadas |
| 53 | 2026-10-28 | Horas de chegada pela velocidade média do GPS; o autocarro continua da última posição GPS quando o sinal falha ([Localização e GPS](localizacao-gps.md#a-velocidade-das-horas-de-chegada)) |
| 54 | 2026-10-28 | Só a publicação de produção actual corre a verificação de chegadas; apagadas as publicações de produção anteriores, que enviavam avisos errados ([Publicação → As publicações antigas](publicacao.md#as-publicações-antigas)) |
| 55 | 2026-10-28 | As paragens de cada rota nos mapas do painel: no início (as das rotas activas) e na página de um veículo (as da sua rota) ([Painel de administração](painel-admin.md#início-dashboard)) |
| 56 | 2026-10-28 | O sentido de um autocarro com GPS pelo troço do percurso onde está, e não pelo ponto do percurso mais perto: perto das esquinas parecia ir ao contrário, e os passageiros a bordo recebiam "Saia agora" cedo de mais ([Localização e GPS](localizacao-gps.md#como-se-escolhe-uma-posição)) |

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Fontes de dados](fontes-de-dados.md) · [Índice](README.md) · Seguinte: [Primeiros passos](primeiros-passos.md)
<!-- /navegação-fim -->
