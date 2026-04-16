import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const providerKeys = sqliteTable("provider_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerId: text("provider_id").notNull().unique(),
  encryptedKey: text("encrypted_key").notNull(),
  iv: text("iv").notNull(), // initialization vector for AES-GCM
  authTag: text("auth_tag").notNull(), // GCM auth tag
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
