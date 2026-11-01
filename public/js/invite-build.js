/* =====================================================================
 * invite-build.js – the extra fields each invitation design needs.
 * A line-by-line port of EventAgent's lace_invite.build, garden_invite.build,
 * indian_invite.render and birthday_invite.render (same defaults, same words).
 *
 * `v` is the view from the API (EventService.view_ = webinvite._view).
 * EventAgent's "event extras" (end, dress, parking, programme, contact) come from v.extras.
 * ===================================================================== */

export const DESIGNS = Object.freeze(['classic', 'lace', 'garden', 'indian', 'birthday']);

/** Which design a card style suggests when the host didn't pick one (Events tab → web_design). */
const DESIGN_FOR_STYLE = Object.freeze({
  party: 'birthday',
  festival: 'indian', toran: 'indian', mandala: 'indian',
  floral: 'lace', classic: 'lace', goldwash: 'lace',
  arch: 'garden', peach: 'garden'
});

/** ?t=<design> (for testing) → the design chosen in the Sheet → a design that suits the card style → classic. */
export function pickDesign(asked, ev, v) {
  if (DESIGNS.includes(asked)) return asked;
  const chosen = String(ev.web_design || '').trim().toLowerCase();
  if (DESIGNS.includes(chosen) && chosen !== 'classic') return chosen;
  if (/birthday|b'?day/i.test(v.title || '')) return 'birthday';
  return DESIGN_FOR_STYLE[String(ev.card_style || '').trim()] || 'classic';
}

/* ---------- small Python helpers ---------- */
const clean = (s, n = 400) => String(s ?? '').split(/\s+/).filter(Boolean).join(' ').slice(0, n);
const titleCase = s => s.replace(/[A-Za-z]+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ord = n => n + (n % 100 >= 10 && n % 100 <= 20 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));

function splitNames(text) {
  const m = /\s*(?:&|\+|\band\b|\bweds\b)\s*/i.exec(text || '');
  const parts = m ? [text.slice(0, m.index), text.slice(m.index + m[0].length)] : [text || ''];
  return parts.map(p => p.trim()).filter(Boolean).slice(0, 2);
}

/** EventAgent's event extras, rebuilt from the "good to know" rows of the view. */
function extrasOf(v) {
  const byLabel = Object.fromEntries((v.extras || []).map(([label, value]) => [label, value]));
  return { end: byLabel['Ends'], dress: byLabel['Dress code'], parking: byLabel['Parking'],
           programme: byLabel['Programme'], contact: byLabel['Contact'] };
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

function lace(v) {
  const names = splitNames(clean(v.title, 80));
  if (!names.length) names.push(v.title || '');
  const initials = names.length === 2 ? names.map(n => n.slice(0, 1).toUpperCase()).join('&') : titleCase(names[0].slice(0, 2));
  let dateDots = '';
  if (v.starts_iso) {
    const [y, m, d] = v.starts_iso.slice(0, 10).split('-');
    dateDots = `${d}.${m}.${y}`;
  }
  return {
    names, initials, date_dots: dateDots || v.date_text || '',
    intro: 'Together with their families',
    tagline: LACE_TAGLINE.split('\n').filter(l => l.trim()).slice(0, 3),
    notes: [],
    timeline: LACE_TIMELINE.map(it => ({ ...it })),
    rsvp_text: 'Nothing would make us happier than celebrating this day surrounded by our favourite people. ' +
               'Please let us know whether you’ll be able to join us.',
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

function garden(v) {
  const x = extrasOf(v);
  const names = splitNames(clean(v.title, 80));
  if (!names.length) names.push(v.title || '');
  const initials = names.length === 2 ? names.map(n => n.slice(0, 1).toUpperCase()).join('&') : titleCase(names[0].slice(0, 2));
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
  return {
    names, initials, date_stack: dateStack, long_date: longDate, time_text: timeText,
    sched_date: schedDate, until, timeline: GARDEN_TIMELINE.map(it => ({ ...it })),
    extras: GARDEN_EXTRAS.filter(([k]) => x[k]).map(([k, label]) => [label, clean(x[k], 150)]),
    intro: 'We’re getting married',
    closing: 'We’re so happy to celebrate this day with you.',
    rsvp_sub: 'We hope you can make it',
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

function indian(v) {
  return { ...lace(v), timeline: INDIAN_TIMELINE.map(it => ({ ...it })),
           tagline: ['With joy in our hearts, we invite you', 'to celebrate every moment with us.'], music: true };
}

/* ---------- birthday ---------- */
const BIRTHDAY_TIMELINE = [
  { time: '4:00 PM', title: 'Welcome & Games', text: 'Fun games and surprises for everyone.' },
  { time: '5:30 PM', title: 'Cake Cutting', text: 'Sing along and make a wish!' },
  { time: '6:30 PM', title: 'Snacks & Dinner', text: 'Yummy treats for all.' },
  { time: '8:00 PM', title: 'Dance & Music', text: "Let's party until late." }
];

function birthday(v) {
  const L = { ...lace(v), timeline: BIRTHDAY_TIMELINE.map(it => ({ ...it })),
              tagline: ['Games, cake and lots of fun –', 'here’s how the day goes.'],
              rsvp_text: 'Please let us know if you can join the fun.', music: true };
  const title = v.title || '';
  const H = { age: '', host: clean(v.host, 40),
              name: title.replace(/['’]s\s+birthday(\s+party)?\s*$|\s+birthday(\s+party)?\s*$/i, '').trim() || title };
  return { L, H };
}

/** The template context for one design: { v, L } / { v, G } / { v, L, H }. */
export function contextFor(design, v) {
  switch (design) {
    case 'lace':     return { v, L: lace(v) };
    case 'garden':   return { v, G: garden(v) };
    case 'indian':   return { v, L: indian(v) };
    case 'birthday': return { v, ...birthday(v) };
    default:         return { v };
  }
}
