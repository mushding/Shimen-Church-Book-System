import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db";

const migrationsFolder = new URL("../drizzle/", import.meta.url).pathname;
export async function migrate() {
  if (process.env.DATABASE_URL) await migratePg(db as any, { migrationsFolder });
  else await migratePglite(db as any, { migrationsFolder });
}
