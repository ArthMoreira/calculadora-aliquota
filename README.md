# 📊 Calculadora IPTU Nova Iguaçu

Calculadora de IPTU para o município de Nova Iguaçu, baseada nas tabelas de alíquotas de 2017.

## 🚀 Tecnologias

- **Vite** - Build tool rápido para desenvolvimento moderno
- **Vanilla JavaScript** - Sem frameworks, código simples e leve
- **CSS puro** - Layout responsivo sem dependências

## 📁 Estrutura do Projeto

```
iptu-nova-iguacu/
├── index.html          # Página principal com tabelas e formulário
├── package.json        # Dependências e scripts npm
├── src/
│   ├── iptu.js         # Lógica de cálculo e dados (tabelas)
│   ├── main.js         # Código de UI (DOM, eventos, renderização)
│   └── style.css       # Estilos responsivos
└── public/             # Arquivos estáticos
```

## 🔧 Instalação e Execução

### Pré-requisitos
- Node.js 18+ instalado
- npm ou yarn

### Comandos

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento (hot reload)
npm run dev

# Gerar build de produção (pasta dist/)
npm run build

# Visualizar build de produção
npm run preview
```

## 📋 Funcionalidades

### Tela 1 - Tabelas de Referência
- **Tabela 1**: Territorial por Bairro/URG
- **Tabela 2**: Territorial em Zona Especial (ZE)
- **Tabela 3**: Predial Residencial por URG e Valor Venal
- **Tabela 4**: Predial Comercial/Industrial por URG e Valor Venal

### Tela 2 - Calculadora
- Seleção de bairro (70+ bairros cadastrados)
- Tipos: Territorial, Residencial, Comercial, Industrial
- Suporte a Zona Especial (ZE)
- Valores em formato brasileiro (ex: 104.280,08)
- Resultado com detalhes do cálculo e explicação

## 🔢 API de Cálculo

O módulo `src/iptu.js` exporta três funções:

```javascript
import { CALCULAR_IPTU, calcularParaSite, getListaBairros } from './iptu.js';

// Função principal (retorna array)
CALCULAR_IPTU(bairro, tipo, valor, zonaEspecial)

// Função para uso no site (retorna objeto formatado)
calcularParaSite(bairro, tipo, valor, zonaEspecial)

// Lista de bairros cadastrados
getListaBairros()
```

## 📱 Responsividade

- **Desktop**: Grid de 2 colunas para tabelas
- **Mobile**: Grid de 1 coluna com scroll horizontal nas tabelas
- Headers das tabelas fixos (sticky) para facilitar navegação

## ⚠️ Observações

- As alíquotas são baseadas nas tabelas de 2017
- Zona Especial só se aplica quando o logradouro/trecho está cadastrado
- Para Comercial/Industrial em ZE, verificar tabela específica

---

Desenvolvido para fins educacionais - Dados de referência de 2017.
