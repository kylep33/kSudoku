// Puzzle generator and technique grader. ES5 only: the Kindle's Mesquite WebKit is old.
// Works on 9x9 (3x3 boxes) and the 6x6 speed grid (2x3 boxes). Variants pass v = { regions, extra }:
// regions[cell] = box id replaces the rectangular boxes (chaos), extra = more units (windoku, center cells).
var Sudoku = (function () {
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function range(n, from) { var a = []; for (var i = 0; i < n; i++) a.push(i + from); return a; }
  function bits(m) { var a = []; for (var d = 1; m >> d; d++) if (m & (1 << d)) a.push(d); return a; }
  function popcount(m) { var c = 0; while (m) { m &= m - 1; c++; } return c; }

  // Units (rows, columns, boxes) and each cell's peers, worked out once per grid size.
  var geoms = {};
  function geom(n, v) {
    var key = n + JSON.stringify(v || 0);
    if (geoms[key]) return geoms[key];
    var br = n === 6 ? 2 : 3, bc = 3, size = n * n, rows = [], cols = [], boxes = [], box = [], r, c, k;
    for (r = 0; r < n; r++) { rows.push([]); cols.push([]); boxes.push([]); }
    for (var i = 0; i < size; i++) {
      r = Math.floor(i / n); c = i % n;
      rows[r].push(i); cols[c].push(i);
      box[i] = v && v.regions ? v.regions[i] : Math.floor(r / br) * (n / bc) + Math.floor(c / bc);
      boxes[box[i]].push(i);
    }
    var extra = v && v.extra || [], units = rows.concat(cols, boxes, extra), peers = [], isPeer = [];
    for (i = 0; i < size; i++) {
      var seen = {};
      for (k = 0; k < units.length; k++) {
        if (units[k].indexOf(i) < 0) continue;
        for (var m = 0; m < n; m++) if (units[k][m] !== i) seen[units[k][m]] = true;
      }
      peers.push(Object.keys(seen).map(Number));
      isPeer.push(seen);
    }
    return (geoms[key] = { n: n, br: br, bc: bc, size: size, rows: rows, cols: cols, boxes: boxes, box: box, extra: extra,
                           units: units, peers: peers, isPeer: isPeer, all: (1 << (n + 1)) - 2 });
  }

  function candMask(G, g, i) {
    var m = G.all, p = G.peers[i];
    for (var k = 0; k < p.length; k++) if (g[p[k]]) m &= ~(1 << g[p[k]]);
    return m;
  }
  function canPlace(G, g, i, v) { return !!(candMask(G, g, i) & (1 << v)); }

  // Empty cell with the fewest candidates (keeps the Kindle CPU happy on hard puzzles).
  function bestCell(G, g) {
    var best = -1, bestM = 0, bestN = 99;
    for (var i = 0; i < G.size; i++) {
      if (g[i]) continue;
      var m = candMask(G, g, i), c = popcount(m);
      if (c < bestN) { best = i; bestM = m; bestN = c; if (c < 2) break; }
    }
    return { i: best, c: bits(bestM) };
  }

  // budget.left caps the search: some random chaos layouts have no fill, or one that takes ages to find.
  function fill(G, g, budget) {
    if (--budget.left < 0) return false;
    var b = bestCell(G, g);
    if (b.i < 0) return true;
    var c = shuffle(b.c);
    for (var k = 0; k < c.length; k++) { g[b.i] = c[k]; if (fill(G, g, budget)) return true; }
    g[b.i] = 0;
    return false;
  }

  // Number of solutions, stopping once `limit` is reached.
  function count(G, g, limit) {
    var b = bestCell(G, g);
    if (b.i < 0) return 1;
    var total = 0;
    for (var k = 0; k < b.c.length && total < limit; k++) { g[b.i] = b.c[k]; total += count(G, g, limit - total); }
    g[b.i] = 0;
    return total;
  }

  var FILL_NODES = 5000;
  // Removes clues in random order while the solution stays unique. Null if the grid couldn't be filled in budget.
  function generate(n, clues, v) {
    var G = geom(n, v), sol = range(G.size, 0).map(function () { return 0; });
    if (!fill(G, sol, { left: FILL_NODES })) return null;
    var puz = sol.slice(), left = G.size, order = shuffle(range(G.size, 0));
    for (var k = 0; k < G.size && left > clues; k++) {
      var i = order[k], v = puz[i];
      puz[i] = 0;
      if (count(G, puz.slice(), 2) !== 1) puz[i] = v; else left--;
    }
    return { puzzle: puz, solution: sol, grade: grade(n, puz, v) };
  }

  // Hard levels: clue count alone often gives a singles-only puzzle, so retry until a person needs
  // more than singles. shortcut: capped at 8 tries for the slow Kindle CPU; may still return an easy one.
  function generateHard(n, clues, v) {
    for (var t = 0, r; t < 8; t++) {
      r = generate(n, clues, v);
      if (!r || !r.grade.solved || Object.keys(r.grade.used).length > 1) break;
    }
    return r;
  }

  // ---- Grader: solve like a person, always taking the easiest step that makes progress. ----
  // Returns { used: {technique: true}, solved: bool }. A puzzle "needs" a technique when this
  // easiest-first solve had to use it. Unsolved means it needs chains or something stronger.
  function combos(arr, k, fn) {
    (function rec(start, picked) {
      if (picked.length === k) return fn(picked);
      for (var i = start; i < arr.length; i++) if (rec(i + 1, picked.concat([arr[i]]))) return true;
    })(0, []);
  }

  function grade(n, puzzle, v) {
    var G = geom(n, v), g = puzzle.slice(), cand = [], used = {}, i;
    for (i = 0; i < G.size; i++) cand.push(g[i] ? 0 : candMask(G, g, i));

    function place(i, d) {
      g[i] = d; cand[i] = 0;
      for (var k = 0; k < G.peers[i].length; k++) cand[G.peers[i][k]] &= ~(1 << d);
    }
    function elim(cells, mask) {  // remove mask from cells; true if anything changed
      var hit = false;
      for (var k = 0; k < cells.length; k++) if (cand[cells[k]] & mask) { cand[cells[k]] &= ~mask; hit = true; }
      return hit;
    }
    function where(unit, d) { return unit.filter(function (c) { return cand[c] & (1 << d); }); }

    function singles() {
      for (var i = 0; i < G.size; i++) if (!g[i] && popcount(cand[i]) === 1) { place(i, bits(cand[i])[0]); return true; }
      for (var u = 0; u < G.units.length; u++) for (var d = 1; d <= n; d++) {
        var w = where(G.units[u], d);
        if (w.length === 1) { place(w[0], d); return true; }
      }
      return false;
    }
    // Pointing / claiming: a digit confined to where a box meets a line is ruled out of the rest of both.
    function locked() {
      var lines = G.rows.concat(G.cols);
      for (var b = 0; b < G.boxes.length; b++) for (var l = 0; l < lines.length; l++) {
        var inter = G.boxes[b].filter(function (c) { return lines[l].indexOf(c) >= 0; });
        if (inter.length < 2) continue;
        for (var d = 1; d <= n; d++) {
          var inBox = where(G.boxes[b], d), inLine = where(lines[l], d);
          var boxIn = inBox.length && inBox.every(function (c) { return inter.indexOf(c) >= 0; });
          var lineIn = inLine.length && inLine.every(function (c) { return inter.indexOf(c) >= 0; });
          if (boxIn && elim(lines[l].filter(function (c) { return inter.indexOf(c) < 0; }), 1 << d)) return true;
          if (lineIn && elim(G.boxes[b].filter(function (c) { return inter.indexOf(c) < 0; }), 1 << d)) return true;
        }
      }
      return false;
    }
    function subsets(k) {  // naked and hidden pairs (k=2) / triples (k=3)
      for (var u = 0; u < G.units.length; u++) {
        var unit = G.units[u], open = unit.filter(function (c) { return !g[c]; }), hit = false;
        combos(open.filter(function (c) { return popcount(cand[c]) <= k; }), k, function (cs) {
          var m = 0; cs.forEach(function (c) { m |= cand[c]; });
          if (popcount(m) !== k) return false;
          return (hit = elim(open.filter(function (c) { return cs.indexOf(c) < 0; }), m));
        });
        if (hit) return true;
        var ds = range(n, 1).filter(function (d) { var w = where(unit, d).length; return w >= 1 && w <= k; });
        combos(ds, k, function (dk) {
          var cs = {}, keep = 0;
          dk.forEach(function (d) { keep |= 1 << d; where(unit, d).forEach(function (c) { cs[c] = true; }); });
          cs = Object.keys(cs).map(Number);
          if (cs.length !== k) return false;
          return (hit = elim(cs, G.all & ~keep));
        });
        if (hit) return true;
      }
      return false;
    }
    function fish(k) {  // X-Wing (k=2), Swordfish (k=3)
      var sides = [[G.rows, G.cols], [G.cols, G.rows]];
      for (var s = 0; s < 2; s++) for (var d = 1; d <= n; d++) {
        var base = sides[s][0], cover = sides[s][1], hit = false;
        var lines = range(n, 0).filter(function (b) { var w = where(base[b], d).length; return w >= 2 && w <= k; });
        combos(lines, k, function (bl) {
          var cv = {};
          bl.forEach(function (b) { where(base[b], d).forEach(function (c) { cv[cover === G.cols ? c % n : Math.floor(c / n)] = true; }); });
          cv = Object.keys(cv).map(Number);
          if (cv.length !== k) return false;
          var targets = [];
          cv.forEach(function (x) { cover[x].forEach(function (c) { if (bl.indexOf(base === G.rows ? Math.floor(c / n) : c % n) < 0) targets.push(c); }); });
          return (hit = elim(targets, 1 << d));
        });
        if (hit) return true;
      }
      return false;
    }
    function xywing() {
      for (var p = 0; p < G.size; p++) {
        if (popcount(cand[p]) !== 2) continue;
        var xy = cand[p], wings = G.peers[p].filter(function (c) {
          return popcount(cand[c]) === 2 && popcount(cand[c] & xy) === 1;
        });
        for (var a = 0; a < wings.length; a++) for (var b = a + 1; b < wings.length; b++) {
          var A = cand[wings[a]], B = cand[wings[b]];
          if ((A & xy) === (B & xy)) continue;
          var z = A & B & ~xy;
          if (popcount(z) !== 1) continue;
          var targets = G.peers[wings[a]].filter(function (c) { return c !== wings[b] && G.isPeer[wings[b]][c]; });
          if (elim(targets, z)) return true;
        }
      }
      return false;
    }
    // Simple coloring: chains of conjugate pairs (a digit with exactly two spots in a unit), two-coloured.
    function coloring() {
      for (var d = 1; d <= n; d++) {
        var bit = 1 << d, links = {};
        G.units.forEach(function (unit) {
          var w = where(unit, d);
          if (w.length !== 2) return;
          (links[w[0]] = links[w[0]] || []).push(w[1]);
          (links[w[1]] = links[w[1]] || []).push(w[0]);
        });
        var color = {};
        for (var start in links) {
          if (start in color) continue;
          var comp = [[], []], stack = [+start]; color[start] = 0;
          while (stack.length) {
            var c = stack.pop(); comp[color[c]].push(c);
            links[c].forEach(function (o) { if (!(o in color)) { color[o] = 1 - color[c]; stack.push(o); } });
          }
          for (var side = 0; side < 2; side++) {  // two of one colour see each other: that colour is false
            var cs = comp[side];
            for (var a = 0; a < cs.length; a++) for (var b = a + 1; b < cs.length; b++)
              if (G.isPeer[cs[a]][cs[b]] && elim(cs, bit)) return true;
          }
          var trap = [];  // a cell that sees both colours cannot be the digit
          for (var x = 0; x < G.size; x++) {
            if (!(cand[x] & bit) || x in color) continue;
            var sees = [comp[0], comp[1]].map(function (cs) { return cs.some(function (c) { return G.isPeer[x][c]; }); });
            if (sees[0] && sees[1]) trap.push(x);
          }
          if (elim(trap, bit)) return true;
        }
      }
      return false;
    }

    var ladder = [['single', singles], ['locked', locked], ['pairs', function () { return subsets(2); }],
                  ['triples', function () { return subsets(3); }], ['xwing', function () { return fish(2); }],
                  ['swordfish', function () { return fish(3); }], ['xywing', xywing], ['coloring', coloring]];
    for (var guard = 0; guard < 5000; guard++) {
      if (g.indexOf(0) < 0) return { used: used, solved: true, grid: g };
      var moved = false;
      for (var t = 0; t < ladder.length && !moved; t++) if (ladder[t][1]()) { used[ladder[t][0]] = true; moved = true; }
      if (!moved) break;
    }
    return { used: used, solved: g.indexOf(0) < 0, grid: g };
  }

  // ---- Variants (9x9 only) ----
  var WINDOWS = [10, 14, 46, 50].map(function (tl) { return [0, 1, 2, 9, 10, 11, 18, 19, 20].map(function (o) { return tl + o; }); });
  var CENTERS = [10, 13, 16, 37, 40, 43, 64, 67, 70];
  function variant(mode) {
    if (mode === 'windoku') return { extra: WINDOWS };
    if (mode === 'center') return { extra: [CENTERS] };
    if (mode === 'chaos') return { regions: chaosRegions() };
    return undefined;
  }

  function neighbors(i, diag) {  // orthogonal (and diagonal) neighbours on the 9x9
    var r = Math.floor(i / 9), c = i % 9, out = [];
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
      if ((!dr && !dc) || (!diag && dr && dc)) continue;
      if (r + dr >= 0 && r + dr < 9 && c + dc >= 0 && c + dc < 9) out.push((r + dr) * 9 + c + dc);
    }
    return out;
  }
  function connected(reg, id) {
    var start = reg.indexOf(id), seen = {}, stack = [start], n = 0;
    seen[start] = true;
    while (stack.length) {
      n++;
      neighbors(stack.pop(), false).forEach(function (j) { if (reg[j] === id && !seen[j]) { seen[j] = true; stack.push(j); } });
    }
    return n === 9;
  }
  var CHAOS_SWAPS = 150;
  // Irregular boxes: start from the 3x3 boxes and swap border cells between neighbouring boxes,
  // keeping every box in one piece.
  function chaosRegions() {
    var reg = geom(9).box.slice();
    for (var done = 0, guard = 0; done < CHAOS_SWAPS && guard < 20000; guard++) {
      var a = Math.floor(Math.random() * 81), A = reg[a];
      var bs = neighbors(a, false).filter(function (j) { return reg[j] !== A; });
      if (!bs.length) continue;
      var B = reg[bs[Math.floor(Math.random() * bs.length)]];
      var cs = [];  // cells of B touching A, other than a's own spot
      for (var j = 0; j < 81; j++) if (reg[j] === B && neighbors(j, false).some(function (x) { return reg[x] === A && x !== a; })) cs.push(j);
      if (!cs.length) continue;
      var c = cs[Math.floor(Math.random() * cs.length)];
      reg[a] = B; reg[c] = A;
      if (connected(reg, A) && connected(reg, B)) done++;
      else { reg[a] = A; reg[c] = B; }
    }
    return reg;
  }

  // Fog: the board starts dark except a few 3x3 patches; clues under fog are hidden and a correct
  // digit clears the fog around it. The start is built by playing it out with the grader on only
  // what's visible: whenever that gets stuck, another patch is cleared, so the player never is.
  function fogClear(fog, i) { fog[i] = 0; neighbors(i, true).forEach(function (j) { fog[j] = 0; }); }
  // Plays the board out from fog0 using only visible clues, the way the player has to.
  function fogPlay(r, fog0) {
    var fog = fog0.slice(), known = r.puzzle.map(function () { return 0; });
    for (var moved = true; moved;) {
      moved = false;
      for (var i = 0; i < 81; i++) if (!fog[i] && r.puzzle[i]) known[i] = r.puzzle[i];
      var g = grade(9, known).grid;
      for (i = 0; i < 81; i++) {
        if (fog[i] || known[i] || !g[i]) continue;
        known[i] = r.solution[i]; fogClear(fog, i); moved = true;
      }
    }
    return { fog: fog, done: r.puzzle.every(function (d, i) { return d || known[i]; }) };
  }
  function fogStart(r) {
    var fog0 = r.puzzle.map(function () { return 1; });
    for (;;) {
      var p = fogPlay(r, fog0), dark = range(81, 0).filter(function (j) { return p.fog[j]; });
      if (p.done || !dark.length) return fog0;  // nothing hidden yet stuck: beyond the grader, as in plain sudoku
      fogClear(fog0, dark[Math.floor(Math.random() * dark.length)]);
    }
  }
  // Any 9x9 mode except fog. r.v is the variant spec the board needs to draw and check itself.
  function generateMode(mode, clues, hard) {
    for (;;) {
      var v = variant(mode), r = (hard ? generateHard : generate)(9, clues, v);
      if (r) { r.v = v; return r; }
    }
  }
  function generateFog(clues) {
    var r = generate(9, clues);
    r.fog = fogStart(r);
    return r;
  }

  return { geom: geom, generate: generate, generateHard: generateHard, grade: grade, count: count, canPlace: canPlace,
           variant: variant, generateMode: generateMode, generateFog: generateFog, fogClear: fogClear, fogPlay: fogPlay };
})();

if (typeof module !== 'undefined') module.exports = Sudoku;
