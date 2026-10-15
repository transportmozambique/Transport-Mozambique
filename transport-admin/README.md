# Sistema de Gestão de Transportes Públicos

Plataforma de administração para o sistema de localização de transportes públicos em tempo real em Moçambique.

## Tecnologias

- **Next.js 15** - Framework React
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização

## Estrutura do Projeto

```
transport-admin/
├── app/
│   ├── components/          # Componentes reutilizáveis
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── dashboard/           # Dashboard principal
│   ├── proprietarios/       # Gestão de proprietários
│   ├── transportes/         # Gestão de transportes
│   ├── provincias/          # Gestão de províncias
│   ├── municipios/          # Gestão de municípios
│   ├── vias/                # Gestão de vias
│   ├── paragens/            # Gestão de paragens
│   └── relatorios/          # Relatórios do sistema
```

## Funcionalidades Implementadas (UI)

- ✅ Dashboard com estatísticas
- ✅ Gestão de Proprietários
- ✅ Gestão de Transportes
- ✅ Gestão de Províncias
- ✅ Gestão de Municípios
- ✅ Gestão de Vias
- ✅ Gestão de Paragens
- ✅ Página de Relatórios

## Como Executar

```bash
# Instalar dependências
npm install

# Executar em modo de desenvolvimento
npm run dev

# Build para produção
npm run build

# Executar produção
npm start
```

Acesse: http://localhost:3000

## Próximos Passos

- [ ] Integração com API backend
- [ ] Formulários de criação/edição
- [ ] Autenticação de usuários
- [ ] Integração com mapas
- [ ] Funcionalidade de pesquisa
- [ ] Paginação de tabelas
- [ ] Validação de formulários
- [ ] Gestão de estado global
