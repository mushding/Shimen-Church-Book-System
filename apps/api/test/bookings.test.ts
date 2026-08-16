import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { migrate } from "../src/migrate";
import { seed } from "../src/seed";
import { bookingException, bookingSeries, room, user } from "../src/schema";
import { ConflictError, createSeries, deleteSeries, listOccurrences, patchSeries } from "../src/bookings";
import { checkConflicts } from "../src/conflicts";

const T = (s: string) => new Date(s);
const iso = (s: string) => new Date(s).toISOString();
const inp = (o: Partial<Parameters<typeof createSeries>[2]> = {}) => ({
  roomId: 6, categoryId: 1, title: "青年崇拜", note: "", force: false, rrule: null,
  start: iso("2026-09-04T19:30:00+08:00"), end: iso("2026-09-04T21:30:00+08:00"), ...o,
});
const starts = async (from: string, to: string) =>
  (await listOccurrences(db, T(from), T(to))).occurrences.map((o) => `${o.seriesId}@${o.start.toISOString()}`);

beforeAll(async () => {
  await migrate(); await seed();
  await db.insert(user).values([{ id: "u1", name: "A", email: "u1@line.invalid" }, { id: "u2", name: "B", email: "u2@line.invalid" }]);
});

describe("conflicts", () => {
  it("single vs single overlap → 409 payload; adjacent ok", async () => {
    await createSeries(db, "u1", inp(), false);
    await expect(createSeries(db, "u2", inp({ start: iso("2026-09-04T20:00:00+08:00"), end: iso("2026-09-04T22:00:00+08:00") }), false))
      .rejects.toSatisfy((e: any) => e instanceof ConflictError && e.conflicts[0].title === "青年崇拜");
    await createSeries(db, "u2", inp({ start: iso("2026-09-04T21:30:00+08:00"), end: iso("2026-09-04T22:00:00+08:00") }), false); // touching = ok
    await createSeries(db, "u2", inp({ roomId: 5 }), false); // other room ok
  });
  it("recurring vs single, both directions; force bypasses; allowOverlap room ignores", async () => {
    const weekly = await createSeries(db, "u1", inp({ start: iso("2026-10-02T19:00:00+08:00"), end: iso("2026-10-02T21:00:00+08:00"), rrule: "FREQ=WEEKLY;BYDAY=FR;COUNT=4" }), false);
    // 3rd occurrence = 10/16
    await expect(createSeries(db, "u2", inp({ start: iso("2026-10-16T20:00:00+08:00"), end: iso("2026-10-16T22:00:00+08:00") }), false)).rejects.toBeInstanceOf(ConflictError);
    // new weekly rule colliding with an existing single (10/16 above would fail, so use another single)
    await createSeries(db, "u2", inp({ start: iso("2026-11-06T20:00:00+08:00"), end: iso("2026-11-06T22:00:00+08:00") }), false);
    const c = await checkConflicts(db, { dtstart: T("2026-10-30T19:00:00+08:00"), dtend: T("2026-10-30T21:00:00+08:00"), rrule: "FREQ=WEEKLY;BYDAY=FR;COUNT=3", roomId: 6 });
    expect(c.map((x) => x.start)).toEqual([iso("2026-11-06T20:00:00+08:00")]);
    // force
    const forced = await createSeries(db, "u2", inp({ start: iso("2026-10-16T20:00:00+08:00"), end: iso("2026-10-16T22:00:00+08:00") }), true);
    await deleteSeries(db, forced.id, "all");
    // allowOverlap room
    const [outdoor] = await db.insert(room).values({ name: "教會室外", colorToken: "#77aa88", allowOverlap: true }).returning();
    await createSeries(db, "u1", inp({ roomId: outdoor.id }), false);
    await createSeries(db, "u2", inp({ roomId: outdoor.id }), false);
    await deleteSeries(db, weekly.id, "all");
  });
  it("cancelled occurrence frees the slot; edited series excludes itself", async () => {
    const w = await createSeries(db, "u1", inp({ start: iso("2027-01-04T10:00:00+08:00"), end: iso("2027-01-04T11:00:00+08:00"), rrule: "FREQ=DAILY;COUNT=5" }), false);
    await deleteSeries(db, w.id, "this", iso("2027-01-06T10:00:00+08:00"));
    await createSeries(db, "u2", inp({ start: iso("2027-01-06T10:00:00+08:00"), end: iso("2027-01-06T11:00:00+08:00") }), false);
    // shifting the whole series by 30 min doesn't conflict with itself
    await patchSeries(db, w.id, { scope: "all", patch: { start: iso("2027-01-04T10:30:00+08:00"), end: iso("2027-01-04T11:30:00+08:00") }, force: false }, false);
    // …but now 1/6 10:30 collides with u2's single (exception was shifted to 10:30 slot → still cancelled) → check 1/5
    await expect(createSeries(db, "u2", inp({ start: iso("2027-01-05T10:45:00+08:00"), end: iso("2027-01-05T11:00:00+08:00") }), false)).rejects.toBeInstanceOf(ConflictError);
    expect(await starts("2027-01-06T00:00:00+08:00", "2027-01-07T00:00:00+08:00")).toHaveLength(1); // only u2's single: cancellation followed the shift
  });
});

describe("edit scopes", () => {
  it("this: override; following: split; all: rewrite; delete following truncates", async () => {
    const s = await createSeries(db, "u1", inp({ roomId: 3, start: iso("2027-03-01T09:00:00+08:00"), end: iso("2027-03-01T10:00:00+08:00"), rrule: "FREQ=DAILY;COUNT=6" }), false);
    const day = (d: number) => iso(`2027-03-0${d}T09:00:00+08:00`);
    // this: move 3/3 to 3/3 14:00, retitle
    await patchSeries(db, s.id, { scope: "this", occurrenceStart: day(3), patch: { start: iso("2027-03-03T14:00:00+08:00"), end: iso("2027-03-03T15:00:00+08:00"), title: "moved" }, force: false }, false);
    let occ = (await listOccurrences(db, T("2027-03-01T00:00:00+08:00"), T("2027-03-08T00:00:00+08:00"))).occurrences.filter((o) => o.roomId === 3);
    expect(occ.map((o) => o.title)).toEqual(["青年崇拜", "青年崇拜", "moved", "青年崇拜", "青年崇拜", "青年崇拜"]);
    expect(occ[2].start.toISOString()).toBe(iso("2027-03-03T14:00:00+08:00"));
    // following from 3/5: new title, keep rule → old series ends 3/4, new has COUNT=2
    const nu = await patchSeries(db, s.id, { scope: "following", occurrenceStart: day(5), patch: { title: "part2" }, force: false }, false);
    expect(nu.id).not.toBe(s.id);
    expect(nu.rrule).toBe("FREQ=DAILY;COUNT=2");
    const old = (await db.select().from(bookingSeries).where(eq(bookingSeries.id, s.id)))[0];
    expect(old.rrule).toMatch(/UNTIL=20270305T005959Z/);
    occ = (await listOccurrences(db, T("2027-03-01T00:00:00+08:00"), T("2027-03-08T00:00:00+08:00"))).occurrences.filter((o) => o.roomId === 3);
    expect(occ.map((o) => o.title)).toEqual(["青年崇拜", "青年崇拜", "moved", "青年崇拜", "part2", "part2"]);
    // all on new series: rename
    await patchSeries(db, nu.id, { scope: "all", patch: { title: "part2b" }, force: false }, false);
    // delete following on old series from 3/2 → old keeps only 3/1 (rrule null)
    await deleteSeries(db, s.id, "following", day(2));
    const old2 = (await db.select().from(bookingSeries).where(eq(bookingSeries.id, s.id)))[0];
    expect(old2.rrule).toBeNull();
    expect(await db.select().from(bookingException).where(eq(bookingException.seriesId, s.id))).toHaveLength(0);
    occ = (await listOccurrences(db, T("2027-03-01T00:00:00+08:00"), T("2027-03-08T00:00:00+08:00"))).occurrences.filter((o) => o.roomId === 3);
    expect(occ.map((o) => o.title)).toEqual(["青年崇拜", "part2b", "part2b"]);
    // delete all
    await deleteSeries(db, nu.id, "all");
    await deleteSeries(db, s.id, "all");
    expect((await listOccurrences(db, T("2027-03-01T00:00:00+08:00"), T("2027-03-08T00:00:00+08:00"))).occurrences.filter((o) => o.roomId === 3)).toHaveLength(0);
  });
  it("retitle-only edits skip conflict check (forced overlap stays editable)", async () => {
    const a = await createSeries(db, "u1", inp({ roomId: 9, start: iso("2027-06-01T09:00:00+08:00"), end: iso("2027-06-01T10:00:00+08:00"), rrule: "FREQ=DAILY;COUNT=3" }), false);
    await createSeries(db, "u2", inp({ roomId: 9, start: iso("2027-06-02T09:00:00+08:00"), end: iso("2027-06-02T10:00:00+08:00") }), true); // forced overlap
    await patchSeries(db, a.id, { scope: "this", occurrenceStart: iso("2027-06-02T09:00:00+08:00"), patch: { title: "renamed" }, force: false }, false);
    await patchSeries(db, a.id, { scope: "all", patch: { title: "renamed-all" }, force: false }, false);
    await expect(patchSeries(db, a.id, { scope: "this", occurrenceStart: iso("2027-06-02T09:00:00+08:00"), patch: { start: iso("2027-06-02T09:30:00+08:00"), end: iso("2027-06-02T10:30:00+08:00") }, force: false }, false)).rejects.toBeInstanceOf(ConflictError);
  });
  it("following on first occurrence == all; this on single == all", async () => {
    const s = await createSeries(db, "u1", inp({ roomId: 4, start: iso("2027-04-01T09:00:00+08:00"), end: iso("2027-04-01T10:00:00+08:00"), rrule: "FREQ=DAILY;COUNT=3" }), false);
    const r = await patchSeries(db, s.id, { scope: "following", occurrenceStart: iso("2027-04-01T09:00:00+08:00"), patch: { title: "x" }, force: false }, false);
    expect(r.id).toBe(s.id); expect(r.title).toBe("x");
    const single = await createSeries(db, "u1", inp({ roomId: 4, start: iso("2027-05-01T09:00:00+08:00"), end: iso("2027-05-01T10:00:00+08:00") }), false);
    const r2 = await patchSeries(db, single.id, { scope: "this", patch: { title: "y" }, force: false }, false);
    expect(r2.title).toBe("y");
    expect(await db.select().from(bookingException).where(eq(bookingException.seriesId, single.id))).toHaveLength(0);
  });
});
