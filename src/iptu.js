/**
 * Calcula IPTU Nova Iguaçu (Versão Consolidada)
 * Migrado do Google Apps Script para rodar no navegador.
 *
 * Assinaturas mantidas:
 * - CALCULAR_IPTU(bairro, tipo, valor, zonaEspecial)
 * - calcularParaSite(bairro, tipo, valor, zonaEspecial)
 * - getListaBairros()
 */

// ===============================
// BASE LEGAL
// ===============================
export const BASE_LEGAL_IPTU = {
  titulo: "Base legal (CTM Nova Iguaçu)",
  texto: "Conforme o Art. 18 do Código Tributário Municipal, o IPTU é apurado pela aplicação da alíquota correspondente (ALC) sobre o valor venal do imóvel (VVI), seguindo a fórmula: IPTU = VVI × ALC. As alíquotas aplicáveis constam das tabelas municipais vigentes (ref. 2017), variando conforme a localização/URG, uso do imóvel e faixas de valor venal.",
  referencia: "Art. 18 — Código Tributário Municipal (Nova Iguaçu)"
};

// ===============================
// FUNÇÃO PRINCIPAL
// ===============================
export function CALCULAR_IPTU(bairro, tipo, valor, zonaEspecial) {
  if (!bairro) return [["Selecione Bairro", ""]];

  var nomeBairro = normalizarTexto(bairro);
  var tipoImovel = normalizarTexto(tipo);
  var ze = isZonaEspecialSim(zonaEspecial);

  var dados = obterDadosDoBairro(nomeBairro);
  if (!dados) return [["Bairro não cadastrado", "Verifique a lista"]];

  var vigencia = " (Ref. Tabelas 2017)";

  // -----------------------------
  // LÓGICA TERRITORIAL (Tabela 1 e 2)
  // -----------------------------
  if (tipoImovel === "TERRITORIAL") {
    var taxa = dados.taxaTerritorial;
    var explicacao =
      "Tabela 1 (Territorial por bairro/URG): " +
      (taxa * 100).toFixed(1).replace(".", ",") +
      "% aplicada ao bairro" +
      vigencia +
      ".";

    if (ze) {
      var taxaZE = obterTaxaZonaEspecialTerritorial(nomeBairro);

      if (taxaZE !== null) {
        taxa = taxaZE;
        explicacao =
          "Tabela 2 (Territorial em Zona Especial): " +
          (taxa * 100).toFixed(1).replace(".", ",") +
          "% aplicada ao bairro/trecho cadastrado como ZE" +
          vigencia +
          ".";
      } else {
        explicacao =
          "Zona Especial marcada como SIM, porém este bairro não consta na lista de ZE cadastrada (Tabela 2). " +
          "Verifique se o imóvel está em logradouro/trecho de ZE. Mantida Tabela 1" +
          vigencia +
          ".";
      }
    }

    return [[taxa, explicacao]];
  }

  // -----------------------------
  // LÓGICA PREDIAL (Tabela 3 e 4)
  // -----------------------------
  var valorNum = parseValorBR(valor);
  if (isNaN(valorNum) || valorNum < 0) {
    return [[0, "Valor venal inválido. Informe um número válido (ex: 104.280,08)."]];
  }

  var tabela = [];
  var nomeGrupo = dados.nomeURG;

  if (tipoImovel === "RESIDENCIAL") {
    tabela = obterTabelaPredialResidencial(nomeGrupo);
    if (!tabela || tabela.length === 0) {
      return [[0, "URG sem tabela configurada para RESIDENCIAL: " + dados.nomeURG + "."]];
    }
  } else if (tipoImovel === "COMERCIAL" || tipoImovel === "INDUSTRIAL") {
    tabela = obterTabelaPredialComercialIndustrial(nomeGrupo);
    if (!tabela || tabela.length === 0) {
      return [[0, "URG sem tabela configurada para COMERCIAL/INDUSTRIAL: " + dados.nomeURG + "."]];
    }
  } else {
    return [["Tipo Inválido", "Use: TERRITORIAL / RESIDENCIAL / COMERCIAL / INDUSTRIAL"]];
  }

  for (var i = 0; i < tabela.length; i++) {
    if (valorNum <= tabela[i].limite) {
      var taxaAtual = tabela[i].taxa;
      var texto = "Faixa " + (i + 1) + " (" + nomeGrupo + ")" + vigencia + ". ";

      if (i > 0) {
        var limiteAnterior = tabela[i - 1].limite;
        texto +=
          "Imóvel acima de R$ " +
          limiteAnterior.toLocaleString("pt-BR") +
          " entra nesta alíquota superior.";
      } else {
        texto += "Imóvel na faixa de valor inicial (Alíquota mínima).";
      }

      if ((tipoImovel === "COMERCIAL" || tipoImovel === "INDUSTRIAL") && ze) {
        texto += " Atenção: para Comercial/Industrial, Zona Especial pode depender de logradouro/trecho (Tabela 4).";
      }

      return [[taxaAtual, texto]];
    }
  }

  return [[0, "Erro inesperado ao enquadrar o valor venal."]];
}

// ===============================
// ZONA ESPECIAL (TABELA 2) - TERRITORIAL
// ===============================
function obterTaxaZonaEspecialTerritorial(bairroNorm) {
  var ze20 = ["CENTRO", "CALIFORNIA", "RANCHO NOVO", "VILA NOVA", "MOQUETA", "JARDIM TROPICAL", "PRATA"];
  var ze18 = [
    "JARDIM IGUACU",
    "POSSE", "CERAMICA", "KENNEDY/CAIOABA",
    "COMENDADOR SOARES", "ROSA DOS VENTOS",
    "RIACHAO", "CACUIA", "RODILANDIA", "INCONFIDENCIA"
  ];

  if (ze20.indexOf(bairroNorm) > -1) return 0.02;
  if (ze18.indexOf(bairroNorm) > -1) return 0.018;

  return null;
}

function isZonaEspecialSim(zonaEspecial) {
  if (zonaEspecial === null || zonaEspecial === undefined) return false;
  var z = normalizarTexto(zonaEspecial);
  return z === "SIM" || z === "S";
}

// ===============================
// TABELAS PREDIAIS (TABELA 3 e 4)
// ===============================
function obterTabelaPredialResidencial(nomeURG) {
  if (nomeURG === "CENTRO") {
    return [
      { limite: 25000, taxa: 0.009 },
      { limite: 50000, taxa: 0.01 },
      { limite: 100000, taxa: 0.011 },
      { limite: Infinity, taxa: 0.012 },
    ];
  }

  if (nomeURG === "POSSE" || nomeURG === "COMENDADOR SOARES") {
    return [
      { limite: 25000, taxa: 0.0085 },
      { limite: 50000, taxa: 0.0095 },
      { limite: 100000, taxa: 0.01 },
      { limite: Infinity, taxa: 0.011 },
    ];
  }

  if (["AUSTIN", "CABUCU", "KM 32", "VILA DE CAVA", "MIGUEL COUTO"].indexOf(nomeURG) > -1) {
    return [
      { limite: 25000, taxa: 0.008 },
      { limite: 50000, taxa: 0.009 },
      { limite: 100000, taxa: 0.0095 },
      { limite: Infinity, taxa: 0.01 },
    ];
  }

  if (nomeURG === "TINGUA") {
    return [
      { limite: 25000, taxa: 0.0075 },
      { limite: 50000, taxa: 0.0085 },
      { limite: 100000, taxa: 0.009 },
      { limite: Infinity, taxa: 0.01 },
    ];
  }

  return [];
}

function obterTabelaPredialComercialIndustrial(nomeURG) {
  if (nomeURG === "CENTRO") {
    return [
      { limite: 30000, taxa: 0.01 },
      { limite: 60000, taxa: 0.0105 },
      { limite: 100000, taxa: 0.011 },
      { limite: Infinity, taxa: 0.015 },
    ];
  }

  if (nomeURG === "POSSE" || nomeURG === "COMENDADOR SOARES") {
    return [
      { limite: 30000, taxa: 0.0095 },
      { limite: 60000, taxa: 0.01 },
      { limite: 100000, taxa: 0.0105 },
      { limite: Infinity, taxa: 0.0145 },
    ];
  }

  if (["AUSTIN", "CABUCU", "KM 32", "VILA DE CAVA", "MIGUEL COUTO"].indexOf(nomeURG) > -1) {
    return [
      { limite: 30000, taxa: 0.009 },
      { limite: 60000, taxa: 0.0095 },
      { limite: 100000, taxa: 0.01 },
      { limite: Infinity, taxa: 0.014 },
    ];
  }

  if (nomeURG === "TINGUA") {
    return [
      { limite: 30000, taxa: 0.0085 },
      { limite: 60000, taxa: 0.009 },
      { limite: 100000, taxa: 0.0095 },
      { limite: Infinity, taxa: 0.0135 },
    ];
  }

  return [];
}

// ===============================
// BANCO DE DADOS (Tabela 1 - Territorial por bairro)
// ===============================
function obterDadosDoBairro(nomeBairroNorm) {
  function inList(arr, alvoNorm) {
    for (var i = 0; i < arr.length; i++) {
      if (normalizarTexto(arr[i]) === alvoNorm) return true;
    }
    return false;
  }

  var b_centro_20 = ["CENTRO", "KAONZE", "CAONZE", "CALIFORNIA", "DA LUZ", "RANCHO NOVO", "VILA NOVA", "JUSCELINO", "CHACRINHA"];
  if (inList(b_centro_20, nomeBairroNorm)) return { nomeURG: "CENTRO", taxaTerritorial: 0.02 };

  var b_centro_15 = ["SANTA EUGENIA", "MOQUETA", "JARDIM TROPICAL", "PRATA", "JARDIM IGUACU"];
  if (inList(b_centro_15, nomeBairroNorm)) return { nomeURG: "CENTRO", taxaTerritorial: 0.015 };

  var b_centro_12 = ["ENGENHO PEQUENO", "VILA OPERARIA", "VIGA"];
  if (inList(b_centro_12, nomeBairroNorm)) return { nomeURG: "CENTRO", taxaTerritorial: 0.012 };

  var b_posse = ["POSSE", "PONTO CHIC", "CERAMICA", "TRES CORACOES", "KENNEDY/CAIOABA", "KENNEDY", "CAIOABA",
    "BOTAFOGO", "CARMARY", "NOVA AMERICA", "AMBAI", "PARQUE FLORA"];
  if (inList(b_posse, nomeBairroNorm)) return { nomeURG: "POSSE", taxaTerritorial: 0.012 };

  var b_comendador = ["COMENDADOR SOARES", "JARDIM ALVORADA", "DANON", "ROSA DOS VENTOS", "JD NOVA ERA",
    "JARDIM NOVA ERA", "JD PALMARES", "JARDIM PALMARES", "JD PERNAMBUCO", "JARDIM PERNAMBUCO", "OURO VERDE"];
  if (inList(b_comendador, nomeBairroNorm)) return { nomeURG: "COMENDADOR SOARES", taxaTerritorial: 0.012 };

  var b_cabucu = ["CABUCU", "VALVERDE", "PALHADA", "MARAPICU", "IPIRANGA", "LAGOINHA", "CAMPO ALEGRE"];
  if (inList(b_cabucu, nomeBairroNorm)) return { nomeURG: "CABUCU", taxaTerritorial: 0.01 };

  var b_km32 = ["KM32", "KM 32", "JARDIM GUANDU", "PARAISO", "PRADOS VERDES"];
  if (inList(b_km32, nomeBairroNorm)) return { nomeURG: "KM 32", taxaTerritorial: 0.01 };

  var b_austin = ["AUSTIN", "RIACHAO", "CACUIA", "RODILANDIA", "INCONFIDENCIA", "CARLOS SAMPAIO", "VILA GUIMARAES", "TINGUAZINHO"];
  if (inList(b_austin, nomeBairroNorm)) return { nomeURG: "AUSTIN", taxaTerritorial: 0.01 };

  var b_cava = ["VILA DE CAVA", "SANTA RITA", "CORUMBA", "RANCHO FUNDO", "FIGUEIRAS", "IGUACU VELHO"];
  if (inList(b_cava, nomeBairroNorm)) return { nomeURG: "VILA DE CAVA", taxaTerritorial: 0.01 };

  var b_miguel = ["MIGUEL COUTO", "PARQUE AMBAI", "GRAMA", "BOA ESPERANCA", "GENECIANO"];
  if (inList(b_miguel, nomeBairroNorm)) return { nomeURG: "MIGUEL COUTO", taxaTerritorial: 0.01 };

  var b_tingua = ["TINGUA", "ADRIANOPOLIS", "RIO D OURO", "RIO D'OURO", "MONTEVIDEO", "JACERUBA"];
  if (inList(b_tingua, nomeBairroNorm)) return { nomeURG: "TINGUA", taxaTerritorial: 0.01 };

  return null;
}

// ===============================
// HELPERS
// ===============================
function normalizarTexto(txt) {
  if (txt === null || txt === undefined) return "";
  return txt
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseValorBR(v) {
  if (typeof v === "number") return v;
  if (v === null || v === undefined) return NaN;

  var s = v.toString().trim();
  s = s.replace(/\s/g, "");
  s = s.replace(/\./g, "").replace(",", ".");
  return parseFloat(s);
}

// ===============================
// FUNÇÕES PARA O SITE
// ===============================
export function getListaBairros() {
  return [
    "ADRIANÓPOLIS", "AMBAÍ", "AUSTIN", "BOA ESPERANÇA", "BOTAFOGO", "CABUÇU", "CACUIA",
    "CAIOABA", "CALIFÓRNIA", "CAMPO ALEGRE", "CARLOS SAMPAIO", "CARMARY", "CENTRO",
    "CERÂMICA", "CHACRINHA", "COMENDADOR SOARES", "CORUMBÁ", "DA LUZ", "DANON",
    "ENGENHO PEQUENO", "FIGUEIRAS", "GENECIANO", "GRAMA", "IGUAÇU VELHO",
    "INCONFIDÊNCIA", "IPIRANGA", "JACERUBA", "JARDIM ALVORADA", "JARDIM GUANDU",
    "JARDIM IGUAÇU", "JARDIM NOVA ERA", "JARDIM PALMARES", "JARDIM PERNAMBUCO",
    "JARDIM TROPICAL", "JUSCELINO", "KAONZE", "KM 32", "LAGOINHA",
    "MARAPICU", "MIGUEL COUTO", "MONTEVIDÉU", "MOQUETÁ", "NOVA AMÉRICA",
    "OURO VERDE", "PALHADA", "PARAÍSO", "PARQUE AMBAÍ", "PARQUE FLORA", "PONTO CHIC",
    "POSSE", "PRADOS VERDES", "PRATA", "RANCHO FUNDO", "RANCHO NOVO", "RIACHÃO",
    "RIO D'OURO", "RODILÂNDIA", "ROSA DOS VENTOS", "SANTA EUGÊNIA", "SANTA RITA",
    "TINGUÁ", "TINGUAZINHO", "TRÊS CORAÇÕES", "VALVERDE", "VIGA", "VILA DE CAVA",
    "VILA GUIMARÃES", "VILA NOVA", "VILA OPERÁRIA",
  ];
}

export function calcularParaSite(bairro, tipo, valor, zonaEspecial) {
  var resultado = CALCULAR_IPTU(bairro, tipo, valor, zonaEspecial);

  var taxaDecimal = resultado[0][0];
  var textoCurto = resultado[0][1];

  var vvi = parseValorBR(valor);
  var iptu = !isNaN(vvi) && vvi >= 0 ? vvi * taxaDecimal : NaN;

  // Extrair URG do bairro para exibição
  var dadosBairro = obterDadosDoBairro(normalizarTexto(bairro));
  var urg = dadosBairro ? dadosBairro.nomeURG : "";

  var calculoTexto = "";
  if (!isNaN(vvi) && !isNaN(iptu)) {
    calculoTexto =
      "Cálculo: IPTU = Valor Venal × Alíquota\n" +
      "IPTU = " +
      formatBRL(vvi) +
      " × " +
      formatPctBR(taxaDecimal) +
      "\n" +
      "IPTU = " +
      formatBRL(iptu);
  } else {
    calculoTexto = "Não foi possível calcular o IPTU porque o valor venal informado está inválido.";
  }

  // Gera a mensagem completa para o contribuinte
  var textoCompleto = gerarMensagemContribuinte(bairro, tipo, valor, zonaEspecial);

  return {
    aliquotaDecimal: taxaDecimal,
    aliquota: formatPctBR(taxaDecimal),
    iptu: !isNaN(iptu) ? formatBRL(iptu) : "—",
    valorVenal: !isNaN(vvi) ? formatBRL(vvi) : "—",
    urg: urg,
    texto: textoCompleto,
    textoCurto: textoCurto,
    calculo: calculoTexto,
  };
}

// ===============================
// FORMATAÇÕES (reutilizáveis no módulo)
// ===============================
function formatBRL(n) {
  try {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch (_) {
    return "R$ " + Number(n).toFixed(2).replace(".", ",");
  }
}
function formatPctBR(taxaDecimal, casas = 2) {
  return (taxaDecimal * 100).toFixed(casas).replace(".", ",") + "%";
}
function formatDecimalBR(n, casas = 3) {
  return n.toFixed(casas).replace(".", ",");
}
function tituloUrg(urgNorm) {
  // "CENTRO" -> "Centro", "COMENDADOR SOARES" -> "Comendador Soares"
  return urgNorm
    .toLowerCase()
    .split(" ")
    .map(p => p ? (p[0].toUpperCase() + p.slice(1)) : p)
    .join(" ");
}

/**
 * Gera a fundamentação para atendimento ao contribuinte.
 * - Não altera regra de cálculo: só "explica" usando as mesmas tabelas.
 */
export function gerarMensagemContribuinte(bairro, tipo, valor, zonaEspecial, anoExercicio = 2026) {
  // Normaliza e valida
  if (!bairro) return "Selecione um bairro para gerar a fundamentação.";

  const nomeBairro = normalizarTexto(bairro);
  const tipoImovel = normalizarTexto(tipo);
  const ze = isZonaEspecialSim(zonaEspecial);

  const dados = obterDadosDoBairro(nomeBairro);
  if (!dados) return "Bairro não cadastrado. Não foi possível gerar a fundamentação.";

  const urgNorm = dados.nomeURG; // "CENTRO", "POSSE", etc.
  const urgTitulo = tituloUrg(urgNorm);
  const vigencia = " (Ref. Tabelas 2017)";

  // Territorial (sem VVI) - usa taxa do bairro ou ZE
  if (tipoImovel === "TERRITORIAL") {
    let taxa = dados.taxaTerritorial;
    let baseTextoTabela = `Tabela 1 — Territorial por bairro/URG${vigencia}`;

    if (ze) {
      const taxaZE = obterTaxaZonaEspecialTerritorial(nomeBairro);
      if (taxaZE !== null) {
        taxa = taxaZE;
        baseTextoTabela = `Tabela 2 — Territorial em Zona Especial (ZE)${vigencia}`;
      } else {
        // mantém Tabela 1
        baseTextoTabela = `Tabela 1 — Territorial por bairro/URG${vigencia} (ZE marcado, mas bairro não consta na lista ZE)`;
      }
    }

    return [
      `Ao analisar o lançamento do IPTU ${anoExercicio} para o imóvel em questão, seguem os pontos de fundamentação para o atendimento ao contribuinte:\n`,
      `1. Enquadramento Legal`,
      `O imóvel está localizado na Zona Administrativa da URG ${urgTitulo}, o que define a tabela de alíquotas aplicável. Conforme a legislação municipal${vigencia}, a tributação Territorial segue a alíquota definida por bairro/URG e, quando aplicável, por Zona Especial (ZE).`,
      ``,
      `2. Justificativa da Alíquota (${formatPctBR(taxa, 1)})`,
      `Aplicação: ${baseTextoTabela}.`,
      `Bairro informado: ${bairro}.`,
      `Alíquota aplicada: ${formatPctBR(taxa, 1)}.`,
      ``,
      `3. Memória de Cálculo`,
      `No caso Territorial, a incidência é pela alíquota definida na tabela correspondente. Se houver base de cálculo/lançamento específico no sistema municipal, aplica-se conforme o procedimento interno do setor.`,
      ``,
      `4. Conclusão`,
      `O lançamento está em conformidade com as tabelas municipais vigentes${vigencia}, considerando a URG do bairro e a indicação de Zona Especial quando aplicável.`
    ].join("\n");
  }

  // Predial (Residencial / Comercial / Industrial) - usa VVI e faixas (Tabela 3 ou 4)
  const vvi = parseValorBR(valor);
  if (isNaN(vvi) || vvi < 0) {
    return "Valor venal inválido. Não foi possível gerar a fundamentação.";
  }

  let tabela = [];
  let nomeTabela = "";
  let faixasTexto = [];
  let limites = [];

  if (tipoImovel === "RESIDENCIAL") {
    tabela = obterTabelaPredialResidencial(urgNorm);
    if (!tabela || tabela.length < 4) return "URG sem tabela configurada para Residencial. Não foi possível gerar a fundamentação.";
    nomeTabela = `Tabela 3 — Predial Residencial${vigencia}`;

    // Faixas padrão (conforme seu código)
    limites = [25000, 50000, 100000, Infinity];
    faixasTexto = [
      `Até R$ 25.000,00  — ${formatPctBR(tabela[0].taxa)}`,
      `De R$ 25.000,01 a R$ 50.000,00 — ${formatPctBR(tabela[1].taxa)}`,
      `De R$ 50.000,01 a R$ 100.000,00 — ${formatPctBR(tabela[2].taxa)}`,
      `Acima de R$ 100.000,01 — ${formatPctBR(tabela[3].taxa)}`
    ];
  } else if (tipoImovel === "COMERCIAL" || tipoImovel === "INDUSTRIAL") {
    tabela = obterTabelaPredialComercialIndustrial(urgNorm);
    if (!tabela || tabela.length < 4) return "URG sem tabela configurada para Comercial/Industrial. Não foi possível gerar a fundamentação.";
    nomeTabela = `Tabela 4 — Predial Comercial / Industrial${vigencia}`;

    limites = [30000, 60000, 100000, Infinity];
    faixasTexto = [
      `Até R$ 30.000,00  — ${formatPctBR(tabela[0].taxa)}`,
      `De R$ 30.000,01 a R$ 60.000,00 — ${formatPctBR(tabela[1].taxa)}`,
      `De R$ 60.000,01 a R$ 100.000,00 — ${formatPctBR(tabela[2].taxa)}`,
      `Acima de R$ 100.000,01 — ${formatPctBR(tabela[3].taxa)}`
    ];
  } else {
    return "Tipo de imóvel inválido. Não foi possível gerar a fundamentação.";
  }

  // Achar faixa selecionada
  let idx = 0;
  for (let i = 0; i < tabela.length; i++) {
    if (vvi <= tabela[i].limite) { idx = i; break; }
  }
  const taxa = tabela[idx].taxa;
  const iptu = vvi * taxa;

  // Justificativa da faixa
  const motivoFaixa = (() => {
    if (idx === 0) return `Como o valor venal está dentro do limite da Faixa 1, aplica-se a alíquota mínima (${formatPctBR(taxa)}).`;
    const tetoAnterior = limites[idx - 1];
    return `Como o valor venal excede o teto da Faixa ${idx} (R$ ${tetoAnterior.toLocaleString("pt-BR")}), aplica-se a alíquota da Faixa ${idx + 1} (${formatPctBR(taxa)}).`;
  })();

  // Aviso ZE para Comercial/Industrial (igual sua regra atual: só aviso)
  const avisoZE = (ze && (tipoImovel === "COMERCIAL" || tipoImovel === "INDUSTRIAL"))
    ? `\n\nObservação (ZE): Para Comercial/Industrial, a condição de Zona Especial pode depender de logradouro/trecho conforme procedimento interno (Tabela 4).`
    : "";

  // Montar texto final
  return [
    `Ao analisar o lançamento do IPTU ${anoExercicio} para o imóvel em questão, seguem os pontos de fundamentação para o atendimento ao contribuinte:\n`,
    `1. Enquadramento Legal`,
    `O imóvel está localizado na Zona Administrativa da URG ${urgTitulo}, o que define a tabela de alíquotas aplicável. Conforme a legislação municipal${vigencia}, a tributação para imóveis edificados nesta região segue o critério da progressividade em razão do valor venal.`,
    ``,
    `2. Justificativa da Alíquota (${formatPctBR(taxa)})`,
    `A tabela estabelece quatro faixas de tributação. O valor venal apurado para o exercício de ${anoExercicio} é de ${formatBRL(vvi)}.`,
    ``,
    `Faixas de Valor Venal e Alíquotas (${nomeTabela}):`,
    `- ${faixasTexto[0]}`,
    `- ${faixasTexto[1]}`,
    `- ${faixasTexto[2]}`,
    `- ${faixasTexto[3]}`,
    ``,
    `${motivoFaixa}${avisoZE}`,
    ``,
    `3. Memória de Cálculo`,
    `O cálculo segue a fórmula padrão de aplicação direta sobre a base de cálculo:`,
    `Base de Cálculo (VVI): ${formatBRL(vvi)}`,
    `Alíquota (ALC): ${formatPctBR(taxa)} (ou ${formatDecimalBR(taxa, 3)})`,
    `Cálculo: ${formatBRL(vvi)} × ${formatDecimalBR(taxa, 3)} = ${formatBRL(iptu)}`,
    `IPTU Devido: ${formatBRL(iptu)}`,
    ``,
    `4. Conclusão`,
    `O lançamento está em conformidade com a Planta Genérica de Valores e a codificação de logradouros da zona correspondente, sem indícios de erro de processamento, ocorrendo apenas a aplicação da alíquota compatível com o valor venal do imóvel e com a URG do bairro${vigencia}.`
  ].join("\n");
}

