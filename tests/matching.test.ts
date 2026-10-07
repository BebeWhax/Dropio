import { describe, expect, it } from "vitest";
import { buildSearchQuery, matchListings, titleScore, tokenize } from "@/lib/pricing/matching";
import { parseCjPrice } from "@/lib/providers/cj";

describe("matching", () => {
  it("normalizes titles and strips filler words", () => {
    expect(tokenize("NEW Hot Sale 2025 Portable Mini Fans for Home!")).toEqual(["portable", "mini", "fan", "home"]);
  });

  it("builds a short query from a long supplier title", () => {
    expect(buildSearchQuery("Portable Mini Handheld Fan USB Rechargeable Desk Fan For Home Office")).toBe(
      "portable mini handheld fan usb",
    );
  });

  it("scores by share of query tokens present", () => {
    expect(titleScore("mini handheld fan", "Mini Handheld Fan USB Rechargeable")).toBe(1);
    expect(titleScore("mini handheld fan", "Handheld vacuum cleaner")).toBeCloseTo(1 / 3);
  });

  it("rates confidence by the number of close matches", () => {
    const close = Array.from({ length: 9 }, (_, i) => ({ title: `Mini handheld fan model ${i}` }));
    expect(matchListings("mini handheld fan", close, { englishTitles: true }).confidence).toBe("high");

    const unrelated = [{ title: "Garden hose" }, { title: "Phone case" }];
    const outcome = matchListings("mini handheld fan", unrelated, { englishTitles: true });
    expect(outcome.confidence).toBe("low");
    expect(matchListings("x", [], { englishTitles: true }).confidence).toBe("none");
  });

  it("treats GTIN matches as high confidence", () => {
    expect(matchListings("anything", [{ title: "Totally different" }], { englishTitles: true, byGtin: true }).confidence).toBe("high");
  });
});

describe("parseCjPrice", () => {
  it("parses single values, ranges and numbers", () => {
    expect(parseCjPrice("11.85")).toEqual({ min: 11.85, max: 11.85 });
    expect(parseCjPrice("1.20 -- 3.40")).toEqual({ min: 1.2, max: 3.4 });
    expect(parseCjPrice(4)).toEqual({ min: 4, max: 4 });
    expect(parseCjPrice("")).toBeNull();
    expect(parseCjPrice(undefined)).toBeNull();
  });
});

describe("detectCurrency (Google Shopping prices)", async () => {
  const { detectCurrency } = await import("@/lib/providers/serpapi");
  it("recognizes hryvnia and other currencies", () => {
    expect(detectCurrency("1 299,00 ₴")).toBe("UAH");
    expect(detectCurrency("450 грн")).toBe("UAH");
    expect(detectCurrency("$12.99")).toBe("USD");
    expect(detectCurrency("12,99 €")).toBe("EUR");
    expect(detectCurrency("12.99")).toBeNull();
  });
});

describe("LiqPay signature", async () => {
  const { liqpaySignature, decodeLiqpayCallback } = await import("@/lib/billing/liqpay-sign");
  // Worked example from LiqPay's API v7 docs (public sample keys).
  const privateKey = "a4825234f4bae72a0be04eafe9e8e2bada209255";
  const data =
    "eyJwdWJsaWNfa2V5IjoiaTAwMDAwMDAwIiwidmVyc2lvbiI6NywiYWN0aW9uIjoicGF5IiwiYW1vdW50IjoiMyIsImN1cnJlbmN5IjoiVUFIIiwiZGVzY3JpcHRpb24iOiJ0ZXN0Iiwib3JkZXJfaWQiOiIwMDAwMDEifQ==";

  it("matches the documented sha3-256 signature", () => {
    expect(liqpaySignature(privateKey, data)).toBe("0adgJ8F2Ds5HCVkcz4AlmdLMRoIJf7IxsL3QmeFRz/s=");
  });

  it("decodes genuine callbacks and rejects forged ones", () => {
    expect(decodeLiqpayCallback(privateKey, data, "0adgJ8F2Ds5HCVkcz4AlmdLMRoIJf7IxsL3QmeFRz/s=")?.order_id).toBe("000001");
    expect(decodeLiqpayCallback(privateKey, data, "forged")).toBeNull();
  });
});

describe("deriveQueryFromTitles", async () => {
  const { deriveQueryFromTitles } = await import("@/lib/pricing/matching");
  it("keeps words shared by several matched titles", () => {
    expect(
      deriveQueryFromTitles([
        "Portable Mini Handheld Fan USB Rechargeable",
        "Mini handheld fan, 3 speeds, pink",
        "USB handheld fan for travel",
        "Desk lamp LED",
      ]),
    ).toBe("mini handheld fan usb");
  });
});

describe("lensCurrency", async () => {
  const { lensCurrency } = await import("@/lib/providers/serpapi");
  it("maps symbols to ISO codes, reading $ as the searched country's dollar", () => {
    expect(lensCurrency("$", "CAD")).toBe("CAD");
    expect(lensCurrency("$", "EUR")).toBe("USD");
    expect(lensCurrency("₴", "UAH")).toBe("UAH");
    expect(lensCurrency("€", "USD")).toBe("EUR");
    expect(lensCurrency(undefined, "USD")).toBeNull();
  });
});
