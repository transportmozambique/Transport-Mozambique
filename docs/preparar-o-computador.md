# Preparar o computador

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 0. Começar do zero › **Preparar o computador** (página 2 de 25)

Anterior: [Conceitos básicos](conceitos.md) · [Índice](README.md) · Seguinte: [Visão geral](visao-geral.md)

<details>
<summary>Todas as páginas</summary>

- 0. Começar do zero: [Conceitos básicos](conceitos.md) · **Preparar o computador**
- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · [Guia da Vercel](guia-vercel.md) · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

Esta página prepara um computador para correr a plataforma: as contas, os programas a instalar, como abrir um [terminal](conceitos.md#terminal) e como ler os comandos desta documentação. Não supõe nenhum conhecimento técnico. Faz-se uma vez, e leva cerca de uma hora (a maior parte à espera de descargas). Depois segue-se para [Primeiros passos](primeiros-passos.md).

Os passos estão escritos para o **Windows 10 ou 11**, com notas para o macOS e o Linux onde são diferentes.

> **Só para ver a plataforma?** Nada desta página é preciso: está ao vivo em [README → Aplicações ao vivo](../README.md#aplicações-ao-vivo), e o menu [USSD](conceitos.md#ussd "Os menus que aparecem num telemóvel quando se marca um código como *384*848080#; funcionam em qualquer telemóvel, sem internet.") experimenta-se no [simulador](africas-talking.md#usar-o-menu-no-simulador).

**Nesta página:** [O que vai ser preciso](#o-que-vai-ser-preciso) · [As contas](#as-contas) · [Instalar o Git](#instalar-o-git) · [O terminal](#o-terminal) · [Instalar o Node.js](#instalar-o-nodejs) · [Instalar um editor de texto](#instalar-um-editor-de-texto) · [Uma base de dados local](#uma-base-de-dados-local) · [Descarregar o código](#descarregar-o-código) · [Confirmar que está tudo pronto](#confirmar-que-está-tudo-pronto) · [Quando algo corre mal](#quando-algo-corre-mal)

---

## O que vai ser preciso

| O quê | Para quê | Obrigatório? |
|---|---|---|
| Um computador com Windows 10/11, macOS ou Linux, 8 GB de memória e 5 GB livres | Correr as três aplicações ao mesmo tempo | sim |
| Ligação à [internet](conceitos.md#internet "A rede que liga milhões de computadores e telemóveis, por onde passam os pedidos e as respostas.") | Descarregar os programas, o código e os mapas | sim |
| [Git](conceitos.md#git) | Descarregar o código e guardar alterações; no Windows traz também o terminal Git Bash | sim |
| [Node.js](conceitos.md#nodejs) (traz o [npm](conceitos.md#npm)) | Correr as aplicações | sim |
| Um editor de texto (Visual Studio Code) | Criar e mudar os ficheiros de configuração | sim |
| Uma [base de dados](conceitos.md#base-de-dados) [PostgreSQL](conceitos.md#postgresql) local, instalada ou pelo [Docker](conceitos.md#docker) | Guardar os dados de teste | sim |
| Uma conta no [GitHub](conceitos.md#github) | Propor alterações ao código; não é precisa só para o correr | não |

Porquê estes programas: são os que o projecto usa ([Visão geral → Tecnologias e porquê](visao-geral.md#tecnologias-e-porquê)), são gratuitos, e funcionam nos três sistemas.

## As contas

Para correr a plataforma no próprio computador **não é precisa nenhuma conta**: o código é público.

As contas só são precisas para pôr uma cópia da plataforma online, e criam-se quando se chega lá:

| Conta | Para quê | Onde se explica |
|---|---|---|
| GitHub | Guardar o código e propor alterações | abaixo |
| [Vercel](conceitos.md#vercel "A empresa cujos servidores correm as três aplicações e as publicam a cada merge.") | Os [servidores](conceitos.md#servidor "Um computador sempre ligado que recebe pedidos e responde a eles.") das aplicações | [Guia da Vercel → Criar os projectos](guia-vercel.md#criar-os-projectos) |
| [Neon](conceitos.md#neon "A empresa que guarda a base de dados PostgreSQL da produção, na internet.") | A base de dados online | [Guia da Neon → Criar o projecto](guia-neon.md#0-criar-o-projecto) |
| [Africa's Talking](conceitos.md#africas-talking "O gateway de USSD e SMS usado por este projecto.") | O USSD e os [SMS](conceitos.md#sms "As mensagens de texto curtas dos telemóveis.") | [Africa's Talking → Como foi configurado](africas-talking.md#como-foi-configurado-passo-a-passo) |

**Criar uma conta no GitHub** (opcional por agora):

1. Abrir https://github.com/signup no [navegador](conceitos.md#navegador "O programa com que se abrem sites: Chrome, Firefox, Edge, Safari.").
2. Escrever um email, escolher uma palavra-passe e um nome de utilizador, e seguir os passos.
3. Confirmar o email com o código que o GitHub envia.

Porquê o GitHub: é onde este repositório está, e a Vercel publica directamente a partir dele.

## Instalar o Git

**Windows:**

1. Abrir https://git-scm.com/downloads/win e carregar no primeiro link de descarga ("Click here to download").
2. Abrir o ficheiro descarregado (`Git-…-64-bit.exe`). O Windows pode perguntar "Quer permitir que esta aplicação faça alterações?": responder **Sim**.
3. Carregar em **Next** em todos os ecrãs, sem mudar nada, e no fim em **Install** e **Finish**. As opções já escolhidas servem.

O instalador junta dois programas: o próprio Git, e o **Git Bash**, um terminal onde os comandos desta documentação funcionam tal como estão escritos.

**macOS:** abrir o Terminal (ver [abaixo](#abrir-um-terminal)) e escrever `git --version`. Se o Git não estiver instalado, o macOS oferece-se para instalar as "ferramentas de linha de comandos": aceitar.

**Linux (Ubuntu, Debian):** no terminal, `sudo apt install git`.

**Confirmar:** abrir um terminal novo e escrever `git --version`. Deve aparecer algo como `git version 2.47.1`.

## O terminal

O [terminal](conceitos.md#terminal) é a janela onde se escrevem comandos. Quase todos os passos de instalação e de arranque desta documentação são comandos.

### Abrir um terminal

| Sistema | Como |
|---|---|
| Windows | Menu Iniciar → escrever **Git Bash** → abrir. Ou, numa pasta do Explorador de Ficheiros, botão direito → "Open Git Bash here" (no Windows 11, primeiro "Mostrar mais opções"), que abre o terminal já dentro dessa pasta. |
| macOS | Cmd+Espaço → escrever **Terminal** → Enter. |
| Linux | Ctrl+Alt+T. |

Porquê o Git Bash e não o PowerShell no Windows: os comandos desta documentação estão escritos para o "bash", o terminal do macOS e do Linux, e o Git Bash é um bash para o Windows. No PowerShell, alguns comandos têm outro nome ou outras regras (por exemplo, lá [`curl`](conceitos.md#curl "Um comando que faz pedidos HTTP a partir do terminal, como um navegador sem janela.") é outro programa).

Aparece uma janela com uma linha que acaba em `$`: é o terminal à espera de um comando.

### Como ler os comandos desta documentação

Os comandos aparecem em caixas como esta:

```bash
cd transport-client
npm install          # descarrega as dependências
```

- **Cada linha é um comando.** Escreve-se (ou copia-se e cola-se) uma linha, carrega-se em **Enter**, e espera-se que acabe (o `$` volta a aparecer) antes da seguinte.
- **O que vem depois de `#` é um comentário**, uma nota para quem lê. Pode copiar-se junto: o terminal ignora-o.
- **`<assim>` é para substituir.** `<código do dispositivo>` quer dizer "escrever aqui o código", sem os sinais `<` e `>`.
- **`…` também é para substituir** por um valor que a página explica.
- **Uma linha que acaba em `\` continua na seguinte**: copiam-se as linhas todas juntas e carrega-se em Enter uma vez.
- **`&&` junta dois comandos**: o segundo só corre se o primeiro correr bem.
- **Colar no terminal:** no Git Bash, Shift+Insert ou botão direito → Paste; no macOS, Cmd+V; no Linux, Ctrl+Shift+V. (Ctrl+V sozinho não cola em todos os terminais.)
- **Parar um programa que está a correr** (por exemplo uma aplicação): Ctrl+C.
- **O texto que o comando escreve depois** é a resposta. As páginas mostram muitas vezes a resposta esperada num comentário (`# {"ok":true}`) para se comparar.

### Andar entre pastas

O terminal está sempre dentro de uma pasta, a **pasta actual**. Os comandos de que se precisa:

| Comando | Faz | Exemplo |
|---|---|---|
| `pwd` | mostra em que pasta se está | `/c/Users/ana/projectos` |
| `ls` | lista o que há na pasta | `transport-client  transport-admin  docs …` |
| `cd <pasta>` | entra numa pasta | `cd transport-client` |
| `cd ..` | volta à pasta de cima | |
| `cd ~` | vai para a pasta pessoal | |

Quando uma página diz "em `transport-client`", quer dizer: estar dentro dessa pasta do projecto (com `cd`) antes de correr o comando. Se um comando responde "No such file or directory" ou "not found", a causa mais comum é estar na pasta errada: `pwd` mostra onde se está.

## Instalar o Node.js

O [Node.js](conceitos.md#nodejs) corre as aplicações. Traz o `npm`, que instala as dependências de cada uma.

**Windows e macOS:**

1. Abrir https://nodejs.org e carregar no botão da versão **LTS** (Long Term Support: a versão recomendada, com correcções durante anos).
2. Abrir o ficheiro descarregado (`.msi` no Windows, `.pkg` no macOS) e carregar em **Next** / **Continuar** em todos os ecrãs, sem mudar nada. No Windows, se aparecer a opção "Automatically install the necessary tools", pode ficar desmarcada.
3. **Fechar todos os terminais abertos e abrir um novo.** Porquê: um terminal só fica a conhecer os programas instalados depois de ele próprio abrir.

**Linux:** seguir https://nodejs.org/en/download (escolher o sistema e "LTS"), que mostra os comandos para cada distribuição.

**Confirmar:**

```bash
node --version    # v22.… ou mais recente (o projecto foi verificado com o 22; a Vercel usa o 24)
npm --version     # 10.… ou mais recente
```

## Instalar um editor de texto

Um editor de texto serve para criar os ficheiros [`.env`](conceitos.md#variavel-de-ambiente) e ler o código. O Bloco de Notas do Windows serve, mas o **Visual Studio Code** (gratuito) mostra a pasta inteira, dá cores ao código, e tem um terminal incorporado.

1. Abrir https://code.visualstudio.com, descarregar e instalar com as opções por omissão.
2. Para abrir o projecto, depois de o [descarregar](#descarregar-o-código): **File → Open Folder…** e escolher a pasta `Transport-Mozambique`.
3. Para criar um ficheiro dentro de uma pasta: na barra da esquerda, botão direito na pasta → **New File…** → escrever o nome (por exemplo `.env`) → Enter. Escrever o conteúdo e guardar com Ctrl+S (Cmd+S no macOS).

Porquê um ficheiro que começa por ponto (`.env`): é a convenção para ficheiros de configuração. O Explorador de Ficheiros do Windows e o Finder do macOS podem escondê-los; o VS Code mostra-os sempre.

## Uma base de dados local

As aplicações precisam de uma [base de dados](conceitos.md#base-de-dados) [PostgreSQL](conceitos.md#postgresql). Para experimentar usa-se uma no próprio computador, e nunca a da produção. Porquê: os [dados de demonstração](conceitos.md#semente "Um conjunto pequeno de dados inventados que se carrega numa base de dados vazia para a experimentar.") apagam tudo antes de carregar ([Primeiros passos → 6](primeiros-passos.md#6-carregar-os-dados-de-demonstração)).

Há duas formas. Escolhe-se **uma**.

### Opção A: com o Docker (mais simples de apagar depois)

1. Instalar o **Docker Desktop**: https://www.docker.com/products/docker-desktop → descarregar para o sistema → instalar com as opções por omissão. No Windows pode pedir para reiniciar o computador e para instalar o "WSL" (o subsistema Linux do Windows, de que o Docker precisa): aceitar.
2. Abrir o Docker Desktop e esperar que diga que está a correr ("Engine running"). Fica a correr em fundo; tem de estar aberto sempre que se usa a base de dados.
3. Confirmar num terminal: `docker --version` → `Docker version 27.…` ou mais recente.

A base de dados em si arranca-se com um comando em [Primeiros passos → 2](primeiros-passos.md#2-arrancar-uma-base-de-dados).

### Opção B: instalar o PostgreSQL

1. Abrir https://www.postgresql.org/download, escolher o sistema, e descarregar o instalador (no Windows, "Download the installer", da EDB).
2. Instalar com as opções por omissão. O instalador pede:
   - uma **palavra-passe** para o utilizador `postgres`: escolher uma e **apontá-la**, faz falta a seguir;
   - a **porta**: deixar `5432`.
   No fim, pode desmarcar-se o "Stack Builder".
3. Criar uma base de dados vazia para o projecto:
   - **Windows:** Menu Iniciar → **[SQL](conceitos.md#sql "A linguagem com que se fazem perguntas e alterações a uma base de dados.") Shell (psql)** → carregar em Enter nas quatro primeiras perguntas (aceita os valores entre parênteses rectos) → escrever a palavra-passe do passo 2 (não aparece enquanto se escreve) → escrever `CREATE DATABASE transport_dev;` e Enter. A resposta é `CREATE DATABASE`.
   - **macOS e Linux:** num terminal, `createdb -U postgres transport_dev`.

### O endereço da base de dados

As aplicações encontram a base de dados por um endereço com este formato (vai para o ficheiro `.env`, em [Primeiros passos → 3](primeiros-passos.md#3-ficheiros-de-ambiente-env)):

```text
postgresql://postgres:postgres123@localhost:5433/transport_db
             └──┬───┘ └────┬────┘ └───┬───┘ └┬─┘ └────┬─────┘
                │          │          │      │        └ o nome da base de dados
                │          │          │      └ a porta
                │          │          └ a máquina (localhost = este computador)
                │          └ a palavra-passe
                └ o utilizador
```

| Opção | Endereço |
|---|---|
| A, Docker | `postgresql://postgres:postgres123@localhost:5433/transport_db` (os valores estão no [`docker-compose.yml`](../docker-compose.yml)) |
| B, PostgreSQL instalado | `postgresql://postgres:<a palavra-passe do passo 2>@localhost:5432/transport_dev` |

## Descarregar o código

[Clonar](conceitos.md#clonar) o [repositório](conceitos.md#repositorio) cria uma pasta `Transport-Mozambique` com o código, dentro da pasta onde o terminal está.

1. Abrir um terminal na pasta onde se quer o projecto. Por exemplo, para os Documentos:

   ```bash
   cd ~/Documents
   ```

2. Descarregar:

   ```bash
   git clone https://github.com/transportmozambique/Transport-Mozambique.git
   ```

   Aparecem algumas linhas de progresso ("Receiving objects: 100%"). Leva menos de um minuto.

3. Entrar na pasta:

   ```bash
   cd Transport-Mozambique
   ls      # deve mostrar: docs  prisma  transport-admin  transport-client  transport-driver  README.md …
   ```

Todos os comandos das páginas seguintes partem desta pasta.

## Confirmar que está tudo pronto

Num terminal novo, dentro da pasta `Transport-Mozambique`:

| Comando | Resposta esperada |
|---|---|
| `git --version` | `git version 2.…` |
| `node --version` | `v22.…` ou mais recente |
| `npm --version` | `10.…` ou mais recente |
| `docker --version` (opção A) | `Docker version …`, com o Docker Desktop aberto |
| `ls` | `docs`, `prisma`, `transport-admin`, `transport-client`, `transport-driver` |

Com tudo isto, a página seguinte, [Primeiros passos](primeiros-passos.md), arranca as três aplicações com dados de demonstração.

## Quando algo corre mal

| O que aparece | Porquê | O que fazer |
|---|---|---|
| `command not found` ou "não é reconhecido como comando" | O programa não está instalado, ou o terminal foi aberto antes da instalação | Fechar o terminal e abrir um novo; se continuar, instalar outra vez |
| `No such file or directory` | O terminal está noutra pasta | `pwd` para ver onde está, `cd` para a pasta certa |
| `Cannot connect to the Docker daemon` | O Docker Desktop não está aberto | Abrir o Docker Desktop e esperar por "Engine running" |
| `password authentication failed` | A palavra-passe no endereço da base de dados não é a do PostgreSQL | Corrigir o endereço no `.env` |
| `EADDRINUSE` ou "port is already in use" | Outra aplicação já usa essa porta | Fechar o outro terminal onde a aplicação corre (Ctrl+C) |
| Um comando parece parado | Pode estar a descarregar, ou é uma aplicação que fica a correr de propósito | Esperar; uma aplicação que diz "Ready" está a correr e deixa-se assim |

Mais problemas, com as aplicações já a correr: [Resolução de problemas](resolucao-de-problemas.md).

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Conceitos básicos](conceitos.md) · [Índice](README.md) · Seguinte: [Visão geral](visao-geral.md)
<!-- /navegação-fim -->
