/* =====================================================================
 * api.js – the ONLY file that talks to the backend (fetch).
 * ===================================================================== */
import { CONFIG } from './config.js';

async function call(method, action, payload = {}) {
  const url = new URL(CONFIG.API_URL);
  const init = { method };
  if (method === 'GET') {
    url.searchParams.set('action', action);
    Object.entries(payload).forEach(([key, value]) => url.searchParams.set(key, value));
  } else {
    init.headers = { 'Content-Type': 'text/plain;charset=utf-8' };   // text/plain = no CORS preflight
    init.body = JSON.stringify({ action, ...payload });
  }
  let json;
  try {
    json = await (await fetch(url, init)).json();
  } catch (networkError) {
    throw new Error('Could not reach the server. Please check your internet connection and try again.');
  }
  if (!json.ok) throw Object.assign(new Error(json.error), { status: json.status, details: json.details });
  return json.data;
}

export const Api = Object.freeze({
  invitation: code => call('GET', 'invitation', { code }),
  pass:       (p, t) => call('GET', 'pass', { p, t }),
  rsvp:       body => call('POST', 'rsvp', body),
  chatOpen:   who => call('POST', 'chat_open', who),
  chat:       (phone, token, text) => call('POST', 'chat', { phone, token, text }),
  gate:       (key, code) => call('POST', 'gate', { key, code }),
  feedback:   body => call('POST', 'feedback', body),
  luckyDraw:  (key, event_id) => call('POST', 'luckydraw', { key, event_id }),
  poster:     (key, e) => call('POST', 'poster', { key, e }),
  site:       () => call('GET', 'site'),
  post:       (action, body) => call('POST', action, body)            // host portal (js/host-api.js)
});
