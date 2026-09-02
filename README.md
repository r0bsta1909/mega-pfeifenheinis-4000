# Mega-Pfeifenheinis-4000

Magical Athlete als Browser-Spiel: Hot Seat am selben Gerät, Bots, und Online-Partien per Link mit Lobby.
Kein Framework, keine npm-Abhängigkeiten – Engine, Bots, Server und Client sind reines JavaScript.

## Schnellstart lokal

```
node build.js            # baut dist/index.html (Engine + Bots werden inline gebündelt)
node server/server.js    # http://localhost:3000
```

Nur Hot Seat ohne Server: `dist/index.html` direkt im Browser öffnen und „Lokal am Gerät“ wählen.

Tests: `npm test` (Fuzz 300 Partien, Replay-Determinismus, 100 Bot-Partien).

## Online kostenlos hosten (Render)

1. Repo auf GitHub pushen (inkl. `dist/index.html` oder Build-Schritt, beides ist vorbereitet).
2. Bei https://render.com anmelden → **New → Web Service** → das Repo wählen.
3. Render liest `render.yaml`: Runtime Node, Plan **Free**, Build `npm run build`, Start `node server/server.js`, Health-Check `/health`. Nichts weiter einstellen.
4. **Deploy** – nach 1–2 Minuten gibt es eine `https://….onrender.com`-URL.
5. URL öffnen, Name eingeben, „Raum erstellen“, Link kopieren, an Freunde schicken. Bots über „+ Bot“.

Free-Plan-Eigenheiten: Der Dienst schläft nach 15 Minuten ohne Traffic ein und braucht beim nächsten Aufruf ~1 Minute.
Während einer Partie fließt ständig Traffic, das betrifft also nur das Öffnen der Lobby nach einer Pause.
Startet der Server neu, ist der Speicher weg – der Browser jedes Spielers hält aber einen Spielstand (Seed + Antwortfolge);
in der Lobby erscheint dann „Partie wiederherstellen“, der Server spielt die Partie nach und es geht an derselben Stelle weiter.

Alternativ läuft der Server überall, wo Node ≥ 18 oder Bun läuft (`PORT` per Umgebungsvariable).

## Aufbau

```
engine/engine.js   Regelvollständige, deterministische Engine (alle 36 Läufer, 2-Spieler-Variante, Replay-Log)
engine/bot.js      Bots: Heuristiken je Entscheidungstyp, menschliche Reaktionszeit, kleine Fehlerquote
server/server.js   HTTP + eigener WebSocket-Layer, Räume, Reconnect, Autopilot, Snapshot-Restore
client/index.html  Oberfläche für Lokal + Online, Sound (Web Audio), Animationen, Konfetti
build.js           Bündelt Engine + Bot in client/index.html → dist/index.html
test/              fuzz.js, replay.js, bots.js
```

Jede Spielentscheidung läuft über eine einzige Schnittstelle (`ui.choose(spec)`). Mensch am Gerät, Netzwerkspieler und Bot sind nur
verschiedene Antwortgeber – deshalb lassen sich alle drei in einer Partie mischen.

## Regeln und Auslegungen

- Draft: Snake-Draft in zwei Runden aus je 2× Spieleranzahl aufgedeckten Karten; 2 Spieler nach offizieller Variante (8 Karten, ABBAABBA, zweimal; 2 Läufer pro Rennen).
- Punkte: Gold 3/4/5/6, Silber 1/2/3/4 (Rennen 1–4); Bronze-Chips 1 Punkt.
- Wild Wilds: Pfeile auf 4 (+3), 11 (−2), 19 (+2), 26 (−3); Steine auf 8 und 22; Sterne auf 14 und 28. Eigene Auslegung, das Regelheft enthält den Plan nicht lesbar. Zweite Kurve = Feld 16 (Blimp).
- Prioritätsreihenfolge: Streckenfelder → aktiver Spieler → übrige im Uhrzeigersinn. Endlosschleifen werden einmal durchlaufen, dann beendet (Regel 8).
- Bleibt nur ein Läufer im Rennen, läuft er automatisch ins Ziel.
- Nicht umgesetzt: 3-Spieler-Doppelläufer-Variante.

## Hinweis zur Nutzung

Magical Athlete ist geistiges Eigentum von CMYK (Design Takashi Ishida / Richard Garfield, Art Angela Kirkwood).
Dieses Projekt ist für den privaten Gebrauch gedacht. Namen und Kartentexte liegen als austauschbare Datenliste in `engine/engine.js` (`RACERS`).
