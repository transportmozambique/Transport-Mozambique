# Transportes Moçambique - Cliente

Aplicação cliente para utentes pesquisarem e acompanharem transportes públicos em tempo real.

## Funcionalidades

### 1. Pesquisa de Transportes
- Seleção de município
- Seleção de via
- Seleção de direção (Terminal A → B ou B → A)
- Seleção de paragem
- Listagem de transportes disponíveis

### 2. Visualização de Transportes Disponíveis
- Lista de transportes em circulação
- Distância até a paragem
- Tempo estimado de chegada
- Velocidade atual
- Status do transporte

### 3. Rastreamento em Tempo Real
- Acompanhamento da localização do transporte
- Atualização automática a cada 5 segundos
- Visualização de:
  - Tempo estimado de chegada
  - Distância atual
  - Velocidade
  - Coordenadas GPS
- Alertas quando o transporte está próximo
- Notificação quando o transporte chega

## Fluxo do Utilizador

1. **Página Inicial**: Utente seleciona município, via, direção e paragem
2. **Página de Pesquisa**: Mostra lista de transportes disponíveis com informações
3. **Página de Rastreamento**: Acompanha transporte específico em tempo real até chegar

## Tecnologias

- Next.js 15
- TypeScript
- Tailwind CSS
- React Hooks (useState, useEffect)

## Como Executar

```bash
cd transport-client
npm install
npm run dev
```

Acesse: http://localhost:3000

## Próximos Passos

- [ ] Integração com API real
- [ ] Integração com Google Maps / Mapbox
- [ ] Notificações push quando transporte está próximo
- [ ] Histórico de pesquisas
- [ ] Favoritos de rotas
- [ ] Estimativa de preço
- [ ] Partilha de localização
- [ ] Modo offline
- [ ] PWA (Progressive Web App)
