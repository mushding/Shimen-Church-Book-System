import { z } from "zod";

// ---- roles ----
export const ROLES = ["member", "staff", "admin"] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

// ---- rooms / categories (admin-maintained) ----
export const roomInput = z.object({
  name: z.string().trim().min(1).max(40),
  colorToken: z.string().regex(/^room-[a-z0-9-]+$/), // maps to `bg-room-N` in @smsk/ui
  sort: z.number().int().default(0),
  active: z.boolean().default(true),
  allowOverlap: z.boolean().default(false), // e.g. 教會室外 — never conflicts
});
export type RoomInput = z.infer<typeof roomInput>;
export const room = roomInput.extend({ id: z.number().int() });
export type Room = z.infer<typeof room>;

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(40),
  colorToken: z.string().regex(/^cat-[a-z0-9-]+$/), // bg-cat-church …,
  sort: z.number().int().default(0),
  active: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categoryInput>;
export const category = categoryInput.extend({ id: z.number().int() });
export type Category = z.infer<typeof category>;

// ---- bookings ----
const isoDate = z.iso.datetime({ offset: true });

/** RRULE body without DTSTART, e.g. "FREQ=WEEKLY;BYDAY=FR;UNTIL=20261231T160000Z" */
export const rruleBody = z
  .string()
  .trim()
  .regex(/^(RRULE:)?FREQ=/i, "must start with FREQ=")
  .transform((s) => s.replace(/^RRULE:/i, ""));

const bookingFields = z.object({
  roomId: z.number().int(),
  categoryId: z.number().int(),
  title: z.string().trim().min(1).max(60),
  note: z.string().max(2000).default(""),
  start: isoDate,
  end: isoDate,
  rrule: rruleBody.nullable().default(null),
});
const endAfterStart = { message: "end must be after start", path: ["end"] };
export const bookingInput = bookingFields
  .extend({ force: z.boolean().default(false) }) // staff/admin: ignore conflicts
  .refine((b) => new Date(b.end) > new Date(b.start), endAfterStart);
export type BookingInput = z.infer<typeof bookingInput>;

export const EDIT_SCOPES = ["this", "following", "all"] as const;
export type EditScope = (typeof EDIT_SCOPES)[number];

export const bookingPatch = z.object({
  scope: z.enum(EDIT_SCOPES).default("all"),
  /** required when scope != all: which occurrence (its original start) */
  occurrenceStart: isoDate.optional(),
  patch: bookingFields.partial().refine((b) => !b.start || !b.end || new Date(b.end) > new Date(b.start), endAfterStart),
  force: z.boolean().default(false),
});
export type BookingPatch = z.infer<typeof bookingPatch>;

export const bookingDelete = z.object({
  scope: z.enum(EDIT_SCOPES).default("all"),
  occurrenceStart: isoDate.optional(),
});

/** One calendar instance (series expanded server-side). */
export type BookingInstance = {
  id: string; // `${seriesId}:${occurrenceStartISO}`
  seriesId: number;
  occurrenceStart: string; // original slot (key for this/following edits)
  start: string;
  end: string;
  title: string;
  note: string;
  roomId: number;
  categoryId: number;
  recurring: boolean;
  rrule: string | null; // series rule (null = single)
  seriesStart: string; // series dtstart / dtend — needed for scope=all edits
  seriesEnd: string;
  userId: string;
  /** null when viewer not logged in */
  user: { name: string; image: string | null } | null;
  mine: boolean;
};

export type Conflict = { seriesId: number; title: string; start: string; end: string; roomId: number };
export type ConflictError = { error: "conflict"; conflicts: Conflict[] };
