import { beforeAll, describe, expect, it, vi } from "vitest";

// ponytail: fake session via `x-user` header (id:role); real LINE login covered by POC #5 + user's manual V1–V10
vi.mock("../src/auth", () => ({
  auth: {
    handler: async () => new Response("auth", { status: 200 }),
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const h = headers.get("x-user");
        if (!h) return null;
        const [id, role] = h.split(":");
        return { user: { id, name: `name-${id}`, image: null, role } };
      },
    },
  },
}));

import { app } from "../src/app";
import { db } from "../src/db";
import { migrate } from "../src/migrate";
import { seed } from "../src/seed";
import { user } from "../src/schema";

const iso = (s: string) => new Date(s).toISOString();
const req = (path: string, init: RequestInit = {}, who?: string) =>
  app.request(path, { ...init, headers: { "content-type": "application/json", ...(who ? { "x-user": who } : {}), ...(init.headers ?? {}) } });
const body = { roomId: 1, categoryId: 1, title: "t", start: iso("2026-09-01T10:00:00+08:00"), end: iso("2026-09-01T11:00:00+08:00") };
const RANGE = `/api/bookings?from=${iso("2026-08-01T00:00:00+08:00")}&to=${iso("2026-10-01T00:00:00+08:00")}`;

beforeAll(async () => {
  await migrate(); await seed();
  await db.insert(user).values([
    { id: "m1", name: "name-m1", email: "m1@line.invalid" }, { id: "m2", name: "name-m2", email: "m2@line.invalid" },
    { id: "s1", name: "name-s1", email: "s1@line.invalid", role: "staff" }, { id: "a1", name: "name-a1", email: "a1@line.invalid", role: "admin" },
  ]);
});

describe("dev login", () => {
  it("is 404 unless DEV_LOGIN=1", async () => {
    expect((await req("/api/dev/login", { method: "POST", body: JSON.stringify({ name: "x" }) })).status).toBe(404);
  });
});

describe("auth & roles", () => {
  it("/api/me never returns email", async () => {
    const me = await (await req("/api/me", {}, "m1:member")).json();
    expect(me).toEqual({ id: "m1", name: "name-m1", image: null, role: "member" });
    expect(await (await req("/api/me")).json()).toBeNull();
  });
  it("anonymous: read ok w/o user info; write 401", async () => {
    expect((await req("/api/rooms")).status).toBe(200);
    expect((await req("/api/bookings", { method: "POST", body: JSON.stringify(body) })).status).toBe(401);
  });
  it("member creates; anon list hides user, member sees name+mine; other member cannot edit; staff can", async () => {
    const r = await req("/api/bookings", { method: "POST", body: JSON.stringify(body) }, "m1:member");
    expect(r.status).toBe(201);
    const { id } = await r.json();
    const anon = await (await req(RANGE)).json();
    expect(anon[0].user).toBeNull(); expect(anon[0].mine).toBe(false); expect(anon[0]).not.toHaveProperty("email");
    const mine = await (await req(RANGE, {}, "m1:member")).json();
    expect(mine[0].user).toEqual({ name: "name-m1", image: null }); expect(mine[0].mine).toBe(true);
    const patch = { scope: "all", patch: { title: "x" } };
    // partial booking patch keeps note/rrule (zod4 default trap)
    const weekly = await (await req("/api/bookings", { method: "POST", body: JSON.stringify({ ...body, start: iso("2026-11-01T10:00:00+08:00"), end: iso("2026-11-01T11:00:00+08:00"), note: "keep", rrule: "FREQ=WEEKLY;COUNT=3" }) }, "m1:member")).json();
    const renamed = await (await req(`/api/bookings/${weekly.id}`, { method: "PATCH", body: JSON.stringify(patch) }, "m1:member")).json();
    expect(renamed).toMatchObject({ title: "x", note: "keep", rrule: "FREQ=WEEKLY;COUNT=3" });
    expect((await req(`/api/bookings/${id}`, { method: "PATCH", body: JSON.stringify(patch) }, "m2:member")).status).toBe(403);
    expect((await req(`/api/bookings/${id}`, { method: "PATCH", body: JSON.stringify(patch) }, "s1:staff")).status).toBe(200);
    expect((await req(`/api/bookings/${id}`, { method: "DELETE" }, "m2:member")).status).toBe(403);
    expect((await req(`/api/bookings/${id}`, { method: "DELETE" }, "m1:member")).status).toBe(204);
  });
  it("409 with conflicts; member force ignored; staff force honoured", async () => {
    await req("/api/bookings", { method: "POST", body: JSON.stringify(body) }, "m1:member");
    const dup = { ...body, force: true };
    const r1 = await req("/api/bookings", { method: "POST", body: JSON.stringify(dup) }, "m2:member");
    expect(r1.status).toBe(409);
    expect((await r1.json()).conflicts[0].title).toBe("t");
    expect((await req("/api/bookings", { method: "POST", body: JSON.stringify(dup) }, "s1:staff")).status).toBe(201);
  });
  it("validation 400; admin routes 403 for staff, ok for admin", async () => {
    expect((await req("/api/bookings", { method: "POST", body: JSON.stringify({ ...body, end: body.start }) }, "m1:member")).status).toBe(400);
    expect((await req("/api/bookings?from=x&to=y")).status).toBe(400);
    const room = { name: "新房間", colorToken: "room-3" };
    expect((await req("/api/admin/rooms", { method: "POST", body: JSON.stringify(room) }, "s1:staff")).status).toBe(403);
    const r = await req("/api/admin/rooms", { method: "POST", body: JSON.stringify(room) }, "a1:admin");
    expect(r.status).toBe(201);
    const { id } = await r.json();
    await req(`/api/admin/rooms/${id}`, { method: "PATCH", body: JSON.stringify({ sort: 42, allowOverlap: true }) }, "a1:admin");
    const patched = await (await req(`/api/admin/rooms/${id}`, { method: "PATCH", body: JSON.stringify({ active: false }) }, "a1:admin")).json();
    expect(patched).toMatchObject({ active: false, sort: 42, allowOverlap: true }); // partial patch must not reset other fields (zod4 default trap)
    expect((await (await req("/api/admin/users/m2", { method: "PATCH", body: JSON.stringify({ role: "staff" }) }, "a1:admin")).json()).role).toBe("staff");
    const users = await (await req("/api/admin/users", {}, "a1:admin")).json();
    expect(users.find((u: any) => u.id === "m2")).not.toHaveProperty("email");
  });
});
