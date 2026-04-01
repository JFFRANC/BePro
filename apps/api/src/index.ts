import { Hono } from "hono";
import type { HonoEnv } from "./types.js";

const app = new Hono<HonoEnv>();

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

export default app;
