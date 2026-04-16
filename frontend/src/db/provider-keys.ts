import "server-only";
import { db } from "./index";
import { providerKeys } from "./schema";
import { encrypt, decrypt } from "./crypto";
import { ensureMigrated } from "./migrate";
import { eq } from "drizzle-orm";

export function saveProviderKey(providerId: string, apiKey: string) {
  ensureMigrated();
  const { encrypted, iv, authTag } = encrypt(apiKey);

  // Upsert — update if exists, insert if not
  const existing = db
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.providerId, providerId))
    .get();

  if (existing) {
    db.update(providerKeys)
      .set({ encryptedKey: encrypted, iv, authTag, updatedAt: new Date() })
      .where(eq(providerKeys.providerId, providerId))
      .run();
  } else {
    db.insert(providerKeys)
      .values({ providerId, encryptedKey: encrypted, iv, authTag })
      .run();
  }
}

export function getProviderKey(providerId: string): string | null {
  ensureMigrated();
  const row = db
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.providerId, providerId))
    .get();
  if (!row) return null;
  return decrypt(row.encryptedKey, row.iv, row.authTag);
}

export function hasProviderKey(providerId: string): boolean {
  ensureMigrated();
  const row = db
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.providerId, providerId))
    .get();
  return !!row;
}

export function deleteProviderKey(providerId: string) {
  ensureMigrated();
  db.delete(providerKeys).where(eq(providerKeys.providerId, providerId)).run();
}

export function listProviderKeyStatus(): Array<{
  providerId: string;
  hasKey: boolean;
  updatedAt: Date;
}> {
  ensureMigrated();
  const rows = db
    .select({
      providerId: providerKeys.providerId,
      updatedAt: providerKeys.updatedAt,
    })
    .from(providerKeys)
    .all();

  return rows.map((r) => ({
    providerId: r.providerId,
    hasKey: true,
    updatedAt: r.updatedAt,
  }));
}

export function getMaskedKey(providerId: string): string | null {
  const key = getProviderKey(providerId);
  if (!key) return null;
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}
