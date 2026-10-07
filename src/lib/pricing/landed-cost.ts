import type { CostAssumptions } from "@/lib/markets";
import type { ImportCharges } from "./duty";

/** Who pays import duty/VAT/fees on delivery: the seller (DDP) or the buyer (DDU). */
export type ImportPayer = "seller" | "buyer";

export interface LandedCostInput {
  /** What the buyer pays on the marketplace (item + shipping), in USD. */
  sellPriceUsd: number;
  supplierCostUsd: number;
  shippingUsd: number;
  importCharges: ImportCharges;
  importPayer: ImportPayer;
  assumptions: CostAssumptions;
  /** USD per 1 unit of the market currency, for the fixed fees. */
  marketToUsd: number;
}

export interface LandedCostBreakdown {
  sellPriceUsd: number;
  vatUsd: number;
  netRevenueUsd: number;
  supplierCostUsd: number;
  shippingUsd: number;
  dutyUsd: number;
  importVatUsd: number;
  importFeesUsd: number;
  /** Duty + import VAT + fees; counted in costs only when the seller pays them. */
  importChargesUsd: number;
  importPaidByBuyer: boolean;
  marketplaceFeeUsd: number;
  turnoverTaxUsd: number;
  /** Everything the seller pays: goods, shipping, import charges (if DDP), fees and turnover tax. */
  totalCostUsd: number;
  profitUsd: number;
  /** Profit as a share of revenue after VAT. */
  marginPct: number;
  /** Profit relative to cash spent on the goods (supplier + shipping + seller-paid import charges). */
  roiPct: number;
  /** Buyer price (USD) at which profit is zero. */
  breakEvenPriceUsd: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function calculateLandedCost(input: LandedCostInput): LandedCostBreakdown {
  const { sellPriceUsd, supplierCostUsd, shippingUsd, importCharges, assumptions: a, marketToUsd } = input;

  // Where VAT is included in the listing price the seller/marketplace remits it, so it isn't revenue.
  const netRevenueUsd = sellPriceUsd / (1 + a.vatRate);
  const vatUsd = sellPriceUsd - netRevenueUsd;

  const importPaidByBuyer = input.importPayer === "buyer";
  const sellerImportUsd = importPaidByBuyer ? 0 : importCharges.totalUsd;

  // Marketplaces charge commission on the buyer's total including tax.
  const fixedFeeUsd = a.fixedFee * marketToUsd;
  const marketplaceFeeUsd = sellPriceUsd * a.feeRate + fixedFeeUsd;
  const turnoverTaxUsd = sellPriceUsd * a.turnoverTaxRate;

  const goodsCostUsd = supplierCostUsd + shippingUsd + sellerImportUsd;
  const totalCostUsd = goodsCostUsd + marketplaceFeeUsd + turnoverTaxUsd;
  const profitUsd = netRevenueUsd - totalCostUsd;

  // Solve price/(1+vat) − price·(fee + turnoverTax) − fixedFee − goodsCost = 0 for price.
  const keptPerDollar = 1 / (1 + a.vatRate) - a.feeRate - a.turnoverTaxRate;
  const breakEvenPriceUsd = keptPerDollar > 0 ? (goodsCostUsd + fixedFeeUsd) / keptPerDollar : Infinity;

  return {
    sellPriceUsd: round(sellPriceUsd),
    vatUsd: round(vatUsd),
    netRevenueUsd: round(netRevenueUsd),
    supplierCostUsd: round(supplierCostUsd),
    shippingUsd: round(shippingUsd),
    dutyUsd: importCharges.dutyUsd,
    importVatUsd: importCharges.importVatUsd,
    importFeesUsd: importCharges.feesUsd,
    importChargesUsd: importCharges.totalUsd,
    importPaidByBuyer,
    marketplaceFeeUsd: round(marketplaceFeeUsd),
    turnoverTaxUsd: round(turnoverTaxUsd),
    totalCostUsd: round(totalCostUsd),
    profitUsd: round(profitUsd),
    marginPct: netRevenueUsd > 0 ? round((profitUsd / netRevenueUsd) * 100) : 0,
    roiPct: goodsCostUsd > 0 ? round((profitUsd / goodsCostUsd) * 100) : 0,
    breakEvenPriceUsd: round(breakEvenPriceUsd),
  };
}

/** Rough CN → destination shipping when no carrier quote is available. */
export function estimateShippingUsd(weightGrams: number | undefined, country: string): number {
  const grams = weightGrams && weightGrams > 0 ? weightGrams : 250;
  const base = country === "AU" ? 3.5 : country === "US" || country === "CA" ? 3 : country === "UA" ? 2.5 : 2.8;
  return round(base + (grams / 100) * 0.95);
}
