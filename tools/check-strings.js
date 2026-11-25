// Checks that every interface text key used in src/ exists in both
// English and French, and lists keys that are defined but never used.
// Run: node tools/check-strings.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'src');
const i18n = fs.readFileSync(path.join(dir, 'i18n.js'), 'utf8');
const STRINGS = new Function('location', 'navigator', 'localStorage', i18n + '\nreturn STRINGS;')(
  { search: '' }, { language: 'en' }, { getItem: () => null });
const code = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'i18n.js')
  .map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
  + fs.readFileSync(path.join(dir, 'shell.html'), 'utf8');
const used = new Set();
for (const m of code.matchAll(/['"`]((?:ws|pz|mc|bk|qz)_[A-Za-z]+)['"`]/g)) used.add(m[1]);
for (const m of code.matchAll(/T\('(\w+)'/g)) used.add(m[1]);
for (const m of code.matchAll(/data-i18n(?:-aria)?="(\w+)"/g)) used.add(m[1]);
// keys built from pieces: 'mc_' + scene + 'T' in machines.js, MNAME[kind] + 'S' in puzzles.js
for (const s of ['chain', 'belt', 'beater', 'worm', 'rack']) ['', 'T', 'How', 'Fact'].forEach(x => used.add(`mc_${s}${x}`));
for (const k of ['fan', 'ferris', 'rainbow', 'winch', 'clock']) used.add(`pz_${k}S`);
['doc_title', 'desc', 'lang_btn', 'lang_label'].forEach(k => used.add(k));
used.delete('mc_');
let bad = 0;
for (const k of [...used].sort()) for (const l of ['en', 'fr']) if (!(k in STRINGS[l])) { console.log(`missing ${l}: ${k}`); bad++; }
for (const l of ['en', 'fr']) for (const k of Object.keys(STRINGS[l])) if (!used.has(k)) console.log(`unused ${l}: ${k}`);
const en = Object.keys(STRINGS.en), fr = Object.keys(STRINGS.fr);
for (const k of en) if (!fr.includes(k)) { console.log('only in en:', k); bad++; }
for (const k of fr) if (!en.includes(k)) { console.log('only in fr:', k); bad++; }
console.log(bad ? `${bad} problem(s)` : `All ${used.size} keys present in English and French.`);
process.exit(bad ? 1 : 0);
