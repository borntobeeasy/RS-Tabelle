# Rasenschach — 2. Bundesliga 2026/27 (statische GitHub-Pages-Version)

Komplett statische Website: kein Server, kein Backend. Der echte Spielplan der 2. Bundesliga
2026/27 (alle 34 Spieltage, 306 Spiele, offizielle DFL-Daten vom 02.07.2026) ist fest eingebaut.
Für jedes Spiel lädst du eine JSON-Datei mit der fertigen Rasenschach-Auswertung in den
passenden Spieltag-Ordner hoch — die Seite erkennt sie automatisch und zeigt Brett, Ergebnis,
Tabelle und Figuren-Leaderboard an.

## Funktionsweise

- `data/spielplan.json` enthält alle 306 Begegnungen der Saison (wer gegen wen, an welchem
  Spieltag) — das ist der echte, offizielle Spielplan.
- `data/spieltag-01/` bis `data/spieltag-34/` sind die Ordner, in die du deine ausgewerteten
  Spiel-Dateien hochlädst.
- Die Website liest bei jedem Laden per GitHub-API aus, welche Dateien in welchen Ordnern
  liegen (ein einziger, sparsamer API-Aufruf für die ganze Saison), lädt deren Inhalt und
  ordnet sie automatisch der richtigen Begegnung zu (per Team-Namen-Abgleich, nicht per
  Dateiname — der Dateiname kann also frei gewählt werden, z.B. "Spieltag 1 Hertha gegen
  Arminia.json").
- Spiele ohne hochgeladene Datei werden als „ausstehend" angezeigt.
- Tabelle und Figuren-Leaderboard berechnen sich automatisch aus allen bisher hochgeladenen
  Spielen.

## Einrichtung

### 1. Konfiguration eintragen

In `config.js`:
```js
window.RS_CONFIG = {
  owner: "DEIN-GITHUB-BENUTZERNAME",
  repo: "DEIN-REPO-NAME",
  branch: "main",
  adminPassword: "admin123", // bitte ändern!
};
```

### 2. Repository anlegen & Dateien hochladen

1. Neues **öffentliches** GitHub-Repository anlegen (muss öffentlich sein, damit die
   GitHub-API ohne Login funktioniert).
2. Allen Inhalt dieses Ordners hochladen (`index.html`, `style.css`, `script.js`, `config.js`,
   den kompletten `data/`-Ordner mit allen 34 Unterordnern).
3. Unter **Settings → Pages** den Branch `main` / Ordner `/ (root)` aktivieren.
4. Nach ein paar Minuten ist die Seite unter
   `https://<dein-github-name>.github.io/<repo-name>/` erreichbar.

### 3. Beispiel-Datei

In `data/spieltag-01/BEISPIEL-VfL-Bochum-vs-Hertha-BSC.json` liegt eine fertig ausgewertete
Beispiel-Datei — schau sie dir als Vorlage an, dann kannst du sie einfach löschen, sobald du
eigene Ergebnisse hochlädst.

## Eine Datei pro Spiel erzeugen

Es gibt zwei Wege:

**A) Über den eingebauten Admin-Modus (empfohlen)**
1. Auf der Website auf „🔐 Admin-Modus" klicken, Passwort eingeben (siehe `config.js`).
2. Beim gewünschten Spiel auf „✏️ Bewerten" klicken.
3. Für jede Figur (Turm, Läufer, Springer, Dame, König) je Seite: Basis-Punktzahl eintragen
   und +/•/− für die Thesen-Bewertung wählen. Bei Bedarf den Randomizer für das „?"-Feld
   würfeln.
4. Auf „📥 JSON exportieren" klicken — die Datei wird heruntergeladen.
5. Die heruntergeladene Datei in GitHub in den passenden Ordner (`data/spieltag-XX/`)
   hochladen (per Weboberfläche: Ordner öffnen → „Add file" → „Upload files").

**Wichtig:** Der Admin-Modus ist rein lokal in deinem Browser — er speichert nichts automatisch
irgendwo. Du musst die exportierte Datei danach selbst bei GitHub hochladen, damit andere sie
sehen. Das Passwort ist nur ein einfacher Schutz vor Versehen, keine echte Zugriffskontrolle
(bei einer rein statischen Seite ohne Server ist das technisch auch nicht möglich).

**B) Datei von Hand schreiben**
Format wie im Beispiel oben: `heim`, `auswaerts` (müssen exakt den Namen aus dem Spielplan
entsprechen) und ein `rasenschach`-Objekt mit `white` (= Heimteam), `black` (= Auswärtsteam)
und `questionValue`.

## Hinweise

- Dateiname ist frei wählbar — die Zuordnung erfolgt über `heim`/`auswaerts` im Dateiinhalt,
  nicht über den Dateinamen.
- Das Repository muss **öffentlich** sein, sonst kann die GitHub-API nicht ohne Login lesen.
- Die GitHub-API ist für anonyme Zugriffe auf 60 Anfragen/Stunde begrenzt. Diese Website
  braucht dafür nur **einen** Aufruf pro Laden der Seite (dank des `git/trees`-Endpunkts) —
  das reicht für normalen Gebrauch locker aus.
