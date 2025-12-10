
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

const TMDB_API_KEY = process.env.TMDB_API_KEY; // Use env variable
const TMDB_BASE = "https://api.themoviedb.org/3";

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
    res.status(500).json({ error: "Proxy failed", details: err.message });
  }
});

const PORT = process.env.PORT || 10000; // Render sets PORT
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
