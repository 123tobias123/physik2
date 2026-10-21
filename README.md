# physik2

Lernspiele für Physik, 2. Klasse (MS Renngasse, Herr Beetz).
Live: https://physik2.herrbeetz.workers.dev

- `public/index.html` – Übersicht
- `public/spukvilla/` – Die Spukvilla (Halloween: Wissenschaft, Sehen, Licht, Schatten)

Hosting: Cloudflare Worker `physik2` (`src/worker.js` für `/api/*`, sonst statische Dateien aus `public/`), mit GitHub verbunden – jeder Push auf `main` wird automatisch deployt.

Datenbank: Cloudflare D1 `physik2-db` (EU). Die Tabelle `scores` legt der Worker selbst an.

API: `POST /api/scores` {game, name, score, correct, total} · `GET /api/leaderboard?game=…&since=<ms>` (beste Runde je Name, Top 20).
