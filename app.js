// ============================================================
//  KONFIGURATION
// ============================================================
const DATA_URL = 'data.json';   // diese Datei muss im selben Ordner liegen

// ============================================================
//  ZUSTAND
// ============================================================
let currentData = null;        // wird aus data.json geladen
let currentDay = 1;
let teams = [];

// ============================================================
//  HILFSFUNKTIONEN
// ============================================================
function getTeamName(id) {
  const t = teams.find(t => t.id === id);
  return t ? t.name : `Team ${id}`;
}

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

      if (m.goalsHome > m.goalsAway) {
        home.wins++; away.losses++; home.points += 3;
      } else if (m.goalsHome < m.goalsAway) {
        away.wins++; home.losses++; away.points += 3;
      } else {
        home.draws++; away.draws++; home.points += 1; away.points += 1;
      }
    });
  });

  standings.forEach(s => { s.gd = s.gf - s.ga; });
  standings.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  return standings;
}

// ============================================================
//  RENDER
// ============================================================
function renderMatchday(dayId) {
  const container = document.getElementById('matchesContainer');
  const md = currentData.matchdays.find(d => d.id === dayId);
  if (!md) {
    container.innerHTML = '<p style="color:var(--muted);">Spieltag nicht gefunden.</p>';
    return;
  }

  let html = '';
  md.matches.forEach(m => {
    const home = getTeamName(m.home);
    const away = getTeamName(m.away);
    const score = (m.goalsHome !== null && m.goalsAway !== null)
      ? `${m.goalsHome} : ${m.goalsAway}`
      : '– : –';
    html += `
      <div class="match-card">
        <span class="team">${home}</span>
        <span class="score-display">${score}</span>
        <span class="team">${away}</span>
      </div>
    `;
  });
  container.innerHTML = html;
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
  document.getElementById('statusMsg').textContent =
    `Spieltag ${currentDay} – Daten geladen.`;
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
    document.getElementById('statusMsg').textContent = '✅ Daten erfolgreich geladen.';
  } catch (err) {
    document.getElementById('statusMsg').textContent = `❌ Fehler beim Laden: ${err.message}`;
    document.getElementById('statusBadge').textContent = '⚠️ Datenfehler';
  }
}

// ============================================================
//  NAVIGATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('prevDay').addEventListener('click', () => {
    if (currentDay > 1) { currentDay--; renderAll(); }
  });
  document.getElementById('nextDay').addEventListener('click', () => {
    if (currentDay < currentData?.matchdays?.length) { currentDay++; renderAll(); }
  });
  document.getElementById('reloadBtn').addEventListener('click', loadData);

  // Tastatur
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { document.getElementById('prevDay').click(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { document.getElementById('nextDay').click(); e.preventDefault(); }
  });

  loadData();
});