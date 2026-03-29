import { loadCsvText, parseCsvText, csvRowsToObjects } from "./csvLoader.js";
import {
  normalizeSpaces,
  normalizeText,
  normalizeNeighborhoodText,
  normalizeNeighborhoodLabel,
  parseBrazilianNumber,
} from "./normalizers.js";
import {
  loadIptuBaseData,
  getUfinigByCompetencia,
  getUrgByBairro,
} from "./iptuDataService.js";

const PATH_TERRENO_BAIRRO_OFICIAL = "/data/iptu/pgv_terreno_bairro_oficial.csv";
const PATH_TERRENO_ZONA_ESPECIAL = "/data/iptu/pgv_terreno_zona_especial.csv";
const PATH_FATOR_UTILIZACAO = "/data/iptu/fator_utilizacao_terreno.csv";

let terrenoCache = null;

export async function loadIptuTerrenoData() {
  if (terrenoCache) return terrenoCache;

  await loadIptuBaseData();

  const [bairroOficialText, zonaEspecialText, fatorText] = await Promise.all([
    loadCsvText(PATH_TERRENO_BAIRRO_OFICIAL),
    loadCsvText(PATH_TERRENO_ZONA_ESPECIAL),
    loadCsvText(PATH_FATOR_UTILIZACAO),
  ]);

  const bairroOficialRows = parseCsvText(bairroOficialText);
  const zonaEspecialRows = parseCsvText(zonaEspecialText);
  const fatorRows = parseCsvText(fatorText);

  validateRequiredColumns(
    getHeaderSet(bairroOficialRows),
    ["urg", "bairro", "zona_fiscal", "faixa_area", "area_min", "area_max", "valor_ufinig_m2"],
    PATH_TERRENO_BAIRRO_OFICIAL
  );
  validateRequiredColumns(
    getHeaderSet(zonaEspecialRows),
    ["urg", "bairro", "codigo_logradouro", "faixa_area", "area_min", "area_max", "valor_ufinig_m2"],
    PATH_TERRENO_ZONA_ESPECIAL
  );
  validateRequiredColumns(
    getHeaderSet(fatorRows),
    ["faixa_area", "area_min", "area_max", "fator_z"],
    PATH_FATOR_UTILIZACAO
  );

  const bairroOficialData = csvRowsToObjects(bairroOficialRows)
    .map((row) => normalizeTerrenoBairroOficialRow(row))
    .filter((row) => row !== null);

  const zonaEspecialData = csvRowsToObjects(zonaEspecialRows)
    .map((row) => normalizeTerrenoZonaEspecialRow(row))
    .filter((row) => row !== null);

  const fatorUtilizacaoData = csvRowsToObjects(fatorRows)
    .map((row) => normalizeFatorUtilizacaoRow(row))
    .filter((row) => row !== null);

  terrenoCache = {
    terrenoBairroOficial: bairroOficialData,
    terrenoZonaEspecial: zonaEspecialData,
    fatorUtilizacaoTerreno: fatorUtilizacaoData,
    indexes: {
      bairroOficialByBairroZona: buildGroupedIndex(
        bairroOficialData,
        (item) => `${item.bairroNorm}::${item.zonaFiscalNorm}`
      ),
      zonaEspecialByBairroCodigo: buildGroupedIndex(
        zonaEspecialData,
        (item) => `${item.bairroNorm}::${item.codigoLogradouroNorm}`
      ),
      fatorUtilizacaoFaixas: sortByFaixaOrder(fatorUtilizacaoData),
    },
  };

  return terrenoCache;
}

export async function getTerrenoBairroOficialValue(params) {
  const data = await loadIptuTerrenoData();
  const areaTerreno = normalizeAreaTerreno(params?.areaTerreno);
  const zonaFiscalNorm = normalizeZonaFiscal(params?.zonaFiscal);
  const bairroNorm = normalizeNeighborhoodText(params?.bairro);

  if (areaTerreno === null || zonaFiscalNorm === null || bairroNorm === "") {
    return null;
  }

  const urgByEtapa1 = await getUrgByBairro(params?.bairro);
  const key = `${bairroNorm}::${zonaFiscalNorm}`;
  const candidates = data.indexes.bairroOficialByBairroZona.get(key) || [];

  let filtered = candidates;
  if (urgByEtapa1) {
    const urgNorm = normalizeText(urgByEtapa1);
    const withUrg = candidates.filter((row) => row.urgNorm === urgNorm);
    if (withUrg.length > 0) {
      filtered = withUrg;
    }
  }

  const faixa = findFaixaForArea(filtered, areaTerreno);
  return faixa ? faixa.valorUnitarioTerreno : null;
}

export async function getTerrenoZonaEspecialValue(params) {
  const data = await loadIptuTerrenoData();
  const areaTerreno = normalizeAreaTerreno(params?.areaTerreno);
  const bairroNorm = normalizeNeighborhoodText(params?.bairro);
  const codigoLogradouroNorm = normalizeCodigoLogradouro(params?.codigoLogradouro);

  if (areaTerreno === null || bairroNorm === "" || codigoLogradouroNorm === "") {
    return null;
  }

  const key = `${bairroNorm}::${codigoLogradouroNorm}`;
  const candidates = data.indexes.zonaEspecialByBairroCodigo.get(key) || [];
  const faixa = findFaixaForArea(candidates, areaTerreno);

  return faixa ? faixa.valorUnitarioTerreno : null;
}

export async function getFatorUtilizacaoTerreno(areaTerreno) {
  const data = await loadIptuTerrenoData();
  const area = normalizeAreaTerreno(areaTerreno);
  if (area === null) return null;

  const faixa = findFaixaForArea(data.indexes.fatorUtilizacaoFaixas, area);
  return faixa ? faixa.fatorZ : null;
}

export async function calculateValorVenalTerreno(params) {
  const tipoTerreno = normalizeTipoTerreno(params?.tipoTerreno);
  const areaTerreno = normalizeAreaTerreno(params?.areaTerreno);

  if (!tipoTerreno || areaTerreno === null) return null;

  let valorUnitarioTerreno = null;
  if (tipoTerreno === "bairro_oficial") {
    valorUnitarioTerreno = await getTerrenoBairroOficialValue(params);
  } else if (tipoTerreno === "zona_especial") {
    valorUnitarioTerreno = await getTerrenoZonaEspecialValue(params);
  }

  const fatorZ = await getFatorUtilizacaoTerreno(areaTerreno);
  const ufinig = await getUfinigByCompetencia(params?.competencia);

  if (valorUnitarioTerreno === null || fatorZ === null) {
    return null;
  }

  // Regra validada: NUNCA multiplicar terreno por UFINIG no valor venal.
  const valorVenalTerreno = areaTerreno * valorUnitarioTerreno * fatorZ;

  return {
    competencia:
      params?.competencia === null || params?.competencia === undefined
        ? null
        : normalizeSpaces(String(params.competencia)),
    bairro: normalizeSpaces(params?.bairro),
    areaTerreno,
    ufinig,
    valorUnitarioTerreno,
    fatorZ,
    valorVenalTerreno,
  };
}

export function normalizeZonaFiscal(value) {
  const parsed = parseBrazilianNumber(value);
  if (Number.isNaN(parsed)) return null;
  return String(parsed);
}

export function normalizeTipoTerreno(value) {
  const normalized = normalizeText(value).replace(/[\s-]+/g, "_");
  if (normalized === "BAIRRO_OFICIAL" || normalized === "BAIRROOFICIAL") {
    return "bairro_oficial";
  }
  if (normalized === "ZONA_ESPECIAL" || normalized === "ZONAESPECIAL") {
    return "zona_especial";
  }
  return null;
}

export function clearIptuTerrenoCache() {
  terrenoCache = null;
}

function validateRequiredColumns(headerSet, requiredColumns, sourcePath) {
  const missingColumns = requiredColumns.filter((column) => !headerSet.has(column));
  if (missingColumns.length > 0) {
    throw new Error(
      `CSV invalido em ${sourcePath}. Colunas ausentes: ${missingColumns.join(", ")}`
    );
  }
}

function getHeaderSet(rows) {
  if (!rows.length) return new Set();
  return new Set(rows[0].map((header) => normalizeSpaces(header).toLowerCase()));
}

function normalizeTerrenoBairroOficialRow(row) {
  const bairro = normalizeNeighborhoodLabel(row.bairro);
  const zonaFiscalNorm = normalizeZonaFiscal(row.zona_fiscal);
  const valorUnitarioTerreno = parseBrazilianNumber(row.valor_ufinig_m2);

  if (!bairro || zonaFiscalNorm === null || Number.isNaN(valorUnitarioTerreno)) {
    return null;
  }

  return {
    urg: normalizeSpaces(row.urg),
    urgNorm: normalizeText(row.urg),
    bairro,
    bairroNorm: normalizeNeighborhoodText(bairro),
    zonaFiscal: normalizeSpaces(row.zona_fiscal),
    zonaFiscalNorm,
    faixaArea: normalizeSpaces(row.faixa_area),
    areaMin: parseOptionalNumber(row.area_min),
    areaMax: parseOptionalNumber(row.area_max),
    valorUnitarioTerreno,
  };
}

function normalizeTerrenoZonaEspecialRow(row) {
  const bairro = normalizeNeighborhoodLabel(row.bairro);
  const codigoLogradouro = normalizeSpaces(row.codigo_logradouro);
  const valorUnitarioTerreno = parseBrazilianNumber(row.valor_ufinig_m2);

  if (!bairro || !codigoLogradouro || Number.isNaN(valorUnitarioTerreno)) {
    return null;
  }

  return {
    urg: normalizeSpaces(row.urg),
    urgNorm: normalizeText(row.urg),
    bairro,
    bairroNorm: normalizeNeighborhoodText(bairro),
    codigoLogradouro,
    codigoLogradouroNorm: normalizeCodigoLogradouro(codigoLogradouro),
    faixaArea: normalizeSpaces(row.faixa_area),
    areaMin: parseOptionalNumber(row.area_min),
    areaMax: parseOptionalNumber(row.area_max),
    valorUnitarioTerreno,
  };
}

function normalizeFatorUtilizacaoRow(row) {
  const fatorZ = parseBrazilianNumber(row.fator_z);
  if (Number.isNaN(fatorZ)) return null;

  return {
    faixaArea: normalizeSpaces(row.faixa_area),
    areaMin: parseOptionalNumber(row.area_min),
    areaMax: parseOptionalNumber(row.area_max),
    fatorZ,
  };
}

function parseOptionalNumber(value) {
  const text = normalizeSpaces(value);
  if (!text) return null;

  const parsed = parseBrazilianNumber(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeAreaTerreno(value) {
  const parsed = parseBrazilianNumber(value);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizeCodigoLogradouro(value) {
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

  for (const [key, items] of map.entries()) {
    map.set(key, sortByFaixaOrder(items));
  }

  return map;
}

function sortByFaixaOrder(list) {
  return [...list].sort((a, b) => {
    const upperA = a.areaMax ?? Number.POSITIVE_INFINITY;
    const upperB = b.areaMax ?? Number.POSITIVE_INFINITY;
    if (upperA !== upperB) return upperA - upperB;

    const lowerA = a.areaMin ?? Number.NEGATIVE_INFINITY;
    const lowerB = b.areaMin ?? Number.NEGATIVE_INFINITY;
    return lowerA - lowerB;
  });
}

function findFaixaForArea(faixas, area) {
  for (const faixa of faixas) {
    const lower = faixa.areaMin ?? Number.NEGATIVE_INFINITY;
    const upper = faixa.areaMax ?? Number.POSITIVE_INFINITY;
    if (area >= lower && area <= upper) {
      return faixa;
    }
  }
  return null;
}
