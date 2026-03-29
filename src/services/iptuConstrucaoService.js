import { loadCsvText, parseCsvText, csvRowsToObjects } from "./csvLoader.js";
import {
  normalizeSpaces,
  normalizeText,
  normalizeNeighborhoodText,
  normalizeNeighborhoodLabel,
  parseBrazilianNumber,
} from "./normalizers.js";
import { loadIptuBaseData, getUfinigByCompetencia, getUrgByBairro } from "./iptuDataService.js";

const PATH_CONSTRUCAO_RESIDENCIAL = "/data/iptu/pgv_construcao_residencial.csv";
const PATH_CONSTRUCAO_COMERCIAL_INDUSTRIAL =
  "/data/iptu/pgv_construcao_comercial_industrial.csv";
const PATH_CONSTRUCAO_ZONA_ESPECIAL = "/data/iptu/pgv_construcao_zona_especial.csv";

let construcaoCache = null;

export async function loadIptuConstrucaoData() {
  if (construcaoCache) return construcaoCache;

  await loadIptuBaseData();

  const [residencialText, comercialIndustrialText, zonaEspecialText] =
    await Promise.all([
      loadCsvText(PATH_CONSTRUCAO_RESIDENCIAL),
      loadCsvText(PATH_CONSTRUCAO_COMERCIAL_INDUSTRIAL),
      loadCsvText(PATH_CONSTRUCAO_ZONA_ESPECIAL),
    ]);

  const residencialRows = parseCsvText(residencialText);
  const comercialIndustrialRows = parseCsvText(comercialIndustrialText);
  const zonaEspecialRows = parseCsvText(zonaEspecialText);

  validateRequiredColumns(
    getHeaderSet(residencialRows),
    ["urg", "bairro", "acp_zf", "acp_ivr", "acp_cube", "acpd_zf", "acpd_cube"],
    PATH_CONSTRUCAO_RESIDENCIAL
  );
  validateRequiredColumns(
    getHeaderSet(comercialIndustrialRows),
    [
      "urg",
      "bairro",
      "zona_fiscal",
      "ivci_loja_terrea",
      "cube_loja_terrea",
      "ivci_pav_superior",
      "cube_pav_superior",
      "cube_uso_comum",
      "ivci_galpao",
      "cube_galpao",
      "ivci_telheiro",
      "cube_telheiro",
      "cube_estacionamento",
    ],
    PATH_CONSTRUCAO_COMERCIAL_INDUSTRIAL
  );
  validateRequiredColumns(
    getHeaderSet(zonaEspecialRows),
    ["grupo_zona_especial", "nome_logradouro", "trecho", "codigo", "bairro", "ivc_ze", "cube_cze"],
    PATH_CONSTRUCAO_ZONA_ESPECIAL
  );

  const residencialData = csvRowsToObjects(residencialRows)
    .map((row) => buildResidencialRow(row))
    .filter((row) => row !== null);

  const comercialIndustrialData = csvRowsToObjects(comercialIndustrialRows)
    .map((row) => buildComercialIndustrialRow(row))
    .filter((row) => row !== null);

  const zonaEspecialData = csvRowsToObjects(zonaEspecialRows)
    .map((row) => buildZonaEspecialRow(row))
    .filter((row) => row !== null);

  construcaoCache = {
    residencial: residencialData,
    comercialIndustrial: comercialIndustrialData,
    zonaEspecial: zonaEspecialData,
    indexes: {
      residencialByBairro: buildGroupedIndex(residencialData, (item) => item.bairroNorm),
      comercialIndustrialByBairroZona: buildFirstIndex(
        comercialIndustrialData,
        (item) => `${item.bairroNorm}::${item.zonaFiscalKey}`
      ),
      zonaEspecialByBairroCodigo: buildGroupedIndex(
        zonaEspecialData,
        (item) => `${item.bairroNorm}::${item.codigoNorm}`
      ),
    },
  };

  return construcaoCache;
}

export async function getConstrucaoResidencialValue(params) {
  const data = await loadIptuConstrucaoData();
  const bairroNorm = normalizeNeighborhoodText(params?.bairro);
  const zonaFiscalKey = normalizeZonaFiscal(params?.zonaFiscal);
  const padraoResidencial = normalizePadraoResidencial(params?.padrao);

  if (!bairroNorm || !zonaFiscalKey || !padraoResidencial) return null;

  const candidates = data.indexes.residencialByBairro.get(bairroNorm) || [];
  const urg = await getUrgByBairro(params?.bairro);
  const urgNorm = urg ? normalizeText(urg) : "";

  const match = candidates.find((row) => {
    const zoneMatch =
      padraoResidencial === "principal"
        ? row.acpZonaFiscalKey === zonaFiscalKey
        : row.acpdZonaFiscalKey === zonaFiscalKey;
    if (!zoneMatch) return false;

    return urgNorm ? row.urgNorm === urgNorm : true;
  });

  if (!match) return null;

  if (padraoResidencial === "principal") {
    return {
      tipo: "residencial",
      padrao: "principal",
      bairro: match.bairro,
      zonaFiscalKey,
      cube: match.acpCube,
      ivr: match.acpIvr,
    };
  }

  return {
    tipo: "residencial",
    padrao: "diferente",
    bairro: match.bairro,
    zonaFiscalKey,
    cube: match.acpdCube,
    ivr: null,
  };
}

export async function getConstrucaoComercialIndustrialValues(params) {
  const data = await loadIptuConstrucaoData();
  const bairroNorm = normalizeNeighborhoodText(params?.bairro);
  const zonaFiscalKey = normalizeZonaFiscal(params?.zonaFiscal);
  if (!bairroNorm || !zonaFiscalKey) return null;

  const key = `${bairroNorm}::${zonaFiscalKey}`;
  const match = data.indexes.comercialIndustrialByBairroZona.get(key) || null;
  if (!match) return null;

  return {
    tipo: "comercial_industrial",
    bairro: match.bairro,
    zonaFiscalKey,
    valores: {
      lojaTerrea: { cube: match.cubeLojaTerrea, ivc: match.ivciLojaTerrea },
      pavimentoSuperior: { cube: match.cubePavimentoSuperior, ivc: match.ivciPavimentoSuperior },
      usoComum: { cube: match.cubeUsoComum, ivc: null },
      galpao: { cube: match.cubeGalpao, ivc: match.ivciGalpao },
      telheiro: { cube: match.cubeTelheiro, ivc: match.ivciTelheiro },
      estacionamento: { cube: match.cubeEstacionamento, ivc: null },
    },
  };
}

export async function getConstrucaoZonaEspecialValue(params) {
  const data = await loadIptuConstrucaoData();
  const bairroNorm = normalizeNeighborhoodText(params?.bairro);
  const codigoNorm = normalizeCodigo(params?.codigoLogradouro ?? params?.codigo);
  if (!bairroNorm || !codigoNorm) return null;

  const key = `${bairroNorm}::${codigoNorm}`;
  const candidates = data.indexes.zonaEspecialByBairroCodigo.get(key) || [];
  const match = candidates[0] || null;
  if (!match) return null;

  return {
    tipo: "zona_especial",
    grupoZonaEspecial: match.grupoZonaEspecial,
    nomeLogradouro: match.nomeLogradouro,
    codigo: match.codigo,
    bairro: match.bairro,
    ivc: match.ivcZe,
    cube: match.cubeCze,
  };
}

export async function calculateValorVenalConstrucao(params) {
  const tipoConstrucao = normalizeTipoConstrucao(params?.tipoConstrucao);
  const ufinig = await getUfinigByCompetencia(params?.competencia);
  if (!tipoConstrucao || ufinig === null) return null;

  let componentes = [];

  if (tipoConstrucao === "residencial") {
    componentes = await buildResidentialComponents(params, ufinig);
  } else if (tipoConstrucao === "comercial_industrial") {
    componentes = await buildComercialIndustrialComponents(params, ufinig);
  } else if (tipoConstrucao === "zona_especial") {
    componentes = await buildZonaEspecialComponents(params, ufinig);
  }

  if (componentes.length === 0) return null;

  const valorVenalConstrucao = componentes.reduce(
    (sum, item) => sum + item.valorVenalParcial,
    0
  );

  return {
    competencia:
      params?.competencia === null || params?.competencia === undefined
        ? null
        : normalizeSpaces(String(params.competencia)),
    bairro: normalizeSpaces(params?.bairro),
    tipoConstrucao,
    ufinig,
    componentes,
    valorVenalConstrucao,
  };
}

export function normalizeZonaFiscal(value) {
  const parsed = parseBrazilianNumber(value);
  if (Number.isNaN(parsed)) return null;
  return String(parsed);
}

export function normalizePadraoResidencial(value) {
  const normalized = normalizeText(value).replace(/[\s-]+/g, "_");

  if (
    normalized === "PRINCIPAL" ||
    normalized === "PADRAO_PRINCIPAL" ||
    normalized === "ACP"
  ) {
    return "principal";
  }

  if (
    normalized === "DIFERENTE" ||
    normalized === "PADRAO_DIFERENTE" ||
    normalized === "ACPD" ||
    normalized === "SECUNDARIO" ||
    normalized === "SECUNDARIA"
  ) {
    return "diferente";
  }

  return null;
}

export function clearIptuConstrucaoCache() {
  construcaoCache = null;
}

function validateRequiredColumns(headerSet, requiredColumns, sourcePath) {
  const missing = requiredColumns.filter((column) => !headerSet.has(column));
  if (missing.length > 0) {
    throw new Error(
      `CSV invalido em ${sourcePath}. Colunas ausentes: ${missing.join(", ")}`
    );
  }
}

function getHeaderSet(rows) {
  if (!rows.length) return new Set();
  return new Set(rows[0].map((header) => normalizeSpaces(header).toLowerCase()));
}

function buildResidencialRow(row) {
  const bairro = normalizeNeighborhoodLabel(row.bairro);
  const acpCube = parseBrazilianNumber(row.acp_cube);
  const acpdCube = parseBrazilianNumber(row.acpd_cube);
  const acpIvr = parseBrazilianNumber(row.acp_ivr);

  const acpZonaFiscalKey = normalizeZonaFiscal(row.acp_zf);
  const acpdZonaFiscalKey = normalizeZonaFiscal(row.acpd_zf);

  if (
    !bairro ||
    !acpZonaFiscalKey ||
    !acpdZonaFiscalKey ||
    Number.isNaN(acpCube) ||
    Number.isNaN(acpdCube)
  ) {
    return null;
  }

  return {
    urg: normalizeSpaces(row.urg),
    urgNorm: normalizeText(row.urg),
    bairro,
    bairroNorm: normalizeNeighborhoodText(bairro),
    acpZonaFiscalKey,
    acpdZonaFiscalKey,
    acpIvr: Number.isNaN(acpIvr) ? null : acpIvr,
    acpCube,
    acpdCube,
  };
}

function buildComercialIndustrialRow(row) {
  const bairro = normalizeNeighborhoodLabel(row.bairro);
  const zonaFiscalKey = normalizeZonaFiscal(row.zona_fiscal);

  const cubeLojaTerrea = parseBrazilianNumber(row.cube_loja_terrea);
  const cubePavimentoSuperior = parseBrazilianNumber(row.cube_pav_superior);
  const cubeUsoComum = parseBrazilianNumber(row.cube_uso_comum);
  const cubeGalpao = parseBrazilianNumber(row.cube_galpao);
  const cubeTelheiro = parseBrazilianNumber(row.cube_telheiro);
  const cubeEstacionamento = parseBrazilianNumber(row.cube_estacionamento);

  if (
    !bairro ||
    !zonaFiscalKey ||
    [
      cubeLojaTerrea,
      cubePavimentoSuperior,
      cubeUsoComum,
      cubeGalpao,
      cubeTelheiro,
      cubeEstacionamento,
    ].some((n) => Number.isNaN(n))
  ) {
    return null;
  }

  return {
    urg: normalizeSpaces(row.urg),
    urgNorm: normalizeText(row.urg),
    bairro,
    bairroNorm: normalizeNeighborhoodText(bairro),
    zonaFiscalKey,
    ivciLojaTerrea: parseOptionalNumber(row.ivci_loja_terrea),
    cubeLojaTerrea,
    ivciPavimentoSuperior: parseOptionalNumber(row.ivci_pav_superior),
    cubePavimentoSuperior,
    cubeUsoComum,
    ivciGalpao: parseOptionalNumber(row.ivci_galpao),
    cubeGalpao,
    ivciTelheiro: parseOptionalNumber(row.ivci_telheiro),
    cubeTelheiro,
    cubeEstacionamento,
  };
}

function buildZonaEspecialRow(row) {
  const bairro = normalizeNeighborhoodLabel(row.bairro);
  const codigo = normalizeSpaces(row.codigo);
  const ivcZe = parseBrazilianNumber(row.ivc_ze);
  const cubeCze = parseBrazilianNumber(row.cube_cze);

  if (!bairro || !codigo || Number.isNaN(ivcZe) || Number.isNaN(cubeCze)) {
    return null;
  }

  return {
    grupoZonaEspecial: normalizeSpaces(row.grupo_zona_especial),
    nomeLogradouro: normalizeSpaces(row.nome_logradouro),
    trecho: normalizeSpaces(row.trecho),
    codigo,
    codigoNorm: normalizeCodigo(codigo),
    bairro,
    bairroNorm: normalizeNeighborhoodText(bairro),
    ivcZe,
    cubeCze,
  };
}

function parseOptionalNumber(value) {
  const parsed = parseBrazilianNumber(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeArea(value) {
  const parsed = parseBrazilianNumber(value);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeTipoConstrucao(value) {
  const normalized = normalizeText(value).replace(/[\s-]+/g, "_");
  if (normalized === "RESIDENCIAL") return "residencial";
  if (normalized === "COMERCIAL_INDUSTRIAL" || normalized === "COMERCIALINDUSTRIAL") {
    return "comercial_industrial";
  }
  if (normalized === "ZONA_ESPECIAL" || normalized === "ZONAESPECIAL") {
    return "zona_especial";
  }
  return null;
}

function normalizeCodigo(value) {
  return normalizeText(value);
}

function buildGroupedIndex(list, keySelector) {
  const map = new Map();
  for (const item of list) {
    const key = keySelector(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  }
  return map;
}

function buildFirstIndex(list, keySelector) {
  const map = new Map();
  for (const item of list) {
    const key = keySelector(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return map;
}

async function buildResidentialComponents(params, ufinig) {
  const splitMode =
    params?.areaConstruidaPrincipal !== undefined ||
    params?.areaConstruidaDiferente !== undefined;

  if (splitMode) {
    const components = [];

    const areaPrincipal = normalizeArea(params?.areaConstruidaPrincipal);
    if (areaPrincipal !== null) {
      const base = await getConstrucaoResidencialValue({
        bairro: params?.bairro,
        zonaFiscal: params?.zonaFiscal,
        padrao: params?.padraoPrincipal ?? "principal",
      });
      if (!base) return [];

      components.push(
        buildComponentValue({
          chave: "residencial_principal",
          area: areaPrincipal,
          cube: base.cube,
          ufinig,
          detalhe: { padrao: "principal", zonaFiscal: base.zonaFiscalKey },
        })
      );
    }

    const areaDiferente = normalizeArea(params?.areaConstruidaDiferente);
    if (areaDiferente !== null) {
      const base = await getConstrucaoResidencialValue({
        bairro: params?.bairro,
        zonaFiscal: params?.zonaFiscal,
        padrao: params?.padraoDiferente ?? "diferente",
      });
      if (!base) return [];

      components.push(
        buildComponentValue({
          chave: "residencial_diferente",
          area: areaDiferente,
          cube: base.cube,
          ufinig,
          detalhe: { padrao: "diferente", zonaFiscal: base.zonaFiscalKey },
        })
      );
    }

    return components;
  }

  const areaConstruida = normalizeArea(params?.areaConstruida);
  if (areaConstruida === null) return [];

  const base = await getConstrucaoResidencialValue({
    bairro: params?.bairro,
    zonaFiscal: params?.zonaFiscal,
    padrao: params?.padrao,
  });
  if (!base) return [];

  return [
    buildComponentValue({
      chave: "residencial",
      area: areaConstruida,
      cube: base.cube,
      ufinig,
      detalhe: { padrao: base.padrao, zonaFiscal: base.zonaFiscalKey },
    }),
  ];
}

async function buildComercialIndustrialComponents(params, ufinig) {
  const base = await getConstrucaoComercialIndustrialValues({
    bairro: params?.bairro,
    zonaFiscal: params?.zonaFiscal,
  });
  if (!base) return [];

  const areaCubeMap = [
    ["areaLojaTerrea", "loja_terrea", base.valores.lojaTerrea.cube],
    ["areaPavimentoSuperior", "pavimento_superior", base.valores.pavimentoSuperior.cube],
    ["areaGalpao", "galpao", base.valores.galpao.cube],
    ["areaTelheiro", "telheiro", base.valores.telheiro.cube],
    ["areaEstacionamento", "estacionamento", base.valores.estacionamento.cube],
    ["areaUsoComum", "uso_comum", base.valores.usoComum.cube],
  ];

  const components = [];
  for (const [areaField, label, cube] of areaCubeMap) {
    const area = normalizeArea(params?.[areaField]);
    if (area === null) continue;

    components.push(
      buildComponentValue({
        chave: `comercial_industrial_${label}`,
        area,
        cube,
        ufinig,
        detalhe: { zonaFiscal: base.zonaFiscalKey },
      })
    );
  }

  return components;
}

async function buildZonaEspecialComponents(params, ufinig) {
  const areaConstruida = normalizeArea(params?.areaConstruida);
  if (areaConstruida === null) return [];

  const base = await getConstrucaoZonaEspecialValue({
    bairro: params?.bairro,
    codigoLogradouro: params?.codigoLogradouro,
  });
  if (!base) return [];

  return [
    buildComponentValue({
      chave: "zona_especial",
      area: areaConstruida,
      cube: base.cube,
      ufinig,
      detalhe: { codigoLogradouro: base.codigo, grupoZonaEspecial: base.grupoZonaEspecial },
    }),
  ];
}

function buildComponentValue({ chave, area, cube, ufinig, detalhe }) {
  const valorVenalParcial = area * cube * ufinig;

  return {
    chave,
    area,
    cube,
    ufinig,
    valorVenalParcial,
    detalhe,
  };
}
