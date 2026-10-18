# Guia da Vercel

<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->
[Documentação](README.md) › 5. Pôr online › **Guia da Vercel** (página 18 de 23)

Anterior: [Publicação](publicacao.md) · [Índice](README.md) · Seguinte: [Guia da Neon](guia-neon.md)

<details>
<summary>Todas as páginas</summary>

- 1. Conhecer o projecto: [Visão geral](visao-geral.md) · [Glossário](glossario.md) · [Fontes de dados](fontes-de-dados.md) · [Estado do projecto](estado-do-projecto.md)
- 2. Montar localmente: [Primeiros passos](primeiros-passos.md) · [Base de dados](base-de-dados.md) · [Configuração](configuracao.md)
- 3. Perceber como funciona: [Fluxos de dados](fluxos-de-dados.md) · [Localização e GPS](localizacao-gps.md) · [Serviço USSD](ussd.md) · [Segurança](seguranca.md) · [Referência da API](referencia-api.md) · [Mapa do código](mapa-do-codigo.md)
- 4. Usar as aplicações: [Aplicação dos passageiros](app-passageiros.md) · [Portal do motorista](portal-motorista.md) · [Painel de administração](painel-admin.md)
- 5. Pôr online: [Publicação](publicacao.md) · **Guia da Vercel** · [Guia da Neon](guia-neon.md) · [Africa's Talking](africas-talking.md)
- 6. Manter: [Testes](testes.md) · [Resolução de problemas](resolucao-de-problemas.md) · [Limitações](limitacoes.md)

</details>
<!-- /navegação -->

As três aplicações correm na [Vercel](https://vercel.com), na equipa `transportmozambique`. Esta página mostra as partes do painel da Vercel que o projecto usa, com capturas de 2026-10-18:

- as variáveis de ambiente, onde estão as chaves;
- as publicações (deployments), que põem uma alteração no ar ou a tiram;
- os registos (logs), que mostram cada pedido e o que o código escreveu.

Como uma alteração vai de um ramo até à produção, e como se confirma, está em [Publicação](publicacao.md). Porquê a Vercel: publica um projecto Next.js a partir do GitHub sem configuração, com uma pré-visualização por pull request e um plano gratuito.

**Nesta página:** [Criar os projectos](#criar-os-projectos) · [Os três projectos](#os-três-projectos) · [Variáveis de ambiente](#variáveis-de-ambiente) · [Publicações](#publicações) · [Registos](#registos)

---

## Criar os projectos

Para montar a plataforma noutra conta, cada aplicação é um projecto da Vercel criado assim, uma vez:

1. Em [vercel.com](https://vercel.com), entrar com a conta do GitHub e escolher a equipa (ou criar uma).
2. **Add New → Project** e importar o repositório do GitHub.
3. Em **Root Directory**, escolher a pasta da aplicação (`transport-client`, `transport-admin` ou `transport-driver`). A predefinição (Framework Preset) é detectada como Next.js; os comandos ficam os de origem.
4. Abrir **Environment Variables** e juntar as variáveis da aplicação ([Configuração](configuracao.md#variáveis-de-ambiente)). O painel precisa de `DATABASE_URL` já na compilação ([Publicação → Compilações](publicacao.md#compilações)).
5. **Deploy.** Repetir para as outras duas pastas.
6. Em **Settings → Functions**, escolher a região mais perto da base de dados (aqui `iad1`, Washington, para a Neon em `us-east-2`).

A ligação à Neon pode fazer-se pela integração da Vercel (Storage → Neon), que cria `DATABASE_URL` sozinha, ou colando o URL da Neon à mão ([Guia da Neon](guia-neon.md)).

## Os três projectos

Entrar em [vercel.com](https://vercel.com) e escolher a equipa **transportmozambique** no canto superior esquerdo. Cada aplicação é um projecto, compilado a partir da sua pasta do repositório:

| Projecto | Pasta | URL | As suas variáveis |
|---|---|---|---|
| `transport-mz` | `transport-client` | https://transport-mz.vercel.app | [passageiros, USSD, GPS](configuracao.md#transport-client-passageiros-ussd-api-do-motorista-gps) |
| `transport-mz-admin` | `transport-admin` | https://transport-mz-admin.vercel.app | [painel](configuracao.md#transport-admin-painel-de-administração) |
| `transport-mz-driver` | `transport-driver` | https://transport-mz-driver.vercel.app | [portal do motorista](configuracao.md#transport-driver-portal-do-motorista) |

Abre-se um projecto a partir da vista geral da equipa. O menu da esquerda tem as páginas abaixo.

## Variáveis de ambiente

**Projecto → Environment Variables** lista todas as variáveis, os ambientes a que se aplicam, e quando mudaram. Os valores ficam escondidos.

![Variáveis de ambiente de transport-mz](images/vercel-env-vars.png)

**Juntar uma.** Clicar em **Add Environment Variable**:

![Formulário Add Environment Variable](images/vercel-env-add.png)

1. **Tipo.**
   - **Secret:** o valor não se pode ver outra vez depois de gravado. Para palavras-passe, chaves de API, tokens e segredos de sessão.
   - **Config:** os membros do projecto podem lê-lo. Para valores que não são segredo, como `AFRICASTALKING_USERNAME`.
2. **Key** e **Value.** Os nomes que o código lê estão em [Configuração](configuracao.md).
3. **Ambientes.**
   - **Production:** o URL ao vivo.
   - **Preview:** as publicações dos ramos e dos pull requests.
   - **Development:** `vercel dev` num computador.

   As chaves que enviam SMS reais ou escrevem na produção ficam fora de Preview. Porquê: qualquer ramo, mesmo um em teste, tem uma pré-visualização.
4. **Save**, depois [publicar outra vez](#publicações). As funções em execução ficam com os valores com que arrancaram até à publicação seguinte.

**"Needs Attention".** A Vercel marca os segredos guardados como Config. `USER_SESSION_SECRET` e `DRIVER_SESSION_SECRET` de `transport-mz` estiveram marcados até 2026-10-18; foram corrigidos assim, e o mesmo serve para qualquer outro:

1. juntar cada um outra vez como **Secret**, com um valor aleatório novo (`openssl rand -base64 32`);
2. apagar o de tipo Config;
3. publicar outra vez.

Os segredos de sessão novos fazem todos os passageiros e motoristas sair da conta uma vez ([Segurança → Mudar segredos](seguranca.md#mudar-segredos)).

O mesmo pela [CLI da Vercel](https://vercel.com/docs/cli), numa pasta ligada ao projecto (`vercel link --project transport-mz`). O valor vai directo do gerador para a Vercel, sem aparecer no ecrã:

```bash
openssl rand -base64 32 | tr -d '\r\n' | vercel env add USER_SESSION_SECRET production --sensitive --force --yes
```

Porquê o `tr`: no Windows o `openssl` termina a linha com `\r\n`, e a Vercel guardaria esses caracteres no segredo. `--sensitive` é o tipo Secret; `--force` substitui o valor que existe. Repete-se para `preview`.

**Mudar `DATABASE_URL`** (depois de repor a palavra-passe da Neon, por exemplo) é igual: juntá-la outra vez como Secret em `transport-mz` e `transport-mz-admin`, apagar as linhas antigas, e publicar os dois outra vez.

## Publicações

**Projecto → Deployments** lista todas as compilações, a mais nova primeiro:

- **Preview:** um ramo ou um pull request, cada um com o seu URL;
- **Production:** a `main`, servida no URL do projecto.

Um pull request recebe as suas pré-visualizações sozinho. O merge na `main` publica Production em cerca de 30 segundos por projecto. Cada linha mostra o commit, o estado (**Ready**, **Building**, **Error**) e o tempo de compilação.

![Publicações de transport-mz, com o menu da publicação de produção mais nova aberto](images/vercel-deployments.png)

O menu **⋯** de uma publicação:

| Item | O que faz |
|---|---|
| **Redeploy** | compila outra vez o mesmo commit. Necessário depois de mudar variáveis de ambiente. |
| **Instant Rollback** | (Production) serve logo uma publicação anterior, sem compilar. Usa-se quando uma versão estraga algo; depois corrige-se e faz-se merge. |
| **Promote** | faz de uma publicação Preview a de Production. |
| **Inspect Deployment** | o registo da compilação e as funções dessa publicação. |
| **Visit** | abre o URL da publicação. |

Depois de uma publicação de produção de `transport-mz`, confirma-se que o callback USSD continua a recusar pedidos sem a chave ([Segurança → Resposta USSD](seguranca.md#resposta-ussd-callback)) e fazem-se as verificações de [Publicação → Confirmar uma publicação](publicacao.md#confirmar-uma-publicação).

## Registos

**Projecto → Logs** mostra todos os pedidos das últimas horas: hora, estado, servidor, caminho, e a primeira mensagem que o código escreveu.

- Escrever um caminho na caixa de pesquisa (`/api/ussd`, `/api/gps`, `/api/buses`) mostra só esses pedidos.
- **Contains Console Level** deixa só os pedidos que escreveram um aviso ou um erro.
- **Live** segue os pedidos novos à medida que chegam.

![Registos de transport-mz pesquisados por /api/ussd: um POST por tecla de uma sessão do simulador, e dois pedidos recusados sem a chave](images/vercel-logs-ussd.png)

Clicar numa linha abre o pedido: o tempo, a rota, e tudo o que a função escreveu. No USSD é `USSD Request` com o `text` da sessão, depois `USSD Response`:

![Os registos de um pedido USSD](images/vercel-log-request.png)

O que as aplicações escrevem nos registos, e onde procurar cada problema, está em [Resolução de problemas](resolucao-de-problemas.md).

**Os registos são sensíveis:**

- Têm números de telefone (USSD, SMS).
- Os detalhes de um pedido mostram os parâmetros do URL, que incluem a chave do callback USSD. As capturas dos detalhes de um pedido não se partilham.
- O acesso aos registos dá-se só a quem pode saber estas coisas.

<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->

---

Anterior: [Publicação](publicacao.md) · [Índice](README.md) · Seguinte: [Guia da Neon](guia-neon.md)
<!-- /navegação-fim -->
