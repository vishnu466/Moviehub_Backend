
// server.js
import express from "express";
import cors from "cors";

const app = express();

// CORS: set to your frontend origin in production.
app.use(cors({
  origin: process.env.CORS_ALLOW_ORIGIN || "*",
}));

const TMDB_API_KEY = process.env.TMDB_API_KEY; // v3 API key via query param
const TMDB_BASE = "https://api.themoviedb.org/3";

/**
 * GET /api/movies/now_playing?page=1
 * Server-side call to TMDB "Now Playing".
 */
app.get("/api/movies/now_playing", async (req, res) => {
  try {
    if (!TMDB_API_KEY) {
      return res.status(500).json({ error: "Missing TMDB_API_KEY env variable" });
    }

    const page = Number(req.query.page || 1);
    const url = `${TMDB_BASE}/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`;

    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(r.status).json({ error: "TMDB error", details: text || r.statusText });
    }

    const data = await r.json();
    res.set("Cache-Control", "public, max-age=60");
    res.json(data);
  } catch (err) {
    console.error("[NOW PLAYING EXCEPTION]", err);
    res.status(500).json({ error: "Proxy failed", details: err.message });
  }
});

/**
 * GET /api/image?path=/<file_path>&size=w500
 * Streams TMDB images from *your* domain to the browser.
 * - path: required, must start with '/'
 * - size: w92|w154|w185|w342|w500|w780|original (default: w500)
 */
app.get("/api/image", async (req, res) => {
  try {
    const path = req.query.path;
    const size = String(req.query.size || "w500");

    if (!path || typeof path !== "string" || !path.startsWith("/")) {
      return res.status(400).send('Invalid "path". It must start with "/".');
    }

    const tmdbUrl = `https://image.tmdb.org/t/p/${size}${path}`;

    const upstream = await fetch(tmdbUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "image/*",
        "User-Agent": "MovieHub-Image-Proxy/1.0 (+https://render.com)",
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => upstream.statusText);
      return res.status(upstream.status).send(`TMDB responded ${upstream.status}: ${text || upstream.statusText}`);
    }

    const ctype = upstream.headers.get("content-type") || "image/jpeg";
    res.set("Content-Type", ctype);
    res.set("Cache-Control", "public, max-age=86400"); // 1 day cache

    upstream.body.pipe(res);
  } catch (err) {
    console.error("[IMAGE PROXY EXCEPTION]", err);
    res.status(502).send("Bad gateway: failed to fetch TMDB image.");
  }
});

const PORT = process.env.PORT || 10000; // Render injects PORT
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
