/**
 * Minimal RFC 4180 CSV reader for product lists. Handles quoted fields,
 * escaped quotes, CRLF, a UTF-8 BOM, and both "," and ";" separators
 * (Excel uses ";" in Ukrainian and most EU locales).
 */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, "");
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f !== ""));
}

function detectDelimiter(line: string): string {
  const count = (d: string) => line.split(d).length - 1;
  const candidates = [";", ",", "\t"];
  return candidates.reduce((best, d) => (count(d) > count(best) ? d : best), ",");
}

export interface ProductRow {
  /** 1-based line number in the file, for error messages. */
  line: number;
  title: string;
  cost?: number;
  shipping?: number;
  gtin?: string;
  queryUa?: string;
}

// Accepted header names (lower-cased), including Ukrainian ones.
const COLUMNS: Record<keyof Omit<ProductRow, "line">, string[]> = {
  title: ["name", "title", "product", "product name", "product_name", "назва", "товар", "найменування"],
  cost: ["cost", "price", "supplier cost", "supplier_cost", "unit cost", "cost_usd", "ціна", "собівартість"],
  shipping: ["shipping", "shipping cost", "shipping_cost", "delivery", "доставка"],
  gtin: ["gtin", "ean", "upc", "barcode", "штрихкод"],
  queryUa: ["query_ua", "ukrainian", "назва укр", "запит"],
};

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value.replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export interface ParsedProducts {
  rows: ProductRow[];
  /** Which recognised columns the header contained. */
  columns: string[];
  warnings: string[];
}

/**
 * Turns CSV text into product rows. With a recognised header row, columns are
 * matched by name; otherwise the first column is the product name and an
 * optional second column is the cost.
 */
export function parseProductCsv(text: string): ParsedProducts {
  const table = parseCsv(text);
  const warnings: string[] = [];
  if (table.length === 0) return { rows: [], columns: [], warnings: ["The file is empty."] };

  const header = table[0].map((h) => h.toLowerCase().replace(/\s+/g, " "));
  const index: Partial<Record<keyof typeof COLUMNS, number>> = {};
  for (const [key, names] of Object.entries(COLUMNS) as [keyof typeof COLUMNS, string[]][]) {
    const i = header.findIndex((h) => names.includes(h));
    if (i >= 0) index[key] = i;
  }
  const hasHeader = index.title !== undefined;
  if (!hasHeader) {
    index.title = 0;
    if (table[0].length > 1) index.cost = 1;
  }

  const rows: ProductRow[] = [];
  table.slice(hasHeader ? 1 : 0).forEach((cells, i) => {
    const line = i + (hasHeader ? 2 : 1);
    const title = cells[index.title!]?.slice(0, 200);
    if (!title) {
      warnings.push(`Line ${line}: no product name, skipped.`);
      return;
    }
    const gtin = index.gtin !== undefined ? cells[index.gtin]?.replace(/\D/g, "") : undefined;
    rows.push({
      line,
      title,
      cost: index.cost !== undefined ? toNumber(cells[index.cost]) : undefined,
      shipping: index.shipping !== undefined ? toNumber(cells[index.shipping]) : undefined,
      gtin: gtin && gtin.length >= 8 ? gtin : undefined,
      queryUa: index.queryUa !== undefined ? cells[index.queryUa]?.slice(0, 100) || undefined : undefined,
    });
  });

  return { rows, columns: Object.keys(index), warnings };
}

/** Escapes one value for CSV output. */
export function csvCell(value: unknown): string {
  const s = value === undefined || value === null ? "" : String(value);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
