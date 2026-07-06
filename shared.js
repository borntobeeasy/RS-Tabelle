// ============================================================
//  RASENSCHACH — Gemeinsame Auswertungs-Logik
//  Wird von admin.html (Bewertung) UND index.html (Beobachter)
//  eingebunden, damit Punkte überall exakt gleich berechnet werden.
// ============================================================
window.RS = (function () {
  const PIECES = [
    { id: 'rook',   name: 'Turm',     value: '-/+3', base: 3 },
    { id: 'bishop', name: 'Läufer',   value: '-1',   base: 1 },
    { id: 'knight', name: 'Springer', value: '?',    base: 1 },
    { id: 'queen',  name: 'Dame',     value: '+1',   base: 1 },
    { id: 'king',   name: 'König',    value: '+/-3', base: 3 },
  ];
  const PIECE_IDS = PIECES.map(p => p.id);
  const SIDES = ['white', 'black'];
  const POLARITIES = ['positive', 'negative'];
  const QUESTION_VALUES = [-3, -2, -1, 1, 2, 3];

  const PIECE_SVG_URLS = {
    rook:   'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
    bishop: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
    knight: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
    queen:  'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
    king:   'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
  };

  function getPieceById(id) { return PIECES.find(p => p.id === id); }
  function getSideLabel(side) { return side === 'white' ? 'Weiß' : 'Schwarz'; }
  function formatNumber(n) { return n > 0 ? `+${n}` : String(n); }

  function getScoreTone(value, evaluated) {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    if (value === 0 && evaluated) return 'zero';
    return 'neutral';
  }

  // Punktwert einer einzelnen platzierten These (1:1 identisch zur Original-App)
  function getAssignmentScore(assignment, questionValue) {
    if (!assignment.side || !assignment.piece || !assignment.polarity) return 0;
    const piece = getPieceById(assignment.piece);
    const sign = assignment.polarity === 'positive' ? 1 : -1;
    switch (assignment.piece) {
      case 'knight':
        return (assignment.polarity === 'positive') ? (questionValue ?? assignment.knightSwing) : 0;
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

  function getPlayerScore(data, side, pieceId) {
    return Number(data.results?.[side]?.[pieceId]) || 0;
  }

  // Gesamtpunkte, die eine Seite MIT EINER BESTIMMTEN FIGUR erzielt hat:
  // eingetragener Grundwert + alle darauf platzierten, ausgewerteten Thesen
  function getFigureScore(data, side, pieceId) {
    let total = getPlayerScore(data, side, pieceId);
    (data.positions || []).forEach(a => {
      if (a.side === side && a.piece === pieceId) {
        total += getAssignmentScore(a, data.questionValue);
      }
    });
    return total;
  }

  function getSideTotal(data, side) {
    let total = 0;
    PIECES.forEach(p => { total += getFigureScore(data, side, p.id); });
    return total;
  }

  // Endstand eines Bretts (z.B. 7:3) — identisch zur Original-App
  function calculateTotals(data) {
    let white = getSideTotal(data, 'white');
    let black = getSideTotal(data, 'black');
    if (white < 0) { black += -white; white = 0; }
    if (black < 0) { white += -black; black = 0; }
    return { white, black };
  }

  // -----------------------------------------------------------
  //  Tabelle (3-Punkte-System wie im Fußball)
  // -----------------------------------------------------------
  function computeTable(boards) {
    const table = {};
    function ensure(name) {
      if (!table[name]) {
        table[name] = {
          name, spiele: 0, siege: 0, unentschieden: 0, niederlagen: 0,
          tore: 0, gegentore: 0, punkte: 0,
        };
      }
      return table[name];
    }

    boards.filter(b => b.evaluated).forEach(b => {
      const data = b.data;
      const totals = calculateTotals(data);
      const nameWhite = (data.names?.white || 'Weiß').trim() || 'Weiß';
      const nameBlack = (data.names?.black || 'Schwarz').trim() || 'Schwarz';
      const w = ensure(nameWhite);
      const s = ensure(nameBlack);

      w.spiele++; s.spiele++;
      w.tore += totals.white; w.gegentore += totals.black;
      s.tore += totals.black; s.gegentore += totals.white;

      if (totals.white > totals.black) { w.siege++; s.niederlagen++; w.punkte += 3; }
      else if (totals.white < totals.black) { s.siege++; w.niederlagen++; s.punkte += 3; }
      else { w.unentschieden++; s.unentschieden++; w.punkte += 1; s.punkte += 1; }
    });

    return Object.values(table).sort((a, b) => {
      if (b.punkte !== a.punkte) return b.punkte - a.punkte;
      const diffA = a.tore - a.gegentore, diffB = b.tore - b.gegentore;
      if (diffB !== diffA) return diffB - diffA;
      if (b.tore !== a.tore) return b.tore - a.tore;
      return a.name.localeCompare(b.name, 'de');
    });
  }

  // -----------------------------------------------------------
  //  Leaderboard: wer holt mit welcher Figur die meisten Punkte
  // -----------------------------------------------------------
  function computeFigureLeaderboard(boards) {
    const buckets = {};
    PIECES.forEach(p => { buckets[p.id] = {}; });

    boards.filter(b => b.evaluated).forEach(b => {
      const data = b.data;
      SIDES.forEach(side => {
        const name = (data.names?.[side] || getSideLabel(side)).trim() || getSideLabel(side);
        PIECES.forEach(p => {
          const score = getFigureScore(data, side, p.id);
          if (!buckets[p.id][name]) buckets[p.id][name] = { name, punkte: 0, spiele: 0 };
          buckets[p.id][name].punkte += score;
          buckets[p.id][name].spiele += 1;
        });
      });
    });

    const ranked = {};
    PIECES.forEach(p => {
      ranked[p.id] = Object.values(buckets[p.id]).sort(
        (a, b) => b.punkte - a.punkte || a.name.localeCompare(b.name, 'de')
      );
    });
    return ranked;
  }

  return {
    PIECES, PIECE_IDS, SIDES, POLARITIES, QUESTION_VALUES, PIECE_SVG_URLS,
    getPieceById, getSideLabel, formatNumber, getScoreTone,
    getAssignmentScore, getPlayerScore, getFigureScore, getSideTotal, calculateTotals,
    computeTable, computeFigureLeaderboard,
  };
})();
