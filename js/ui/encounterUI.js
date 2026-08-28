/* VOID FISHING — the encounter panel.

   Deliberately the same piece of screen as the fight bar and deliberately the
   same shape: a name, a line about what is happening, a meter when there is
   something to meter, and one instruction. An encounter is the same job as a
   fight — something is on the other end and you are being told what to do
   about it — so it should not look like a different game.

   It renders from js/systems/creature.js's view() once a frame and owns no
   state of its own beyond what it has already put in the DOM. Buttons are the
   only exception: a choice is the one place this game asks a question with
   more than one answer, and a question needs something to press. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const D = {};
  let shown = false;
  let lastText = '';
  let lastOpts = '';

  function init() {
    ['encUI', 'encName', 'encState', 'encText', 'encMeterWrap', 'encMeterFill',
     'encBand', 'encPips', 'encOptions', 'encHint'].forEach(function (id) {
      D[id] = document.getElementById(id);
    });
    VF.bus.on('creature:start', function () { show(); });
    VF.bus.on('creature:end', function () { hide(); });
  }

  function show() {
    if (!D.encUI) return;
    shown = true;
    lastText = ''; lastOpts = '';
    D.encUI.classList.remove('hidden');
    D.encUI.classList.add('enter');
    setTimeout(function () { if (D.encUI) D.encUI.classList.remove('enter'); }, 340);
    // the fight bar and this are never on screen together
    const f = document.getElementById('fightUI');
    if (f) f.classList.add('hidden');
  }

  function hide() {
    if (!D.encUI) return;
    shown = false;
    D.encUI.classList.add('hidden');
    U.clear(D.encOptions);
  }

  /* One frame of it. Every write is guarded against writing the same thing
     twice — this runs sixty times a second and setting textContent to what it
     already is still invalidates layout. */
  function tick() {
    if (!shown || !D.encUI) return;
    const v = VF.creature.view();
    if (!v) { hide(); return; }

    if (D.encName.textContent !== v.title) D.encName.textContent = v.title;

    const state = stateLabel(v);
    if (D.encState.textContent !== state) D.encState.textContent = state;

    if (v.text !== lastText) {
      lastText = v.text;
      D.encText.textContent = v.text || '';
      /* Restart the entrance so a new line reads as a new line rather than as
         the old one having changed while nobody was looking. */
      D.encText.style.animation = 'none';
      void D.encText.offsetWidth;
      D.encText.style.animation = '';
    }

    meter(v);
    pips(v);
    options(v);

    const hint = v.pickMsg || v.hint || '';
    if (D.encHint.textContent !== hint) D.encHint.textContent = hint;
    D.encHint.classList.toggle('said', !!v.pickMsg);
    D.encUI.classList.toggle('wrong', v.shake > 0.4);
  }

  function stateLabel(v) {
    switch (v.verb) {
      case 'watch': return 'observing';
      case 'track': return 'tracking · ' + Math.min(v.round + 1, Math.max(1, v.rounds)) +
                           ' of ' + Math.max(1, v.rounds);
      case 'chase': return 'pursuit';
      case 'hold': return 'holding';
      case 'swarm': return 'clearing · ' + v.cleared + ' of ' + v.total;
      case 'choose': return 'your call';
      case 'reveal': return 'it is changing';
      case 'hook': return 'on the line';
      default: return '';
    }
  }

  function meter(v) {
    const wants = v.verb === 'chase' || v.verb === 'hold' || v.verb === 'swarm' ||
                  (v.verb === 'watch' && v.dur > 0);
    D.encMeterWrap.classList.toggle('hidden', !wants);
    if (!wants) return;

    let k = 0, band = null;
    if (v.verb === 'chase') k = v.progress;
    else if (v.verb === 'hold') { k = v.bandOk; band = v.bandRange; }
    else if (v.verb === 'swarm') k = v.total ? v.cleared / v.total : 0;
    else k = v.dur ? 1 - v.left / v.dur : 0;

    D.encMeterFill.style.transform = 'scaleX(' + U.clamp(k, 0, 1).toFixed(4) + ')';

    /* The hold phase is the only one with a target rather than a goal, so it
       is the only one that draws a band — and the marker rides inside it. */
    D.encBand.classList.toggle('hidden', !band);
    if (band) {
      D.encBand.style.left = (band[0] * 100).toFixed(1) + '%';
      D.encBand.style.width = ((band[1] - band[0]) * 100).toFixed(1) + '%';
      D.encUI.style.setProperty('--enc-mark', (v.band * 100).toFixed(1) + '%');
      D.encUI.classList.add('has-mark');
      D.encUI.classList.toggle('in-band', v.band >= band[0] && v.band <= band[1]);
    } else {
      D.encUI.classList.remove('has-mark', 'in-band');
    }
  }

  /* Tracking rounds, as dots. Cheaper to read at a glance than a fraction and
     it is the only number in the encounter that the player has to act on. */
  function pips(v) {
    const want = v.verb === 'track' ? Math.max(1, v.rounds) : 0;
    if (D.encPips.childElementCount !== want) {
      U.clear(D.encPips);
      for (let i = 0; i < want; i++) D.encPips.appendChild(U.el('span', 'enc-pip'));
    }
    if (!want) return;
    const kids = D.encPips.children;
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('on', i < v.round);
  }

  function options(v) {
    const key = v.options ? v.options.map(function (o) { return o.label; }).join('|') : '';
    if (key === lastOpts) return;
    lastOpts = key;
    U.clear(D.encOptions);
    if (!v.options) return;
    v.options.forEach(function (o, i) {
      const b = U.el('button', 'enc-opt', o.label);
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        VF.creature.choose(i);
      });
      D.encOptions.appendChild(b);
    });
  }

  VF.encounterUI = { init: init, tick: tick, hide: hide };
})(window.VF = window.VF || {});
