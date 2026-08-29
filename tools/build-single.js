/* Inlines every stylesheet and script into one self-contained index file.
   Classic scripts concatenate in order, so this is a straight substitution.

     node tools/build-single.js            the game you hand to anybody
     node tools/build-single.js --admin    the same game, with the door in it

   The difference is not a flag the player build carries and ignores. The
   owner build has two files the player build does not have at all —
   js/core/authcode.js and js/ui/console.js, plus css/console.css — and the
   handful of lines elsewhere that reach for them are cut out between
   `/* @admin-only *\/` and `/* @end-admin *\/`. Take those away and there is
   no word to guess, no key sequence to find and no salt to read: the door is
   not hidden, it is absent. That is the lock that actually works. The four
   digits are a bolt on the inside of a door that is already not in the
   player's house. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const admin = process.argv.slice(2).some(a => a === '--admin' || a === '-a');

/* The files that exist only in the owner build. */
const ADMIN_ONLY = ['js/core/authcode.js', 'js/ui/console.js', 'css/console.css'];

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const css = (html.match(/<link rel="stylesheet" href="([^"]+)">/g) || [])
  .map(tag => tag.match(/href="([^"]+)"/)[1]);
const js = (html.match(/<script src="([^"]+)"><\/script>/g) || [])
  .map(tag => tag.match(/src="([^"]+)"/)[1]);

const keep = f => admin || ADMIN_ONLY.indexOf(f) < 0;
const cssKeep = css.filter(keep);
const jsKeep = js.filter(keep);

/* Cut the marked spans. The markers are not always alone on their line — one
   of them opens mid-expression and the closer carries the ` };` that has to
   survive — so this matches marker to marker rather than line to line, and
   keeps whatever sat either side of them. */
function stripAdmin(text, file) {
  const opens = (text.match(/\/\* @admin-only \*\//g) || []).length;
  const closes = (text.match(/\/\* @end-admin \*\//g) || []).length;
  if (opens !== closes) {
    throw new Error(file + ': ' + opens + ' @admin-only vs ' + closes +
                    ' @end-admin — unbalanced, refusing to build a half-cut file');
  }
  return text.replace(/[ \t]*\/\* @admin-only \*\/[\s\S]*?\/\* @end-admin \*\//g, '');
}

/* In the owner build the markers themselves are noise; drop the marker lines
   and keep everything between them. */
function dropMarkers(text) {
  return text.replace(/^[ \t]*\/\* @(?:admin-only|end-admin) \*\/[ \t]*\n/gm, '')
             .replace(/[ \t]*\/\* @(?:admin-only|end-admin) \*\//g, '');
}

function read(f) {
  const text = fs.readFileSync(path.join(root, f), 'utf8');
  return admin ? dropMarkers(text) : stripAdmin(text, f);
}

/* Concatenating stylesheets makes one silent mistake fatal that was harmless
   as separate files: a sheet that ends inside an unclosed block. On its own,
   the browser closes it at end-of-file and nothing is wrong. Concatenated, the
   NEXT sheet is swallowed into that block — and it fails quietly, with the
   rules parsing fine and simply applying under some media query nobody meant.
   That is exactly how the aquarium shipped with no styling at all: panels.css
   ended inside `@media (max-width: 780px) {`.

   Comments are blanked rather than removed so the line number is the real one. */
function checkBalanced(text, file) {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const stack = [];
  let line = 1;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '\n') line++;
    else if (c === '{') stack.push(line);
    else if (c === '}') {
      if (!stack.length) {
        throw new Error(file + ':' + line + ': a closing brace with nothing open — ' +
                        'refusing to build a stylesheet that would swallow the next one');
      }
      stack.pop();
    }
  }
  if (stack.length) {
    throw new Error(file + ':' + stack[0] + ': this block is never closed — ' +
                    'on its own that is invisible, concatenated it eats every ' +
                    'stylesheet that follows. Refusing to build.');
  }
}

const styles = cssKeep.map(f => {
  const text = read(f);
  checkBalanced(text, f);
  return '/* ' + f + ' */\n' + text;
}).join('\n');
const scripts = jsKeep.map(f => '/* ' + f + ' */\n' + read(f)).join('\n');

// drop the individual tags, then inject the combined blocks
html = html.replace(/<link rel="stylesheet" href="[^"]+">\n?/g, '');
html = html.replace(/<!-- [a-z ]+ -->\n?(?=<script src=)/g, '');
html = html.replace(/<script src="[^"]+"><\/script>\n?/g, '');
html = html.replace('</head>', '<style>\n' + styles + '\n</style>\n</head>');
html = html.replace('</body>', '<script>\n' + scripts + '\n</script>\n</body>');

const out = path.join(root, 'dist', admin ? 'void-fishing-admin.html' : 'void-fishing.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);

/* Say plainly which one this is, because handing out the wrong file is the
   whole thing this split exists to prevent. */
console.log('wrote', path.relative(root, out),
            (fs.statSync(out).size / 1024).toFixed(0) + 'KB',
            '(' + cssKeep.length + ' stylesheets, ' + jsKeep.length + ' scripts inlined)');
console.log(admin
  ? '  OWNER BUILD — has the door, the code and the salt in it. Do not hand this one out.'
  : '  player build — no authcode.js, no console.js, no salt. There is no door in this file.');

if (!admin) {
  // a belt-and-braces check that nothing leaked through a missed marker
  const leaked = ['adminConsole', 'adminDoor', 'VF.authcode', 'void-fishing/admin/']
    .filter(s => html.indexOf(s) >= 0);
  if (leaked.length) {
    console.error('  !! these should not be in a player build:', leaked.join(', '));
    process.exit(1);
  }
}
