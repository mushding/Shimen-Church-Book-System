import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { auth } from "./auth";
import { migrate } from "./migrate";

type Vars = { user: (typeof auth.$Infer.Session)["user"] | null };
const app = new Hono<{ Variables: Vars }>();

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use("*", async (c, next) => {
  const s = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", s?.user ?? null);
  await next();
});

const RANK = { member: 0, staff: 1, admin: 2 } as const;
type Role = keyof typeof RANK;
const requireRole = (min: Role) =>
  async (c: any, next: any) => {
    const u = c.get("user");
    if (!u) return c.json({ error: "unauthenticated" }, 401);
    if (RANK[(u.role as Role) ?? "member"] < RANK[min]) return c.json({ error: "forbidden" }, 403);
    await next();
  };

// POC 路由：V8 公開讀 / V6 role
app.get("/api/appointments", (c) => c.json({ ok: true, public: true, user: c.get("user")?.name ?? null }));
app.get("/api/me", requireRole("member"), (c) => c.json(c.get("user")));
app.get("/api/admin/ping", requireRole("admin"), (c) => c.json({ admin: true }));

await migrate();
serve({ fetch: app.fetch, port: 3000 }, () => console.log("api on http://localhost:3000"));
