import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema.auth";

// ponytail: pglite (embedded Postgres) for POC — swap to drizzle-orm/node-postgres + real PG in Phase 2
export const client = new PGlite(process.env.PGLITE_DIR ?? "./.pglite");
export const db = drizzle(client, { schema });
