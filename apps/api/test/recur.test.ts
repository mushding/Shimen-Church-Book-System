import { describe, expect, it } from "vitest";
import { expandSeries, occurrenceStarts, seriesEnd, truncateRule } from "../src/recur";
import type { Series } from "../src/schema";

const T = (s: string) => new Date(s); // "+08:00" strings = Taipei wall time
const series = (o: Partial<Series>): Series => ({
  id: 1, userId: "u", roomId: 1, categoryId: 1, title: "t", note: "", legacyId: null,
  dtstart: T("2026-09-04T19:30:00+08:00"), dtend: T("2026-09-04T21:30:00+08:00"),
  rrule: "FREQ=WEEKLY;BYDAY=FR;UNTIL=20261231T160000Z", createdAt: new Date(0), updatedAt: new Date(0), ...o,
});

describe("occurrenceStarts", () => {
  it("weekly BYDAY follows Taipei weekday, not UTC (Fri 07:00 Taipei = Thu 23:00Z)", () => {
    const early = occurrenceStarts(T("2026-09-04T07:00:00+08:00"), "FREQ=WEEKLY;BYDAY=FR;COUNT=3", T("2026-09-01T00:00:00+08:00"), T("2026-10-01T00:00:00+08:00"));
    expect(early.map((d) => d.toISOString())).toEqual([
      "2026-09-03T23:00:00.000Z", "2026-09-10T23:00:00.000Z", "2026-09-17T23:00:00.000Z",
    ]);
  });
  it("respects UNTIL (UTC) and window bounds", () => {
    const r = occurrenceStarts(T("2026-12-18T19:30:00+08:00"), "FREQ=WEEKLY;BYDAY=FR;UNTIL=20261231T160000Z", T("2026-12-01T00:00:00+08:00"), T("2027-02-01T00:00:00+08:00"));
    expect(r.map((d) => d.toISOString())).toEqual(["2026-12-18T11:30:00.000Z", "2026-12-25T11:30:00.000Z"]);
  });
  it("single booking", () => {
    expect(occurrenceStarts(T("2026-09-04T19:30:00+08:00"), null, T("2026-09-04T00:00:00+08:00"), T("2026-09-05T00:00:00+08:00"))).toHaveLength(1);
    expect(occurrenceStarts(T("2026-09-04T19:30:00+08:00"), null, T("2026-09-05T00:00:00+08:00"), T("2026-09-06T00:00:00+08:00"))).toHaveLength(0);
  });
});

describe("expandSeries", () => {
  const from = T("2026-09-01T00:00:00+08:00"), to = T("2026-10-01T00:00:00+08:00");
  it("expands with duration", () => {
    const o = expandSeries(series({}), [], from, to);
    expect(o).toHaveLength(4);
    expect(o[0].end.toISOString()).toBe("2026-09-04T13:30:00.000Z");
    expect(o[0].recurring).toBe(true);
  });
  it("cancelled exception removed; override moves + retitles", () => {
    const s = series({});
    const o = expandSeries(s, [
      { id: 1, seriesId: 1, originalStart: T("2026-09-11T19:30:00+08:00"), cancelled: true, overrideStart: null, overrideEnd: null, overrideTitle: null, overrideNote: null, overrideRoomId: null, overrideCategoryId: null },
      { id: 2, seriesId: 1, originalStart: T("2026-09-18T19:30:00+08:00"), cancelled: false, overrideStart: T("2026-09-19T10:00:00+08:00"), overrideEnd: T("2026-09-19T12:00:00+08:00"), overrideTitle: "moved", overrideNote: null, overrideRoomId: 2, overrideCategoryId: null },
    ], from, to);
    expect(o.map((x) => x.start.toISOString())).toEqual([
      "2026-09-04T11:30:00.000Z", "2026-09-19T02:00:00.000Z", "2026-09-25T11:30:00.000Z",
    ]);
    const moved = o[1];
    expect(moved.title).toBe("moved"); expect(moved.roomId).toBe(2);
    expect(moved.occurrenceStart.toISOString()).toBe("2026-09-18T11:30:00.000Z");
  });
  it("override moved into window from outside is included once", () => {
    const o = expandSeries(series({}), [
      { id: 3, seriesId: 1, originalStart: T("2026-10-02T19:30:00+08:00"), cancelled: false, overrideStart: T("2026-09-30T19:30:00+08:00"), overrideEnd: null, overrideTitle: null, overrideNote: null, overrideRoomId: null, overrideCategoryId: null },
    ], from, to);
    expect(o).toHaveLength(5);
    expect(o[4].start.toISOString()).toBe("2026-09-30T11:30:00.000Z");
  });
  it("occurrence straddling window start is included", () => {
    const o = expandSeries(series({}), [], T("2026-09-04T20:00:00+08:00"), to);
    expect(o[0].start.toISOString()).toBe("2026-09-04T11:30:00.000Z");
  });
});

describe("truncateRule / seriesEnd", () => {
  const dtstart = T("2026-09-04T19:30:00+08:00");
  it("cuts before cutoff, keeps UNTIL in UTC", () => {
    const r = truncateRule("FREQ=WEEKLY;BYDAY=FR;COUNT=10", dtstart, T("2026-09-18T19:30:00+08:00"))!;
    expect(r).toBe("FREQ=WEEKLY;BYDAY=FR;UNTIL=20260918T112959Z"); // cutoff 11:30:00Z − 1s, COUNT dropped
  });
  it("returns null when only first occurrence remains", () => {
    expect(truncateRule("FREQ=WEEKLY;BYDAY=FR;COUNT=10", dtstart, T("2026-09-11T19:30:00+08:00"))).toBeNull();
  });
  it("seriesEnd bounded vs infinite", () => {
    expect(seriesEnd({ dtstart, dtend: T("2026-09-04T21:30:00+08:00"), rrule: "FREQ=WEEKLY;BYDAY=FR;COUNT=3" })!.toISOString()).toBe("2026-09-18T13:30:00.000Z");
    expect(seriesEnd({ dtstart, dtend: T("2026-09-04T21:30:00+08:00"), rrule: "FREQ=WEEKLY;BYDAY=FR" })).toBeNull();
  });
});
