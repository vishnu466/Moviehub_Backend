
// server/server.js
// Node >= 18 has global fetch. If Node < 18, run: npm i node-fetch and import it.
import express from "express";
import cors from "cors";

const app = express();
app.use(cors()); // allow all origins in dev

// Keep your TMDB key server-side in production.
// For now, hardcoded for simplicity. Replace with process.env.TMDB_API_KEY later.
const TMDB_API_KEY = "7864738b5f6f50a0a6243b69fff6d05c"; // <-- ensure correct, no extra chars
const TMDB_BASE = "https://api.themoviedb.org/3";

// Simple proxy: forwards to TMDB
app.get("/api/movies/now_playing", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const url = `${TMDB_BASE}/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`;

    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(r.status).json({ error: "TMDB error", details: text || r.statusText });
    }

    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy failed", details: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
