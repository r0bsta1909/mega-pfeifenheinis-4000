const { Game, mulberry32 } = require('../engine/engine.js');
async function run(seed, n, quiet) {
  const rng = mulberry32(seed * 7919 + 1); const logs = []; let q = 0;
  const ui = { log: (t, k) => logs.push(k + ': ' + t), render() {}, pause: async () => {},
    choose: async (spec) => { if (++q > 30000) throw new Error('too many questions'); if (!spec.options.length) throw new Error('empty options ' + spec.kind); return spec.options[Math.floor(rng() * spec.options.length)].value; } };
  const g = new Game({ playerNames: Array.from({ length: n }, (_, i) => 'P' + (i + 1)), seed, ui });
  try { await g.play(); } catch (e) { console.log('SEED', seed, 'n', n, e.stack); console.log(logs.slice(-40).join('\n')); process.exit(1); }
  return { logs, g };
}
(async () => {
  const kinds = {}; const warns = {}; let games = 0; let maxQ = 0;
  const N = +process.argv[2] || 800;
  for (let seed = 1; seed <= N; seed++) {
    const n = 2 + (seed % 5); const { logs, g } = await run(seed, n); games++;
    logs.forEach(l => { const k = l.split(':')[0]; kinds[k] = (kinds[k] || 0) + 1; if (k === 'warn') { const w = l.slice(6, 40); warns[w] = (warns[w] || 0) + 1; } });
    if (g.phase !== 'final') throw new Error('not final');
    if (g.raceHistory.length !== 4) throw new Error('races');
    maxQ = Math.max(maxQ, g.qid);
  }
  console.log('games ok', games, 'maxQuestions', maxQ); console.log(kinds); console.log(warns);
})();
