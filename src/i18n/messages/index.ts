import type { Locale } from "../config";
import { app } from "./app";
import { data } from "./data";
import { shell } from "./shell";
import { site } from "./site";

// Each file holds one area's messages in both languages; the Ukrainian object is
// typed against the English one, so a missing translation is a type error.
const parts = [shell, site, data, app] as const;

type Merge<T extends readonly { en: object }[]> = T extends readonly [infer H extends { en: object }, ...infer R extends { en: object }[]]
  ? H["en"] & Merge<R>
  : unknown;

export type Messages = Merge<typeof parts>;

function build(locale: Locale): Messages {
  return Object.assign({}, ...parts.map((p) => p[locale])) as Messages;
}

export const messages: Record<Locale, Messages> = { en: build("en"), uk: build("uk") };
