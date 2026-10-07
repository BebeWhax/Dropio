import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, parseProductCsv } from "@/lib/bulk/csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and BOM", () => {
    expect(parseCsv('﻿name,cost\r\n"Fan, mini",3.5\r\n"Say ""hi""",1\r\n')).toEqual([
      ["name", "cost"],
      ["Fan, mini", "3.5"],
      ['Say "hi"', "1"],
    ]);
  });

  it("detects semicolon-separated Excel exports", () => {
    expect(parseCsv("назва;ціна\nЛампа;4,20")).toEqual([
      ["назва", "ціна"],
      ["Лампа", "4,20"],
    ]);
  });
});

describe("parseProductCsv", () => {
  it("maps known headers (English and Ukrainian) and parses numbers", () => {
    const r = parseProductCsv("Product Name;Cost;Shipping;EAN\nLED strip 5m;3,90;2.1;4006381333931\nPhone holder;;;");
    expect(r.rows).toEqual([
      { line: 2, title: "LED strip 5m", cost: 3.9, shipping: 2.1, gtin: "4006381333931", queryUa: undefined },
      { line: 3, title: "Phone holder", cost: undefined, shipping: undefined, gtin: undefined, queryUa: undefined },
    ]);
  });

  it("treats a headerless file as name[,cost]", () => {
    const r = parseProductCsv("Pet hair remover,4.5\nMagnetic phone mount");
    expect(r.rows.map((x) => [x.title, x.cost])).toEqual([
      ["Pet hair remover", 4.5],
      ["Magnetic phone mount", undefined],
    ]);
  });

  it("skips rows without a name and warns", () => {
    const r = parseProductCsv("name,cost\n,3\nLamp,2");
    expect(r.rows).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/Line 2/);
  });

  it("escapes output cells", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell(3.5)).toBe("3.5");
  });
});
