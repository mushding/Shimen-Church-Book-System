import { serve } from "@hono/node-server";
import { app } from "./app";
import { migrate } from "./migrate";
import { seed } from "./seed";

await migrate();
await seed();
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) }, (i) => console.log(`api on http://localhost:${i.port}`));
