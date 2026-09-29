import { describe, expect, it } from "vitest";
import { autoMap, parseNumber, SAMPLE_SHEET, validateRows, type FieldKey, type ParsedFile } from "@/lib/import-mapping";

// The spreadsheet import writes straight into the shared product library that
// every catalogue reads prices and stock from. A column mapped to the wrong
// field means wrong prices or wrong stock on every catalogue listing that SKU.

function sheet(headers: string[], ...rows: string[][]): ParsedFile {
  return {
    name: "test.csv",
    sizeKB: 1,
    headers,
    rows: rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))),
  };
}

const STANDARD_MAPPING: Record<string, FieldKey> = {
  SKU: "sku",
  Name: "name",
  MRP: "mrp",
  "Offer Price": "offerPrice",
  Qty: "quantity",
  MOQ: "moq",
  Image: "imageUrl",
};
const STANDARD_HEADERS = Object.keys(STANDARD_MAPPING);

describe("autoMap (guessing which column is which)", () => {
  it("maps our own sample sheet's headers correctly", () => {
    expect(autoMap(SAMPLE_SHEET[0])).toEqual({
      SKU: "sku",
      "Product Name": "name",
      Brand: "brand",
      Category: "category",
      MRP: "mrp",
      "Offer Price": "offerPrice",
      "Available Quantity": "quantity",
      MOQ: "moq",
      Description: "description",
    });
  });

  // BUG: fails today. "List Price" contains "price", which is checked as an
  // offer-price synonym before "listprice" is checked as an MRP synonym.
  it("maps a 'List Price' column to MRP, not to offer price", () => {
    const mapping = autoMap(["SKU", "Product Name", "List Price", "Selling Price", "Qty"]);
    expect(mapping["List Price"]).toBe("mrp");
    expect(mapping["Selling Price"]).toBe("offerPrice");
  });

  // BUG: fails today. "Min Order Qty" contains "qty", so it grabs the stock
  // field first and the real stock column is left as a custom attribute.
  it("maps 'Min Order Qty' to MOQ even when it comes before the stock column", () => {
    const mapping = autoMap(["SKU", "Product Name", "Min Order Qty", "Available Qty"]);
    expect(mapping["Min Order Qty"]).toBe("moq");
    expect(mapping["Available Qty"]).toBe("quantity");
  });
});

describe("parseNumber (reading prices and quantities from messy cells)", () => {
  it("reads Indian-grouped rupee amounts", () => {
    expect(parseNumber("₹1,20,000")).toBe(120000);
    expect(parseNumber(" 2,499.50 ")).toBe(2499.5);
  });

  it("returns null for blank or non-numeric cells instead of 0", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber("N/A")).toBeNull();
  });
});

describe("validateRows (the report shown before an import is committed)", () => {
  it("accepts a clean row and carries its numbers through", () => {
    const result = validateRows(
      sheet(STANDARD_HEADERS, ["SKU-1", "Steel bottle", "1,299", "549", "1,200", "25", "https://img.test/a.png"]),
      STANDARD_MAPPING,
    );
    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({ sku: "SKU-1", name: "Steel bottle", mrp: 1299, offerPrice: 549, quantity: 1200, moq: 25, imageUrl: "https://img.test/a.png" }),
    ]);
  });

  it("blocks rows with no SKU, no name, or a stock figure that is not a whole number", () => {
    const result = validateRows(
      sheet(
        STANDARD_HEADERS,
        ["", "No SKU", "100", "80", "10", "1", ""],
        ["SKU-2", "", "100", "80", "10", "1", ""],
        ["SKU-3", "Half unit", "100", "80", "2.5", "1", ""],
        ["SKU-4", "Negative stock", "100", "80", "-5", "1", ""],
        ["SKU-5", "Words for stock", "100", "80", "lots", "1", ""],
      ),
      STANDARD_MAPPING,
    );
    expect(result.rows).toEqual([]);
    expect(result.issues.map((issue) => [issue.row, issue.blocking])).toEqual([
      [2, true],
      [3, true],
      [4, true],
      [5, true],
      [6, true],
    ]);
  });

  it("imports only the first copy of a duplicated SKU and blocks the second", () => {
    const result = validateRows(
      sheet(STANDARD_HEADERS, ["DUP-1", "First", "100", "80", "10", "1", ""], ["DUP-1", "Second", "90", "70", "5", "1", ""]),
      STANDARD_MAPPING,
    );
    expect(result.rows.map((row) => row.name)).toEqual(["First"]);
    expect(result.issues).toEqual([expect.objectContaining({ row: 3, blocking: true })]);
  });

  it("drops a non-https image link with a warning, but still imports the row", () => {
    const result = validateRows(
      sheet(STANDARD_HEADERS, ["IMG-1", "Lamp", "100", "80", "10", "1", "http://insecure.test/a.png"]),
      STANDARD_MAPPING,
    );
    expect(result.rows[0].imageUrl).toBeUndefined();
    expect(result.warnings).toBe(1);
    expect(result.issues).toEqual([expect.objectContaining({ blocking: false })]);
  });

  it("counts a row with a blank price as missing prices (so it cannot be published yet)", () => {
    const result = validateRows(sheet(STANDARD_HEADERS, ["P-1", "Lamp", "", "80", "10", "1", ""]), STANDARD_MAPPING);
    expect(result.rows[0].mrp).toBeUndefined();
    expect(result.missingPrices).toBe(1);
  });

  // BUG (lower confidence): fails today. The README says seller sheets contain
  // prices like "₹1,20,000 / piece". Today that cell is silently dropped and
  // the report says the product "doesn't have a price yet", when it did.
  // Either reading the number or warning about that row would pass.
  it("does not silently drop a price written as '₹1,20,000 / piece'", () => {
    const result = validateRows(
      sheet(STANDARD_HEADERS, ["TV-43", "Samsung 43in LED TV", "₹1,50,000 / piece", "₹1,20,000 / piece", "20", "1", ""]),
      STANDARD_MAPPING,
    );
    const readThePrice = result.rows[0]?.offerPrice === 120000;
    const warnedAboutIt = result.issues.some((issue) => issue.row === 2 && /price/i.test(issue.message));
    expect(readThePrice || warnedAboutIt).toBe(true);
  });
});
