import "server-only";

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export const env = {
  appUrl: read("APP_URL") ?? "http://localhost:3000",
  isProduction: process.env.NODE_ENV === "production",

  cjApiKey: read("CJ_API_KEY"),

  ebayClientId: read("EBAY_CLIENT_ID"),
  ebayClientSecret: read("EBAY_CLIENT_SECRET"),
  ebayEnvironment: read("EBAY_ENV") === "sandbox" ? "sandbox" : "production",

  serpApiKey: read("SERPAPI_KEY"),

  stripeSecretKey: read("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: read("STRIPE_WEBHOOK_SECRET"),
  stripePriceStarter: read("STRIPE_PRICE_STARTER"),
  stripePricePro: read("STRIPE_PRICE_PRO"),

  liqpayPublicKey: read("LIQPAY_PUBLIC_KEY"),
  liqpayPrivateKey: read("LIQPAY_PRIVATE_KEY"),

  monobankToken: read("MONOBANK_TOKEN"),

  // Free key from the Nova Poshta business cabinet (Settings → Security → API 2.0) for exact domestic prices.
  novaPoshtaApiKey: read("NOVAPOSHTA_API_KEY"),

  // Shown on the policy and contacts pages (payment providers require them).
  legalCompany: read("LEGAL_COMPANY_NAME") ?? "[Company / FOP full name]",
  legalEmail: read("LEGAL_EMAIL") ?? "[support email]",
  legalAddress: read("LEGAL_ADDRESS") ?? "[registered address]",
  legalTaxId: read("LEGAL_TAX_ID") ?? "[tax ID / EDRPOU]",
} as const;

/** Which integrations run on real APIs vs. generated demo data. */
export const dataSources = {
  suppliersLive: Boolean(env.cjApiKey),
  marketsLive: Boolean(env.ebayClientId && env.ebayClientSecret),
  googleShoppingLive: Boolean(env.serpApiKey),
  billingLive: Boolean(env.stripeSecretKey),
  liqpayLive: Boolean(env.liqpayPublicKey && env.liqpayPrivateKey),
  monobankLive: Boolean(env.monobankToken),
};
