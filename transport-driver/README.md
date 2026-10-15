# 🚐 TransportMZ Driver - Portal do Motorista

Aplicação web para motoristas de transporte público gerenciarem suas viagens em tempo real.

## 🎯 Funcionalidades

### ✅ Implementadas

- **Login de Motorista**
  - Autenticação com BI e senha
  - Sessão persistente com localStorage

- **Dashboard do Motorista**
  - Informações do motorista e veículo
  - Status online/offline
  - Controle de viagem (iniciar/finalizar)
  - Localização GPS em tempo real
  - Contador de passageiros
  - Velocidade atual
  - Atividade recente

- **Ver Rota** (`/route`)
  - Mapa interativo com Leaflet
  - Visualização completa da rota
  - Todas as paragens marcadas
  - Posição atual do transporte
  - Horários estimados

- **Estatísticas** (`/stats`)
  - Filtros por período (hoje, semana, mês)
  - Viagens realizadas
  - Passageiros transportados
  - Distância percorrida
  - Horas de serviço
  - Receita estimada
  - Desempenho (ocupação, pontualidade, satisfação)
  - Horários de pico
  - Histórico de viagens

- **Reportar** (`/report`)
  - Relatórios rápidos (acidente, avaria, trânsito)
  - Formulário detalhado
  - Níveis de prioridade
  - Contactos de emergência

- **Suporte** (`/support`)
  - Formulário de contacto
  - FAQ (Perguntas Frequentes)
  - Múltiplos canais de contacto
  - Horário de atendimento
  - Emergências

### 🚧 A Implementar

- **Rastreamento GPS**
  - Atualização automática de localização
  - Envio de coordenadas para o servidor
  - Histórico de trajeto

- **Gestão de Viagens**
  - Iniciar/terminar viagem
  - Registar paragens
  - Tempo estimado de chegada

- **Comunicação**
  - Chat com central
  - Notificações push
  - Alertas de emergência

- **Relatórios**
  - Viagens realizadas
  - Passageiros transportados
  - Receitas diárias

## 🚀 Como Iniciar

### 1. Instalar Dependências

```bash
cd transport-driver
npm install
```

### 2. Iniciar Servidor de Desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3002`

### 3. Fazer Login

Use as credenciais de demonstração:
- **BI**: `110203456789A`
- **Senha**: `123456`

## 📱 Estrutura da Aplicação

```
transport-driver/
├── app/
│   ├── page.tsx              # Página de login
│   ├── dashboard/
│   │   └── page.tsx          # Dashboard do motorista
│   ├── layout.tsx            # Layout principal
│   └── globals.css           # Estilos globais
├── public/                   # Arquivos estáticos
└── README.md                 # Este arquivo
```

## 🎨 Design

- **Framework**: Next.js 15 + TypeScript
- **Estilização**: Tailwind CSS
- **Ícones**: Emojis nativos
- **Tema**: Azul profissional

## 🔐 Autenticação

Atualmente usa autenticação simulada com localStorage. Em produção, deve ser integrado com:
- JWT tokens
- Refresh tokens
- API de autenticação segura

## 📊 Dados do Motorista

```typescript
interface Motorista {
  id: string;
  nome: string;
  bi: string;
  transporte: {
    id: string;
    matricula: string;
    modelo: string;
    marca: string;
  };
  via: {
    id: string;
    nome: string;
    codigo: string;
  };
}
```

## 🗺️ Integração GPS

A aplicação usa a API de Geolocalização do navegador:

```typescript
navigator.geolocation.getCurrentPosition(
  (position) => {
    // Obter coordenadas
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
  }
);
```

## 🔄 Próximas Funcionalidades

### Fase 1 - Rastreamento
- [ ] Atualização automática de GPS a cada 10 segundos
- [ ] Envio de localização para API
- [ ] Indicador de conexão

### Fase 2 - Viagens
- [ ] Botão iniciar viagem
- [ ] Seleção de rota
- [ ] Registar paragens
- [ ] Finalizar viagem

### Fase 3 - Passageiros
- [ ] Scanner QR Code
- [ ] Validação de bilhetes
- [ ] Contador automático

### Fase 4 - Comunicação
- [ ] Chat com central
- [ ] Notificações push
- [ ] Botão de emergência

### Fase 5 - Relatórios
- [ ] Dashboard de estatísticas
- [ ] Histórico de viagens
- [ ] Relatórios mensais

## 🛠️ Tecnologias

- **Next.js 15** - Framework React
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização
- **Geolocation API** - GPS
- **LocalStorage** - Persistência local

## 📞 Suporte

Para questões técnicas:
1. Verifique a documentação
2. Consulte o código de exemplo
3. Entre em contato com o suporte técnico

## 🔒 Segurança

### Boas Práticas

- Nunca armazenar senhas em texto plano
- Usar HTTPS em produção
- Validar todos os inputs
- Implementar rate limiting
- Usar tokens JWT com expiração

### Permissões Necessárias

- **Localização**: Para rastreamento GPS
- **Notificações**: Para alertas
- **Câmera**: Para scanner QR (futuro)

## 📱 Compatibilidade

- ✅ Chrome/Edge (recomendado)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers

## 🚀 Deploy

### Vercel (Recomendado)

```bash
npm install -g vercel
vercel
```

### Outras Plataformas

- Netlify
- Railway
- Render
- AWS Amplify

## 📝 Notas de Desenvolvimento

### Dados de Teste

```javascript
// Motorista 1
BI: 110203456789A
Senha: 123456
Transporte: AAA-1234-MP (Toyota Hiace)
Rota: Zimpeto - Baixa

// Motorista 2
BI: 110204567890B
Senha: 123456
Transporte: BBB-5678-MP (Mercedes Sprinter)
Rota: Zimpeto - Baixa
```

### Estrutura de Dados

A aplicação espera receber dados no formato:

```json
{
  "motorista": {
    "id": "1",
    "nome": "João Manuel Silva",
    "bi": "110203456789A",
    "transporte": {
      "id": "1",
      "matricula": "AAA-1234-MP",
      "modelo": "Hiace",
      "marca": "Toyota"
    },
    "via": {
      "id": "1",
      "nome": "Zimpeto - Baixa",
      "codigo": "VIA-001"
    }
  }
}
```

## 🎯 Roadmap

- **Q2 2026**: Rastreamento GPS em tempo real
- **Q3 2026**: Sistema de viagens completo
- **Q4 2026**: Integração com pagamentos
- **Q1 2027**: App mobile nativo

## 📄 Licença

Este projeto faz parte do Sistema de Transportes de Moçambique.

---

**Última atualização**: 28 de Abril de 2026
