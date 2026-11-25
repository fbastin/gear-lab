
/* ==========================================================
   Mode 5: Quiz
   10 questions: a "which way?" gear train and a "how many
   turns?" pair made up on the spot, plus 8 picked from QUIZ
   in content.js. Each question has a picture.
   ========================================================== */
const Quiz = (() => {
  const N = 10;
  let qs = [], i = 0, score = 0, chosen = -1, spin = 0;
  const text = x => (typeof x === 'function' ? x() : tr(x));

  // A row of meshing gears (or a jammed triangle): which way does the last one turn?
  function makeDir() {
    if (Math.random() < 0.25) {
      return { scene: 'tri', answer: 2, q: () => T('qz_triQ'), choices: [() => '↻ ' + T('cw'), () => '↺ ' + T('ccw'), () => '🔒 ' + T('qz_jams')], why: () => T('qz_triWhy') };
    }
    const n = 3 + Math.floor(Math.random() * 4), zs = Array.from({ length: n }, () => pick([12, 16, 24]));
    const first = Math.random() < 0.5 ? 1 : -1, last = n % 2 ? first : -first;
    return {
      scene: 'row', zs, first, answer: last > 0 ? 0 : 1,
      q: () => T('qz_dirQ', n, T(first > 0 ? 'cw' : 'ccw')),
      choices: [() => '↻ ' + T('cw'), () => '↺ ' + T('ccw'), () => '🔒 ' + T('qz_jams')],
      why: () => T(n % 2 ? 'qz_dirOdd' : 'qz_dirEven', n),
    };
  }
  // Two gears: how many turns does the big one make?
  function makeTurns() {
    const [z1, k] = pick([[12, 2], [12, 3], [12, 4], [16, 2], [16, 3], [8, 3], [8, 6], [24, 2]]);
    const z2 = z1 * k, t1 = k * pick([1, 2, 3]), ans = t1 / k;
    const opts = shuffle([...new Set([ans, t1, t1 * k, ans + 1])]).slice(0, 4);
    if (!opts.includes(ans)) opts[0] = ans;
    return {
      scene: 'pair', z1, z2, answer: opts.indexOf(ans),
      q: () => T('qz_turnsQ', z1, t1, z2), choices: opts.map(o => () => String(o)),
      why: () => T('qz_turnsWhy', z1, t1, z1 * t1, z2, ans),
    };
  }
  // A copy of a QUIZ question with its choices in a new order (unless keep: true).
  function mix(q) {
    if (q.keep) return q;
    const order = shuffle(q.choices.map((_, k) => k));
    return { ...q, choices: order.map(k => q.choices[k]), answer: order.indexOf(q.answer) };
  }
  function round() {
    qs = shuffle([makeDir(), makeTurns(), ...shuffle(QUIZ).slice(0, N - 2).map(mix)]);
    i = 0; score = 0; chosen = -1;
    UI.overlay(null); show(); showFact();
  }
  function show() {
    const q = qs[i], answered = chosen >= 0;
    const items = [{ text: `<b>${i + 1}.</b> ${text(q.q)}` }];
    q.choices.forEach((ch, k) => items.push({
      label: text(ch), disabled: answered,
      cls: answered ? (k === q.answer ? 'good' : k === chosen ? 'bad' : '') : '',
      click: () => answer(k),
    }));
    if (answered) items.push('|', { icon: '➡️', label: T(i + 1 < N ? 'qz_next' : 'qz_finish'), cls: 'go', click: next });
    UI.toolbar(items);
    UI.hud([T('qz_count', i + 1, N), T('qz_score', score)]);
    if (answered) { const b = $('#toolbar .go'); if (b) b.focus({ preventScroll: true }); }
  }
  function answer(k) {
    if (chosen >= 0) return;
    const q = qs[i]; chosen = k; spin = 0;
    const ok = k === q.answer; if (ok) { score++; Sound.ding(); } else Sound.nope();
    UI.toast(T(ok ? 'qz_right' : 'qz_wrong'), 1800);
    UI.fact(text(q.why), T(ok ? 'qz_right' : 'qz_wrong'));
    show();
  }
  function next() {
    if (i + 1 >= N) { finish(); return; }
    i++; chosen = -1; spin = 0; show(); Sound.pick();
  }
  function finish() {
    const s = score >= 9 ? 3 : score >= 6 ? 2 : 1;
    Sound.win(); if (s === 3) FX.confetti();
    const o = UI.overlay(`<div class="stars">${'⭐'.repeat(s)}<span class="off">${'⭐'.repeat(3 - s)}</span></div>` +
      `<h3>${T('qz_done', score, N)}</h3><p>${T(s === 3 ? 'qz_great' : 'qz_good')}</p>` +
      `<button type="button" class="chunky tool go">↺ ${T('again')}</button>`);
    o.querySelector('button').addEventListener('click', round);
  }

  /* ---------- pictures ---------- */
  const answered = () => chosen >= 0;
  // Lays gears out in a gentle zigzag so they all mesh. Returns gear objects.
  function row(zs, cx, cy) {
    const gs = []; let x = 0, y = 0;
    zs.forEach((z, k) => {
      if (k) { const prev = gs[k - 1], d = pitchR(prev.z) + pitchR(z), a = (k % 2 ? -0.35 : 0.35); x = prev.x + Math.cos(a) * d; y = prev.y + Math.sin(a) * d; }
      gs.push({ x, y, z, a: 0 });
    });
    const minX = Math.min(...gs.map(g => g.x - outerR(g.z))), maxX = Math.max(...gs.map(g => g.x + outerR(g.z)));
    const sc = Math.min(1.8, 820 / (maxX - minX)), ox = cx - (minX + maxX) / 2;
    gs.forEach((g, k) => { g.x += ox; g.y += cy; if (k) alignTo(g, gs[k - 1]); });
    return { gs, sc };
  }
  function turning(gs, dir0) {      // turns a meshing row by `spin`
    const r = [dir0]; for (let k = 1; k < gs.length; k++) r.push(-r[k - 1] * gs[k - 1].z / gs[k].z);
    return gs.map((g, k) => ({ ...g, a: g.a + spin * r[k] })).map((g, k) => ({ g, r: r[k] }));
  }
  function zoom(c, cx, cy, k) { c.translate(480, 300); c.scale(k, k); c.translate(-cx, -cy); }   // (cx, cy) to the centre, k times bigger
  function bigQ(c, x, y) { c.save(); c.font = `800 46px ${FONT}`; c.fillStyle = COL.red; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', x, y); c.restore(); }

  const SCENES = {
    row(c, q) {
      const { gs, sc } = row(q.zs, VW / 2, 290);
      c.save(); c.translate(VW / 2, 290); c.scale(sc, sc); c.translate(-VW / 2, -290);
      const gg = answered() ? turning(gs, q.first) : gs.map((g, k) => ({ g, r: k ? 0 : q.first }));
      gg.forEach(({ g }, k) => drawGear(c, g, { crank: k === 0 }));
      gg.forEach(({ g, r }, k) => { if (r) turnArrow(c, g.x, g.y, outerR(g.z) + 10, Math.sign(r)); });
      const L = gs[gs.length - 1];
      if (!answered()) bigQ(c, L.x, L.y - outerR(L.z) - 34);
      gs.forEach((g, k) => tag(c, String(k + 1), g.x, g.y + outerR(g.z) + 22, { size: 15 }));
      c.restore();
    },
    tri(c) {
      c.save(); zoom(c, 460, 300, 1.5);
      const A = { x: 400, y: 340, z: 24, a: 0 }, B = { x: 400 + 120, y: 340, z: 24, a: 0 }, C = { x: 460, y: 340 - 120 * Math.sin(Math.PI / 3), z: 24, a: 0 };
      alignTo(B, A); alignTo(C, A);
      drawGear(c, A, { crank: true, jam: answered() }); drawGear(c, B, { jam: answered() }); drawGear(c, C, { jam: answered() });
      turnArrow(c, A.x, A.y, outerR(24) + 10, 1);
      if (!answered()) bigQ(c, C.x + 110, C.y - 40);
      c.restore();
    },
    pair(c, q) {                                       // drawn big: the large gear is about 300 px across
      const m = Math.min(12, 300 / q.z2), r1 = m * q.z1 / 2, r2 = m * q.z2 / 2, d = r1 + r2;
      const A = { x: 480 - (d + r2 - r1) / 2, y: 290, z: q.z1, m, a: 0, col: COL.red }, B = { x: 0, y: 290, z: q.z2, m, a: 0 };
      B.x = A.x + d; alignTo(B, A);
      const a = answered() ? spin : 0;
      drawGear(c, { ...A, a: A.a + a }, { crank: r1 > 30 }); drawGear(c, { ...B, a: B.a - a * q.z1 / q.z2 });
      tag(c, T('mc_teeth', q.z1), A.x, A.y + r1 + m + 26, { size: 17 }); tag(c, T('mc_teeth', q.z2), B.x, B.y + r2 + m + 26, { size: 17 });
      if (answered()) { turnArrow(c, A.x, A.y, r1 + m + 12, 1); turnArrow(c, B.x, B.y, r2 + m + 12, -1); }
    },
    idler(c) {
      const gs = [{ x: 230, y: 300, z: 24, a: 0 }, { x: 0, y: 300, z: 36, a: 0 }, { x: 0, y: 300, z: 24, a: 0 }];
      gs[1].x = gs[0].x + pitchR(24) + pitchR(36); gs[2].x = gs[1].x + pitchR(36) + pitchR(24);
      alignTo(gs[1], gs[0]); alignTo(gs[2], gs[1]);
      turning(gs, 1).forEach(({ g }, k) => drawGear(c, g, { crank: k === 0, sel: k === 1 }));
      tag(c, T('qz_middle'), gs[1].x, gs[1].y - outerR(36) - 26, { size: 15, bg: COL.sun, border: COL.ink });
    },
    teeth(c) {
      drawGear(c, { x: 360, y: 300, z: 12, a: 0.2, m: 11 }); drawGear(c, { x: 360 + 66 + 48 + 4, y: 300, z: 24, a: 0, m: 4 });
      if (!answered()) bigQ(c, 430, 170);
    },
    slip(c) {
      for (const [x, r, col] of [[340, 90, COL.leaf], [340 + 90 + 60, 60, COL.blue]]) {
        c.save(); c.translate(x, 300); c.rotate(answered() && r === 90 ? spin : 0);
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = col; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
        c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(10, 0); c.lineTo(r - 10, 0); c.stroke();
        c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fillStyle = '#e8ecf2'; c.fill(); c.stroke(); c.restore();
      }
      const bx = 340 + 90 + 60 - 30;                     // a heavy crate hangs from the blue wheel
      c.save(); c.strokeStyle = '#7a5230'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(bx, 300); c.lineTo(bx, 430); c.stroke();
      c.fillStyle = '#d9a35a'; rr(c, bx - 34, 430, 68, 56, 6); c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
      c.fillStyle = '#fff'; rr(c, bx - 26, 449, 52, 18, 5); c.fill(); c.fillStyle = COL.ink; c.font = `800 14px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('500 kg', bx, 459);
      c.restore();
      if (answered()) tag(c, T('mc_slip'), 430, 170, { size: 16, bg: '#ffe0d9', border: COL.red });
    },
    strong(c) {
      const A = { x: 300, y: 310, z: 12, a: 0, col: COL.red }, B = { x: 300 + pitchR(12) + pitchR(48), y: 310, z: 48, a: 0 };
      alignTo(B, A); const a = answered() ? spin : 0;
      drawGear(c, { ...A, a: A.a + a }, { crank: true }); drawGear(c, { ...B, a: B.a - a / 4 });
      c.save(); c.font = `42px ${EMOJI}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(answered() ? '🐢💪' : '❓', B.x, B.y - outerR(48) - 40); c.restore();
    },
    chain(c) {
      drawGear(c, { x: 300, y: 300, z: 36, a: spin }, { crank: true }); drawGear(c, { x: 680, y: 300, z: 12, a: spin * 3 });
      c.save(); c.strokeStyle = '#4c5568'; c.lineWidth = 6; c.setLineDash([9, 5]); c.lineDashOffset = -spin * 90;
      const r1 = pitchR(36), r2 = pitchR(12), k = (r1 - r2) / 380, q = Math.sqrt(1 - k * k);
      c.beginPath(); c.moveTo(300 + r1 * k, 300 - r1 * q); c.lineTo(680 + r2 * k, 300 - r2 * q); c.moveTo(300 + r1 * k, 300 + r1 * q); c.lineTo(680 + r2 * k, 300 + r2 * q); c.stroke(); c.restore();
      turnArrow(c, 300, 300, outerR(36) + 12, 1);
      if (answered()) turnArrow(c, 680, 300, outerR(12) + 14, 1); else bigQ(c, 680, 200);
    },
    cross(c) {
      for (const [x, r, a] of [[300, 80, spin], [660, 60, -spin * 80 / 60]]) {
        c.save(); c.translate(x, 300); c.rotate(answered() ? a : 0);
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = '#d3d8e1'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
        c.strokeStyle = COL.red; c.lineWidth = 5; c.beginPath(); c.moveTo(10, 0); c.lineTo(r - 8, 0); c.stroke(); c.restore();
      }
      c.save(); c.strokeStyle = '#3b3b40'; c.lineWidth = 8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(300, 220); c.lineTo(660, 360); c.moveTo(300, 380); c.lineTo(660, 240); c.stroke(); c.restore();
      turnArrow(c, 300, 300, 100, 1);
      if (answered()) turnArrow(c, 660, 300, 80, -1); else bigQ(c, 660, 190);
    },
    clock(c) {
      c.save(); c.translate(480, 300);
      c.beginPath(); c.arc(0, 0, 160, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 5; c.strokeStyle = COL.ink; c.stroke();
      for (let k = 0; k < 12; k++) { const t = k * TAU / 12; c.lineWidth = 4; c.beginPath(); c.moveTo(Math.cos(t) * 135, Math.sin(t) * 135); c.lineTo(Math.cos(t) * 152, Math.sin(t) * 152); c.stroke(); }
      const m = spin * 3, h = m / 12;
      c.save(); c.rotate(h - Math.PI / 2); arrow(c, -10, 0, 90, 0, COL.ink, 10); c.restore();
      c.save(); c.rotate(m - Math.PI / 2); arrow(c, -14, 0, 140, 0, COL.red, 6); c.restore();
      c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fillStyle = COL.ink; c.fill();
      c.restore();
    },
    worm(c) {
      c.save(); const y = 200, ph = (spin * 4 / TAU * 25) % 25;
      const gr = c.createLinearGradient(0, y - 30, 0, y + 30); gr.addColorStop(0, '#e6eaf1'); gr.addColorStop(1, '#7e889a');
      c.fillStyle = gr; rr(c, 300, y - 30, 360, 60, 10); c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
      c.clip(); c.strokeStyle = 'rgba(23,35,61,.6)'; c.lineWidth = 3;
      for (let x = 280 + ph; x < 680; x += 25) { c.beginPath(); c.moveTo(x, y - 34); c.lineTo(x + 12, y + 34); c.stroke(); }
      c.restore();
      drawGear(c, { x: 480, y: 316, z: 20, m: 8, a: spin * 4 / 20, col: COL.purple });
      c.save(); c.font = `48px ${EMOJI}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🎸', 790, 300); c.restore();
    },
    rack(c) {
      const y = 380, off = (spin * 40) % 60;
      c.save(); c.fillStyle = '#c98a4b'; c.fillRect(120, y, 720, 22); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.strokeRect(120, y, 720, 22);
      for (let x = 120; x < 840; x += Math.PI * 8) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 5, y - 10); c.lineTo(x + 13, y - 10); c.lineTo(x + 18, y); c.fillStyle = '#c98a4b'; c.fill(); c.stroke(); }
      c.restore();
      const px = 480 + (answered() ? off : 0);
      drawGear(c, { x: px, y: y - 10 - pitchR(20, 8) + 8, z: 20, m: 8, a: answered() ? off / 80 : 0, col: COL.sun }, { crank: true });
      if (answered()) arrow(c, px + 110, y + 60, px + 220, y + 60, COL.cw, 7);
    },
    bevel(c) {
      c.save(); c.translate(400, 260); c.rotate(spin);
      c.beginPath(); c.arc(0, 0, 130, 0, TAU); c.fillStyle = COL.leaf; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
      for (let k = 0; k < 40; k++) { c.save(); c.rotate(k * TAU / 40); c.fillStyle = '#1c7a55'; c.fillRect(110, -4, 16, 8); c.restore(); }
      c.restore(); drawCrankForQuiz(c, 400, 260, 90);
      c.save(); c.fillStyle = COL.orange; rr(c, 380, 370, 40, 26, 4); c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
      c.strokeStyle = COL.ink; c.lineWidth = 7; c.beginPath(); c.moveTo(400, 396); c.lineTo(400, 520); c.stroke(); c.restore();
      c.save(); c.setLineDash([6, 6]); c.lineWidth = 3; c.strokeStyle = COL.ccw; c.beginPath(); c.moveTo(560, 260); c.lineTo(680, 260); c.stroke();
      c.strokeStyle = COL.cw; c.beginPath(); c.moveTo(440, 440); c.lineTo(440, 540); c.stroke(); c.restore();
    },
    hill(c) {
      c.save(); c.fillStyle = '#9ccf85'; c.beginPath(); c.moveTo(80, 520); c.lineTo(880, 160); c.lineTo(880, 520); c.closePath(); c.fill(); c.restore();
      c.save(); c.font = `90px ${EMOJI}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.translate(420, 330); c.rotate(-0.42); c.scale(-1, 1); c.fillText('🚴', 0, 0); c.restore();
      tag(c, pct(15), 700, 200, { size: 20, bg: '#fff', border: COL.red });
    },
    driver(c) {
      c.save(); zoom(c, 410, 310, 1.7);
      const A = { x: 360, y: 300, z: 24, a: spin, col: COL.red }, B = { x: 360 + pitchR(24) + pitchR(16), y: 300, z: 16, a: 0 };
      alignTo(B, { ...A, a: 0 }); B.a -= spin * 24 / 16;
      drawGear(c, A, { crank: true }); drawGear(c, B);
      tag(c, 'A', A.x, A.y + outerR(24) + 24, { size: 18 }); tag(c, 'B', B.x, B.y + outerR(16) + 24, { size: 18 });
      c.restore();
    },
  };
  function drawCrankForQuiz(c, x, y, L) {
    const hx = x + Math.sin(spin) * L, hy = y - Math.cos(spin) * L;
    c.save(); c.lineCap = 'round'; c.strokeStyle = COL.ink; c.lineWidth = 10; c.beginPath(); c.moveTo(x, y); c.lineTo(hx, hy); c.stroke();
    c.beginPath(); c.arc(hx, hy, 12, 0, TAU); c.fillStyle = COL.red; c.fill(); c.lineWidth = 2.5; c.stroke(); c.restore();
  }

  return {
    label: () => T('qz_label'),
    enter() {
      if (!qs.length) round(); else { show(); }
      UI.how(T('qz_howT'), T('qz_how'));
    },
    exit() {},
    update(dt) { if (answered()) spin += dt * 1.6; },
    draw(c) {
      paper(c);
      const q = qs[i]; if (!q) return;
      (SCENES[q.scene] || (() => {}))(c, q);
    },
    hover() { canvas.style.cursor = 'default'; },
    down() {}, move() {}, up() {},
  };
})();
