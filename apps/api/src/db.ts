import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";

// DATABASE_URL set → real Postgres (prod / local brew PG); else pglite embedded (dev, data in ./.pglite)
export const db = process.env.DATABASE_URL
  ? drizzlePg(process.env.DATABASE_URL, { schema })
  : drizzlePglite(new PGlite(process.env.PGLITE_DIR ?? "./.pglite"), { schema });
export type Db = typeof db;
