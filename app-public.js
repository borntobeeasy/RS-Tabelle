// ============================================================
//  RASENSCHACH — Beobachter-Ansicht
// ============================================================
const { PIECES, getSideLabel, formatNumber, getScoreTone, getFigureScore, calculateTotals, computeTable, computeFigureLeaderboard } = window.RS;
const API_BASE = window.RS_API_BASE || '';

let allBoards = [];
let selectedMatchday = 1;

async function loadBoards() {
  try {
    const res = await fetch(`${API_BASE}/api/boards`);
    allBoards = await res.json();
  } catch (err) {
    allBoards = [];
    console.error('Bretter konnten nicht geladen werden:', err);
  }
  render();
}

function render() {
  renderMatchdayPicker();
  renderBoardsForMatchday();
  renderTable();
  renderFigureLeaderboard();
}

// ------------------------------------------------------------
//  Spieltag-Auswahl
// ------------------------------------------------------------
function renderMatchdayPicker() {
  const picker = document.getElementById('matchdayPicker');
  const matchdaysWithData = new Set(allBoards.map(b => b.spieltag));
  picker.innerHTML = '';
  for (let i = 1; i <= 34; i++) {
    const btn = document.createElement('button');
    btn.className = 'matchday-chip' + (i === selectedMatchday ? ' active' : '') + (matchdaysWithData.has(i) ? ' has-data' : '');
    btn.textContent = i;
    btn.addEventListener('click', () => {
      selectedMatchday = i;
      renderMatchdayPicker();
      renderBoardsForMatchday();
    });
    picker.appendChild(btn);
  }
}

function renderBoardsForMatchday() {
  const container = document.getElementById('boardsContainer');
  const boards = allBoards.filter(b => b.spieltag === selectedMatchday);
  if (boards.length === 0) {
    container.innerHTML = `<div class="empty-state">Für Spieltag ${selectedMatchday} liegen noch keine ausgewerteten Bretter vor.</div>`;
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'board-summary-grid';
  boards.forEach(board => grid.appendChild(renderBoardCard(board)));
  container.innerHTML = '';
  container.appendChild(grid);
}

function renderBoardCard(board) {
  const data = board.data;
  const totals = calculateTotals(data);
  const nameWhite = data.names?.white || 'Weiß';
  const nameBlack = data.names?.black || 'Schwarz';
  const logoWhite = data.teamLogos?.white;
  const logoBlack = data.teamLogos?.black;

  const card = document.createElement('article');
  card.className = 'board-summary-card';

  const figureCols = PIECES.map(p => {
    const w = getFigureScore(data, 'white', p.id);
    const b = getFigureScore(data, 'black', p.id);
    return { piece: p, w, b };
  });

  card.innerHTML = `
    <div class="bsc-head">
      <div class="bsc-team">
        ${logoWhite ? `<img class="bsc-logo" src="${escapeHtml(logoWhite)}" alt="" />` : ''}
        <span>${escapeHtml(nameWhite)}</span>
      </div>
      <div class="bsc-score">${totals.white} : ${totals.black}</div>
      <div class="bsc-team right">
        ${logoBlack ? `<img class="bsc-logo" src="${escapeHtml(logoBlack)}" alt="" />` : ''}
        <span>${escapeHtml(nameBlack)}</span>
      </div>
    </div>

    <div class="bsc-figures">
      <div class="val side-name">${escapeHtml(nameWhite)}</div>
      ${figureCols.map(c => `<div class="val ${getScoreTone(c.w, true)}">${formatNumber(c.w)}</div>`).join('')}
      <div class="val side-name right">${escapeHtml(nameBlack)}</div>
    </div>
    <div class="bsc-figures" style="border-top:none; padding-top:0;">
      <div></div>
      ${figureCols.map(c => `<div class="figure-label">${c.piece.name}</div>`).join('')}
      <div></div>
    </div>
    <div class="bsc-figures" style="border-top:none; padding-top:0;">
      <div></div>
      ${figureCols.map(c => `<div class="val ${getScoreTone(c.b, true)}">${formatNumber(c.b)}</div>`).join('')}
      <div></div>
    </div>

    <button class="bsc-toggle" type="button">Thesen anzeigen</button>
    <div class="bsc-details">
      ${(data.theses || []).map((text, i) => {
        const a = (data.positions || []).find(p => p.id === i + 1);
        if (!a || !a.side || !a.piece || !a.polarity) return '';
        const piece = window.RS.getPieceById(a.piece);
        const score = window.RS.getAssignmentScore(a, data.questionValue);
        return `
          <div class="bsc-thesis-row">
            <span>${escapeHtml(text)}</span>
            <span class="side-tag">${getSideLabel(a.side)} · ${piece?.name || ''}</span>
            <span class="val ${getScoreTone(score, true)}">${formatNumber(score)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;

  const toggleBtn = card.querySelector('.bsc-toggle');
  const details = card.querySelector('.bsc-details');
  toggleBtn.addEventListener('click', () => {
    const open = details.classList.toggle('open');
    toggleBtn.textContent = open ? 'Thesen ausblenden' : 'Thesen anzeigen';
  });

  return card;
}

// ------------------------------------------------------------
//  Tabelle
// ------------------------------------------------------------
function renderTable() {
  const tbody = document.getElementById('tableBody');
  const table = computeTable(allBoards);
  if (table.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Noch keine ausgewerteten Bretter vorhanden.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = table.map((row, i) => `
    <tr>
      <td><span class="rank-badge ${i < 3 ? 'top' : ''}">${i + 1}</span></td>
      <td class="team-cell">${escapeHtml(row.name)}</td>
      <td>${row.spiele}</td>
      <td>${row.siege}</td>
      <td>${row.unentschieden}</td>
      <td>${row.niederlagen}</td>
      <td>${row.tore}:${row.gegentore}</td>
      <td>${row.tore - row.gegentore > 0 ? '+' : ''}${row.tore - row.gegentore}</td>
      <td class="points">${row.punkte}</td>
    </tr>
  `).join('');
}

// ------------------------------------------------------------
//  Figuren-Leaderboard
// ------------------------------------------------------------
function renderFigureLeaderboard() {
  const container = document.getElementById('figureLeaderboard');
  const ranked = computeFigureLeaderboard(allBoards);
  container.innerHTML = PIECES.map(p => {
    const rows = ranked[p.id] || [];
    return `
      <div class="figure-lb-card">
        <h3><img src="${window.RS.PIECE_SVG_URLS[p.id]}" alt="" />${p.name}</h3>
        ${rows.length === 0
          ? '<div class="empty-state" style="padding:14px;">Noch keine Daten</div>'
          : rows.slice(0, 8).map((r, i) => `
            <div class="figure-lb-row">
              <span class="lb-rank">${i + 1}.</span>
              <span class="lb-name">${escapeHtml(r.name)}</span>
              <span class="lb-points">${formatNumber(r.punkte)}</span>
            </div>
          `).join('')
        }
      </div>
    `;
  }).join('');
}

// ------------------------------------------------------------
//  Tabs
// ------------------------------------------------------------
document.querySelectorAll('.tab-button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
  });
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

loadBoards();
setInterval(loadBoards, 30000); // alle 30s aktualisieren, falls Admin gerade auswertet
