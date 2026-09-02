const { Game } = require('../engine/engine.js');
const { Bot } = require('../engine/bot.js');
(async () => {
  const winsByRacer = {}; let games = 0; const N = +process.argv[2] || 300; let totalQ = 0;
  for (let seed = 1; seed <= N; seed++) {
    const n = 2 + seed % 5; const bots = Array.from({ length: n }, (_, i) => new Bot({ seed: seed * 31 + i, speed: 0 }));
    const g = new Game({ playerNames: Array.from({ length: n }, (_, i) => 'B' + i), seed, ui: { log() {}, render() {}, pause: async () => {}, choose: async (spec) => bots[spec.player].decide(g, spec) } });
    await g.play(); games++; totalQ += g.qid;
    g.raceHistory.forEach(h => { if (h.first) winsByRacer[h.first] = (winsByRacer[h.first] || 0) + 1; });
  }
  console.log('bot games ok', games, 'avg questions', (totalQ / games).toFixed(0));
  console.log(Object.entries(winsByRacer).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' '));
})();
