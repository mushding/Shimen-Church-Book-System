import { client } from "./db";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
// ponytail: POC applies drizzle-kit SQL files in order (idempotent-ish via IF NOT EXISTS check on first table); Phase 2 uses drizzle-orm/pglite migrator or real migrations
export async function migrate() {
  const dir = new URL("../drizzle/", import.meta.url).pathname;
  const exists = await client.query(`select 1 from information_schema.tables where table_name='user'`);
  if (exists.rows.length) return;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(dir, f), "utf8").split("--> statement-breakpoint").join(";\n");
    await client.exec(sql);
  }
}
