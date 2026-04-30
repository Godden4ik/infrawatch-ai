import "server-only";
import { db } from "./index";
import { sql } from "drizzle-orm";

let migrated = false;

export function ensureMigrated() {
  if (migrated) return;

  db.run(sql`
    CREATE TABLE IF NOT EXISTS provider_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL UNIQUE,
      encrypted_key TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  migrated = true;
}
