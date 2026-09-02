'use strict';
/* ============================================================
   MEGA-PFEIFENHEINIS-4000 – Server
   Nur Node/Bun-Builtins: HTTP + eigener WebSocket-Layer.
   Räume (Lobbys), Spiel-Runner mit Replay-Log, Bots, Reconnect.
   ============================================================ */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Game } = require('../engine/engine.js');
const { Bot, BOT_NAMES } = require('../engine/bot.js');

const PORT = process.env.PORT || 3000;
const HTML_PATH = path.join(__dirname, '..', 'dist', 'index.html');
const MAX_SEATS = 6;
const AUTOPILOT_AFTER_MS = 45000;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

/* ---------------- Minimaler WebSocket-Server ---------------- */
class WS {
  constructor(socket) {
    this.socket = socket; this.open = true; this.buf = Buffer.alloc(0); this.frag = null;
    this.onmessage = null; this.onclose = null;
    socket.on('data', d => this.feed(d));
    socket.on('close', () => this.close(false));
    socket.on('error', () => this.close(false));
  }
  feed(d) {
    this.buf = Buffer.concat([this.buf, d]);
    while (true) {
      const b = this.buf; if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (len > 4 * 1024 * 1024) return this.close(true);
      const maskKey = masked ? b.subarray(off, off + 4) : null; if (masked) off += 4;
      if (b.length < off + len) return;
      const payload = Buffer.from(b.subarray(off, off + len));
      if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i & 3];
      this.buf = b.subarray(off + len);
      if (op === 8) return this.close(true);
      if (op === 9) { this.frame(10, payload); continue; }
      if (op === 10) continue;
      if (op === 1 || op === 2 || op === 0) {
        if (op !== 0) this.frag = { op, parts: [payload] }; else if (this.frag) this.frag.parts.push(payload); else continue;
        if (fin) { const full = Buffer.concat(this.frag.parts); const o = this.frag.op; this.frag = null; if (o === 1 && this.onmessage) { try { this.onmessage(full.toString('utf8')); } catch (e) { console.error('onmessage', e); } } }
      }
    }
  }
  frame(op, payload) {
    if (!this.open) return;
    const len = payload.length; let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    try { this.socket.write(Buffer.concat([head, payload])); } catch (e) { this.close(false); }
  }
  send(obj) { this.frame(1, Buffer.from(JSON.stringify(obj), 'utf8')); }
  ping() { this.frame(9, Buffer.alloc(0)); }
  close(sendFrame) {
    if (!this.open) return; this.open = false;
    if (sendFrame) { try { this.frame(8, Buffer.alloc(0)); } catch (e) { } }
    try { this.socket.end(); } catch (e) { }
    if (this.onclose) this.onclose();
  }
}

/* ---------------- Räume ---------------- */
const rooms = new Map();          // code → Room
const clients = new Map();        // token → { ws, name, room, seatId }
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => { let c = ''; do { c = ''; for (let i = 0; i < 5; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]; } while (rooms.has(c)); return c; };
const genToken = () => crypto.randomBytes(16).toString('hex');
const clean = (s, n) => String(s || '').replace(/[^\p{L}\p{N} _\-\.!?]/gu, '').trim().slice(0, n || 16);

class Room {
  constructor(hostToken) {
    this.code = genCode(); this.hostToken = hostToken; this.seats = []; this.status = 'lobby';
    this.game = null; this.seed = null; this.variant = null; this.answers = []; this.pending = new Map(); this.logs = []; this.logSeq = 0;
    this.createdAt = Date.now(); this.lastActivity = Date.now(); this.replaying = false; this.renderTimer = null; this.viewCache = null;
    this.botSeed = crypto.randomInt(1e9);
  }
  touch() { this.lastActivity = Date.now(); }
  seatOf(token) { return this.seats.find(s => s.token === token); }
  addHuman(token, name) {
    if (this.seats.length >= MAX_SEATS) return null;
    const s = { id: genToken().slice(0, 8), kind: 'human', name, token, connected: true, autopilot: false, bot: null };
    this.seats.push(s); return s;
  }
  addBot() {
    if (this.seats.length >= MAX_SEATS) return null;
    const used = new Set(this.seats.map(s => s.name));
    const pool = BOT_NAMES.filter(n => !used.has(n)); const name = pool[crypto.randomInt(pool.length)] || 'Bot';
    const s = { id: genToken().slice(0, 8), kind: 'bot', name, token: null, connected: true, autopilot: false, bot: new Bot({ seed: this.botSeed + this.seats.length * 101 }) };
    this.seats.push(s); return s;
  }
  removeSeat(id) { const i = this.seats.findIndex(s => s.id === id); if (i >= 0) this.seats.splice(i, 1); }
  info() { return { code: this.code, status: this.status, host: this.hostName(), count: this.seats.length, humans: this.seats.filter(s => s.kind === 'human').length, created: this.createdAt }; }
  hostName() { const h = this.seats.find(s => s.token === this.hostToken); return h ? h.name : '?'; }
  view(forToken) {
    return { code: this.code, status: this.status, hostToken: this.hostToken === forToken, variant: this.variant,
      seats: this.seats.map((s, i) => ({ id: s.id, idx: i, name: s.name, kind: s.kind, connected: s.connected, autopilot: s.autopilot, you: s.token === forToken, claimable: s.kind === 'human' && !s.token })) };
  }
  broadcastRoom() { for (const s of this.seats) if (s.token) { const c = clients.get(s.token); if (c && c.ws.open) c.ws.send({ t: 'room', room: this.view(s.token) }); } }
  send(seat, msg) { if (!seat.token) return; const c = clients.get(seat.token); if (c && c.ws.open) c.ws.send(msg); }
  broadcast(msg) { for (const s of this.seats) this.send(s, msg); }

  /* ----- Spiel ----- */
  start(opts) {
    if (this.status !== 'lobby') return 'Spiel läuft bereits.';
    if (this.seats.length < 2) return 'Mindestens 2 Sitze nötig.';
    this.seed = crypto.randomInt(2 ** 31); this.variant = opts && opts.variant === 'single' && this.seats.length === 2 ? 'single' : null;
    this.answers = []; this.logs = []; this.logSeq = 0;
    this.run(false);
    return null;
  }
  run(replay) {
    const room = this; this.status = 'playing'; this.replaying = replay; this.pending.clear();
    const ui = {
      log(text, kind, meta) { const e = { seq: ++room.logSeq, text, kind, meta }; room.logs.push(e); if (room.logs.length > 600) room.logs.shift(); if (!room.replaying) room.broadcast({ t: 'log', entry: e }); },
      render() { room.scheduleRender(); },
      pause(ms) { return room.replaying ? Promise.resolve() : new Promise(r => setTimeout(r, ms)); },
      choose(spec) { return room.ask(spec); }
    };
    this.game = new Game({ playerNames: this.seats.map(s => s.name), seed: this.seed, ui, variant: this.variant || undefined });
    this.broadcastRoom();
    this.game.play().then(() => { this.status = 'finished'; this.replaying = false; this.pushState(true); this.broadcastRoom(); }).catch(e => { console.error('Game error', this.code, e); this.status = 'lobby'; this.game = null; this.broadcast({ t: 'error', msg: 'Spielfehler: ' + e.message }); this.broadcastRoom(); });
  }
  scheduleRender(now) {
    if (this.replaying) return;
    if (now) { this.pushState(); return; }
    if (this.renderTimer) return;
    this.renderTimer = setTimeout(() => { this.renderTimer = null; this.pushState(); }, 40);
  }
  pushState(withLogs) {
    if (!this.game) return;
    const view = this.game.toView(); const snapshot = this.snapshot();
    for (const s of this.seats) { if (!s.token) continue; const q = this.pending.get(this.seats.indexOf(s)); const msg = { t: 'state', view, question: q ? q.public : null, snapshot }; if (withLogs) msg.logs = this.logs; this.send(s, msg); }
  }
  snapshot() { return { code: this.code, seed: this.seed, variant: this.variant, seats: this.seats.map(s => ({ name: s.name, kind: s.kind })), answers: this.answers, savedAt: Date.now() }; }
  ask(spec) {
    const idx = spec.player; const seat = this.seats[idx];
    const pub = { qid: spec.qid, kind: spec.kind, sub: spec.sub || null, title: spec.title, text: spec.text || '', secret: !!spec.secret, player: idx, racer: spec.racer ? spec.racer.id : null, roll: spec.roll == null ? null : spec.roll, options: spec.options.map(o => ({ label: o.label, value: o.value, hint: o.hint || null })) };
    // Replay: aufgezeichnete Antwort
    if (this.answers.length >= spec.qid) { const v = this.answers[spec.qid - 1]; return Promise.resolve(v); }
    if (this.replaying) { this.replaying = false; this.pushState(true); this.broadcastRoom(); }
    this.touch();
    return new Promise(resolve => {
      const done = v => { if (this.pending.get(idx) !== entry) return; this.pending.delete(idx); this.answers[spec.qid - 1] = v; resolve(v); };
      const entry = { spec, public: pub, done, timer: null };
      this.pending.set(idx, entry);
      const botAnswer = (delay) => { const bot = seat.bot || (seat.bot = new Bot({ seed: this.botSeed + idx * 7 })); const v = bot.decide(this.game, spec); entry.timer = setTimeout(() => done(v), delay == null ? bot.delayFor(spec) : delay); };
      if (seat.kind === 'bot') { botAnswer(); for (const s of this.seats) this.send(s, { t: 'waiting', player: idx, kind: spec.kind, secret: !!spec.secret }); return; }
      if (seat.autopilot || !seat.connected) { botAnswer(seat.autopilot ? undefined : AUTOPILOT_AFTER_MS); if (!seat.autopilot) this.broadcast({ t: 'notice', msg: `${seat.name} ist nicht verbunden – Autopilot übernimmt in 45 s.` }); }
      this.send(seat, { t: 'question', question: pub });
      for (const s of this.seats) if (s !== seat) this.send(s, { t: 'waiting', player: idx, kind: spec.kind, secret: !!spec.secret });
    });
  }
  answer(token, qid, value) {
    const idx = this.seats.findIndex(s => s.token === token); if (idx < 0) return 'Kein Sitz.';
    const e = this.pending.get(idx); if (!e || e.public.qid !== qid) return 'Keine offene Frage.';
    if (!e.spec.options.some(o => o.value === value)) return 'Ungültige Antwort.';
    if (e.timer) clearTimeout(e.timer);
    e.done(value); return null;
  }
  onSeatDisconnected(seat) {
    seat.connected = false; this.broadcastRoom();
    const idx = this.seats.indexOf(seat); const e = this.pending.get(idx);
    if (e && this.status === 'playing' && !e.timer) { const bot = seat.bot || (seat.bot = new Bot({ seed: this.botSeed + idx * 7 })); const v = bot.decide(this.game, e.spec); e.timer = setTimeout(() => { seat.autopilot = true; this.broadcastRoom(); e.done(v); }, AUTOPILOT_AFTER_MS); this.broadcast({ t: 'notice', msg: `${seat.name} hat die Verbindung verloren – Autopilot übernimmt in 45 s.` }); }
  }
  onSeatReconnected(seat) {
    seat.connected = true; if (seat.autopilot) { seat.autopilot = false; this.broadcast({ t: 'notice', msg: `${seat.name} ist zurück.` }); }
    const idx = this.seats.indexOf(seat); const e = this.pending.get(idx);
    if (e && e.timer && seat.kind === 'human') { clearTimeout(e.timer); e.timer = null; }
    this.broadcastRoom();
    if (this.game) { this.send(seat, { t: 'state', view: this.game.toView(), question: e ? e.public : null, snapshot: this.snapshot(), logs: this.logs }); }
  }
  static restore(snap, token, name) {
    if (!snap || !Array.isArray(snap.seats) || !Array.isArray(snap.answers) || snap.seats.length < 2 || snap.seats.length > MAX_SEATS) return null;
    const room = new Room(token);
    room.seed = (snap.seed | 0); room.variant = snap.variant || null; room.answers = snap.answers.slice(0, 5000);
    snap.seats.forEach((s, i) => { if (s.kind === 'bot') { const b = room.addBot(); b.name = clean(s.name) || b.name; } else { const h = room.addHuman(null, clean(s.name) || 'Spieler'); h.connected = false; } });
    // Der Wiederherstellende nimmt seinen Sitz (Namensgleichheit), sonst den ersten freien Menschen-Sitz.
    let mine = room.seats.find(s => s.kind === 'human' && s.name === name) || room.seats.find(s => s.kind === 'human' && !s.token);
    if (mine) { mine.token = token; mine.connected = true; }
    rooms.set(room.code, room);
    room.run(true);
    return room;
  }
}

/* ---------------- Verbindungs-Handling ---------------- */
function roomList() { return [...rooms.values()].filter(r => r.status === 'lobby' && r.seats.length < MAX_SEATS).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30).map(r => r.info()); }
function broadcastRoomList() { for (const c of clients.values()) if (c.ws.open && !c.room) c.ws.send({ t: 'rooms', rooms: roomList() }); }

function handle(ws, state, msg) {
  const t = msg.t;
  const err = m => ws.send({ t: 'error', msg: m });
  if (t === 'hello') {
    let token = typeof msg.token === 'string' && /^[a-f0-9]{32}$/.test(msg.token) ? msg.token : genToken();
    const prev = clients.get(token);
    if (prev && prev.ws !== ws && prev.ws.open) { prev.ws.close(true); }
    state.token = token; state.name = clean(msg.name) || (prev && prev.name) || 'Spieler';
    clients.set(token, { ws, name: state.name, room: prev ? prev.room : null });
    ws.send({ t: 'welcome', token, name: state.name });
    const c = clients.get(token);
    if (c.room && rooms.has(c.room.code)) { const seat = c.room.seatOf(token); if (seat) { c.room.onSeatReconnected(seat); ws.send({ t: 'room', room: c.room.view(token) }); if (c.room.game) ws.send({ t: 'state', view: c.room.game.toView(), question: (c.room.pending.get(c.room.seats.indexOf(seat)) || {}).public || null, snapshot: c.room.snapshot(), logs: c.room.logs }); return; } }
    c.room = null; ws.send({ t: 'rooms', rooms: roomList() });
    return;
  }
  const c = clients.get(state.token); if (!c) return err('Bitte zuerst hello.');
  const room = c.room;
  switch (t) {
    case 'listRooms': ws.send({ t: 'rooms', rooms: roomList() }); return;
    case 'setName': { c.name = clean(msg.name) || c.name; state.name = c.name; if (room) { const s = room.seatOf(state.token); if (s) { s.name = c.name; room.broadcastRoom(); } } ws.send({ t: 'welcome', token: state.token, name: c.name }); return; }
    case 'create': {
      if (room) return err('Du bist schon in einem Raum.');
      const r = new Room(state.token); r.addHuman(state.token, c.name); rooms.set(r.code, r); c.room = r;
      ws.send({ t: 'room', room: r.view(state.token) }); broadcastRoomList(); return;
    }
    case 'join': {
      const code = String(msg.code || '').toUpperCase().trim(); const r = rooms.get(code);
      if (room && room.code === code) return; // schon drin (Reload mit Raum-Link)
      if (!r) return err('Raum nicht gefunden. Vielleicht wurde der Server neu gestartet – nutze „Partie wiederherstellen“.');
      if (r.status === 'lobby') {
        if (r.seats.length >= MAX_SEATS) return err('Raum ist voll.');
        r.addHuman(state.token, c.name); c.room = r; r.broadcastRoom(); broadcastRoomList(); return;
      }
      const free = r.seats.filter(s => s.kind === 'human' && !s.token);
      if (!free.length) return err('Dieses Spiel läuft bereits und hat keinen freien Platz.');
      c.room = r; ws.send({ t: 'claim', room: r.view(state.token) }); return;
    }
    case 'claim': {
      if (!room) return err('Kein Raum.');
      const s = room.seats.find(x => x.id === msg.seatId && x.kind === 'human' && !x.token); if (!s) return err('Sitz nicht frei.');
      s.token = state.token; s.name = c.name || s.name; room.onSeatReconnected(s); ws.send({ t: 'room', room: room.view(state.token) }); return;
    }
    case 'leave': {
      if (!room) return;
      const s = room.seatOf(state.token);
      if (room.status === 'lobby') { room.removeSeat(s && s.id); if (room.hostToken === state.token) { const h = room.seats.find(x => x.kind === 'human'); if (h) room.hostToken = h.token; } if (!room.seats.some(x => x.kind === 'human')) rooms.delete(room.code); else room.broadcastRoom(); }
      else if (s) { s.token = null; room.onSeatDisconnected(s); }
      c.room = null; ws.send({ t: 'left' }); ws.send({ t: 'rooms', rooms: roomList() }); broadcastRoomList(); return;
    }
    case 'addBot': { if (!room || room.hostToken !== state.token) return err('Nur der Host.'); if (room.status !== 'lobby') return err('Nur in der Lobby.'); if (!room.addBot()) return err('Raum ist voll.'); room.broadcastRoom(); broadcastRoomList(); return; }
    case 'removeSeat': { if (!room || room.hostToken !== state.token) return err('Nur der Host.'); if (room.status !== 'lobby') return err('Nur in der Lobby.'); const s = room.seats.find(x => x.id === msg.seatId); if (!s || s.token === state.token) return; if (s.token) { const cc = clients.get(s.token); if (cc) { cc.room = null; cc.ws.send({ t: 'left' }); cc.ws.send({ t: 'rooms', rooms: roomList() }); } } room.removeSeat(s.id); room.broadcastRoom(); broadcastRoomList(); return; }
    case 'start': { if (!room || room.hostToken !== state.token) return err('Nur der Host kann starten.'); const e = room.start({ variant: msg.variant }); if (e) return err(e); broadcastRoomList(); return; }
    case 'answer': { if (!room) return err('Kein Raum.'); const e = room.answer(state.token, msg.qid, msg.value); if (e) return err(e); return; }
    case 'emoji': { if (!room) return; const s = room.seatOf(state.token); if (!s) return; const e = String(msg.e || '').slice(0, 4); if (!/^\p{Extended_Pictographic}/u.test(e)) return; room.broadcast({ t: 'reaction', seat: room.seats.indexOf(s), name: s.name, e }); return; }
    case 'restore': {
      if (room) return err('Erst den aktuellen Raum verlassen.');
      const r = Room.restore(msg.snapshot, state.token, c.name); if (!r) return err('Spielstand ungültig.');
      c.room = r; ws.send({ t: 'room', room: r.view(state.token) }); broadcastRoomList(); return;
    }
    case 'backToLobby': { if (!room || room.hostToken !== state.token) return err('Nur der Host.'); if (room.status !== 'finished') return; room.status = 'lobby'; room.game = null; room.answers = []; room.logs = []; room.pending.clear(); room.broadcastRoom(); broadcastRoomList(); return; }
    default: err('Unbekannte Nachricht: ' + t);
  }
}

/* ---------------- HTTP ---------------- */
let htmlCache = null, htmlMtime = 0;
function loadHtml() {
  try { const st = fs.statSync(HTML_PATH); if (!htmlCache || st.mtimeMs !== htmlMtime) { htmlCache = fs.readFileSync(HTML_PATH); htmlMtime = st.mtimeMs; } }
  catch (e) { htmlCache = Buffer.from('<h1>dist/index.html fehlt – bitte "node build.js" ausführen.</h1>'); }
  return htmlCache;
}
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (url === '/' || url === '/index.html' || url.startsWith('/r/')) { const h = loadHtml(); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); return res.end(h); }
  if (url === '/rooms.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(roomList())); }
  res.writeHead(404); res.end('not found');
});
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || req.url.split('?')[0] !== '/ws') { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const ws = new WS(socket); const state = { token: null, name: null };
  ws.onmessage = txt => { let msg; try { msg = JSON.parse(txt); } catch (e) { return; } if (!msg || typeof msg.t !== 'string') return; try { handle(ws, state, msg); } catch (e) { console.error('handle', e); ws.send({ t: 'error', msg: 'Serverfehler.' }); } };
  ws.onclose = () => {
    if (!state.token) return; const c = clients.get(state.token); if (!c || c.ws !== ws) return;
    if (c.room) { const s = c.room.seatOf(state.token); if (s) c.room.onSeatDisconnected(s); if (c.room.status === 'lobby' && !c.room.seats.some(x => x.kind === 'human' && x.connected)) { rooms.delete(c.room.code); broadcastRoomList(); } }
    setTimeout(() => { const cc = clients.get(state.token); if (cc && cc.ws === ws) { if (!cc.room) clients.delete(state.token); } }, 10 * 60 * 1000);
  };
});
setInterval(() => { for (const c of clients.values()) if (c.ws.open) c.ws.ping(); }, 25000);
setInterval(() => { const now = Date.now(); for (const [code, r] of rooms) { if (now - r.lastActivity > ROOM_TTL_MS || (r.status === 'lobby' && !r.seats.some(s => s.kind === 'human' && s.connected) && now - r.createdAt > 60000)) rooms.delete(code); } }, 60000);
loadHtml();
server.listen(PORT, () => console.log(`Mega-Pfeifenheinis-4000 läuft auf Port ${PORT}`));
module.exports = { server, rooms };
