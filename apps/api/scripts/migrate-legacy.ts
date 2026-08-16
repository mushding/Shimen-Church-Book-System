// usage: pnpm migrate:legacy path/to/dump.sql   (DATABASE_URL or pglite per src/db.ts)
import { readFileSync } from "node:fs";
import { db } from "../src/db";
import { migrate } from "../src/migrate";
import { seed } from "../src/seed";
import { migrateLegacy } from "../src/legacy";

const file = process.argv[2];
if (!file) { console.error("usage: migrate-legacy <dump.sql>"); process.exit(1); }
await migrate(); await seed();
await migrateLegacy(db, readFileSync(file, "utf8"));
process.exit(0);
