// ============================================================
//  RASENSCHACH — 2. Bundesliga (optimiert & ohne API)
// ============================================================
const CFG = window.RS_CONFIG;

const PIECES = [
  { id: 'rook',   name: 'Turm',     wert: '-/+3' },
  { id: 'bishop', name: 'Läufer',   wert: '-1' },
  { id: 'knight', name: 'Springer', wert: '?' },
  { id: 'queen',  name: 'Dame',     wert: '+1' },
  { id: 'king',   name: 'König',    wert: '+/-3' },
];
const PIECE_BASE = { rook: 3, bishop: 1, knight: 1, queen: 1, king: 1 };

let spielplan = null;
let aktuellerSpieltag = 1;
let gameCache = {};

// ============================================================
//  FORMAT-KONVERTIERUNG (für Export-Dateien mit "data"-Wrapper)
// ============================================================
function normalizeGameData(raw) {
  // Bereits im alten Format (rasenschach direkt vorhanden)
  if (raw && raw.rasenschach) return raw;

  // Neues Format mit "data"-Wrapper
  if (raw && raw.data && raw.data.names && raw.data.results) {
    const d = raw.data;
    const whiteAssignments = (d.positions || [])
      .filter(p => p.side === 'white')
      .map(p => ({ piece: p.piece, polarity: p.polarity }));

    const blackAssignments = (d.positions || [])
      .filter(p => p.side === 'black')
      .map(p => ({ piece: p.piece, polarity: p.polarity }));

    return {
      rasenschach: {
        questionValue: d.questionValue !== undefined ? d.questionValue : null,
        white: {
          name: d.names.white || '',
          results: d.results.white || { rook: 0, bishop: 0, knight: 0, queen: 0, king: 0 },
          assignments: whiteAssignments
        },
        black: {
          name: d.names.black || '',
          results: d.results.black || { rook: 0, bishop: 0, knight: 0, queen: 0, king: 0 },
          assignments: blackAssignments
        }
      }
    };
  }

  // Fallback: unverändert zurückgeben
  return raw;
}

// ============================================================
//  RASENSCHACH-PUNKTE
// ============================================================
function berechneEinzelPunkt(a, questionValue) {
  if (!a.polarity) return 0;
  const base = PIECE_BASE[a.piece];
  if (base === undefined) return 0;
  const sign = a.polarity === 'positive' ? 1 : -1;
  switch (a.piece) {
    case 'knight':
      if (a.polarity === 'positive' && questionValue !== null && questionValue !== undefined) return questionValue;
      return 0;
    case 'bishop':
      return a.polarity === 'positive' ? -base : 0;
    case 'queen':
      return a.polarity === 'positive' ? base : 0;
    case 'rook':
      return base * sign * -1;
    default:
      return base * sign;
  }
}

function berechneSeitenPunkte(sideData, questionValue) {
  let total = 0;
  PIECES.forEach(p => { total += Number(sideData?.results?.[p.id]) || 0; });
  (sideData?.assignments || []).forEach(a => { total += berechneEinzelPunkt(a, questionValue); });
  return total;
}

function berechneGesamtPunkte(rasenschach) {
  let white = berechneSeitenPunkte(rasenschach.white, rasenschach.questionValue);
  let black = berechneSeitenPunkte(rasenschach.black, rasenschach.questionValue);
  if (white < 0) { black += -white; white = 0; }
  if (black < 0) { white += -black; black = 0; }
  return { white, black };
}

// ============================================================
//  DATEN LADEN (mit Konvertierung)
// ============================================================
function norm(name) { return (name || '').trim().toLowerCase(); }
function fixtureKey(heim, auswaerts) { return `${norm(heim)}||${norm(auswaerts)}`; }

async function loadSpielplan() {
  const res = await fetch('data/spielplan.json');
  if (!res.ok) throw new Error('spielplan.json nicht gefunden');
  spielplan = await res.json();
}

async function fileExists(path) {
  try {
    const res = await fetch(path, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function loadGameFile(spieltagNr, nummer) {
  const path = `data/spieltag-${String(spieltagNr).padStart(2, '0')}/${nummer}.json`;
  const cacheKey = path;
  if (gameCache[cacheKey]) return gameCache[cacheKey];

  try {
    const exists = await fileExists(path);
    if (!exists) return null;
    const res = await fetch(path);
    if (!res.ok) return null;
    const raw = await res.json();
    const normalized = normalizeGameData(raw);
    gameCache[cacheKey] = normalized;
    return normalized;
  } catch (e) {
    console.warn(`Konnte ${path} nicht laden:`, e.message);
    return null;
  }
}

async function loadSpieltagFiles(spieltagNr) {
  const fixtures = spielplan.spieltage[spieltagNr - 1] || [];
  const results = await Promise.all(
    fixtures.map((fx, index) => loadGameFile(spieltagNr, index + 1))
  );
  return fixtures.map((fx, index) => ({
    fixture: fx,
    game: results[index]
  }));
}

async function loadAllPlayedGames() {
  const alle = [];
  for (let nr = 1; nr <= 34; nr++) {
    const fixtures = spielplan.spieltage[nr - 1] || [];
    const folder = `data/spieltag-${String(nr).padStart(2, '0')}/`;

    const anyExists = await fileExists(`${folder}1.json`);
    if (!anyExists) continue;

    for (let i = 0; i < fixtures.length; i++) {
      const game = await loadGameFile(nr, i + 1);
      if (game && game.rasenschach) {
        const punkte = berechneGesamtPunkte(game.rasenschach);
        alle.push({
          spieltag: nr,
          heim: fixtures[i].heim,
          auswaerts: fixtures[i].auswaerts,
          toreHeim: punkte.white,
          toreAuswaerts: punkte.black
        });
      }
    }
  }
  return alle;
}

// ============================================================
//  RENDER-FUNKTIONEN
// ============================================================
async function renderSpieltag(nr) {
  const container = document.getElementById('spieleListe');
  container.innerHTML = '<p class="lade-hinweis">Lade Spiele…</p>';

  const spiele = await loadSpieltagFiles(nr);

  container.innerHTML = '';
  spiele.forEach(({ fixture: fx, game }) => {
    container.appendChild(renderSpielCard(nr, fx, game));
  });
}

function renderSpielCard(spieltagNr, fx, game) {
  const div = document.createElement('div');
  div.className = 'spiel';
  const key = fixtureKey(fx.heim, fx.auswaerts);

  let punkte = null;
  if (game && game.rasenschach) punkte = berechneGesamtPunkte(game.rasenschach);
  else if (game && (game.toreHeim !== undefined)) punkte = { white: game.toreHeim, black: game.toreAuswaerts };

  const ergebnisHtml = punkte
    ? `<span class="ergebnis-fest">${punkte.white} : ${punkte.black}</span>`
    : `<span class="ausstehend">ausstehend</span>`;

  div.innerHTML = `
    <div class="spiel-header">
      <span class="team heim">${escapeHtml(fx.heim)}</span>
      <span class="ergebnis">${ergebnisHtml}</span>
      <span class="team auswaerts">${escapeHtml(fx.auswaerts)}</span>
      ${game && game.rasenschach ? `<button class="toggle-rasenschach" data-key="${key}">♟️ Brett anzeigen</button>` : ''}
    </div>
    <div class="rasenschach-container" data-container="${key}">
      ${game && game.rasenschach ? renderRasenschachBoard(game.rasenschach, fx) : ''}
    </div>
  `;

  const toggleBtn = div.querySelector('.toggle-rasenschach');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const cont = div.querySelector(`[data-container="${key}"]`);
      cont.classList.toggle('open');
      toggleBtn.textContent = cont.classList.contains('open') ? '♟️ Brett ausblenden' : '♟️ Brett anzeigen';
    });
  }

  return div;
}

// ============================================================
//  RENDER: SCHACHBRETT (wie Referenzseite https://borntobeeasy.github.io/BuliRS/)
// ============================================================
function renderRasenschachBoard(rasenschach, fx) {
  const qv = rasenschach.questionValue;

  // Hilfsfunktion: Punktzahl für eine Figur berechnen
  function getScore(sideData, pieceId) {
    const a = (sideData.assignments || []).find(x => x.piece === pieceId);
    const basisWert = Number(sideData.results?.[pieceId]) || 0;
    const thesisScore = a ? berechneEinzelPunkt(a, qv) : 0;
    return basisWert + thesisScore;
  }

  // Hilfsfunktion: Polarity‑Klasse für eine Figur
  function getPolarityClass(sideData, pieceId) {
    const a = (sideData.assignments || []).find(x => x.piece === pieceId);
    if (!a) return 'neutral';
    return a.polarity === 'positive' ? 'positive' : a.polarity === 'negative' ? 'negative' : 'neutral';
  }

  // Hilfsfunktion: Angezeigter Polaritäts‑Text (wird nicht im Raster verwendet, aber für später)
  function getPolarityLabel(sideData, pieceId) {
    const a = (sideData.assignments || []).find(x => x.piece === pieceId);
    if (!a) return '•';
    return a.polarity === 'positive' ? '+' : a.polarity === 'negative' ? '−' : '•';
  }

  // Hilfsfunktion: Thesen‑Text für eine Figur (falls zugewiesen)
  function getThesisText(sideData, pieceId) {
    const a = (sideData.assignments || []).find(x => x.piece === pieceId);
    if (!a) return '';
    // Wenn die Rohdaten eine thesisId haben, nutze sie, sonst "These"
    return a.thesisId ? `These ${a.thesisId}` : 'These';
  }

  // Figuren‑Konfiguration (Reihenfolge von links nach rechts)
  const pieces = [
    { id: 'rook',   label: 'Turm',   base: '-/+3' },
    { id: 'bishop', label: 'Läufer', base: '-1' },
    { id: 'knight', label: 'Springer', base: '?' },
    { id: 'queen',  label: 'Dame',   base: '+1' },
    { id: 'king',   label: 'König',  base: '+/-3' },
  ];

  // HTML für das Raster aufbauen
  let html = `<div class="chess-grid">`;

  // === REIHE 1: Weiße Figuren (oben) ===
  pieces.forEach(p => {
    const score = getScore(rasenschach.white, p.id);
    const polClass = getPolarityClass(rasenschach.white, p.id);
    html += `
      <div class="grid-cell piece-cell" data-side="white" data-piece="${p.id}">
        <strong class="field-watermark ${polClass}">${score}</strong>
        <span class="piece-label">${p.label}</span>
      </div>
    `;
  });

  // === REIHE 2: Weiße Drop‑Felder (Basiswerte + Thesen) ===
  pieces.forEach(p => {
    const thesis = getThesisText(rasenschach.white, p.id);
    html += `
      <div class="grid-cell drop-cell" data-side="white" data-piece="${p.id}">
        <div class="drop-value">${p.base}</div>
        <div class="placed-list" data-slot="white-${p.id}">
          ${thesis ? `<span class="thesis-chip">${thesis}</span>` : ''}
        </div>
      </div>
    `;
  });

  // === REIHE 3: Schwarze Drop‑Felder (Basiswerte + Thesen) ===
  pieces.forEach(p => {
    const thesis = getThesisText(rasenschach.black, p.id);
    html += `
      <div class="grid-cell drop-cell" data-side="black" data-piece="${p.id}">
        <div class="drop-value">${p.base}</div>
        <div class="placed-list" data-slot="black-${p.id}">
          ${thesis ? `<span class="thesis-chip">${thesis}</span>` : ''}
        </div>
      </div>
    `;
  });

  // === REIHE 4: Schwarze Figuren (unten) ===
  pieces.forEach(p => {
    const score = getScore(rasenschach.black, p.id);
    const polClass = getPolarityClass(rasenschach.black, p.id);
    html += `
      <div class="grid-cell piece-cell" data-side="black" data-piece="${p.id}">
        <strong class="field-watermark ${polClass}">${score}</strong>
        <span class="piece-label">${p.label}</span>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

// ============================================================
//  TABELLE
// ============================================================
async function renderTabelle() {
  const container = document.getElementById('tabelle');
  container.innerHTML = '<p class="lade-hinweis">Berechne Tabelle…</p>';
  const gespielt = await loadAllPlayedGames();

  const tabelle = {};
  spielplan.teams.forEach(name => {
    tabelle[name] = { name, spiele: 0, siege: 0, unentschieden: 0, niederlagen: 0, toreFuer: 0, toreGegen: 0, punkte: 0 };
  });

  gespielt.forEach(s => {
    const h = tabelle[s.heim], a = tabelle[s.auswaerts];
    if (!h || !a) return;
    h.spiele++; a.spiele++;
    h.toreFuer += s.toreHeim; h.toreGegen += s.toreAuswaerts;
    a.toreFuer += s.toreAuswaerts; a.toreGegen += s.toreHeim;
    if (s.toreHeim > s.toreAuswaerts) { h.siege++; a.niederlagen++; h.punkte += 3; }
    else if (s.toreHeim < s.toreAuswaerts) { a.siege++; h.niederlagen++; a.punkte += 3; }
    else { h.unentschieden++; a.unentschieden++; h.punkte += 1; a.punkte += 1; }
  });

  const sortiert = Object.values(tabelle).sort((x, y) => {
    if (y.punkte !== x.punkte) return y.punkte - x.punkte;
    const diffX = x.toreFuer - x.toreGegen, diffY = y.toreFuer - y.toreGegen;
    if (diffY !== diffX) return diffY - diffX;
    if (y.toreFuer !== x.toreFuer) return y.toreFuer - x.toreFuer;
    return x.name.localeCompare(y.name, 'de');
  });

  let html = `
    <table>
      <thead><tr>
        <th>#</th><th>Team</th><th>Sp.</th><th>S</th><th>U</th><th>N</th>
        <th>Tore</th><th>Diff.</th><th>Pkt.</th>
      </tr></thead><tbody>
  `;
  sortiert.forEach((row, i) => {
    html += `
      <tr>
        <td class="platz">${i + 1}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${row.spiele}</td>
        <td>${row.siege}</td>
        <td>${row.unentschieden}</td>
        <td>${row.niederlagen}</td>
        <td>${row.toreFuer}:${row.toreGegen}</td>
        <td>${row.toreFuer - row.toreGegen}</td>
        <td><strong>${row.punkte}</strong></td>
      </tr>
    `;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
  return gespielt;
}

// ============================================================
//  FIGUREN-LEADERBOARD
// ============================================================
async function renderFigurenLeaderboard() {
  const container = document.getElementById('figurenLeaderboard');
  container.innerHTML = '<p class="lade-hinweis">Berechne Figuren-Leaderboard…</p>';

  const buckets = {};
  PIECES.forEach(p => { buckets[p.id] = {}; });

  for (let nr = 1; nr <= 34; nr++) {
    const fixtures = spielplan.spieltage[nr - 1] || [];
    const folder = `data/spieltag-${String(nr).padStart(2, '0')}/`;
    const anyExists = await fileExists(`${folder}1.json`);
    if (!anyExists) continue;

    for (let i = 0; i < fixtures.length; i++) {
      const fx = fixtures[i];
      const game = await loadGameFile(nr, i + 1);
      if (!game || !game.rasenschach) continue;
      [['white', fx.heim], ['black', fx.auswaerts]].forEach(([side, teamName]) => {
        const sideData = game.rasenschach[side];
        PIECES.forEach(p => {
          const a = (sideData.assignments || []).find(x => x.piece === p.id);
          const basisWert = Number(sideData.results?.[p.id]) || 0;
          const thesisScore = a ? berechneEinzelPunkt(a, game.rasenschach.questionValue) : 0;
          const score = basisWert + thesisScore;
          if (!buckets[p.id][teamName]) buckets[p.id][teamName] = { name: teamName, punkte: 0 };
          buckets[p.id][teamName].punkte += score;
        });
      });
    }
  }

  container.innerHTML = '';
  PIECES.forEach(p => {
    const rows = Object.values(buckets[p.id]).sort((a, b) => b.punkte - a.punkte || a.name.localeCompare(b.name, 'de'));
    const card = document.createElement('div');
    card.className = 'figur-lb-card';
    card.innerHTML = `
      <h4>${p.name}</h4>
      ${rows.length === 0 ? '<p class="lade-hinweis">Noch keine Daten</p>' : rows.slice(0, 8).map((r, i) => `
        <div class="figur-lb-row">
          <span>${i + 1}.</span>
          <span class="lb-name">${escapeHtml(r.name)}</span>
          <span class="lb-punkte">${r.punkte}</span>
        </div>
      `).join('')}
    `;
    container.appendChild(card);
  });
}

// ============================================================
//  HELFER
// ============================================================
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('ladeStatus');
  try {
    statusEl.textContent = 'Lade Spielplan…';
    await loadSpielplan();
    statusEl.textContent = 'Lade Spiele…';

    await renderSpieltag(1);
    await renderTabelle();
    await renderFigurenLeaderboard();
    statusEl.textContent = '';
  } catch (err) {
    statusEl.textContent = 'Fehler beim Laden: ' + err.message;
    console.error(err);
    return;
  }

  const select = document.getElementById('spieltagSelect');
  for (let i = 1; i <= 34; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i}. Spieltag`;
    select.appendChild(opt);
  }
  select.value = 1;
  select.addEventListener('change', (e) => {
    aktuellerSpieltag = Number(e.target.value);
    renderSpieltag(aktuellerSpieltag);
  });

  document.getElementById('refreshButton').addEventListener('click', async () => {
    statusEl.textContent = 'Aktualisiere…';
    gameCache = {};
    await renderSpieltag(aktuellerSpieltag);
    await renderTabelle();
    await renderFigurenLeaderboard();
    statusEl.textContent = '';
  });
});