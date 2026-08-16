import { RRule, type Options } from "rrule";
import { addMinutes } from "./time";

/** UI model for the repeat editor; serialises to an RRULE body (no DTSTART). */
export type Repeat =
  | { freq: "none" }
  | { freq: "daily" | "weekly" | "monthly"; interval: number; byday: number[]; end: { kind: "never" } | { kind: "until"; date: string } | { kind: "count"; n: number } };

export const NO_REPEAT: Repeat = { freq: "none" };
const WD = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA]; // JS getDay() order
const FREQ = { daily: RRule.DAILY, weekly: RRule.WEEKLY, monthly: RRule.MONTHLY } as const;

export function toRRule(r: Repeat, dtstart: Date): string | null {
  if (r.freq === "none") return null;
  const o: Partial<Options> = { freq: FREQ[r.freq], interval: r.interval || 1 };
  if (r.freq === "weekly") o.byweekday = (r.byday.length ? r.byday : [dtstart.getDay()]).map((d) => WD[d]);
  if (r.end.kind === "count") o.count = r.end.n;
  // UNTIL = end of that local day, expressed in UTC (Taipei = UTC+8, no DST)
  if (r.end.kind === "until") o.until = new Date(`${r.end.date}T23:59:59+08:00`);
  return RRule.optionsToString(o as Options).replace(/^RRULE:/, "");
}

export function fromRRule(body: string | null): Repeat {
  if (!body) return NO_REPEAT;
  const o = RRule.parseString(body);
  const freq = o.freq === RRule.DAILY ? "daily" : o.freq === RRule.MONTHLY ? "monthly" : "weekly";
  const byday = (Array.isArray(o.byweekday) ? o.byweekday : o.byweekday ? [o.byweekday] : []).map((w: any) => (typeof w === "number" ? (w + 1) % 7 : (w.weekday + 1) % 7));
  const end = o.count ? { kind: "count" as const, n: o.count } : o.until ? { kind: "until" as const, date: taipeiDate(o.until) } : { kind: "never" as const };
  return { freq, interval: o.interval ?? 1, byday, end };
}
const taipeiDate = (d: Date) => addMinutes(d, 8 * 60).toISOString().slice(0, 10);

const DOWN = ["日", "一", "二", "三", "四", "五", "六"];
export function describe(r: Repeat, dtstart: Date): string {
  if (r.freq === "none") return "不重複";
  const every = r.interval > 1 ? `每 ${r.interval} ` : "每";
  const base = r.freq === "daily" ? `${every}天` : r.freq === "monthly" ? `${every}月 ${dtstart.getDate()} 號` : `${every}週${(r.byday.length ? r.byday : [dtstart.getDay()]).sort().map((d) => DOWN[d]).join("、")}`;
  const end = r.end.kind === "count" ? `，共 ${r.end.n} 次` : r.end.kind === "until" ? `，到 ${r.end.date.replace(/-/g, "/")}` : "";
  return base + end;
}

// same trick as server recur.ts: expand on wall-clock ("fake UTC") so BYDAY follows the local calendar day
const toWall = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()));
const fromWall = (d: Date) => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());

/** Preview first few occurrences (browser TZ assumed Taipei). */
export function preview(r: Repeat, dtstart: Date, n = 4): { dates: Date[]; total: number | null } {
  const body = toRRule(r, dtstart);
  if (!body) return { dates: [dtstart], total: 1 };
  const o = RRule.parseString(body);
  if (o.until) o.until = toWall(o.until); // UTC instant → local wall clock
  const rule = new RRule({ ...o, dtstart: toWall(dtstart) });
  const bounded = /UNTIL|COUNT/.test(body);
  const all = bounded ? rule.all((_, i) => i < 500) : rule.all((_, i) => i < n);
  return { dates: all.slice(0, n).map(fromWall), total: bounded ? all.length : null };
}
