"""Opens dist/gear-lab.html in headless Chromium, plays through every
activity, saves screenshots to tools/screenshots/, and reports any
JavaScript errors or results that don't match the physics.

Needs: pip install playwright && playwright install chromium
Run:   python3 tools/smoke-test.py
"""
import math, pathlib, re, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'gear-lab.html').as_uri()
SHOTS = ROOT / 'tools' / 'screenshots'
SHOTS.mkdir(exist_ok=True)
errors, failures = [], []

def check(ok, what):
    print(('  ok   ' if ok else '  FAIL ') + what)
    if not ok: failures.append(what)

def line(a, b, n=12):
    return [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(n + 1)]

def circle(cx, cy, r, turns, n=48):
    return [(cx + r * math.sin(2 * math.pi * turns * i / n), cy - r * math.cos(2 * math.pi * turns * i / n)) for i in range(n + 1)]

TRAY = lambda i: (92 + i * 155, 556)
# One solution per puzzle level: gears to place, in order, as (teeth, peg position).
# A position of None means "take this gear off the board" (from that peg, back to the tray).
SOLUTIONS = [
    [(16, (492, 270))],
    [(48, (480, 168))],
    [(16, (492, 208)), (12, (559, 226))],
    [(36, (451, 140)), (36, (575, 270))],
    [('off', (441, 186))],
    [(16, (348, 250)), (24, (552, 190)), (24, (665, 231))],
    [(36, (501, 179)), (8, (585, 250))],
    [(24, (335, 242)), (16, (433, 260)), (24, (520, 210)), (48, (694, 256))],
]
INVENTORIES = [[12, 36, 16], [36, 16, 48, 36], [16, 24, 12, 16], [24, 36, 16, 36], [], [36, 24, 16, 24], [16, 12, 36, 8, 16], [36, 24, 48, 16, 36, 24]]

with sync_playwright() as p:
    browser = p.chromium.launch()

    def page(lang='en', hash_='workshop', **kw):
        pg = browser.new_page(viewport=kw.get('viewport', {'width': 1200, 'height': 1100}), **{k: v for k, v in kw.items() if k != 'viewport'})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(f'{PAGE}?lang={lang}#{hash_}'); pg.wait_for_timeout(700)
        box = pg.locator('#stage').bounding_box()
        W = lambda x, y: (box['x'] + x * box['width'] / 960, box['y'] + y * box['height'] / 600)
        def drag(path, wait=16):
            pg.mouse.move(*W(*path[0])); pg.mouse.down()
            for pt in path[1:]:
                pg.mouse.move(*W(*pt)); pg.wait_for_timeout(wait)
            pg.mouse.up()
        return pg, W, drag

    btn = lambda pg, name: pg.get_by_role('button', name=name, exact=True)
    shot = lambda pg, name: pg.locator('.stage').screenshot(path=str(SHOTS / name))

    print('Workshop')
    pg, W, drag = page()
    btn(pg, 'Count turns').click()
    drag(circle(180, 250, 43, 1.0), 10); pg.wait_for_timeout(200)
    hud = pg.inner_text('#hud')
    check('Red gear: 1 turn' in hud, f'one turn of the crank counts one turn ({hud.splitlines()[-1]})')
    drag(line(TRAY(4), (392, 252)))                                  # a 36-tooth gear next to the 12
    check('0.67' in pg.inner_text('#factText') or '⅔' in pg.inner_text('#factText'), '24 → 12 → 36 turns ⅔ as fast as the red gear')
    check('same way' in pg.inner_text('#factText'), 'the third gear turns the same way as the first')
    btn(pg, 'Motor').click(); pg.wait_for_timeout(1500); btn(pg, 'Stop').click()
    shot(pg, '1-workshop.png')
    drag(line(TRAY(2), (253, 320)))                                  # a 16 touching the red and the 12: a triangle
    pg.wait_for_timeout(300)
    check('Jammed' in pg.inner_text('#toast'), 'three gears in a triangle jam')
    shot(pg, '1-workshop-jam.png')

    print('Puzzles')
    pg, W, drag = page(hash_='puzzles')
    for n, (sol, inv) in enumerate(zip(SOLUTIONS, INVENTORIES)):
        inv = inv[:]
        for z, pos in sol:
            if z == 'off':
                drag(line(pos, (900, 560)))
            else:
                i = inv.index(z); inv.pop(i)
                drag(line(TRAY(i), pos))
            pg.wait_for_timeout(150)
        pg.wait_for_timeout(2400)
        won = pg.locator('#overlay').get_attribute('hidden') is None and ('works' in pg.inner_text('#overlay'))
        check(won, f'level {n + 1} solved')
        if n == 3: shot(pg, '2-puzzle-crane.png')
        if won: pg.locator('#overlay button').click(); pg.wait_for_timeout(300)
    check('✓ 8' in pg.inner_text('#toolbar'), 'all levels ticked off')
    pg, W, drag = page(hash_='puzzles')
    pg.get_by_role('button', name='Level 2 of 8').click(); pg.wait_for_timeout(200)
    drag(line(TRAY(0), (390, 370))); drag(line(TRAY(2), (570, 370))); pg.wait_for_timeout(300)
    check('wrong way' in pg.inner_text('#toast'), 'two gears in between make the Ferris wheel turn the wrong way')
    shot(pg, '2-puzzle-wrong.png')

    print('Machines')
    pg, W, drag = page(hash_='machines')
    drag(circle(250, 290, 58, 2.0), 8); pg.wait_for_timeout(200)
    check('Wheel 2: 4 turns' in pg.inner_text('#hud'), '32 → 16 teeth: 2 crank turns give 4 turns at the back')
    btn(pg, 'Belt').click(); btn(pg, 'Heavy load').click()
    drag(circle(250, 290, 50, 1.0), 8)
    check('slips' in pg.inner_text('#toast'), 'a heavy load makes the belt slip')
    btn(pg, 'Egg beater').click(); drag(circle(400, 190, 78, 1.0), 8)
    check('Beaters: 4 turns' in pg.inner_text('#hud'), 'egg beater: 1 crank turn gives 4 beater turns')
    btn(pg, 'Worm gear').click(); drag(circle(170, 150, 48, 3.0, 120), 6)
    check('Screw: 3 turns' in pg.inner_text('#hud') and '0.15' in pg.inner_text('#hud'), 'worm gear: 3 turns of the screw = 0.15 turn of the wheel')
    pg.mouse.click(*W(480, 300)); pg.wait_for_timeout(200)
    check('Locked' in pg.inner_text('#toast'), 'the wheel can’t turn the screw')
    shot(pg, '3-worm.png')
    btn(pg, 'Cog railway').click(); btn(pg, 'Motor').click(); pg.wait_for_timeout(16500)
    check('top' in pg.inner_text('#toast'), 'the cog railway reaches the summit')
    shot(pg, '3-rack.png')
    btn(pg, 'Toothed rail').click(); pg.wait_for_timeout(2500)
    check('slide' in pg.inner_text('#toast'), 'without the rack the train slides back')

    print('Bike ride')
    pg, W, drag = page(hash_='bike')
    pg.locator('#overlay button').click()
    COURSE = [[60, 0], [70, 0.05], [60, 0.12], [40, 0], [70, -0.08], [60, 0], [50, 0.15], [40, 0.03], [50, 0]]
    want = {0: 7, 0.05: 4, 0.12: 1, -0.08: 7, 0.15: 0, 0.03: 4}     # gear index (0 = easiest) for each slope
    gear = 3
    for _ in range(400):
        m = re.search(r'(\d+) m to go', pg.inner_text('#hud'))
        if not m or pg.locator('#overlay').get_attribute('hidden') is None: break
        done = 500 - int(m.group(1))
        a, g = 0, 0
        for l, gr in COURSE:
            if done < a + l: g = gr; break
            a += l
        while gear < want[g]: pg.keyboard.press('ArrowUp'); gear += 1
        while gear > want[g]: pg.keyboard.press('ArrowDown'); gear -= 1
        pg.wait_for_timeout(150)
    over = pg.inner_text('#overlay')
    check('Finished' in over, f'the ride can be finished ({over.splitlines()[1] if "Finished" in over else "not finished"})')
    check(over.count('⭐') >= 3 and 'Great shifting' in over, 'good shifting earns three stars')
    shot(pg, '4-bike.png')

    print('Quiz')
    pg, W, drag = page(hash_='quiz')
    for q in range(10):
        pg.locator('#toolbar button').first.click(); pg.wait_for_timeout(120)
        pg.locator('#toolbar button.go').click(); pg.wait_for_timeout(120)
    shot(pg, '5-quiz.png')
    check('out of 10' in pg.inner_text('#overlay'), 'quiz reaches a final score')

    print('French and phone')
    for m in ['workshop', 'puzzles', 'machines', 'bike', 'quiz']:
        pg, W, drag = page('fr', m)
        pg.screenshot(path=str(SHOTS / f'6-fr-{m}.png'), full_page=True)
    check(pg.inner_text('#howTitle') == 'Le quiz des engrenages', 'French text is used')
    pg, W, drag = page('fr', 'puzzles', viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg.screenshot(path=str(SHOTS / '7-phone.png'), full_page=True)
    browser.close()

print('Screenshots saved in', SHOTS)
if errors:
    print('JavaScript errors:'); [print(' ', e) for e in errors]
if errors or failures:
    sys.exit(1)
print('All checks passed, no JavaScript errors.')
