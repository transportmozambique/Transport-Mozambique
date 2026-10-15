# 🏁 Guia de Início Rápido (Getting Started)

Este guia orienta-o no processo de configuração, instalação e execução de todas as aplicações do **Sistema de Transportes de Moçambique**.

---

## 🗺️ Navegação da Documentação
* 🏠 **[Página Principal (Home)](../README.md)**
* 🏁 **[Guia de Início Rápido (Este Guia)](getting-started.md)**
* 🏗️ **[Arquitetura do Sistema](architecture.md)**
* 🗄️ **[Estrutura da Base de Dados](database.md)**

---

## 📋 Pré-requisitos

Certifique-se de que tem instalado na sua máquina:
* [Node.js](https://nodejs.org/) (Versão 18 ou superior recomendada)
* [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
* Git (opcional, para controle de versão)

---

## 📦 Passos de Instalação e Inicialização

O projeto está estruturado como um monorrepósito simples contendo três aplicações principais. Pode iniciar todas as aplicações de uma vez ou manualmente.

### Método 1: Iniciar Tudo Automatizado (Apenas Windows)

Na raiz do projeto, disponibilizamos um script `.bat` para iniciar todas as aplicações concorrentemente em terminais separados:

```bash
# Execute o script na raiz do projeto
./start-all.bat
```

### Método 2: Iniciar Manualmente

Abra três terminais diferentes para executar cada aplicação:

#### 1. Painel Administrativo (`transport-admin`)
Gerencia rotas, províncias, municípios, paragens, veículos, motoristas e proprietários. Runs on port `3001`.

```bash
cd transport-admin
npm install
npm run dev
```

#### 2. Portal do Utente / Passageiro (`transport-client`)
Usado pelos passageiros para pesquisar e rastrear transportes em tempo real. Runs on port `3000`.

```bash
cd transport-client
npm install
npm run dev
```

#### 3. Portal do Motorista (`transport-driver`)
Usado pelos motoristas para iniciar viagens e transmitir localização GPS em tempo real. Runs on port `3002`.

```bash
cd transport-driver
npm install
npm run dev
```

---

## 🔐 Contas e Credenciais de Teste

Para facilitar os testes locais, a base de dados vem populada com os seguintes utilizadores de demonstração:

### Perfil do Administrador
* **URL de Acesso**: [http://localhost:3001](http://localhost:3001)
* **E-mail**: `admin@transportmz.com`
* **Senha**: `admin123`

### Perfil do Motorista
* **URL de Acesso**: [http://localhost:3002](http://localhost:3002)
* **BI (Identificação)**: `110203456789A`
* **Senha**: `123456`

### Perfil do Utente (Passageiro)
* **URL de Acesso**: [http://localhost:3000](http://localhost:3000)
* **Acesso**: Não necessita de credenciais, basta efetuar a subscrição usando um número de telemóvel na interface.

---

## ⚙️ Variáveis de Ambiente

Cada aplicação tem o seu próprio ficheiro `.env` para configurações locais. Certifique-se de que os ficheiros `.env` estão configurados corretamente nas subpastas das aplicações se pretender ligar a serviços de terceiros (como bases de dados externas ou APIs de SMS).

Para mais detalhes sobre as variáveis e como o banco de dados se comporta, veja a **[Documentação da Base de Dados](database.md)**.

---

## 🗺️ Navegação da Documentação
* 🏠 **[Página Principal (Home)](../README.md)**
* 🏁 **[Guia de Início Rápido (Este Guia)](getting-started.md)**
* 🏗️ **[Arquitetura do Sistema](architecture.md)**
* 🗄️ **[Estrutura da Base de Dados](database.md)**
