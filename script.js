// ============================================================
//  KONFIGURATION
// ============================================================
const ADMIN_PASSWORD = 'admin123';   // ← hier eigenes Passwort eintragen
const TEAMS = [
    'Hamburger SV', '1. FC Köln', '1. FC Magdeburg',
    'Fortuna Düsseldorf', 'Hannover 96', 'Karlsruher SC',
    '1. FC Nürnberg', 'SC Paderborn 07', 'FC St. Pauli',
    'Holstein Kiel', 'Greuther Fürth', 'SV Darmstadt 98',
    'Eintracht Braunschweig', 'SV Wehen Wiesbaden', 'VfL Osnabrück',
    '1. FC Kaiserslautern', 'Schalke 04', 'Hertha BSC'
];
const ANZAHL_TEAMS = TEAMS.length;
const SPIELTAGE_PRO_RUNDE = ANZAHL_TEAMS - 1;          // 17
const GESAMT_SPIELTAGE = SPIELTAGE_PRO_RUNDE * 2;      // 34

// ============================================================
//  STATE
// ============================================================
let isAdmin = false;
let ergebnisse = {};   // { spieltagIndex: [ { heim, auswaerts, toreHeim, toreAuswaerts }, ... ] }
let aktuellerSpieltag = 0;

// ============================================================
//  SPIELPLAN GENERIEREN (Round-Robin)
// ============================================================
function generiereSpielplan(teams) {
    const n = teams.length;
    if (n % 2 !== 0) throw new Error('Gerade Anzahl Teams benötigt');
    const halbe = n / 2;
    const spieltage = [];

    // Hinrunde
    for (let runde = 0; runde < n - 1; runde++) {
        const spiele = [];
        for (let i = 0; i < halbe; i++) {
            const heim = (runde + i) % (n - 1);
            const ausw = (runde - i + (n - 1)) % (n - 1);
            // letztes Team (Index n-1) hat Sonderbehandlung
            if (i === 0) {
                spiele.push({
                    heim: teams[heim],
                    auswaerts: teams[n - 1]
                });
            } else {
                spiele.push({
                    heim: teams[heim],
                    auswaerts: teams[ausw]
                });
            }
        }
        spieltage.push(spiele);
    }

    // Rückrunde (Heim/Auswärts tauschen)
    const rueckrunde = spieltage.map(runde =>
        runde.map(spiel => ({
            heim: spiel.auswaerts,
            auswaerts: spiel.heim
        }))
    );

    return [...spieltage, ...rueckrunde];
}

// ============================================================
//  INITIALISIERUNG
// ============================================================
function initErgebnisse() {
    const gespeichert = localStorage.getItem('bundesliga_ergebnisse');
    if (gespeichert) {
        try {
            ergebnisse = JSON.parse(gespeichert);
            // Prüfen, ob Struktur passt
            if (!ergebnisse.spieltage || !Array.isArray(ergebnisse.spieltage)) throw new Error();
            return;
        } catch (e) {
            console.warn('Gespeicherte Daten ungültig, neu initialisiert');
        }
    }

    // Leere Struktur mit allen Spieltagen
    const spielplan = generiereSpielplan(TEAMS);
    ergebnisse = {
        spieltage: spielplan.map(runde =>
            runde.map(spiel => ({
                heim: spiel.heim,
                auswaerts: spiel.auswaerts,
                toreHeim: null,
                toreAuswaerts: null
            }))
        )
    };
    speichereErgebnisse();
}

function speichereErgebnisse() {
    localStorage.setItem('bundesliga_ergebnisse', JSON.stringify(ergebnisse));
}

// ============================================================
//  TABELLE BERECHNEN
// ============================================================
function berechneTabelle() {
    const tabelle = {};
    TEAMS.forEach(name => {
        tabelle[name] = {
            spiele: 0,
            siege: 0,
            unentschieden: 0,
            niederlagen: 0,
            toreFür: 0,
            toreGegen: 0,
            punkte: 0,
            diff: 0
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

    // Differenz berechnen
    Object.values(tabelle).forEach(t => t.diff = t.toreFür - t.toreGegen);

    // Sortieren
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
        const isEditable = isAdmin;
        const h = spiel.toreHeim !== null ? spiel.toreHeim : '';
        const a = spiel.toreAuswaerts !== null ? spiel.toreAuswaerts : '';
        html += `
            <div class="spiel" data-spielindex="${i}">
                <span class="team heim">${spiel.heim}</span>
                <div class="ergebnis">
                    <input type="number" class="torHeim" value="${h}" ${isEditable ? '' : 'disabled'} min="0" step="1">
                    <span class="vs">:</span>
                    <input type="number" class="torAuswaerts" value="${a}" ${isEditable ? '' : 'disabled'} min="0" step="1">
                </div>
                <span class="team auswaerts">${spiel.auswaerts}</span>
            </div>
        `;
    });
    container.innerHTML = html;
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
//  ADMIN-MODUS
// ============================================================
function toggleAdmin() {
    if (isAdmin) {
        isAdmin = false;
        document.getElementById('adminStatus').textContent = '(Beobachter)';
        document.getElementById('adminToggle').textContent = '🔐 Admin-Modus';
        renderSpieltag(aktuellerSpieltag);
        return;
    }

    const pwd = prompt('Admin-Passwort eingeben:');
    if (pwd === ADMIN_PASSWORD) {
        isAdmin = true;
        document.getElementById('adminStatus').textContent = '(Admin)';
        document.getElementById('adminToggle').textContent = '🔓 Beobachter-Modus';
        renderSpieltag(aktuellerSpieltag);
    } else if (pwd !== null) {
        alert('Falsches Passwort!');
    }
}

// ============================================================
//  SPIELTAG-WECHSEL
// ============================================================
function changeSpieltag(index) {
    aktuellerSpieltag = index;
    renderSpieltag(index);
}

// ============================================================
//  ERGEBNISSE SPEICHERN (aus den Input-Feldern)
// ============================================================
function saveResults() {
    if (!isAdmin) {
        alert('Nur im Admin-Modus können Ergebnisse gespeichert werden.');
        return;
    }
    const container = document.getElementById('spieleListe');
    const spiele = container.querySelectorAll('.spiel');
    const runde = ergebnisse.spieltage[aktuellerSpieltag];
    spiele.forEach((div, i) => {
        const heimInput = div.querySelector('.torHeim');
        const auswInput = div.querySelector('.torAuswaerts');
        const h = parseInt(heimInput.value);
        const a = parseInt(auswInput.value);
        if (!isNaN(h) && !isNaN(a) && h >= 0 && a >= 0) {
            runde[i].toreHeim = h;
            runde[i].toreAuswaerts = a;
        } else {
            // leere oder ungültige Eingabe -> als nicht gespielt behandeln
            runde[i].toreHeim = null;
            runde[i].toreAuswaerts = null;
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
    const data = JSON.stringify(ergebnisse, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bundesliga_ergebnisse.json';
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
            if (!data.spieltage || !Array.isArray(data.spieltage)) throw new Error();
            // Prüfen, ob die Anzahl der Spieltage passt
            if (data.spieltage.length !== GESAMT_SPIELTAGE) {
                alert(`Die importierte Datei hat ${data.spieltage.length} Spieltage, erwartet werden ${GESAMT_SPIELTAGE}.`);
                return;
            }
            ergebnisse = data;
            speichereErgebnisse();
            renderSpieltag(aktuellerSpieltag);
            renderTabelle();
            alert('Import erfolgreich!');
        } catch (err) {
            alert('Ungültige JSON-Datei.');
        }
    };
    reader.readAsText(file);
}

// ============================================================
//  DOM-READY
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialisieren
    initErgebnisse();

    // Spieltag-Dropdown befüllen
    const select = document.getElementById('spieltagSelect');
    for (let i = 0; i < GESAMT_SPIELTAGE; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i+1}. Spieltag`;
        select.appendChild(opt);
    }
    select.addEventListener('change', (e) => {
        changeSpieltag(parseInt(e.target.value));
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
            e.target.value = ''; // reset
        }
    });

    // Ersten Spieltag anzeigen
    aktuellerSpieltag = 0;
    select.value = 0;
    renderSpieltag(0);
    renderTabelle();

    // Admin-Status initial
    document.getElementById('adminStatus').textContent = '(Beobachter)';
});