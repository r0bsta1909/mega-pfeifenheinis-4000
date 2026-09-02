const { Game, mulberry32 } = require('../engine/engine.js');
async function play(seed, n, answers, record) {
  const rng = mulberry32(seed + 99); const logs = [];
  const ui = { log: (t) => logs.push(t), render() {}, pause: async () => {},
    choose: async (spec) => { let v; if (record) { v = spec.options[Math.floor(rng() * spec.options.length)].value; answers.push(v); } else { v = answers[spec.qid - 1]; } return v; } };
  const g = new Game({ playerNames: Array.from({ length: n }, (_, i) => 'P' + (i + 1)), seed, ui });
  await g.play(); return logs.join('\n');
}
(async () => { for (let s = 1; s <= 30; s++) { const a = []; const n = 2 + s % 5; const l1 = await play(s, n, a, true); const l2 = await play(s, n, a, false); if (l1 !== l2) { console.log('MISMATCH seed', s); process.exit(1); } } console.log('replay deterministic: ok'); })();
