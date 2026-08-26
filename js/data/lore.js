/* VOID FISHING — what you learn by catching the same thing repeatedly.

   Every species has one description, shown from the first catch, and after
   that the Fishdex entry never changes. A second and third paragraph, earned
   at ten and at fifty, give the record a reason to be revisited and give the
   writing somewhere else to go.

   Deliberately not for everything. Two hundred and fourteen species times two
   more paragraphs is four hundred and twenty-eight, and there is only one way
   to produce four hundred and twenty-eight paragraphs quickly, which is the
   way that got two hundred and fifty species cut. So this is written for the
   ones where a second look is actually worth writing — the wrong tier, the
   ones with a person in them, the ones that are already about something — and
   a species with nothing written for it shows nothing. The Fishdex does not
   promise a paragraph it does not have.

   Adding more is a writing job, not an engineering one. The shape is here. */
(function (VF) {
  'use strict';

  /* Ten, then fifty. Ten is a species you have fished for; fifty is one you
     have a relationship with. */
  const AT = [10, 50];

  const LORE = {
    /* ---------------------------------------------------- the shore
       The first thing anybody catches, and the last thing anybody looks at. */
    smallmouth: [
      'You have caught enough of these to notice they are not identical. The band ' +
      'behind the gill is different every time, the way a thumbprint is.',
      'Fifty of them. You know now that they come in closer when the light goes, ' +
      'that they take a badly cast line more often than a good one, and that ' +
      'nothing else in the water pays them the slightest attention. It is possible ' +
      'to spend a life being ignored and be perfectly all right.'
    ],

    /* ---------------------------------------------------- the tier that is not fish */
    g_chair: [
      'The same chair. Not a chair of that kind — that chair, with the same ' +
      'scuff on the same leg, coming up on the same hook.',
      'You have brought it up fifty times and put it back fifty times, and it has ' +
      'never once been wet.'
    ],
    g_boot: [
      'It is always the left one. You have started keeping count and it is always ' +
      'the left one.',
      'Fifty left boots, and they are all the same size, and it is your size.'
    ],
    g_tea: [
      'Still hot. Not warm — the temperature of a cup somebody put down a minute ' +
      'ago and is coming back for.',
      'You drank one, once. It was very good tea. You have thought about that ' +
      'more than you would like to.'
    ],
    g_door: [
      'It stands open on the surface of the water and there is water on the other ' +
      'side of it as well, and the two waters are at different heights.',
      'The fiftieth time, it was closed. It has been open every time since. ' +
      'You have not worked out what to do with that.'
    ],
    g_key: [
      'It fits your front door. You have checked. It fits your front door and you ' +
      'have never brought your keys fishing.',
      'The other forty-nine fit doors you have never seen. You are fairly sure of ' +
      'this, and you are not sure how you are sure.'
    ],
    g_tv: [
      'Warm on the back, the way one is after a long evening. Nothing on it.',
      'Fifty of them and not one has ever shown anything, but the warmth is always ' +
      'the same warmth, which is the warmth of something that was on until very ' +
      'recently.'
    ],
    g_yourself: [
      'It is you, fishing. Not a likeness — the posture is yours, including the ' +
      'thing you do with your shoulder that you have never seen from outside.',
      'You have landed fifty of these and every one of them was doing what you had ' +
      'been doing about a minute earlier. You have tried changing what you do. ' +
      'It does not help; it just means the next one does that instead.'
    ],
    g_error: [
      'The record has a shape for this and no content to put in it.',
      'Fifty times. The Fishdex counts them, which means something counted them, ' +
      'which means there was something there to count.'
    ],

    /* ---------------------------------------------------- the deep ones */
    long_dark: [
      'You do not see the whole of one. You see a length of time during which ' +
      'the water below you is not water.',
      'Fifty, and you are now reasonably sure that some of them were the same one ' +
      'twice. There is no way to be certain and you are certain anyway.'
    ],
    thousand_eye: [
      'It has been watching this spot longer than you have been sitting at it, ' +
      'and it was watching before you arrived.',
      'You have stopped finding it unsettling, which you suspect was the point of ' +
      'the first forty-nine.'
    ],

    /* ---------------------------------------------------- and the two at the top */
    nessie: [
      'There is only one. The record says otherwise; the record is a record of ' +
      'occasions, not of animals.',
      'Ten times, fifty times, it makes no difference. It is the same one and it ' +
      'has never once been surprised to see you.'
    ],
    oscar_brophy: [
      'He was down there. He is not now, and he does not appear to have been ' +
      'anywhere else in between.',
      'Fifty times. He has never spoken and he has never been anything other than ' +
      'entirely dry, and the money still has his name on it, whatever they are ' +
      'calling it this year.'
    ]
  };

  /* How many paragraphs this species has earned, given how many are caught. */
  function unlocked(id, caught) {
    const l = LORE[id];
    if (!l) return [];
    const out = [];
    for (let i = 0; i < l.length && i < AT.length; i++) {
      if (caught >= AT[i]) out.push({ at: AT[i], text: l[i] });
    }
    return out;
  }

  /* And the next one, if there is one, so the record can say it is coming. */
  function next(id, caught) {
    const l = LORE[id];
    if (!l) return null;
    for (let i = 0; i < l.length && i < AT.length; i++) {
      if (caught < AT[i]) return AT[i];
    }
    return null;
  }

  VF.lore = {
    AT: AT,
    has: function (id) { return !!LORE[id]; },
    unlocked: unlocked,
    next: next,
    count: function (id) { return LORE[id] ? LORE[id].length : 0; }
  };
})(window.VF = window.VF || {});
