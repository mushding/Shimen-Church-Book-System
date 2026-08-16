// pnpm --filter api inspect — dump users/accounts/sessions (dev sanity check after LINE login)
import { db } from "../src/db";
import { account, session, user } from "../src/schema";
console.log("users", await db.select({ id: user.id, name: user.name, role: user.role, email: user.email }).from(user));
console.log("accounts", await db.select({ providerId: account.providerId, accountId: account.accountId, userId: account.userId }).from(account));
console.log("sessions", await db.select({ userId: session.userId, expiresAt: session.expiresAt, updatedAt: session.updatedAt }).from(session));
process.exit(0);
