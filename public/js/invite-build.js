/* =====================================================================
 * invite-build.js – the extra fields each invitation design needs.
 * A line-by-line port of EventAgent's lace_invite.build, garden_invite.build,
 * indian_invite.render and birthday_invite.render (same defaults, same words).
 *
 * `v` is the view from the API (EventService.view_ = webinvite._view).
 * `x` is EventAgent's "event extras" (hostkit.event_extras): the optional Events
 * columns couple_names, age, intro, tagline, timeline, venue_note, rsvp_text, closing,
 * dress_code and rsvp_by. Anything left empty keeps the design's own default text.
 * ===================================================================== */

export const DESIGNS = Object.freeze(['classic', 'lace', 'garden', 'indian', 'birthday', 'carnival']);

/** Which design a card style suggests when the host didn't pick one (Events tab → web_design). */
const DESIGN_FOR_STYLE = Object.freeze({
  party: 'birthday',
  festival: 'indian', toran: 'indian', mandala: 'indian',
  floral: 'lace', classic: 'lace', goldwash: 'lace',
  arch: 'garden', peach: 'garden'
});

/** ?t=<design> (for testing) → the design chosen in the Sheet → event type → a design that suits the card style → classic. */
export function pickDesign(asked, ev, v) {
  if (DESIGNS.includes(asked)) return asked;
  const chosen = String(ev.web_design || '').trim().toLowerCase();
  if (DESIGNS.includes(chosen) && chosen !== 'classic') return chosen;
  if (ev.event_type === 'birthday' || /birthday|b'?day/i.test(v.title || '')) return 'birthday';
  return DESIGN_FOR_STYLE[String(ev.card_style || '').trim()] || 'classic';
}

/* ---------- small Python helpers ---------- */
const clean = (s, n = 400) => String(s ?? '').split(/\s+/).filter(Boolean).join(' ').slice(0, n);
const titleCase = s => s.replace(/[A-Za-z]+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
const lines = s => String(s ?? '').replace(/\\n/g, '\n').split('\n');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ord = n => n + (n % 100 >= 10 && n % 100 <= 20 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
const ICONS = ['welcome', 'ceremony', 'cocktail', 'dinner', 'dancing'];

function splitNames(text) {
  const m = /\s*(?:&|\+|\band\b|\bweds\b)\s*/i.exec(text || '');
  const parts = m ? [text.slice(0, m.index), text.slice(m.index + m[0].length)] : [text || ''];
  return parts.map(p => p.trim()).filter(Boolean).slice(0, 2);
}

function namesOf(v, x) {
  const names = splitNames(clean(x.names || v.title, 80));
  if (!names.length) names.push(v.title || '');
  const initials = names.length === 2 ? names.map(n => n.slice(0, 1).toUpperCase()).join('&') : titleCase(names[0].slice(0, 2));
  return { names, initials };
}

/** EventAgent's event extras: the "good to know" rows of the view + the extra Events columns (x). */
function extrasOf(v, x = {}) {
  const byLabel = Object.fromEntries((v.extras || []).map(([label, value]) => [label, value]));
  return { end: byLabel['Ends'], dress: byLabel['Dress code'], parking: byLabel['Parking'],
           programme: byLabel['Programme'], contact: byLabel['Contact'], ...x };
}

/* ---------- lace (also the base for indian and birthday) ---------- */
const LACE_TAGLINE = 'A day to celebrate,\nfrom the first hello to the last dance.';
const LACE_TIMELINE = [
  { time: '4:30 PM', title: 'Welcome', icon: 'welcome', text: 'Arrival of guests, with drinks and hugs to greet us.' },
  { time: '5:00 PM', title: 'Ceremony', icon: 'ceremony', text: 'We say “I do” in front of the people we love.' },
  { time: '6:00 PM', title: 'Cocktail Hour', icon: 'cocktail', text: 'Aperitivo and music while the photographers capture the moment.' },
  { time: '8:00 PM', title: 'Dinner', icon: 'dinner', text: 'A long, joyful dinner filled with toasts and laughter.' },
  { time: '10:30 PM', title: 'Dancing', icon: 'dancing', text: 'The party begins – dancing and celebrating until late.' }
];

function lace(v, xx = {}) {
  const x = extrasOf(v, xx);
  const { names, initials } = namesOf(v, x);
  let dateDots = '';
  if (v.starts_iso) {
    const [y, m, d] = v.starts_iso.slice(0, 10).split('-');
    dateDots = `${d}.${m}.${y}`;
  }
  const raw = Array.isArray(x.timeline) && x.timeline.length ? x.timeline : LACE_TIMELINE;
  const timeline = raw.slice(0, 12).filter(it => it && typeof it === 'object' && (it.title || it.time)).map(it => {
    const ic = String(it.icon || '').toLowerCase();
    return { time: clean(it.time, 14), title: clean(it.title, 40), text: clean(it.text, 160), icon: ICONS.includes(ic) ? ic : 'welcome' };
  });
  const rsvpBy = clean(x.rsvp_by, 40);
  return {
    names, initials, date_dots: dateDots || v.date_text || '',
    intro: clean(x.intro, 80) || 'Together with their families',
    tagline: lines(x.tagline || LACE_TAGLINE).filter(l => l.trim()).slice(0, 3),
    notes: lines(x.venue_note).map(p => p.trim()).filter(Boolean).slice(0, 4),
    timeline,
    rsvp_text: clean(x.rsvp_text, 300) ||
      ('Nothing would make us happier than celebrating this day surrounded by our favourite people. ' +
       'Please let us know whether you’ll be able to join us' + (rsvpBy ? ` by ${rsvpBy}.` : '.')),
    music: true
  };
}

/* ---------- garden ---------- */
const GARDEN_TIMELINE = [
  { time: '4:30 PM', title: 'Guests arrive' }, { time: '5:00 PM', title: 'Ceremony' },
  { time: '6:00 PM', title: 'Drinks reception' }, { time: '7:30 PM', title: 'Dinner' },
  { time: '9:00 PM', title: 'First dance' }, { time: '10:00 PM', title: 'Dancing' }
];
const GARDEN_EXTRAS = [['end', 'Ends'], ['parking', 'Parking'], ['contact', 'Contact'], ['programme', 'Programme']];

function garden(v, xx = {}) {
  const x = extrasOf(v, xx);
  const { names, initials } = namesOf(v, x);
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v.starts_iso || '');
  let dateStack = [], longDate = v.date_text || '', schedDate = v.date_text || '', until = '', timeText = '';
  if (m) {
    const dt = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    const day = ord(dt.getDate()), month = MONTHS[dt.getMonth()], weekday = DAYS[dt.getDay()];
    dateStack = [String(dt.getDate()), month.slice(0, 3).toUpperCase(), String(dt.getFullYear())];
    longDate = `${weekday}, ${day} of ${month}, ${dt.getFullYear()}`;
    schedDate = `${weekday}, ${day} ${month}`;
    until = `UNTIL ${dt.getDate()} ${month.toUpperCase()} ${dt.getFullYear()}`;
    const h = dt.getHours() % 12 || 12;
    timeText = `${h}:${String(dt.getMinutes()).padStart(2, '0')} ${dt.getHours() < 12 ? 'AM' : 'PM'}`;
  }
  const raw = Array.isArray(x.timeline) && x.timeline.length ? x.timeline : GARDEN_TIMELINE;
  return {
    names, initials, date_stack: dateStack, long_date: longDate, time_text: timeText,
    sched_date: schedDate, until,
    timeline: raw.slice(0, 14).filter(it => it && typeof it === 'object' && (it.title || it.time))
      .map(it => ({ time: clean(it.time, 14), title: clean(it.title, 50) })),
    extras: GARDEN_EXTRAS.filter(([k]) => x[k]).map(([k, label]) => [label, clean(x[k], 150)]),
    intro: clean(x.intro, 60) || 'We’re getting married',
    closing: clean(x.closing, 120) || 'We’re so happy to celebrate this day with you.',
    rsvp_sub: clean(x.rsvp_sub, 60) || 'We hope you can make it',
    dress: clean(x.dress, 60),
    music: true
  };
}

/* ---------- indian ---------- */
const INDIAN_TIMELINE = [
  { time: '10:00 AM', title: 'Mehendi', text: 'Henna, music and laughter with the family.' },
  { time: '12:00 PM', title: 'Haldi', text: 'A golden morning of blessings.' },
  { time: '4:00 PM', title: 'Sangeet', text: 'An evening of songs, dance and joy.' },
  { time: '6:30 PM', title: 'Baraat', text: "The groom's grand arrival." },
  { time: '8:00 PM', title: 'Muhurtham', text: 'The sacred vows around the holy fire.' },
  { time: '9:30 PM', title: 'Reception & Dinner', text: 'Feast and celebrate with us.' }
];

function indian(v, x = {}) {
  const L = lace(v, x);
  if (!Array.isArray(x.timeline)) L.timeline = INDIAN_TIMELINE.map(it => ({ ...it }));
  L.tagline = ['With joy in our hearts, we invite you', 'to celebrate every moment with us.'];
  L.music = true;
  return L;
}

/* ---------- birthday ---------- */
const BIRTHDAY_TIMELINE = [
  { time: '4:00 PM', title: 'Welcome & Games', text: 'Fun games and surprises for everyone.' },
  { time: '5:30 PM', title: 'Cake Cutting', text: 'Sing along and make a wish!' },
  { time: '6:30 PM', title: 'Snacks & Dinner', text: 'Yummy treats for all.' },
  { time: '8:00 PM', title: 'Dance & Music', text: "Let's party until late." }
];

function birthday(v, x = {}) {
  const L = lace(v, x);
  if (!Array.isArray(x.timeline)) L.timeline = BIRTHDAY_TIMELINE.map(it => ({ ...it }));
  if (!x.tagline) L.tagline = ['Games, cake and lots of fun –', 'here’s how the day goes.'];
  if (!x.rsvp_text) L.rsvp_text = 'Please let us know if you can join the fun' + (x.rsvp_by ? ` by ${x.rsvp_by}.` : '.');
  L.music = true;
  const title = v.title || '';
  const H = { age: String(x.age || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 3), host: clean(v.host, 40),
              name: title.replace(/['’]s\s+birthday(\s+party)?\s*$|\s+birthday(\s+party)?\s*$/i, '').trim() || title };
  return { L, H };
}

/* ---------- carnival (birthday with circus tents; chosen with Events tab -> web_design = carnival) ---------- */
function carnival(v, x = {}) {
  const { H } = birthday(v, x);
  const C = { iso_date: '', dd: '', mm: '', yyyy: '', long: v.date_text || '', long_up: String(v.date_text || '').toUpperCase(),
              weekday: v.weekday || '', weekday_up: String(v.weekday || '').toUpperCase(), time: '', time_up: 'EVENING',
              whatsapp: String(x.whatsapp || '').replace(/\D/g, '').slice(0, 15) };
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.starts_iso || '');
  if (m) {
    const month = MONTHS[+m[2] - 1];
    Object.assign(C, { iso_date: `${m[1]}-${m[2]}-${m[3]}`, dd: m[3], mm: m[2], yyyy: m[1], long: `${+m[3]} ${month} ${m[1]}`, long_up: `${+m[3]} ${month} ${m[1]}`.toUpperCase() });
    C.time = v.time || ''; C.time_up = (v.time || 'Evening').toUpperCase();
  }
  return { H, C };
}

/** The template context for one design: { v, L } / { v, G } / { v, L, H }. */
export function contextFor(design, v, x = {}) {
  switch (design) {
    case 'lace':     return { v, L: lace(v, x) };
    case 'garden':   return { v, G: garden(v, x) };
    case 'indian':   return { v, L: indian(v, x) };
    case 'birthday': return { v, ...birthday(v, x) };
    case 'carnival': return { v, ...carnival(v, x) };
    default:         return { v };
  }
}
