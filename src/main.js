
/* ==========================================================
   Main loop, input, modes, language
   ========================================================== */
const MODES = { workshop: Workshop, puzzles: Puzzles, machines: Machines, bike: Bike, quiz: Quiz };
let mode = Workshop, modeName = 'workshop';

function resize() {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}
if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
resize();

function toWorld(e) { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) * VW) / r.width, y: ((e.clientY - r.top) * VH) / r.height }; }
let activePointer = null;
canvas.addEventListener('pointerdown', e => {
  if (activePointer !== null) return;
  activePointer = e.pointerId;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  Sound.ensure(); mode.down(toWorld(e)); e.preventDefault();
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId === activePointer) mode.move(toWorld(e));
  else if (activePointer === null && e.pointerType === 'mouse') mode.hover(toWorld(e));
});
const endPointer = e => { if (e.pointerId !== activePointer) return; activePointer = null; mode.up(toWorld(e)); };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || !mode.key) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (mode.key(e)) e.preventDefault();
});

function setMode(name) {
  if (!MODES[name]) name = 'workshop';
  if (activePointer !== null) { mode.up({ x: 0, y: 0 }); activePointer = null; }
  if (mode.exit) mode.exit();
  UI.overlay(null); FX.clear(); $('#toast').classList.remove('show');
  mode = MODES[name]; modeName = name;
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === name)));
  canvas.setAttribute('aria-label', mode.label());
  canvas.style.cursor = 'default';
  mode.enter();
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { Sound.ensure(); setMode(b.dataset.mode); }));
window.addEventListener('hashchange', () => { const n = location.hash.slice(1); if (MODES[n] && n !== modeName) setMode(n); });

$('#soundBtn').addEventListener('click', e => {
  Sound.ensure(); const on = Sound.toggle();
  e.currentTarget.textContent = on ? '🔊' : '🔇'; e.currentTarget.setAttribute('aria-pressed', String(on));
});
$('#nextFact').addEventListener('click', () => showFact(1));
$('#langBtn').addEventListener('click', () => {
  setLang(lang === 'fr' ? 'en' : 'fr');
  UI.overlay(null); $('#toast').classList.remove('show');
  canvas.setAttribute('aria-label', mode.label());
  mode.enter();
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
  mode.update(dt); FX.update(dt);
  ctx.setTransform(canvas.width / VW, 0, 0, canvas.height / VH, 0, 0);
  ctx.clearRect(0, 0, VW, VH);
  mode.draw(ctx); FX.draw(ctx);
  requestAnimationFrame(frame);
}
applyStatic();
setMode(location.hash.slice(1));
requestAnimationFrame(frame);
