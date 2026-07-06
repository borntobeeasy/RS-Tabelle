// ============================================================
//  KONFIGURATION
// ============================================================
const DATA_URL = 'data.json';
const ADMIN_PASSWORD = 'rasenschach2026'; // ändern!

const PIECES = [
  { id: 'rook', name: 'Turm', value: '3', base: 3 },
  { id: 'bishop', name: 'Läufer', value: '1', base: 1 },
  { id: 'knight', name: 'Springer', value: '?', base: 1 },
  { id: 'queen', name: 'Dame', value: '1', base: 1 },
  { id: 'king', name: 'König', value: '3', base: 3 },
];
const PIECE_IDS = PIECES.map(p => p.id);
const SIDES = ['white', 'black'];
const POLARITIES = ['positive', 'negative'];
const QUESTION_VALUES = [-3, -2, -1, 1, 2, 3];
const THESIS_COUNT = 12;

const PIECE_SVG_URLS = {
  rook: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
  bishop: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
  knight: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
  queen: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
  king: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
};

// ============================================================
//  ZUSTAND
// ============================================================
let currentData = null;       // gesamte Liga-Daten (aus data.json)
let currentDay = 1;
let teams = [];
let isAdmin = false;         // true nach erfolgreichem Login
let currentMatchIndex = -1;  // für das geöffnete Brett
let boardState = null;       // aktueller Board-Zustand im Modal
let pointerDrag = null;

// ============================================================
//  HILFSFUNKTIONEN
// ============================================================
function getTeamName(id) {
  const t = teams.find(t => t.id === id);
  return t ? t.name : `Team ${id}`;
}
function getPieceById(id) { return PIECES.find(p => p.id === id); }
function getSideLabel(side) { return side === 'white' ? 'Weiß' : 'Schwarz'; }
function formatNumber(n) { return n > 0 ? `+${n}` : String(n); }
function cloneData(obj) { return JSON.parse(JSON.stringify(obj)); }
function getScoreTone(value) {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'zero';
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
//  TABELLENBERECHNUNG
// ============================================================
function calculateStandings(matchdays) {
  const standings = teams.map(t => ({
    teamId: t.id,
    played: 0, wins: 0, draws: 0, losses: 0,
    gf: 0, ga: 0, gd: 0, points: 0
  }));
  matchdays.forEach(md => {
    md.matches.forEach(m => {
      if (m.goalsHome === null || m.goalsAway === null) return;
      const home = standings.find(s => s.teamId === m.home);
      const away = standings.find(s => s.teamId === m.away);
      if (!home || !away) return;
      home.played++; away.played++;
      home.gf += m.goalsHome; home.ga += m.goalsAway;
      away.gf += m.goalsAway; away.ga += m.goalsHome;
      if (m.goalsHome > m.goalsAway) { home.wins++; away.losses++; home.points += 3; }
      else if (m.goalsHome < m.goalsAway) { away.wins++; home.losses++; away.points += 3; }
      else { home.draws++; away.draws++; home.points += 1; away.points += 1; }
    });
  });
  standings.forEach(s => { s.gd = s.gf - s.ga; });
  standings.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  return standings;
}

// ============================================================
//  RENDER: SPIELTAG + TABELLE
// ============================================================
function renderMatchday(dayId) {
  const container = document.getElementById('matchesContainer');
  const md = currentData.matchdays.find(d => d.id === dayId);
  if (!md) { container.innerHTML = '<p style="color:var(--muted);">Spieltag nicht gefunden.</p>'; return; }

  let html = '';
  md.matches.forEach((m, idx) => {
    const home = getTeamName(m.home);
    const away = getTeamName(m.away);
    const hasResult = (m.goalsHome !== null && m.goalsAway !== null);
    const score = hasResult ? `${m.goalsHome} : ${m.goalsAway}` : '– : –';
    const boardStatus = m.board ? (m.board.evaluated ? '✅' : '⚪') : '⚪';
    const btnLabel = m.board ? 'Brett anzeigen' : 'Brett anlegen';
    html += `
      <div class="match-card" data-match-index="${idx}">
        <span class="team">${home}</span>
        <span class="score-display">${score}</span>
        <span class="team">${away}</span>
        <button class="board-btn ${hasResult ? 'has-result' : ''}" data-match-index="${idx}" data-day="${dayId}">
          ${boardStatus} ${btnLabel}
        </button>
      </div>
    `;
  });
  container.innerHTML = html;

  container.querySelectorAll('.board-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.matchIndex);
      openBoard(dayId, idx);
    });
  });
}

function renderStandings() {
  const standings = calculateStandings(currentData.matchdays);
  const tbody = document.getElementById('standingsBody');
  tbody.innerHTML = standings.map((s, i) => `
    <tr>
      <td class="pos">${i + 1}</td>
      <td class="team-name">${getTeamName(s.teamId)}</td>
      <td>${s.played}</td>
      <td>${s.wins}</td>
      <td>${s.draws}</td>
      <td>${s.losses}</td>
      <td>${s.gf}:${s.ga}</td>
      <td>${s.gd > 0 ? '+' : ''}${s.gd}</td>
      <td class="pts">${s.points}</td>
    </tr>
  `).join('');
}

function renderDaySelector() {
  const sel = document.getElementById('daySelect');
  sel.innerHTML = currentData.matchdays.map(d =>
    `<option value="${d.id}">Spieltag ${d.id}</option>`
  ).join('');
  sel.value = currentDay;
  sel.addEventListener('change', (e) => {
    currentDay = Number(e.target.value);
    renderAll();
  });
}

function updateStatus() {
  const total = currentData.matchdays.flatMap(d => d.matches).length;
  const played = currentData.matchdays.flatMap(d => d.matches)
    .filter(m => m.goalsHome !== null && m.goalsAway !== null).length;
  document.getElementById('statusBadge').textContent = `📊 ${played}/${total} Spiele gespielt`;
  document.getElementById('lastUpdate').textContent =
    currentData.exportedAt ? `Stand: ${new Date(currentData.exportedAt).toLocaleDateString()}` : '';
}

function renderAll() {
  renderDaySelector();
  renderMatchday(currentDay);
  renderStandings();
  updateStatus();
  const msg = isAdmin ? '🔐 Admin-Modus aktiv – Bretter können bearbeitet werden.' : 'Klick auf "Brett" zur Ansicht.';
  document.getElementById('statusMsg').textContent = msg;
}

// ============================================================
//  BOARD-LOGIK (RASENSCHACH)
// ============================================================
function getDefaultBoard() {
  const positions = Array.from({ length: THESIS_COUNT }, (_, i) => ({
    id: i + 1,
    side: null,
    piece: null,
    polarity: null,
    knightSwing: Math.random() > 0.5 ? 1 : -1,
  }));
  const results = {
    white: { rook: 0, bishop: 0, knight: 0, queen: 0, king: 0 },
    black: { rook: 0, bishop: 0, knight: 0, queen: 0, king: 0 },
  };
  const questionValue = QUESTION_VALUES[Math.floor(Math.random() * QUESTION_VALUES.length)];
  return { positions, results, questionValue, evaluated: false };
}

function getAssignmentScore(assignment) {
  if (!assignment.side || !assignment.piece || !assignment.polarity) return 0;
  const piece = getPieceById(assignment.piece);
  const sign = assignment.polarity === 'positive' ? 1 : -1;
  switch (assignment.piece) {
    case 'knight':
      return (assignment.polarity === 'positive') ? (boardState.questionValue ?? assignment.knightSwing) : 0;
    case 'bishop':
      return (assignment.polarity === 'positive') ? -piece.base : 0;
    case 'queen':
      return (assignment.polarity === 'positive') ? piece.base : 0;
    case 'rook':
      return piece.base * sign * -1;
    default:
      return piece.base * sign;
  }
}

function getPlayerScore(side, pieceId) {
  return Number(boardState.results[side]?.[pieceId]) || 0;
}

function getSideTotal(side) {
  let total = 0;
  PIECES.forEach(p => total += getPlayerScore(side, p.id));
  boardState.positions.forEach(a => {
    if (a.side === side) total += getAssignmentScore(a);
  });
  return total;
}

function calculateBoardTotals() {
  let white = getSideTotal('white');
  let black = getSideTotal('black');
  if (white < 0) { black += -white; white = 0; }
  if (black < 0) { white += -black; black = 0; }
  return { white, black };
}

// ============================================================
//  BOARD RENDER (im Modal)
// ============================================================
function renderBoard() {
  const container = document.getElementById('boardContainer');
  const match = currentData.matchdays.find(d => d.id === currentDay)?.matches[currentMatchIndex];
  if (!match) { container.innerHTML = '<p>Spiel nicht gefunden.</p>'; return; }

  if (!match.board) {
    match.board = getDefaultBoard();
  }
  boardState = match.board;

  const home = getTeamName(match.home);
  const away = getTeamName(match.away);
  document.getElementById('modalMatchLabel').textContent = `${home} (Weiß) vs. ${away} (Schwarz)`;
  document.getElementById('modalMatchTitle').textContent = `Brett – Spieltag ${currentDay}`;

  // Admin-Actions ein-/ausblenden
  const actions = document.getElementById('adminBoardActions');
  if (isAdmin) {
    actions.classList.add('visible');
    document.querySelector('.board-modal').classList.add('admin-mode');
  } else {
    actions.classList.remove('visible');
    document.querySelector('.board-modal').classList.remove('admin-mode');
  }

  let html = `<div class="board-wrapper">`;
  html += `<div class="board-meta"><span class="white-label">⬜ ${home}</span><span class="black-label">⬛ ${away}</span></div>`;

  // Schachbrett
  html += `<div class="chess-grid" id="boardGrid">`;
  const rows = ['top', 'white', 'black', 'bottom'];
  rows.forEach(row => {
    PIECES.forEach((piece, idx) => {
      const cellClass = 'grid-cell' + (row === 'top' || row === 'bottom' ? ' piece-cell' : ' drop-cell');
      const side = row === 'top' ? 'white' : row === 'bottom' ? 'black' : row;
      const isLight = (row === 'top' && idx % 2 === 1) || (row === 'bottom' && idx % 2 === 0);
      const slot = `${row}-${piece.id}`;

      if (row === 'top' || row === 'bottom') {
        // Figuren-Feld
        const score = getPlayerScore(side, piece.id);
        const scoreMarkup = `<strong class="field-watermark ${getScoreTone(score)}">${formatNumber(score)}</strong>`;
        const svg = PIECE_SVG_URLS[piece.id];
        const img = `<img class="piece-svg" src="${svg}" alt="${piece.name}" />`;
        html += `<div class="${cellClass}${isLight ? ' light' : ''}" data-figure-slot="${slot}" data-side="${side}" data-piece="${piece.id}">`;
        html += scoreMarkup + img;
        html += `</div>`;
      } else {
        // Drop-Feld
        let thesisTotal = 0;
        boardState.positions.forEach(a => {
          if (a.side === side && a.piece === piece.id) thesisTotal += getAssignmentScore(a);
        });
        const figureValue = (piece.id === 'knight' && boardState.questionValue !== null)
          ? formatNumber(boardState.questionValue)
          : piece.value;
        const hasTheses = thesisTotal !== 0;
        html += `<div class="${cellClass}${hasTheses ? ' has-theses' : ''}" data-slot="${slot}" data-side="${side}" data-piece="${piece.id}">`;
        html += `<div class="drop-value">${figureValue}</div>`;
        if (hasTheses) html += `<div class="drop-total">${formatNumber(thesisTotal)}</div>`;
        html += `<div class="placed-list" data-slot="${slot}">`;
        boardState.positions.forEach(a => {
          if (a.side === side && a.piece === piece.id) {
            const p = getPieceById(a.piece);
            const fieldLabel = (a.piece === 'knight' && boardState.questionValue !== null)
              ? formatNumber(boardState.questionValue)
              : p.value;
            const score = getAssignmentScore(a);
            const draggable = isAdmin ? 'draggable="true"' : '';
            html += `<span class="placed-chip" data-id="${a.id}" ${draggable}>`;
            html += `<span class="chip-field-badge">${fieldLabel}</span>`;
            html += `<strong class="chip-watermark ${getScoreTone(score)}">${formatNumber(score)}</strong>`;
            html += `<span class="fit-text">These ${a.id}</span>`;
            html += `</span>`;
          }
        });
        html += `</div></div>`;
      }
    });
  });
  html += `</div>`;

  // Thesen-Liste
  html += `<div class="thesis-section"><h3>📌 Thesen</h3><div class="thesis-list" id="boardThesisList">`;
  boardState.positions.forEach(a => {
    if (a.side && a.piece) return;
    const draggable = isAdmin ? 'draggable="true"' : '';
    html += `<div class="thesis-card" data-id="${a.id}" ${draggable}><span class="thesis-title">These ${a.id}</span></div>`;
  });
  html += `</div></div>`;

  // Bewertung
  html += `<div class="evaluation-section"><h3>⚖️ Bewertung</h3><div class="evaluation-list" id="boardEvalList">`;
  boardState.positions.forEach(a => {
    const neutral = !a.polarity ? 'active' : '';
    const pos = a.polarity === 'positive' ? 'active' : '';
    const neg = a.polarity === 'negative' ? 'active' : '';
    const clickable = isAdmin ? '' : 'disabled';
    html += `<div class="eval-card" data-id="${a.id}">`;
    html += `<strong>${a.id}</strong>`;
    html += `<button class="neutral-btn ${neutral}" data-id="${a.id}" data-polarity="" ${clickable}>○</button>`;
    html += `<button class="pos-btn ${pos}" data-id="${a.id}" data-polarity="positive" ${clickable}>+</button>`;
    html += `<button class="neg-btn ${neg}" data-id="${a.id}" data-polarity="negative" ${clickable}>−</button>`;
    html += `</div>`;
  });
  html += `</div></div>`;

  html += `</div>`;
  container.innerHTML = html;

  // Event-Bindings (nur im Admin-Modus)
  if (isAdmin) {
    bindAdminBoardEvents();
  }
}

function bindAdminBoardEvents() {
  // Drop-Ziele
  document.querySelectorAll('.drop-cell').forEach(cell => {
    cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.classList.remove('drag-over');
      const id = Number(e.dataTransfer.getData('text/plain'));
      const assignment = boardState.positions.find(a => a.id === id);
      if (!assignment) return;
      const oldSide = assignment.side;
      const oldPiece = assignment.piece;
      assignment.side = cell.dataset.side;
      assignment.piece = cell.dataset.piece;
      renderBoard();
    });
  });

  // Drag-Quellen
  document.querySelectorAll('.thesis-card, .placed-chip').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      const id = Number(el.dataset.id);
      e.dataTransfer.setData('text/plain', String(id));
      e.dataTransfer.effectAllowed = 'move';
    });
  });

  // Bewertungs-Buttons
  document.querySelectorAll('.eval-card button[data-polarity]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isAdmin) return;
      const id = Number(btn.dataset.id);
      const assignment = boardState.positions.find(a => a.id === id);
      if (!assignment) return;
      const val = btn.dataset.polarity || null;
      assignment.polarity = val;
      renderBoard();
    });
  });

  // Randomizer-Button (wird im Footer platziert)
  const existingRandomBtn = document.querySelector('.modal-footer .randomizer-btn');
  if (!existingRandomBtn) {
    const randBtn = document.createElement('button');
    randBtn.className = 'btn-secondary randomizer-btn';
    randBtn.textContent = '🎲 Randomizer neu würfeln';
    randBtn.addEventListener('click', () => {
      if (!isAdmin) return;
      boardState.questionValue = QUESTION_VALUES[Math.floor(Math.random() * QUESTION_VALUES.length)];
      renderBoard();
    });
    document.querySelector('.modal-footer').appendChild(randBtn);
  }
}

// ============================================================
//  MODAL ÖFFNEN / SCHLIESSEN
// ============================================================
function openBoard(dayId, matchIdx) {
  currentDay = dayId;
  currentMatchIndex = matchIdx;
  const modal = document.getElementById('boardModal');
  renderBoard();
  modal.showModal();
  document.getElementById('boardStatus').textContent = isAdmin ? 'Admin: Ziehe Thesen, bewerte, würfle, und klicke "Auswerten".' : 'Ansichtsmodus – keine Bearbeitung möglich.';
}

function closeBoard() {
  document.getElementById('boardModal').close();
  currentMatchIndex = -1;
  boardState = null;
  renderAll();
}

// ============================================================
//  AUSWERTEN & ERGEBNIS ÜBERNEHMEN (nur Admin)
// ============================================================
function evaluateBoard() {
  if (!isAdmin || !boardState) return;
  const totals = calculateBoardTotals();
  const match = currentData.matchdays.find(d => d.id === currentDay)?.matches[currentMatchIndex];
  if (!match) return;

  // Prüfen, ob alle Thesen platziert und bewertet sind
  const allPlaced = boardState.positions.every(a => a.side && a.piece);
  const allEvaluated = boardState.positions.every(a => a.polarity !== null);
  if (!allPlaced) {
    document.getElementById('boardStatus').textContent = '⚠️ Bitte platziere alle Thesen auf dem Brett.';
    return;
  }
  if (!allEvaluated) {
    document.getElementById('boardStatus').textContent = '⚠️ Bitte bewerte alle Thesen (+ / − / neutral).';
    return;
  }

  match.goalsHome = Math.round(totals.white);
  match.goalsAway = Math.round(totals.black);
  boardState.evaluated = true;
  document.getElementById('boardStatus').textContent =
    `✅ Ausgewertet! ${getTeamName(match.home)} ${totals.white} : ${totals.black} ${getTeamName(match.away)}`;
  document.getElementById('boardStatus').style.color = 'var(--bundesliga-gold)';

  // Modal nach kurzer Verzögerung schließen
  setTimeout(() => {
    closeBoard();
  }, 1200);
}

function resetBoard() {
  if (!isAdmin) return;
  const match = currentData.matchdays.find(d => d.id === currentDay)?.matches[currentMatchIndex];
  if (!match) return;
  match.board = getDefaultBoard();
  boardState = match.board;
  renderBoard();
  document.getElementById('boardStatus').textContent = '🔄 Brett zurückgesetzt.';
  document.getElementById('boardStatus').style.color = 'var(--muted)';
}

// ============================================================
//  EXPORT DER GESAMTEN JSON (Admin)
// ============================================================
function exportFullData() {
  if (!currentData) return;
  const payload = {
    app: 'liga-beobachter',
    version: 2,
    exportedAt: new Date().toISOString(),
    teams: teams,
    matchdays: currentData.matchdays
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `liga-stand-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  document.getElementById('statusMsg').textContent = '✅ Export erfolgreich! Lade die Datei jetzt auf GitHub hoch.';
}

// ============================================================
//  DATEN LADEN
// ============================================================
async function loadData() {
  try {
    const resp = await fetch(DATA_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.app !== 'liga-beobachter') throw new Error('Ungültiges Dateiformat');
    currentData = data;
    teams = data.teams || [];
    if (!teams.length) throw new Error('Keine Teams definiert');
    currentDay = 1;
    renderAll();
    document.getElementById('statusMsg').textContent = '✅ Daten geladen.';
  } catch (err) {
    document.getElementById('statusMsg').textContent = `❌ Fehler beim Laden: ${err.message}`;
    document.getElementById('statusBadge').textContent = '⚠️ Datenfehler';
  }
}

// ============================================================
//  ADMIN LOGIN / LOGOUT
// ============================================================
function showLoginDialog() {
  document.getElementById('adminLoginDialog').showModal();
  document.getElementById('loginErrorMsg').textContent = '';
  document.getElementById('adminPasswordInput').value = '';
  document.getElementById('adminPasswordInput').focus();
}

function login() {
  const password = document.getElementById('adminPasswordInput').value;
  if (password === ADMIN_PASSWORD) {
    isAdmin = true;
    document.getElementById('adminLoginDialog').close();
    document.getElementById('adminToggleBtn').textContent = '🔓 Admin (aktiv)';
    document.getElementById('adminToggleBtn').style.borderColor = 'var(--bundesliga-gold)';
    // Aktuelles Brett neu rendern (falls offen)
    if (document.getElementById('boardModal').open) {
      renderBoard();
    }
    renderAll();
  } else {
    document.getElementById('loginErrorMsg').textContent = '❌ Falsches Passwort.';
  }
}

function logout() {
  isAdmin = false;
  document.getElementById('adminToggleBtn').textContent = '🔐 Admin';
  document.getElementById('adminToggleBtn').style.borderColor = '';
  if (document.getElementById('boardModal').open) {
    renderBoard();
  }
  renderAll();
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  document.getElementById('prevDay').addEventListener('click', () => {
    if (currentDay > 1) { currentDay--; renderAll(); }
  });
  document.getElementById('nextDay').addEventListener('click', () => {
    if (currentDay < currentData?.matchdays?.length) { currentDay++; renderAll(); }
  });
  document.getElementById('reloadBtn').addEventListener('click', loadData);

  // Admin
  document.getElementById('adminToggleBtn').addEventListener('click', () => {
    if (isAdmin) {
      if (confirm('Admin-Modus beenden?')) logout();
    } else {
      showLoginDialog();
    }
  });
  document.getElementById('adminLoginBtn').addEventListener('click', login);
  document.getElementById('closeLoginBtn').addEventListener('click', () => {
    document.getElementById('adminLoginDialog').close();
  });
  document.getElementById('adminLoginDialog').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
    if (e.key === 'Escape') document.getElementById('adminLoginDialog').close();
  });

  // Modal
  document.getElementById('closeModalBtn').addEventListener('click', closeBoard);
  document.getElementById('boardModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeBoard();
  });
  document.getElementById('evaluateBoardBtn').addEventListener('click', evaluateBoard);
  document.getElementById('resetBoardBtn').addEventListener('click', resetBoard);
  document.getElementById('exportBoardBtn').addEventListener('click', exportFullData);

  // Tastatur
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { document.getElementById('prevDay').click(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { document.getElementById('nextDay').click(); e.preventDefault(); }
    if (e.key === 'Escape') { if (document.getElementById('boardModal').open) closeBoard(); }
  });

  loadData();
});