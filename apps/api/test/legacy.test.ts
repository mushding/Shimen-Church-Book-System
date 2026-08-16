import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { migrate } from "../src/migrate";
import { seed } from "../src/seed";
import { migrateLegacy, parseDump, parseLegacyDate } from "../src/legacy";
import { account, bookingException, bookingSeries, room, user } from "../src/schema";
import { listOccurrences } from "../src/bookings";

const sql = readFileSync(new URL("./fixtures/legacy.sql", import.meta.url), "utf8");

describe("parseDump", () => {
  it("reads columns + escaped values", () => {
    const t = parseDump(sql);
    expect(t.User).toHaveLength(2);
    expect(t.Appointment).toHaveLength(4);
    expect(t.Appointment[0].note).toBe("it's note, with \\ backslash");
    expect(t.Appointment[1].note).toBeNull();
    expect(t.Appointment[0].pkId).toBe("1000");
  });
  it("parseLegacyDate handles compact and ISO", () => {
    expect(parseLegacyDate("20230714T113000Z").toISOString()).toBe("2023-07-14T11:30:00.000Z");
    expect(parseLegacyDate("2024-06-30T05:00+08:00").toISOString()).toBe("2024-06-29T21:00:00.000Z");
  });
});

describe("migrateLegacy", () => {
  beforeAll(async () => {
    await migrate(); await seed();
    // simulate: this person already logged into v2 before migration ran → random user.id + account row
    await db.insert(user).values({ id: "RANDOMID", name: "彭啟恩", email: "u459767a6e915e5fc8749df6de1926adf@line.invalid" });
    await db.insert(account).values({ id: "acc1", providerId: "line", accountId: "U459767a6e915e5fc8749df6de1926adf", userId: "RANDOMID", createdAt: new Date(), updatedAt: new Date() });
  });
  it("maps users/accounts/rooms/series/exceptions; re-run is idempotent", async () => {
    const r1 = await migrateLegacy(db, sql, () => {});
    expect(r1).toMatchObject({ users: 2, bookings: 4, exceptions: 2 });
    expect(r1.warn.some((w) => w.includes("三樓新教室"))).toBe(true);
    const r2 = await migrateLegacy(db, sql, () => {});
    expect(r2.bookings).toBe(4);
    expect(await db.select().from(bookingSeries)).toHaveLength(4);
    expect(await db.select().from(user)).toHaveLength(2);
    expect(await db.select().from(account)).toHaveLength(2);
    expect(await db.select().from(bookingException)).toHaveLength(2);

    const u = (await db.select().from(user).where(eq(user.id, "RANDOMID")))[0]; // reused existing v2 user
    expect(u.role).toBe("admin"); expect(u.email).toBe("u459767a6e915e5fc8749df6de1926adf@line.invalid");
    expect((await db.select().from(bookingSeries).where(eq(bookingSeries.legacyId, 1000)))[0].userId).toBe("RANDOMID");
    const other = (await db.select().from(user).where(eq(user.id, "Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")))[0];
    expect(other.role).toBe("member");
    const acc = (await db.select().from(account).where(eq(account.userId, other.id)))[0];
    expect(acc).toMatchObject({ providerId: "line", accountId: other.id });

    const s = (await db.select().from(bookingSeries).where(eq(bookingSeries.legacyId, 1000)))[0];
    expect(s.rrule).toBe("FREQ=WEEKLY;BYDAY=FR;UNTIL=20231229T160000Z");
    expect(s.dtstart.toISOString()).toBe("2023-07-07T11:30:00.000Z");
    const camp = (await db.select().from(bookingSeries).where(eq(bookingSeries.legacyId, 1002)))[0];
    expect(camp.note).toBe("[雙語營組別] 大會");
    const newRoom = (await db.select().from(room).where(eq(room.name, "三樓新教室")))[0];
    expect(newRoom.active).toBe(false);

    // exdates take effect: July 2023 Fridays 7,14,21,28 → 7 and 28 only
    const { occurrences } = await listOccurrences(db, new Date("2023-07-01T00:00:00+08:00"), new Date("2023-08-01T00:00:00+08:00"));
    expect(occurrences.filter((o) => o.seriesId === s.id).map((o) => o.start.toISOString()))
      .toEqual(["2023-07-07T11:30:00.000Z", "2023-07-28T11:30:00.000Z"]);
  });
});
