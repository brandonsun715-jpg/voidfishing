/* Reverse tools/build-single.js.

   The build is a straight concatenation with a `/* path *\/` line in front of
   every file, so it can be taken apart again exactly. This exists because the
   source tree for a build can go missing while the build itself survives —
   which is precisely what happened — and re-typing twenty-nine thousand lines
   by hand is not a plan.

   Usage:  node tools/unbuild.js <single-file.html> [outDir]

   It writes the css/ and js/ trees and an index.html skeleton, then reports
   what it found. Verify with tools/rebuildcheck.js, which builds the result
   back up and diffs it against the file it came from. */
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
const outDir = process.argv[3] || path.join(__dirname, '..', '_unbuilt');
if (!src) {
  console.error('usage: node tools/unbuild.js <single-file.html> [outDir]');
  process.exit(1);
}

const html = fs.readFileSync(src, 'utf8');

/* Pull one <style>/<script> block out of the page. The build puts exactly one
   of each in, so the first match is the right one. */
function block(tag) {
  const open = html.indexOf('<' + tag + '>');
  if (open < 0) return null;
  const start = open + tag.length + 2;
  const end = html.indexOf('</' + tag + '>', start);
  if (end < 0) return null;
  return { body: html.slice(start, end), open: open, end: end + tag.length + 3 };
}

/* Split a concatenated block on its `/* path *\/` markers. The marker has to
   be alone on its line, or a path mentioned inside a comment would split the
   file it is describing. */
function split(body, kind) {
  const re = new RegExp('^\\/\\* (' + kind + '\\/[A-Za-z0-9_\\-./]+\\.' +
                        (kind === 'css' ? 'css' : 'js') + ') \\*\\/$', 'gm');
  const marks = [];
  let m;
  while ((m = re.exec(body)) !== null) marks.push({ file: m[1], at: m.index, after: re.lastIndex });
  return marks.map(function (mk, i) {
    const end = i + 1 < marks.length ? marks[i + 1].at : body.length;
    // drop the newline the marker sits on, and the blank line before the next
    return { file: mk.file, text: body.slice(mk.after, end).replace(/^\n/, '').replace(/\n+$/, '\n') };
  });
}

const styleBlock = block('style');
const scriptBlock = block('script');
if (!styleBlock || !scriptBlock) {
  console.error('this does not look like a built single file — no <style>/<script> block found');
  process.exit(1);
}

const cssFiles = split(styleBlock.body, 'css');
const jsFiles = split(scriptBlock.body, 'js');

if (!cssFiles.length || !jsFiles.length) {
  console.error('found the blocks but no /* path */ markers — was this built by build-single.js?');
  process.exit(1);
}

/* Rebuild index.html: the page with the two inlined blocks swapped back out
   for the tags that produced them, in the order the files appeared. */
let index = html.slice(0, styleBlock.open) +
            cssFiles.map(function (f) { return '<link rel="stylesheet" href="' + f.file + '">'; }).join('\n') +
            html.slice(styleBlock.end, scriptBlock.open) +
            jsFiles.map(function (f) { return '<script src="' + f.file + '"></script>'; }).join('\n') +
            html.slice(scriptBlock.end);

// the build strips the section comments between script tags; put the obvious ones back
index = index.replace('<script src="js/data/', '<!-- data -->\n<script src="js/data/');
index = index.replace('<script src="js/systems/', '<!-- systems -->\n<script src="js/systems/');
index = index.replace('<script src="js/render/', '<!-- render -->\n<script src="js/render/');
index = index.replace('<script src="js/audio/', '<!-- audio -->\n<script src="js/audio/');
index = index.replace('<script src="js/ui/', '<!-- ui -->\n<script src="js/ui/');
index = index.replace('<script src="js/main.js">', '<!-- boot -->\n<script src="js/main.js">');

function write(rel, text) {
  const full = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

cssFiles.forEach(function (f) { write(f.file, f.text); });
jsFiles.forEach(function (f) { write(f.file, f.text); });
write('index.html', index);

const kb = function (s) { return (Buffer.byteLength(s) / 1024).toFixed(1) + 'KB'; };
console.log('unbuilt ' + path.basename(src) + ' -> ' + path.relative(process.cwd(), outDir));
console.log('  ' + cssFiles.length + ' stylesheets, ' + jsFiles.length + ' scripts, plus index.html');
console.log('\nstylesheets:');
cssFiles.forEach(function (f) { console.log('  ' + f.file.padEnd(34) + kb(f.text)); });
console.log('\nscripts:');
jsFiles.forEach(function (f) { console.log('  ' + f.file.padEnd(34) + kb(f.text)); });
