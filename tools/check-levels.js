// Checks that every gear puzzle in content.js can be solved with the gears it
// gives, using the same meshing rules as the game (core.js), and that no level
// is already solved at the start.
// Run: node tools/check-levels.js
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const stub = { querySelector: () => ({ getContext: () => ({}) }) };
const G = new Function('document', 'window', 'location', 'navigator', 'localStorage', 'matchMedia',
  src('i18n.js') + src('content.js') + src('core.js') + '\nreturn { LEVELS, meshState, solveGears };')(
  stub, {}, { search: '' }, { language: 'en' }, { getItem: () => null }, undefined);

function judge(L, gears) {
  for (let a = 0; a < gears.length; a++) for (let b = a + 1; b < gears.length; b++)
    if (G.meshState(gears[a], gears[b]) === 'clash') return 'clash';
  const sol = G.solveGears(gears, gears[0]);
  if (sol.jam) return 'jam';
  for (const goal of L.goals) {
    const i = gears.findIndex(g => g.peg === goal.peg), r = i < 0 ? null : sol.ratio[i];
    if (r === null) return 'not connected';
    if (goal.max !== undefined && Math.abs(r) > goal.max + 1e-9) return 'too fast';
    if (goal.dir && Math.sign(r) !== goal.dir) return 'wrong way';
    if (goal.ratio !== undefined && Math.abs(Math.abs(r) - goal.ratio) > 1e-9) return 'wrong speed';
  }
  return 'ok';
}
let bad = 0;
G.LEVELS.forEach((L, n) => {
  const at = (peg, z) => ({ peg, z, x: L.pegs[peg][0], y: L.pegs[peg][1], a: 0 });
  const fixed = [at(L.motor.peg, L.motor.z), ...L.machines.filter(m => m.z).map(m => at(m.peg, m.z))];
  const pool = [...L.inv, ...Object.values(L.start || {})];
  const free = L.pegs.map((_, i) => i).filter(i => !fixed.some(g => g.peg === i));
  const startState = judge(L, [...fixed, ...Object.entries(L.start || {}).map(([p, z]) => at(+p, z))]);
  const sols = new Set();
  (function walk(k, left, placed) {
    if (k === free.length) { if (judge(L, [...fixed, ...placed]) === 'ok') sols.add(placed.map(g => `${g.peg}:${g.z}`).join(' ')); return; }
    walk(k + 1, left, placed);
    new Set(left).forEach(z => { const i = left.indexOf(z); walk(k + 1, left.slice(0, i).concat(left.slice(i + 1)), [...placed, at(free[k], z)]); });
  })(0, pool, []);
  const ok = sols.size > 0 && startState !== 'ok';
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} level ${n + 1}: ${sols.size} solution(s), start: ${startState}${sols.size ? `, e.g. pegs ${[...sols][0]}` : ''}`);
});
console.log(bad ? `${bad} level(s) with problems` : 'Every level can be solved.');
process.exit(bad ? 1 : 0);
