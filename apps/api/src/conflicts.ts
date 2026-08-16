import { and, eq, inArray, lt, ne, or } from "drizzle-orm";
import type { Conflict } from "@smsk/shared";
import type { Db } from "./db";
import { bookingException, bookingSeries, type Exception } from "./schema";
import { expandSeries, seriesEnd, type Occurrence } from "./recur";

type Span = { start: Date; end: Date; roomId: number };
const overlaps = (a: Span, b: Span) => a.roomId === b.roomId && a.start < b.end && b.start < a.end;

/** Pure: which existing occurrences collide with any candidate span. */
export function findConflicts(candidates: Span[], existing: Occurrence[]): Occurrence[] {
  // ponytail: O(n*m); n,m are per-room occurrences in a ≤2y window — hundreds, not millions.
  const hit = new Map<string, Occurrence>();
  for (const c of candidates)
    for (const e of existing) if (overlaps(c, e)) hit.set(`${e.seriesId}:${e.start.getTime()}`, e);
  return [...hit.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export const HORIZON_MS = 2 * 365 * 86400_000; // ponytail: infinite rules checked 2y ahead only

export type Candidate = { dtstart: Date; dtend: Date; rrule: string | null; roomId: number; exceptions?: Exception[] };
export type Exclude = { seriesId: number; occurrenceStart?: Date };

/** DB-backed: conflicts for a new/edited series. `exclude` skips the series being edited (or one slot of it). */
export async function checkConflicts(db: Db, cand: Candidate, exclude?: Exclude): Promise<Conflict[]> {
  const from = cand.dtstart;
  const to = seriesEnd(cand) ?? new Date(Math.max(Date.now(), cand.dtstart.getTime()) + HORIZON_MS);
  const { exceptions = [], ...c } = cand;
  const fake = { id: -1, userId: "", categoryId: 0, title: "", note: "", legacyId: null, createdAt: from, updatedAt: from, ...c };
  const candidates = expandSeries(fake, exceptions, from, to).filter((o) => o.roomId === cand.roomId);
  if (!candidates.length) return [];

  // series in this room (by base room or by an override moved into it), starting before window end
  const movedIn = db
    .select({ id: bookingException.seriesId })
    .from(bookingException)
    .where(eq(bookingException.overrideRoomId, cand.roomId));
  const where = [lt(bookingSeries.dtstart, to), or(eq(bookingSeries.roomId, cand.roomId), inArray(bookingSeries.id, movedIn))];
  if (exclude && !exclude.occurrenceStart) where.push(ne(bookingSeries.id, exclude.seriesId));
  const series = await db.query.bookingSeries.findMany({ where: and(...where) });
  if (!series.length) return [];
  const exs = await db.query.bookingException.findMany({
    where: inArray(bookingException.seriesId, series.map((s) => s.id)),
  });
  const existing = series
    .flatMap((s) => expandSeries(s, exs.filter((e) => e.seriesId === s.id), from, to))
    .filter((o) => o.roomId === cand.roomId)
    .filter((o) => !(exclude?.occurrenceStart && o.seriesId === exclude.seriesId && o.occurrenceStart.getTime() === exclude.occurrenceStart.getTime()));

  return findConflicts(candidates, existing).map((o) => ({
    seriesId: o.seriesId, title: o.title, roomId: o.roomId, start: o.start.toISOString(), end: o.end.toISOString(),
  }));
}
