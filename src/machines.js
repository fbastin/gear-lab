
/* ==========================================================
   Mode 3: Machines
   Five ways to pass on a turning motion, each with a crank to
   turn: chain and sprockets, belt and pulleys, the bevel gears
   of an egg beater, a worm gear, and a cog railway (rack and
   pinion). The crank angle `th` drives everything in a scene.
   ========================================================== */
const Machines = (() => {
  const OMEGA = TAU / 3;                                      // motor speed, one turn every 3 s
  const SCENES = ['chain', 'belt', 'beater', 'worm', 'rack'];
  const ICON = { chain: '⛓️', belt: '➰', beater: '🥚', worm: '🔩', rack: '🚂' };
  let scene = 'chain', th = 0, inTurns = 0, crank = null, motor = false, said = {};
  const st = { dir: 1, rear: 16, cross: false, load: false, slip: 0, lift: 0, rack: true, s: 0, vs: 0, out: 0, belt: 0, wheel: 0 };

  function crankOf() {      // the input crank: centre, length of the arm
    switch (scene) {
      case 'chain': return { x: 250, y: 290, L: 58 };
      case 'belt': return { x: 250, y: 290, L: 50 };
      case 'beater': return { x: 400, y: 190, L: 78 };
      case 'worm': return { x: 170, y: 150, L: 48 };
      case 'rack': return { x: 840, y: 470, L: 50 };
    }
  }
  const handle = () => { const k = crankOf(); return { x: k.x + Math.sin(th) * k.L, y: k.y - Math.cos(th) * k.L }; };

  function setScene(s) {
    scene = s; th = 0; inTurns = 0; st.out = 0; st.lift = 0; st.s = 0; st.vs = 0; st.slip = 0; st.belt = 0; st.wheel = 0;
    crank = null; said = {};
    tools(); hud();
    UI.how(T('mc_' + s + 'T'), T('mc_' + s + 'How'));
    UI.fact(T('mc_' + s + 'Fact'), T('fact'));
  }
  function once(k, ms = 3200) { if (said[k]) return; said[k] = true; UI.toast(T(k), ms); }

  function tools() {
    const extra = {
      chain: [8, 16, 32].map(z => ({ icon: '⚙️', label: T('mc_rearN', z), pressed: st.rear === z, click: () => { st.rear = z; st.out = 0; inTurns = 0; tools(); hud(); Sound.shift(); } })),
      belt: [
        { icon: '✖️', label: T('mc_cross'), toggle: true, pressed: st.cross, click: () => { st.cross = !st.cross; said = {}; Sound.click(); return st.cross; } },
        { icon: '🧱', label: T('mc_load'), toggle: true, pressed: st.load, click: () => { st.load = !st.load; said = {}; Sound.click(); return st.load; } },
      ],
      beater: [], worm: [],
      rack: [{ icon: '🦷', label: T('mc_rackOn'), toggle: true, pressed: st.rack, click: () => { st.rack = !st.rack; said = {}; Sound.click(); if (st.rack) st.vs = 0; return st.rack; } }],
    }[scene];
    UI.toolbar([
      ...SCENES.map(s => ({ icon: ICON[s], label: T('mc_' + s), pressed: s === scene, click: () => { setScene(s); Sound.pick(); } })),
      '/',
      { icon: motor ? '⏸' : '▶', label: T(motor ? 'ws_stop' : 'ws_motor'), click: () => { motor = !motor; tools(); }, cls: motor ? '' : 'go' },
      ...extra,
    ]);
  }

  function hud() {
    const n = x => Math.floor(Math.abs(x) + 1e-6);
    const chips = {
      chain: [T('mc_hudFront', n(inTurns)), T('mc_hudBack', n(st.out))],
      belt: [T('mc_hudFront', n(inTurns)), T('mc_hudBack', n(st.out))],
      beater: [T('mc_hudCrank', n(inTurns)), T('mc_hudBeater', n(st.out))],
      worm: [T('mc_hudScrew', n(inTurns)), T('mc_hudWheel', num(Math.abs(st.out), 2))],
      rack: [T('mc_hudCrank', n(inTurns)), T('mc_hudSlope', pct(47))],
    }[scene];
    UI.hud(chips);
  }

  // Turns the crank by d radians (from the motor or the hand).
  function turn(d) {
    if (scene === 'rack') {
      if (st.rack) { const ns = clamp(st.s + d * R_PIN, 0, rackLen()); d = (ns - st.s) / R_PIN; st.s = ns; }
      else if (st.s < FLAT) st.s = clamp(st.s + d * R_PIN, 0, FLAT + 20);
      else if (d > 0) { st.slip = 1; once('mc_rackFell', 3800); }   // smooth wheels just spin on the steep rail
      st.wheel += d;
      if (st.rack && st.s >= rackLen() - 0.5) { if (!said.mc_summit) { Sound.win(); FX.confetti(60); } once('mc_summit'); }
    }
    if (scene === 'worm') {
      const lim = WORM.top, now = st.lift;
      const dl = d / WORM_Z * WORM.drum;              // rope wound in by this turn
      if (now + dl > lim) d = (lim - now) / WORM.drum * WORM_Z;
      if (now + dl < 0) d = -now / WORM.drum * WORM_Z;
    }
    th += d; inTurns += d / TAU; if (d) st.dir = Math.sign(d);
    if (Math.abs(d) > 1e-4) Sound.tick();
    const kind = scene;
    if (kind === 'chain') st.out += d / TAU * 32 / st.rear;
    if (kind === 'belt') {
      const ratio = 70 / 35 * (st.cross ? -1 : 1) * (st.load ? 0.3 : 1);
      st.out += d / TAU * ratio; st.belt += d * 70;
      if (st.load) { st.slip = 0.5; once('mc_slipped', 3800); }
      else if (st.cross) once('mc_crossed');
      else once('mc_sameBelt');
    }
    if (kind === 'beater') { st.out += d / TAU * 4; once('mc_corner', 3600); }
    if (kind === 'worm') { st.out += d / TAU / WORM_Z; st.lift = clamp(st.lift + d / WORM_Z * WORM.drum, 0, WORM.top); if (st.lift >= WORM.top - 0.5) once('mc_wormTop'); }
    hud();
  }

  /* ---------- chain and belt: a loop around two wheels ---------- */
  // Path around two circles (centres on one horizontal line), clockwise for wheel 1.
  // cross: a crossed belt. Returns { len, at(s) -> {x, y, a} }.
  function loop(c1, r1, c2, r2, cross) {
    const d = c2.x - c1.x, k = (cross ? r1 + r2 : r1 - r2) / d, q = Math.sqrt(1 - k * k);
    const nA = { x: k, y: -q }, nB = { x: k, y: q };
    const segs = [];
    if (!cross) {
      const a1 = { x: c1.x + r1 * nA.x, y: c1.y + r1 * nA.y }, a2 = { x: c2.x + r2 * nA.x, y: c2.y + r2 * nA.y };
      const b1 = { x: c1.x + r1 * nB.x, y: c1.y + r1 * nB.y }, b2 = { x: c2.x + r2 * nB.x, y: c2.y + r2 * nB.y };
      const tA = Math.atan2(nA.y, nA.x), tB = Math.atan2(nB.y, nB.x);
      segs.push({ line: [a1, a2] }, { arc: [c2, r2, tA, tB, 1] }, { line: [b2, b1] }, { arc: [c1, r1, tB, tA + TAU, 1] });
    } else {
      const a1 = { x: c1.x + r1 * nA.x, y: c1.y + r1 * nA.y }, a2 = { x: c2.x - r2 * nA.x, y: c2.y - r2 * nA.y };
      const b1 = { x: c1.x + r1 * nB.x, y: c1.y + r1 * nB.y }, b2 = { x: c2.x - r2 * nB.x, y: c2.y - r2 * nB.y };
      const tA = Math.atan2(nA.y, nA.x), tB = Math.atan2(nB.y, nB.x);
      segs.push({ line: [a1, a2] }, { arc: [c2, r2, tA + Math.PI, tB + Math.PI - TAU, -1] }, { line: [b2, b1] }, { arc: [c1, r1, tB, tA + TAU, 1] });
    }
    for (const s of segs) s.len = s.line ? Math.hypot(s.line[1].x - s.line[0].x, s.line[1].y - s.line[0].y) : Math.abs(s.arc[3] - s.arc[2]) * s.arc[1];
    const len = segs.reduce((t, s) => t + s.len, 0);
    return {
      len, segs,
      at(s) {
        s = ((s % len) + len) % len;
        for (const g of segs) {
          if (s > g.len) { s -= g.len; continue; }
          if (g.line) { const [p, q2] = g.line, f = s / g.len; return { x: p.x + (q2.x - p.x) * f, y: p.y + (q2.y - p.y) * f, a: Math.atan2(q2.y - p.y, q2.x - p.x) }; }
          const [c, r, a0, a1, dir] = g.arc, t = a0 + (a1 - a0) * (s / g.len);
          return { x: c.x + Math.cos(t) * r, y: c.y + Math.sin(t) * r, a: t + dir * Math.PI / 2 };
        }
        return { x: 0, y: 0, a: 0 };
      },
      stroke(c) {
        c.beginPath();
        for (const g of segs) {
          if (g.line) { c.lineTo(g.line[0].x, g.line[0].y); c.lineTo(g.line[1].x, g.line[1].y); }
          else c.arc(g.arc[0].x, g.arc[0].y, g.arc[1], g.arc[2], g.arc[3], g.arc[4] < 0);
        }
        c.closePath();
      },
    };
  }

  function drawCrankArm(c, x, y, L) {
    const hx = x + Math.sin(th) * L, hy = y - Math.cos(th) * L;
    c.save(); c.lineCap = 'round';
    c.strokeStyle = COL.ink; c.lineWidth = 12; c.beginPath(); c.moveTo(x, y); c.lineTo(hx, hy); c.stroke();
    c.strokeStyle = '#d3d8e1'; c.lineWidth = 7; c.stroke();
    c.beginPath(); c.arc(hx, hy, 14, 0, TAU); c.fillStyle = COL.red; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
    c.beginPath(); c.arc(hx - 4, hy - 4, 4, 0, TAU); c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
    c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fillStyle = COL.ink; c.fill();
    c.restore();
  }
  function label(c, text, x, y, o) { tag(c, text, x, y, o); }

  function drawChain(c) {
    const c1 = { x: 250, y: 290 }, c2 = { x: 690, y: 290 }, z2 = st.rear;
    const r1 = pitchR(32), r2 = pitchR(z2);
    const lp = loop(c1, r1, c2, r2, false);
    drawGear(c, { x: c1.x, y: c1.y, z: 32, a: th, col: COL.purple });
    drawGear(c, { x: c2.x, y: c2.y, z: z2, a: st.out * TAU, col: COL.orange });
    // links: one every 15.7 px (one tooth), moving with the teeth
    const step = Math.PI * MOD, n = Math.round(lp.len / step), off = th * r1;
    c.save();
    for (let i = 0; i < n; i++) {
      const p = lp.at(off + i * lp.len / n);
      c.save(); c.translate(p.x, p.y); c.rotate(p.a);
      c.fillStyle = i % 2 ? '#4c5568' : '#8a94a6'; rr(c, -9, -5, 18, 10, 4); c.fill();
      c.lineWidth = 1.6; c.strokeStyle = COL.ink; c.stroke();
      c.beginPath(); c.arc(-5, 0, 2, 0, TAU); c.arc(5, 0, 2, 0, TAU); c.fillStyle = '#dfe4ec'; c.fill();
      c.restore();
    }
    c.restore();
    drawCrankArm(c, c1.x, c1.y, 58);
    if (Math.abs(inTurns) > 0.05) { turnArrow(c, c1.x, c1.y, r1 + 22, st.dir); turnArrow(c, c2.x, c2.y, r2 + 22, st.dir); }
    label(c, T('mc_teeth', 32), c1.x, c1.y + r1 + 46);
    label(c, T('mc_teeth', z2), c2.x, c2.y + Math.max(r2, 40) + 46);
    label(c, T('mc_chainRule', ratioText(32 / z2)), VW / 2, 70, { size: 18, bg: '#fff8d6', border: COL.ink });
  }

  function drawPulley(c, x, y, r, a, col) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(23,35,61,.18)'; c.beginPath(); c.arc(3, 5, r + 4, 0, TAU); c.fill();
    c.rotate(a);
    c.beginPath(); c.arc(0, 0, r + 4, 0, TAU); c.fillStyle = '#d3d8e1'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
    c.beginPath(); c.arc(0, 0, r - 8, 0, TAU); c.fillStyle = col; c.fill(); c.stroke();
    c.lineWidth = 6; c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineCap = 'round';
    c.beginPath(); c.moveTo(10, 0); c.lineTo(r - 14, 0); c.stroke();
    c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fillStyle = '#e8ecf2'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
    c.restore();
  }
  function drawBelt(c) {
    const c1 = { x: 250, y: 290 }, c2 = { x: 690, y: 290 }, r1 = 70, r2 = 35;
    const lp = loop(c1, r1 + 4, c2, r2 + 4, st.cross);
    drawPulley(c, c1.x, c1.y, r1, th, COL.leaf);
    drawPulley(c, c2.x, c2.y, r2, st.out * TAU, COL.blue);
    c.save(); lp.stroke(c);
    c.lineJoin = 'round'; c.strokeStyle = COL.ink; c.lineWidth = 12; c.stroke();
    c.strokeStyle = '#3b3b40'; c.lineWidth = 8; c.stroke();
    c.setLineDash([10, 14]); c.lineDashOffset = -st.belt * (r1 + 4) / 70; c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.stroke();
    c.restore();
    drawCrankArm(c, c1.x, c1.y, 50);
    if (Math.abs(inTurns) > 0.05) { turnArrow(c, c1.x, c1.y, r1 + 26, st.dir); turnArrow(c, c2.x, c2.y, r2 + 26, st.cross ? -st.dir : st.dir); }
    if (st.slip > 0) {
      c.save(); c.globalAlpha = clamp(st.slip * 2, 0, 1);
      c.font = `28px ${EMOJI}`; c.textAlign = 'center'; c.fillText('💨', c2.x + 70, c2.y - 50);
      tag(c, T('mc_slip'), c2.x + 70, c2.y - 92, { size: 16, bg: '#ffe0d9', border: COL.red });
      c.restore();
    }
    if (st.load) {                                      // a heavy grindstone on the small pulley
      c.save(); c.translate(c2.x + 120, c2.y + 40); c.rotate(st.out * TAU);
      c.beginPath(); c.arc(0, 0, 46, 0, TAU); c.fillStyle = '#9aa3b2'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(40, 0); c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke();
      c.restore();
      c.save(); c.strokeStyle = COL.ink; c.lineWidth = 5; c.beginPath(); c.moveTo(c2.x, c2.y); c.lineTo(c2.x + 120, c2.y + 40); c.stroke(); c.restore();
      label(c, T('mc_heavy'), c2.x + 120, c2.y + 108, { size: 14 });
    }
    label(c, T('mc_beltRule'), VW / 2, 70, { size: 18, bg: '#fff8d6', border: COL.ink });
  }

  /* ---------- egg beater: bevel gears turn the motion through 90° ---------- */
  function drawBeater(c) {
    const cx = 400, cy = 190, R = 118, zBig = 40;
    // bowl and batter
    c.save();
    c.fillStyle = '#ffe9a8'; c.beginPath(); c.ellipse(cx, 470, 230, 34, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(201,138,75,.6)'; c.lineWidth = 3;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(cx, 470, 60 + k * 50, 10 + k * 6, 0, st.out * 2 + k, st.out * 2 + k + 2.2); c.stroke(); }
    c.beginPath(); c.moveTo(cx - 250, 440); c.quadraticCurveTo(cx - 240, 580, cx, 580); c.quadraticCurveTo(cx + 240, 580, cx + 250, 440);
    c.fillStyle = 'rgba(79,179,217,.25)'; c.fill(); c.lineWidth = 3; c.strokeStyle = COL.ink; c.stroke();
    c.beginPath(); c.ellipse(cx, 440, 250, 26, 0, Math.PI, TAU); c.stroke();
    c.restore();
    // frame and handle
    c.save(); c.lineCap = 'round'; c.strokeStyle = COL.ink; c.lineWidth = 10;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, 42); c.stroke(); c.strokeStyle = '#c8ced8'; c.lineWidth = 6; c.stroke();
    c.fillStyle = '#e8590c'; rr(c, cx - 20, 8, 40, 46, 12); c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
    c.strokeStyle = COL.ink; c.lineWidth = 10; c.beginPath(); c.moveTo(cx - 34, cy + R - 4); c.lineTo(cx + 34, cy + R - 4); c.stroke();
    c.restore();
    // shafts and whisks (behind the big wheel's lower edge)
    const sp = st.out * TAU;
    for (const [sx, dir] of [[cx - 34, 1], [cx + 34, -1]]) {
      c.save(); c.lineCap = 'round'; c.strokeStyle = COL.ink; c.lineWidth = 7; c.beginPath(); c.moveTo(sx, cy + R); c.lineTo(sx, 330); c.stroke();
      c.strokeStyle = '#c8ced8'; c.lineWidth = 3.5; c.stroke(); c.restore();
      for (let k = 0; k < 4; k++) {
        const ang = sp * dir + k * Math.PI / 4, hw = 30 * Math.cos(ang), back = Math.sin(ang) < 0;
        c.save(); c.lineWidth = back ? 2.5 : 3.5; c.strokeStyle = back ? 'rgba(76,85,104,.55)' : '#4c5568';
        c.beginPath(); c.moveTo(sx, 326); c.bezierCurveTo(sx + hw * 1.5, 360, sx + hw * 1.4, 452, sx, 458); c.stroke(); c.restore();
      }
    }
    // big wheel, face-on, teeth on its face
    c.save(); c.translate(cx, cy);
    c.fillStyle = 'rgba(23,35,61,.18)'; c.beginPath(); c.arc(4, 6, R, 0, TAU); c.fill();
    c.rotate(th);
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = COL.leaf; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
    for (let k = 0; k < zBig; k++) {
      c.save(); c.rotate(k * TAU / zBig); c.fillStyle = k ? '#1c7a55' : '#fff'; c.fillRect(R - 18, -4, 15, 8); c.restore();
    }
    c.beginPath(); c.arc(0, 0, R - 24, 0, TAU); c.strokeStyle = 'rgba(23,35,61,.35)'; c.lineWidth = 2; c.stroke();
    for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + Math.PI / 4; c.beginPath(); c.arc(Math.cos(a) * 52, Math.sin(a) * 52, 22, 0, TAU); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill(); c.stroke(); }
    c.restore();
    for (const [sx, dir] of [[cx - 34, 1], [cx + 34, -1]]) {     // pinions, seen from the side: teeth slide past
      const pw = 34, ph = 22, py = cy + R - 30;
      c.save(); c.fillStyle = COL.orange; rr(c, sx - pw / 2, py, pw, ph, 4); c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
      c.beginPath(); c.rect(sx - pw / 2, py, pw, ph); c.clip();
      c.strokeStyle = 'rgba(23,35,61,.65)'; c.lineWidth = 2;
      for (let t = 0; t < 10; t++) { const a = sp * dir + t * TAU / 10; if (Math.cos(a) <= 0) continue; const x = sx + Math.sin(a) * pw / 2; c.beginPath(); c.moveTo(x, py); c.lineTo(x, py + ph); c.stroke(); }
      c.restore();
    }
    drawCrankArm(c, cx, cy, 78);
    // the two axles: the wheel's points at you, the beaters' point down
    c.save(); c.strokeStyle = COL.ccw; c.lineWidth = 2.5; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(cx + 14, cy + 8); c.lineTo(cx + 150, cy + 40); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.arc(cx, cy, 14, 0, TAU); c.stroke();
    c.strokeStyle = COL.cw; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(cx + 34, 335); c.lineTo(cx + 34, 470); c.moveTo(cx + 40, 400); c.lineTo(cx + 150, 400); c.stroke(); c.restore();
    label(c, T('mc_axisCrank'), cx + 250, cy + 44, { size: 14, col: COL.ccw });
    label(c, T('mc_axisWhisk'), cx + 250, 400, { size: 14, col: COL.cw });
    label(c, T('mc_beaterRule'), 760, 70, { size: 17, bg: '#fff8d6', border: COL.ink });
  }

  /* ---------- worm gear ---------- */
  const WORM_Z = 20, WORM = { x0: 230, x1: 700, y: 150, r: 30, m: 8, drum: 30, top: 150 };
  function wormWheel() { const r = WORM.m * WORM_Z / 2; return { x: 480, y: WORM.y + WORM.r + r - WORM.m * 0.6, r }; }
  function drawWorm(c) {
    const w = wormWheel(), pitch = Math.PI * WORM.m, ph = (th / TAU) * pitch;
    // load: rope from the drum down to a heavy anvil
    const ay = 500 - st.lift, rx = w.x - WORM.drum;
    c.save(); c.strokeStyle = '#7a5230'; c.lineWidth = 4; c.beginPath(); c.moveTo(rx, w.y); c.lineTo(rx, ay - 30); c.stroke();
    c.fillStyle = '#4c5568'; c.beginPath();
    c.moveTo(rx - 50, ay - 30); c.lineTo(rx + 50, ay - 30); c.lineTo(rx + 40, ay - 12); c.lineTo(rx + 18, ay - 6); c.lineTo(rx + 26, ay + 18); c.lineTo(rx - 26, ay + 18); c.lineTo(rx - 18, ay - 6); c.lineTo(rx - 64, ay - 18); c.closePath();
    c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
    c.fillStyle = '#fff'; c.font = `800 13px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('100 kg', rx, ay + 6);
    c.fillStyle = 'rgba(23,35,61,.15)'; c.fillRect(rx - 90, 522, 180, 6);
    c.restore();
    // wheel: teeth spaced like the worm's thread, tooth 0 lined up with a groove
    const wa = st.out * TAU - Math.PI / 2 + Math.PI / WORM_Z;
    drawGear(c, { x: w.x, y: w.y, z: WORM_Z, m: WORM.m, a: wa, col: COL.purple });
    c.beginPath(); c.arc(w.x, w.y, WORM.drum, 0, TAU); c.fillStyle = '#c98a4b'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
    c.beginPath(); c.arc(w.x, w.y, 6, 0, TAU); c.fillStyle = COL.ink; c.fill();
    // worm: a cylinder with a slanted thread; its bumps slide along as it turns
    const { x0, x1, y, r } = WORM, xo = w.x - pitch / 2;   // a crest sits over the wheel at the start
    c.save();
    c.beginPath();
    c.moveTo(x0, y - r);
    for (let x = x0; x <= x1; x += 3) { const f = ((x - xo - ph) / pitch % 1 + 1) % 1; c.lineTo(x, y - r - 7 * Math.max(0, Math.cos(f * TAU))); }
    for (let x = x1; x >= x0; x -= 3) { const f = ((x - xo - ph - pitch / 2) / pitch % 1 + 1) % 1; c.lineTo(x, y + r + 7 * Math.max(0, Math.cos(f * TAU))); }
    c.closePath();
    const gr = c.createLinearGradient(0, y - r, 0, y + r); gr.addColorStop(0, '#e6eaf1'); gr.addColorStop(0.5, '#b7bfcc'); gr.addColorStop(1, '#7e889a');
    c.fillStyle = gr; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
    c.clip();
    c.strokeStyle = 'rgba(23,35,61,.6)'; c.lineWidth = 3;
    for (let x = x0 - pitch * 2 + (((xo + ph - x0) % pitch) + pitch) % pitch; x < x1 + pitch; x += pitch) { c.beginPath(); c.moveTo(x, y - r - 8); c.lineTo(x + pitch / 2, y + r + 8); c.stroke(); }
    c.restore();
    c.save(); c.fillStyle = '#9aa3b2'; c.strokeStyle = COL.ink; c.lineWidth = 2.5;
    for (const bx of [x0 - 22, x1 + 6]) { rr(c, bx, y - 22, 16, 44, 4); c.fill(); c.stroke(); }
    c.lineCap = 'round'; c.lineWidth = 8; c.strokeStyle = COL.ink; c.beginPath(); c.moveTo(170, y); c.lineTo(x0 - 22, y); c.stroke();
    c.restore();
    drawCrankArm(c, 170, y, 48);
    label(c, T('mc_wormRule'), 760, 330, { size: 17, bg: '#fff8d6', border: COL.ink });
    label(c, T('mc_wormTry'), 760, 372, { size: 14 });
  }

  /* ---------- cog railway: rack and pinion ---------- */
  const SLOPE = Math.atan(0.47), R_PIN = 22, FLAT = 150;
  const TRACK = { x0: 40, y0: 470, xs: 190 };                 // flat part, then the climb from xs
  const rackLen = () => FLAT + 520;                          // where the engine stops at the top
  function trackAt(s) {                                       // point on the rail and its angle
    if (s <= FLAT) return { x: TRACK.x0 + s, y: TRACK.y0, a: 0 };
    const u = s - FLAT;
    return { x: TRACK.xs + Math.cos(SLOPE) * u, y: TRACK.y0 - Math.sin(SLOPE) * u, a: -SLOPE };
  }
  function drawRack(c) {
    // mountain and track
    c.save();
    c.fillStyle = '#cfe8c6'; c.beginPath(); c.moveTo(0, VH); c.lineTo(0, TRACK.y0 + 8);
    const top = trackAt(rackLen() + 200);            // the coach, ahead of the engine, needs track too
    c.lineTo(TRACK.xs, TRACK.y0 + 8); c.lineTo(top.x, top.y + 8); c.lineTo(top.x + 60, top.y + 8); c.lineTo(VW, top.y + 60); c.lineTo(VW, VH); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(35,153,107,.6)'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(top.x - 40, top.y - 10); c.lineTo(top.x + 30, top.y - 120); c.lineTo(top.x + 110, top.y + 20); c.closePath();
    c.fillStyle = '#a9b6c9'; c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(top.x + 5, top.y - 62); c.lineTo(top.x + 30, top.y - 120); c.lineTo(top.x + 58, top.y - 58); c.closePath(); c.fill();
    c.restore();
    const flagP = trackAt(rackLen() + 200);
    c.save(); c.strokeStyle = COL.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(flagP.x, flagP.y); c.lineTo(flagP.x, flagP.y - 60); c.stroke();
    c.fillStyle = COL.red; c.beginPath(); c.moveTo(flagP.x, flagP.y - 60); c.lineTo(flagP.x + 34, flagP.y - 50); c.lineTo(flagP.x, flagP.y - 40); c.fill(); c.restore();
    // rail and rack teeth
    c.save(); c.lineCap = 'round';
    const p0 = trackAt(0), p1 = trackAt(FLAT), p2 = trackAt(rackLen() + 200);
    c.strokeStyle = '#6b7385'; c.lineWidth = 7; c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();
    if (st.rack) {
      const pitch = Math.PI * 2 * R_PIN / 11;
      for (let s = FLAT - 20; s < rackLen() + 200; s += pitch) {
        const p = trackAt(s), nx = Math.sin(p.a), ny = -Math.cos(p.a), tx = Math.cos(p.a), ty = Math.sin(p.a);
        c.fillStyle = '#c98a4b'; c.beginPath();
        c.moveTo(p.x - tx * 4, p.y - ty * 4); c.lineTo(p.x + nx * 8 - tx * 2, p.y + ny * 8 - ty * 2); c.lineTo(p.x + nx * 8 + tx * 2, p.y + ny * 8 + ty * 2); c.lineTo(p.x + tx * 4, p.y + ty * 4); c.fill();
      }
      c.strokeStyle = '#8a5a2e'; c.lineWidth = 4; c.beginPath(); c.moveTo(trackAt(FLAT - 20).x, trackAt(FLAT - 20).y); c.lineTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();
    }
    c.restore();
    // the engine pushes its coach up the hill, like on real mountain railways
    const e = trackAt(st.s), ca = e.a, cos = Math.cos(ca), sin = Math.sin(ca);
    const at = (dx, dy) => ({ x: e.x + cos * dx - sin * dy, y: e.y + sin * dx + cos * dy });
    c.save(); c.translate(e.x, e.y); c.rotate(ca);
    // coach ahead (uphill)
    c.fillStyle = '#ffd23f'; rr(c, 58, -78, 120, 56, 8); c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
    c.fillStyle = '#bfe3f5'; for (let k = 0; k < 3; k++) { rr(c, 68 + k * 36, -68, 26, 22, 4); c.fill(); c.stroke(); }
    // engine
    c.fillStyle = COL.red; rr(c, -70, -66, 120, 44, 8); c.fill(); c.stroke();
    c.fillStyle = '#2b2b31'; rr(c, -70, -104, 50, 40, 6); c.fill(); c.stroke();
    c.fillStyle = '#2b2b31'; c.beginPath(); c.rect(18, -96, 16, 30); c.fill(); c.stroke();
    for (const wx of [-40, 26, 100, 150]) { c.beginPath(); c.arc(wx, -14, 11, 0, TAU); c.fillStyle = '#4c5568'; c.fill(); c.stroke(); }
    c.restore();
    // the pinion (cog) under the engine, meshing with the rack
    const pc = at(-6, -R_PIN + 2);
    drawGear(c, { x: pc.x, y: pc.y, z: 11, m: 2 * R_PIN / 11, a: st.wheel + ca, col: COL.sun }, { flat: true });
    if (st.slip > 0) { c.save(); c.globalAlpha = clamp(st.slip, 0, 1); tag(c, T('mc_rackSlip'), pc.x, pc.y - 140, { size: 16, bg: '#ffe0d9', border: COL.red }); c.restore(); }
    // the driver's crank
    const k = crankOf();
    c.save(); c.beginPath(); c.arc(k.x, k.y, 64, 0, TAU); c.fillStyle = 'rgba(255,255,255,.85)'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke(); c.restore();
    drawCrankArm(c, k.x, k.y, k.L);
    label(c, T('mc_driveMe'), k.x, k.y - 82, { size: 14 });
    label(c, T('mc_rackRule'), 300, 70, { size: 17, bg: '#fff8d6', border: COL.ink });
  }

  return {
    label: () => T('mc_label'),
    enter() { setScene(scene); },
    exit() { crank = null; },
    update(dt) {
      if (motor && !crank) turn(OMEGA * dt);
      st.slip = Math.max(0, st.slip - dt);
      if (scene === 'rack' && !st.rack && st.s > FLAT) {     // smooth wheels can't hold on the slope
        st.vs -= 260 * Math.sin(SLOPE) * dt;
        st.s = Math.max(FLAT, st.s + st.vs * dt);
        if (st.s <= FLAT) st.vs = 0;
        st.slip = 1; once('mc_rackFell', 3800);
      }
    },
    draw(c) {
      paper(c);
      ({ chain: drawChain, belt: drawBelt, beater: drawBeater, worm: drawWorm, rack: drawRack })[scene](c);
    },
    hover(p) {
      const h = handle();
      const onWheel = scene === 'worm' && Math.hypot(p.x - wormWheel().x, p.y - wormWheel().y) < wormWheel().r;
      canvas.style.cursor = Math.hypot(p.x - h.x, p.y - h.y) < 26 || onWheel ? 'grab' : 'default';
    },
    down(p) {
      const h = handle(), k = crankOf();
      if (Math.hypot(p.x - h.x, p.y - h.y) < 30 || Math.hypot(p.x - k.x, p.y - k.y) < k.L + 20) {
        crank = { a: Math.atan2(p.y - k.y, p.x - k.x) }; canvas.style.cursor = 'grabbing'; Sound.pick(); return;
      }
      if (scene === 'worm' && Math.hypot(p.x - wormWheel().x, p.y - wormWheel().y) < wormWheel().r + 10) {
        Sound.jam(); UI.toast(T('mc_wormLocked'), 3600); UI.fact(T('mc_wormLockedWhy'), T('mc_wormT'));
      }
    },
    move(p) {
      if (!crank) return;
      const k = crankOf(), a = Math.atan2(p.y - k.y, p.x - k.x), d = wrapA(a - crank.a);
      crank.a = a; turn(d);
    },
    up() {
      if (crank && scene === 'worm' && st.lift > 20) once('mc_wormHolds', 3600);
      crank = null; canvas.style.cursor = 'default';
    },
  };
})();
