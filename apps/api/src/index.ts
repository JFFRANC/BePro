import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "./types.js";
import authRoutes from "./modules/auth/routes.js";

const app = new Hono<HonoEnv>();

app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = [
        "http://localhost:5173",
        "https://bepro-web.pages.dev",
      ];
      // Allow all Pages preview/deployment URLs
      if (origin?.endsWith(".bepro-web.pages.dev")) return origin;
      if (allowed.includes(origin)) return origin;
      return allowed[0];
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.route("/api/auth", authRoutes);

export default app;
