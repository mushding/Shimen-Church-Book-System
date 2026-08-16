import { and, eq, gte, inArray, lt } from "drizzle-orm";
import type { BookingInput, BookingPatch, Conflict, EditScope } from "@smsk/shared";
import type { Db } from "./db";
import { bookingException, bookingSeries, user, type Series } from "./schema";
import { RRule, expandSeries, fromWall, parseRule, truncateRule, type Occurrence } from "./recur";
import { checkConflicts } from "./conflicts";

export class ConflictError extends Error {
  constructor(public conflicts: Conflict[]) { super("conflict"); }
}
export class NotFound extends Error {}

const D = (s: string) => new Date(s);

export async function listOccurrences(db: Db, from: Date, to: Date) {
  const series = await db.query.bookingSeries.findMany({ where: lt(bookingSeries.dtstart, to) });
  if (!series.length) return { occurrences: [] as Occurrence[], users: new Map<string, { name: string; image: string | null }>() };
  const exs = await db.query.bookingException.findMany({ where: inArray(bookingException.seriesId, series.map((s) => s.id)) });
  const occurrences = series.flatMap((s) => expandSeries(s, exs.filter((e) => e.seriesId === s.id), from, to));
  const ids = [...new Set(occurrences.map((o) => o.userId))];
  const users = new Map(
    (ids.length ? await db.select({ id: user.id, name: user.name, image: user.image }).from(user).where(inArray(user.id, ids)) : [])
      .map((u) => [u.id, { name: u.name, image: u.image }]),
  );
  return { occurrences: occurrences.sort((a, b) => a.start.getTime() - b.start.getTime()), users };
}

async function assertFree(db: Db, cand: Parameters<typeof checkConflicts>[1], force: boolean, exclude?: Parameters<typeof checkConflicts>[2]) {
  if (force) return;
  const c = await checkConflicts(db, cand, exclude);
  if (c.length) throw new ConflictError(c);
}

export async function createSeries(db: Db, userId: string, b: BookingInput, force: boolean): Promise<Series> {
  const cand = { dtstart: D(b.start), dtend: D(b.end), rrule: b.rrule, roomId: b.roomId };
  await assertFree(db, cand, force);
  const [row] = await db.insert(bookingSeries).values({ ...cand, userId, categoryId: b.categoryId, title: b.title, note: b.note }).returning();
  return row;
}

async function getSeries(db: Db, id: number) {
  const s = await db.query.bookingSeries.findFirst({ where: eq(bookingSeries.id, id) });
  if (!s) throw new NotFound();
  return s;
}

/** Remaining COUNT after cutting a COUNT-based rule at `cutoff` (occurrences strictly before cutoff are dropped). */
function remainingCount(rrule: string, dtstart: Date, cutoff: Date): string {
  const opts = RRule.parseString(rrule);
  if (!opts.count) return rrule;
  const before = parseRule(rrule, dtstart).all().filter((d) => fromWall(d) < cutoff).length;
  return RRule.optionsToString({ ...opts, count: Math.max(1, opts.count - before) }).replace(/^RRULE:/, "");
}

export async function patchSeries(db: Db, id: number, p: BookingPatch, force: boolean): Promise<Series> {
  const s = await getSeries(db, id);
  const patch = p.patch;
  let scope: EditScope = p.scope;
  const occ = p.occurrenceStart ? D(p.occurrenceStart) : s.dtstart;
  if (!s.rrule) scope = "all";
  else if (scope === "following" && occ.getTime() === s.dtstart.getTime()) scope = "all";
  const dur = s.dtend.getTime() - s.dtstart.getTime();

  if (scope === "this") {
    const start = patch.start ? D(patch.start) : occ;
    const end = patch.end ? D(patch.end) : new Date(start.getTime() + dur);
    const roomId = patch.roomId ?? s.roomId;
    await assertFree(db, { dtstart: start, dtend: end, rrule: null, roomId }, force, { seriesId: id, occurrenceStart: occ });
    const ov = {
      cancelled: false, overrideStart: start, overrideEnd: end, overrideRoomId: roomId,
      overrideCategoryId: patch.categoryId ?? null, overrideTitle: patch.title ?? null, overrideNote: patch.note ?? null,
    };
    await db.insert(bookingException).values({ seriesId: id, originalStart: occ, ...ov })
      .onConflictDoUpdate({ target: [bookingException.seriesId, bookingException.originalStart], set: ov });
    return s;
  }

  if (scope === "all") {
    const dtstart = patch.start ? D(patch.start) : s.dtstart;
    const dtend = patch.end ? D(patch.end) : new Date(dtstart.getTime() + dur);
    const rrule = patch.rrule !== undefined ? patch.rrule : s.rrule;
    const roomId = patch.roomId ?? s.roomId;
    return db.transaction(async (tx) => {
      const delta = dtstart.getTime() - s.dtstart.getTime();
      if (delta) {
        // keep exceptions attached to their (shifted) slots, like old changeExDate
        const exs = await tx.query.bookingException.findMany({ where: eq(bookingException.seriesId, id) });
        for (const e of exs)
          await tx.update(bookingException).set({ originalStart: new Date(e.originalStart.getTime() + delta) }).where(eq(bookingException.id, e.id));
      }
      if (rrule !== s.rrule) await tx.delete(bookingException).where(eq(bookingException.seriesId, id)); // slots no longer meaningful
      const exceptions = await tx.query.bookingException.findMany({ where: eq(bookingException.seriesId, id) });
      await assertFree(tx as unknown as Db, { dtstart, dtend, rrule, roomId, exceptions }, force, { seriesId: id });
      const [row] = await tx.update(bookingSeries).set({
        dtstart, dtend, rrule, roomId, categoryId: patch.categoryId ?? s.categoryId,
        title: patch.title ?? s.title, note: patch.note ?? s.note,
      }).where(eq(bookingSeries.id, id)).returning();
      return row;
    });
  }

  // following: truncate old, spawn new series from occ
  return db.transaction(async (tx) => {
    const cut = truncateRule(s.rrule!, s.dtstart, occ);
    await tx.update(bookingSeries).set({ rrule: cut }).where(eq(bookingSeries.id, id));
    const dtstart = patch.start ? D(patch.start) : occ;
    const dtend = patch.end ? D(patch.end) : new Date(dtstart.getTime() + dur);
    const rrule = patch.rrule !== undefined ? patch.rrule : remainingCount(s.rrule!, s.dtstart, occ);
    const roomId = patch.roomId ?? s.roomId;
    const [nu] = await tx.insert(bookingSeries).values({
      userId: s.userId, dtstart, dtend, rrule, roomId, categoryId: patch.categoryId ?? s.categoryId,
      title: patch.title ?? s.title, note: patch.note ?? s.note,
    }).returning();
    // move later exceptions to the new series (shifted if start moved); drop them if rule changed
    const later = and(eq(bookingException.seriesId, id), gte(bookingException.originalStart, occ));
    if (patch.rrule !== undefined && patch.rrule !== s.rrule) await tx.delete(bookingException).where(later);
    else {
      const delta = dtstart.getTime() - occ.getTime();
      const exs = await tx.query.bookingException.findMany({ where: later });
      for (const e of exs)
        await tx.update(bookingException).set({ seriesId: nu.id, originalStart: new Date(e.originalStart.getTime() + delta) }).where(eq(bookingException.id, e.id));
    }
    const exceptions = await tx.query.bookingException.findMany({ where: eq(bookingException.seriesId, nu.id) });
    await assertFree(tx as unknown as Db, { dtstart, dtend, rrule, roomId, exceptions }, force, { seriesId: nu.id });
    return nu;
  });
}

export async function deleteSeries(db: Db, id: number, scope: EditScope, occurrenceStart?: string) {
  const s = await getSeries(db, id);
  const occ = occurrenceStart ? D(occurrenceStart) : s.dtstart;
  if (!s.rrule || scope === "all" || (scope === "following" && occ.getTime() === s.dtstart.getTime())) {
    await db.delete(bookingSeries).where(eq(bookingSeries.id, id));
    return;
  }
  if (scope === "this") {
    const set = { cancelled: true, overrideStart: null, overrideEnd: null, overrideTitle: null, overrideNote: null, overrideRoomId: null, overrideCategoryId: null };
    await db.insert(bookingException).values({ seriesId: id, originalStart: occ, ...set })
      .onConflictDoUpdate({ target: [bookingException.seriesId, bookingException.originalStart], set });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(bookingSeries).set({ rrule: truncateRule(s.rrule!, s.dtstart, occ) }).where(eq(bookingSeries.id, id));
    await tx.delete(bookingException).where(and(eq(bookingException.seriesId, id), gte(bookingException.originalStart, occ)));
  });
}
