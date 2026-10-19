# transport-driver: portal do motorista

Publicado como `transport-mz-driver` em https://transport-mz-driver.vercel.app. Uma [aplicação web](../docs/conceitos.md#aplicacao-web "Um site que se usa como um programa: tem botões, mapas e contas, e muda conforme o que se faz.") para o telemóvel do motorista: entrar com o número de telefone e o PIN que o administrador gerou, iniciar e terminar viagens, partilhar o [GPS](../docs/conceitos.md#gps "O sistema de satélites com que um telemóvel ou um aparelho sabe as suas coordenadas.") do telemóvel como a posição do veículo, e ver quantos passageiros esperam nas paragens da rota.

O portal não tem [API](../docs/conceitos.md#api "Uma API é a lista de pedidos que um servidor aceita de outros programas; cada um desses pedidos, com o seu endereço, é um endpoint.") nem [base de dados](../docs/conceitos.md#base-de-dados "O sítio organizado onde a plataforma guarda tudo o que tem de durar: rotas, paragens, veículos, contas.") próprias: todos os pedidos vão para a aplicação dos passageiros (`/api/driver/*`, `/api/gps`), cujo endereço é `NEXT_PUBLIC_API_URL` (`lib/api.ts`). Porquê: o menu [USSD](../docs/conceitos.md#ussd "Os menus que aparecem num telemóvel quando se marca um código como *384*848080#; funcionam em qualquer telemóvel, sem internet.") do motorista (opção 6) e o portal mudam o mesmo estado de viagem, sem o copiar.

Como se usa, passo a passo: [docs/portal-motorista.md](../docs/portal-motorista.md).

## Correr

```bash
npm install
npm run dev          # http://localhost:3001
```

`NEXT_PUBLIC_API_URL` aponta para a aplicação dos passageiros (localmente `http://localhost:3000`) e lê-se na compilação, por isso uma mudança precisa de compilar outra vez ([docs/configuracao.md](../docs/configuracao.md#transport-driver-portal-do-motorista)).

## Onde está cada coisa

| Ficheiro | O que tem |
|---|---|
| `app/page.tsx` | a entrada com telefone e PIN |
| `app/dashboard/page.tsx` | o mapa da rota, iniciar e terminar a viagem, os passageiros à espera, a partilha do GPS |
| `app/components/Sheet.tsx` | o painel arrastável, como na aplicação dos passageiros |
| `lib/api.ts` | o endereço da API e o [token](../docs/conceitos.md#sessao "Depois de entrar, o servidor dá uma prova de quem se é (um token), e o navegador mostra-a a cada pedido para não ter de pedir a palavra-passe outra vez.") da sessão |
