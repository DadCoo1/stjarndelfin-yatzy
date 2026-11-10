// Kompatibilitet med äldre enheter (iPad Air 2 med iPadOS 15 / Safari 15): koden får inte använda syntax,
// reguljära uttryck, funktioner eller CSS som de inte klarar. Körs utan webbläsare.
//   node tests/compat.js [mapp]      (standard: dev)
const fs = require('fs'), path = require('path');
const acorn = require(process.env.ACORN || '/home/claude/tools/node_modules/acorn');
const walk = require(process.env.ACORN_WALK || '/home/claude/tools/node_modules/acorn-walk');
const dir = path.join(__dirname, '..', process.argv[2] || 'dev');
let fails = 0; const bad = (f, m) => { console.log('✗ ' + f + ': ' + m); fails++; };
// Saknas i Safari 15 (eller kom först i 15.4+, som iPad Air 2 kanske inte har)
const MEMBERS = ['findLast', 'findLastIndex', 'toSorted', 'toReversed', 'toSpliced', 'with', 'groupBy', 'hasOwn', 'fromAsync', 'withResolvers', 'union', 'intersection', 'isDisjointFrom', 'at', 'structuredClone', 'randomUUID'];
const GLOBALS = ['structuredClone', 'BroadcastChannel', 'CompressionStream', 'DecompressionStream'];
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !/peerjs|\.min\./.test(f));
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 2021, sourceType: 'script', allowHashBang: true }); }
  catch (e) { bad(f, 'syntax som Safari 15 inte klarar: ' + e.message); continue; }
  walk.full(ast, n => {
    if (n.type === 'Literal' && n.regex) {
      if (/\(\?<[=!]/.test(n.regex.pattern)) bad(f, `lookbehind i reguljärt uttryck /${n.regex.pattern}/ (rad ${lineOf(src, n.start)})`);
      if (/[vd]/.test(n.regex.flags)) bad(f, `flagga ${n.regex.flags} i reguljärt uttryck (rad ${lineOf(src, n.start)})`);
    }
    if (n.type === 'NewExpression' && n.callee.name === 'RegExp' && n.arguments[0] && n.arguments[0].type === 'Literal' && /\(\?<[=!]/.test(String(n.arguments[0].value))) bad(f, 'lookbehind i new RegExp (rad ' + lineOf(src, n.start) + ')');
    if (n.type === 'MemberExpression' && !n.computed && n.property && MEMBERS.includes(n.property.name)) {
      // .at( och .with( är vanliga namn – flagga bara när de anropas som metod på något som ser ut som en lista/sträng
      if (['at', 'with'].includes(n.property.name)) { const p = src.slice(n.end, n.end + 1); if (p === '(') bad(f, `.${n.property.name}() finns inte i Safari 15 (rad ${lineOf(src, n.start)})`); }
      else bad(f, `.${n.property.name} finns inte i Safari 15 (rad ${lineOf(src, n.start)})`);
    }
    if (n.type === 'Identifier' && GLOBALS.includes(n.name)) bad(f, `${n.name} finns inte i Safari 15 (rad ${lineOf(src, n.start)})`);
  });
}
function lineOf(s, i) { return s.slice(0, i).split('\n').length; }
// CSS i index.html
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
for (const [re, m] of [[/color-mix\(/, 'color-mix() (Safari 16.2)'], [/@container/, '@container (Safari 16)'], [/\boklch\(|\blch\(/, 'oklch/lch (Safari 15.4)'], [/text-wrap:/, 'text-wrap (Safari 17.4)'], [/\{[^}]*&[a-z.:]/, 'CSS-nästling (Safari 16.5)']]) if (re.test(html)) bad('index.html', m);
console.log(fails ? fails + ' FEL' : `alla kompatibilitetstester ok (${files.length} filer)`);
process.exit(fails ? 1 : 0);
