
// server.js
import express from "express";
import cors from "cors";
// If your Render runtime is Node < 18, uncomment the next line and add `node-fetch` to dependencies.
// import fetch from "node-fetch";

const app = express();

// CORS: During development, '*' is fine. In production, set CORS_ALLOW_ORIGIN to your frontend URL.
app.use(cors({
  origin: process.env.CORS_ALLOW_ORIGIN || "*",
}));

const TMDB_API_KEY = process.env.TMDB_API_KEY; // v3 API key via query param
const TMDB_BASE = "https://api.themoviedb.org/3";

/**
 * GET /api/movies/now_playing?page=1
 * Server-side call to TMDB's Now Playing endpoint.
 */
app.get("/api/movies/now_playing", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const url = `${TMDB_BASE}/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`;

    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res
        .status(r.status)
        .json({ error: "TMDB error", details: text || r.statusText });
    }

    const data = await r.json();
    // Cache for 60s to ease load
    res.set("Cache-Control", "public, max-age=60");
    res.json(data);
  } catch (err) {
    console.error("[NOW PLAYING EXCEPTION]", err);
    res.status(500).json({ error: "Proxy failed", details: err.message });
  }
});

/**
 * GET /api/image?path=/<file_path>&size=w500
 * Streams TMDB images to the browser from YOUR domain.
 * Required: path starts with "/"
 * Optional: size in {w92, w154, w185, w342, w500, w780, original} — default w500
 */
app.get("/api/image", async (req, res) => {
  try {
    const path = req.query.path;
    const size = String(req.query.size || "w500");

    if (!path || typeof path !== "string" || !path.startswith("/")) {
      return res.status(400).send('Invalid "path". It must start with "/".');
    }

    const tmdbUrl = `https://image.tmdb.org/t/p/${size}${path}`;

    const upstream = await fetch(tmdbUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "image/*",
        // Helpful for some CDNs/WAFs
        "User-Agent": "MovieHub-Image-Proxy/1.0 (+https://render.com)",
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => upstream.statusText);
      // Forward the upstream status (403/404/etc.) to aid debugging
      return res
        .status(upstream.status)
        .send(`TMDB responded ${upstream.status}: ${text || upstream.statusText}`);
    }

    const ctype = upstream.headers.get("content-type") || "image/jpeg";
    res.set("Content-Type", ctype);
    // Posters rarely change—cache for a day
    res.set("Cache-Control", "public, max-age=86400");

    upstream.body.pipe(res);
  } catch (err) {
    console.error("[IMAGE PROXY EXCEPTION]", err);
    res.status(502).send("Bad gateway: failed to fetch TMDB image.");
  }
});

const PORT = process.env.PORT || 10000; // Render injects PORT
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
