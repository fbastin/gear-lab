
/* ==========================================================
   Shared helpers: page UI, sound, particles, drawing, gears
   ========================================================== */
const VW = 960, VH = 600;                       // virtual world size
const $ = s => document.querySelector(s);
const canvas = $('#stage');
const ctx = canvas.getContext('2d');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const TAU = Math.PI * 2;
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));   // angle in (-π, π]
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const FONT = '"Baloo 2","Trebuchet MS","Segoe UI",system-ui,sans-serif';
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
const COL = {
  ink: '#17233d', red: '#e23b2e', blue: '#2464d6', sun: '#ffd23f', leaf: '#23996b', orange: '#ff8a1f',
  purple: '#7a62c9', steel: '#a8b2c3', paper: '#fbfcfe',
  cw: '#2464d6', ccw: '#e8590c',                // arrow colours: clockwise, counterclockwise
};

/* ---------------- Page UI helpers ---------------- */
const UI = {
  how(title, html) { $('#howTitle').textContent = title; $('#howText').innerHTML = html; },
  fact(html, title) { $('#factTitle').textContent = title || T('fact'); $('#factText').innerHTML = html; },
  hud(chips) {
    const h = $('#hud'); h.innerHTML = '';
    for (const c of chips || []) { const s = document.createElement('span'); s.className = 'chip'; s.textContent = c; h.appendChild(s); }
  },
  toast(text, ms = 2600) {
    const t = $('#toast'); t.textContent = text; t.classList.add('show');
    clearTimeout(UI._tt); UI._tt = setTimeout(() => t.classList.remove('show'), ms);
  },
  overlay(html) {
    const o = $('#overlay');
    if (!html) { o.hidden = true; o.innerHTML = ''; return null; }
    o.innerHTML = `<div class="panel">${html}</div>`; o.hidden = false;
    const b = o.querySelector('button.go') || o.querySelector('button'); if (b) b.focus({ preventScroll: true });
    return o;
  },
  // items: '|' (separator), '/' (new line), { text, cls } (a line of text), or a button:
  // { icon, label, click, toggle, pressed, disabled, cls, aria, id }
  toolbar(items) {
    const tb = $('#toolbar'); tb.innerHTML = '';
    for (const it of items) {
      if (it === '|') { const s = document.createElement('span'); s.className = 'sep'; tb.appendChild(s); continue; }
      if (it === '/') { const s = document.createElement('span'); s.className = 'break'; tb.appendChild(s); continue; }
      if (it.text !== undefined) { const p = document.createElement('p'); p.className = 'qtext' + (it.cls ? ' ' + it.cls : ''); p.innerHTML = it.text; tb.appendChild(p); continue; }
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chunky tool' + (it.cls ? ' ' + it.cls : '');
      b.innerHTML = (it.icon ? `<span aria-hidden="true">${it.icon}</span> ` : '') + it.label;
      if ('pressed' in it) b.setAttribute('aria-pressed', String(!!it.pressed));
      if (it.aria) b.setAttribute('aria-label', it.aria);
      if (it.id) b.dataset.id = it.id;
      if (it.disabled) b.disabled = true;
      b.addEventListener('click', () => {
        Sound.ensure();
        const r = it.click(b);
        if (it.toggle) b.setAttribute('aria-pressed', String(!!r));
      });
      tb.appendChild(b);
    }
  },
};

let factIdx = Math.floor(Math.random() * FACTS.length);
function showFact(step = 0) { factIdx = (factIdx + step + FACTS.length) % FACTS.length; UI.fact(tr(FACTS[factIdx])); }

/* ---------------- Sound (tiny synth, no files) ---------------- */
const Sound = (() => {
  let ac = null, on = true, lastTick = 0;
  function ensure() {
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) { try { ac = new A(); } catch (e) { ac = null; } } }
    if (ac && ac.state === 'suspended') ac.resume();
  }
  function tone(f, d, type = 'sine', v = 0.12, slide = 1, delay = 0) {
    if (!on || !ac) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.05);
  }
  return {
    ensure,
    toggle() { on = !on; return on; },
    tick() { const n = performance.now(); if (n - lastTick < 90) return; lastTick = n; tone(1800, 0.03, 'square', 0.025, 0.5); },
    clunk() { tone(180, 0.09, 'square', 0.05, 0.6); tone(420, 0.06, 'triangle', 0.08, 0.7); },
    pick() { tone(660, 0.07, 'triangle', 0.08, 1.3); },
    drop() { tone(330, 0.12, 'triangle', 0.1, 0.6); },
    ding() { tone(1046, 0.16, 'triangle', 0.1); tone(1568, 0.22, 'triangle', 0.08, 1, 0.08); },
    jam() { tone(110, 0.25, 'sawtooth', 0.06, 0.8); tone(140, 0.2, 'square', 0.03, 0.9, 0.05); },
    shift() { tone(1200, 0.03, 'square', 0.04, 0.7); tone(700, 0.05, 'triangle', 0.06, 1, 0.04); },
    click() { tone(900, 0.03, 'square', 0.05, 0.6); },
    whoosh() { tone(300, 0.3, 'sine', 0.06, 2.5); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, 1, i * 0.11)); },
    nope() { tone(200, 0.18, 'sawtooth', 0.04, 0.8); },
  };
})();

/* ---------------- Particles ---------------- */
const FX = {
  parts: [],
  burst(x, y, n = 14, cols = [COL.sun, '#fff']) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(80, 260);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 300, life: rand(0.5, 0.9), t: 0, c: cols[i % cols.length], sz: rand(4, 7), r: 0, vr: 0 });
    }
  },
  confetti(n = 130) {
    if (REDUCED) return;
    const cols = [COL.red, COL.blue, COL.sun, COL.leaf, '#ff8fb1'];
    for (let i = 0; i < n; i++) this.parts.push({ x: rand(0, VW), y: rand(-220, -10), vx: rand(-60, 60), vy: rand(80, 240), g: 110, life: rand(2.6, 4), t: 0, c: cols[i % cols.length], sz: rand(6, 10), r: rand(0, 6), vr: rand(-6, 6), rect: true });
  },
  update(dt) {
    for (const p of this.parts) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; }
    this.parts = this.parts.filter(p => p.t < p.life && p.y < VH + 40);
  },
  draw(c) {
    for (const p of this.parts) {
      c.globalAlpha = clamp((p.life - p.t) * 2.5, 0, 1);
      c.fillStyle = p.c; c.save(); c.translate(p.x, p.y); c.rotate(p.r);
      if (p.rect) c.fillRect(-p.sz / 2, -p.sz / 4, p.sz, p.sz / 2);
      else { c.beginPath(); c.arc(0, 0, p.sz / 2, 0, TAU); c.fill(); }
      c.restore();
    }
    c.globalAlpha = 1;
  },
  clear() { this.parts = []; },
};

/* ---------------- Drawing helpers ---------------- */
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function paper(c) {           // graph paper, like a lab notebook
  c.fillStyle = COL.paper; c.fillRect(0, 0, VW, VH);
  c.lineWidth = 1;
  c.strokeStyle = 'rgba(36,100,214,.07)'; c.beginPath();
  for (let x = 24; x < VW; x += 24) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, VH); }
  for (let y = 24; y < VH; y += 24) { c.moveTo(0, y + 0.5); c.lineTo(VW, y + 0.5); }
  c.stroke();
  c.strokeStyle = 'rgba(36,100,214,.14)'; c.beginPath();
  for (let x = 120; x < VW; x += 120) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, VH); }
  for (let y = 120; y < VH; y += 120) { c.moveTo(0, y + 0.5); c.lineTo(VW, y + 0.5); }
  c.stroke();
}

function wrapText(c, text, maxW) {
  const lines = []; let line = '';
  for (const w of String(text).split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (line && c.measureText(t).width > maxW) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

// Sets a font that makes `text` fit in maxW (shrinking from `size`).
function fitFont(c, text, weight, size, maxW, min = 10) {
  c.font = `${weight} ${size}px ${FONT}`;
  const w = c.measureText(text).width;
  if (w > maxW) c.font = `${weight} ${Math.max(min, Math.floor(size * maxW / w))}px ${FONT}`;
}

// A label on a white rounded tag, centred at (x, y).
function tag(c, text, x, y, o = {}) {
  const size = o.size || 15;
  c.save(); c.font = `${o.weight || 700} ${size}px ${FONT}`;
  const w = c.measureText(text).width + 14, h = size + 9;
  c.fillStyle = o.bg || 'rgba(255,255,255,.95)'; rr(c, x - w / 2, y - h / 2, w, h, h / 2); c.fill();
  c.lineWidth = 1.5; c.strokeStyle = o.border || 'rgba(23,35,61,.35)'; c.stroke();
  c.fillStyle = o.col || COL.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 1);
  c.restore();
}

function starPath(c, x, y, r, rot = 0) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.46 : r, a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  c.closePath();
}

function arrow(c, x1, y1, x2, y2, col, w = 6) {
  const a = Math.atan2(y2 - y1, x2 - x1), hl = w * 2.4;
  c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - Math.cos(a) * hl * 0.8, y2 - Math.sin(a) * hl * 0.8); c.stroke();
  c.beginPath(); c.moveTo(x2, y2);
  c.lineTo(x2 - Math.cos(a - 0.5) * hl, y2 - Math.sin(a - 0.5) * hl);
  c.lineTo(x2 - Math.cos(a + 0.5) * hl, y2 - Math.sin(a + 0.5) * hl);
  c.closePath(); c.fill(); c.restore();
}

// Curved arrow around (x, y) at radius R showing the way something turns.
// dir > 0: clockwise (on screen), dir < 0: counterclockwise. a0: where the arc is centred.
function turnArrow(c, x, y, R, dir, o = {}) {
  if (!dir) return;
  const span = o.span || 1.5, a0 = o.at ?? -Math.PI / 2, w = o.w || 5;
  const col = o.col || (dir > 0 ? COL.cw : COL.ccw);
  const s = a0 - span / 2 * dir, e = a0 + span / 2 * dir;
  c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, R, s, e - 0.16 * dir, dir < 0); c.stroke();
  const hx = x + Math.cos(e) * R, hy = y + Math.sin(e) * R, ta = e + Math.PI / 2 * dir, hl = w * 2.6;
  c.beginPath(); c.moveTo(hx + Math.cos(ta) * hl * 0.55, hy + Math.sin(ta) * hl * 0.55);
  c.lineTo(hx - Math.cos(ta) * hl * 0.5 + Math.cos(ta + Math.PI / 2) * hl * 0.62, hy - Math.sin(ta) * hl * 0.5 + Math.sin(ta + Math.PI / 2) * hl * 0.62);
  c.lineTo(hx - Math.cos(ta) * hl * 0.5 - Math.cos(ta + Math.PI / 2) * hl * 0.62, hy - Math.sin(ta) * hl * 0.5 - Math.sin(ta + Math.PI / 2) * hl * 0.62);
  c.closePath(); c.fill(); c.restore();
}

/* ---------------- Gears ----------------
   A gear with z teeth and module m has a pitch radius of m·z/2: two gears mesh
   when their centres are exactly (pitch radius 1 + pitch radius 2) apart, and only
   if their teeth are the same size (same m). */
const MOD = 5;                                  // tooth size in the game, px
const SIZES = [8, 12, 16, 24, 36, 48];          // gears in the tray
const GEAR_COL = { 8: '#ff8fb1', 12: '#ff8a1f', 16: '#23996b', 24: '#7a62c9', 36: '#4fb3d9', 48: '#c98a4b' };
const gearCol = z => GEAR_COL[z] || '#a8b2c3';
const pitchR = (z, m = MOD) => m * z / 2;
const outerR = (z, m = MOD) => m * z / 2 + m;
const MESH_TOL = 3;

const _paths = {};
function toothHalf(z, m) {
  const r = m * z / 2, p = TAU / z, t20 = Math.tan(20 * Math.PI / 180), wp = Math.PI * m / 4;
  return rho => Math.min((wp - (rho - r) * t20) / rho, p * 0.42);
}
// Outline of a gear centred at 0,0 with tooth 0 pointing along +x.
function gearPath(z, m = MOD) {
  const key = z + ':' + m; if (_paths[key]) return _paths[key];
  const r = m * z / 2, ro = r + m, rr0 = r - 1.25 * m, p = TAU / z, hw = toothHalf(z, m);
  const ar = hw(rr0), at = hw(ro), P = new Path2D();
  for (let k = 0; k < z; k++) {
    const c0 = k * p;
    if (k === 0) P.moveTo(Math.cos(c0 - ar) * rr0, Math.sin(c0 - ar) * rr0);
    P.lineTo(Math.cos(c0 - at) * ro, Math.sin(c0 - at) * ro);
    P.arc(0, 0, ro, c0 - at, c0 + at);
    P.lineTo(Math.cos(c0 + ar) * rr0, Math.sin(c0 + ar) * rr0);
    P.arc(0, 0, rr0, c0 + ar, c0 + p - ar);
  }
  P.closePath();
  return (_paths[key] = P);
}
function toothPath(z, m = MOD) {
  const key = 't' + z + ':' + m; if (_paths[key]) return _paths[key];
  const r = m * z / 2, ro = r + m, rr0 = r - 1.25 * m, hw = toothHalf(z, m), ar = hw(rr0), at = hw(ro), P = new Path2D();
  P.moveTo(Math.cos(-ar) * rr0, Math.sin(-ar) * rr0); P.lineTo(Math.cos(-at) * ro, Math.sin(-at) * ro);
  P.arc(0, 0, ro, -at, at); P.lineTo(Math.cos(ar) * rr0, Math.sin(ar) * rr0); P.arc(0, 0, rr0, ar, -ar, true); P.closePath();
  return (_paths[key] = P);
}

// g = { x, y, z, a, col?, m? }. o: ghost, bad, sel, jam, marker (default true), crank, hub
function drawGear(c, g, o = {}) {
  const m = g.m || MOD, z = g.z, r = m * z / 2, rr0 = r - 1.25 * m, path = gearPath(z, m);
  const hub = o.hub || Math.max(6, Math.min(16, r * 0.2));
  c.save(); c.translate(g.x, g.y);
  if (o.ghost) c.globalAlpha = 0.6;
  if (!o.flat) { c.save(); c.translate(3, 5); c.rotate(g.a); c.fillStyle = 'rgba(23,35,61,.18)'; c.fill(path); c.restore(); }
  c.rotate(g.a);
  c.fillStyle = o.bad ? '#ffb3a8' : (g.col || gearCol(z)); c.fill(path);
  // a lighter ring and holes, like a real gear
  c.lineWidth = 2;
  if (rr0 > 30) { c.beginPath(); c.arc(0, 0, rr0 - 6, 0, TAU); c.strokeStyle = 'rgba(23,35,61,.22)'; c.stroke(); }
  if (rr0 > 44) {
    const n = rr0 > 90 ? 6 : 5, hr = Math.min(18, (rr0 - 6 - hub) * 0.3), hd = (rr0 - 6 + hub) / 2;
    for (let k = 0; k < n; k++) {
      const a = (k + 0.5) * TAU / n;
      c.beginPath(); c.arc(Math.cos(a) * hd, Math.sin(a) * hd, hr, 0, TAU);
      c.fillStyle = 'rgba(255,255,255,.5)'; c.fill(); c.strokeStyle = 'rgba(23,35,61,.45)'; c.stroke();
    }
  }
  // marker: one white tooth and a stripe, so the turns can be counted
  if (o.marker !== false) {
    c.fillStyle = '#fff'; c.fill(toothPath(z, m));
    if (rr0 - hub > 8) {
      c.lineCap = 'round'; c.strokeStyle = COL.ink; c.lineWidth = 7;
      c.beginPath(); c.moveTo(hub + 3, 0); c.lineTo(rr0 - 1, 0); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 3.6; c.stroke();
    }
  }
  c.lineJoin = 'round'; c.lineWidth = 2.5; c.strokeStyle = o.jam ? COL.red : COL.ink; c.stroke(path);
  // hub and axle
  c.beginPath(); c.arc(0, 0, hub, 0, TAU); c.fillStyle = '#e8ecf2'; c.fill();
  c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
  c.beginPath(); c.arc(0, 0, hub * 0.38, 0, TAU); c.fillStyle = COL.ink; c.fill();
  if (o.crank) {                                      // a crank arm with a handle
    const L = r * 0.72;
    c.lineCap = 'round'; c.strokeStyle = COL.ink; c.lineWidth = 12; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -L); c.stroke();
    c.strokeStyle = '#d3d8e1'; c.lineWidth = 7; c.stroke();
    c.beginPath(); c.arc(0, -L, 13, 0, TAU); c.fillStyle = COL.red; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
    c.beginPath(); c.arc(-4, -L - 4, 4, 0, TAU); c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
    c.beginPath(); c.arc(0, 0, hub * 0.6, 0, TAU); c.fillStyle = COL.ink; c.fill();
  }
  c.restore();
  if (o.sel || o.jam) {
    c.save(); c.setLineDash([7, 5]); c.lineWidth = 3.5; c.strokeStyle = o.jam ? COL.red : COL.sun;
    c.beginPath(); c.arc(g.x, g.y, r + m + 7, 0, TAU); c.stroke(); c.restore();
  }
}
// Where the crank handle of a gear is (see drawGear o.crank).
function crankPos(g) { const L = pitchR(g.z, g.m) * 0.72; return { x: g.x + Math.sin(g.a) * L, y: g.y - Math.cos(g.a) * L }; }

// Distance-based meshing between two gears on a flat board.
function meshState(g1, g2) {
  const d = Math.hypot(g1.x - g2.x, g1.y - g2.y), s = pitchR(g1.z, g1.m) + pitchR(g2.z, g2.m), m = g1.m || MOD;
  if (Math.abs(d - s) <= MESH_TOL) return 'mesh';
  if (d < s - MESH_TOL || d < s + 2 * m - 1) return 'clash';   // overlapping, or teeth bumping without fitting
  return 'free';
}

// Turns gear g so its teeth fit between the teeth of gear h (which it meshes with).
function alignTo(g, h) {
  const phi = Math.atan2(g.y - h.y, g.x - h.x);
  const ph = (((phi - h.a) * h.z / TAU) % 1 + 1) % 1;
  g.a = phi + Math.PI - (TAU / g.z) * (0.5 - ph);
}

// Speeds through a set of meshing gears. Returns, for every gear, how many turns it
// makes per turn of the driver (signed: the same sign turns the same way), or null if
// it isn't connected. A loop that asks a gear to turn two ways at once jams the lot.
function solveGears(gears, driver) {
  const n = gears.length, ratio = new Array(n).fill(null), adj = gears.map(() => []);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
    if (meshState(gears[i], gears[j]) === 'mesh') { adj[i].push(j); adj[j].push(i); }
  const d = gears.indexOf(driver);
  if (d < 0) return { ratio, jam: false, adj, comp: [] };
  ratio[d] = 1; const q = [d], comp = [d]; let jam = false;
  while (q.length) {
    const i = q.shift();
    for (const j of adj[i]) {
      const w = -ratio[i] * gears[i].z / gears[j].z;
      if (ratio[j] === null) { ratio[j] = w; q.push(j); comp.push(j); }
      else if (Math.abs(ratio[j] - w) > 1e-9) jam = true;
    }
  }
  return { ratio, jam, adj, comp };
}

// "×2", "½", "⅔"… for a ratio.
function ratioText(r) {
  r = Math.abs(r);
  const fr = { '0.5': '½', '0.333': '⅓', '0.667': '⅔', '0.25': '¼', '0.75': '¾', '1.5': '1½', '2.5': '2½', '0.2': '⅕' };
  const k = String(Math.round(r * 1000) / 1000);
  if (fr[k]) return fr[k];
  return Math.abs(r - Math.round(r)) < 1e-6 ? String(Math.round(r)) : num(r, 2);
}
