'use strict';
/* ============================================================
   MAGICAL ATHLETE – ENGINE (deterministisch, UI-frei)
   Jede Entscheidung läuft über ui.choose(spec). Die Partie ist
   durch Seed + Antwortfolge vollständig bestimmt (Replay).
   ============================================================ */
const TRACK_LEN = 30;
const FINISH = TRACK_LEN + 1;
const SCHEDULE = ['mild', 'wild', 'mild', 'wild'];
const GOLD = [3, 4, 5, 6];
const SILVER = [1, 2, 3, 4];
const TRACKS = {
  mild: { key: 'mild', name: 'Mild Mile', secondCorner: 16, specials: {} },
  wild: { key: 'wild', name: 'Wild Wilds', secondCorner: 16, specials: {
    4: { type: 'arrow', delta: 3 }, 8: { type: 'rock' }, 11: { type: 'arrow', delta: -2 },
    14: { type: 'star' }, 19: { type: 'arrow', delta: 2 }, 22: { type: 'rock' },
    26: { type: 'arrow', delta: -3 }, 28: { type: 'star' } } }
};
const PLAYER_COLORS = ['#E33D2B', '#2F6FDB', '#3E9B3A', '#F0A500', '#8E44AD', '#F07F1A'];

/* Läuferdaten: bewusst als austauschbare Datenschicht gehalten. */
const RACERS = [
  { id: 'alchemist', name: 'Alchemist', emoji: '⚗️', power: 'Transmutieren', text: 'Würfle ich 1 oder 2 für meinen Hauptzug, kann ich stattdessen 4 ziehen.' },
  { id: 'babayaga', name: 'Baba Yaga', emoji: '🏚️', power: 'Leg it', text: 'Wer auf meinem Feld hält, stürzt – und wer auf einem Feld steht, auf dem ich halte, ebenso.' },
  { id: 'banana', name: 'Banana', emoji: '🍌', power: 'Ausrutscher', text: 'Jeder Läufer, der mich überholt, stürzt.' },
  { id: 'blimp', name: 'Blimp', emoji: '🎈', power: 'Blow It', text: 'Beginne ich meinen Zug vor der zweiten Kurve: +3 auf den Hauptzug. Ab der Kurve: -1.' },
  { id: 'centaur', name: 'Centaur', emoji: '🐴', power: 'Hufschlag', text: 'Überhole ich einen Läufer, zieht er 2 zurück (nie hinter Start).' },
  { id: 'cheerleader', name: 'Cheerleader', emoji: '🎀', power: 'Rah Rah', text: 'Vor meinem Hauptzug kann ich die Letztplatzierten 2 ziehen lassen. Tue ich das, ziehe ich 1.' },
  { id: 'coach', name: 'Coach', emoji: '🦎', power: 'Guter Einsatz', text: 'Alle auf meinem Feld (auch ich) erhalten +1 auf ihren Hauptzug.' },
  { id: 'copycat', name: 'Copycat', emoji: '🐱', power: 'Copy That', text: 'Ich habe dauerhaft die Fähigkeit des führenden Läufers. Bei Gleichstand wähle ich. „Vor dem Rennen“-Fähigkeiten kopiere ich nie.' },
  { id: 'dicemonger', name: 'Dicemonger', emoji: '🎲', power: 'Dicey Deals', text: 'Jeder darf einmal pro Zug seinen Hauptzug-Wurf wiederholen. Tut es ein anderer, ziehe ich 1.' },
  { id: 'duelist', name: 'Duelist', emoji: '🤺', power: 'Duell!', text: 'Teilt ein Läufer mein Feld, kann ich ein Duell fordern: beide würfeln, der Höhere zieht 2. Gleichstand gewinne ich. Auch mehrfach und außerhalb meines Zugs.' },
  { id: 'egg', name: 'Egg', emoji: '🥚', power: 'Scramble', text: 'Vor meinem Rennen ziehe ich 3 neue Läufer vom Stapel und wähle einen. Ich habe seine Fähigkeit (auch „vor dem Rennen“).' },
  { id: 'flipflop', name: 'Flip Flop', emoji: '🩴', power: 'Flop Flip', text: 'Statt zu würfeln kann ich mit einem anderen Läufer den Platz tauschen (Warp).' },
  { id: 'genius', name: 'Genius', emoji: '🧠', power: 'Think Good', text: 'Ich sage meinen Wurf voraus. Stimmt er, bekomme ich nach diesem Zug einen weiteren.' },
  { id: 'gunk', name: 'Gunk', emoji: '🟢', power: 'Goop', text: 'Andere Läufer erhalten -1 auf ihren Hauptzug.' },
  { id: 'hare', name: 'Hare', emoji: '🐇', power: 'Hybris', text: '+2 auf meinen Hauptzug. Beginne ich meinen Zug allein in Führung, überspringe ich meinen Hauptzug.' },
  { id: 'heckler', name: 'Heckler', emoji: '📣', power: 'Schadenfreude', text: 'Beendet ein Läufer seinen Zug max. 1 Feld von seinem Startpunkt entfernt, ziehe ich 2.' },
  { id: 'hugebaby', name: 'Huge Baby', emoji: '👶', power: 'Really Huge', text: 'Niemand darf auf meinem Feld stehen (außer Start). Wer dort landen würde, kommt auf das Feld hinter mir.' },
  { id: 'hypnotist', name: 'Hypnotist', emoji: '🌀', power: 'Hsssst', text: 'Vor meinem Hauptzug kann ich einen Läufer auf mein Feld warpen.' },
  { id: 'inchworm', name: 'Inchworm', emoji: '🪱', power: 'Wriggle', text: 'Würfelt ein anderer Läufer eine 1 für seinen Hauptzug, überspringt er diesen Zug und ich ziehe 1.' },
  { id: 'lackey', name: 'Lackey', emoji: '🎩', power: 'Sehr wohl, Sire', text: 'Würfelt ein anderer Läufer eine 6 für seinen Hauptzug, ziehe ich 2, bevor er zieht.' },
  { id: 'leaptoad', name: 'Leaptoad', emoji: '🐸', power: 'Jumpfrog', text: 'Beim Ziehen überspringe ich Felder, auf denen andere Läufer stehen.' },
  { id: 'legs', name: 'Legs', emoji: '🦵', power: 'Joggen', text: 'Ich kann statt zu würfeln 5 ziehen (zählt als Hauptzug).' },
  { id: 'loser', name: 'Lovable Loser', emoji: '🥺', power: 'D\'aww', text: 'Vor meinem Hauptzug erhalte ich 1 Punkt, wenn ich allein Letzter bin.' },
  { id: 'magician', name: 'Magician', emoji: '🪄', power: 'Poof', text: 'Ich kann meinen Hauptzug-Wurf bis zu zweimal wiederholen.' },
  { id: 'mastermind', name: 'Mastermind', emoji: '🕴️', power: 'Know-It-All', text: 'Zu Beginn meines ersten Zugs sage ich den Sieger voraus. Stimmt es, endet das Rennen sofort und ich werde Zweiter (bei Selbst-Tipp: 1. und 2.).' },
  { id: 'mouth', name: 'M.O.U.T.H.', emoji: '👄', power: 'Chomp', text: 'Halte ich auf einem Feld mit genau einem anderen Läufer, wird dieser aus dem Rennen eliminiert.' },
  { id: 'party', name: 'Party Animal', emoji: '🎉', power: 'Animalischer Magnetismus', text: 'Vor meinem Hauptzug ziehen alle Läufer 1 Feld auf mich zu. Jeder andere Läufer auf meinem Feld gibt mir +1.' },
  { id: 'rocket', name: 'Rocket Scientist', emoji: '🚀', power: 'Kablooey', text: 'Nach dem Würfeln kann ich das Doppelte ziehen – danach stürze ich.' },
  { id: 'romantic', name: 'Romantic', emoji: '💘', power: 'Ah, Liebe!', text: 'Hält jemand auf einem Feld mit genau einem anderen Läufer, ziehe ich 2.' },
  { id: 'scoocher', name: 'Scoocher', emoji: '🐛', power: 'Scooch Scooch', text: 'Immer wenn die Fähigkeit eines anderen Läufers auslöst, ziehe ich 1.' },
  { id: 'sisyphus', name: 'Sisyphus', emoji: '🪨', power: 'Keep Rollin\'', text: 'Vor dem Rennen erhalte ich 4 Punkte. Würfle ich eine 6, warpe ich statt zu ziehen zum Start und verliere 1 Punkt.' },
  { id: 'skipper', name: 'Skipper', emoji: '⚓', power: 'Salty Dog', text: 'Würfelt jemand eine 1 für seinen Hauptzug, bin ich als Nächster dran.' },
  { id: 'stickler', name: 'Stickler', emoji: '🧐', power: 'Eigentlich…', text: 'Andere Läufer müssen das Ziel mit exakter Schrittzahl erreichen. Überschießen sie, bewegen sie sich nicht.' },
  { id: 'suckerfish', name: 'Suckerfish', emoji: '🐟', power: 'Sauger!', text: 'Bewegt sich ein Läufer von meinem Feld weg, kann ich auf sein neues Feld mitziehen – auch über die Ziellinie.' },
  { id: 'thirdwheel', name: 'Third Wheel', emoji: '🎡', power: 'Roll Through', text: 'Vor meinem Hauptzug kann ich auf ein Feld mit genau 2 Läufern warpen.' },
  { id: 'twin', name: 'Twin', emoji: '👯', power: 'Double Dip', text: 'Vor meinem Rennen kann ich einen Läufer wählen, der ein früheres Rennen gewonnen hat, und mit seiner Fähigkeit laufen.' },
];
const RACER_BY_ID = Object.fromEntries(RACERS.map(r => [r.id, r]));
const BEFORE_RACE_POWERS = ['egg', 'twin', 'sisyphus'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

class RaceEnd extends Error { constructor() { super('race end'); this.isRaceEnd = true; } }

class Game {
  /**
   * @param {object} o  { playerNames:[], seed:number, ui:{log,render,choose,pause}, variant?:'single'|'double' }
   */
  constructor(o) {
    this.ui = o.ui;
    this.seed = o.seed == null ? Math.floor(Math.random() * 2 ** 31) : o.seed;
    this.rng = mulberry32(this.seed);
    const n = o.playerNames.length;
    this.variant = o.variant || (n === 2 ? 'double' : 'single');
    this.perPlayer = this.variant === 'double' ? 2 : 1;
    this.teamSize = 4 * this.perPlayer;
    this.players = o.playerNames.map((name, i) => ({ idx: i, name, color: PLAYER_COLORS[i], team: [], used: [], points: 0, results: [] }));
    this.phase = 'setup';
    this.race = null; this.raceIdx = -1; this.startPlayer = 0; this.depth = 0;
    this.deck = []; this.pool = []; this.draftInfo = null; this.winners = []; this.qid = 0;
    this.logSeq = 0; this.logs = [];
    this.raceHistory = [];
  }

  /* ---------- Hilfen ---------- */
  d6() { return 1 + Math.floor(this.rng() * 6); }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  log(text, kind, meta) { const e = { seq: ++this.logSeq, text, kind: kind || 'info', meta: meta || null }; this.logs.push(e); if (this.logs.length > 400) this.logs.shift(); this.ui.log(text, e.kind, meta); }
  render() { this.ui.render(this); }
  pname(i) { return this.players[i].name; }
  rname(r) { const as = r.as && r.as !== r.id ? ` als ${RACER_BY_ID[r.as].name}` : ''; return `${r.def.emoji} ${r.def.name}${as} (${this.pname(r.player)})`; }
  spaceName(p) { return p === 0 ? 'Start' : p > TRACK_LEN ? 'Ziel' : `Feld ${p}`; }
  active() { return this.race.racers.filter(x => x.active); }
  racersAt(p, except) { return this.race.racers.filter(x => x.active && x.pos === p && x !== except); }
  aloneInLead(r) { const a = this.active(); const mx = Math.max(...a.map(x => x.pos)); return r.pos === mx && a.filter(x => x.pos === mx).length === 1; }
  aloneInLast(r) { const a = this.active(); const mn = Math.min(...a.map(x => x.pos)); return r.pos === mn && a.filter(x => x.pos === mn).length === 1; }
  playerOrder(startPi) { const n = this.players.length; return Array.from({ length: n }, (_, k) => (startPi + k) % n); }
  priorityOrder() { // Läufer: aktueller Spieler zuerst (aktueller Läufer ganz vorn), dann im Uhrzeigersinn
    const cur = this.race.current; const startPi = cur ? cur.player : this.race.currentPlayer;
    const out = [];
    for (const pi of this.playerOrder(startPi)) {
      const mine = this.race.racers.filter(x => x.player === pi);
      if (cur && cur.player === pi) { out.push(cur); mine.filter(x => x !== cur).forEach(x => out.push(x)); } else mine.forEach(x => out.push(x));
    }
    return out;
  }
  othersInOrder(r) { return this.priorityOrder().filter(x => x !== r); }
  addPoints(pi, n, why) { this.players[pi].points += n; this.log(`${this.pname(pi)} ${n >= 0 ? 'erhält' : 'verliert'} ${Math.abs(n)} Punkt${Math.abs(n) === 1 ? '' : 'e'} (${why}).`, 'points', { player: pi, delta: n }); }
  async choose(spec) {
    spec.qid = ++this.qid; if (spec.player == null) spec.player = 0;
    this.render();
    const v = await this.ui.choose(spec);
    if (!spec.options.some(o => o.value === v)) throw new Error(`Ungültige Antwort auf Frage ${spec.qid} (${spec.kind})`);
    return v;
  }
  async yesNo(player, title, text, racer, sub, extra) {
    return this.choose(Object.assign({ kind: 'optional', sub, player, title, text, racer, options: [{ label: 'Ja, Fähigkeit nutzen', value: true }, { label: 'Nein', value: false }] }, extra || {}));
  }

  /* ---------- Effektive Fähigkeit (Copycat / Egg / Twin) ---------- */
  pw(r, guard) {
    guard = guard || 0;
    if (guard > 3 || !r) return null;
    if (r.id === 'egg' || r.id === 'twin') { if (!r.as) return null; return this.resolveAs(r, r.as, guard); }
    if (r.id === 'copycat') return this.copyTarget(r, guard);
    return r.id;
  }
  resolveAs(r, id, guard) { if (id === 'copycat') return this.copyTarget(r, guard); return id; }
  copyTarget(r, guard) {
    if (!this.race || !r.active) return null;
    const cands = this.copyCandidates(r);
    if (!cands.length) return null;
    const t = cands.length === 1 ? cands[0] : (cands.find(x => x.id === r.copyPick) || cands[0]);
    if (t === r) return null;
    return this.pw(t, guard + 1);
  }
  copyCandidates(r) {
    const a = this.active().filter(x => x !== r);
    if (!a.length) return [];
    const mx = Math.max(...a.map(x => x.pos));
    if (r.pos > mx) return [];
    return a.filter(x => x.pos === mx);
  }
  has(r, id) { return r.active && this.pw(r) === id; }
  findAll(id) { return this.race ? this.race.racers.filter(x => x.active && this.pw(x) === id) : []; }
  find(id) { return this.findAll(id)[0] || null; }
  async settleCopyPick(pi) {
    for (const r of this.race.racers) {
      if (!r.active || r.player !== pi) continue;
      const isCopy = r.id === 'copycat' || ((r.id === 'egg' || r.id === 'twin') && r.as === 'copycat');
      if (!isCopy) continue;
      const cands = this.copyCandidates(r);
      if (cands.length < 2 || cands.some(x => x.id === r.copyPick)) continue;
      r.copyPick = await this.choose({ kind: 'copyPick', player: r.player, racer: r, title: 'Copycat: Wen kopieren?', text: 'Mehrere Läufer führen – wähle, wessen Fähigkeit du hast.', options: cands.map(x => ({ label: this.rname(x), value: x.id, hint: RACER_BY_ID[this.pw(x) || x.id].text })) });
      this.log(`${r.def.name} kopiert jetzt ${RACER_BY_ID[r.copyPick].name}.`, 'power');
    }
  }

  /* ---------- Spielablauf ---------- */
  async play() {
    this.deck = this.shuffle(RACERS.map(r => r.id));
    const rolls = this.players.map(() => this.d6());
    let best = Math.max(...rolls); let cands = this.players.filter((_, i) => rolls[i] === best);
    while (cands.length > 1) { const rr = cands.map(() => this.d6()); const b = Math.max(...rr); cands = cands.filter((_, i) => rr[i] === b); }
    this.startPlayer = cands[0].idx;
    this.log(`Roll-off: ${this.players.map((p, i) => `${p.name} ${rolls[i]}`).join(', ')} → ${this.pname(this.startPlayer)} beginnt.`, 'roll');
    if (this.variant === 'double') this.log('2-Spieler-Variante: 8 Läufer pro Team, 2 Läufer pro Rennen.', 'race');
    await this.draft();
    for (let i = 0; i < 4; i++) await this.runRace(i);
    this.phase = 'final';
    const mx = Math.max(...this.players.map(p => p.points));
    this.winners = this.players.filter(p => p.points === mx);
    this.log(`Spielende! ${this.winners.map(w => w.name).join(' & ')} gewinn${this.winners.length > 1 ? 'en gemeinsam' : 't'} mit ${mx} Punkten.`, 'race');
    this.render();
    await this.choose({ kind: 'continue', player: this.winners[0].idx, title: 'Siegerehrung', text: 'Die Partie ist beendet.', options: [{ label: 'Endstand ansehen', value: 1 }] });
  }

  async draft() {
    this.phase = 'draft';
    const n = this.players.length;
    let rounds;
    if (this.variant === 'double') {
      const s = this.startPlayer, o = 1 - s;
      rounds = [{ order: [s, o, o, s, s, o, o, s], cards: 8 }, { order: [o, s, s, o, o, s, s, o], cards: 8 }];
    } else {
      rounds = [0, 1].map(round => { const fwd = this.playerOrder((this.startPlayer + round) % n); return { order: fwd.concat(fwd.slice().reverse()), cards: 2 * n }; });
    }
    for (let round = 0; round < rounds.length; round++) {
      this.pool = this.deck.splice(0, rounds[round].cards);
      this.log(`Draft-Runde ${round + 1}: ${this.pool.length} Läufer aufgedeckt.`, 'race');
      const order = rounds[round].order;
      for (let k = 0; k < order.length; k++) {
        const pi = order[k];
        this.draftInfo = { round: round + 1, pick: k + 1, total: order.length, player: pi };
        const id = await this.choose({ kind: 'draft', player: pi, title: `${this.pname(pi)} draftet`, text: `Pick ${k + 1} von ${order.length} · Runde ${round + 1}`, options: this.pool.map(x => ({ label: `${RACER_BY_ID[x].emoji} ${RACER_BY_ID[x].name}`, value: x, hint: RACER_BY_ID[x].text })) });
        this.pool.splice(this.pool.indexOf(id), 1);
        this.players[pi].team.push(id);
        this.log(`${this.pname(pi)} draftet ${RACER_BY_ID[id].emoji} ${RACER_BY_ID[id].name}.`, 'info', { player: pi, racer: id });
      }
    }
    this.draftInfo = null; this.pool = [];
  }

  async runRace(raceIdx) {
    this.raceIdx = raceIdx;
    this.phase = 'pick';
    const track = TRACKS[SCHEDULE[raceIdx]];
    const race = this.race = { idx: raceIdx, track, racers: [], finishers: [], over: false, current: null, currentPlayer: this.startPlayer, turn: 0, elimCount: 0, nextOverride: null, extraTurn: null, dicemongerUsed: false, picks: {}, seen: new Set(), firstTurnDone: {} };
    this.log(`━━━ Rennen ${raceIdx + 1}: ${track.name} (Gold ${GOLD[raceIdx]} · Silber ${SILVER[raceIdx]}) ━━━`, 'race');
    for (const pi of this.playerOrder(this.startPlayer)) {
      const p = this.players[pi]; race.picks[pi] = [];
      for (let k = 0; k < this.perPlayer; k++) {
        const avail = p.team.filter(id => !p.used.includes(id) && !race.picks[pi].includes(id));
        const id = avail.length === 1 ? avail[0] : await this.choose({ kind: 'pick', secret: true, player: pi, title: `${p.name}: Läufer ${this.perPlayer > 1 ? (k + 1) + ' ' : ''}wählen`, text: `Rennen ${raceIdx + 1} · ${track.name}`, options: avail.map(x => ({ label: `${RACER_BY_ID[x].emoji} ${RACER_BY_ID[x].name}`, value: x, hint: RACER_BY_ID[x].text })) });
        race.picks[pi].push(id);
      }
    }
    for (const pi of this.playerOrder(this.startPlayer)) {
      for (const id of race.picks[pi]) {
        this.players[pi].used.push(id);
        race.racers.push({ id, def: RACER_BY_ID[id], player: pi, pos: 0, tripped: false, active: true, finished: null, eliminated: null, prediction: null, predicted: false, as: null, copyPick: null });
      }
    }
    this.phase = 'race';
    this.log(`Aufgedeckt: ${race.racers.map(r => this.rname(r)).join(', ')}. ${this.pname(this.startPlayer)} beginnt.`, 'race');
    // „Vor dem Rennen“-Fähigkeiten (Egg → Twin → Sisyphus), in Spielerreihenfolge
    for (const pi of this.playerOrder(this.startPlayer)) {
      for (const r of race.racers.filter(x => x.player === pi)) {
        if (r.id === 'egg') {
          const draw = this.deck.splice(0, 3);
          if (!draw.length) { this.log('Egg: Der Stapel ist leer – kein Schlüpfen möglich.', 'power'); continue; }
          r.as = await this.choose({ kind: 'eggPick', player: pi, racer: r, title: 'Egg: Was schlüpft?', text: 'Wähle einen der drei gezogenen Läufer – Egg hat seine Fähigkeit.', options: draw.map(x => ({ label: `${RACER_BY_ID[x].emoji} ${RACER_BY_ID[x].name}`, value: x, hint: RACER_BY_ID[x].text })) });
          draw.filter(x => x !== r.as).forEach(x => this.deck.push(x));
          this.log(`Egg schlüpft als ${RACER_BY_ID[r.as].emoji} ${RACER_BY_ID[r.as].name}.`, 'power');
        }
        if (r.id === 'twin') {
          const won = [...new Set(this.raceHistory.map(h => h.first).filter(Boolean))].filter(id => id !== 'twin' && id !== 'egg');
          if (!won.length) { this.log('Twin: Noch kein Rennsieger zum Kopieren.', 'power'); continue; }
          const opts = won.map(x => ({ label: `${RACER_BY_ID[x].emoji} ${RACER_BY_ID[x].name}`, value: x, hint: RACER_BY_ID[x].text })); opts.push({ label: 'Niemanden kopieren', value: null });
          r.as = await this.choose({ kind: 'twinPick', player: pi, racer: r, title: 'Twin: Wen kopieren?', text: 'Ein Läufer, der ein früheres Rennen gewonnen hat.', options: opts });
          if (r.as) this.log(`Twin läuft als ${RACER_BY_ID[r.as].emoji} ${RACER_BY_ID[r.as].name}.`, 'power');
        }
      }
    }
    for (const r of race.racers) { const b = (r.id === 'egg' || r.id === 'twin') ? r.as : r.id; if (b === 'sisyphus') this.addPoints(r.player, 4, 'Sisyphus: Keep Rollin\''); }
    await this.choose({ kind: 'continue', player: this.startPlayer, title: 'Alle Läufer stehen am Start', text: 'Bereit für das Rennen?', options: [{ label: 'Rennen starten', value: 1 }] });
    let idx = 0, guard = 0;
    const order = this.playerOrder(this.startPlayer);
    try {
      while (true) {
        if (++guard > 600) { this.log('Zuglimit erreicht – Rennen wird abgebrochen.', 'warn'); break; }
        const act = this.active();
        if (act.length === 0) break;
        if (act.length === 1 && race.finishers.length >= 1) {
          const solo = act[0];
          this.log(`${this.rname(solo)} ist der einzige verbliebene Läufer und läuft unangefochten ins Ziel.`, 'race');
          solo.pos = FINISH; this.render(); this.finish(solo); break;
        }
        const pi = order[idx];
        await this.playerTurn(pi);
        if (race.nextOverride != null) { idx = order.indexOf(race.nextOverride); race.nextOverride = null; }
        else idx = (idx + 1) % order.length;
      }
    } catch (e) { if (!e.isRaceEnd) throw e; }
    race.over = true; race.current = null;
    await this.afterRace();
  }

  async playerTurn(pi) {
    const race = this.race;
    race.currentPlayer = pi;
    let mine = race.racers.filter(x => x.active && x.player === pi);
    if (!mine.length) return;
    await this.settleCopyPick(pi);
    if (this.perPlayer > 1 && !race.firstTurnDone[pi]) {
      race.firstTurnDone[pi] = true;
      let r = mine[0];
      if (mine.length > 1) { const id = await this.choose({ kind: 'firstRacer', player: pi, title: `${this.pname(pi)}: Erster Zug`, text: 'Im ersten Zug ziehst du nur einen deiner beiden Läufer.', options: mine.map(x => ({ label: this.rname(x), value: x.id })) }); r = mine.find(x => x.id === id); }
      await this.takeTurnWithExtras(r);
      return;
    }
    const done = new Set();
    while (true) {
      mine = race.racers.filter(x => x.active && x.player === pi && !done.has(x));
      if (!mine.length) break;
      let r = mine[0];
      if (mine.length > 1) { const id = await this.choose({ kind: 'racerOrder', player: pi, title: `${this.pname(pi)}: Welcher Läufer zuerst?`, options: mine.map(x => ({ label: `${this.rname(x)} – ${this.spaceName(x.pos)}${x.tripped ? ' (liegt flach)' : ''}`, value: x.id })) }); r = mine.find(x => x.id === id); }
      done.add(r);
      await this.takeTurnWithExtras(r);
    }
  }

  async takeTurnWithExtras(r) {
    let extra = 0;
    do {
      this.race.extraTurn = null;
      await this.takeTurn(r);
      if (this.race.extraTurn === r && r.active && extra < 5) { extra++; this.log(`${this.rname(r)} ist erneut am Zug.`, 'power'); } else break;
    } while (true);
    this.race.extraTurn = null;
  }

  /* ---------- Zug ---------- */
  async takeTurn(r) {
    const race = this.race;
    race.turn++; race.current = r; race.dicemongerUsed = false; race.seen = new Set();
    const startPos = r.pos;
    this.log(`▶ ${this.rname(r)} ist am Zug.`, 'turn', { racer: r.id, player: r.player });
    await this.choose({ kind: 'turnStart', player: r.player, racer: r, title: `${this.pname(r.player)}: ${r.def.name} ist am Zug`, text: r.tripped ? `${r.def.name} liegt flach – steht jetzt auf und überspringt den Hauptzug.` : `${r.def.name} steht auf ${this.spaceName(r.pos)}.`, options: [{ label: 'Zug beginnen', value: 1 }] });
    let skipMain = false;
    if (r.tripped) { r.tripped = false; skipMain = true; this.log(`${r.def.name} steht wieder auf und überspringt den Hauptzug.`, 'trip'); }
    this.render();
    if (this.has(r, 'mastermind') && !r.predicted) {
      r.predicted = true;
      const cands = this.active();
      r.prediction = await this.choose({ kind: 'predictWinner', player: r.player, racer: r, title: 'Mastermind: Wer gewinnt das Rennen?', text: 'Stimmt die Vorhersage, endet das Rennen sofort und Mastermind wird Zweiter.', options: cands.map(x => ({ label: this.rname(x), value: x.id })) });
      this.log(`${r.def.name} sagt voraus: ${RACER_BY_ID[r.prediction].name} gewinnt.`, 'power');
      await this.powerHappened(r);
    }
    if (this.has(r, 'hare') && !skipMain && this.aloneInLead(r)) { skipMain = true; this.log(`${r.def.name} ist allein in Führung – Hybris! Hauptzug wird übersprungen.`, 'power'); await this.powerHappened(r); }
    await this.beforeMainMove(r);
    if (!skipMain && r.active) await this.mainMove(r);
    if (!r.active) return;
    await this.endOfTurn(r, startPos);
  }

  async beforeMainMove(r) {
    if (!r.active) return;
    switch (this.pw(r)) {
      case 'loser':
        if (this.aloneInLast(r)) { this.addPoints(r.player, 1, `${r.def.name} allein Letzter`); await this.powerHappened(r); }
        break;
      case 'party': {
        this.log(`${r.def.name}: Alle Läufer ziehen 1 Feld auf das Party Animal zu.`, 'power');
        for (const o of this.othersInOrder(r)) {
          if (!o.active || !r.active) continue;
          if (o.pos < r.pos) await this.moveRacer(o, 1, 'power'); else if (o.pos > r.pos) await this.moveRacer(o, -1, 'power');
        }
        await this.powerHappened(r);
        break; }
      case 'cheerleader': {
        const a = this.active(); const mn = Math.min(...a.map(x => x.pos)); const lasts = a.filter(x => x.pos === mn);
        const ok = await this.yesNo(r.player, 'Cheerleader: Rah Rah?', `Letztplatzierte (${lasts.map(x => x.def.name).join(', ')}) ziehen 2, danach zieht ${r.def.name} 1.`, r, 'cheerleader');
        if (ok) { for (const l of lasts) { if (l.active) await this.moveRacer(l, 2, 'power'); } if (r.active) await this.moveRacer(r, 1, 'power'); await this.powerHappened(r); }
        break; }
      case 'thirdwheel': {
        const counts = {}; this.active().forEach(x => { counts[x.pos] = (counts[x.pos] || 0) + 1; });
        const spaces = Object.keys(counts).map(Number).filter(p => counts[p] === 2 && p !== r.pos);
        if (!spaces.length) break;
        const opts = spaces.map(p => ({ label: `${this.spaceName(p)}: ${this.racersAt(p).map(x => x.def.emoji + ' ' + x.def.name).join(' + ')}`, value: p }));
        opts.push({ label: 'Nicht warpen', value: -1 });
        const p = await this.choose({ kind: 'target', sub: 'thirdwheel', player: r.player, racer: r, title: 'Third Wheel: Roll Through?', text: 'Warp auf ein Feld mit genau 2 Läufern (kein Zug – löst kein Überholen aus).', options: opts });
        if (p >= 0) { this.log(`${r.def.name}: Roll Through auf ${this.spaceName(p)}.`, 'power'); await this.powerHappened(r); await this.moveRacer(r, p - r.pos, 'warp'); }
        break; }
      case 'hypnotist': {
        const others = this.active().filter(x => x !== r && x.pos !== r.pos);
        if (!others.length) break;
        const opts = others.map(x => ({ label: `${this.rname(x)} (${this.spaceName(x.pos)})`, value: x.id }));
        opts.push({ label: 'Niemanden warpen', value: null });
        const id = await this.choose({ kind: 'target', sub: 'hypnotist', player: r.player, racer: r, title: 'Hypnotist: Hsssst?', text: `Einen Läufer auf mein Feld (${this.spaceName(r.pos)}) warpen.`, options: opts });
        if (id) { const t = this.race.racers.find(x => x.id === id && x.active); if (t) { this.log(`${r.def.name}: Hsssst! ${t.def.name} wird auf ${this.spaceName(r.pos)} gewarpt.`, 'power'); await this.powerHappened(r); await this.moveRacer(t, r.pos - t.pos, 'warp'); } }
        break; }
    }
  }

  async mainMove(r) {
    const race = this.race;
    let base = null, roll = null, rocketTrip = false;
    const p = this.pw(r);
    const opts = [{ label: '🎲 Würfeln', value: 'roll' }];
    if (p === 'legs') opts.push({ label: '🦵 Joggen: 5 ziehen ohne Würfel', value: 'legs' });
    if (p === 'flipflop' && this.active().some(x => x !== r && x.pos !== r.pos)) opts.push({ label: '🩴 Flop Flip: Platz tauschen', value: 'flip' });
    const method = opts.length > 1 ? await this.choose({ kind: 'method', sub: p, player: r.player, racer: r, title: `${r.def.name}: Hauptzug`, text: 'Wie ziehst du?', options: opts }) : 'roll';
    if (method === 'flip') {
      const others = this.active().filter(x => x !== r && x.pos !== r.pos);
      const id = await this.choose({ kind: 'target', sub: 'flipflop', player: r.player, racer: r, title: 'Flop Flip: Mit wem tauschen?', options: others.map(x => ({ label: `${this.rname(x)} (${this.spaceName(x.pos)})`, value: x.id })) });
      const t = others.find(x => x.id === id);
      const a = r.pos, b = t.pos; r.pos = b; t.pos = a;
      this.log(`${r.def.name} tauscht per Warp den Platz mit ${t.def.name} (${this.spaceName(a)} ⇄ ${this.spaceName(b)}).`, 'power', { warp: [[r.id, a, b], [t.id, b, a]] });
      this.render(); await this.ui.pause(300);
      await this.powerHappened(r);
      await this.onStop(r); if (t.active) await this.onStop(t);
      return;
    }
    if (method === 'legs') { base = 5; this.log(`${r.def.name} joggt: 5 Felder statt Würfelwurf.`, 'power'); await this.powerHappened(r); }
    else {
      if (p === 'genius') {
        r.prediction = await this.choose({ kind: 'predictRoll', player: r.player, racer: r, title: 'Genius: Welche Zahl würfelst du?', options: [1, 2, 3, 4, 5, 6].map(n => ({ label: String(n), value: n })) });
        this.log(`${r.def.name} sagt eine ${r.prediction} voraus.`, 'power');
      }
      roll = await this.rollMain(r);
      if (!r.active) return;
      let skipped = false;
      for (const o of this.othersInOrder(r)) {
        if (!o.active || !r.active) continue;
        const op = this.pw(o);
        if (op === 'lackey' && roll === 6) { this.log(`${o.def.name}: Sehr wohl, Sire! Zieht 2, bevor die 6 gezogen wird.`, 'power'); await this.moveRacer(o, 2, 'power'); await this.powerHappened(o); }
        if (op === 'inchworm' && roll === 1) { skipped = true; this.log(`${o.def.name}: ${r.def.name} überspringt den Zug, Inchworm wriggelt 1.`, 'power'); await this.moveRacer(o, 1, 'power'); await this.powerHappened(o); }
        if (op === 'skipper' && roll === 1) { race.nextOverride = o.player; this.log(`${o.def.name}: Salty Dog! ${this.pname(o.player)} ist als Nächster dran.`, 'power'); await this.powerHappened(o); }
      }
      if (p === 'skipper' && roll === 1) { race.extraTurn = r; this.log(`${r.def.name} würfelt eine 1 und ist gleich nochmal dran.`, 'power'); }
      if (p === 'genius' && r.prediction === roll) { race.extraTurn = r; this.log(`${r.def.name} lag richtig – Extrazug!`, 'power'); await this.powerHappened(r); }
      if (!r.active || skipped) return;
      if (p === 'sisyphus' && roll === 6) {
        this.log(`${r.def.name} würfelt 6: rollt zurück zum Start.`, 'power');
        if (this.players[r.player].points > 0) this.addPoints(r.player, -1, 'Sisyphus');
        await this.powerHappened(r);
        if (r.pos !== 0) await this.moveRacer(r, -r.pos, 'warp');
        return;
      }
      base = roll;
      if (p === 'alchemist' && roll <= 2) {
        const ok = await this.yesNo(r.player, 'Alchemist: Transmutieren?', `Statt ${roll} → 4 Felder ziehen.`, r, 'alchemist', { roll });
        if (ok) { base = 4; this.log(`${r.def.name} transmutiert den Wurf zu 4.`, 'power'); await this.powerHappened(r); }
      }
      if (p === 'rocket') {
        const ok = await this.yesNo(r.player, 'Rocket Scientist: Kablooey?', `Doppelt ziehen (${roll * 2} statt ${roll}) – danach stürzen.`, r, 'rocket', { roll });
        if (ok) { base = roll * 2; rocketTrip = true; this.log(`Kablooey! ${r.def.name} verdoppelt.`, 'power'); await this.powerHappened(r); }
      }
    }
    if (!r.active) return;
    let mod = 0; const why = [];
    for (const c of this.findAll('coach')) if (c.pos === r.pos) { mod += 1; why.push('Coach +1'); await this.powerHappened(c); }
    for (const g of this.findAll('gunk')) if (g !== r) { mod -= 1; why.push('Gunk -1'); await this.powerHappened(g); }
    if (p === 'hare') { mod += 2; why.push('Hare +2'); await this.powerHappened(r); }
    if (p === 'blimp') { if (r.pos < race.track.secondCorner) { mod += 3; why.push('Blimp +3'); } else { mod -= 1; why.push('Blimp -1'); } await this.powerHappened(r); }
    if (p === 'party') { const c = this.racersAt(r.pos, r).length; if (c > 0) { mod += c; why.push(`Party +${c}`); await this.powerHappened(r); } }
    if (!r.active) return;
    const amount = Math.max(0, base + mod);
    this.log(`${r.def.name} zieht ${amount}${why.length ? ' (' + base + ' ' + why.join(', ') + ')' : ''}.`, 'move');
    await this.moveRacer(r, amount, 'main');
    if (rocketTrip && r.active) this.trip(r);
  }

  async rollMain(r) {
    const race = this.race;
    await this.choose({ kind: 'roll', player: r.player, racer: r, title: `${r.def.name}: Hauptzug`, text: 'Würfeln und so viele Felder ziehen.', options: [{ label: '🎲 Würfeln', value: 1 }] });
    let roll = this.d6();
    this.log(`${r.def.name} würfelt ${roll}.`, 'roll', { roll, racer: r.id });
    let magic = this.has(r, 'magician') ? 2 : 0;
    while (true) {
      const opts = [{ label: `${roll} behalten`, value: 'keep' }];
      if (magic > 0) opts.push({ label: `🪄 Poof: neu würfeln (${magic} übrig)`, value: 'magic' });
      const dm = this.find('dicemonger');
      if (dm && !race.dicemongerUsed) opts.push({ label: '🎲 Dicey Deals: neu würfeln' + (dm !== r ? ' (Dicemonger zieht 1)' : ''), value: 'dm' });
      if (opts.length === 1) break;
      const c = await this.choose({ kind: 'reroll', player: r.player, racer: r, roll, title: `Wurf: ${roll}`, text: 'Wurf behalten oder wiederholen?', options: opts });
      if (c === 'keep') break;
      if (c === 'magic') { magic--; this.log(`${r.def.name}: Poof! Neuer Wurf.`, 'power'); await this.powerHappened(r); }
      else { race.dicemongerUsed = true; this.log(`Dicey Deals: ${r.def.name} würfelt neu.`, 'power'); if (dm !== r) await this.moveRacer(dm, 1, 'power'); await this.powerHappened(dm); }
      roll = this.d6();
      this.log(`${r.def.name} würfelt neu: ${roll}.`, 'roll', { roll, racer: r.id });
    }
    return roll;
  }

  async endOfTurn(r, startPos) {
    for (const h of this.findAll('heckler')) {
      if (h !== r && r.active && Math.abs(r.pos - startPos) <= 1) {
        this.log(`${h.def.name}: Schadenfreude! ${r.def.name} kam kaum vom Fleck – zieht 2.`, 'power');
        await this.moveRacer(h, 2, 'power'); await this.powerHappened(h);
      }
    }
  }

  /* ---------- Bewegung ---------- */
  trip(r) { if (!r.active) return; if (!r.tripped) this.log(`${r.def.name} stürzt und liegt flach!`, 'trip', { racer: r.id }); r.tripped = true; }
  eliminate(r) { if (!r.active) return; r.active = false; r.eliminated = this.race.elimCount++; this.log(`${this.rname(r)} wurde aus dem Rennen eliminiert!`, 'trip', { eliminated: r.id }); }

  async moveRacer(r, amount, kind) {
    const race = this.race;
    if (race.over || !r.active || amount === 0) return;
    if (this.depth > 30) { this.log('Kettenreaktion abgebrochen (Endlosschleife – Regel 8).', 'warn'); return; }
    this.depth++;
    try {
      const from = r.pos; let to; let skippedCount = 0;
      if (amount > 0) {
        if (this.has(r, 'leaptoad') && kind !== 'warp') {
          let p = from, steps = 0;
          while (steps < amount && p <= TRACK_LEN) { p++; if (p <= TRACK_LEN && this.racersAt(p, r).length > 0) { skippedCount++; continue; } steps++; }
          to = p;
        } else to = from + amount;
        if (to > TRACK_LEN) {
          const st = this.findAll('stickler').find(x => x !== r);
          if (st && to !== FINISH) { this.log(`${st.def.name}: Eigentlich… ${r.def.name} müsste das Ziel exakt erreichen (${FINISH - from} nötig) – bewegt sich nicht.`, 'power'); await this.powerHappened(st); return; }
          to = FINISH;
        }
      } else to = Math.max(0, from + amount);
      const hb = this.findAll('hugebaby').find(x => x !== r && x.pos === to);
      if (hb && to > 0 && to <= TRACK_LEN) { to -= 1; this.log(`${hb.def.name} blockiert ${this.spaceName(to + 1)} – ${r.def.name} kommt auf ${this.spaceName(to)}.`, 'power'); await this.powerHappened(hb); }
      if (to === from) return;
      const passed = (kind !== 'warp' && to > from) ? race.racers.filter(o => o !== r && o.active && o.pos > from && o.pos < to) : [];
      const suckers = kind !== 'warp' ? race.racers.filter(o => o !== r && o.active && o.pos === from && this.pw(o) === 'suckerfish') : [];
      r.pos = to;
      const finishedNow = to > TRACK_LEN;
      this.log(`${r.def.name} ${kind === 'warp' ? 'warpt' : 'bewegt sich'} ${this.spaceName(from)} → ${this.spaceName(to)}${passed.length ? ' und überholt ' + passed.map(x => x.def.name).join(', ') : ''}.`, kind === 'warp' ? 'power' : 'move', { move: [r.id, from, to, kind] });
      this.render();
      await this.ui.pause(kind === 'warp' ? 350 : Math.min(900, 120 + 90 * Math.abs(to - from)));
      if (finishedNow) this.finish(r);
      for (let i = 0; i < skippedCount; i++) await this.powerHappened(r);
      for (const o of passed) {
        if (!o.active) continue;
        if (this.has(o, 'banana') && r.active) { this.log(`${o.def.name}: ${r.def.name} rutscht aus!`, 'power'); this.trip(r); await this.powerHappened(o); }
        if (this.has(r, 'centaur') && o.active) { this.log(`Hufschlag! ${o.def.name} zieht 2 zurück.`, 'power'); await this.moveRacer(o, -2, 'power'); await this.powerHappened(r); }
      }
      if (!finishedNow) await this.onStop(r);
      for (const s of suckers) {
        if (!s.active || race.over) continue;
        const target = finishedNow ? FINISH : r.pos;
        if (target === s.pos) continue;
        const ok = await this.yesNo(s.player, 'Suckerfish: Sauger!', `${r.def.name} hat sich von deinem Feld bewegt. Mitziehen nach ${this.spaceName(target)}?`, s, 'suckerfish', { target });
        if (ok) { this.log(`${s.def.name} saugt sich an ${r.def.name} fest.`, 'power'); await this.powerHappened(s); await this.moveRacer(s, target - s.pos, 'power'); }
      }
    } finally { this.depth--; }
  }

  async onStop(r) {
    const race = this.race; const p = r.pos;
    if (!r.active || race.over) return;
    const key = r.id + '@' + p + '|' + race.racers.map(x => x.pos + (x.tripped ? 't' : '') + (x.active ? '' : 'x')).join(',');
    if (race.seen.has(key)) { this.log(`Endlosschleife erkannt (${r.def.name} auf ${this.spaceName(p)}): einmal durchlaufen, dann beendet – Regel 8.`, 'warn'); return; }
    race.seen.add(key);
    const sp = race.track.specials[p];
    if (sp) {
      if (sp.type === 'arrow') { this.log(`Pfeil auf Feld ${p}: ${r.def.name} bewegt sich ${sp.delta > 0 ? '+' : ''}${sp.delta}.`, 'track'); await this.moveRacer(r, sp.delta, 'arrow'); return; }
      if (sp.type === 'rock') { this.log(`Stein auf Feld ${p}!`, 'track'); this.trip(r); }
      if (sp.type === 'star') { this.log(`Stern auf Feld ${p}!`, 'track'); this.addPoints(r.player, 1, 'Stern-Feld'); }
    }
    for (const o of this.priorityOrder()) {
      if (race.over) return;
      if (!o.active || !r.active || r.pos !== p) return;
      switch (this.pw(o)) {
        case 'babayaga':
          if (o === r) { const vs = this.racersAt(p, r); if (vs.length) { this.log(`${o.def.name}: Leg it! Alle auf ihrem Feld stürzen.`, 'power'); vs.forEach(x => this.trip(x)); await this.powerHappened(o); } }
          else if (o.pos === p) { this.log(`${o.def.name}: ${r.def.name} hält auf ihrem Feld und stürzt.`, 'power'); this.trip(r); await this.powerHappened(o); }
          break;
        case 'mouth':
          if (o === r) { const vs = this.racersAt(p, r); if (vs.length === 1) { this.log(`${o.def.name}: Chomp!`, 'power', { chomp: vs[0].id }); this.eliminate(vs[0]); await this.powerHappened(o); } }
          break;
        case 'romantic':
          if (this.racersAt(p).length === 2) { this.log(`${o.def.name}: Ah, Liebe! Zieht 2.`, 'power'); await this.moveRacer(o, 2, 'power'); await this.powerHappened(o); }
          break;
        case 'duelist': {
          let foes = [];
          if (o === r) foes = this.racersAt(p, r); else if (o.pos === p) foes = [r];
          for (const f of foes) {
            for (let n = 0; n < 3; n++) {
              if (!o.active || !f.active || o.pos !== f.pos || race.over) break;
              const ok = await this.yesNo(o.player, 'Duelist: DUELL?', `Duell gegen ${f.def.name}: beide würfeln, der Höhere zieht 2 (Gleichstand: Duelist).`, o, 'duelist', { foe: f.id });
              if (!ok) break;
              const a = this.d6(), b = this.d6(); const win = a >= b ? o : f;
              this.log(`Duell! ${o.def.name} ${a} vs ${f.def.name} ${b} → ${win.def.name} zieht 2.`, 'roll', { duel: [a, b] });
              await this.powerHappened(o); await this.moveRacer(win, 2, 'power');
            }
          }
          break; }
      }
    }
  }

  async powerHappened(owner) {
    for (const sc of this.findAll('scoocher')) {
      if (sc === owner || this.race.over) continue;
      this.log(`${sc.def.name} scoocht 1.`, 'power');
      await this.moveRacer(sc, 1, 'power');
    }
  }

  finish(r) {
    const race = this.race;
    r.active = false; r.tripped = false;
    const place = race.finishers.length + 1;
    r.finished = place; race.finishers.push(r);
    this.log(`🏁 ${this.rname(r)} überquert die Ziellinie als ${place}.!`, 'race', { finish: [r.id, place] });
    this.addPoints(r.player, place === 1 ? GOLD[race.idx] : SILVER[race.idx], place === 1 ? 'Gold-Trophäe' : 'Silber-Rosette');
    if (place === 1) {
      const mm = race.racers.find(x => x.predicted && x.prediction === r.id && (x.active ? this.pw(x) === 'mastermind' : x === r));
      if (mm) {
        this.log(`${mm.def.name} hat ${r.def.name} vorausgesagt – Rennen endet, ${mm.def.name} wird Zweiter!`, 'power');
        mm.active = false; mm.finished = 2; race.finishers.push(mm);
        this.addPoints(mm.player, SILVER[race.idx], 'Silber-Rosette (Mastermind)');
        race.over = true; throw new RaceEnd();
      }
    }
    if (race.finishers.length >= 2) { race.over = true; throw new RaceEnd(); }
  }

  async afterRace() {
    const race = this.race;
    const [g, s] = race.finishers;
    const lines = [];
    lines.push(g ? `🏆 1. Platz: ${this.rname(g)} (+${GOLD[race.idx]})` : '🏆 1. Platz: niemand');
    lines.push(s ? `🥈 2. Platz: ${this.rname(s)} (+${SILVER[race.idx]})` : '🥈 2. Platz: niemand – Silber verfällt');
    if (this.variant === 'double') {
      const pts = this.players.map(p => race.racers.filter(r => r.player === p.idx).reduce((a, r) => a + (r.finished === 1 ? GOLD[race.idx] : r.finished === 2 ? SILVER[race.idx] : 0), 0));
      const mn = Math.min(...pts); const cands = this.players.filter((_, i) => pts[i] === mn);
      this.startPlayer = cands.length === 1 ? cands[0].idx : cands[Math.floor(this.rng() * cands.length)].idx;
      lines.push(`Nächster Startspieler: ${this.pname(this.startPlayer)} (weniger Punkte im Rennen${cands.length > 1 ? ', Roll-off' : ''}).`);
    } else {
      const rest = race.racers.filter(r => !r.finished);
      if (rest.length) {
        const elim = rest.filter(r => r.eliminated != null).sort((a, b) => a.eliminated - b.eliminated);
        const last = elim.length ? elim[0] : rest.slice().sort((a, b) => a.pos - b.pos)[0];
        this.startPlayer = last.player; lines.push(`Nächster Startspieler: ${this.pname(last.player)} (${last.def.name} war am weitesten zurück).`);
      }
    }
    this.players.forEach(p => race.racers.filter(r => r.player === p.idx).forEach(r => p.results.push({ id: r.id, as: r.as, finished: r.finished, eliminated: r.eliminated, race: race.idx })));
    this.raceHistory.push({ idx: race.idx, track: race.track.key, first: g ? (g.as || g.id) : null, second: s ? (s.as || s.id) : null, firstPlayer: g ? g.player : null, secondPlayer: s ? s.player : null });
    this.log(lines.join(' '), 'race', { raceEnd: race.idx });
    this.phase = 'raceResult';
    await this.choose({ kind: 'continue', player: this.startPlayer, title: `Rennen ${race.idx + 1} beendet`, text: lines.join('\n'), options: [{ label: race.idx < 3 ? 'Weiter zum nächsten Rennen' : 'Zur Siegerehrung', value: 1 }] });
  }

  /* ---------- View-Modell für Clients ---------- */
  toView() {
    const race = this.race;
    return {
      phase: this.phase, variant: this.variant, seed: this.seed, raceIdx: this.raceIdx, startPlayer: this.startPlayer,
      players: this.players.map(p => ({ idx: p.idx, name: p.name, color: p.color, points: p.points, team: p.team, used: p.used, results: p.results })),
      draftInfo: this.draftInfo, pool: this.pool,
      race: race ? {
        idx: race.idx, track: race.track.key, over: race.over, turn: race.turn,
        current: race.current ? race.current.id : null, currentPlayer: race.currentPlayer,
        racers: race.racers.map(r => ({ id: r.id, as: r.as, pw: this.pw(r), player: r.player, pos: r.pos, tripped: r.tripped, active: r.active, finished: r.finished, eliminated: r.eliminated })),
        finishers: race.finishers.map(f => f.id)
      } : null,
      winners: this.winners.map(w => w.idx),
      history: this.raceHistory
    };
  }
}

const ENGINE = { Game, RaceEnd, RACERS, RACER_BY_ID, TRACKS, SCHEDULE, GOLD, SILVER, TRACK_LEN, FINISH, PLAYER_COLORS, mulberry32, BEFORE_RACE_POWERS };
if (typeof module !== 'undefined') module.exports = ENGINE;
if (typeof window !== 'undefined') window.ENGINE = ENGINE;
