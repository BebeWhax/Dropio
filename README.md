# Dropio

Subscription platform for dropshippers. Users search supplier products, compare them against real marketplace prices in up to 8 countries, and see the margin left after shipping, import duty, VAT and marketplace fees.

## Stack

- **Next.js 16** (App Router, Cache Components) + **TypeScript** + **Tailwind CSS 4**
- **Prisma 6**: SQLite locally. For production, switch `provider` to `postgresql` in `prisma/schema.prisma` and set `DATABASE_URL`.
- **Stripe**: Checkout, the Customer Portal and webhooks handle subscriptions.
- **Vitest**: tests for the pricing, matching and parsing logic.

## Data sources

| Purpose | Source | File |
|---|---|---|
| Supplier cost, variants, shipping quotes | CJ Dropshipping API v2 | `src/lib/providers/cj.ts` |
| Selling prices per country | eBay Browse API (US, UK, DE, FR, IT, ES, CA, AU) | `src/lib/providers/ebay.ts` |
| Selling prices in Ukraine | Google Shopping via SerpApi (`gl=ua`): Rozetka, Prom, Allo… | `src/lib/providers/serpapi.ts` |
| Currency conversion | Frankfurter (ECB) + National Bank of Ukraine for UAH | `src/lib/providers/fx.ts` |

If an integration has no API keys, it runs on generated **demo data**, and the UI labels that data clearly. Every API response is cached in the database (`ApiCache` table) to protect the free quotas: CJ allows 1 request per second, and eBay allows about 5,000 calls per day.

## Getting started

```bash
npm install
cp .env.example .env      # add API keys when you have them
npm run db:migrate        # creates prisma/dev.db
npm run db:seed           # optional: demo@dropio.test account (password in prisma/seed.mjs)
npm run dev
```

## How an analysis works (`src/lib/analysis.ts`)

1. **Supplier cost.** Takes the CJ variant price, or the cost the user entered for their own product.
2. **Shipping.** Asks CJ's freight calculator for a quote to each country. If that fails, it estimates from the product's weight.
3. **Market price.** Searches eBay in each country, by barcode (EAN/UPC) when there is one, otherwise by keywords.
   - **Matching** (`src/lib/pricing/matching.ts`): titles are scored against the search terms. EU marketplaces get a lower threshold, because their listings are often in other languages.
   - **Statistics** (`src/lib/pricing/stats.ts`): outliers outside 1.5×IQR are dropped, then the median buyer total (item + shipping) is used.
4. **Import charges** (`src/lib/pricing/duty.ts`): each destination's low-value parcel rules as of October 2026, for the chosen product category:
   - **Ukraine:** duty-free up to €150 of goods value (shipping excluded); above that, 10% duty plus 20% VAT on the excess.
   - **EU:** €3 flat duty per tariff line since 1 July 2026, plus a €2 handling fee from 1 November 2026.
   - **US:** no de minimis; MFN + Section 301 + the 12.5% forced-labor tariff.
   - **UK, Canada, Australia:** their own thresholds, with GST and Canada Post fees for Canada.

   You also choose who pays the charges: you (DDP) or the buyer on delivery (DDU).
   The standalone **Duty calculator** page (`/dashboard/duty`) shows the same rules for all 9 markets at once.
5. **Shipping options** (`src/lib/pricing/shipping.ts`): every CJ carrier is kept, and the one used is Cheapest, Best value (≤ 15 days) or Fastest.
6. **Landed cost** (`src/lib/pricing/landed-cost.ts`):
   - VAT included in the price is removed.
   - Import charges are deducted when you pay them (DDP).
   - Turnover tax is deducted (5% for a Ukrainian FOP group 3 seller).
   - Marketplace fees are calculated on the buyer's total.
   - The result is profit, margin, ROI and break-even price.

Default tax and fee rates live in `src/lib/markets.ts`, and category duty rates in `src/lib/pricing/duty.ts`. Both are **estimates**: the exact HS code decides the real rate. Paid users can override them per country on the Cost settings page.

Two rule changes are coming:
- Ukraine's bills 15460/16051-1 would charge VAT from the first euro, from July 2027 at the earliest.
- UK duty relief under £135 ends by October 2028.

Update `duty.ts` when they take effect.

## Subscriptions

Plans and their limits are defined in `src/lib/plans.ts`: Free, Starter ($19) and Pro ($49). Each plan sets:

- searches and analyses per day
- how many countries one analysis can compare
- how many products can be saved

Usage is counted in `UsageEvent`. Reloading the same request on the same day doesn't count again.

Users choose how to pay on the billing page. Each paid plan has a USD price for Stripe and a fixed UAH price (`priceUah`) for LiqPay and monobank. One payment provider is active at a time.

### LiqPay (UAH)

- Uses API v7 and `action: "subscribe"` with monthly periodicity; LiqPay charges the card itself every month.
- Signatures are `base64(sha3-256(private + data + private))`.
- The callback at `/api/billing/liqpay/callback` is verified, then:
  - `subscribed` or `success` activates the plan or extends it by one month
  - `failure` marks it past due
  - `unsubscribed` cancels it; access lasts until the end of the paid period
- Cancelling calls `action: "unsubscribe"`.
- For testing, use the `sandbox_` key pair and test card `4242 4242 4242 4242`.

### monobank (UAH)

- Uses the native subscriptions API (`/api/merchant/subscription/create`, `interval: "1m"`).
- Webhooks arrive at `/api/billing/monobank/webhook`, and the buyer's return goes through `/api/billing/monobank/return`. Both:
  - verify `X-Sign` when it is present (ECDSA with the key from `/api/merchant/pubkey`)
  - then re-read the subscription status from monobank's API, so a forged request can't grant access
- A free test token is available at https://api.monobank.ua/.

LiqPay and monobank both call back to `APP_URL`, so in development expose the app with a tunnel (ngrok or cloudflared) and set `APP_URL` to the tunnel URL.

### Stripe (USD)

To set up Stripe:

1. Create two recurring monthly Prices and put their IDs in `STRIPE_PRICE_STARTER` and `STRIPE_PRICE_PRO`.
2. Add a webhook endpoint pointing to `/api/stripe/webhook` with these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. Turn on the Customer Portal in the Stripe dashboard.

To test the webhook locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Any payment provider without keys works in demo mode in development: upgrades apply instantly without payment. Production refuses demo upgrades.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run db:migrate` / `npm run db:deploy` | Migrations (dev / production) |

## Known limits / next steps

- **eBay prices are asking prices, not sold prices.** Sold-price data needs the Marketplace Insights API, which requires separate approval.
- **Matching uses titles only.** Image similarity would help with unbranded goods.
- **The CJ rate limiter runs in-process.** Running several server instances needs a shared limiter, such as Redis.
- **Google Shopping in Ukraine is untested with live data.** Check result coverage with the SerpApi free tier. If it's thin, the fallback is Apify scrapers for Hotline.ua and Prom.ua, but their terms forbid scraping.
- **More sources to add:** AliExpress (supplier) and Amazon (price, via a scraper or Keepa). Both are adapters behind the `SupplierProvider` / `MarketProvider` interfaces in `src/lib/providers/types.ts`.
