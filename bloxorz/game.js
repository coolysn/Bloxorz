//  Bloxorzi MÄNG – joonistamine, animatsioon, nupud ja redaktor.
//  Reeglid ja otsing tulevad failist engine.js (step, solve, parseLevel ...).

const $ = id => document.getElementById(id);
const cv = $("cv");
const ctx = cv.getContext("2d");

const GROUP_COLORS = ["#6ec6ff", "#f2c94c", "#b78cff", "#6fdc8c"];
const SPEED = 250;          // ühe käigu animatsiooni kestus (ms)

// mängu olek
let level;                  // praegune laud
let state;                  // ploki seis (vt engine.js)
let active = 0;             // millist kuubikut juhitakse (poolitatult)
let solution = null;        // solve() tulemus
let playIndex = 0;          // mitmes lahenduse käik
let playing = false;
let anim = null;            // { from, to, start, win }
let sinkStart = null;       // millal plokk auku vajuma hakkas
let trail = [];             // lahenduse jälg laual
let busy = false;           // animatsioon käib -> uusi käike ei võta

//  1. JOONISTAMINE (isomeetriline vaade)
const view = { size: 40, ox: 0, oy: 0 };
const HEIGHT = 0.62;        // kui kõrge on üks kuubik ekraanil
const THICK = 0.28;         // plaadi paksus

// ruudustiku punkt (rida, veerg, kõrgus) -> ekraani punkt [x, y]
function toScreen(r, c, z) {
  return [
    view.ox + (c - r) * view.size / 2,
    view.oy + (c + r) * view.size / 4 - z * HEIGHT * view.size,
  ];
}

function polygon(points, fill, stroke) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

// värvi heledamaks (>1) või tumedamaks (<1)
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = v => Math.round(Math.min(255, f > 1 ? v + (255 - v) * (f - 1) : v * f));
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

// skaleeri vaade nii, et kogu laud mahub lõuendile
function fitView() {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  cv.width = w * dpr;
  cv.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const span = (level.W + level.H) / 2;
  view.size = Math.min((w - 40) / span, (h - 90) / (span / 2 + 1.5), 70);
  view.ox = w / 2 - (level.W - level.H) / 4 * view.size;
  view.oy = h / 2 - (level.W + level.H) / 8 * view.size + 0.4 * view.size;
}

function tileColor(k) {
  if (k.t === T.ORANGE) return "#ec8b3c";
  if (k.t === T.BRIDGE) return shade(GROUP_COLORS[k.g], 0.75);
  if (k.t === T.GOAL) return "#0b0d18";
  return "#8d97b5";                       // tavaline plaat, lülitid, poolitus
}

function drawTile(r, c, k) {
  if (k.t === T.EMPTY) return;
  const top = [toScreen(r, c, 0), toScreen(r, c + 1, 0), toScreen(r + 1, c + 1, 0), toScreen(r + 1, c, 0)];

  // kinnine sild = ainult punktiirjoon
  if (k.t === T.BRIDGE && !bridgeOpen(k, state.mask)) {
    ctx.setLineDash([3, 3]);
    polygon(top, null, GROUP_COLORS[k.g]);
    ctx.setLineDash([]);
    return;
  }

  const color = tileColor(k);
  // kaks nähtavat külge + pealmine pind
  polygon([toScreen(r + 1, c, 0), toScreen(r + 1, c + 1, 0), toScreen(r + 1, c + 1, -THICK), toScreen(r + 1, c, -THICK)], shade(color, 0.6));
  polygon([toScreen(r, c + 1, 0), toScreen(r + 1, c + 1, 0), toScreen(r + 1, c + 1, -THICK), toScreen(r, c + 1, -THICK)], shade(color, 0.45));
  polygon(top, color, shade(color, 0.8));

  // märgid plaadi peal
  const [x, y] = toScreen(r + 0.5, c + 0.5, 0);
  const s = view.size;
  ctx.lineWidth = Math.max(1.5, s * 0.06);
  if (k.t === T.GOAL) {
    polygon([toScreen(r + .2, c + .2, 0), toScreen(r + .2, c + .8, 0), toScreen(r + .8, c + .8, 0), toScreen(r + .8, c + .2, 0)], "#000");
  }
  if (k.t === T.SOFT) {                    // ring
    ctx.beginPath();
    ctx.ellipse(x, y, s * .2, s * .1, 0, 0, Math.PI * 2);
    ctx.fillStyle = GROUP_COLORS[k.g];
    ctx.fill();
  }
  if (k.t === T.HARD) {                    // rist
    ctx.strokeStyle = GROUP_COLORS[k.g];
    ctx.beginPath();
    ctx.moveTo(x - s * .2, y - s * .1); ctx.lineTo(x + s * .2, y + s * .1);
    ctx.moveTo(x + s * .2, y - s * .1); ctx.lineTo(x - s * .2, y + s * .1);
    ctx.stroke();
  }
  if (k.t === T.SPLIT) {                   // ( )
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${s * .35}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("()", x, y);
  }
  ctx.lineWidth = 1;
}

// plokk kui kast: read r0..r1, veerud c0..c1, kõrgus z0..z1
function drawBox(b, alpha = 1) {
  const base = "#c06a3e";
  ctx.globalAlpha = alpha;
  polygon([toScreen(b.r1, b.c0, b.z1), toScreen(b.r1, b.c1, b.z1), toScreen(b.r1, b.c1, b.z0), toScreen(b.r1, b.c0, b.z0)], shade(base, 0.8));
  polygon([toScreen(b.r0, b.c1, b.z1), toScreen(b.r1, b.c1, b.z1), toScreen(b.r1, b.c1, b.z0), toScreen(b.r0, b.c1, b.z0)], shade(base, 0.55));
  polygon([toScreen(b.r0, b.c0, b.z1), toScreen(b.r0, b.c1, b.z1), toScreen(b.r1, b.c1, b.z1), toScreen(b.r1, b.c0, b.z1)], shade(base, 1.25));
  ctx.globalAlpha = 1;
}

// seis -> üks või kaks kasti
function boxesOf(s) {
  if (s.split) {
    return [s.a, s.b].map(([r, c]) => ({ r0: r, c0: c, r1: r + 1, c1: c + 1, z0: 0, z1: 1 }));
  }
  return [{
    r0: Math.min(s.a[0], s.b[0]), c0: Math.min(s.a[1], s.b[1]),
    r1: Math.max(s.a[0], s.b[0]) + 1, c1: Math.max(s.a[1], s.b[1]) + 1,
    z0: 0, z1: isUp(s) ? 2 : 1,
  }];
}

const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// joonistatakse iga ekraanikaadri ajal (~60 korda sekundis)
function frame(now) {
  ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight);

  // plaadid tagant ettepoole, et eesmised kataksid tagumisi
  for (let sum = 0; sum < level.H + level.W; sum++) {
    for (let r = 0; r < level.H; r++) {
      const c = sum - r;
      if (c >= 0 && c < level.W) drawTile(r, c, level.cells[r][c]);
    }
  }

  // lahenduse vikerkaarejälg
  trail.forEach((boxes, i) => {
    const hue = 170 - (i / solution.path.length) * 150;
    boxes.forEach(b => polygon(
      [toScreen(b.r0 + .1, b.c0 + .1, 0), toScreen(b.r0 + .1, b.c1 - .1, 0), toScreen(b.r1 - .1, b.c1 - .1, 0), toScreen(b.r1 - .1, b.c0 + .1, 0)],
      `hsla(${hue}, 75%, 60%, .35)`));
  });

  if (level.start) {
    let boxes = boxesOf(state);
    let alpha = 1;

    // veeremise animatsioon
    if (anim) {
      const t = Math.min(1, (now - anim.start) / SPEED);
      if (anim.from.length === anim.to.length) {
        const e = ease(t), lift = Math.sin(Math.PI * t) * .25;
        boxes = anim.to.map((b, i) => {
          const a = anim.from[i];
          return {
            r0: lerp(a.r0, b.r0, e), c0: lerp(a.c0, b.c0, e),
            r1: lerp(a.r1, b.r1, e), c1: lerp(a.c1, b.c1, e),
            z0: lift, z1: lerp(a.z1, b.z1, e) + lift,
          };
        });
      }
      if (t >= 1) animationDone();
    }

    // auku vajumine
    if (sinkStart) {
      const t = Math.min(1, (now - sinkStart) / 700);
      boxes = boxes.map(b => ({ ...b, z0: b.z0 - 2 * t, z1: b.z1 - 2 * t }));
      alpha = 1 - t;
    }

    boxes.sort((x, y) => (x.r0 + x.c0) - (y.r0 + y.c0)).forEach(b => drawBox(b, alpha));
  }
  requestAnimationFrame(frame);
}

//  2. MÄNGULOOGIKA
function setMsg(text, cls = "") {
  $("msg").textContent = text;
  $("msg").className = cls;
}

function restart() {
  state = startState(level);
  active = 0;
  playIndex = 0;
  playing = false;
  anim = null;
  sinkStart = null;
  trail = [];
  busy = false;
  $("btnPlay").textContent = "▶ Näita teed";
  renderMoves();
  setMsg(level.start ? "Vajuta „Lahenda“ või mängi nooltega" : "Lisa lauale algus (S)");
}

function move(dir, which, fromSolution = false) {
  if (busy || !level.start) return;
  const res = step(level, state, dir, which);

  if (res.fail) {
    busy = true;
    setMsg(res.fail, "bad");
    setTimeout(restart, 900);
    return;
  }

  anim = { from: boxesOf(state), to: boxesOf(res.state), start: performance.now(), win: res.win };
  if (res.teleport) setMsg("Plokk poolitus kaheks kuubikuks");
  else if (res.merged) setMsg("Kuubikud liitusid uuesti");
  else setMsg("…");

  state = res.state;
  if (!state.split) active = 0;
  if (fromSolution) trail.push(boxesOf(state));
  busy = true;
}

function animationDone() {
  busy = false;
  const won = anim.win;
  anim = null;
  if (won) {
    sinkStart = performance.now();
    busy = true;
    playing = false;
    $("btnPlay").textContent = "▶ Näita teed";
    setMsg("Auku! Tase läbitud", "win");
    return;
  }
  if (playing && playIndex < solution.path.length) playNextMove();
}

function playNextMove() {
  const [dir, which] = solution.path[playIndex++];
  renderMoves();
  move(dir, which, true);
}

//  3. LAHENDUSE NUPUD JA KÄIKUDE NIMEKIRI
const ARROWS = { U: "↑", D: "↓", L: "←", R: "→" };

function runSolver() {
  solution = solve(level);
  const v = $("verdict");
  if (solution.path) {
    v.textContent = `Lühim tee: ${solution.path.length} käiku (${solution.explored} seisu, ${solution.ms} ms)`;
    v.style.color = "var(--good)";
  } else {
    v.textContent = `${solution.reason} (${solution.explored} seisu)`;
    v.style.color = "var(--bad)";
  }
  restart();
}

function renderMoves() {
  if (!solution || !solution.path) { $("moves").innerHTML = ""; return; }
  $("moves").innerHTML = solution.path.map(([d, w], i) =>
    `<span class="mv ${w ? "second" : ""} ${i === playIndex - 1 ? "now" : ""}">${ARROWS[d]}</span>`
  ).join("");
}

$("btnSolve").onclick = runSolver;
$("btnReset").onclick = restart;
$("btnPlay").onclick = () => {
  if (!solution) runSolver();
  if (!solution.path) return;
  if (playing) {                         // paus
    playing = false;
    $("btnPlay").textContent = "▶ Näita teed";
    return;
  }
  restart();
  playing = true;
  $("btnPlay").textContent = "❚❚ Paus";
  playNextMove();
};

document.addEventListener("keydown", e => {
  if (e.target.matches("textarea, select")) return;
  const dir = { ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R" }[e.key];
  if (dir) {
    e.preventDefault();
    if (!playing) move(dir, state.split ? active : 0);
  }
  if (e.key === " " && state.split) {
    e.preventDefault();
    active = 1 - active;
    setMsg(`Juhid kuubikut ${active + 1}`);
  }
  if (e.key === "r" || e.key === "R") restart();
});

//  4. REDAKTOR – iga tööriist on lihtsalt üks kaarditähis
const TOOLS = [
  { ch: ".", name: "Tühi" },        { ch: "#", name: "Plaat" },
  { ch: "o", name: "Oranž" },       { ch: "S", name: "Algus" },
  { ch: "G", name: "Auk" },         { ch: "a", name: "Pehme lüliti", group: true },
  { ch: "A", name: "Raske lüliti", group: true },
  { ch: "1", name: "Sild kinni", group: true },
  { ch: "5", name: "Sild lahti", group: true },
  { ch: "X", name: "Poolitus" },    { ch: "P", name: "Siht P" }, { ch: "Q", name: "Siht Q" },
];
let tool = TOOLS[1];
let group = 0;
let painting = false;

function renderTools() {
  $("tools").innerHTML = TOOLS.map((t, i) =>
    `<button data-i="${i}" class="${t === tool ? "on" : ""}">${t.name}</button>`).join("");
  $("groups").innerHTML = "Grupp: " + GROUP_COLORS.map((c, i) =>
    `<button data-g="${i}" class="${i === group ? "on" : ""}" style="color:${c}">${i + 1}</button>`).join("");
}
$("tools").onclick = e => { const b = e.target.closest("[data-i]"); if (b) { tool = TOOLS[b.dataset.i]; renderTools(); } };
$("groups").onclick = e => { const b = e.target.closest("[data-g]"); if (b) { group = +b.dataset.g; renderTools(); } };

// märgi kaarditähis antud ruudule -> muuda teksti -> loe laud uuesti
// (nii ei pea redaktor teadma ühtegi reeglit, kõik käib engine.js kaudu)
function paint(r, c) {
  let ch = tool.ch;
  if (tool.group) ch = String.fromCharCode(ch.charCodeAt(0) + group);   // a->b->c->d, 1->2->3->4
  let lines = levelToText(level).split("\n");
  // S, P ja Q saavad olla ainult ühes kohas
  if ("SPQ".includes(ch)) lines = lines.map(l => l.replaceAll(ch, "#"));
  lines[r] = lines[r].slice(0, c) + ch + lines[r].slice(c + 1);
  loadLevel(lines.join("\n"));
}

function renderGrid() {
  const g = $("grid");
  g.style.gridTemplateColumns = `repeat(${level.W}, 28px)`;
  const text = levelToText(level).split("\n");
  let html = "";
  for (let r = 0; r < level.H; r++) {
    for (let c = 0; c < level.W; c++) {
      const k = level.cells[r][c];
      const ch = text[r][c];
      let bg = k.t === T.EMPTY ? "#1a1e33" : tileColor(k);
      if (k.t === T.SOFT || k.t === T.HARD) bg = GROUP_COLORS[k.g];
      if (k.t === T.BRIDGE && !k.open) bg = "#1a1e33";
      const border = k.t === T.BRIDGE ? `1px dashed ${GROUP_COLORS[k.g]}` : "1px solid #262b48";
      html += `<div class="cell" data-r="${r}" data-c="${c}" style="background:${bg};border:${border}">${ch === "." || ch === "#" ? "" : ch}</div>`;
    }
  }
  g.innerHTML = html;
}

$("grid").addEventListener("pointerdown", e => {
  const d = e.target.closest(".cell");
  if (d) { painting = true; paint(+d.dataset.r, +d.dataset.c); }
});
$("grid").addEventListener("pointerover", e => {
  const d = e.target.closest(".cell");
  if (painting && d) paint(+d.dataset.r, +d.dataset.c);
});
window.addEventListener("pointerup", () => (painting = false));

$("btnLoad").onclick = () => { $("preset").value = ""; loadLevel($("txt").value); };


//  5. KÄIVITAMINE
function loadLevel(text) {
  level = parseLevel(text);
  solution = null;
  $("verdict").textContent = "Lahendust pole veel otsitud.";
  $("verdict").style.color = "";
  $("txt").value = levelToText(level);
  renderGrid();
  fitView();
  restart();
}

$("preset").innerHTML =
  Object.keys(PRESETS).map(n => `<option>${n}</option>`).join("") +
  `<option value="">— oma laud —</option>`;
$("preset").onchange = () => { if (PRESETS[$("preset").value]) loadLevel(PRESETS[$("preset").value]); };
window.addEventListener("resize", fitView);

renderTools();
loadLevel(PRESETS["Tase 1 (originaal)"]);
runSolver();
requestAnimationFrame(frame);