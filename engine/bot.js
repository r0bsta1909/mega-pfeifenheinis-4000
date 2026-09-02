'use strict';
/* ============================================================
   BOT – antwortet auf engine.choose()-Fragen wie ein Mensch:
   Heuristiken pro Fragetyp, leichte Fehlerquote, Reaktionszeit.
   ============================================================ */
const ENG = (typeof module !== 'undefined') ? require('./engine.js') : window.ENGINE;
const { FINISH, TRACK_LEN, RACER_BY_ID } = ENG;

const RATING = { hare: 9, legs: 8.5, scoocher: 7.5, blimp: 7, magician: 7, gunk: 6.5, alchemist: 6.5, flipflop: 6.5, leaptoad: 6, party: 6, thirdwheel: 6, romantic: 6, rocket: 6, suckerfish: 6, copycat: 6, twin: 5.5, centaur: 5.5, coach: 5, skipper: 5, genius: 5, dicemonger: 5, lackey: 5, inchworm: 5, heckler: 5.5, mouth: 5.5, stickler: 5, hypnotist: 5, duelist: 5, sisyphus: 5, mastermind: 5, egg: 5, cheerleader: 4.5, banana: 4.5, babayaga: 4.5, hugebaby: 4, loser: 4 };
const CROWD = { thirdwheel: 1, romantic: 1, party: 1, leaptoad: 0.6, mouth: 0.5, duelist: 0.5, heckler: 0.4, scoocher: 0.8, suckerfish: 0.5, lackey: 0.4, inchworm: 0.4 };
const BOT_NAMES = ['Kai-Uwe', 'Ronja', 'Detlef', 'Miri', 'Torben', 'Svenja', 'Bodo', 'Yvonne', 'Hauke', 'Steffi', 'Olaf', 'Nadine'];

function mkRng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

class Bot {
  constructor(o) {
    o = o || {};
    this.rng = mkRng(o.seed == null ? Math.floor(Math.random() * 1e9) : o.seed);
    this.errorRate = o.errorRate == null ? 0.12 : o.errorRate;   // Anteil bewusst zweitbester Entscheidungen
    this.speed = o.speed == null ? 1 : o.speed;                   // 0 = sofort (Tests), 1 = menschlich
  }
  rate(id, n) { return (RATING[id] || 5) + (CROWD[id] || 0) * Math.max(0, n - 3); }
  noise(s) { return (this.rng() - 0.5) * 2 * (s == null ? 1 : s); }
  /** Reaktionszeit in ms, abhängig von Fragetyp */
  delayFor(spec) {
    if (this.speed === 0) return 0;
    const r = this.rng;
    const base = { turnStart: [600, 1400], roll: [500, 1100], continue: [900, 2200], reroll: [900, 1900], optional: [1000, 2400], target: [1500, 3200], method: [900, 1800], draft: [1800, 4200], pick: [2000, 4500], predictRoll: [700, 1500], predictWinner: [1500, 3200], copyPick: [1200, 2400], eggPick: [1500, 3000], twinPick: [1500, 3000], racerOrder: [800, 1600], firstRacer: [900, 1800] }[spec.kind] || [800, 2000];
    let ms = base[0] + r() * (base[1] - base[0]);
    if (r() < 0.08) ms += 1500 + r() * 2500; // ab und zu abgelenkt
    return Math.round(ms * this.speed);
  }
  /** Wählt einen Optionswert. Bewertet Optionen, nimmt meist die beste. */
  decide(game, spec) {
    const opts = spec.options;
    if (opts.length === 1) return opts[0].value;
    const scored = opts.map(o => ({ o, s: this.score(game, spec, o) }));
    scored.sort((a, b) => b.s - a.s);
    if (scored.length > 1 && this.rng() < this.errorRate && scored[1].s > -50) return scored[1].o.value;
    return scored[0].o.value;
  }
  score(g, spec, o) {
    const v = o.value; const n = g.players.length; const r = spec.racer; const race = g.race;
    const me = spec.player;
    const posOf = id => { const x = race && race.racers.find(y => y.id === id); return x ? x.pos : 0; };
    const lead = () => race ? Math.max(...g.active().map(x => x.pos)) : 0;
    switch (spec.kind) {
      case 'draft': {
        let s = this.rate(v, n) + this.noise(1.2);
        if (v === 'twin') s -= 1; // erst ab Rennen 2 nützlich
        const team = g.players[me].team;
        if (team.includes('scoocher') && ['gunk', 'coach', 'hare'].includes(v)) s += 0.5;
        return s;
      }
      case 'pick': {
        // Schwache Läufer früh, starke spät (Gold 3→6). Twin erst, wenn Sieger existieren.
        const avail = spec.options.map(x => x.value);
        const rated = avail.map(id => ({ id, r: this.rate(id, n) + (id === 'twin' ? (g.raceHistory.length ? 1.5 : -4) : 0) })).sort((a, b) => a.r - b.r);
        const races = g.raceIdx, remaining = avail.length;
        const target = Math.min(rated.length - 1, Math.round((races / 3) * (rated.length - 1)));
        const idx = rated.findIndex(x => x.id === v);
        // Wenn wir hinten liegen, im letzten Rennen den Besten; wenn vorn, egal.
        return -Math.abs(idx - target) * 2 + this.noise(1.5) + (remaining <= 1 ? 0 : 0);
      }
      case 'turnStart': case 'roll': case 'continue': return 0;
      case 'method': {
        if (v === 'legs') { const st = g.findAll('stickler').some(x => x !== r); const exact = FINISH - r.pos; return (st && exact < 5 && exact >= 1) ? -5 : 4; }
        if (v === 'flip') { const best = g.active().filter(x => x !== r).reduce((m, x) => Math.max(m, x.pos), -1); return best - r.pos >= 4 ? 5 : -2; }
        return 0;
      }
      case 'target': {
        if (spec.sub === 'flipflop') return posOf(v) - r.pos;
        if (spec.sub === 'thirdwheel') { if (v === -1) return 0.5; return v - r.pos; }
        if (spec.sub === 'hypnotist') { if (v == null) return 0.3; const t = race.racers.find(x => x.id === v); const gain = t.pos - r.pos; return t.player === me ? -9 : gain > 2 ? gain : -1; }
        return this.noise();
      }
      case 'reroll': {
        const roll = spec.roll; const st = g.findAll('stickler').some(x => x !== r); const exact = FINISH - r.pos;
        let mods = 0; if (g.has(r, 'hare')) mods += 2; if (g.findAll('gunk').some(x => x !== r)) mods -= 1;
        const eff = roll + mods;
        if (v === 'keep') return st && eff > exact ? -3 : (roll >= 4 ? 3 : roll === 3 ? 0.5 : -1);
        if (v === 'magic') return roll <= 3 ? 2 : -2;
        if (v === 'dm') { const dm = g.find('dicemonger'); const cost = dm && dm !== r ? 1 : 0; return (roll <= 2 ? 2 : roll === 3 ? 0.3 : -3) - cost; }
        return 0;
      }
      case 'optional': {
        switch (spec.sub) {
          case 'alchemist': return v ? 5 : -5;
          case 'rocket': { const roll = spec.roll; const st = g.findAll('stickler').some(x => x !== r); const dist = FINISH - r.pos; if (v) { if (st && roll * 2 !== dist && roll * 2 > dist) return -8; if (roll * 2 >= dist) return 9; return roll >= 4 && r.pos < lead() ? 2 : -1; } return 0; }
          case 'cheerleader': { const a = g.active(); const mn = Math.min(...a.map(x => x.pos)); const lasts = a.filter(x => x.pos === mn); const mine = lasts.some(x => x.player === me); return v ? (mine ? 4 : -3) : 0; }
          case 'suckerfish': return v ? (spec.target > r.pos ? 6 : -6) : 0;
          case 'duelist': { const foe = race.racers.find(x => x.id === spec.foe); if (foe && foe.player === me) return v ? -5 : 0; return v ? 2 : 0; }
          default: return v ? 1 : 0;
        }
      }
      case 'predictRoll': return (v === 3 || v === 4 ? 0.2 : 0) + this.noise(0.5);
      case 'predictWinner': { const t = race.racers.find(x => x.id === v); if (!t) return 0; return this.rate(g.pw(t) || t.id, n) + (t.pos - lead()) * 0.5 + (t === r ? 1 : 0) + this.noise(); }
      case 'copyPick': case 'eggPick': case 'twinPick': { if (v == null) return 0; return this.rate(v, n) + this.noise(0.8) + (v === 'twin' || v === 'egg' ? -5 : 0); }
      case 'racerOrder': case 'firstRacer': { const t = race.racers.find(x => x.id === v); return t ? (t.tripped ? -3 : 0) + this.rate(g.pw(t) || t.id, n) * 0.1 + this.noise(0.5) : 0; }
      default: return this.noise();
    }
  }
}

const BOTAPI = { Bot, BOT_NAMES, RATING };
if (typeof module !== 'undefined') module.exports = BOTAPI;
if (typeof window !== 'undefined') window.BOTAPI = BOTAPI;
