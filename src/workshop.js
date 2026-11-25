
/* ==========================================================
   Mode 1: Workshop
   Drag gears from the tray onto the board. A gear dropped near
   another one snaps into place so their teeth mesh. Turn the red
   crank (or switch on the motor) and watch directions and speeds.
   ========================================================== */
const Workshop = (() => {
  const TRAY_Y = 512, MAX = 12, SNAP = 30;
  const OMEGA = TAU / 5;                          // motor: one turn every 5 s
  const opt = { motor: false, arrows: true, count: false, dir: 1 };
  let gears = [], driver = null, sol = null, drag = null, sel = null, crank = null;
  let jamT = 0, jamToast = false, moving = 0, turned = false, teeth = 0, spin = 1;

  const mk = (z, x, y) => ({ z, x, y, a: 0, turns: 0 });
  function reset() {
    driver = mk(24, 180, 250); driver.col = COL.red;
    const g = mk(12, 180 + pitchR(24) + pitchR(12), 250);
    alignTo(g, driver);
    gears = [driver, g]; sel = drag = crank = null; turned = false;
    resolve(); resetTurns();
  }
  function resolve() { sol = solveGears(gears, driver); if (!sol.jam) jamToast = false; hud(); }
  function resetTurns() { for (const g of gears) g.turns = 0; hud(); }

  const trayItems = () => SIZES.map((z, i) => ({ z, x: 92 + i * 155, y: TRAY_Y + 44 }));
  const iconR = z => 15 + z * 0.43;               // pitch radius of a tray icon

  function hud() {
    const chips = [T('ws_hudGears', gears.length)];
    if (opt.count) chips.push(T('ws_hudTurns', Math.floor(driver.turns + 1e-6)));
    if (sol && sol.jam) chips.push(T('ws_hudJam'));
    UI.hud(chips);
  }

  function tools() {
    UI.toolbar([
      { icon: opt.motor ? '⏸' : '▶', label: T(opt.motor ? 'ws_stop' : 'ws_motor'), click: () => { opt.motor = !opt.motor; if (opt.motor) tryJam(); tools(); }, cls: opt.motor ? '' : 'go', id: 'motor' },
      { icon: '⇄', label: T('ws_reverse'), click: () => { opt.dir = -opt.dir; UI.toast(T(opt.dir > 0 ? 'ws_nowCw' : 'ws_nowCcw'), 1800); } },
      '|',
      { icon: '↻', label: T('ws_arrows'), toggle: true, pressed: opt.arrows, click: () => (opt.arrows = !opt.arrows) },
      { icon: '🔢', label: T('ws_count'), toggle: true, pressed: opt.count, click: () => { opt.count = !opt.count; resetTurns(); tools(); return opt.count; } },
      ...(opt.count ? [{ icon: '0️⃣', label: T('ws_zero'), click: resetTurns }] : []),
      '|',
      { icon: '🗑️', label: T('ws_clear'), click: () => { gears = [driver]; sel = null; resolve(); UI.toast(T('ws_cleared'), 1800); Sound.drop(); } },
    ]);
  }

  // Turns the driver by da radians; every connected gear follows at its own ratio.
  function turnBy(da) {
    if (!sol || sol.jam) return false;
    gears.forEach((g, i) => { const r = sol.ratio[i]; if (r !== null) { g.a += da * r; g.turns += Math.abs(da * r) / TAU; } });
    if (da) spin = Math.sign(da);
    teeth += Math.abs(da) * driver.z / TAU;
    if (teeth >= 3) { teeth = 0; Sound.tick(); }
    moving = 0.6;
    turned = true;
    if (opt.count) hud();
    return true;
  }
  function tryJam() {
    if (!sol || !sol.jam) return;
    jamT = 0.45; Sound.jam();
    if (!jamToast) { jamToast = true; UI.toast(T('ws_jam'), 3800); UI.fact(T('ws_jamWhy'), T('ws_jamT')); }
  }

  // Where gear g would land if dropped at p: it snaps to mesh with one gear,
  // or with two at once when it is close to touching both.
  function circleX(a, ra, b, rb, p) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (!d || d > ra + rb || d < Math.abs(ra - rb)) return null;
    const k = (ra * ra - rb * rb + d * d) / (2 * d), h = Math.sqrt(Math.max(0, ra * ra - k * k));
    const xm = a.x + k * dx / d, ym = a.y + k * dy / d;
    const P1 = { x: xm + h * dy / d, y: ym - h * dx / d }, P2 = { x: xm - h * dy / d, y: ym + h * dx / d };
    return Math.hypot(P1.x - p.x, P1.y - p.y) < Math.hypot(P2.x - p.x, P2.y - p.y) ? P1 : P2;
  }
  function placeAt(g, p) {
    const cands = [];
    for (const h of gears) {
      if (h === g) continue;
      const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy) || 1, s = pitchR(g.z) + pitchR(h.z);
      if (Math.abs(d - s) < SNAP) cands.push({ x: h.x + dx / d * s, y: h.y + dy / d * s, h, err: Math.abs(d - s) });
    }
    cands.sort((a, b) => a.err - b.err);
    let pos = cands[0] || { x: p.x, y: p.y, h: null };
    for (let i = 0; i < Math.min(3, cands.length); i++) for (let j = i + 1; j < Math.min(3, cands.length); j++) {
      const A = cands[i].h, B = cands[j].h;
      const X = circleX(A, pitchR(g.z) + pitchR(A.z), B, pitchR(g.z) + pitchR(B.z), p);
      if (X && Math.hypot(X.x - p.x, X.y - p.y) < SNAP * 1.3) { pos = { x: X.x, y: X.y, h: A }; i = j = 9; }
    }
    const r = pitchR(g.z);
    let ok = pos.x > r - 10 && pos.x < VW - r + 10 && pos.y > r - 10 && pos.y < TRAY_Y - r + 6;
    const t = { x: pos.x, y: pos.y, z: g.z };
    if (ok) for (const h of gears) if (h !== g && meshState(t, h) === 'clash') { ok = false; break; }
    return { x: pos.x, y: pos.y, h: pos.h, ok };
  }

  function gearAt(p) {
    for (let i = gears.length - 1; i >= 0; i--) if (Math.hypot(p.x - gears[i].x, p.y - gears[i].y) < outerR(gears[i].z) + 2) return gears[i];
    return null;
  }
  const onCrank = p => { const h = crankPos(driver); return Math.hypot(p.x - h.x, p.y - h.y) < 24; };
  const inTray = p => p.y > TRAY_Y - 4;

  function info(g) {
    sel = g; Sound.pick();
    const i = gears.indexOf(g), r = sol.ratio[i];
    if (g === driver) { UI.fact(T('ws_infoDriver', g.z), T('ws_gearT', g.z)); return; }
    if (sol.jam && r !== null) { UI.fact(T('ws_jamWhy'), T('ws_jamT')); return; }
    if (r === null) { UI.fact(T('ws_infoAlone'), T('ws_gearT', g.z)); return; }
    const a = Math.abs(r), cmp = a > 1 + 1e-9 ? 'ws_faster' : a < 1 - 1e-9 ? 'ws_slower' : 'ws_same';
    UI.fact(T('ws_info', ratioText(r), a, driver.z, g.z) + ' ' + T(cmp) + ' ' + T(r > 0 ? 'ws_sameWay' : 'ws_otherWay'), T('ws_gearT', g.z));
  }

  function drawTray(c) {
    c.fillStyle = 'rgba(255,210,63,.16)'; rr(c, 12, TRAY_Y, VW - 24, VH - TRAY_Y - 8, 18); c.fill();
    c.setLineDash([10, 8]); c.lineWidth = 2.5; c.strokeStyle = 'rgba(23,35,61,.25)'; c.stroke(); c.setLineDash([]);
    for (const it of trayItems()) {
      const R = iconR(it.z);
      drawGear(c, { x: it.x, y: it.y, z: it.z, a: -Math.PI / 2, m: 2 * R / it.z }, { marker: false, hub: 7 });
      tag(c, String(it.z), it.x + R + 14, it.y + R * 0.55, { size: 15 });
    }
  }

  return {
    label: () => T('ws_label'),
    enter() {
      if (!gears.length) reset();
      tools(); hud(); showFact();
      UI.how(T('ws_howT'), T('ws_how'));
    },
    exit() { drag = crank = null; },
    update(dt) {
      if (jamT > 0) jamT = Math.max(0, jamT - dt);
      if (moving > 0) moving = Math.max(0, moving - dt);
      if (opt.motor && !crank) {
        if (sol.jam) { if (jamT <= 0) tryJam(); }
        else turnBy(OMEGA * opt.dir * dt);
      }
    },
    draw(c) {
      paper(c);
      drawTray(c);
      const shake = jamT > 0 ? Math.sin(jamT * 70) * 0.05 : 0;
      gears.forEach((g, i) => {
        if (drag && drag.g === g) return;
        const jam = sol.jam && sol.ratio[i] !== null;
        const gg = jam && shake ? { ...g, a: g.a + shake } : g;
        drawGear(c, gg, { crank: g === driver, sel: g === sel, jam });
      });
      if (opt.arrows && (moving > 0 || opt.motor) && !sol.jam) {
        gears.forEach((g, i) => {
          const r = sol.ratio[i]; if (r === null || (drag && drag.g === g)) return;
          turnArrow(c, g.x, g.y, outerR(g.z) + 10, Math.sign(r * spin), { span: Math.min(1.6, 70 / outerR(g.z) + 0.5) });
        });
      }
      if (opt.count) gears.forEach((g, i) => {
        if (sol.ratio[i] === null || (drag && drag.g === g)) return;
        tag(c, T('ws_turns', Math.floor(g.turns + 1e-6)), g.x, g.y + outerR(g.z) + 16, { size: 14, bg: '#fff8d6' });
      });
      if (!turned && !opt.motor && !drag) {             // "turn me" hint next to the crank
        const h = crankPos(driver);
        c.save(); c.setLineDash([6, 6]); turnArrow(c, h.x, h.y, 34, 1, { span: 2.4, at: -Math.PI / 2, col: 'rgba(23,35,61,.55)', w: 3.5 }); c.restore();
        tag(c, T('ws_turnMe'), h.x, h.y - 58, { size: 16, bg: COL.sun, border: COL.ink });
      }
      if (drag && drag.moved) {
        const pl = placeAt(drag.g, drag.p);
        if (inTray(drag.p)) drawGear(c, { ...drag.g, x: drag.p.x, y: drag.p.y }, { ghost: true });
        else {
          if (!pl.ok) drawGear(c, { ...drag.g, x: drag.p.x, y: drag.p.y }, { ghost: true, bad: true });
          else {
            const ghost = { ...drag.g, x: pl.x, y: pl.y };
            if (pl.h) alignTo(ghost, pl.h);
            drawGear(c, ghost, { ghost: !pl.h });
          }
        }
      }
    },
    hover(p) {
      canvas.style.cursor = onCrank(p) ? 'grab' : (gearAt(p) && gearAt(p) !== driver) || (inTray(p) && gears.length < MAX) ? 'grab' : gearAt(p) ? 'pointer' : 'default';
    },
    down(p) {
      if (onCrank(p)) {
        crank = { a: Math.atan2(p.y - driver.y, p.x - driver.x) };
        canvas.style.cursor = 'grabbing'; Sound.pick(); return;
      }
      const g = gearAt(p);
      if (g && g !== driver) {
        drag = { g, p, sx: p.x, sy: p.y, ox: p.x - g.x, oy: p.y - g.y, moved: false, isNew: false, from: { x: g.x, y: g.y } };
        canvas.style.cursor = 'grabbing'; return;
      }
      if (g === driver) { info(g); return; }
      if (inTray(p)) {
        const it = trayItems().find(t => Math.abs(p.x - t.x) < 70);
        if (!it) return;
        if (gears.length >= MAX) { UI.toast(T('ws_tooMany'), 2200); Sound.nope(); return; }
        const ng = mk(it.z, p.x, p.y);
        drag = { g: ng, p, sx: p.x, sy: p.y, ox: 0, oy: 0, moved: true, isNew: true };
        Sound.pick(); canvas.style.cursor = 'grabbing';
      }
    },
    move(p) {
      if (crank) {
        const a = Math.atan2(p.y - driver.y, p.x - driver.x), da = wrapA(a - crank.a);
        crank.a = a;
        if (sol.jam) { if (Math.abs(da) > 0.02 && jamT <= 0) tryJam(); return; }
        turnBy(da);
        return;
      }
      if (drag) {
        if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6 && !drag.moved) {
          drag.moved = true;
          gears = gears.filter(x => x !== drag.g); resolve();
        }
        if (drag.moved) drag.p = { x: p.x - drag.ox, y: p.y - drag.oy };
      }
    },
    up() {
      if (crank) { crank = null; canvas.style.cursor = 'grab'; return; }
      if (!drag) return;
      const d = drag; drag = null; canvas.style.cursor = 'default';
      if (!d.moved) { info(d.g); return; }
      if (inTray(d.p)) { if (!d.isNew) { Sound.drop(); UI.toast(T('ws_removed'), 1500); } if (sel === d.g) sel = null; return; }
      const pl = placeAt(d.g, d.p);
      if (!pl.ok) {
        Sound.nope(); UI.toast(T('ws_noRoom'), 2200);
        if (!d.isNew) { d.g.x = d.from.x; d.g.y = d.from.y; gears.push(d.g); resolve(); }
        return;
      }
      d.g.x = pl.x; d.g.y = pl.y;
      // fit the teeth with a neighbour, preferably one that is already turning with the driver
      const nb = gears.filter(h => meshState(d.g, h) === 'mesh');
      const live = nb.find(h => sol.ratio[gears.indexOf(h)] !== null) || nb[0];
      if (live) alignTo(d.g, live);
      gears.push(d.g); resolve();
      if (nb.length) Sound.clunk(); else Sound.drop();
      const r = sol.ratio[gears.indexOf(d.g)];
      if (sol.jam) tryJam();
      else if (!nb.length) UI.toast(T('ws_alone'), 2200);
      else if (r !== null) info(d.g);
    },
  };
})();
