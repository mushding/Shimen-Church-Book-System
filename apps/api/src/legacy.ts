// Legacy MySQL dump (2023 system: User + Appointment) → v2 schema. Re-runnable (upsert by legacy_id / user.id).
import { eq, inArray } from "drizzle-orm";
import type { Db } from "./db";
import { account, bookingException, bookingSeries, category, room, user } from "./schema";

type Row = Record<string, string | null>;

/** Parse `CREATE TABLE` column order + `INSERT INTO \`T\` VALUES (...),(...);` from a mysqldump. */
export function parseDump(sql: string): Record<string, Row[]> {
  const cols: Record<string, string[]> = {};
  for (const m of sql.matchAll(/CREATE TABLE `(\w+)` \(([\s\S]*?)\n\)/g))
    cols[m[1]] = [...m[2].matchAll(/^\s*`(\w+)`/gm)].map((c) => c[1]);
  const out: Record<string, Row[]> = {};
  for (const m of sql.matchAll(/INSERT INTO `(\w+)`(?: \(([^)]*)\))? VALUES /g)) {
    const table = m[1];
    const names = m[2] ? m[2].split(",").map((c) => c.trim().replace(/`/g, "")) : cols[table];
    if (!names) throw new Error(`no column list for ${table}`);
    const [tuples, _] = readTuples(sql, m.index! + m[0].length);
    (out[table] ??= []).push(...tuples.map((t) => Object.fromEntries(names.map((n, i) => [n, t[i] ?? null]))));
  }
  return out;
}

// tiny tokenizer: (v,v,...),(...);  values = 'str' (backslash escapes) | NULL | number
function readTuples(s: string, i: number): [(string | null)[][], number] {
  const tuples: (string | null)[][] = [];
  while (i < s.length && s[i] !== ";") {
    if (s[i] !== "(") { i++; continue; }
    i++;
    const vals: (string | null)[] = [];
    while (s[i] !== ")") {
      if (s[i] === "'") {
        let v = ""; i++;
        while (s[i] !== "'") {
          if (s[i] === "\\") { i++; v += { n: "\n", r: "\r", t: "\t", "0": "\0" }[s[i]] ?? s[i]; }
          else v += s[i];
          i++;
        }
        i++; vals.push(v);
      } else {
        let v = ""; while (s[i] !== "," && s[i] !== ")") v += s[i++];
        vals.push(v.trim() === "NULL" ? null : v.trim());
      }
      if (s[i] === ",") i++;
    }
    i++; tuples.push(vals);
  }
  return [tuples, i];
}

/** "20230714T073000Z" | ISO → Date */
export function parseLegacyDate(s: string): Date {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s.trim());
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : new Date(s.trim());
  if (isNaN(d.getTime())) throw new Error(`bad date: ${s}`);
  return d;
}

const ROLE: Record<string, "member" | "staff" | "admin"> = { admin: "admin", staff: "staff" };

export async function migrateLegacy(db: Db, sql: string, log = console.log) {
  const t = parseDump(sql);
  const users = t.User ?? [], appts = t.Appointment ?? [];
  const warn: string[] = [];

  // users + LINE account link (better-auth: account.providerId='line', accountId = LINE sub = old userId).
  // If the person already logged into v2 (account row exists), reuse that user.id; else user.id = sub.
  const uid = new Map<string, string>(); // old userId → v2 user.id
  const existing = new Map((await db.select().from(account).where(eq(account.providerId, "line"))).map((a) => [a.accountId, a.userId]));
  for (const u of users) {
    const sub = u.userId!;
    const row = { name: u.name || "(未命名)", image: u.pictureUrl || null, role: ROLE[u.role ?? ""] ?? "member" };
    const id = existing.get(sub) ?? sub;
    uid.set(sub, id);
    await db.insert(user).values({ id, email: `${sub.toLowerCase()}@line.invalid`, emailVerified: false, ...row, createdAt: u.createTime ? new Date(u.createTime) : new Date() })
      .onConflictDoUpdate({ target: user.id, set: row });
    if (!existing.has(sub))
      await db.insert(account).values({ id: `line:${sub}`, accountId: sub, providerId: "line", userId: id, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
  }

  // rooms/categories by name; unknown names → inactive rows so nothing is dropped
  const roomId = new Map((await db.select().from(room)).map((r) => [r.name, r.id]));
  const catId = new Map((await db.select().from(category)).map((c) => [c.name, c.id]));
  const ensure = async (map: Map<string, number>, name: string, kind: "room" | "category") => {
    if (map.has(name)) return map.get(name)!;
    const [r] = kind === "room"
      ? await db.insert(room).values({ name, colorToken: "room-10", sort: 900, active: false }).returning()
      : await db.insert(category).values({ name, colorToken: "cat-personal", sort: 900, active: false }).returning();
    map.set(name, r.id); warn.push(`unknown ${kind} "${name}" → created inactive id ${r.id}`);
    return r.id;
  };

  let n = 0, nex = 0;
  for (const a of appts) {
    const legacyId = Number(a.pkId);
    const userId = uid.get(a.userId ?? "");
    if (!userId) { warn.push(`appt ${legacyId}: unknown user ${a.userId}, skipped`); continue; }
    const dtstart = parseLegacyDate(a.startDate!), dtend = parseLegacyDate(a.endDate!);
    if (dtend <= dtstart) { warn.push(`appt ${legacyId}: end<=start, skipped`); continue; }
    const note = [a.note?.trim(), a.flyyoungTeamName ? `[雙語營組別] ${a.flyyoungTeamName}` : ""].filter(Boolean).join("\n");
    const row = {
      userId, roomId: await ensure(roomId, a.roomName ?? "", "room"), categoryId: await ensure(catId, a.categoryName ?? "", "category"),
      title: a.title || "(無標題)", note, dtstart, dtend, rrule: a.rRule?.trim() ? a.rRule.trim().replace(/^RRULE:/i, "") : null,
    };
    const [s] = await db.insert(bookingSeries).values({ ...row, legacyId, createdAt: a.createTime ? new Date(a.createTime) : dtstart })
      .onConflictDoUpdate({ target: bookingSeries.legacyId, set: row }).returning();
    await db.delete(bookingException).where(eq(bookingException.seriesId, s.id));
    const ex = (a.exDate ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    if (ex.length && row.rrule) {
      const slots = [...new Set(ex.map((x) => parseLegacyDate(x).getTime()))];
      await db.insert(bookingException).values(slots.map((ms) => ({ seriesId: s.id, originalStart: new Date(ms), cancelled: true })));
      nex += slots.length;
    } else if (ex.length) warn.push(`appt ${legacyId}: exDate on non-recurring, ignored`);
    n++;
  }
  // series whose legacy row disappeared from a newer dump are left alone (ponytail: no legacy deletes expected pre-cutover)
  log(`users ${users.length}, bookings ${n}/${appts.length}, exceptions ${nex}, warnings ${warn.length}`);
  for (const w of warn) log("  ! " + w);
  return { users: users.length, bookings: n, exceptions: nex, warn };
}
