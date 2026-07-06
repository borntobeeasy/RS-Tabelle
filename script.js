// ============================================================
//  KONFIGURATION
// ============================================================
const ADMIN_PASSWORD = 'admin123';
const DATA_URL = 'data/spiele.json';
const TEAMS = [
  'Hamburger SV', '1. FC Köln', '1. FC Magdeburg',
  'Fortuna Düsseldorf', 'Hannover 96', 'Karlsruher SC',
  '1. FC Nürnberg', 'SC Paderborn 07', 'FC St. Pauli',
  'Holstein Kiel', 'Greuther Fürth', 'SV Darmstadt 98',
  'Eintracht Braunschweig', 'SV Wehen Wiesbaden', 'VfL Osnabrück',
  '1. FC Kaiserslautern', 'Schalke 04', 'Hertha BSC'
];
const ANZAHL_TEAMS = TEAMS.length;
const SPIELTAGE_PRO_RUNDE = ANZAHL_TEAMS - 1;
const GESAMT_SPIELTAGE = SPIELTAGE_PRO_RUNDE * 2;

// Rasenschach‑Konstanten
const PIECES = [
  { id: 'rook',   name: 'Turm',    base: 3 },
  { id: 'bishop', name: 'Läufer',  base: 1 },
  { id: 'knight', name: 'Springer',base: 1 },
  { id: 'queen',  name: 'Dame',    base: 1 },
  { id: 'king',   name: 'König',   base: 3 }
];
const PIECE_IDS = PIECES.map(p => p.id);
const POLARITIES = ['positive', 'negative', null];

// ============================================================
//  STATE
// ============================================================
let isAdmin = false;
let spielplan = [];          // [spieltag][spiel] = { heim, auswaerts }
let ergebnisse = {           // gleiche Struktur wie spielplan + tore + rasenschach
  spieltage: []
};
let aktuellerSpieltag = 0;
let undoStack = [];
const MAX_UNDO = 20;

// ============================================================
//  SPIELPLAN GENERIEREN (Round-Robin)
// ============================================================
function generiereSpielplan(teams) {
  const n = teams.length;
  if (n % 2 !== 0) throw new Error('Gerade Anzahl benötigt');
  const halbe = n / 2;
  const spieltage = [];
  for (let runde = 0; runde < n - 1; runde++) {
    const spiele = [];
    for (let i = 0; i < halbe; i++) {
      const heim = (runde + i) % (n - 1);
      const ausw = (runde - i + (n - 1)) % (n - 1);
      if (i === 0) {
        spiele.push({ heim: teams[heim], auswaerts: teams[n - 1] });
      } else {
        spiele.push({ heim: teams[heim], auswaerts: teams[ausw] });
      }
    }
    spieltage.push(spiele);
  }
  const rueckrunde = spieltage.map(runde =>
    runde.map(spiel => ({ heim: spiel.auswaerts, auswaerts: spiel.heim }))
  );
  return [...spieltage, ...rueckrunde];
}

// ============================================================
//  LEERE RASENSCHACH-DATEN
// ============================================================
function createEmptyRasenschach() {
  return {
    white: {
      assignments: [
        { id: 1, piece: 'rook', polarity: null },
        { id: 2, piece: 'bishop', polarity: null },
        { id: 3, piece: 'knight', polarity: null },
        { id: 4, piece: 'queen', polarity: null },
        { id: 5, piece: 'king', polarity: null }
      ],
      results: { rook: 0, bishop: 0, knight: 0, queen: 0, king: 0 }
    },
    black: {
      assignments: [
        { id: 6, piece: 'rook', polarity: null },
        { id: 7, piece: 'bishop', polarity: null },
        { id: 8, piece: 'knight', polarity: null },
        { id: 9, piece: 'queen', polarity: null },
        { id: 10, piece: 'king', polarity: null }
      ],
      results: { rook: 0, bishop: 0, knight: 0, queen: 0, king: 0 }
    },
    questionValue: null
  };
}

// ============================================================
//  DATEN LADEN & INITIALISIEREN
// ============================================================
async function loadData() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('JSON nicht gefunden');
    const data = await res.json();
    if (!data.spielplan || !data.ergebnisse) throw new Error('Ungültige Struktur');
    spielplan = data.spielplan;
    ergebnisse = data.ergebnisse;
    // Sicherstellen, dass jedes Spiel ein rasenschach-Objekt hat
    ergebnisse.spieltage.forEach((runde, si) => {
      runde.forEach((spiel, ti) => {
        if (!spiel.rasenschach) spiel.rasenschach = createEmptyRasenschach();
        // tore initial aus Rasenschach setzen, falls vorhanden
        if (spiel.rasenschach.white && spiel.rasenschach.black) {
          const wPunkte = berechneSeitenPunkte(spiel.rasenschach.white, spiel.rasenschach.questionValue);
          const bPunkte = berechneSeitenPunkte(spiel.rasenschach.black, spiel.rasenschach.questionValue);
          spiel.toreHeim = wPunkte;
          spiel.toreAuswaerts = bPunkte;
        }
      });
    });
    return true;
  } catch (e) {
    console.warn('Lade Fehler, generiere Standarddaten:', e.message);
    generiereStandardDaten();
    return false;
  }
}

function generiereStandardDaten() {
  spielplan = generiereSpielplan(TEAMS);
  ergebnisse = {
    spieltage: spielplan.map(runde =>
      runde.map(spiel => ({
        heim: spiel.heim,
        auswaerts: spiel.auswaerts,
        toreHeim: null,
        toreAuswaerts: null,
        rasenschach: createEmptyRasenschach()
      }))
    )
  };
  speichereErgebnisse(); // localStorage
}

function speichereErgebnisse() {
  localStorage.setItem('rasenschach_bundesliga', JSON.stringify(ergebnisse));
}

function ladeLokaleErgebnisse() {
  const saved = localStorage.getItem('rasenschach_bundesliga');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.spieltage) {
        ergebnisse = parsed;
        return true;
      }
    } catch {}
  }
  return false;
}

// ============================================================
//  RASENSCHACH-PUNKTE BERECHNEN
// ============================================================
function berechneSeitenPunkte(sideData, questionValue) {
  let total = 0;
  // feste Ergebnisse
  PIECES.forEach(p => {
    total += sideData.results?.[p.id] || 0;
  });
  // Thesen-Bewertungen
  sideData.assignments?.forEach(a => {
    if (!a.polarity) return;
    const piece = PIECES.find(p => p.id === a.piece);
    if (!piece) return;
    let score = 0;
    const sign = a.polarity === 'positive' ? 1 : -1;
    switch (a.piece) {
      case 'knight':
        if (a.polarity === 'positive' && questionValue !== null) score = questionValue;
        break;
      case 'bishop':
        if (a.polarity === 'positive') score = -piece.base;
        break;
      case 'queen':
        if (a.polarity === 'positive') score = piece.base;
        break;
      case 'rook':
        score = piece.base * sign * -1;
        break;
      default:
        score = piece.base * sign;
        break;
    }
    total += score;
  });
  // negative totals auf 0 setzen (wie im Rasenschach-Regelwerk)
  if (total < 0) total = 0;
  return total;
}

function berechneGesamtPunkte(rasenschach) {
  const w = berechneSeitenPunkte(rasenschach.white, rasenschach.questionValue);
  const b = berechneSeitenPunkte(rasenschach.black, rasenschach.questionValue);
  return { white: w, black: b };
}

// ============================================================
//  TABELLE BERECHNEN
// ============================================================
function berechneTabelle() {
  const tabelle = {};
  TEAMS.forEach(name => {
    tabelle[name] = {
      spiele: 0, siege: 0, unentschieden: 0, niederlagen: 0,
      toreFür: 0, toreGegen: 0, punkte: 0, diff: 0
    };
  });

  ergebnisse.spieltage.forEach(runde => {
    runde.forEach(spiel => {
      if (spiel.toreHeim === null || spiel.toreAuswaerts === null) return;
      const h = spiel.heim, a = spiel.auswaerts;
      const th = spiel.toreHeim, ta = spiel.toreAuswaerts;
      const teamH = tabelle[h], teamA = tabelle[a];
      teamH.spiele++; teamA.spiele++;
      teamH.toreFür += th; teamH.toreGegen += ta;
      teamA.toreFür += ta; teamA.toreGegen += th;
      if (th > ta) {
        teamH.siege++; teamA.niederlagen++;
        teamH.punkte += 3;
      } else if (th < ta) {
        teamA.siege++; teamH.niederlagen++;
        teamA.punkte += 3;
      } else {
        teamH.unentschieden++; teamA.unentschieden++;
        teamH.punkte += 1; teamA.punkte += 1;
      }
    });
  });

  Object.values(tabelle).forEach(t => t.diff = t.toreFür - t.toreGegen);

  const sortiert = Object.entries(tabelle).sort((a, b) => {
    const a_ = a[1], b_ = b[1];
    if (a_.punkte !== b_.punkte) return b_.punkte - a_.punkte;
    if (a_.diff !== b_.diff) return b_.diff - a_.diff;
    return b_.toreFür - a_.toreFür;
  });
  return sortiert.map(([name, stats], index) => ({ platz: index + 1, name, ...stats }));
}

// ============================================================
//  RENDER-FUNKTIONEN
// ============================================================
function renderSpieltag(index) {
  const container = document.getElementById('spieleListe');
  const runde = ergebnisse.spieltage[index];
  if (!runde) {
    container.innerHTML = '<p>Spieltag nicht gefunden.</p>';
    return;
  }

  let html = '';
  runde.forEach((spiel, i) => {
    const h = spiel.toreHeim !== null ? spiel.toreHeim : '';
    const a = spiel.toreAuswaerts !== null ? spiel.toreAuswaerts : '';
    const rs = spiel.rasenschach || createEmptyRasenschach();
    const punkte = berechneGesamtPunkte(rs);
    const toreDisplay = (spiel.toreHeim !== null && spiel.toreAuswaerts !== null)
      ? `${spiel.toreHeim}:${spiel.toreAuswaerts}`
      : '–';

    html += `
      <div class="spiel" data-spielindex="${i}">
        <div class="spiel-header">
          <span class="team heim">${spiel.heim}</span>
          <div class="ergebnis">
            <input type="number" class="torHeim" value="${h}" ${isAdmin ? '' : 'disabled'} min="0" step="1">
            <span>:</span>
            <input type="number" class="torAuswaerts" value="${a}" ${isAdmin ? '' : 'disabled'} min="0" step="1">
          </div>
          <span class="team auswaerts">${spiel.auswaerts}</span>
          <button class="toggle-rasenschach" data-target="rs-${index}-${i}">♟️ Brett anzeigen</button>
        </div>
        <div class="rasenschach-container" id="rs-${index}-${i}">
          ${renderRasenschachBoard('white', rs.white, rs.questionValue, index, i)}
          ${renderRasenschachBoard('black', rs.black, rs.questionValue, index, i)}
        </div>
      </div>
    `;
  });
  container.innerHTML = html;

  // Eventlistener für Toggle-Buttons
  container.querySelectorAll('.toggle-rasenschach').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (target) {
        target.classList.toggle('open');
        btn.textContent = target.classList.contains('open') ? '♟️ Brett ausblenden' : '♟️ Brett anzeigen';
      }
    });
  });

  // Eventlistener für Polaritäts-Buttons (nur Admin)
  if (isAdmin) {
    container.querySelectorAll('[data-action="setPolarity"]').forEach(btn => {
      btn.addEventListener('click', handlePolarityChange);
    });
  }
}

function renderRasenschachBoard(side, data, questionValue, spielTagIdx, spielIdx) {
  const label = side === 'white' ? 'Weiß' : 'Schwarz';
  const total = berechneSeitenPunkte(data, questionValue);
  let html = `
    <div class="rasenschach-board">
      <h4>${label} (${total} Punkte)</h4>
  `;
  data.assignments.forEach(a => {
    const piece = PIECES.find(p => p.id === a.piece);
    const score = berechneEinzelPunkt(a, questionValue);
    const posClass = a.polarity === 'positive' ? 'active-positive' :
                     a.polarity === 'negative' ? 'active-negative' :
                     a.polarity === null ? 'active-neutral' : '';
    html += `
      <div class="rasenschach-thesis">
        <span>These ${a.id}</span>
        <span>${piece.name}</span>
        <span class="polarity-buttons">
          <button class="${a.polarity === null ? posClass : ''}"
                  data-action="setPolarity"
                  data-side="${side}"
                  data-id="${a.id}"
                  data-value=""
                  ${isAdmin ? '' : 'disabled'}>○</button>
          <button class="${a.polarity === 'positive' ? posClass : ''}"
                  data-action="setPolarity"
                  data-side="${side}"
                  data-id="${a.id}"
                  data-value="positive"
                  ${isAdmin ? '' : 'disabled'}>+</button>
          <button class="${a.polarity === 'negative' ? posClass : ''}"
                  data-action="setPolarity"
                  data-side="${side}"
                  data-id="${a.id}"
                  data-value="negative"
                  ${isAdmin ? '' : 'disabled'}>−</button>
        </span>
        <span class="punkte">${score}</span>
      </div>
    `;
  });
  html += `
      <div class="rasenschach-total">Summe: ${total}</div>
    </div>
  `;
  return html;
}

function berechneEinzelPunkt(a, questionValue) {
  if (!a.polarity) return 0;
  const piece = PIECES.find(p => p.id === a.piece);
  if (!piece) return 0;
  const sign = a.polarity === 'positive' ? 1 : -1;
  switch (a.piece) {
    case 'knight':
      if (a.polarity === 'positive' && questionValue !== null) return questionValue;
      return 0;
    case 'bishop':
      if (a.polarity === 'positive') return -piece.base;
      return 0;
    case 'queen':
      if (a.polarity === 'positive') return piece.base;
      return 0;
    case 'rook':
      return piece.base * sign * -1;
    default:
      return piece.base * sign;
  }
}

function renderTabelle() {
  const container = document.getElementById('tabelle');
  const tabelle = berechneTabelle();
  let html = `
    <table>
      <thead><tr>
        <th>#</th><th>Team</th><th>Sp.</th><th>S</th><th>U</th><th>N</th>
        <th>Tore</th><th>Diff.</th><th>Pkt.</th>
      </tr></thead><tbody>
  `;
  tabelle.forEach(row => {
    html += `
      <tr>
        <td class="platz">${row.platz}</td>
        <td>${row.name}</td>
        <td>${row.spiele}</td>
        <td>${row.siege}</td>
        <td>${row.unentschieden}</td>
        <td>${row.niederlagen}</td>
        <td>${row.toreFür}:${row.toreGegen}</td>
        <td>${row.diff}</td>
        <td><strong>${row.punkte}</strong></td>
      </tr>
    `;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ============================================================
//  ADMIN-FUNKTIONEN
// ============================================================
function toggleAdmin() {
  if (isAdmin) {
    isAdmin = false;
    document.getElementById('adminStatus').textContent = '(Beobachter)';
    document.getElementById('adminToggle').textContent = '🔐 Admin-Modus';
    document.body.classList.remove('admin-mode');
    renderSpieltag(aktuellerSpieltag);
    return;
  }
  const pwd = prompt('Admin-Passwort:');
  if (pwd === ADMIN_PASSWORD) {
    isAdmin = true;
    document.getElementById('adminStatus').textContent = '(Admin)';
    document.getElementById('adminToggle').textContent = '🔓 Beobachter-Modus';
    document.body.classList.add('admin-mode');
    renderSpieltag(aktuellerSpieltag);
  } else if (pwd !== null) {
    alert('Falsches Passwort!');
  }
}

function handlePolarityChange(e) {
  const btn = e.currentTarget;
  const side = btn.dataset.side;
  const id = parseInt(btn.dataset.id);
  const value = btn.dataset.value === '' ? null : btn.dataset.value;
  const spiel = ergebnisse.spieltage[aktuellerSpieltag][currentSpielIndex];
  if (!spiel) return;
  const rs = spiel.rasenschach;
  const assignments = rs[side].assignments;
  const a = assignments.find(a => a.id === id);
  if (!a) return;
  a.polarity = value;
  // Tore neu berechnen
  const punkte = berechneGesamtPunkte(rs);
  spiel.toreHeim = punkte.white;
  spiel.toreAuswaerts = punkte.black;
  speichereErgebnisse();
  renderSpieltag(aktuellerSpieltag);
  renderTabelle();
}

// ============================================================
//  SPEICHERN (aus Input-Feldern)
// ============================================================
function saveResults() {
  if (!isAdmin) {
    alert('Nur Admin darf speichern.');
    return;
  }
  const container = document.getElementById('spieleListe');
  const spiele = container.querySelectorAll('.spiel');
  spiele.forEach((div, i) => {
    const heimInput = div.querySelector('.torHeim');
    const auswInput = div.querySelector('.torAuswaerts');
    const h = parseInt(heimInput.value);
    const a = parseInt(auswInput.value);
    const spiel = ergebnisse.spieltage[aktuellerSpieltag][i];
    if (!isNaN(h) && !isNaN(a) && h >= 0 && a >= 0) {
      spiel.toreHeim = h;
      spiel.toreAuswaerts = a;
    } else {
      spiel.toreHeim = null;
      spiel.toreAuswaerts = null;
    }
  });
  speichereErgebnisse();
  renderTabelle();
  renderSpieltag(aktuellerSpieltag);
  alert('Ergebnisse gespeichert!');
}

// ============================================================
//  EXPORT / IMPORT
// ============================================================
function exportJSON() {
  const payload = {
    spielplan: spielplan,
    ergebnisse: ergebnisse
  };
  const data = JSON.stringify(payload, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'spiele.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.spielplan || !data.ergebnisse) throw new Error('Ungültige Struktur');
      spielplan = data.spielplan;
      ergebnisse = data.ergebnisse;
      speichereErgebnisse();
      renderSpieltag(aktuellerSpieltag);
      renderTabelle();
      alert('Import erfolgreich!');
    } catch (err) {
      alert('Import fehlgeschlagen: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ============================================================
//  DOM-READY
// ============================================================
let currentSpielIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
  // Zuerst lokale Daten versuchen
  const hatLokal = ladeLokaleErgebnisse();
  if (!hatLokal) {
    await loadData(); // von data/spiele.json
    speichereErgebnisse(); // in localStorage übernehmen
  }

  // Spieltag-Dropdown
  const select = document.getElementById('spieltagSelect');
  for (let i = 0; i < GESAMT_SPIELTAGE; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i+1}. Spieltag`;
    select.appendChild(opt);
  }
  select.addEventListener('change', (e) => {
    aktuellerSpieltag = parseInt(e.target.value);
    renderSpieltag(aktuellerSpieltag);
  });

  // Event-Handler
  document.getElementById('adminToggle').addEventListener('click', toggleAdmin);
  document.getElementById('saveResults').addEventListener('click', saveResults);
  document.getElementById('exportBtn').addEventListener('click', exportJSON);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importJSON(e.target.files[0]);
      e.target.value = '';
    }
  });

  // ersten Spieltag anzeigen
  aktuellerSpieltag = 0;
  select.value = 0;
  renderSpieltag(0);
  renderTabelle();

  // Admin-Status initial
  document.getElementById('adminStatus').textContent = '(Beobachter)';
  document.body.classList.remove('admin-mode');

  // Speichern des aktuellen Spiel-Index für Polaritäts-Änderungen
  document.addEventListener('click', (e) => {
    const spielDiv = e.target.closest('.spiel');
    if (spielDiv) {
      currentSpielIndex = parseInt(spielDiv.dataset.spielindex);
    }
  });
});