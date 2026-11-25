# Gear Lab / Labo des engrenages

A gear game for kids, built for the Physics for kids section of slashbin.net.
It runs in any modern browser, on desktop or touch screens, with no libraries,
in English and French.

**Play it:** https://www.slashbin.net/Physics-for-kids/Gears/gear-lab.html (the lesson that goes with it: [gears-lesson.html](https://www.slashbin.net/Physics-for-kids/Gears/gears-lesson.html)).

## Activities

- **Workshop / Atelier:** drag gears (8 to 48 teeth) from the tray onto the board. A gear dropped near another one snaps into place with its teeth fitted. Turn the red crank or start the motor; arrows show which way each gear turns, and **Count turns** shows how many turns each one makes. Three gears in a triangle jam.
- **Puzzles / Casse-têtes:** eight levels with pegs, a motor and machines (fan, Ferris wheel, rainbow wheel, winch, clock). Put gears on the pegs so each machine turns the right way and at the right speed: connect, make it turn the same way, twice as fast, slow enough to lift a heavy crate, unjam a triangle, drive two machines in opposite directions, three times faster, four times slower.
- **Machines / Mécanismes:** five mechanisms with a crank: sprockets and chain (three back sprockets), pulleys and belt (crossed belt, slipping under a heavy load), the bevel gears of an egg beater, a worm gear that lifts a weight and can't be turned backward, and a cog railway that slips without its rack.
- **Bike ride / Vélo:** shift between 8 gears to ride over hills. The rider always pushes as hard as possible; the right gear keeps the legs in the green zone. Stars depend on the time compared with a rider who always picks the best gear.
- **Quiz:** 10 questions, each with a picture that comes to life after the answer: a "which way?" gear train and a "how many turns?" pair made up on the spot, plus 8 picked from 12 questions.

## How it follows the Quebec science program

| Program (Science et technologie, primaire) | Where in the game |
|---|---|
| Transmission of motion: gears | Workshop, Puzzles, quiz |
| Speed changes, driver and driven gear | Workshop (tap a gear), Puzzles 3, 4, 7, 8, Bike ride |
| Direction of rotation, idler gear | Workshop arrows, Puzzles 2, 5, 6, quiz |
| Friction wheels, pulleys and belt, sprockets and chain, worm gear | Machines, quiz |
| Transformation of motion: rack and pinion | Machines (cog railway), quiz |

## Files

```
dist/gear-lab.html       The finished game: one file, ready to upload (not kept in git)
src/shell.html           Page markup and styles
src/i18n.js              All interface text in English and French, language switching
src/content.js           Facts, puzzle levels and quiz questions, in both languages
src/core.js              Shared helpers: page UI, sound, particles, drawing, gear geometry and meshing
src/workshop.js          Workshop
src/puzzles.js           Gear puzzles
src/machines.js          Chain, belt, egg beater, worm gear and cog railway
src/bike.js              Bike ride
src/quiz.js              Quiz and its pictures
src/main.js              Main loop, input, switching activities and language
build.sh                 Joins the src/ files into dist/gear-lab.html
deploy.sh                Builds, then copies the game and its readable code into a site folder
tools/check-strings.js   Checks every interface text exists in both languages
tools/check-levels.js    Checks every puzzle can be solved with the gears it gives
tools/smoke-test.py      Plays through every activity in a headless browser
```

## Building and putting it on the site

```sh
./build.sh                                    # writes dist/gear-lab.html
./deploy.sh path/to/Physics-for-kids/Gears    # builds, then copies gear-lab.html and source/*.js there
```

Edit the files in `src/`, not the built file.

- **Language:** `?lang=fr` or `?lang=en` picks the language. Without it, the game uses the browser's language, and remembers the last choice made with the FR/EN button (shared with the lesson).
- **Starting activity:** add `#workshop`, `#puzzles`, `#machines`, `#bike` or `#quiz`, for example `gear-lab.html?lang=fr#puzzles`.

The page loads the Baloo 2 font from Google Fonts and falls back to system fonts if that's blocked. Solved puzzle levels, the best bike time and the language choice are kept in the browser's localStorage; if storage is blocked, the game still works.

## Changing the content

- Interface text is in `src/i18n.js`, under `en` and `fr`. Keep both in step, then run `node tools/check-strings.js`.
- Facts (`FACTS`), puzzle levels (`LEVELS`) and quiz questions (`QUIZ`) are in `src/content.js`, each with `en` and `fr` text.
- In `LEVELS`, two gears mesh when their centres are 2.5 × (teeth 1 + teeth 2) pixels apart (the module is 5 px). Run `node tools/check-levels.js` after editing: it tries every way of placing the tray's gears.
- In `QUIZ`, `answer` is the position of the right choice (0 = first). Choices are shuffled in each game unless the question has `keep: true`.

French text gets non-breaking spaces before `:` `%` `$` and inside « » automatically.

## Testing

```sh
node tools/check-strings.js
node tools/check-levels.js
pip install playwright && playwright install chromium
./build.sh && python3 tools/smoke-test.py
```

The smoke test solves all eight puzzles with the mouse, checks the turn counts (1 crank turn of the 32-tooth sprocket gives 2 turns of the 16, the egg beater turns 4 times faster, 3 turns of the worm give 0.15 turn of the 20-tooth wheel), drives the cog railway to the top, and rides the bike course to three stars.

## How the physics works

- **Gears** have a pitch radius of module × teeth ÷ 2. Two gears mesh when their centres are the sum of their pitch radii apart; closer than that (or with their tips bumping) they can't be placed. Turning one gear by an angle turns its neighbour by −angle × teeth₁ ÷ teeth₂. The game spreads these ratios through every meshing gear; a gear asked to turn two ways at once (an odd loop) jams the whole set.
- **Chains and belts** keep both wheels turning the same way, with the same ratio as gears; a crossed belt reverses the second wheel; a heavy load makes the belt slip (the second pulley turns at 30 % of its speed).
- **The worm gear** moves its 20-tooth wheel by one tooth per turn of the screw, and can't be driven from the wheel.
- **The bike** has a 40-tooth chainring and 8 sprockets (32 to 10 teeth). The rider pushes the pedals with a force that falls from 520 N when the legs are still to 0 at 130 turns per minute. The force on the road is pedal force × 0.17 m crank ÷ (gear ratio × 0.34 m wheel), against gravity on the slope, rolling resistance and air. The course runs 2.5 times faster than real time.

## License

MIT, see [LICENSE](LICENSE).
