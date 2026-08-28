/* VOID FISHING — the admin console, and the door to it.

   Not in the game, and not in the game you hand to anyone. This file is the
   whole of the owner build's difference: `npm run build` leaves it out, and
   `npm run build -- --admin` puts it in. Take the file away and the door is
   not hidden, it is gone — hud.js keeps one line that asks whether this
   module is here, and in a build without it that line is the only trace.

   Getting in takes two things. The word opens the door, and the four digits
   on the authenticator open the commands behind it. The way in lasts fifteen
   minutes; the code rolls on its own every thirty.

   What that gate is worth, plainly: it is a speed bump, not a lock. The salt
   ships in this build, so anybody willing to open devtools can compute the
   code, or call straight past all of this anyway. Nothing running inside a
   page the player controls can stop the player. The lock that works is the
   build split above — this is the bolt on the inside of a door that is
   already not in their house. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const LOG_MAX = 60;

  /* ------------------------------------------------------------- settings */

  /* Where the code comes from.

     Not from anywhere. There is no mail, no key and no network call: the code
     is derived from the clock by js/core/authcode.js, which is the one
     definition of it, and the little authenticator page built by
     `node tools/build-authenticator.js` derives the same number from the same
     clock. Neither has its own copy of the maths, so the two cannot drift
     apart and leave you locked out of your own game.

     This is better than the mail it replaces in every way that matters here.
     It works offline, which a file you open from your desktop should. It
     keeps nobody's email address in the source. It cannot fail because a
     third-party service is down, rate-limited, or has quietly deleted the
     account. And there is no key in the file for somebody to lift and spend.

     What it is honestly worth is unchanged: the salt ships in the owner build,
     so anybody who opens that file's console can read it or simply call the
     unlock directly. It is a lock on a door, not a lock on a vault. The lock
     that actually works is the build split — the player build has neither this
     file nor authcode.js in it at all. */

  const WINDOW_MS = 15 * 60 * 1000;   // a code, and a way in, both last this long
  const TRIES = 5;                    // wrong codes before the door stops listening
  const LOCKOUT_MS = 5 * 60 * 1000;   // and how long it stops listening for

  /* ---------------------------------------------------------------- state */

  let log = [];            // { text, kind } — survives closing the panel
  let openUntil = 0;       // unlocked, until this moment
  let tries = TRIES;       // wrong codes left before the door stops listening
  let lockedUntil = 0;     // and when it starts listening again
  let screen = null;       // the log element on show, while the panel is up

  function now() { return Date.now(); }
  function unlocked() { return openUntil > now(); }

  /* ------------------------------------------------------------- commands */

  /* `/set jias(500)`, `/set jias 500`, `/set jias = 500` and
     `/set jias 1.2m` are all the same instruction typed by the same
     person in a hurry. */
  function number(raw) {
    if (!raw) return null;
    const s = raw.replace(/[(),=\s]/g, '').toLowerCase();
    const m = /^(-?\d+(?:\.\d+)?)([kmbtq]|qa)?$/.exec(s);
    if (!m) return null;
    const mult = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, q: 1e15 }[m[2]] || 1;
    const n = parseFloat(m[1]) * mult;
    return isFinite(n) ? n : null;
  }

  /* A save that has been through this console says so, for the rest of its
     life. save.js reads this on load: in a build without this file, a marked
     save has what it was given taken back off it. */
  function mark() {
    const d = VF.state.data;
    if (!d.flags || typeof d.flags !== 'object') d.flags = {};
    d.flags.adminTouched = true;
  }

  function grant(rod) {
    const d = VF.state.data;
    if (d.ownedRods.indexOf(rod.id) < 0) d.ownedRods.push(rod.id);
    return rod;
  }

  /* The names are written with an underscore and read with or without one,
     so `/give admin_rod` and `/give admin rod` are the same instruction. */
  const COMMANDS = [
    {
      match: /^\/give\s+admin[_\s]*rod$/,
      run: function () {
        const name = VF.rods.admin();
        if (!name) return { kind: 'bad', text: 'the admin rod is not in this build.' };
        VF.fx.shake(5, 4);
        return { kind: 'good', text: 'granted ' + name + ', and equipped it.' };
      }
    },
    {
      match: /^\/give\s+heavens[_\s]*rod$/,
      run: function () {
        const rod = VF.rods.get('heavens');
        if (!rod) return { kind: 'bad', text: 'no such rod.' };
        const d = VF.state.data;
        grant(rod);
        d.rod = rod.id;
        VF.bus.emit('rod:granted', rod);
        VF.bus.emit('gear:changed');
        return { kind: 'good', text: 'granted ' + rod.name + ', and equipped it.' };
      }
    },
    {
      match: /^\/give\s+every[_\s]*rod$/,
      run: function () {
        const d = VF.state.data;
        const before = d.ownedRods.length;
        VF.rods.list.forEach(grant);
        VF.bus.emit('gear:changed');
        const added = d.ownedRods.length - before;
        return {
          kind: 'good',
          text: added
            ? 'granted ' + added + ' rod' + (added === 1 ? '' : 's') +
              '. all ' + d.ownedRods.length + ' of them are in the bag.'
            : 'you already had all ' + d.ownedRods.length + ' of them.'
        };
      }
    },
    {
      // the old name still answers, because muscle memory outlives a rename
      match: /^\/set\s+(?:jias|brophys)\s*(.*)$/,
      run: function (m) {
        const n = number(m[1]);
        if (n === null) return { kind: 'bad', text: 'that is not a number. try /set jias(500).' };
        const d = VF.state.data;
        d.money = Math.max(0, Math.floor(n));
        VF.bus.emit('money:changed');
        return { kind: 'good', text: 'jias set to ' + U.money(d.money) + '.' };
      }
    },
    /* Put a species on the next cast.

       It arms rather than conjuring. The interesting half of a rare catch is
       the shadow coming in, the fight and the sequence that runs after it —
       a record dropped straight into the fishdex has none of that, and the
       whole reason to look at one of these is to watch it arrive.

       Takes an id or a name, because nobody remembers two hundred ids:
       `/spawn earth`, `/spawn the kraken` and `/spawn brandon_sun` are all
       the same instruction. */
    {
      match: /^\/spawn(?:\s+(.+))?$/,
      run: function (m) {
        const q = (m[1] || '').trim();
        if (!q) {
          return { kind: 'note', text: 'which one? /spawn earth — an id or a name.' };
        }
        const key = function (x) { return x.toLowerCase().replace(/[^a-z0-9]+/g, ''); };
        const want = key(q);
        let f = VF.fish.byId(q.replace(/\s+/g, '_'));
        if (!f) {
          f = VF.fish.list.find(function (x) { return key(x.id) === want; }) ||
              VF.fish.list.find(function (x) { return key(x.name) === want; }) ||
              VF.fish.list.find(function (x) { return key(x.name).indexOf(want) >= 0; });
        }
        if (!f) return { kind: 'bad', text: 'nothing in the water is called that.' };
        if (!VF.fishing.arm(f.id)) return { kind: 'bad', text: 'could not arm that one.' };
        return { kind: 'good',
                 text: f.name + ' is on the next cast. close this and cast.' };
      }
    },
    {
      match: /^\/(time|left)$/,
      run: function () {
        const left = Math.max(0, openUntil - now());
        return { kind: 'note', text: left
          ? 'this way in closes in ' + Math.ceil(left / 60000) + ' minute' +
            (Math.ceil(left / 60000) === 1 ? '' : 's') + '.'
          : 'it is already closed.' };
      }
    },
    {
      match: /^\/lock$/,
      run: function () {
        openUntil = 0;
        tries = TRIES;
        return { kind: 'note', text: 'locked. three hashes and the current code to come back.' };
      }
    },
    /* Undocumented on purpose. Nothing offers it — not the placeholder, not
       the opening line, not the error a wrong command gets, and it is not in
       its own listing. It only exists for somebody who already knows. */
    {
      match: /^\/help$/,
      run: function () {
        return { kind: 'note', text: HELP.join('\n') };
      }
    }
  ];

  const HELP = [
    '/spawn earth         puts a species on the next cast, by id or by name',
    '/give admin_rod      the one that is not in the game',
    '/give heavens_rod    the one at the end of the long thread',
    '/give every_rod      all of them, the wanderer\'s included',
    '/set jias(500)    500, or 1.2m, or 4b',
    '/time                how long this way in has left',
    '/lock                close it now'
  ];

  /* Runs one line and returns what to print. Exposed so it can be driven
     without the panel — the tests do exactly that. */
  function run(line) {
    const text = String(line || '').trim().replace(/\s+/g, ' ');
    if (!text) return null;
    if (!unlocked()) {
      return { kind: 'bad', text: 'not verified. close this and press ### again.' };
    }
    for (let i = 0; i < COMMANDS.length; i++) {
      const m = COMMANDS[i].match.exec(text.toLowerCase());
      if (m) {
        /* Marked before the command runs, not after: a command that half
           worked still changed the save, and one that threw still might. */
        mark();
        let res;
        try { res = COMMANDS[i].run(m); }
        catch (e) { res = { kind: 'bad', text: 'that went wrong: ' + e.message }; }
        VF.save.save();
        return res;
      }
    }
    return { kind: 'bad', text: 'no such command.' };
  }

  /* --------------------------------------------------------- the four digits */

  /* Checks what was typed against what the clock says it should be. There is
     nothing to expire and nothing to burn — the code rolls on its own every
     half hour whether anybody typed anything or not.

     Wrong guesses still cost. Five of them and the door stops listening for
     five minutes, which is what makes four digits worth anything at all: a
     thousand guesses an hour is a certainty, five is not. */
  function verify(entered) {
    const code = String(entered || '').replace(/\D/g, '');
    if (lockedUntil > now()) {
      const secs = Math.ceil((lockedUntil - now()) / 1000);
      return { kind: 'bad', text: 'not listening. ' + secs + 's.' };
    }
    if (code.length !== 4) return { kind: 'bad', text: 'four digits.' };
    if (!VF.authcode || !VF.authcode.accepts(code)) {
      tries--;
      if (tries <= 0) {
        tries = TRIES;
        lockedUntil = now() + LOCKOUT_MS;
        return { kind: 'bad', text: 'too many. not listening for five minutes.' };
      }
      return { kind: 'bad', text: 'not that. ' + tries + ' left.' };
    }
    tries = TRIES;
    openUntil = now() + WINDOW_MS;
    return { kind: 'good', text: 'in. this closes again in 15 minutes. /help lists the commands.' };
  }

  function push(text, kind) {
    log.push({ text: text, kind: kind || 'note' });
    if (log.length > LOG_MAX) log = log.slice(-LOG_MAX);
  }

  /* ---------------------------------------------------------------- panel */

  function submit(input, out) {
    const line = input.value;
    if (!line.trim()) return;
    /* One box, two jobs. Before the code is accepted every line typed into it
       is read as the code, so a command typed early is never half-run. */
    if (!unlocked()) {
      push('••••', 'echo');
      const v = verify(line);
      push(v.text, v.kind);
      if (v.kind === 'good') dress(input);
    } else {
      push(line.trim(), 'echo');
      const res = run(line);
      if (res) push(res.text, res.kind);
    }
    input.value = '';
    draw(out);
  }

  /* The one input tells you which of its two jobs it is doing. */
  function dress(input) {
    const locked = !unlocked();
    input.placeholder = locked ? 'the four digits' : 'type a command';
    input.setAttribute('inputmode', locked ? 'numeric' : 'text');
    input.setAttribute('maxlength', locked ? '4' : '120');
    input.className = 'con-input' + (locked ? ' con-locked' : '');
  }

  function draw(out) {
    U.clear(out);
    log.forEach(function (l) {
      const row = U.el('div', 'con-line con-' + l.kind);
      row.textContent = (l.kind === 'echo' ? '> ' : '') + l.text;
      out.appendChild(row);
    });
    out.scrollTop = out.scrollHeight;
  }

  /* Built by panels.js like any other panel, so it inherits the shell, the
     close button, the overlay and the fact that the world pauses behind it. */
  function build(shell, body) {
    const p = shell('admin', 'not in the game · nothing here is meant to be here');
    const b = body();

    const out = U.el('div', 'con-out');
    screen = out;
    b.appendChild(out);

    const form = U.el('form', 'con-form');
    const input = U.el('input', 'con-input');
    input.type = 'text';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    dress(input);
    form.appendChild(input);
    form.addEventListener('submit', function (e) { e.preventDefault(); submit(input, out); });
    // the global key handler stands down inside an input, so escape needs saying
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); VF.panels.close(); }
    });
    b.appendChild(form);
    p.appendChild(b);

    draw(out);
    setTimeout(function () { input.focus(); }, 30);
    return p;
  }

  /* ----------------------------------------------------------------- door */

  /* Opening while already verified goes straight through, and does not
     restart the fifteen minutes: the window runs from when it was opened. */
  function open() {
    VF.fx.pulse(0.25);

    if (unlocked()) {
      VF.panels.open('admin');
      return;
    }
    /* Nothing to send and nothing to wait for. The code is already true; it
       is on the authenticator page, and it has been for up to half an hour. */
    if (!VF.authcode) {
      push('this build has no authcode.js, so nothing can open.', 'bad');
    } else {
      const secs = Math.ceil(VF.authcode.remaining() / 1000);
      push('four digits, from the authenticator. this one has ' +
           Math.floor(secs / 60) + 'm ' + (secs % 60) + 's left.', 'note');
    }

    VF.audio.stinger('void', 4);
    VF.panels.open('admin');
  }

  /* Both ways in, and the letter-swallowing they need, live here rather than
     in hud.js: a build without this file then has no word to guess and no key
     sequence to find, only one line asking whether this module exists.

     Returns true when the key has been dealt with and nothing else should see
     it. hud.js calls this before its own shortcuts and before the check that
     a panel is open, so ### works with the map already up. */
  const WORD = 'admin';
  let typed = '', typedAt = 0, hashes = 0, hashAt = 0;

  function key(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) { typed = ''; hashes = 0; return false; }

    /* Three hashes in a row, quickly. `#` does nothing else in this game, so
       unlike the word below it has nothing to swallow — but it still has to
       be three in a row rather than three in a minute, or leaning on the key
       would eventually get there. */
    if (e.key === '#') {
      typed = '';
      if (now() - hashAt > 1400) hashes = 0;
      hashAt = now();
      hashes++;
      e.preventDefault();
      if (hashes < 3) return true;
      hashes = 0;
      open();
      return true;
    }
    hashes = 0;

    /* Type the word and the rod that is not in the game is in your hands —
       but only once the four digits have been in.

       It has to swallow its own letters on the way through: `m` opens the
       map, so without this you would get the map three letters in and never
       finish the word. Only letters that are still spelling it are eaten —
       press `m` on its own and the map opens exactly as before. */
    if (!/^Key[A-Z]$/.test(e.code)) { typed = ''; return false; }
    // a long pause between letters is a new word, not the middle of this one
    if (now() - typedAt > 1400) typed = '';
    typedAt = now();

    const next = typed + e.code.slice(3).toLowerCase();
    if (WORD.indexOf(next) !== 0) {
      /* Not this word any more. Keep whatever tail of it could still be the
         start of one, so `mmadmin` and a fumbled first letter both work. */
      typed = '';
      for (let i = 1; i < next.length; i++) {
        if (WORD.indexOf(next.slice(i)) === 0) { typed = next.slice(i); break; }
      }
      return typed.length > 0;
    }

    typed = next;
    e.preventDefault();
    if (typed !== WORD) return true;
    typed = '';
    /* The word is a shortcut past the console, not past the code. Unverified,
       it opens the door and asks for the four digits like anything else. */
    if (!unlocked()) { open(); return true; }
    mark();
    // the grant announces itself through rod:granted like any other rod does
    if (VF.rods.admin()) VF.fx.shake(5, 4);
    return true;
  }

  VF.adminDoor = { key: key };

  VF.adminConsole = {
    open: open, run: run, build: build, verify: verify,
    help: HELP,
    window: WINDOW_MS,
    unlocked: unlocked,
    /* what the panel is showing, for anything that wants to check */
    lines: function () { return log.slice(); },
    clear: function () { log = []; },
    /* the tests drive the gate directly */
    _code: function () { return VF.authcode ? VF.authcode.current() : null; },
    _reset: function () { log = []; openUntil = 0; tries = TRIES; lockedUntil = 0; }
  };
})(window.VF = window.VF || {});
