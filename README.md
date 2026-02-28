# Calculadora IPTU — Nova Iguaçu

Calculadora de alíquota e valor do IPTU para o município de Nova Iguaçu, baseada nas tabelas de alíquotas municipais (referência 2017).

## Tecnologias

- **Vite** — Build tool para desenvolvimento moderno
- **Vanilla JavaScript** — Sem frameworks, código leve e direto
- **CSS puro** — Layout responsivo com design system baseado em variáveis (custom properties)
- **html2pdf.js** — Geração de PDF com resultado do cálculo

## Estrutura do Projeto

```
calculadora-aliquota/
├── index.html          # Página principal (formulário, tabelas, base legal)
├── package.json        # Dependências e scripts npm
├── vite.config.js      # Configuração do Vite
├── src/
│   ├── iptu.js         # Lógica de cálculo, tabelas e fundamentação
│   ├── main.js         # Interface (DOM, eventos, tema, PDF)
│   └── style.css       # Design system institucional (temas dark/light)
└── public/             # Arquivos estáticos
```

## Instalação e Execução

### Pré-requisitos
- Node.js 18+
- npm

### Comandos

```bash
# Instalar dependências
npm install

# Modo desenvolvimento (hot reload)
npm run dev

# Build de produção (pasta dist/)
npm run build

# Visualizar build de produção
npm run preview
```

## Funcionalidades

### Calculadora
- Seleção de bairro com combobox e filtro (70+ bairros cadastrados)
- Tipos: Territorial, Residencial, Comercial, Industrial
- Suporte a Zona Especial (ZE)
- Valores em formato brasileiro (ex.: 104.280,08)
- Resultado com detalhes do cálculo, fundamentação e badge de status

### Geração de PDF
- Documento institucional com identificação, resultado, fundamentação e base legal
- Formato A4 com layout da Prefeitura Municipal

### Tabelas de Referência
- **Tabela 1**: Territorial por Bairro / URG
- **Tabela 2**: Territorial em Zona Especial (ZE)
- **Tabela 3**: Predial Residencial por URG e Valor Venal
- **Tabela 4**: Predial Comercial / Industrial por URG e Valor Venal

### Outros
- Tema escuro e claro com persistência (localStorage)
- Responsivo (desktop, tablet, mobile)
- Acessibilidade (ARIA, teclado, foco visível)
- Base legal com referência ao Art. 18 do CTM

## API de Cálculo (iptu.js)

```javascript
import { CALCULAR_IPTU, calcularParaSite, getListaBairros } from './iptu.js';

// Função principal — retorna [taxa, explicação]
CALCULAR_IPTU(bairro, tipo, valor, zonaEspecial);

// Para uso no site — retorna objeto formatado com alíquota, IPTU, URG, fundamentação
calcularParaSite(bairro, tipo, valor, zonaEspecial);

// Lista de bairros cadastrados
getListaBairros();
```

## Observações

- As alíquotas seguem as tabelas municipais de referência (2017)
- Zona Especial aplica-se apenas quando o logradouro/trecho está cadastrado
- O documento PDF gerado não substitui guia oficial de arrecadação

---

Prefeitura Municipal de Nova Iguaçu — Secretaria Municipal da Fazenda
