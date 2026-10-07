/**
 * Title-based product matching. Unbranded dropshipping goods rarely carry a
 * GTIN, so when there's no barcode we compare normalized title tokens.
 */

const STOPWORDS = new Set([
  "a", "an", "and", "the", "for", "with", "of", "to", "in", "on", "by", "or", "is", "at", "from", "as",
  "new", "hot", "sale", "best", "free", "shipping", "fashion", "creative", "style", "high", "quality",
  "cheap", "wholesale", "dropshipping", "item", "items", "pcs", "pc", "piece", "set", "1pc", "1pcs",
  "multifunctional", "multifunction", "upgraded", "upgrade", "trendy", "popular",
  // common non-English filler words on EU marketplaces
  "und", "mit", "für", "fur", "der", "die", "das", "et", "avec", "pour", "le", "la", "les", "de", "des",
  "con", "per", "il", "di", "y", "para", "el", "en",
]);

export function tokenize(title: string): string[] {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^20\d\d$/.test(t))
    .map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

/** Builds a short marketplace search query from a long supplier title. */
export function buildSearchQuery(title: string, maxTokens = 5): string {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const t of tokenize(title)) {
    if (seen.has(t)) continue;
    seen.add(t);
    tokens.push(t);
    if (tokens.length >= maxTokens) break;
  }
  return tokens.join(" ");
}

/** Share of query tokens that appear in the listing title (0..1). */
export function titleScore(query: string, listingTitle: string): number {
  const q = new Set(tokenize(query));
  if (q.size === 0) return 0;
  const t = new Set(tokenize(listingTitle));
  let hits = 0;
  for (const token of q) if (t.has(token)) hits++;
  return hits / q.size;
}

export type MatchConfidence = "high" | "medium" | "low" | "none";

export interface MatchOutcome<T> {
  matched: (T & { score: number })[];
  confidence: MatchConfidence;
}

/**
 * Keeps listings similar enough to the query. Non-English marketplaces get a
 * lower bar because translated titles share fewer tokens with English queries.
 */
export function matchListings<T extends { title: string }>(
  query: string,
  listings: T[],
  opts: { englishTitles: boolean; byGtin?: boolean },
): MatchOutcome<T> {
  if (listings.length === 0) return { matched: [], confidence: "none" };
  if (opts.byGtin) {
    return { matched: listings.map((l) => ({ ...l, score: 1 })), confidence: "high" };
  }

  const threshold = opts.englishTitles ? 0.6 : 0.34;
  const scored = listings
    .map((l) => ({ ...l, score: titleScore(query, l.title) }))
    .sort((a, b) => b.score - a.score);
  const matched = scored.filter((l) => l.score >= threshold);

  if (matched.length >= 8) return { matched, confidence: "high" };
  if (matched.length >= 3) return { matched, confidence: "medium" };
  // Too few close matches: fall back to the search engine's own relevance, flagged as low confidence.
  return { matched: scored.slice(0, Math.min(10, scored.length)), confidence: "low" };
}
