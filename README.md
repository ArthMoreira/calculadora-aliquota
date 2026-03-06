# Calculadora de IPTU — Nova Iguaçu

Aplicação web para simulação e cálculo do Imposto Predial e Territorial Urbano (IPTU) do município de Nova Iguaçu, com base nas tabelas municipais de alíquotas (referência 2017).

---

## Sumário

- [Sobre o projeto](#sobre-o-projeto)
- [Contexto e motivação](#contexto-e-motivação)
- [Funcionalidades](#funcionalidades)
- [Tecnologias utilizadas](#tecnologias-utilizadas)
- [Como executar o projeto localmente](#como-executar-o-projeto-localmente)
- [Estrutura da aplicação](#estrutura-da-aplicação)
- [Deploy](#deploy)
- [Observações importantes](#observações-importantes)

---

## Sobre o projeto

A **Calculadora de IPTU** é uma aplicação web que permite calcular o valor do IPTU de imóveis localizados no município de Nova Iguaçu, aplicando a fórmula prevista no Código Tributário Municipal:

```
IPTU = VVI × Alíquota (ALC)
```

A aplicação considera os critérios definidos pelas tabelas municipais vigentes: tipo de imóvel, localização por URG (Unidade de Referência Geográfica), faixa de valor venal e situação de Zona Especial.

Esta ferramenta foi projetada com foco em usabilidade, organização visual e uso profissional, entregando o resultado de forma clara, com detalhamento completo do cálculo e fundamentação legal.

---

## Contexto e motivação

O projeto surgiu de uma necessidade prática identificada no contexto da **Prefeitura Municipal de Nova Iguaçu**: a ausência de uma ferramenta acessível e visual para simulação e consulta do cálculo do IPTU com base nas tabelas municipais.

Anteriormente, esse processo era realizado de forma manual ou por meio de planilhas, o que dificultava a consulta rápida, a apresentação dos dados e a geração de documentos organizados. A aplicação foi desenvolvida para centralizar essa operação em uma interface intuitiva, profissional e disponível diretamente no navegador.

---

## Funcionalidades

### Calculadora de IPTU

- Seleção de bairro com campo de busca dinâmica (mais de 70 bairros cadastrados)
- Seleção do tipo de imóvel: Territorial, Residencial, Comercial ou Industrial
- Suporte ao critério de Zona Especial (ZE)
- Entrada de valor venal no formato brasileiro (ex.: `104.280,08`)
- Cálculo automático da alíquota e do valor final do IPTU
- Exibição da URG correspondente ao bairro selecionado

### Resultado e detalhamento

- Exibição clara da alíquota aplicada e do valor calculado
- Detalhamento do cálculo com explicação da tabela utilizada
- Fundamentação textual com referência ao Art. 18 do Código Tributário Municipal

### Geração de PDF

- Exportação de documento institucional em formato A4 diretamente pelo navegador
- O PDF inclui: identificação do imóvel, resultado do cálculo, fundamentação e base legal

### Tabelas de referência

- **Tabela 1** — Territorial por Bairro/URG
- **Tabela 2** — Territorial em Zona Especial (ZE)
- **Tabela 3** — Predial Residencial por URG e faixa de valor venal
- **Tabela 4** — Predial Comercial/Industrial por URG e faixa de valor venal

### Interface e acessibilidade

- Tema claro e escuro com persistência via `localStorage`
- Layout responsivo (desktop, tablet e dispositivos móveis)
- Navegação por teclado e atributos ARIA para acessibilidade
- Navbar com efeito de rolagem e menu mobile

---

## Tecnologias utilizadas

| Tecnologia | Finalidade |
|---|---|
| **Vite** | Ferramenta de build e servidor de desenvolvimento |
| **JavaScript (ES Modules)** | Lógica de cálculo, manipulação de DOM e eventos |
| **HTML5** | Estrutura semântica da interface |
| **CSS3** | Design system institucional com variáveis (custom properties) |
| **html2pdf.js** | Geração de PDF no navegador a partir do DOM |
| **Vercel** | Hospedagem e deploy contínuo |

Não foram utilizados frameworks JavaScript. A aplicação é construída com tecnologias nativas do navegador, garantindo leveza, simplicidade e fácil manutenção.

---

## Como executar o projeto localmente

### Pré-requisitos

- [Node.js](https://nodejs.org/) versão 18 ou superior
- npm (incluído com o Node.js)

### Passos

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/calculadora-aliquota.git

# 2. Acesse o diretório do projeto
cd calculadora-aliquota

# 3. Instale as dependências
npm install

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

Após executar `npm run dev`, acesse a aplicação em `http://localhost:5173` (ou a porta indicada no terminal).

### Outros comandos disponíveis

```bash
# Gerar build de produção (saída na pasta dist/)
npm run build

# Visualizar a build de produção localmente
npm run preview
```

---

## Estrutura da aplicação

```
calculadora-aliquota/
├── index.html          # Página principal: interface, formulário, tabelas e base legal
├── package.json        # Dependências e scripts do projeto
├── vite.config.js      # Configuração do Vite
├── public/             # Arquivos estáticos
└── src/
    ├── iptu.js         # Lógica de cálculo, tabelas de alíquotas e fundamentação legal
    ├── main.js         # Interface: DOM, eventos, tema claro/escuro, geração de PDF
    └── style.css       # Design system: variáveis, layout responsivo, tema institucional
```

### Organização lógica

- **`iptu.js`** — Módulo de cálculo central. Contém as tabelas de alíquotas municipais, as regras de negócio por tipo de imóvel, URG e Zona Especial, e a fundamentação legal baseada no Art. 18 do CTM. Exporta as funções `CALCULAR_IPTU`, `calcularParaSite` e `getListaBairros`.

- **`main.js`** — Módulo de interface. Gerencia todos os eventos da calculadora, renderiza os resultados no DOM, controla o tema claro/escuro com persistência e realiza a geração do PDF institucional.

- **`index.html`** — Contém toda a estrutura da aplicação em uma única página: seção hero, calculadora, tabelas de referência e base legal, com navegação por âncoras e scroll suave.

---

## Deploy

A aplicação está publicada e disponível via **Vercel**:

> [https://calculadora-aliquota.vercel.app](https://calculadora-aliquota.vercel.app)

O deploy é feito a partir da branch principal do repositório, com build automático a cada atualização.

---

## Observações importantes

- Esta aplicação tem finalidade de **consulta e simulação**. Os valores obtidos são estimativas com base nas tabelas municipais de referência (2017) e podem não refletir a situação fiscal atualizada de cada imóvel.

- O **documento PDF gerado pela aplicação não substitui** o carnê, guia ou documento oficial de arrecadação emitido pela Prefeitura Municipal de Nova Iguaçu.

- A aplicação poderá ser expandida futuramente para incorporar novas tabelas de alíquotas, atualização dos valores de referência e integração com dados cadastrais do município.

---

Prefeitura Municipal de Nova Iguaçu — Secretaria Municipal da Fazenda
