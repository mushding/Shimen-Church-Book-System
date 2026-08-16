// pnpm --filter api set-role <LINE userId U…> <member|staff|admin>
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { account, user } from "../src/schema";
const [sub, role] = process.argv.slice(2) as [string, "member" | "staff" | "admin"];
const acc = await db.query.account.findFirst({ where: eq(account.accountId, sub) });
if (!acc) { console.error("no account for", sub); process.exit(1); }
console.log(await db.update(user).set({ role }).where(eq(user.id, acc.userId)).returning());
process.exit(0);
