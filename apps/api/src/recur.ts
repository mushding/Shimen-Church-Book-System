import * as rrulePkg from "rrule";
import type { RRule as RRuleT } from "rrule";
// rrule 2.8 has no `exports` map → Node ESM sees only CJS default; vite sees the ESM build. Normalise.
export const RRule: typeof rrulePkg.RRule = (rrulePkg as any).RRule ?? (rrulePkg as any).default.RRule;
export type RRule = RRuleT;
import type { Series, Exception } from "./schema";

// Taiwan has no DST → wall clock = UTC+8 fixed. Expand in "fake UTC" (UTC fields == Taipei wall time)
// so BYDAY / BYMONTHDAY follow the Taipei calendar day, then shift back. Avoids rrule tzid quirks.
// ponytail: if the church ever moves timezone, replace with rrule tzid + Temporal.
export const TZ_OFFSET_MS = 8 * 3600_000;
export const toWall = (d: Date) => new Date(d.getTime() + TZ_OFFSET_MS);
export const fromWall = (d: Date) => new Date(d.getTime() - TZ_OFFSET_MS);

export function parseRule(body: string, dtstart: Date): RRule {
  const opts = RRule.parseString(body);
  if (opts.until) opts.until = toWall(opts.until);
  return new RRule({ ...opts, dtstart: toWall(dtstart) });
}

/** Original occurrence starts of a series within [from, to) (occurrence start), ignoring exceptions. */
export function occurrenceStarts(dtstart: Date, rrule: string | null, from: Date, to: Date): Date[] {
  if (!rrule) return dtstart >= from && dtstart < to ? [dtstart] : [];
  const rule = parseRule(rrule, dtstart);
  return rule.between(toWall(from), toWall(to), true).filter((d) => d < toWall(to)).map(fromWall);
}

export type Occurrence = {
  seriesId: number;
  occurrenceStart: Date;
  start: Date;
  end: Date;
  title: string;
  note: string;
  roomId: number;
  categoryId: number;
  userId: string;
  recurring: boolean;
  rrule: string | null;
  seriesStart: Date;
  seriesEnd: Date;
};

/** Expand a series into concrete occurrences overlapping [from, to), applying exceptions. */
export function expandSeries(s: Series, exceptions: Exception[], from: Date, to: Date): Occurrence[] {
  const dur = s.dtend.getTime() - s.dtstart.getTime();
  const exBySlot = new Map(exceptions.map((e) => [e.originalStart.getTime(), e]));
  const out: Occurrence[] = [];
  const base = {
    seriesId: s.id, title: s.title, note: s.note, roomId: s.roomId, categoryId: s.categoryId,
    userId: s.userId, recurring: !!s.rrule, rrule: s.rrule, seriesStart: s.dtstart, seriesEnd: s.dtend,
  };
  // occurrence overlaps window if start < to && start + dur > from  → start in [from - dur, to)
  for (const os of occurrenceStarts(s.dtstart, s.rrule, new Date(from.getTime() - dur), to)) {
    const ex = exBySlot.get(os.getTime());
    if (ex?.cancelled) continue;
    const start = ex?.overrideStart ?? os;
    const end = ex?.overrideEnd ?? new Date(start.getTime() + dur);
    if (start >= to || end <= from) continue;
    out.push({
      ...base, occurrenceStart: os, start, end,
      title: ex?.overrideTitle ?? s.title, note: ex?.overrideNote ?? s.note,
      roomId: ex?.overrideRoomId ?? s.roomId, categoryId: ex?.overrideCategoryId ?? s.categoryId,
    });
  }
  // overrides moved INTO the window from an original slot outside it
  for (const ex of exceptions) {
    if (ex.cancelled || !ex.overrideStart) continue;
    const os = ex.originalStart;
    if (out.some((o) => o.occurrenceStart.getTime() === os.getTime())) continue;
    const start = ex.overrideStart;
    const end = ex.overrideEnd ?? new Date(start.getTime() + dur);
    if (start >= to || end <= from) continue;
    out.push({
      ...base, occurrenceStart: os, start, end,
      title: ex.overrideTitle ?? s.title, note: ex.overrideNote ?? s.note,
      roomId: ex.overrideRoomId ?? s.roomId, categoryId: ex.overrideCategoryId ?? s.categoryId,
    });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Rewrite rrule so it ends before `cutoff` (for "this and following" splits).
 *  Returns null when only dtstart itself remains → caller stores it as a single booking (rrule null). */
export function truncateRule(body: string, dtstart: Date, cutoff: Date): string | null {
  const opts = RRule.parseString(body);
  delete opts.count;
  const newBody = RRule.optionsToString({ ...opts, until: new Date(cutoff.getTime() - 1000) }).replace(/^RRULE:/, "");
  const remaining = parseRule(newBody, dtstart).all((_, i) => i < 2);
  return remaining.length >= 2 ? newBody : null;
}

/** Last occurrence end for bounded rules; null when infinite. */
export function seriesEnd(s: { dtstart: Date; dtend: Date; rrule: string | null }): Date | null {
  if (!s.rrule) return s.dtend;
  const opts = RRule.parseString(s.rrule);
  if (!opts.until && !opts.count) return null;
  const rule = parseRule(s.rrule, s.dtstart);
  const all = rule.all();
  if (!all.length) return s.dtend;
  return new Date(fromWall(all[all.length - 1]).getTime() + (s.dtend.getTime() - s.dtstart.getTime()));
}
