/* =====================================================================
 * invite-page.js – the animated web invitation:  /e/<join code>
 *
 * 1. reads the event from the Google Sheet (API: invitation)
 * 2. picks the design (Events tab → web_design, or one that suits the event; ?t=lace to try another)
 * 3. fills EventAgent's own page template (public/e/designs/*.html) and shows it
 * 4. the RSVP form inside the template posts to the Sheet; a "yes" gets the pass picture with QR
 * ===================================================================== */
import { Api } from './api.js';
import { pickDesign } from './invite-build.js';
import { renderPage } from './invite-render.js';

const params = new URLSearchParams(location.search);
const fromPath = location.pathname.replace(/^\/e\/?/, '').split('/')[0];
const code = decodeURIComponent(fromPath && fromPath !== 'index.html' ? fromPath : (params.get('code') || params.get('e') || '')).trim();

/** The RSVP form's answer, in EventAgent's shape ({ok, errors, status, title, msg, pass_url …}). */
async function rsvp(body) {
  let j;
  try {
    j = { ok: true, ...(await Api.rsvp({ ...body, code })) };
  } catch (err) {
    if (!err.status) throw err;                                   // no internet → the design says "No connection"
    j = { ok: false, errors: err.details || { _: err.message } };
  }
  if (j.ok && j.status === 'yes') {
    j.pass_page = j.pass_url;                                     // the pass page link (kept for later)
    j.pass_url = '';
    if (j.pass) {
      try {
        const { makePass } = await import('./cards/pass-card.js');
        j.pass_url = URL.createObjectURL(await makePass(j.pass));
      } catch (e) { /* the pass number is still shown */ }
    }
  }
  return j;
}

function notFound(message) {
  document.title = 'Invitation not found';
  const h = document.createElement('h1');
  const p = document.createElement('p');
  h.textContent = message || 'This invitation link is not valid';
  p.textContent = 'Check the link you received, or ask the host to send it again.';
  document.body.className = 'nf';
  document.body.replaceChildren(h, p);
}

(async function start() {
  if (!code) return notFound();
  let data;
  try {
    data = await Api.invitation(code);
  } catch (err) {
    return notFound(err.status ? err.message : 'Could not open the invitation. Please check your internet and try again.');
  }
  try {
    const design = pickDesign((params.get('t') || '').toLowerCase(), data.ev, data.v);
    await renderPage({ design, v: data.v, x: data.ev.x || {}, back: true, rsvp });
  } catch (err) {
    console.error(err);
    notFound('Could not show the invitation. Please try again.');
  }
})();
