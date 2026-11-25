
/* ==========================================================
   Mode 2: Gear puzzles
   Put gears on the pegs so the motor drives each machine the
   right way and at the right speed. The motor always turns
   clockwise. Levels are in content.js (LEVELS).
   ========================================================== */
const Puzzles = (() => {
  const TRAY_Y = 512, PEG_SNAP = 40, OMEGA = TAU / 4.5;
  let lv = 0, L = null, gears = [], motor = null, inv = [], sol = null, drag = null, sel = null;
  let winT = 0, won = false, jamT = 0, jamClock = 1, stall = false, lastMsg = '', lift = 0, done = new Set();
  try { (JSON.parse(localStorage.getItem('gearlab-done') || '[]')).forEach(i => done.add(i)); } catch (e) { /* storage blocked */ }
  const save = () => { try { localStorage.setItem('gearlab-done', JSON.stringify([...done])); } catch (e) { /* storage blocked */ } };

  const MNAME = { fan: 'pz_fan', ferris: 'pz_ferris', rainbow: 'pz_rainbow', winch: 'pz_winch', clock: 'pz_clock' };

  function load(i) {
    lv = clamp(i, 0, LEVELS.length - 1); L = LEVELS[lv];
    const mk = (peg, z, extra = {}) => ({ peg, z, x: L.pegs[peg][0], y: L.pegs[peg][1], a: 0, ...extra });
    motor = mk(L.motor.peg, L.motor.z, { fixed: true, col: COL.red });
    gears = [motor];
    for (const m of L.machines) if (m.z) gears.push(mk(m.peg, m.z, { fixed: true }));
    for (const [peg, z] of Object.entries(L.start || {})) gears.push(mk(+peg, z));
    inv = L.inv.slice();
    drag = sel = null; winT = 0; won = false; stall = false; lastMsg = ''; lift = 0;
    // fit every pre-placed gear's teeth with its neighbours
    for (const g of gears) if (g !== motor) { const h = gears.find(o => o !== g && meshState(o, g) === 'mesh'); if (h) alignTo(g, h); }
    resolve(true); tools();
    UI.overlay(null);
    UI.fact(tr(L.hint), T('pz_hintT'));
  }

  const gearOn = peg => gears.find(g => g.peg === peg);
  const machineOn = peg => L.machines.find(m => m.peg === peg);
  const ratioOf = g => (sol ? sol.ratio[gears.indexOf(g)] : null);

  // Checks every goal. Returns { ok, msg } where msg explains the first problem.
  function judge() {
    if (sol.jam) return { ok: false, msg: T('pz_jam') };
    for (const goal of L.goals) {
      const g = gearOn(goal.peg), m = machineOn(goal.peg), name = T(MNAME[m.kind]);
      const r = g ? ratioOf(g) : null;
      if (r === null) return { ok: false, msg: '' };
      if (goal.max !== undefined && Math.abs(r) > goal.max + 1e-9) return { ok: false, msg: T('pz_stall'), stall: true };
      if (goal.dir && Math.sign(r) !== goal.dir) return { ok: false, msg: T('pz_wrongDir', name) };
      if (goal.ratio !== undefined && Math.abs(Math.abs(r) - goal.ratio) > 1e-9)
        return { ok: false, msg: T(Math.abs(r) < goal.ratio ? 'pz_tooSlow' : 'pz_tooFast', name, ratioText(r), ratioText(goal.ratio)) };
    }
    return { ok: true, msg: '' };
  }
  function resolve(quiet) {
    sol = solveGears(gears, motor);
    const j = judge(); stall = !!j.stall;
    if (!quiet && j.msg && j.msg !== lastMsg) { UI.toast(j.msg, 3600); if (sol.jam || stall) Sound.jam(); }
    lastMsg = j.msg; winT = 0; hud();
  }

  function hud() {
    UI.hud([T('pz_level', lv + 1, LEVELS.length), ...(sol && sol.jam ? [T('ws_hudJam')] : [])]);
  }
  function tools() {
    UI.toolbar([
      { text: `🎯 ${tr(L.goal)}` },
      ...LEVELS.map((_, i) => ({ label: (done.has(i) ? '✓ ' : '') + (i + 1), pressed: i === lv, aria: T('pz_level', i + 1, LEVELS.length), click: () => { load(i); Sound.pick(); } })),
      '|',
      { icon: '↺', label: T('pz_restart'), click: () => { load(lv); Sound.drop(); } },
    ]);
  }

  const trayItems = () => inv.map((z, i) => ({ z, i, x: 92 + i * 155, y: TRAY_Y + 44 }));
  const iconR = z => 15 + z * 0.43;

  function pegAt(p) {
    let best = null, bd = PEG_SNAP;
    L.pegs.forEach(([x, y], i) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function fits(z, peg, ignore) {          // can a z-tooth gear go on this peg?
    if (gearOn(peg) && gearOn(peg) !== ignore) return false;
    const t = { x: L.pegs[peg][0], y: L.pegs[peg][1], z };
    return gears.every(g => g === ignore || g.peg === peg || meshState(t, g) !== 'clash');
  }
  function gearAt(p) {
    for (let i = gears.length - 1; i >= 0; i--) if (Math.hypot(p.x - gears[i].x, p.y - gears[i].y) < outerR(gears[i].z) + 2) return gears[i];
    return null;
  }

  function info(g) {
    sel = g; Sound.pick();
    const r = ratioOf(g);
    if (g === motor) { UI.fact(T('pz_infoMotor', g.z), T('ws_gearT', g.z)); return; }
    if (sol.jam && r !== null) { UI.fact(T('ws_jamWhy'), T('ws_jamT')); return; }
    if (r === null) { UI.fact(T('ws_infoAlone'), T('ws_gearT', g.z)); return; }
    UI.fact(T('pz_info', ratioText(r), Math.abs(r), motor.z, g.z) + ' ' + T(r > 0 ? 'cw' : 'ccw') + '.', T('ws_gearT', g.z));
  }

  function win() {
    won = true; done.add(lv); save(); tools();
    Sound.win(); FX.confetti();
    const last = lv === LEVELS.length - 1;
    const o = UI.overlay(`<div class="stars">⚙️⭐⚙️</div><h3>${T('pz_won')}</h3><p>${tr(L.why)}</p>` +
      `<div class="row"><button type="button" class="chunky tool go">${T(last ? 'pz_allDone' : 'pz_next')}</button></div>`);
    o.querySelector('button').addEventListener('click', () => { UI.overlay(null); load(last ? 0 : lv + 1); });
  }

  /* ---- machines drawn on their gear ---- */
  function drawMachine(c, m, g) {
    const x = L.pegs[m.peg][0], y = L.pegs[m.peg][1];
    if (!g) {                                            // an empty peg waiting for a gear
      c.save(); c.globalAlpha = 0.5; drawMachineFace(c, m.kind, x, y, 26, 0, 0); c.restore();
      return;
    }
    const R = pitchR(g.z) - 1.25 * MOD - 3;
    drawMachineFace(c, m.kind, x, y, R, g.a, Math.abs(ratioOf(g) || 0));
  }
  function drawMachineFace(c, kind, x, y, R, a, speed) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = '#eaf4ff'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
    c.save(); c.beginPath(); c.arc(0, 0, R - 1, 0, TAU); c.clip();
    if (kind === 'fan') {
      c.rotate(a);
      for (let k = 0; k < 3; k++) {
        c.rotate(TAU / 3); c.beginPath(); c.ellipse(R * 0.48, 0, R * 0.42, R * 0.2, 0.35, 0, TAU);
        c.fillStyle = '#9fd3f0'; c.fill(); c.lineWidth = 2; c.strokeStyle = COL.ink; c.stroke();
      }
    } else if (kind === 'ferris') {
      const W = R * 0.78;
      c.lineWidth = 2; c.strokeStyle = COL.ink;
      c.beginPath(); c.arc(0, 0, W, 0, TAU); c.stroke();
      for (let k = 0; k < 8; k++) {
        const t = a + k * TAU / 8, cx = Math.cos(t) * W, cy = Math.sin(t) * W;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(cx, cy); c.stroke();
        c.fillStyle = [COL.red, COL.sun, COL.leaf, COL.blue][k % 4];
        rr(c, cx - R * 0.11, cy, R * 0.22, R * 0.17, 3); c.fill(); c.stroke();
      }
    } else if (kind === 'rainbow') {
      const cols = ['#e23b2e', '#ff8a1f', '#ffd23f', '#23996b', '#2464d6', '#7a62c9'];
      const blur = clamp((speed - 1.2) / 2, 0, 0.8);
      c.rotate(a);
      for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, k * TAU / 6, (k + 1) * TAU / 6); c.closePath(); c.fillStyle = cols[k]; c.fill(); }
      if (blur) { c.globalAlpha = blur; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = '#f2f0ff'; c.fill(); c.globalAlpha = 1; }
    } else if (kind === 'winch') {
      c.rotate(a);
      c.beginPath(); c.arc(0, 0, R * 0.62, 0, TAU); c.fillStyle = '#c98a4b'; c.fill(); c.lineWidth = 2; c.strokeStyle = COL.ink; c.stroke();
      c.strokeStyle = 'rgba(23,35,61,.4)';
      for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(0, 0, R * (0.25 + k * 0.1), 0, TAU); c.stroke(); }
    } else if (kind === 'clock') {
      c.fillStyle = '#fff'; c.fillRect(-R, -R, 2 * R, 2 * R);
      c.strokeStyle = COL.ink;
      for (let k = 0; k < 12; k++) { const t = k * TAU / 12; c.lineWidth = k % 3 ? 2 : 4; c.beginPath(); c.moveTo(Math.cos(t) * R * 0.78, Math.sin(t) * R * 0.78); c.lineTo(Math.cos(t) * R * 0.93, Math.sin(t) * R * 0.93); c.stroke(); }
      c.rotate(a - Math.PI / 2);
      arrow(c, -R * 0.12, 0, R * 0.72, 0, COL.red, Math.max(4, R * 0.08));
    }
    c.restore();
    c.beginPath(); c.arc(0, 0, Math.max(5, R * 0.12), 0, TAU); c.fillStyle = COL.ink; c.fill();
    c.restore();
  }
  function drawCrate(c, m, g) {
    const x = L.pegs[m.peg][0], y = L.pegs[m.peg][1];
    const R = g ? pitchR(g.z) - 1.25 * MOD - 3 : 26, dr = R * 0.62;
    const top = y + Math.max(outerR(g ? g.z : 24), 60) + 10, floor = TRAY_Y - 58;
    const cy = clamp(floor - lift, top, floor);
    const rx = x - dr;
    c.save(); c.strokeStyle = '#7a5230'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(rx, y); c.lineTo(rx, cy); c.stroke();
    c.fillStyle = '#d9a35a'; rr(c, rx - 30, cy, 60, 50, 6); c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
    c.beginPath(); c.moveTo(rx - 30, cy); c.lineTo(rx + 30, cy + 50); c.moveTo(rx + 30, cy); c.lineTo(rx - 30, cy + 50); c.strokeStyle = 'rgba(23,35,61,.45)'; c.stroke();
    c.fillStyle = COL.ink; c.font = `800 14px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#fff'; rr(c, rx - 22, cy + 16, 44, 18, 5); c.fill(); c.fillStyle = COL.ink; c.fillText('500 kg', rx, cy + 26);
    c.restore();
  }

  function drawPeg(c, x, y, hot) {
    c.save();
    if (hot) { c.beginPath(); c.arc(x, y, 22, 0, TAU); c.fillStyle = 'rgba(35,153,107,.25)'; c.fill(); }
    c.beginPath(); c.arc(x, y, 10, 0, TAU); c.fillStyle = '#d3d8e1'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = COL.ink; c.stroke();
    c.beginPath(); c.moveTo(x - 5, y - 5); c.lineTo(x + 5, y + 5); c.moveTo(x + 5, y - 5); c.lineTo(x - 5, y + 5); c.lineWidth = 2; c.stroke();
    c.restore();
  }

  return {
    label: () => T('pz_label'),
    enter() {
      if (!L) { let first = 0; while (done.has(first) && first < LEVELS.length - 1) first++; load(first); }
      else { tools(); hud(); }
      UI.how(T('pz_howT'), T('pz_how'));
      UI.fact(tr(L.hint), T('pz_hintT'));
    },
    exit() { drag = null; },
    update(dt) {
      if (jamT > 0) jamT = Math.max(0, jamT - dt);
      if (sol.jam || stall) { jamClock += dt; if (jamClock > 1.6) { jamClock = 0; jamT = 0.5; } return; }
      gears.forEach((g, i) => { const r = sol.ratio[i]; if (r !== null) g.a += OMEGA * dt * r; });
      const wm = L.machines.find(m => m.kind === 'winch'), wg = wm && gearOn(wm.peg), wr = wg && ratioOf(wg);
      if (wr) lift = Math.max(0, lift + OMEGA * dt * wr * (pitchR(wg.z) - 1.25 * MOD - 3) * 0.62);
      if (!won && !drag && judge().ok) { winT += dt; if (winT > 1.8) win(); }
    },
    draw(c) {
      paper(c);
      c.fillStyle = 'rgba(255,210,63,.16)'; rr(c, 12, TRAY_Y, VW - 24, VH - TRAY_Y - 8, 18); c.fill();
      c.setLineDash([10, 8]); c.lineWidth = 2.5; c.strokeStyle = 'rgba(23,35,61,.25)'; c.stroke(); c.setLineDash([]);
      if (!inv.length) { c.fillStyle = 'rgba(23,35,61,.4)'; c.font = `700 18px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(T('pz_trayEmpty'), VW / 2, TRAY_Y + 44); }
      for (const it of trayItems()) {
        if (drag && drag.from === 'tray' && drag.i === it.i) continue;
        const R = iconR(it.z);
        drawGear(c, { x: it.x, y: it.y, z: it.z, a: -Math.PI / 2, m: 2 * R / it.z }, { marker: false, hub: 7 });
        tag(c, String(it.z), it.x + R + 14, it.y + R * 0.55, { size: 15 });
      }
      const target = drag && drag.moved ? pegAt(drag.p) : null;
      L.pegs.forEach(([x, y], i) => { if (!gearOn(i)) drawPeg(c, x, y, i === target && fits(drag.g.z, i, drag.g)); });
      for (const m of L.machines) if (!gearOn(m.peg)) drawMachine(c, m, null);
      const shake = jamT > 0 ? Math.sin(jamT * 70) * 0.05 : 0;
      gears.forEach((g, i) => {
        const bad = (sol.jam || stall) && sol.ratio[i] !== null;
        drawGear(c, bad && shake ? { ...g, a: g.a + shake } : g, { sel: g === sel, jam: bad });
        if (g === motor) { tag(c, '⚡ ' + T('pz_motor'), g.x, g.y - outerR(g.z) - 16, { size: 14, bg: COL.sun, border: COL.ink }); }
        const m = machineOn(g.peg); if (m) drawMachine(c, m, g);
      });
      for (const m of L.machines) if (m.kind === 'winch') drawCrate(c, m, gearOn(m.peg));
      if (!sol.jam && !stall) gears.forEach((g, i) => {
        const r = sol.ratio[i]; if (r === null) return;
        turnArrow(c, g.x, g.y, outerR(g.z) + 9, Math.sign(r), { span: Math.min(1.6, 70 / outerR(g.z) + 0.5) });
      });
      for (const m of L.machines) {                       // speed tag on each machine
        const g = gearOn(m.peg), r = g && ratioOf(g);
        const y = L.pegs[m.peg][1] - (g ? outerR(g.z) : 30) - 18;
        tag(c, r && !sol.jam ? `${T(MNAME[m.kind] + 'S')} ${r > 0 ? '↻' : '↺'} ×${ratioText(r)}` : T(MNAME[m.kind] + 'S'), L.pegs[m.peg][0], y, { size: 14, bg: '#fff' });
      }
      if (drag && drag.moved) {
        const pg = target, gz = drag.g.z;
        if (pg !== null) {
          const ghost = { z: gz, x: L.pegs[pg][0], y: L.pegs[pg][1], a: 0 };
          const ok = fits(gz, pg, drag.g);
          if (ok) { const h = gears.find(o => o !== drag.g && meshState(o, ghost) === 'mesh'); if (h) alignTo(ghost, h); }
          drawGear(c, ghost, { ghost: true, bad: !ok });
        } else drawGear(c, { z: gz, x: drag.p.x, y: drag.p.y, a: 0 }, { ghost: true });
      }
    },
    hover(p) { const g = gearAt(p); canvas.style.cursor = (g && !g.fixed) || (p.y > TRAY_Y && trayItems().some(t => Math.abs(p.x - t.x) < 60)) ? 'grab' : g ? 'pointer' : 'default'; },
    down(p) {
      if (won) return;
      const g = gearAt(p);
      if (g && !g.fixed) { drag = { g, from: 'board', p, sx: p.x, sy: p.y, moved: false }; canvas.style.cursor = 'grabbing'; return; }
      if (g) { info(g); return; }
      if (p.y > TRAY_Y) {
        const it = trayItems().find(t => Math.abs(p.x - t.x) < 60); if (!it) return;
        drag = { g: { z: it.z, x: p.x, y: p.y, a: 0 }, from: 'tray', i: it.i, p, sx: p.x, sy: p.y, moved: true };
        Sound.pick(); canvas.style.cursor = 'grabbing';
      }
    },
    move(p) {
      if (!drag) return;
      if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6) {
        drag.moved = true;                                 // lift the gear off its peg
        gears = gears.filter(x => x !== drag.g); resolve(true);
      }
      drag.p = p;
    },
    up() {
      if (!drag) return;
      const d = drag; drag = null; canvas.style.cursor = 'default';
      if (!d.moved) { info(d.g); return; }
      const pg = d.p.y < TRAY_Y ? pegAt(d.p) : null;
      if (pg !== null && fits(d.g.z, pg, d.g)) {
        if (d.from === 'tray') inv.splice(d.i, 1);
        gears.push(d.g); d.g.peg = pg; d.g.x = L.pegs[pg][0]; d.g.y = L.pegs[pg][1];
        const nb = gears.filter(h => h !== d.g && meshState(h, d.g) === 'mesh');
        const live = nb.find(h => ratioOf(h) !== null) || nb[0];
        if (live) alignTo(d.g, live);
        Sound.clunk(); sel = d.g; resolve();
        return;
      }
      if (pg !== null) {
        Sound.nope(); UI.toast(T(gearOn(pg) ? 'pz_taken' : 'pz_noFit'), 2400);
        if (d.from === 'board') { gears.push(d.g); resolve(true); }   // back to where it was
        return;
      }
      if (d.from === 'board') {                            // dropped off the pegs: back to the tray
        inv.push(d.g.z); if (sel === d.g) sel = null;
        Sound.drop(); lastMsg = '';
      }
    },
  };
})();
