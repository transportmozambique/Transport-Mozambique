# 🗄️ Estrutura da Base de Dados

Esta página detalha a modelagem de dados do **Sistema de Transportes de Moçambique**, explicando as entidades principais, os comandos Prisma necessários para manipulação do banco de dados e exemplos de queries.

---

## 🗺️ Navegação da Documentação
* 🏠 **[Página Principal (Home)](../README.md)**
* 🏁 **[Guia de Início Rápido](getting-started.md)**
* 🏗️ **[Arquitetura do Sistema](architecture.md)**
* 🗄️ **[Estrutura da Base de Dados (Esta Página)](database.md)**

---

## 🏗️ Configuração e Comandos Rápidos

A gestão de dados é efetuada através do **Prisma ORM**. O banco de dados padrão para desenvolvimento é o **SQLite**, facilitando o setup sem necessidade de configurar servidores de banco de dados pesados localmente.

### Comandos Essenciais (Executados dentro de `transport-admin/`):

1. **Instalar dependências do Prisma:**
   ```bash
   npm install prisma @prisma/client --legacy-peer-deps
   ```

2. **Gerar o Prisma Client (após qualquer alteração no schema):**
   ```bash
   npx prisma generate
   ```

3. **Empurrar a estrutura de tabelas para o banco de dados local (`dev.db`):**
   ```bash
   npx prisma db push
   ```

4. **Executar a sementeira (popular o banco com dados de teste/demonstração):**
   ```bash
   npx prisma db seed
   ```

5. **Abrir a interface visual de gestão de tabelas (Prisma Studio):**
   ```bash
   npx prisma studio
   ```
   *Disponível por padrão em: [http://localhost:5555](http://localhost:5555)*

---

## 📊 Modelagem das Entidades Principais

### 1. Administrador (`Administrador`)
Gerentes do sistema com capacidade de cadastrar e gerir rotas, veículos e motoristas.
* **id**: UUID String (Chave Primária)
* **nome**: String
* **email**: String (Único)
* **senha**: Hash String
* **Relações**: Cria/gere Províncias, Municípios, Vias e Paragens.

### 2. Divisão Administrativa (`Provincia`, `Cidade`, `Municipio`)
* **Provincia**: Representa as províncias do país (ex: Maputo, Gaza).
* **Cidade**: Cidades pertencentes a uma província.
* **Municipio**: Municípios específicos onde o sistema opera (ex: Município de Maputo, Município da Matola).

### 3. Rotas e Paragens (`Via`, `Paragem`, `ViaParagem`)
* **Via**: A rota em si. Contém o `geoLocationPath` (cadeia de coordenadas separadas por ponto e vírgula `;` que desenha a rota da estrada no mapa).
* **Paragem**: Pontos específicos de embarque e desembarque.
* **ViaParagem**: Tabela de junção que mapeia quais paragens pertencem a quais vias, sinalizando também se determinada paragem é um terminal (`terminalBoolean`).

### 4. Gestão de Veículos (`Proprietario`, `Transporte`, `TransporteProprietario`)
* **Proprietario**: Dono do veículo (contém dados fiscais e de contacto).
* **Transporte**: Viaturas de transporte de passageiros (Hiace, Sprinters, autocarros). Contém o campo `currGeoLocation` correspondente ao sinal de GPS mais recente.
* **TransporteProprietario**: Mapeia a posse de veículos (um veículo pode ser copropriedade de vários proprietários).

### 5. Operação (`Motorista`, `Utente`, `MISSION`, `GeoLocation`)
* **Motorista**: Registos de condutores habilitados, associados a uma viatura.
* **Utente**: Registos de passageiros que se subscreveram no serviço.
* **MISSION**: Histórico de chamadas de transporte criadas por utentes a partir de paragens.
* **GeoLocation**: Histórico de geolocalização recolhido das viaturas em tempo real para permitir animação e rastreamento contínuo.

---

## 🔗 Diagrama Simplificado de Relacionamentos

```
[Administrador] ───► Gerencia ───► [Provincia / Cidade / Municipio]
                                            │
                                            ▼
                                         [Via] ◄─── Associado a ─── [Transporte]
                                            │                            │
                                       (ViaParagem)                      ├───► [GeoLocation]
                                            │                            └───► [Motorista]
                                            ▼
                                        [Paragem] ◄─── Solicitada por ─── [MISSION] ◄─── [Utente]
```

Para detalhes adicionais de infraestrutura ou fluxos de subscrição, por favor visite a página de **[Arquitetura do Sistema](architecture.md)**.

---

## 🗺️ Navegação da Documentação
* 🏠 **[Página Principal (Home)](../README.md)**
* 🏁 **[Guia de Início Rápido](getting-started.md)**
* 🏗️ **[Arquitetura do Sistema](architecture.md)**
* 🗄️ **[Estrutura da Base de Dados (Esta Página)](database.md)**
