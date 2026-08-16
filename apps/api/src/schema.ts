import { pgTable, serial, text, integer, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./schema.auth";

export * from "./schema.auth";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const room = pgTable("room", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  colorToken: text("color_token").notNull(), // room-N → bg-room-N
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const category = pgTable("category", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  colorToken: text("color_token").notNull(), // cat-N
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

/** One booking = one series. Non-recurring series has rrule = null (single occurrence at dtstart). */
export const bookingSeries = pgTable(
  "booking_series",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id),
    roomId: integer("room_id").notNull().references(() => room.id),
    categoryId: integer("category_id").notNull().references(() => category.id),
    title: text("title").notNull(),
    note: text("note").notNull().default(""),
    dtstart: ts("dtstart").notNull(),
    dtend: ts("dtend").notNull(), // end of first occurrence; duration = dtend - dtstart
    rrule: text("rrule"), // RRULE body w/o DTSTART; UNTIL in UTC (Z)
    legacyId: integer("legacy_id").unique(), // old Appointment.pkId (migration idempotency)
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("booking_series_room_idx").on(t.roomId, t.dtstart), index("booking_series_user_idx").on(t.userId)],
);

/** Per-occurrence deviation: cancelled, or moved/retitled (override_* non-null). */
export const bookingException = pgTable(
  "booking_exception",
  {
    id: serial("id").primaryKey(),
    seriesId: integer("series_id").notNull().references(() => bookingSeries.id, { onDelete: "cascade" }),
    originalStart: ts("original_start").notNull(),
    cancelled: boolean("cancelled").notNull().default(false),
    overrideStart: ts("override_start"),
    overrideEnd: ts("override_end"),
    overrideTitle: text("override_title"),
    overrideNote: text("override_note"),
    overrideRoomId: integer("override_room_id").references(() => room.id),
    overrideCategoryId: integer("override_category_id").references(() => category.id),
  },
  (t) => [uniqueIndex("booking_exception_slot").on(t.seriesId, t.originalStart)],
);

export type Room = typeof room.$inferSelect;
export type Category = typeof category.$inferSelect;
export type Series = typeof bookingSeries.$inferSelect;
export type Exception = typeof bookingException.$inferSelect;
