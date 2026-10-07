const TEMPLATE = [
  "name,cost,shipping,ean,query_ua",
  "Portable mini handheld fan,3.20,,,портативний вентилятор",
  "LED strip lights 5m,4.10,2.50,,світлодіодна стрічка 5м",
  "Magnetic phone car mount,,,,",
].join("\r\n");

export function GET() {
  return new Response("﻿" + TEMPLATE + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dropio-products-template.csv"',
    },
  });
}
