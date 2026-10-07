import { describe, expect, it } from "vitest";
import { maxDays, pickShipping } from "@/lib/pricing/shipping";

const options = [
  { costUsd: 3, method: "Economy", days: "15-25", estimated: false },
  { costUsd: 5, method: "Standard", days: "8-12", estimated: false },
  { costUsd: 12, method: "Express", days: "3-5", estimated: false },
];

describe("pickShipping", () => {
  it("parses delivery windows", () => {
    expect(maxDays("7-12")).toBe(12);
    expect(maxDays("5")).toBe(5);
    expect(maxDays(undefined)).toBe(Infinity);
  });

  it("selects by preference", () => {
    expect(pickShipping(options, "cheapest")?.method).toBe("Economy");
    expect(pickShipping(options, "fastest")?.method).toBe("Express");
    expect(pickShipping(options, "balanced")?.method).toBe("Standard");
  });

  it("falls back to cheapest when nothing is fast enough, and handles no options", () => {
    expect(pickShipping([options[0]], "balanced")?.method).toBe("Economy");
    expect(pickShipping([], "cheapest")).toBeNull();
  });
});
