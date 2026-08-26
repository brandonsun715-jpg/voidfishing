/* Builds the little page that tells you the code on the admin door.

     node tools/build-authenticator.js

   It inlines js/core/authcode.js verbatim — the same file the game checks
   against — so the two cannot drift apart. There is no second copy of the
   maths anywhere, which is the entire point: a page that computed the code
   its own way would eventually disagree with the game and lock you out with
   nothing on screen to explain why.

   The result is one self-contained HTML file with no network access of any
   kind. Put it on a phone, open it offline, read the four digits. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const SRC = 'js/core/authcode.js';
const authcode = fs.readFileSync(path.join(root, SRC), 'utf8');

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>void fishing &mdash; authenticator</title>
<meta name="theme-color" content="#04060a">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    display: grid; place-items: center;
    background: #04060a; color: #e9eff6;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    text-transform: lowercase;
    -webkit-font-smoothing: antialiased;
    padding: 24px;
  }
  main { text-align: center; width: min(420px, 100%); }
  h1 {
    font-size: 12px; font-weight: 400; letter-spacing: 0.34em;
    color: rgba(233,239,246,0.36); margin: 0 0 34px;
  }
  .code {
    font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums;
    font-size: clamp(56px, 22vw, 92px);
    letter-spacing: 0.16em;
    text-indent: 0.16em;   /* the tracking is on the right of the last digit too */
    line-height: 1;
    color: #e9eff6;
    text-shadow: 0 0 34px rgba(127,168,200,0.42);
  }
  .track {
    height: 2px; margin: 30px auto 12px; width: 100%;
    background: rgba(255,255,255,0.09); border-radius: 2px; overflow: hidden;
  }
  .fill {
    height: 100%; width: 100%;
    background: linear-gradient(90deg, rgba(127,168,200,0.30), #7fa8c8);
    transform-origin: left center;
    transition: transform 240ms linear;
  }
  .left {
    font-family: ui-monospace, Menlo, monospace; font-size: 12px;
    color: rgba(233,239,246,0.36); letter-spacing: 0.08em;
    font-variant-numeric: tabular-nums;
  }
  .note {
    margin-top: 40px; font-size: 11.5px; line-height: 1.7;
    color: rgba(233,239,246,0.30); max-width: 34ch;
    margin-left: auto; margin-right: auto;
  }
  .warn { color: rgba(255,195,106,0.62); }
  @media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
</style>
</head>
<body>
<main>
  <h1>void fishing</h1>
  <div class="code" id="code" aria-live="polite">&mdash;&mdash;&mdash;&mdash;</div>
  <div class="track"><div class="fill" id="fill"></div></div>
  <div class="left" id="left">&nbsp;</div>
  <p class="note">
    type this at the admin door. it changes every thirty minutes, and the one
    before and after are accepted too, so the two clocks do not have to agree
    exactly.
  </p>
  <p class="note warn">
    this page derives the code from the clock. it does not talk to anything,
    and it works with no connection.
  </p>
</main>
<script>
/* ${SRC} — inlined verbatim by tools/build-authenticator.js */
${authcode}
</script>
<script>
(function () {
  'use strict';
  var VF = window.VF;
  var codeEl = document.getElementById('code');
  var fillEl = document.getElementById('fill');
  var leftEl = document.getElementById('left');

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function tick() {
    var code = VF.authcode.current();
    if (codeEl.textContent !== code) codeEl.textContent = code;
    var ms = VF.authcode.remaining();
    var secs = Math.ceil(ms / 1000);
    fillEl.style.transform = 'scaleX(' + (ms / VF.authcode.WINDOW_MS).toFixed(4) + ')';
    leftEl.textContent = Math.floor(secs / 60) + ':' + pad(secs % 60) + ' left';
  }

  tick();
  setInterval(tick, 250);
  /* A phone that slept through a rollover comes back showing the old code
     until the next interval; waking is the moment it matters most. */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') tick();
  });
})();
</script>
</body>
</html>
`;

const out = path.join(root, 'dist', 'authenticator.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);

console.log('wrote', path.relative(root, out),
            (fs.statSync(out).size / 1024).toFixed(1) + 'KB');
console.log('  inlined ' + SRC + ' verbatim — the game and this page cannot disagree.');
console.log('  current code: ' + (function () {
  // derive it here the same way, as a build-time sanity check
  const sandbox = { window: {} };
  new Function('window', authcode)(sandbox.window);
  return sandbox.window.VF.authcode.current();
})());
