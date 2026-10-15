# 🚀 Sistema de Transportes de Moçambique

Bem-vindo ao repositório do **Sistema de Transportes de Moçambique**, uma plataforma completa de gestão, planeamento e rastreamento de transportes públicos urbanos (chapas, autocarros e frotas privadas) em tempo real.

---

## 🗺️ Navegação da Documentação
* 🏠 **[Página Principal (Home)](README.md)**
* 🏁 **[Guia de Início Rápido](docs/getting-started.md)**
* 🏗️ **[Arquitetura do Sistema](docs/architecture.md)**
* 🗄️ **[Estrutura da Base de Dados](docs/database.md)**

---

## 📋 Sobre o Projeto

Este projeto foi desenhado para modernizar a experiência de transporte público em Moçambique, fornecendo ferramentas digitais tanto para passageiros como para motoristas e reguladores.

### Componentes Principais:
1. 🔧 **[Transport-Admin (Painel Administrativo)](transport-admin/README.md)**: Aplicação web para gestores do sistema visualizarem dashboards, monitorizarem frotas e cadastrarem rotas, paragens, municípios e viaturas.
2. 📱 **[Transport-Client (Aplicação do Passageiro)](transport-client/README.md)**: Aplicação móvel/web para passageiros subscreverem ao serviço, pesquisarem autocarros e acompanharem o tempo estimado de chegada (ETA) no mapa em tempo real.
3. 🚐 **[Transport-Driver (Portal do Motorista)](transport-driver/README.md)**: Portal móvel otimizado para os condutores transmitirem as suas coordenadas de GPS, gerirem o estado da viatura (Online/Offline) e o fluxo de passageiros.

---

## 📦 Estrutura do Repositório

```
Transports-Aplication/
├── docs/                     # Documentação Geral do Sistema
│   ├── getting-started.md    # Instruções de setup e credenciais
│   ├── architecture.md       # Diagrama de blocos e fluxos do sistema
│   └── database.md           # Modelos do Prisma e comandos do SQLite/Postgres
├── transport-admin/          # Next.js App - Administração (Porta 3001)
├── transport-client/         # Next.js App - Passageiro (Porta 3000)
├── transport-driver/         # Next.js App - Motorista (Porta 3002)
├── start-all.bat            # Script para iniciar as 3 apps em simultâneo
└── package.json             # Ficheiro de configuração raiz
```

---

## 🚀 Como Executar

Para começar rapidamente com o projeto, siga as etapas descritas no **[Guia de Início Rápido](docs/getting-started.md)**. O comando padrão para iniciar todos os módulos locais ao mesmo tempo é:

```bash
# Executa as 3 aplicações em simultâneo (Windows)
start-all.bat
```

---

## 🗄️ Base de Dados e Modelação

A aplicação usa o Prisma ORM ligado a uma base de dados local SQLite em desenvolvimento. Para instruções detalhadas de como redefinir, migrar ou semear dados de demonstração, consulte a página da **[Estrutura da Base de Dados](docs/database.md)**.

---

## 🎨 Arquitetura do Sistema e Tecnologias

Para compreender como as aplicações Next.js partilham o mesmo backend de dados e comunicam o tráfego GPS dos veículos em tempo real para o mapa do passageiro, consulte a **[Arquitetura do Sistema](docs/architecture.md)**.

---

## 🤝 Como Contribuir

1. Faça um Fork do projeto
2. Crie uma Branch para a sua funcionalidade (`git checkout -b feature/minha-funcionalidade`)
3. Efetue o Commit das suas alterações (`git commit -m 'Adiciona funcionalidade X'`)
4. Faça o Push para a branch (`git push origin feature/minha-funcionalidade`)
5. Abra um Pull Request

---

## 📄 Licença

Sistema de Transportes de Moçambique © 2026. Desenvolvido para modernizar e melhorar a mobilidade urbana nacional.
