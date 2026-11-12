// Self-check for the generator and grader: node test.js
var S = require('./app/sudoku.js'), assert = require('assert');

function checkSolution(n, sol) {
  var G = S.geom(n);
  for (var i = 0; i < G.size; i++) {
    var v = sol[i]; sol[i] = 0;
    assert(v >= 1 && v <= n && S.canPlace(G, sol, i, v), 'solution invalid at ' + i);
    sol[i] = v;
  }
}

[[9, 40], [9, 32], [9, 26], [9, 17], [6, 13]].forEach(function (p) {
  var t = Date.now(), r = S.generate(p[0], p[1]), G = S.geom(p[0]);
  checkSolution(p[0], r.solution);
  r.puzzle.forEach(function (v, i) { assert(v === 0 || v === r.solution[i], 'puzzle disagrees with solution'); });
  assert.strictEqual(S.count(G, r.puzzle.slice(), 2), 1, 'puzzle not unique');
  console.log(p[0] + 'x' + p[0], 'clues target', p[1], 'got', r.puzzle.filter(Boolean).length,
              'in', Date.now() - t, 'ms, needs', Object.keys(r.grade.used).join(' ') || '-', r.grade.solved ? '' : '+ chains');
});

// Grader soundness: whatever it solves must be the real solution (a wrong elimination would break this).
var tally = {}, unsolved = 0, N = 300, t0 = Date.now();
for (var k = 0; k < N; k++) {
  var r = S.generate(9, 17);
  if (r.grade.solved) assert.deepStrictEqual(r.grade.grid, r.solution, 'grader solved to a wrong grid');
  else unsolved++;
  Object.keys(r.grade.used).forEach(function (t) { tally[t] = (tally[t] || 0) + 1; });
}
console.log(N, 'super hard puzzles in', Date.now() - t0, 'ms. techniques needed:', JSON.stringify(tally), 'beyond the ladder:', unsolved);
console.log('ok');

// Hard and Super must rarely be singles-only (plain clue removal gives ~40-60% singles-only).
[['hard', 26], ['super', 17]].forEach(function (p) {
  var easy = 0;
  for (var k = 0; k < 50; k++) { var g = S.generateHard(9, p[1]).grade; if (g.solved && Object.keys(g.used).length < 2) easy++; }
  console.log(p[0], 'singles-only after retries:', easy + '/50');
  assert(easy < 8, p[0] + ' too often singles-only');
});

// Variants: solution obeys every unit (incl. chaos shapes / extra units) and the puzzle is unique.
['chaos', 'windoku', 'center'].forEach(function (m) {
  var t = Date.now(), r = S.generateMode(m, 26, true), G = S.geom(9, r.v);
  G.boxes.forEach(function (b) { assert.strictEqual(b.length, 9, m + ' box not 9 cells'); });
  G.units.forEach(function (u) { assert.strictEqual(u.map(function (i) { return r.solution[i]; }).sort().join(''), '123456789', m + ' unit broken'); });
  assert.strictEqual(S.count(G, r.puzzle.slice(), 2), 1, m + ' not unique');
  console.log(m, 'ok in', Date.now() - t, 'ms');
});

// Fog: the start must be clearable using only what's visible.
for (var f = 0; f < 50; f++) { var fr = S.generateFog(46); assert(S.fogPlay(fr, fr.fog).done || !fr.grade.solved, 'fog start gets stuck'); }
console.log('fog starts solvable');

// The version shown in Settings must match the package.
var fs = require('fs'), v = JSON.parse(fs.readFileSync(__dirname + '/manifest.json')).version.join('.');
assert(fs.readFileSync(__dirname + '/app/index.html', 'utf8').indexOf("var VERSION = '" + v + "'") >= 0, 'VERSION in index.html is not ' + v);
assert(fs.readFileSync(__dirname + '/app/config.xml', 'utf8').indexOf('version="' + v + '" viewmodes') >= 0, 'config.xml version is not ' + v);
console.log('version', v, 'consistent');
