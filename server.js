
// server.js
import express from "express";
import cors from "cors";
import { Readable } from "stream"; // Needed to convert Web streams to Node streams

const app = express();

// CORS: during development you can leave "*".
// In production, set CORS_ALLOW_ORIGIN to your frontend URL.
app.use(
  cors({
    origin: process.env.CORS_ALLOW_ORIGIN || "*",
  })
);

const TMDB_API_KEY = process.env.TMDB_API_KEY; // v3 API key via query param
const TMDB_BASE = "https://api.themoviedb.org/3";

// Health check
app.get("/", (_req, res) => res.send("OK"));

/**
 * GET /api/movies/now_playing?page=1
 * Server-side fetch to TMDB "Now Playing"
 */
app.get("/api/movies/now_playing", async (req, res) => {
  try {
    if (!TMDB_API_KEY) {
      return res
        .status(500)
        .json({ error: "Missing TMDB_API_KEY environment variable" });
    }

    const page = Number(req.query.page || 1);
    const url = `${TMDB_BASE}/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`;

    const r = await fetch(url);
    const text = await r.text().catch(() => "");

    if (!r.ok) {
      // Forward upstream status for transparency
      return res
        .status(r.status)
        .json({ error: "TMDB error", details: text || r.statusText });
    }

    // Successful
    res.set("Cache-Control", "public, max-age=60");
    res.type("application/json").send(text);
  } catch (err) {
    console.error("[NOW PLAYING EXCEPTION]", err);
    res.status(502).json({ error: "Bad gateway", details: err.message });
  }
});

/**
 * GET /api/image?path=/<file_path>&size=w500
 * Streams TMDB images to the browser from YOUR domain.
 * Required: path starts with "/"
 * Optional: size in {w92, w154, w185, w342, w500, w780, original} — default w500
 *
 * IMPORTANT: When testing in browser/terminal, use '&' (ampersand), NOT '&amp;'.
 * Example:
 *   /api/image?path=%2FbjUWGw0Ao0qVWxagN3VCwBJHVo6.jpg&size=w500
 */
app.get("/api/image", async (req, res) => {
  try {
    const path = req.query.path;
    const size = String(req.query.size || "w500");

    // Validate input (JavaScript's startsWith — not Python's startswith)
    if (!path || typeof path !== "string" || !path.startsWith("/")) {
      return res.status(400).send('Invalid "path". It must start with "/".');
    }

    // Build canonical TMDB image URL: secure_base_url + size + file_path
    const tmdbUrl = `https://image.tmdb.org/t/p/${size}${path}`;

    // Fetch upstream image — Web stream in Node 18+
    const upstream = await fetch(tmdbUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "image/*",
        "User-Agent": "MovieHub-Image-Proxy/1.0 (+https://render.com)",
      },
    });

    // Forward upstream non-200 status
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => upstream.statusText);
      console.error(
        "[UPSTREAM IMAGE ERROR]",
        upstream.status,
        upstream.statusText,
        tmdbUrl,
        text?.slice(0, 200)
      );
      return res
        .status(upstream.status)
        .send(`TMDB responded ${upstream.status}: ${text || upstream.statusText}`);
    }

    // Set headers before streaming
    const ctype = upstream.headers.get("content-type") || "image/jpeg";
    res.set("Content-Type", ctype);
    res.set("Cache-Control", "public, max-age=86400"); // cache 1 day

    // Convert Web ReadableStream => Node Readable and pipe
    if (upstream.body) {
      const nodeStream = Readable.fromWeb(upstream.body);
      nodeStream.on("error", (err) => {
        console.error("[IMAGE STREAM ERROR]", err);
        if (!res.headersSent) res.status(502);
        res.end("Stream error");
      });
      nodeStream.pipe(res);
      return;
    }

    // Fallback (rare): upstream had no body — send buffer
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.end(buffer);
  } catch (err) {
    console.error("[IMAGE PROXY EXCEPTION]", err);
    res.status(502).send("Bad gateway: failed to fetch TMDB image.");
  }
});

const PORT = process.env.PORT || 10000; // Render injects PORT
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
