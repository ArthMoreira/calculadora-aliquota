export function normalizeSpaces(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

const NEIGHBORHOOD_ALIASES = Object.freeze({
  KAONZE: "CAONZE",
});

const NEIGHBORHOOD_CANONICAL_LABELS = Object.freeze({
  CAONZE: "Caonze",
});

export function normalizeText(value) {
  return normalizeSpaces(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeNeighborhoodText(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  return NEIGHBORHOOD_ALIASES[normalized] || normalized;
}

export function normalizeNeighborhoodLabel(value) {
  const canonical = normalizeNeighborhoodText(value);
  if (!canonical) return "";
  return NEIGHBORHOOD_CANONICAL_LABELS[canonical] || normalizeSpaces(value);
}

export function parseBrazilianNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }

  if (value === null || value === undefined) return NaN;

  let text = normalizeSpaces(value);
  if (!text) return NaN;

  text = text
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!text) return NaN;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    // Se tiver ponto e vírgula, assume formato brasileiro: 1.234,56
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");

    if (lastComma > lastDot) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Só vírgula: 123,45 -> 123.45
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    // Só ponto: mantém decimal padrão (85.5), limpando separador de milhar repetido.
    const dots = (text.match(/\./g) || []).length;
    if (dots > 1) {
      const lastDot = text.lastIndexOf(".");
      const integerPart = text.slice(0, lastDot).replace(/\./g, "");
      const decimalPart = text.slice(lastDot + 1);
      text = `${integerPart}.${decimalPart}`;
    }
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : NaN;
}
