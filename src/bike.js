
/* ==========================================================
   Mode 4: Bike ride
   Change gears to get over the hills. The rider always pushes
   as hard as possible; a pedal push turns into a force on the
   road through the chain:  wheel force = pedal force × crank
   length ÷ (gear ratio × wheel radius). Easy gears push hard
   but slowly; hard gears are fast but can't climb.
   ========================================================== */
const Bike = (() => {
  const FRONT = 40, REAR = [32, 28, 24, 20, 16, 14, 12, 10];     // gear 1 (easiest) to 8
  const M = 80, G = 9.81, CRR = 0.006, AIR = 0.24, WHEEL = 0.34, CRANK = 0.17, F0 = 520, CADMAX = 130;
  const COURSE = [[60, 0], [70, 0.05], [60, 0.12], [40, 0], [70, -0.08], [60, 0], [50, 0.15], [40, 0.03], [50, 0]];
  const LEN = COURSE.reduce((t, s) => t + s[0], 0);
  const PXM = 10, VEX = 2, RX = 260, GROUND = 330, SPEEDUP = 2.5;
  let gear = 3, s = 0, v = 0, t = 0, phase = 'ready', crankA = 0, wheelA = 0, stuck = 0, stuckN = 0, best = null, par = null, said = {};

  const ratio = k => FRONT / REAR[k];
  function gradeAt(x) { let a = 0; for (const [l, g] of COURSE) { if (x < a + l) return g; a += l; } return 0; }
  function heightAt(x) {
    let a = 0, h = 0;
    for (const [l, g] of COURSE) { if (x < a + l) return h + (x - a) * g; a += l; h += l * g; }
    return h + (x - a) * 0;
  }
  const cadence = (vv, k) => vv * 60 / (ratio(k) * TAU * WHEEL);             // pedal turns per minute
  function wheelForce(vv, k) {
    const cad = cadence(vv, k), fp = F0 * Math.max(0, 1 - cad / CADMAX);
    return fp * CRANK / (ratio(k) * WHEEL);
  }
  const resist = (vv, gr) => M * G * (gr / Math.sqrt(1 + gr * gr)) + M * G * CRR * Math.sign(vv || 1) + AIR * vv * vv;

  // One physics step. Returns the new speed (never backwards: the rider puts a foot down).
  function step(vv, x, k, dt) {
    const gr = gradeAt(x), f = wheelForce(vv, k) - resist(vv, gr);
    return Math.max(0, vv + f / M * dt);
  }
  // Time for a rider who always picks the best gear: sets the star targets.
  function parTime() {
    let x = 0, vv = 0, tt = 0; const dt = 0.02;
    while (x < LEN && tt < 600) {
      let bk = 0, bf = -1e9;
      for (let k = 0; k < REAR.length; k++) { const f = wheelForce(vv, k); if (f > bf) { bf = f; bk = k; } }
      vv = step(vv, x, bk, dt); x += vv * dt; tt += dt;
    }
    return tt;
  }
  try { best = parseFloat(localStorage.getItem('gearlab-bike')) || null; } catch (e) { best = null; }

  function reset() {
    gear = 3; s = 0; v = 0; t = 0; crankA = 0; wheelA = 0; stuck = 0; stuckN = 0; phase = 'ready'; said = {};
    if (par === null) par = parTime();
    tools(); hud();
    const o = UI.overlay(`<h3>🚲 ${T('bk_readyT')}</h3><p>${T('bk_ready')}</p><div class="row"><button type="button" class="chunky tool go">▶ ${T('bk_go')}</button></div>`);
    o.querySelector('button').addEventListener('click', () => { UI.overlay(null); phase = 'ride'; Sound.whoosh(); });
  }
  function shift(d) {
    const k = clamp(gear + d, 0, REAR.length - 1);
    if (k === gear) { Sound.nope(); return; }
    gear = k; Sound.shift(); tools(); hud();
  }
  function tools() {
    UI.toolbar([
      { icon: '⬇', label: T('bk_easier'), click: () => shift(-1), disabled: gear === 0, cls: 'go' },
      { icon: '⬆', label: T('bk_harder'), click: () => shift(1), disabled: gear === REAR.length - 1, cls: 'go' },
      '|',
      { icon: '↺', label: T('bk_restart'), click: reset },
      { text: T('bk_keys'), cls: 'small' },
    ]);
  }
  const fmtT = x => { const m = Math.floor(x / 60), sec = Math.floor(x % 60); return m ? `${m} min ${String(sec).padStart(2, '0')} s` : `${sec} s`; };
  function hud() { UI.hud([T('bk_hudTime', fmtT(t)), T('bk_hudLeft', Math.max(0, Math.round(LEN - s))), ...(best ? [T('bk_hudBest', fmtT(best))] : [])]); }

  function finish() {
    phase = 'done';
    const stars = t <= par * 1.15 ? 3 : t <= par * 1.2 ? 2 : 1;   // riding the whole way in one gear gets 1 star
    const rec = !best || t < best; if (rec) { best = t; try { localStorage.setItem('gearlab-bike', String(t)); } catch (e) { /* storage blocked */ } }
    Sound.win(); if (stars === 3) FX.confetti();
    const o = UI.overlay(`<div class="stars">${'⭐'.repeat(stars)}<span class="off">${'⭐'.repeat(3 - stars)}</span></div>` +
      `<h3>${T('bk_done', fmtT(t))}</h3><p>${T(stars === 3 ? 'bk_great' : stuckN ? 'bk_tipStuck' : 'bk_tip')}${rec ? ' ' + T('bk_record') : ''}</p>` +
      `<div class="row"><button type="button" class="chunky tool go">↺ ${T('again')}</button></div>`);
    o.querySelector('button').addEventListener('click', () => { UI.overlay(null); reset(); });
    hud();
  }
  function say(k) { if (said[k]) return; said[k] = true; UI.toast(T(k), 3000); }

  /* ---- drawing ---- */
  function drawScene(c) {
    const sky = c.createLinearGradient(0, 0, 0, 430); sky.addColorStop(0, '#bfe3f5'); sky.addColorStop(1, '#eef7fc');
    c.fillStyle = sky; c.fillRect(0, 0, VW, 430);
    // far hills scroll slowly
    c.fillStyle = '#cfe8c6'; c.beginPath(); c.moveTo(0, 430);
    for (let x = 0; x <= VW; x += 20) { const u = x + s * 2; c.lineTo(x, 250 - 30 * Math.sin(u / 160) - 18 * Math.sin(u / 57)); }
    c.lineTo(VW, 430); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)';
    for (let k = 0; k < 4; k++) { const x = ((k * 290 - s * 3) % 1160 + 1160) % 1160 - 100; c.beginPath(); c.ellipse(x, 60 + k * 17, 46, 14, 0, 0, TAU); c.ellipse(x + 30, 52 + k * 17, 30, 14, 0, 0, TAU); c.fill(); }
    // road
    const h0 = heightAt(s), sy = x => GROUND - (heightAt(s + (x - RX) / PXM) - h0) * PXM * VEX;
    c.fillStyle = '#9ccf85'; c.beginPath(); c.moveTo(0, 430);
    for (let x = 0; x <= VW; x += 8) c.lineTo(x, sy(x) + 4);
    c.lineTo(VW, 430); c.closePath(); c.fill();
    c.strokeStyle = '#5b6b8c'; c.lineWidth = 7; c.beginPath();
    for (let x = 0; x <= VW; x += 8) c.lineTo(x, sy(x)); c.stroke();
    // signs at each slope, and the finish line
    let a = 0;
    for (const [l, g] of COURSE) {
      const x = RX + (a - s) * PXM;
      if (g && x > -60 && x < VW + 60) {
        const y = sy(x) - 4;
        c.strokeStyle = COL.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 54); c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x, y - 98); c.lineTo(x + 28, y - 50); c.lineTo(x - 28, y - 50); c.closePath(); c.fill();
        c.lineWidth = 4; c.strokeStyle = COL.red; c.stroke();
        c.fillStyle = COL.ink; c.font = `800 14px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(pct(Math.round(g * 100)), x, y - 63);
      }
      a += l;
    }
    const fx = RX + (LEN - s) * PXM;
    if (fx < VW + 40) {
      const y = sy(fx);
      c.fillStyle = COL.ink; c.fillRect(fx - 3, y - 110, 6, 110); c.fillRect(fx + 77, y - 110, 6, 110);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? COL.ink : '#fff'; c.fillRect(fx + i * 10, y - 110 + j * 10, 10, 10); }
    }
    drawRider(c, RX, GROUND, Math.atan(gradeAt(s) * VEX));
  }

  function drawRider(c, x, y, tilt) {
    const wr = 22, wb = 74;
    c.save(); c.translate(x, y); c.rotate(-tilt);
    const back = { x: -wb / 2, y: -wr }, front = { x: wb / 2, y: -wr }, bb = { x: -4, y: -wr + 2 };
    for (const w of [back, front]) {
      c.save(); c.translate(w.x, w.y); c.rotate(wheelA);
      c.beginPath(); c.arc(0, 0, wr, 0, TAU); c.lineWidth = 5; c.strokeStyle = COL.ink; c.stroke();
      c.lineWidth = 1.2; c.strokeStyle = 'rgba(23,35,61,.6)';
      for (let k = 0; k < 8; k++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(k * TAU / 8) * wr, Math.sin(k * TAU / 8) * wr); c.stroke(); }
      c.restore();
    }
    // frame
    const seat = { x: -14, y: -66 }, bars = { x: 24, y: -70 };
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = COL.red; c.lineWidth = 5;
    c.beginPath(); c.moveTo(back.x, back.y); c.lineTo(bb.x, bb.y); c.lineTo(seat.x, seat.y + 6); c.lineTo(back.x, back.y);
    c.moveTo(bb.x, bb.y); c.lineTo(bars.x - 4, bars.y + 12); c.lineTo(seat.x + 2, seat.y + 10); c.moveTo(bars.x - 4, bars.y + 12); c.lineTo(front.x, front.y); c.stroke();
    c.strokeStyle = COL.ink; c.lineWidth = 4; c.beginPath(); c.moveTo(seat.x - 8, seat.y + 2); c.lineTo(seat.x + 8, seat.y + 2); c.moveTo(bars.x - 4, bars.y + 12); c.lineTo(bars.x, bars.y); c.lineTo(bars.x + 8, bars.y + 2); c.stroke();
    // chainring
    c.beginPath(); c.arc(bb.x, bb.y, 8, 0, TAU); c.fillStyle = '#c8ced8'; c.fill(); c.lineWidth = 2; c.stroke();
    // rider: legs follow the pedals
    const hip = { x: seat.x + 2, y: seat.y - 4 }, sh = { x: 10, y: -104 };
    const leg = (ang, near) => {
      const p = { x: bb.x + Math.cos(ang) * 12, y: bb.y + Math.sin(ang) * 12 };
      const dx = p.x - hip.x, dy = p.y - hip.y, d = Math.min(Math.hypot(dx, dy), 59), l = 30;
      const ma = Math.atan2(dy, dx), k = Math.acos(clamp(d / (2 * l), -1, 1));
      const knee = { x: hip.x + Math.cos(ma - k) * l, y: hip.y + Math.sin(ma - k) * l };
      c.strokeStyle = near ? '#2464d6' : '#1b4ea8'; c.lineWidth = 8;
      c.beginPath(); c.moveTo(hip.x, hip.y); c.lineTo(knee.x, knee.y); c.lineTo(p.x, p.y); c.stroke();
      c.strokeStyle = COL.ink; c.lineWidth = 5; c.beginPath(); c.moveTo(p.x - 5, p.y); c.lineTo(p.x + 6, p.y); c.stroke();
    };
    leg(crankA + Math.PI, false);
    c.strokeStyle = COL.sun; c.lineWidth = 12; c.beginPath(); c.moveTo(hip.x, hip.y); c.lineTo(sh.x, sh.y); c.stroke();
    c.strokeStyle = '#e0a97c'; c.lineWidth = 5; c.beginPath(); c.moveTo(sh.x, sh.y + 2); c.lineTo(bars.x + 6, bars.y); c.stroke();
    leg(crankA, true);
    c.fillStyle = '#e0a97c'; c.beginPath(); c.arc(sh.x + 8, sh.y - 12, 10, 0, TAU); c.fill();
    c.fillStyle = COL.red; c.beginPath(); c.arc(sh.x + 7, sh.y - 15, 11, Math.PI, TAU); c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 2; c.stroke();
    c.restore();
  }

  function drawPanel(c) {
    c.fillStyle = '#fff'; c.fillRect(0, 430, VW, VH - 430);
    c.strokeStyle = COL.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 431.5); c.lineTo(VW, 431.5); c.stroke();
    // drivetrain close-up
    const cr = { x: 110, y: 515 }, sp = { x: 330, y: 515 }, m = 2, z = REAR[gear];
    for (const k of REAR) if (k !== z) { c.beginPath(); c.arc(sp.x, sp.y, m * k / 2 + m, 0, TAU); c.strokeStyle = 'rgba(23,35,61,.18)'; c.lineWidth = 2; c.stroke(); }
    drawGear(c, { x: cr.x, y: cr.y, z: FRONT, m, a: crankA, col: COL.purple }, { flat: true });
    drawGear(c, { x: sp.x, y: sp.y, z, m, a: wheelA, col: COL.orange }, { flat: true });
    const r1 = m * FRONT / 2, r2 = m * z / 2, k = (r1 - r2) / (sp.x - cr.x), q = Math.sqrt(1 - k * k);
    c.strokeStyle = '#4c5568'; c.lineWidth = 4; c.setLineDash([6, 4]); c.lineDashOffset = -crankA * r1;
    c.beginPath(); c.moveTo(cr.x + r1 * k, cr.y - r1 * q); c.lineTo(sp.x + r2 * k, sp.y - r2 * q);
    c.moveTo(cr.x + r1 * k, cr.y + r1 * q); c.lineTo(sp.x + r2 * k, sp.y + r2 * q); c.stroke(); c.setLineDash([]);
    tag(c, T('mc_teeth', FRONT), cr.x, 464, { size: 13 });
    tag(c, T('mc_teeth', z), sp.x, 464, { size: 13, bg: '#ffe9d1' });
    tag(c, T('bk_ratio', ratioText(ratio(gear))), 220, 580, { size: 14, bg: '#fff8d6', border: COL.ink });
    // gear number
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = COL.ink; c.font = `800 16px ${FONT}`;
    c.fillText(T('bk_gear', gear + 1, REAR.length), 430, 456);
    for (let i = 0; i < REAR.length; i++) {
      c.fillStyle = i === gear ? COL.sun : i < gear ? '#e8ecf2' : '#fff'; rr(c, 430 + i * 25, 472, 20, 16 + i * 3, 4); c.fill();
      c.lineWidth = 2; c.strokeStyle = COL.ink; c.stroke();
    }
    // speed, legs and slope
    const kmh = v * 3.6, cad = cadence(v, gear), gr = gradeAt(s);
    c.fillStyle = COL.ink; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.font = `800 40px ${FONT}`; const sw = c.measureText(String(Math.round(kmh))).width;
    c.fillText(String(Math.round(kmh)), 660, 476); c.font = `700 16px ${FONT}`; c.fillText('km/h', 668 + sw, 484);
    c.font = `700 15px ${FONT}`; c.fillText(T('bk_slope', pct(Math.round(gr * 100))), 800, 466);
    // legs gauge with three zones
    const gx = 430, gy = 540, gw = 500, gh = 22;
    c.fillText(T('bk_legs', Math.round(Math.min(cad, CADMAX))), gx, gy - 14);
    const zones = [[0, 40, '#ffb3a8'], [40, 105, '#bfe8cf'], [105, CADMAX, '#ffd9a8']];
    for (const [a0, a1, col] of zones) { c.fillStyle = col; c.fillRect(gx + gw * a0 / CADMAX, gy, gw * (a1 - a0) / CADMAX, gh); }
    c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.strokeRect(gx, gy, gw, gh);
    c.font = `700 12px ${FONT}`; c.textAlign = 'center'; c.fillStyle = COL.ink;
    c.fillText(T('bk_zoneHard'), gx + gw * 20 / CADMAX, gy + gh + 13); c.fillText(T('bk_zoneGood'), gx + gw * 72 / CADMAX, gy + gh + 13); c.fillText(T('bk_zoneFast'), gx + gw * 118 / CADMAX, gy + gh + 13);
    const nx = gx + gw * Math.min(cad, CADMAX) / CADMAX;
    c.fillStyle = COL.ink; c.beginPath(); c.moveTo(nx, gy + 4); c.lineTo(nx - 8, gy - 8); c.lineTo(nx + 8, gy - 8); c.closePath(); c.fill();
  }

  return {
    label: () => T('bk_label'),
    enter() {
      if (phase === 'ready' || par === null) reset(); else { tools(); hud(); }
      UI.how(T('bk_howT'), T('bk_how'));
      UI.fact(T('bk_fact'), T('fact'));
    },
    exit() {},
    key(e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { shift(1); return true; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { shift(-1); return true; }
      return false;
    },
    update(dt) {
      if (phase !== 'ride') return;
      const sdt = dt * SPEEDUP, n = 5;
      for (let i = 0; i < n; i++) { v = step(v, s, gear, sdt / n); s += v * sdt / n; }
      t += sdt;
      const cad = cadence(v, gear);
      // drawn at 60 % of real speed so the turning stays visible; past the legs' top speed the rider coasts
      if (cad < CADMAX) crankA += cad / 60 * TAU * dt * 0.6;
      wheelA += v / WHEEL * dt * 0.6;
      const gr = gradeAt(s);
      if (v < 0.05 && wheelForce(0, gear) < resist(0, gr)) {
        if (!stuck) { stuckN++; Sound.nope(); } stuck += dt;
        UI.toast(T('bk_stuck'), 1200);
      } else stuck = 0;
      if (gr > 0.04 && cad < 40 && v > 0.05) say('bk_tooHard');
      if (cad > 118 && gr <= 0) say('bk_tooFast');
      if (s >= LEN) { s = LEN; finish(); }
      hud();
    },
    draw(c) {
      drawScene(c);
      if (phase === 'ride' && stuck) tag(c, '😣 ' + T('bk_ouch'), RX + 10, GROUND - 150, { size: 16, bg: '#ffe0d9', border: COL.red });
      else if (phase === 'ride' && cadence(v, gear) > 118) tag(c, '😵 ' + T('bk_spin'), RX + 10, GROUND - 150, { size: 16, bg: '#ffe9d1', border: COL.orange });
      drawPanel(c);
    },
    hover() { canvas.style.cursor = 'default'; },
    down(p) { if (phase === 'ride' && p.y < 430) shift(p.x < VW / 2 ? -1 : 1); },
    move() {}, up() {},
  };
})();
