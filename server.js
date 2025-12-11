
import express from "express";
import cors from "cors";
// If your Render service uses Node 18+, `fetch` is available globally.
// If not, uncomment the next line and add node-fetch to dependencies.
// import fetch from "node-fetch";

const app = express();
app.use(cors());

const TMDB_API_KEY = process.env.TMDB_API_KEY; // v3 API key (query param auth)
const TMDB_BASE = "https://api.themoviedb.org/3";

/**
 * Existing: Now Playing
 * GET /api/movies/now_playing?page=1
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
    // Optional cache header
    res.set("Cache-Control", "public, max-age=60");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Proxy failed", details: err.message });
  }
});

/**
 * NEW: TMDB Image Proxy
 * GET /api/image?path=/bjUWGw0Ao0qVWxagN3VCwBJHVo6.jpg&size=w500
 *
 * - path: required, must start with '/'
 * - size: one of w92, w154, w185, w342, w500, w780, original (default: w500)
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
        // Some CDNs/WAFs are friendlier with a UA
        "User-Agent": "TMDB-Proxy/1.0 (+https://render.com)",
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => upstream.statusText);
      // Forward upstream status directly—helps you see 403/404 instead of 500
      return res
        .status(upstream.status)
        .send(`TMDB responded ${upstream.status}: ${text || upstream.statusText}`);
    }

    const ctype = upstream.headers.get("content-type") || "image/jpeg";
    res.set("Content-Type", ctype);
    // Cache images for a day (tune as needed)
    res.set("Cache-Control", "public, max-age=86400");

    // Stream the image body to the client
    upstream.body.pipe(res);
  } catch (err) {
    console.error("[IMAGE PROXY EXCEPTION]", err);
    res.status(502).send("Bad gateway: failed to fetch TMDB image.");
  }
});

const PORT = process.env.PORT || 10000; // Render sets PORT
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
