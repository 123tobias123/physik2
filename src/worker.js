// physik2 – API für Punkte und Bestenliste. Alles außer /api/* liefert Cloudflare direkt aus ./public.

const GAMES = {
  // Höchstpunktzahl pro Spiel (Schutz gegen unsinnige Werte)
  spukvilla: { max: 30000 },
};

let ready = false;
async function init(db) {
  if (ready) return;
  await db.exec(
    "CREATE TABLE IF NOT EXISTS scores (id INTEGER PRIMARY KEY AUTOINCREMENT, game TEXT NOT NULL, name TEXT NOT NULL, name_key TEXT NOT NULL, score INTEGER NOT NULL, correct INTEGER, total INTEGER, created_at INTEGER NOT NULL)"
  );
  await db.exec("CREATE INDEX IF NOT EXISTS idx_scores_game ON scores (game, created_at)");
  ready = true;
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function cleanName(raw) {
  const n = String(raw || "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
  return n.length >= 2 ? n : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    try {
      await init(env.DB);

      if (url.pathname === "/api/scores" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const game = String(body.game || "");
        if (!GAMES[game]) return json({ error: "Unbekanntes Spiel" }, 400);
        const name = cleanName(body.name);
        if (!name) return json({ error: "Bitte einen Namen mit mindestens 2 Zeichen angeben." }, 400);
        const score = Math.round(Number(body.score));
        if (!Number.isFinite(score) || score < 0 || score > GAMES[game].max)
          return json({ error: "Ungültige Punktzahl" }, 400);
        const correct = Math.max(0, Math.min(999, Math.round(Number(body.correct) || 0)));
        const total = Math.max(0, Math.min(999, Math.round(Number(body.total) || 0)));
        await env.DB.prepare(
          "INSERT INTO scores (game, name, name_key, score, correct, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
          .bind(game, name, name.toLowerCase(), score, correct, total, Date.now())
          .run();
        return json({ ok: true, name });
      }

      if (url.pathname === "/api/leaderboard" && request.method === "GET") {
        const game = url.searchParams.get("game") || "";
        if (!GAMES[game]) return json({ error: "Unbekanntes Spiel" }, 400);
        const since = Number(url.searchParams.get("since")) || 0;
        const { results } = await env.DB.prepare(
          `SELECT s.name AS name, s.score AS score, s.correct AS correct, s.total AS total, s.created_at AS at
           FROM scores s
           JOIN (SELECT name_key, MAX(score) AS best FROM scores WHERE game = ?1 AND created_at >= ?2 GROUP BY name_key) b
             ON s.name_key = b.name_key AND s.score = b.best
           WHERE s.game = ?1 AND s.created_at >= ?2
           GROUP BY s.name_key
           ORDER BY s.score DESC, s.created_at ASC
           LIMIT 20`
        )
          .bind(game, since)
          .all();
        return json({ entries: results });
      }

      return json({ error: "Nicht gefunden" }, 404);
    } catch (e) {
      return json({ error: "Serverfehler" }, 500);
    }
  },
};
