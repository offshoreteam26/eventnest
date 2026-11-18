/* =====================================================================
 * invite-preview – link previews for /e/<join code>.
 *
 * WhatsApp, Facebook, Telegram … do not run the page's JavaScript, so on their
 * own they would only see "You're invited". For those robots only, this reads
 * the event from the Google Sheet and writes its name, date, venue and a
 * picture of its design into the page (EventAgent's og:title / og:description).
 * Everybody else gets the normal page straight away.
 *
 * The Google Sheet address is read from public/js/config.js, so it stays in one place.
 * ===================================================================== */
const ROBOTS = /facebookexternalhit|facebookcatalog|meta-externalagent|WhatsApp|Twitterbot|Slackbot|TelegramBot|LinkedInBot|Discordbot|SkypeUriPreview|Pinterest|redditbot|Applebot|Googlebot|bingbot|Embedly|iframely|vkShare|Viber|Snapchat|Line\//i;
const DESIGNS = ['classic', 'lace', 'garden', 'indian', 'birthday', 'carnival', 'flight'];
const FOR_STYLE = { party: 'birthday', festival: 'indian', toran: 'indian', mandala: 'indian', floral: 'lace', classic: 'lace', goldwash: 'lace', arch: 'garden', peach: 'garden' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Same choice as js/invite-build.js pickDesign. */
function designOf(ev, v, asked) {
  if (DESIGNS.includes(asked)) return asked;
  const chosen = String(ev.web_design || '').trim().toLowerCase();
  if (DESIGNS.includes(chosen) && chosen !== 'classic') return chosen;
  if (ev.event_type === 'birthday' || /birthday|b'?day/i.test(v.title || '')) return 'birthday';
  return FOR_STYLE[String(ev.card_style || '').trim()] || 'classic';
}

async function withTimeout(promise, ms) {
  let timer;
  const stop = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); });
  try { return await Promise.race([promise, stop]); } finally { clearTimeout(timer); }
}

export default async function invitePreview(request, context) {
  if (!ROBOTS.test(request.headers.get('user-agent') || '')) return context.next();
  const url = new URL(request.url);
  const code = decodeURIComponent(url.pathname.replace(/^\/e\/?/, '').split('/')[0] || '');
  if (!code || code === 'index.html' || code === 'designs') return context.next();
  const page = await context.next();
  try {
    const config = await withTimeout(fetch(new URL('/js/config.js', url)).then(r => r.text()), 3000);
    const api = (config.match(/API_URL:\s*'([^']+)'/) || [])[1];
    if (!api) return page;
    const res = await withTimeout(fetch(`${api}?action=invitation&code=${encodeURIComponent(code)}`, { redirect: 'follow' }), 8000);
    const out = await res.json();
    if (!out.ok) return page;
    const { v, ev } = out.data;
    const design = designOf(ev, v, (url.searchParams.get('t') || '').toLowerCase());
    const image = new URL(`/w/og/${design}.jpg`, url).href;
    const title = v.og_title || v.title || 'You\'re invited';
    const meta = `<title>${esc(v.title)}</title>
<meta name="description" content="${esc(v.description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="EventNest">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(v.description)}">
<meta property="og:url" content="${esc(url.origin + url.pathname)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">`;
    const html = (await page.text())
      .replace(/<title>[\s\S]*?<\/title>/, '')
      .replace(/<meta (?:name="description"|property="og:[a-z:_]+")[^>]*>\s*/g, '')
      .replace('</head>', meta + '\n</head>');
    const headers = new Headers(page.headers);
    headers.delete('content-length');
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.set('cache-control', 'public, max-age=300');
    return new Response(html, { status: 200, headers });
  } catch (err) {
    return page;                                     // the Sheet is slow or offline: the general preview is used
  }
}
