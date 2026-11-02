/* =====================================================================
 * invite-render.js – shows one of EventAgent's invitation designs as the
 * whole page. Used by the real invitation (/e/<code>), the free demos
 * (/demo/<design>) and the live previews in the host portal (/host/preview/).
 *
 *   renderPage({ design, v, x, back, rsvp, auto, y })
 *     v      the view (EventService.view_ = webinvite._view)
 *     x      event extras (optional Events columns)
 *     back   add EventAgent's floating Back button
 *     rsvp   (body) => Promise<answer>   what the RSVP form inside the design calls
 *     auto   keep the invitation open (no cover) and scroll to y – the portal preview while typing
 * ===================================================================== */
import { render } from './jinja-lite.js';
import { contextFor } from './invite-build.js';

/* webinvite.THEMES / STYLE_THEME – the Classic design's colours follow the card style */
export const THEMES = Object.freeze({
  pasupu: { 'cover-bg': '#F2B632', 'cover-ink': '#3E0F26', page: '#FFF8E7', ink: '#3E0F26', muted: '#6E4B5A', accent: '#A3123A', 'accent-ink': '#FFFFFF', tint: '#FCE9B0', line: '#E7CF8F' },
  royal:  { 'cover-bg': '#172646', 'cover-ink': '#F1E2AE', page: '#EEF2F8', ink: '#172646', muted: '#4F5E7A', accent: '#172646', 'accent-ink': '#F1E2AE', tint: '#DCE4F2', line: '#BFCBE0' },
  blush:  { 'cover-bg': '#F1B7C4', 'cover-ink': '#52122C', page: '#FFF4F6', ink: '#3F1223', muted: '#7A4A5B', accent: '#8E1F45', 'accent-ink': '#FFFFFF', tint: '#FBDDE4', line: '#EBC3CD' },
  party:  { 'cover-bg': '#FF8A2A', 'cover-ink': '#20104A', page: '#F2EFFF', ink: '#20104A', muted: '#5A5384', accent: '#20104A', 'accent-ink': '#FFFFFF', tint: '#DFD9FF', line: '#C9C1F2' },
  serene: { 'cover-bg': '#0F4C4A', 'cover-ink': '#F5E3B5', page: '#EAF5F2', ink: '#0B3433', muted: '#3F6A67', accent: '#0F4C4A', 'accent-ink': '#FFFFFF', tint: '#CFE8E2', line: '#B3D6CE' }
});
const STYLE_THEME = { festival: 'pasupu', toran: 'pasupu', mandala: 'pasupu', royal: 'royal', navygold: 'royal', goldcorner: 'royal',
                      classic: 'blush', floral: 'blush', arch: 'blush', peach: 'blush', goldwash: 'blush', party: 'party', house: 'serene', islamic: 'serene' };
export const themeFor = cardStyle => THEMES[STYLE_THEME[String(cardStyle || '').trim()] || 'blush'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const two = n => String(n).padStart(2, '0');
const clock = d => `${d.getHours() % 12 || 12}:${two(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
const isoLocal = d => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}:00`;

/** 'Raghu Function Hall , Tadipatri' → ['Raghu Function Hall', 'Tadipatri'] (hostkit.split_venue) */
export function splitVenue(v) {
  const s = String(v || '').split(/\s+/).filter(Boolean).join(' ').replace(/\s+([,.;:])/g, '$1').replace(/,(?=\S)/g, ', ');
  const i = s.indexOf(',');
  return i < 0 ? [s.trim(), ''] : [s.slice(0, i).trim(), s.slice(i + 1).replace(/^[\s,]+|[\s,]+$/g, '')];
}

/** The same view the server makes (webinvite._view), for an event that is not saved: previews and demos. */
export function sampleView({ code = 'PREVIEW', title, host = '', venue = '', start, cardStyle = '', maps = '', dateText, venueSplit = true,
                             calendar = true, description, pageUrl = '' }) {
  const [vname, vaddr] = venueSplit ? splitVenue(venue) : [venue.split(',')[0], venue.split(',').slice(1).join(',').trim() || venue];
  const fmt = d => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  const mapUrl = maps || (venue ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(venue) : '');
  const f = d => `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}T${two(d.getHours())}${two(d.getMinutes())}00`;
  const cal = calendar === true && start
    ? 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) +
      `&dates=${f(start)}/${f(new Date(start.getTime() + 3 * 3600000))}&location=${encodeURIComponent(venue)}` +
      `&details=${encodeURIComponent('Invitation from ' + host)}&ctz=Asia/Kolkata`
    : (calendar || '');
  return {
    code, title, host, theme: themeFor(cardStyle),
    day: start ? start.getDate() : '', weekday: start ? DAYS[start.getDay()] : '',
    month_year: start ? `${MONTHS[start.getMonth()]} ${start.getFullYear()}` : '', time: start ? clock(start) : '',
    date_text: dateText ?? (start ? `${fmt(start)}, ${clock(start)}` : ''), has_date: !!start, starts_iso: start ? isoLocal(start) : '',
    venue_name: vname, venue_addr: vaddr, maps: mapUrl, calendar: cal, extras: [], closed: false, closed_msg: '', cc: '91',
    og_title: title, description: description ?? 'Invitation preview', og_image: '', page_url: pageUrl
  };
}

const text = url => fetch(url, { cache: 'no-cache' }).then(r => {
  if (!r.ok) throw new Error('missing ' + url);
  return r.text();
});

/** Draws the design as this whole page (the design's own scripts and animations run as in EventAgent). */
export async function renderPage({ design, v, x = {}, back = false, rsvp, auto = false, y = 0 }) {
  const [template, backUi] = await Promise.all([text(`/e/designs/${design}.html`), back ? text('/e/designs/back.html') : '']);
  let html = render(template, contextFor(design, v, x));
  if (back) {
    const end = html.lastIndexOf('</body>');
    if (end >= 0) html = html.slice(0, end) + backUi + html.slice(end);
  }
  if (auto) {                                    // portal preview while typing: no cover, no fullscreen, same scroll position
    html = html.replace('rf = de.requestFullscreen || de.webkitRequestFullscreen', 'rf = null')
      .replace(/<audio[^>]*>\s*<\/audio>|<audio[^>]*>/, '<audio id="bgm" loop>')
      .replace('</head>', '<style>.cover{display:none!important}</style><script>document.addEventListener("DOMContentLoaded",function(){' +
        'document.body.classList.remove("locked");var s=document.getElementById("shell");if(s)s.classList.remove("locked");' +
        `setTimeout(function(){scrollTo(0,${Number(y) || 0})},80)})</script></head>`);
  }
  window.ENFetch = (_, init) => (async () => {
    const answer = await rsvp(JSON.parse((init && init.body) || '{}'));
    return { json: async () => answer };
  })();
  document.open();
  document.write(html);
  document.close();
}

/* ---------- the sample pass the demos show (demo._pass_svg, same picture) ---------- */
const DEMO_QR = '111111101111101111111111111110010111111111111111110110111111111111111110000111111111111111100011101111111111111100010001111111111111111001111111111111011001010000111000110000001011111001000111110001001000011010011001110010001011000010011110111011001000011110110010001011000001000010100001000111111111100100101100110111111111001000111011111111101101100010101111111111111101011111111111111010001000111111111100111111100010111111101111111100000';
const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function demoPassSvg(name, people, meal, title) {
  const cells = [...DEMO_QR].map((b, i) => b === '1' ? `<rect x="${110 + (i % 21) * 6}" y="${300 + Math.floor(i / 21) * 6}" width="6" height="6"/>` : '').join('');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><rect width="360" height="480" rx="18" fill="#fffaf5"/>' +
    '<rect x="10" y="10" width="340" height="460" rx="12" fill="none" stroke="#b98a4a"/><g font-family="Georgia,serif" text-anchor="middle" fill="#5c1a24">' +
    `<text x="180" y="52" font-size="13" letter-spacing="3" fill="#b98a4a">ENTRY PASS</text><text x="180" y="100" font-size="26">${xml(title.slice(0, 24))}</text>` +
    `<text x="180" y="150" font-size="14" fill="#6b5359">Pass issued to</text><text x="180" y="182" font-size="24" font-style="italic">${xml(name.slice(0, 22))}</text>` +
    `<text x="180" y="240" font-size="44">ADMIT ${people}</text><text x="180" y="268" font-size="14" fill="#6b5359">${xml(meal)}</text></g>` +
    `<g fill="#2a1218">${cells}</g><text x="180" y="458" text-anchor="middle" font-size="12" font-family="monospace" fill="#6b5359">TA-DEMO-00001</text></svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

/** demo.rsvp: the same thank-you and a sample pass. Nothing is saved or sent. */
export function demoRsvp(d) {
  const OK = /[^A-Za-z0-9 &.,'\-ఀ-౿]/g;
  const ans = ['yes', 'maybe', 'no'].includes(String(d.answer || d.status || 'yes').toLowerCase()) ? String(d.answer || d.status || 'yes').toLowerCase() : 'yes';
  const name = String(d.name || 'Guest').replace(OK, '').slice(0, 30) || 'Guest';
  const fn = name.split(' ')[0];
  const a = Math.max(0, Math.min(parseInt(d.adults, 10) || 1, 20)), k = Math.max(0, Math.min(parseInt(d.kids, 10) || 0, 20));
  const meal = String(d.meal || 'Veg').replace(OK, '').slice(0, 12) || 'Veg';
  const out = { ok: true, status: ans, name };
  if (ans === 'yes') {
    Object.assign(out, { title: 'You’re registered 🎉', pass_url: demoPassSvg(name, Math.max(1, a + k), meal, 'Demo Event'),
      msg: `Thank you, ${fn}! This is a demo, so nothing was saved. Real guests get this entry pass on the page and on WhatsApp.` });
  } else if (ans === 'maybe') Object.assign(out, { title: `Thank you, ${fn}!`, msg: 'Noted as maybe. (Demo: nothing was saved.)' });
  else Object.assign(out, { title: `Thank you, ${fn}.`, msg: 'Noted. (Demo: nothing was saved.)' });
  return out;
}

/** portal.MOCK: the preview's RSVP form answers without saving anything. */
export function previewRsvp(b) {
  const ok = b.name && b.phone && b.answer;
  return ok ? { ok: true, status: b.answer, people: (b.adults || 0) + (b.kids || 0), meal: 'Veg', phone: String(b.phone).slice(-4), name: b.name, pass_no: 'PREVIEW' }
            : { ok: false, errors: { name: 'Preview only: fill name, number and a choice.' } };
}
