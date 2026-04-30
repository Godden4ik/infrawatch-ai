import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { resolve } from "path";
import { mkdirSync } from "fs";

const DB_PATH = resolve(process.cwd(), "..", "data", "infrawatch.db");

// Ensure data directory exists
mkdirSync(resolve(process.cwd(), "..", "data"), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
