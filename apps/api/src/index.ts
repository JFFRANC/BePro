import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "./types.js";
import authRoutes from "./modules/auth/routes.js";
import { usersRoutes } from "./modules/users/routes.js";
import { clientsRoutes } from "./modules/clients/routes.js";

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

// Resolver URLs de Google Maps a coordenadas
app.get("/api/utils/resolve-map-url", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.json({ error: "URL requerida" }, 400);

  try {
    const parsed = new URL(url);
    const allowedHosts = [
      "share.google",
      "maps.google.com",
      "www.google.com",
      "google.com",
      "goo.gl",
      "maps.app.goo.gl",
    ];
    if (!allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
      return c.json({ error: "Solo se aceptan URLs de Google Maps" }, 400);
    }

    // Seguir redirects para resolver short URLs
    const res = await fetch(url, { redirect: "follow" });
    const finalUrl = res.url;

    // 1. Extraer coordenadas directamente del URL final
    const coordPatterns = [
      /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
    ];

    for (const pattern of coordPatterns) {
      const match = finalUrl.match(pattern);
      if (match) {
        return c.json({
          latitude: parseFloat(match[1]),
          longitude: parseFloat(match[2]),
          resolvedUrl: finalUrl,
        });
      }
    }

    // 2. Determinar nombre del lugar desde q= o desde /maps/place/...
    const finalParsed = new URL(finalUrl);
    const queryParam = finalParsed.searchParams.get("q");
    const placeMatch = finalParsed.pathname.match(/\/maps\/place\/([^/]+)/);
    const rawPlaceName = queryParam
      ?? (placeMatch ? decodeURIComponent(placeMatch[1]).replace(/\+/g, " ") : null);

    if (rawPlaceName && !/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(rawPlaceName)) {
      const placeName = rawPlaceName.replace(/\+/g, " ");

      // Buscar coordenadas en el HTML de la URL resuelta o en una búsqueda de Maps
      const htmlSources = [
        finalUrl,
        `https://www.google.com/maps/search/${encodeURIComponent(placeName)}`,
      ];

      for (const htmlUrl of htmlSources) {
        try {
          const mapsRes = await fetch(htmlUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" },
          });
          const mapsHtml = await mapsRes.text();
          const coordMatches = mapsHtml.match(/([-]?\d{1,3}\.\d{5,})/g);
          if (coordMatches && coordMatches.length >= 2) {
            const candidates = coordMatches.map(Number);
            for (let i = 0; i < candidates.length - 1; i++) {
              const lat = candidates[i];
              const lng = candidates[i + 1];
              if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && Math.abs(lng) > 1 && lat !== lng) {
                return c.json({
                  latitude: lat,
                  longitude: lng,
                  address: placeName,
                  resolvedUrl: finalUrl,
                });
              }
            }
          }
        } catch {
          // Continuar con la siguiente fuente
        }
      }

      // Fallback: intentar Nominatim
      const nominatimRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}&limit=1&accept-language=es`,
        { headers: { "User-Agent": "BePro/1.0" } },
      );
      const results = await nominatimRes.json() as Array<{ lat: string; lon: string; display_name: string }>;
      if (Array.isArray(results) && results.length > 0) {
        return c.json({
          latitude: parseFloat(results[0].lat),
          longitude: parseFloat(results[0].lon),
          address: results[0].display_name,
          resolvedUrl: finalUrl,
        });
      }
    }

    return c.json({ error: "No se pudieron extraer coordenadas de la URL" }, 422);
  } catch {
    return c.json({ error: "No se pudo resolver la URL" }, 422);
  }
});

app.route("/api/auth", authRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/clients", clientsRoutes);

export default app;
