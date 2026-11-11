// =====================================================================
//  Bloxorzi MOOTOR – mängureeglid + laiuti otsing (BFS)
//  Siin pole ühtegi rida graafikat, seega töötab nii brauseris kui ka
//  Node.js-is (node test.js).
//
//  Kaardi tähised:
//    .  tühjus           #  plaat            o  oranž (habras) plaat
//    S  algus            G  auk (eesmärk)
//    a-d  pehme lüliti (grupp 1-4) – käivitub igal juhul
//    A-D  raske lüliti (grupp 1-4) – käivitub ainult püsti seistes
//    1-4  sild, alguses kinni         5-8  sild, alguses lahti
//    X  poolituslüliti   P, Q  kuhu kaks kuubikut poolitamisel lähevad
// =====================================================================

// Ruudutüübid (enum): numbrid on kiiremad ja kindlamad võrrelda kui tähed
const T = { EMPTY: 0, FLOOR: 1, ORANGE: 2, GOAL: 3, SOFT: 4, HARD: 5, BRIDGE: 6, SPLIT: 7 };
// Suund -> [rea muutus, veeru muutus]
const DIRS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };

// ---------- abifunktsioonid ----------
// kas kaks koordinaati [r,c] on samad
const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

// kanooniline kuju: väiksem koordinaat ette, et sama plokk oleks alati ühel kujul
const ordered = (a, b) =>
  (a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])) ? [a, b] : [b, a];

// ---------- tekst <-> laud ----------
// Teeb tekstikaardist laua objekti { H, W, cells, start, P, Q }.
// cells[r][c] = { t: tüüp, g: grupp (lülitid/sillad), open: silla algolek }
function parseLevel(text) {
  let rows = text.replace(/\r/g, "").split("\n");
  while (rows.length && rows[0].trim() === "") rows.shift();
  while (rows.length && rows[rows.length - 1].trim() === "") rows.pop();
  if (rows.length === 0) rows = ["..."];

  const H = rows.length;
  const W = Math.max(...rows.map(r => r.length));
  const level = { H, W, cells: [], start: null, P: null, Q: null };

  for (let r = 0; r < H; r++) {
    const row = [];
    for (let c = 0; c < W; c++) {
      const ch = rows[r][c] || ".";
      let cell = { t: T.EMPTY, g: 0 };

      if ("#SPQ".includes(ch)) cell = { t: T.FLOOR, g: 0 };
      if (ch === "o") cell = { t: T.ORANGE, g: 0 };
      if (ch === "G") cell = { t: T.GOAL, g: 0 };
      if (ch === "X") cell = { t: T.SPLIT, g: 0 };
      if ("abcd".includes(ch)) cell = { t: T.SOFT, g: "abcd".indexOf(ch) };
      if ("ABCD".includes(ch)) cell = { t: T.HARD, g: "ABCD".indexOf(ch) };
      if ("1234".includes(ch)) cell = { t: T.BRIDGE, g: "1234".indexOf(ch), open: false };
      if ("5678".includes(ch)) cell = { t: T.BRIDGE, g: "5678".indexOf(ch), open: true };

      if (ch === "S") level.start = [r, c];
      if (ch === "P") level.P = [r, c];
      if (ch === "Q") level.Q = [r, c];
      row.push(cell);
    }
    level.cells.push(row);
  }
  return level;
}

// Vastupidine teisendus: laud -> tekst (kasutab redaktor ja tekstikast)
function levelToText(L) {
  const lines = [];
  for (let r = 0; r < L.H; r++) {
    let line = "";
    for (let c = 0; c < L.W; c++) {
      const k = L.cells[r][c];
      let ch = ".";
      if (k.t === T.FLOOR) ch = "#";
      if (k.t === T.ORANGE) ch = "o";
      if (k.t === T.GOAL) ch = "G";
      if (k.t === T.SPLIT) ch = "X";
      if (k.t === T.SOFT) ch = "abcd"[k.g];
      if (k.t === T.HARD) ch = "ABCD"[k.g];
      if (k.t === T.BRIDGE) ch = (k.open ? "5678" : "1234")[k.g];
      if (same(L.start, [r, c])) ch = "S";
      if (same(L.P, [r, c])) ch = "P";
      if (same(L.Q, [r, c])) ch = "Q";
      line += ch;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

// ---------- seis ----------
// { a:[r,c], b:[r,c], split:true/false, mask:arv }
//   ühtne plokk: a == b  -> seisab püsti, muidu lamab
//   poolitatud:  a ja b on kaks eraldi kuubikut
//   mask: iga silla grupp on üks bitt (1 = lüliti on seda gruppi vahetanud)
// Algseis: plokk seisab püsti S-i peal, ükski lüliti pole vajutatud
function startState(L) {
  return { a: [...L.start], b: [...L.start], split: false, mask: 0 };
}

// püsti = ühtne plokk, mille mõlemad pooled on samas ruudus
function isUp(s) {
  return !s.split && same(s.a, s.b);
}

// Seisust tekst, et seda saaks Map-i võtmena kasutada.
// Poolitatud kuubikud sorteerime: "A siin, B seal" == "B siin, A seal".
function key(s) {
  let x = s.a.join(","), y = s.b.join(",");
  if (s.split && y < x) [x, y] = [y, x];
  return (s.split ? "S" : "") + x + "|" + y + "|" + s.mask;
}

// ---------- reeglid ----------
// ruut koordinaadil (r,c) või null, kui see on laualt väljas
function cellAt(L, r, c) {
  return (r >= 0 && r < L.H && c >= 0 && c < L.W) ? L.cells[r][c] : null;
}

// Silla praegune olek: algolek, mis on ümber pööratud, kui grupi bitt on maskis 1
function bridgeOpen(k, mask) {
  const switched = (mask >> k.g) & 1;
  return switched ? !k.open : k.open;
}

// kas ruut kannab (pole tühjus ega kinnine sild)?
function solid(L, [r, c], mask) {
  const k = cellAt(L, r, c);
  if (!k || k.t === T.EMPTY) return false;
  if (k.t === T.BRIDGE) return bridgeOpen(k, mask);
  return true;
}

// Üks käik. Tagastab:
//   { fail: "põhjus" }               – käik on keelatud
//   { state, win?, teleport?, merged? }
function step(L, s, dir, which = 0) {
  const [dr, dc] = DIRS[dir];
  let mask = s.mask;

  // --- ühtne plokk ---
  if (!s.split) {
    const [r1, c1] = s.a, [r2, c2] = s.b;
    let a, b;
    if (isUp(s)) {                                   // püsti -> pikali
      a = [r1 + dr, c1 + dc];
      b = [r1 + 2 * dr, c1 + 2 * dc];
    } else if ((r1 === r2 && dr === 0) || (c1 === c2 && dc === 0)) {
      // veereb pikkupidi -> püsti ploki otsa taha
      a = b = (dr + dc > 0) ? [r2 + dr, c2 + dc] : [r1 + dr, c1 + dc];
    } else {                                         // külgsuunas -> jääb pikali
      a = [r1 + dr, c1 + dc];
      b = [r2 + dr, c2 + dc];
    }
    [a, b] = ordered(a, b);

    // reeglite kontroll: mõlemad pooled peavad olema toetatud, püsti ei tohi olla oranžil
    if (!solid(L, a, mask) || !solid(L, b, mask)) return { fail: "Plokk kukkus servast alla" };
    const up = same(a, b);
    const under = cellAt(L, a[0], a[1]);
    if (up && under.t === T.ORANGE) return { fail: "Oranž plaat murdus" };

    // lülitid: pehme (ring) käivitub igal juhul, raske (rist) ainult püsti
    // XOR (^=) pöörab grupi biti ümber -> sild avaneb või sulgub
    for (const p of (up ? [a] : [a, b])) {
      const k = cellAt(L, p[0], p[1]);
      if (k.t === T.SOFT) mask ^= 1 << k.g;
      if (k.t === T.HARD && up) mask ^= 1 << k.g;
    }
    // poolitus: püsti X-il -> kaks kuubikut teleporditakse ruutudele P ja Q
    if (up && under.t === T.SPLIT && L.P && L.Q) {
      return { state: { a: [...L.P], b: [...L.Q], split: true, mask }, teleport: true };
    }
    const state = { a, b, split: false, mask };
    return { state, win: up && under.t === T.GOAL };   // võit: püsti augu peal
  }

  // --- poolitatud: liigub ainult üks kuubik ---
  // which = 0 -> esimene kuubik (a), which = 1 -> teine kuubik (b)
  const me = which === 0 ? s.a : s.b;
  const other = which === 0 ? s.b : s.a;
  const n = [me[0] + dr, me[1] + dc];

  if (same(n, other)) return { fail: "Kuubikud ei mahu ühele ruudule" };
  if (!solid(L, n, mask)) return { fail: "Kuubik kukkus alla" };
  const k = cellAt(L, n[0], n[1]);
  if (k.t === T.SOFT) mask ^= 1 << k.g;      // kuubik on kerge: vajutab ainult pehmet lülitit

  // kõrvuti (Manhattani kaugus 1) -> liituvad tagasi üheks lamavaks plokiks
  if (Math.abs(n[0] - other[0]) + Math.abs(n[1] - other[1]) === 1) {
    const [a, b] = ordered(n, other);
    return { state: { a, b, split: false, mask }, merged: true };
  }
  const state = which === 0
    ? { a: n, b: [...other], split: true, mask }
    : { a: [...other], b: n, split: true, mask };
  return { state };
}

// ---------- laiuti otsing (BFS) ----------
// Esimene leitud tee on alati lühim. Kui järjekord saab tühjaks -> lahendust pole.
function solve(L, limit = 300000) {
  const t0 = Date.now();
  if (!L.start) return { path: null, explored: 0, ms: 0, reason: "Laual puudub algus (S)." };

  const s0 = startState(L);
  const seen = new Map([[key(s0), null]]);   // külastatud seisud + vanemviidad: võti -> { from, move }
  const queue = [s0];                        // FIFO-järjekord
  let head = 0;                              // järjekorra algus (kiirem kui shift())

  while (head < queue.length) {
    const s = queue[head++];
    // võimalikud käigud: 4 suunda; poolitatult 4 suunda kummalegi kuubikule (kokku 8)
    const moves = [];
    for (const d of "UDLR") moves.push([d, 0]);
    if (s.split) for (const d of "UDLR") moves.push([d, 1]);   // ka teine kuubik

    for (const [d, w] of moves) {
      const res = step(L, s, d, w);
      if (res.fail) continue;                  // keelatud käik
      const k = key(res.state);
      if (seen.has(k)) continue;               // juba nähtud seis -> ei uuri uuesti
      seen.set(k, { from: key(s), move: [d, w] });

      if (res.win) {                           // tee taastamine lõpust algusesse
        const path = [];
        for (let cur = k; seen.get(cur); cur = seen.get(cur).from) path.push(seen.get(cur).move);
        return { path: path.reverse(), explored: seen.size, ms: Date.now() - t0 };
      }
      // kaitse liiga suurte laudade vastu, et brauser kinni ei jookseks
      if (seen.size > limit) {
        return { path: null, explored: seen.size, ms: Date.now() - t0, reason: "Otsingu piir ületati." };
      }
      queue.push(res.state);
    }
  }
  return { path: null, explored: seen.size, ms: Date.now() - t0,
           reason: "Lahendust pole – kõik kättesaadavad seisud on läbi vaadatud." };
}

// ---------- näidistasemed ----------
const PRESETS = {
  "Tase 1 (originaal)": `
###.......
#S####....
#########.
.#########
.....##G##
......###.`,
  "Habras koridor": `
####..........
#Soo#oo#oo###G
####..........`,
  "Pehme lüliti": `
###....####
#S#a111##G#
###....####`,
  "Raske lüliti": `
####...####
#S#A111##G#
####...####`,
  "Poolitus": `
#####.....
#S##X.....
#####.....
..........
P#a1111##.
.......###
Q#b2222##G
.......###`,
  "Lukus tee": `
####......
#S##oooG..
####......`,
};

// Node.js jaoks (brauseris seda rida ei kasutata)
if (typeof module !== "undefined") {
  module.exports = { T, parseLevel, levelToText, startState, isUp, step, solve, PRESETS, same, bridgeOpen };
}