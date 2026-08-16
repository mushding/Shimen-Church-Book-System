import type { Room } from "@smsk/shared";

/** Group rooms by zone, keeping first-appearance order (rooms already sorted by admin `sort`); unzoned rooms last. */
export function groupByZone(rooms: Room[]): [string | null, Room[]][] {
  const m = new Map<string | null, Room[]>();
  for (const r of rooms) { const z = r.zone?.trim() || null; if (!m.has(z)) m.set(z, []); m.get(z)!.push(r); }
  return [...m.entries()].sort(([a], [b]) => (a === null ? 1 : 0) - (b === null ? 1 : 0));
}
