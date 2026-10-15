# 🏗️ Arquitetura do Sistema

Esta página detalha a infraestrutura do **Sistema de Transportes de Moçambique**, incluindo o fluxo de dados entre os componentes e as tecnologias utilizadas.

---

## 🗺️ Navegação da Documentação
* 🏠 **[Página Principal (Home)](../README.md)**
* 🏁 **[Guia de Início Rápido](getting-started.md)**
* 🏗️ **[Arquitetura do Sistema (Esta Página)](architecture.md)**
* 🗄️ **[Estrutura da Base de Dados](database.md)**

---

## 🧱 Componentes do Sistema

O sistema é constituído por três módulos principais que comunicam através de APIs e partilham a mesma base de dados centralizada:

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA DE TRANSPORTES                    │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
        ┌───────▼──────┐ ┌───▼────┐ ┌─────▼──────┐
        │   ADMIN      │ │ CLIENT │ │   DRIVER   │
        │   (3001)     │ │ (3000) │ │   (3002)   │
        └──────────────┘ └────────┘ └────────────┘
                │             │             │
                └─────────────┼─────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   DATABASE        │
                    │   (Prisma/SQLite) │
                    └───────────────────┘
```

### 1. Painel de Administração (`transport-admin`)
* **Framework**: Next.js 15
* **Objetivo**: Fornecer aos gestores do sistema uma interface completa para cadastrar e gerenciar todas as rotas (vias), paragens, viaturas, motoristas e visualizar relatórios consolidados de uso.

### 2. Portal do Utente/Passageiro (`transport-client`)
* **Framework**: Next.js 15
* **Objetivo**: Permitir que os passageiros subscrevam ao serviço, procurem por viaturas disponíveis por via/paragem, visualizem os veículos a mover-se no mapa interativo em tempo real e recebam notificações de proximidade.

### 3. Portal do Motorista (`transport-driver`)
* **Framework**: Next.js 15
* **Objetivo**: Permitir que os motoristas façam login com o seu número de BI, fiquem online para transmitir a sua localização GPS atual e controlem o contador de passageiros no veículo.

---

## 🔄 Fluxos de Utilização

### 1. Subscrição do Utente (Caso de Uso 1)
1. O utente acede a `/subscribe` no `transport-client`.
2. O utente preenche o número de telemóvel e aceita os termos do serviço.
3. O sistema cria um registo na tabela `Utente` e gera um identificador único de missão.
4. O utente passa a estar elegível para pedir e rastrear rotas.

### 2. Pesquisa e Rastreamento (Caso de Uso 2)
1. O utente seleciona o município, a via pretendida e a paragem onde se encontra.
2. O sistema faz uma query na base de dados para encontrar as viaturas associadas a essa via que se encontram em trânsito.
3. O sistema calcula a distância e o tempo estimado de chegada (ETA) usando as coordenadas do veículo (tabela `GeoLocation`) e a paragem do utente.
4. O utilizador visualiza a posição do veículo no mapa do Leaflet.

### 3. Transmissão do Motorista
1. O motorista inicia sessão no `transport-driver`.
2. Ao ativar o estado "Online", a aplicação recolhe as coordenadas de geolocalização do dispositivo (via Geolocation API do navegador).
3. O motorista pode também atualizar manualmente o número de passageiros livres e ocupados.
4. Os dados de localização são persistidos na tabela `GeoLocation` a cada atualização de intervalo de tempo, alimentando diretamente o mapa do passageiro.

---

## 🛠️ Tecnologias Utilizadas

* **Linguagem**: TypeScript / JavaScript (ES6+)
* **Framework Web**: Next.js 15 com App Router
* **Estilização**: Tailwind CSS
* **Mapas**: Leaflet API com OpenStreetMap
* **Base de Dados ORM**: Prisma ORM
* **Base de Dados Física**: SQLite (Desenvolvimento) / PostgreSQL (Produção)

Para mais detalhes sobre as tabelas e modelos de dados, consulte a **[Estrutura da Base de Dados](database.md)**.

---

## 🗺️ Navegação da Documentação
* 🏠 **[Página Principal (Home)](../README.md)**
* 🏁 **[Guia de Início Rápido](getting-started.md)**
* 🏗️ **[Arquitetura do Sistema (Esta Página)](architecture.md)**
* 🗄️ **[Estrutura da Base de Dados](database.md)**
