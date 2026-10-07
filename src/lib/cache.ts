import "server-only";
import { db } from "@/lib/db";

/**
 * Read-through cache for third-party API calls, stored in the database so it
 * survives restarts and is shared by all users (and their quotas).
 */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const hit = await getCache<T>(key);
  if (hit !== null) return hit;
  const value = await load();
  await setCache(key, value, ttlSeconds);
  return value;
}

export async function getCache<T>(key: string): Promise<T | null> {
  const hit = await db.apiCache.findUnique({ where: { key } });
  return hit && hit.expiresAt > new Date() ? (JSON.parse(hit.value) as T) : null;
}

export async function setCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const serialized = JSON.stringify(value);
  await db.apiCache.upsert({
    where: { key },
    create: { key, value: serialized, expiresAt },
    update: { value: serialized, expiresAt },
  });
}
