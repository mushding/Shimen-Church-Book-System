import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { app } from "./app";
import { migrate } from "./migrate";
import { seed } from "./seed";

await migrate();
await seed();

// Production: one process serves /api/* and the built SPA (WEB_DIST=apps/web/dist). Dev: vite proxies to us.
const root = new Hono().route("/", app).get("/healthz", (c) => c.text("ok"));
if (process.env.WEB_DIST) {
  const dist = process.env.WEB_DIST;
  root.use("/assets/*", serveStatic({ root: dist }));
  root.use("*", serveStatic({ root: dist })); // exact files (favicon etc.)
  root.get("*", serveStatic({ root: dist, path: "index.html" })); // SPA fallback
}

serve({ fetch: root.fetch, port: Number(process.env.PORT ?? 3000), hostname: "0.0.0.0" }, (i) => console.log(`api on http://localhost:${i.port}`));
