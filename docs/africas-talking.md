# Africa's Talking

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 5. Pôr online › **Africa's Talking** (página 20 de 23)

Anterior: [Guia da Neon](guia-neon.md) · [Índice](README.md) · Seguinte: [Testes](testes.md)

<details>
<summary>Todas as páginas</summary>

- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · **Africa's Talking**
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

A [Africa's Talking](https://africastalking.com) (AT) é o gateway entre as redes de telemóvel e a plataforma. Leva duas coisas:

- **USSD:** um telemóvel marca o código do serviço, e a AT passa cada tecla para `POST /api/ussd` da aplicação dos passageiros ([Serviço USSD](ussd.md)).
- **SMS:** a aplicação dos passageiros envia os resultados do USSD, os alertas de chegada e as confirmações de viagem dos motoristas pela API de SMS da AT.

Porquê a Africa's Talking: um só fornecedor para USSD e SMS em vários países africanos, com um ambiente de testes (sandbox) gratuito e um simulador de telemóvel no navegador, o que deixa construir e testar tudo antes de pagar um código.

A plataforma corre hoje no **sandbox**. O USSD e os SMS do sandbox só chegam ao simulador da AT, não a telemóveis reais. Esta página mostra:

- como a conta foi configurada, passo a passo;
- como usar o menu USSD no simulador, ecrã a ecrã;
- como um pedido chega ao código;
- onde ler os registos;
- o que é preciso para passar a produção.

**Nesta página:** [Configuração actual](#configuração-actual) · [Como foi configurado, passo a passo](#como-foi-configurado-passo-a-passo) · [Usar o menu no simulador](#usar-o-menu-no-simulador) · [Como um pedido é tratado](#como-um-pedido-é-tratado) · [SMS](#sms) · [Registos e sessões](#registos-e-sessões) · [Passar a produção](#passar-a-produção)

---

## Configuração actual

| Item | Valor |
|---|---|
| Conta da AT | a conta `transportmozambique` |
| Aplicação | Sandbox, nome de utilizador `sandbox` |
| Código USSD | `*384*848080#` (o canal `848080` no código partilhado do sandbox `*384#`) |
| URL do callback | `https://transport-mz.vercel.app/api/ussd?key=<USSD_CALLBACK_KEY>`. Os pedidos sem a chave recebem 403 (desde 2026-10-17). |
| Projecto `transport-mz` da Vercel | `AFRICASTALKING_USERNAME=sandbox`, `AFRICASTALKING_API_KEY` (chave do sandbox), `USSD_CALLBACK_KEY` (Secret, Production) |
| Remetente dos SMS (`AFRICASTALKING_SHORTCODE`) | não definido: os SMS saem do remetente da AT por omissão (`AFRICASTKNG` no simulador) |
| Verificado | menus USSD e SMS de ponta a ponta no simulador, 2026-10-18 |
| Ao vivo (telemóveis reais em Moçambique) | não configurado ([Passar a produção](#passar-a-produção)) |

## Como foi configurado, passo a passo

A ordem conta: a chave da API e a chave do callback vão para a Vercel antes de o canal apontar para a aplicação, para o primeiro pedido já as encontrar.

```mermaid
flowchart LR
  A["1. Entrar na AT"] --> B["2. Abrir a aplicação<br/>sandbox"] --> C["3. Gerar a<br/>chave da API"] --> D["4. Pôr as chaves<br/>na Vercel"] --> E["5. Criar o<br/>canal USSD"] --> F["6. Publicar<br/>outra vez"] --> G["7. Testar"]
```

### 1. Entrar

Ir a [account.africastalking.com](https://account.africastalking.com) e entrar, ou **Register** para criar uma conta.

<img src="images/at-login.png" alt="Página de entrada da Africa's Talking" width="560">

### 2. Abrir a aplicação sandbox

A página inicial oferece **Go To Sandbox App** para testes gratuitos, e **Teams** para as aplicações de produção. Cada aplicação tem o seu nome de utilizador e a sua chave da API. O nome de utilizador do sandbox é `sandbox`.

<img src="images/at-home.png" alt="Página inicial da Africa's Talking: Go To Sandbox App, e Teams para as aplicações de produção" width="720">

<img src="images/at-sandbox-dashboard.png" alt="Painel da aplicação sandbox: App Name Sandbox, Username sandbox" width="720">

### 3. Gerar a chave da API

Na aplicação sandbox: **Settings → API Key**.

1. Escrever a palavra-passe da conta e clicar em **Request**.
2. A AT envia um link para o email da conta. Abri-lo gera a chave.

Depois:

- A chave aparece uma só vez: copia-se directamente para a Vercel (passo seguinte), e não para um ficheiro ou uma conversa.
- Gerar uma chave nova invalida a anterior.
- Uma chave nova pode demorar alguns minutos até a API a aceitar. Até lá a AT responde "The supplied authentication is invalid".

### 4. Pôr as chaves na Vercel

Abrir o projecto **transport-mz** da Vercel → **Settings → Environment Variables** ([Guia da Vercel](guia-vercel.md#variáveis-de-ambiente)):

![Variáveis de ambiente de transport-mz: USSD_CALLBACK_KEY (Secret), os segredos de sessão, AFRICASTALKING_USERNAME](images/vercel-env-vars.png)

Clicar em **Add Environment Variable** e juntar, para **Production**:

| Key | Tipo | Valor |
|---|---|---|
| `AFRICASTALKING_USERNAME` | Config | `sandbox` (o nome de utilizador da aplicação) |
| `AFRICASTALKING_API_KEY` | **Secret** | a chave do passo 3 |
| `USSD_CALLBACK_KEY` | **Secret** | um valor aleatório longo, por exemplo o resultado de `openssl rand -hex 32` |

![Add Environment Variable: Secret ou Config, chave, valor, ambientes](images/vercel-env-add.png)

Um **Secret** não se pode ler outra vez depois de gravado, nem pelos membros do projecto. Guarda-se uma cópia de `USSD_CALLBACK_KEY` até o passo 5 a usar, e depois apaga-se a cópia. Porquê a chave do callback: ver [Segurança → Resposta USSD](seguranca.md#resposta-ussd-callback).

### 5. Criar o canal USSD

De volta à aplicação sandbox da AT: **USSD → Create Channel**.

- Escolher o código partilhado `*384#` e um número de canal livre (aqui `848080`).
- Escrever o URL do callback com a chave:

  ```text
  https://transport-mz.vercel.app/api/ussd?key=<USSD_CALLBACK_KEY>
  ```

<img src="images/at-ussd-create-channel.png" alt="Formulário Create USSD Channel: código partilhado, canal, URL do callback" width="720">

**USSD → Service Codes** lista então o canal e o seu callback. A captura abaixo foi feita antes de juntar a chave; hoje o URL acaba em `?key=…`.

<img src="images/at-ussd-service-codes.png" alt="USSD Service Codes: *384*848080# com o URL do callback" width="720">

A AT oferece dois tipos de código:

- códigos **dedicados**, como `*144#`, atribuídos pelo regulador ou pelo operador;
- códigos **partilhados**, como `*384*848080#`: um número de canal no código da AT. O sandbox só aceita estes.

O URL de uma pré-visualização também serve de callback, para testar um ramo antes do merge. Depois volta-se a pôr o URL de produção.

### 6. Publicar outra vez

As funções da Vercel lêem as variáveis de ambiente quando são publicadas. Em **transport-mz → Deployments**, abrir o menu (**⋯**) da publicação de produção mais nova e clicar em **Redeploy** ([Guia da Vercel → Publicações](guia-vercel.md#publicações)).

### 7. Testar

- No [simulador](#usar-o-menu-no-simulador), aparece o menu principal.
- Sem a chave, o endpoint recusa:

  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://transport-mz.vercel.app/api/ussd \
    -d "sessionId=g&serviceCode=*384*848080%23&phoneNumber=%2B258840000009&text="
  # 403
  ```

Para mudar a chave mais tarde, mudam-se a variável e o URL do callback juntos, e publica-se outra vez ([Segurança → Mudar segredos](seguranca.md#mudar-segredos)).

## Usar o menu no simulador

O simulador não precisa de conta. Os ecrãs abaixo são respostas reais.

1. Abrir o [simulador](https://developers.africastalking.com/simulator). Escolher Moçambique (+258) na bandeira se ainda não estiver escolhido, escrever um número de teste (aqui `84 000 0001`) e carregar em **Connect**.
2. No ecrã inicial do telemóvel, o **telefone** (à esquerda) marca; as **mensagens** (ao meio) guardam os SMS.
3. Marcar `*384*848080#` no teclado e carregar no botão verde.

<img src="images/at-sim-connect.png" alt="Simulador: o campo do número de telefone, +258 84 000 0001, e Connect" width="200"> <img src="images/at-sim-home.png" alt="Ecrã inicial do simulador: aplicações do telefone e das mensagens" width="200"> <img src="images/at-sim-dial.png" alt="Teclado do simulador com *384*848080#" width="200">

4. Aparece o menu principal. Escrever o número da opção no campo em baixo (aqui `2`, Procurar rotas) e carregar em **SEND**.

<img src="images/at-sim-menu.png" alt="Menu principal: 1 Encontrar transporte a 7 Ajuda" width="200"> <img src="images/at-sim-answer.png" alt="A resposta 2 escrita por baixo do menu principal" width="200">

5. A opção 2 pede um local ou o número de uma rota. Escrever `museu` e **SEND**: aparecem as rotas que passam no Museu, 4 por página, cada uma começada pelo código (o número no autocarro). `7` mostra a página seguinte, `8` a anterior, `0` volta atrás.
6. Escrever `1` escolhe a primeira rota. O ecrã final (`END`) fecha a sessão: carregar em **OK**.
7. Abrir as **mensagens**: o mesmo resultado chega por SMS de `AFRICASTKNG`.

Os ecrãs desta sessão, como o telemóvel os mostra (os mesmos de [Serviço USSD → 2 Procurar rotas](ussd.md#2-procurar-rotas)):

```text
text="2"                                  text="2*museu"                          text="2*museu*1"
CON Rotas de um local                     CON Rotas em Museu:                     END 3-0 Museu - Praca dos Trabalhadores
Escreva o nome do local ou o numero       1. 3-0 Museu - Praca dos Trabalha..     (Via Av. 24 de Julho)
da rota (ex: Baixa ou X12)                2. 18-0 Museu - Magoanine (Via Av..     De: Museu
0. Voltar                                 3. 21-0 Museu - Albazine(via Dom ..     Para: Praca dos Trabalhadores
                                          4. 23-0 Museu - Matendene (Via Ja..     Paragens: 15
                                          7. Proximo                              Distancia: 3.4 km
                                          0. Voltar                               Tarifa (percurso todo): 35 MT
                                                                                  Autocarros: 2
```

Quando o nome escrito coincide com vários locais (por exemplo `baixa`: o Terminal de Chapas da Baixa e várias ruas da Baixa), aparece primeiro "Qual local?" para escolher um.

![SMS recebidos no simulador (de uma versão anterior dos menus, com o mesmo remetente)](images/at-sim-sms.png)

**"This session has expired".** O simulador acaba uma sessão quando uma resposta demora demasiado. Marcar outra vez e responder mais depressa.

<img src="images/at-sim-expired.png" alt="Simulador: This session has expired" width="200">

Notas:

- **O número é um passageiro real na produção.** O número do telemóvel simulado é o que a aplicação recebe como `phoneNumber`. As opções 2 a 5 e 7 só lêem. O ecrã de viagem da opção 1 cria um passageiro sem palavra-passe para esse número e um alerta de chegada na base de dados de **produção**. Usa-se um número de teste como `+25884000000x`; [Base de dados → Passageiros criados por USSD](base-de-dados.md#passageiros-criados-por-ussd-ainda-sem-palavra-passe) mostra como encontrar ou apagar o que criou.
- **O menu do motorista.** Para testar a opção 6, liga-se com o número de telefone de um motorista e usa-se o PIN que o painel gerou para ele ([Painel → Dar um PIN a um motorista](painel-admin.md#tarefa-pin)).
- **Todas as opções.** Todos os menus, com os seus ecrãs, estão em [Serviço USSD → Árvore dos menus](ussd.md#árvore-dos-menus).

## Como um pedido é tratado

Em cada resposta, a AT envia um `POST` em formulário para o URL do callback com `sessionId`, `serviceCode`, `phoneNumber`, `networkCode` e `text`. `text` tem todas as respostas até agora, juntas com `*`. A aplicação responde `text/plain` a começar por `CON` (mostrar e esperar resposta) ou `END` (mostrar e fechar).

O servidor não guarda sessão. Repete `text` a partir do menu principal em cada pedido, por isso qualquer instância responde a qualquer tecla. Os passos no código são:

1. confirmar a chave;
2. repetir `text`, lendo cada tecla como o ecrã a que respondeu a pede;
3. as leituras da base de dados da opção;
4. o ecrã cortado a 182 caracteres GSM-7;
5. o SMS, depois da resposta.

Cada passo está em [Serviço USSD → O caminho de um pedido](ussd.md#o-caminho-de-um-pedido) e [Dentro do handler](ussd.md#dentro-do-handler).

## SMS

[`transport-client/lib/notifications.ts`](../transport-client/lib/notifications.ts) envia todos os SMS com o SDK `africastalking`:

- **Destinatário.** O telefone passa primeiro a `+258…` (`"84 123 4567"`, `"0841234567"` e `"258841234567"` dão todos `+258841234567`).
- **Remetente.** `from` é `AFRICASTALKING_SHORTCODE` quando está definido, senão o da AT por omissão.
- **Sem chave.** Sem `AFRICASTALKING_API_KEY`, nada se envia e o registo diz `SMS não enviado para … AFRICASTALKING_API_KEY não configurada`. Porquê: uma instalação local ou uma pré-visualização funciona sem enviar SMS reais.
- **Uma falha nunca pára um fluxo.** Um envio falhado fica registado (`Erro ao enviar SMS para …`) e o ecrã USSD ou a verificação de chegadas continua.

O que se envia:

| Quando | Mensagem | Onde |
|---|---|---|
| Opções 1 a 6 do USSD, no ecrã final | o conteúdo do ecrã (na opção 1, só quando se pede) | depois da resposta, com `waitUntil` ([Serviço USSD](ussd.md)) |
| Alerta de chegada | "Autocarro {matrícula} está a {n} minutos da {paragem}!" | a verificação de chegadas ([Fluxos de dados](fluxos-de-dados.md#alerta-de-chegada-e-sms)) |
| Um motorista inicia ou termina uma viagem pelo USSD | "Viagem iniciada com sucesso! Veiculo: … Bons trabalhos!" / "Viagem encerrada com sucesso. …" | opção 6 do USSD |

**No sandbox**, as mensagens só chegam aos telemóveis abertos no simulador. A API de mensagens do sandbox às vezes é lenta e pode responder "The server was not able to produce a timely response" sem nada estar errado do lado da plataforma. O envio fica então registado como erro e não se repete, e a mensagem pode chegar na mesma.

## Registos e sessões

**Do lado da AT:** USSD → **Sessions** lista cada sessão com o número de passos, a duração e o estado. "Incomplete" quer dizer que o telemóvel saiu da sessão antes de um ecrã `END`, ou que o callback não respondeu a tempo.

<img src="images/at-ussd-sessions.png" alt="Registo USSD Sessions: data, código, número de telefone, passos, duração, estado" width="720">

**Do lado da plataforma:** na Vercel, **transport-mz → Logs**, pesquisar `/api/ussd` ([Guia da Vercel → Registos](guia-vercel.md#registos)). Aparecem:

- um `POST` por tecla, com o seu `USSD Response`;
- os pedidos recusados por falta da chave (403, "USSD pedido recusado");
- os resultados dos SMS;
- clicar numa linha mostra o `USSD Request` que registou.

![Registos da Vercel filtrados por /api/ussd: um POST por tecla, dois 403 de pedidos sem a chave](images/vercel-logs-ussd.png)

Os detalhes de um pedido na Vercel também mostram os parâmetros do URL, por isso a chave do callback fica visível a quem puder ler os registos do projecto. O acesso aos registos dá-se só a quem pode saber a chave, e não se fazem capturas dos detalhes de um pedido.

## Passar a produção

O código não precisa de mudar para ir ao vivo; a conta e a configuração sim. Por ordem:

1. **Cobertura.** Confirmar com a AT que o USSD e os SMS estão disponíveis nas redes moçambicanas pretendidas (Vodacom, Movitel, Tmcel), e com que tipo de código. Isto não estava confirmado quando esta página foi escrita.
2. **Aplicação de produção.** Na página inicial da AT, criar uma **Team**, e uma aplicação dentro dela. Apontar o nome de utilizador e gerar a chave da API.
3. **Código USSD.** Pedir um código USSD para essa aplicação (um código dedicado do regulador ou do operador, ou um canal num código partilhado). Pôr o URL do callback em `https://transport-mz.vercel.app/api/ussd?key=<USSD_CALLBACK_KEY>`.
4. **Remetente (opcional).** Pedir um remetente alfanumérico ou um código curto para os SMS, e pôr `AFRICASTALKING_SHORTCODE` com ele.
5. **Crédito.** Carregar a carteira da aplicação: as sessões USSD e os SMS ao vivo são pagos.
6. **Vercel.** Em `transport-mz`, pôr `AFRICASTALKING_USERNAME` com o nome de utilizador da aplicação e `AFRICASTALKING_API_KEY` com a sua chave, só em **Production** (as pré-visualizações ficam sem chave, para nunca enviarem SMS reais). Publicar outra vez ([Publicação](publicacao.md)).
7. **Testar** com um telemóvel real em cada rede: o menu principal, uma opção de cada tipo, um SMS de chegada e uma viagem de motorista.
8. **Limpar.** Revogar as chaves da API de contas que já não se usam ([Segurança → Mudar segredos](seguranca.md#mudar-segredos)).

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Guia da Neon](guia-neon.md) · [Índice](README.md) · Seguinte: [Testes](testes.md)
<!-- /navegação-fim -->
