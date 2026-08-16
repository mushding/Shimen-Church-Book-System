import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { bookingDelete, bookingInput, bookingPatch, categoryInput, roleSchema, roomInput, type BookingInstance, type Role } from "@smsk/shared";
import { auth } from "./auth";
import { db } from "./db";
import { category, room, user } from "./schema";
import { ConflictError, NotFound, createSeries, deleteSeries, listOccurrences, patchSeries } from "./bookings";
import { bookingSeries } from "./schema";

type User = (typeof auth.$Infer.Session)["user"] & { role?: Role | null };
type Env = { Variables: { user: User | null } };

const RANK: Record<Role, number> = { member: 0, staff: 1, admin: 2 };
const roleOf = (u: User | null) => (u?.role ?? "member") as Role;
const atLeast = (u: User | null, min: Role) => !!u && RANK[roleOf(u)] >= RANK[min];

const requireRole = (min: Role) =>
  createMiddleware<Env>(async (c, next) => {
    const u = c.get("user");
    if (!u) return c.json({ error: "unauthenticated" }, 401);
    if (!atLeast(u, min)) return c.json({ error: "forbidden" }, 403);
    await next();
  });

const idParam = zValidator("param", z.object({ id: z.coerce.number().int() }));
const range = zValidator("query", z.object({ from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }) }));

const DEV_LOGIN = process.env.DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";

export const app = new Hono<Env>()
  .on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  // dev/e2e helper: POST {name, role} → session cookie. Only when DEV_LOGIN=1.
  .post("/api/dev/login", zValidator("json", z.object({ name: z.string().min(1), role: roleSchema.default("member") })), async (c) => {
    if (!DEV_LOGIN) return c.json({ error: "not_found" }, 404);
    const { name, role } = c.req.valid("json");
    const email = `dev-${Buffer.from(name).toString("hex")}@dev.local`, password = "dev-password-123";
    let headers: Headers;
    try { headers = (await auth.api.signInEmail({ body: { email, password }, returnHeaders: true })).headers; }
    catch { headers = (await auth.api.signUpEmail({ body: { email, password, name }, returnHeaders: true })).headers; }
    await db.update(user).set({ role }).where(eq(user.email, email));
    for (const v of headers.getSetCookie()) c.header("set-cookie", v, { append: true });
    return c.json({ ok: true, name, role });
  })
  .use("*", async (c, next) => {
    const s = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set("user", (s?.user as User) ?? null);
    await next();
  })
  .onError((e, c) => {
    if (e instanceof ConflictError) return c.json({ error: "conflict", conflicts: e.conflicts }, 409);
    if (e instanceof NotFound) return c.json({ error: "not_found" }, 404);
    console.error(e);
    return c.json({ error: "internal" }, 500);
  })

  .get("/api/me", (c) => { const u = c.get("user"); return c.json(u ? { id: u.id, name: u.name, image: u.image ?? null, role: roleOf(u) } : null); })
  .get("/api/rooms", async (c) => c.json(await db.select().from(room).orderBy(room.sort, room.id)))
  .get("/api/categories", async (c) => c.json(await db.select().from(category).orderBy(category.sort, category.id)))

  // public: names/images only for logged-in viewers; email never leaves the API
  .get("/api/bookings", range, async (c) => {
    const { from, to } = c.req.valid("query");
    const me = c.get("user");
    const { occurrences, users } = await listOccurrences(db, new Date(from), new Date(to));
    const out: BookingInstance[] = occurrences.map((o) => ({
      id: `${o.seriesId}:${o.occurrenceStart.toISOString()}`,
      seriesId: o.seriesId, occurrenceStart: o.occurrenceStart.toISOString(),
      start: o.start.toISOString(), end: o.end.toISOString(),
      title: o.title, note: o.note, roomId: o.roomId, categoryId: o.categoryId, recurring: o.recurring,
      rrule: o.rrule, seriesStart: o.seriesStart.toISOString(), seriesEnd: o.seriesEnd.toISOString(),
      userId: o.userId, mine: !!me && me.id === o.userId,
      user: me ? (users.get(o.userId) ?? null) : null,
    }));
    return c.json(out);
  })
  .post("/api/bookings", requireRole("member"), zValidator("json", bookingInput), async (c) => {
    const me = c.get("user")!;
    const b = c.req.valid("json");
    const s = await createSeries(db, me.id, b, b.force && atLeast(me, "staff"));
    return c.json(s, 201);
  })
  .patch("/api/bookings/:id", requireRole("member"), idParam, zValidator("json", bookingPatch), async (c) => {
    const me = c.get("user")!;
    const { id } = c.req.valid("param");
    if (!(await canEdit(me, id))) return c.json({ error: "forbidden" }, 403);
    const p = c.req.valid("json");
    return c.json(await patchSeries(db, id, p, p.force && atLeast(me, "staff")));
  })
  .delete("/api/bookings/:id", requireRole("member"), idParam, zValidator("query", bookingDelete), async (c) => {
    const me = c.get("user")!;
    const { id } = c.req.valid("param");
    if (!(await canEdit(me, id))) return c.json({ error: "forbidden" }, 403);
    const { scope, occurrenceStart } = c.req.valid("query");
    await deleteSeries(db, id, scope, occurrenceStart);
    return c.body(null, 204);
  })

  // admin
  .post("/api/admin/rooms", requireRole("admin"), zValidator("json", roomInput), async (c) =>
    c.json((await db.insert(room).values(c.req.valid("json")).returning())[0], 201))
  .patch("/api/admin/rooms/:id", requireRole("admin"), idParam, zValidator("json", roomInput.partial()), async (c) =>
    c.json((await db.update(room).set(c.req.valid("json")).where(eq(room.id, c.req.valid("param").id)).returning())[0]))
  .post("/api/admin/categories", requireRole("admin"), zValidator("json", categoryInput), async (c) =>
    c.json((await db.insert(category).values(c.req.valid("json")).returning())[0], 201))
  .patch("/api/admin/categories/:id", requireRole("admin"), idParam, zValidator("json", categoryInput.partial()), async (c) =>
    c.json((await db.update(category).set(c.req.valid("json")).where(eq(category.id, c.req.valid("param").id)).returning())[0]))
  .get("/api/admin/users", requireRole("admin"), async (c) =>
    c.json(await db.select({ id: user.id, name: user.name, image: user.image, role: user.role, createdAt: user.createdAt }).from(user)))
  .patch("/api/admin/users/:id", requireRole("admin"), zValidator("param", z.object({ id: z.string() })), zValidator("json", z.object({ role: roleSchema })), async (c) =>
    c.json((await db.update(user).set({ role: c.req.valid("json").role }).where(eq(user.id, c.req.valid("param").id)).returning()).map((u) => ({ id: u.id, role: u.role }))[0]));

async function canEdit(me: User, seriesId: number) {
  if (atLeast(me, "staff")) return true;
  const s = await db.query.bookingSeries.findFirst({ where: eq(bookingSeries.id, seriesId), columns: { userId: true } });
  if (!s) throw new NotFound();
  return s.userId === me.id;
}

export type AppType = typeof app;
