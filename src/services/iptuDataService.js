import { loadCsvText, parseCsvText, csvRowsToObjects } from "./csvLoader.js";
import {
  normalizeSpaces,
  normalizeNeighborhoodText,
  normalizeNeighborhoodLabel,
  parseBrazilianNumber,
} from "./normalizers.js";

const PATH_COMPETENCIA_UFINIG = "/data/iptu/dados_competencia_ufinig.csv";
const PATH_BAIRROS_URG = "/data/iptu/dados_bairros_urg.csv";

let baseCache = null;

export async function getUrgByBairro(bairro) {
  const data = await loadIptuBaseData();
  const key = normalizeNeighborhoodText(bairro);
  return data.indexes.urgByBairro.get(key) ?? null;
}

export async function getUfinigByCompetencia(competencia) {
  const data = await loadIptuBaseData();
  const key = normalizeCompetencia(competencia);
  return data.indexes.ufinigByCompetencia.get(key) ?? null;
}

export async function loadIptuBaseData() {
  if (baseCache) return baseCache;

  const [competenciaText, bairrosText] = await Promise.all([
    loadCsvText(PATH_COMPETENCIA_UFINIG),
    loadCsvText(PATH_BAIRROS_URG),
  ]);

  const competenciaRows = parseCsvText(competenciaText);
  const bairrosRows = parseCsvText(bairrosText);

  const competenciaHeaders = getHeaderSet(competenciaRows);
  const bairrosHeaders = getHeaderSet(bairrosRows);

  assertRequiredColumns(competenciaHeaders, ["competencia", "ufinig"], PATH_COMPETENCIA_UFINIG);
  assertRequiredColumns(bairrosHeaders, ["bairro", "urg"], PATH_BAIRROS_URG);

  const competenciasObjects = csvRowsToObjects(competenciaRows);
  const bairrosObjects = csvRowsToObjects(bairrosRows);

  const competenciasUfinig = competenciasObjects
    .map((row) => {
      const competencia = normalizeCompetencia(row.competencia);
      const ufinig = parseBrazilianNumber(row.ufinig);
      return { competencia, ufinig };
    })
    .filter((item) => item.competencia !== "" && !Number.isNaN(item.ufinig));

  const bairrosUrg = bairrosObjects
    .map((row) => {
      const bairro = normalizeNeighborhoodLabel(row.bairro);
      const urg = normalizeSpaces(row.urg);
      return { bairro, bairroNorm: normalizeNeighborhoodText(bairro), urg };
    })
    .filter((item) => item.bairro !== "" && item.urg !== "");

  baseCache = {
    competenciasUfinig,
    bairrosUrg,
    indexes: {
      ufinigByCompetencia: new Map(
        competenciasUfinig.map((item) => [item.competencia, item.ufinig])
      ),
      urgByBairro: new Map(
        bairrosUrg.map((item) => [item.bairroNorm, item.urg])
      ),
    },
  };

  return baseCache;
}

export function clearEtapa1Cache() {
  baseCache = null;
}

function assertRequiredColumns(headerSet, requiredColumns, sourcePath) {
  const missing = requiredColumns.filter((column) => !headerSet.has(column));
  if (missing.length > 0) {
    throw new Error(
      `CSV inválido em ${sourcePath}. Colunas ausentes: ${missing.join(", ")}`
    );
  }
}

function getHeaderSet(rows) {
  if (!rows.length) return new Set();
  return new Set(rows[0].map((header) => normalizeSpaces(header).toLowerCase()));
}

function normalizeCompetencia(value) {
  if (value === null || value === undefined) return "";
  return normalizeSpaces(String(value));
}
