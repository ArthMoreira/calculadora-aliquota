/**
 * Carrega e faz parse de CSV sem alterar a linha inteira antes do parse.
 * O parser respeita aspas e vírgulas internas em campos textualizados.
 */

export async function loadCsvText(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Falha ao carregar CSV: ${path} (${response.status})`);
  }

  const text = await response.text();
  return text.replace(/^\uFEFF/, "");
}

export function parseCsvText(text, delimiter = ",") {
  const normalized = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const lines = normalized
    .split("\n")
    .filter((line) => line.trim().length > 0);

  return lines.map((line) => parseCsvLine(line, delimiter));
}

function parseCsvLine(line, delimiter = ",") {
  const fields = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      fields.push(field);
      field = "";
      continue;
    }

    field += ch;
  }

  fields.push(field);
  return fields;
}

export function csvRowsToObjects(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const headers = rows[0].map((header) => String(header).trim());
  const dataRows = rows.slice(1);

  return dataRows
    .filter((cols) => cols.some((value) => String(value ?? "").trim() !== ""))
    .map((cols) => {
      const rowObject = {};
      for (let i = 0; i < headers.length; i += 1) {
        rowObject[headers[i]] = cols[i] ?? "";
      }
      return rowObject;
    });
}

export function parseCsvToObjects(text, delimiter = ",") {
  const rows = parseCsvText(text, delimiter);
  return csvRowsToObjects(rows);
}
