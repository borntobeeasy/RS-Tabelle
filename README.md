# Rasenschach — Beobachter-Seite (für GitHub Pages)

Das hier ist NUR die öffentliche Beobachter-Ansicht (Spieltage, Tabelle, Figuren-Leaderboard).
Es gibt hier keinen Admin-Bereich und keine Speicherung — die Daten werden live von deinem
Heimserver abgerufen.

## Einrichtung

1. Trage in `config.js` die öffentliche Adresse deines Heimservers ein, z.B. die
   Tailscale-Funnel-URL:

   ```js
   window.RS_API_BASE = "https://dein-server.deinname.ts.net";
   ```

   **Ohne Schrägstrich am Ende!**

2. Lege ein neues GitHub-Repository an (z.B. `rasenschach-public`) und lade alle Dateien aus
   diesem Ordner hoch (`index.html`, `styles.css`, `shared.js`, `app-public.js`, `config.js`,
   das Logo).

3. Im Repository: **Settings → Pages → Branch: main, Ordner: / (root)** auswählen und
   speichern.

4. Nach ein paar Minuten ist die Seite unter
   `https://<dein-github-name>.github.io/rasenschach-public/` erreichbar — von überall.

## Wichtig

- Diese Seite funktioniert nur, solange dein Heimserver läuft und über die in `config.js`
  eingetragene Adresse erreichbar ist.
- Der Admin-Bereich (`admin.html`) gehört **nicht** in dieses Repository — er bleibt
  ausschließlich auf deinem Heimserver und ist zusätzlich durch das Admin-Passwort geschützt.
