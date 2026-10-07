"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { runImageSearch } from "@/lib/image-search";
import { isCountryCode } from "@/lib/markets";
import { effectivePlan } from "@/lib/plans";
import { consumeQuota, QuotaExceededError } from "@/lib/usage";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";

export interface ImageSearchState {
  error?: string;
}

const MAX_IMAGE_BYTES = 5_000_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function searchByImage(_prev: ImageSearchState, formData: FormData): Promise<ImageSearchState> {
  const user = await requireUser();
  const plan = effectivePlan(user);
  const messages = await getMessages();
  const t = messages.image;

  const image = formData.get("image");
  if (!(image instanceof Blob) || image.size === 0) return { error: t.errNoImage };
  if (image.size > MAX_IMAGE_BYTES) return { error: t.errTooBig };
  if (!ALLOWED_TYPES.has(image.type)) return { error: t.errType };

  const country = String(formData.get("country") ?? "US");
  if (!isCountryCode(country)) return { error: t.errCountry };
  const hint = String(formData.get("hint") ?? "").trim().slice(0, 100) || undefined;
  const fileName = String(formData.get("fileName") ?? "image").slice(0, 120);

  const bytes = Buffer.from(await image.arrayBuffer());
  const ref = createHash("sha256").update(bytes).update(`|${country}|${hint ?? ""}`).digest("hex").slice(0, 24);
  try {
    await consumeQuota(user.id, plan, "image", ref);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return { error: fmt(messages.common.quotaReached, { kind: messages.common.quotaKinds[err.kind], limit: err.limit }) };
    }
    throw err;
  }

  const search = await db.imageSearch.create({
    data: {
      userId: user.id,
      publicToken: randomBytes(24).toString("base64url"),
      imageMime: image.type,
      imageData: bytes,
      country,
      hint,
    },
  });

  const result = await runImageSearch({
    image: bytes,
    mime: image.type,
    publicUrl: `${env.appUrl}/api/img/${search.publicToken}`,
    fileName,
    country,
    hint,
  });
  await db.imageSearch.update({ where: { id: search.id }, data: { result: JSON.stringify(result) } });
  redirect(`/dashboard/image/${search.id}`);
}

export async function deleteImageSearch(formData: FormData): Promise<void> {
  const user = await requireUser();
  await db.imageSearch.deleteMany({ where: { id: String(formData.get("id") ?? ""), userId: user.id } });
  redirect("/dashboard/image");
}
