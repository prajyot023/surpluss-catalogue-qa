// Client-safe helpers for the product import dialog: column mapping, sample
// sheet and row validation. Extracted from the old import wizard.

import { PRODUCT_NAME_MAX_LENGTH } from "@/lib/schemas/product";

export type FieldKey =
  | "sku"
  | "name"
  | "brand"
  | "category"
  | "offerPrice"
  | "mrp"
  | "quantity"
  | "moq"
  | "description"
  | "imageUrl"
  | "attribute"
  | "ignore";

export const FIELDS: { key: FieldKey; label: string; required?: boolean }[] = [
  { key: "sku", label: "SKU / product code", required: true },
  { key: "name", label: "Product name", required: true },
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  { key: "offerPrice", label: "Offer price" },
  { key: "mrp", label: "MRP" },
  { key: "quantity", label: "Available quantity", required: true },
  { key: "moq", label: "MOQ" },
  { key: "description", label: "Description" },
  { key: "imageUrl", label: "Image URL" },
  { key: "attribute", label: "Custom attribute" },
  { key: "ignore", label: "Do not import" },
];

export const FIELD_LABELS = Object.fromEntries(FIELDS.map((field) => [field.key, field.label]));

export const SYNONYMS: Record<Exclude<FieldKey, "attribute" | "ignore">, string[]> = {
  sku: ["sku", "productcode", "itemcode", "code", "article"],
  name: ["name", "itemname", "productname", "title", "product"],
  brand: ["brand", "make", "manufacturer"],
  category: ["category", "segment", "type", "group"],
  offerPrice: ["offerprice", "landingprice", "sellingprice", "saleprice", "price", "offer"],
  mrp: ["mrp", "listprice", "retailprice", "maximumretailprice"],
  quantity: ["availablequantity", "available", "quantity", "qty", "stock", "units"],
  moq: ["moq", "minqty", "minimumorder", "minorderqty", "minimum"],
  description: ["description", "details", "about"],
  imageUrl: ["imageurl", "image", "photo", "picture", "imagelink"],
};

export function autoMap(headers: string[]): Record<string, FieldKey> {
  const mapping: Record<string, FieldKey> = {};
  const used = new Set<FieldKey>();
  for (const header of headers) {
    const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    let match: FieldKey = "attribute";
    for (const [field, keys] of Object.entries(SYNONYMS) as [FieldKey, string[]][]) {
      if (used.has(field)) continue;
      if (keys.some((key) => normalized === key || normalized.includes(key))) {
        match = field;
        break;
      }
    }
    if (match !== "attribute") used.add(match);
    mapping[header] = match;
  }
  return mapping;
}

export const SAMPLE_SHEET: string[][] = [
  ["SKU", "Product Name", "Brand", "Category", "MRP", "Offer Price", "Available Quantity", "MOQ", "Description"],
  ["TRV-1024", "Atlas cabin trolley 55cm", "Aristocrat", "Travel", "5999", "2499", "480", "10", "Hard-shell cabin trolley with TSA lock"],
  ["HYD-2210", "Steel vacuum bottle 1L", "Milton", "Drinkware", "1299", "549", "1200", "25", "Double-wall insulated bottle, 24h cold"],
];

export function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[₹,$€\s,]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export type ParsedFile = { name: string; sizeKB: number; headers: string[]; rows: Record<string, string>[] };
export type RowIssue = { row: number; message: string; blocking: boolean };

export type ImportRow = {
  sku: string;
  name: string;
  brand?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  offerPrice?: number;
  mrp?: number;
  quantity: number;
  moq?: number;
  attributes?: Record<string, string>;
};

export type ValidationResult = {
  rows: ImportRow[];
  issues: RowIssue[];
  warnings: number;
  missingPrices: number;
};

export function validateRows(file: ParsedFile, mapping: Record<string, FieldKey>): ValidationResult {
  const headerFor = (field: FieldKey) => Object.entries(mapping).find(([, value]) => value === field)?.[0];
  const attributeHeaders = Object.entries(mapping)
    .filter(([, value]) => value === "attribute")
    .map(([header]) => header);
  const skuHeader = headerFor("sku");
  const nameHeader = headerFor("name");
  const quantityHeader = headerFor("quantity");

  const issues: RowIssue[] = [];
  const rows: ImportRow[] = [];
  const seenSkus = new Set<string>();
  let warnings = 0;
  let missingPrices = 0;

  file.rows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const sku = skuHeader ? raw[skuHeader]?.trim() : "";
    const name = nameHeader ? raw[nameHeader]?.trim() : "";
    const quantity = parseNumber(quantityHeader ? raw[quantityHeader] : undefined);

    if (!sku) {
      issues.push({ row: rowNumber, message: "The SKU is missing", blocking: true });
      return;
    }
    if (seenSkus.has(sku)) {
      issues.push({ row: rowNumber, message: `SKU ${sku} appears more than once in the sheet`, blocking: true });
      return;
    }
    if (!name) {
      issues.push({ row: rowNumber, message: `The product name is missing (SKU ${sku})`, blocking: true });
      return;
    }
    if (quantity === null || quantity < 0 || !Number.isInteger(quantity)) {
      issues.push({ row: rowNumber, message: `The available quantity is not a whole number (SKU ${sku})`, blocking: true });
      return;
    }
    seenSkus.add(sku);

    const readText = (field: FieldKey, max: number) => {
      const header = headerFor(field);
      const value = header ? raw[header]?.trim() : "";
      return value ? value.slice(0, max) : undefined;
    };
    const readNumber = (field: FieldKey) => {
      const header = headerFor(field);
      const value = parseNumber(header ? raw[header] : undefined);
      return value !== null && value >= 0 ? value : undefined;
    };

    let imageUrl = readText("imageUrl", 500);
    if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
      issues.push({
        row: rowNumber,
        message: `The image link was skipped because it must start with https:// (SKU ${sku})`,
        blocking: false,
      });
      warnings += 1;
      imageUrl = undefined;
    }
    const moqRaw = readNumber("moq");
    const moq = moqRaw && Number.isInteger(moqRaw) && moqRaw > 0 ? moqRaw : undefined;

    const attributes: Record<string, string> = {};
    for (const header of attributeHeaders) {
      const value = raw[header]?.trim();
      if (value) attributes[header] = value.slice(0, 300);
    }

    const offerPrice = readNumber("offerPrice");
    const mrp = readNumber("mrp");
    if (offerPrice === undefined || mrp === undefined) missingPrices += 1;

    rows.push({
      sku: sku.slice(0, 60),
      name: name.slice(0, PRODUCT_NAME_MAX_LENGTH),
      brand: readText("brand", 80),
      category: readText("category", 80),
      description: readText("description", 2000),
      imageUrl,
      offerPrice,
      mrp,
      quantity,
      moq,
      attributes: Object.keys(attributes).length ? attributes : undefined,
    });
  });

  return { rows, issues, warnings, missingPrices };
}
