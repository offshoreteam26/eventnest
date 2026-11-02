/* =====================================================================
 * chat.js – EventNest web chat: the same bot as WhatsApp, in the browser.
 *
 *   /chat/?e=<join_code>        a shared invitation → JOIN the event
 *   /chat/?g=<guest>&t=<sig>    a guest's personal link
 *   /chat/?h=<phone>&t=<sig>    the host's private link
 *   /chat/?start=1              create a new event straight away
 *   /chat/?text=ARRIVED%20X1    send this message once the chat opens (gate poster, website buttons)
 *   /chat/                      continue (this browser remembers you) or start fresh
 * ===================================================================== */
import { Api } from './api.js';

const $ = id => document.getElementById(id);
const chat = $('chat'), form = $('composer'), input = $('text');
const params = new URLSearchParams(location.search);
const STORE = 'eventnest.chat.v1';

const store = {
  get() { try { return JSON.parse(localStorage.getItem(STORE)) || null; } catch (e) { return null; } },
  set(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) { /* private mode: still works for this visit */ } },
  clear() { try { localStorage.removeItem(STORE); } catch (e) { /* nothing saved */ } }
};

let me = null;                     // { phone, token, name, host }
let busy = false;
const waiting = [];

/* ---------- DOM helpers ---------- */
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) n.setAttribute(k, v);
  });
  children.flat().forEach(c => n.append(c instanceof Node ? c : document.createTextNode(String(c))));
  return n;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** WhatsApp formatting: *bold*, _italic_, links. The text is escaped first, so it is safe as HTML. */
const format = s => esc(s)
  .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
  .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, '$1<i>$2</i>')
  .replace(/(https?:\/\/[^\s<]+[^\s<.,)!?])/g, (url) => `<a href="${url}" target="_blank" rel="noopener">${shortLink(url)}</a>`);
/** Long links are shown short: "calendar.google.com/…" (the full link still opens). */
function shortLink(url) {
  const plain = url.replace(/&amp;/g, '&');
  if (plain.length <= 48) return url;
  try { const u = new URL(plain); return esc(u.host + (u.pathname.length > 1 ? u.pathname.slice(0, 18) : '') + '…'); } catch (e) { return url; }
}
const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const scrollDown = () => requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });

function bubble(kind, text, time = clock()) {
  const b = el('div', { class: `msg ${kind}` });
  b.innerHTML = format(text);
  b.append(el('time', {}, time));
  chat.append(b);
  scrollDown();
  return b;
}
const note = text => bubble('note', text, '');

/* ---------- bot replies ---------- */
function showReply(r) {
  const b = bubble('bot', r.text || '');
  const options = r.buttons || r.rows;
  if (options && options.length) {
    chat.append(el('div', { class: 'chips' }, options.map(o => el('button', { type: 'button', onclick: () => send(o.id, o.title) }, o.title))));
  }
  if (r.links && r.links.length) {
    chat.append(el('div', { class: 'chips links' }, r.links.map(l => el('a', { href: l.url, target: '_blank', rel: 'noopener' }, l.title))));
  }
  if (r.pass) picture(b, 'pass', r.pass);
  if (r.card) picture(b, 'card', r.card);
  scrollDown();
}

/** The guest pass / invitation card as a picture inside the chat, with Download and Share. */
async function picture(after, kind, data) {
  const box = el('div', { class: 'msg bot picture' }, kind === 'pass' ? 'Making your pass…' : 'Making your invitation card…');
  after.after(box);
  try {
    let blob, name;
    if (kind === 'pass') {
      const { makePass } = await import('./cards/pass-card.js');
      blob = await makePass(data);
      name = `pass-${data.passNo}.jpg`;
    } else {
      const { makeCard } = await import('./cards/invite-card.js');
      blob = await makeCard(data.host, data.event, data.dateText, data.venue, data.style);
      name = 'invitation.jpg';
    }
    const url = URL.createObjectURL(blob);
    const file = new File([blob], name, { type: 'image/jpeg' });
    box.replaceChildren(
      el('img', { src: url, alt: kind === 'pass' ? `Entry pass ${data.passNo}` : 'Invitation card' }),
      el('div', { class: 'chips' },
        el('a', { href: url, download: name }, '⬇️ Download'),
        navigator.canShare && navigator.canShare({ files: [file] })
          ? el('button', { type: 'button', onclick: () => navigator.share({ files: [file] }).catch(() => {}) }, '📤 Share')
          : '')
    );
  } catch (err) {
    box.textContent = kind === 'pass' ? '🎟️ Use the "Open my pass" button to see your pass.' : '';
    if (!box.textContent) box.remove();
  }
  scrollDown();
}

function showInbox(items) {
  if (!items || !items.length) return;
  note(`📬 While you were away (${items.length})`);
  items.forEach(m => showReply({ ...m, text: m.text }));
}

/* ---------- talking to the bot ---------- */
function setReady(on) {
  input.disabled = !on;
  form.querySelector('.send').disabled = !on;
  if (on) input.focus();
}

async function send(text, shown = text) {
  if (!me || !String(text).trim()) return;
  if (busy) { waiting.push([text, shown]); return; }
  busy = true;
  bubble('me', shown);
  const typing = el('div', { class: 'typing' }, 'typing…');
  chat.append(typing);
  scrollDown();
  try {
    const out = await Api.chat(me.phone, me.token, text);
    typing.remove();
    showInbox(out.inbox);
    (out.replies || []).forEach(showReply);
    if (out.token) { me.token = out.token; store.set(me); }
  } catch (err) {
    typing.remove();
    if (err.status === 403) {
      note('⚠️ ' + err.message);
      store.clear();
      askNumber();
    } else {
      note('⚠️ ' + err.message);
    }
  } finally {
    busy = false;
    if (waiting.length) send(...waiting.shift());
  }
}

/** First visit: the number identifies the person (like WhatsApp does). */
function askNumber(message = '') {
  setReady(false);
  const phone = el('input', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: 'e.g. 9876543210', 'aria-label': 'Your WhatsApp number' });
  const err = el('div', { class: 'err', role: 'alert' }, message);
  const go = el('button', { type: 'submit' }, 'Continue');
  const box = el('form', { class: 'form' },
    el('strong', {}, '📱 Your WhatsApp number'),
    el('span', { class: 'hint' }, 'So the host can reach you and the bot remembers you. Numbers from other countries: start with +.'),
    phone, err, go);
  box.addEventListener('submit', async e => {
    e.preventDefault();
    go.disabled = true;
    err.textContent = '';
    try {
      await open({ phone: phone.value.trim() });
      box.remove();
    } catch (ex) {
      err.textContent = (ex.details && ex.details.phone) || ex.message;
      go.disabled = false;
    }
  });
  chat.append(box);
  scrollDown();
  phone.focus();
}

async function open(who) {
  const out = await Api.chatOpen(who);
  me = { phone: out.phone, token: out.token, name: out.name || '', host: !!out.host };
  store.set(me);
  $('subtitle').textContent = me.host ? 'host · ' + mask(me.phone) : (me.name ? me.name + ' · ' : '') + mask(me.phone);
  setReady(true);
  showInbox(out.inbox);
  (out.replies || []).forEach(showReply);
  afterOpen(out.replies || []);
}

const mask = p => '••••' + String(p).slice(-4);

/** Links can carry an action: JOIN an event or START a new one. It runs once, then leaves the address bar. */
function afterOpen(replies) {
  const code = params.get('e');
  const start = params.get('start');
  const say = (params.get('text') || '').trim().slice(0, 200);       // like wa.me/?text= : the gate poster (ARRIVED …) and the website buttons
  if (code || start || say || params.get('g') || params.get('h')) history.replaceState(null, '', location.pathname);
  if (code) return send(`JOIN ${code}`, `JOIN ${code}`);
  if (start) return send('START');
  if (say) return send(say);
  if (!replies.length) {
    showReply({ text: `Hi! 👋 I'm *EventNest*.\n\nInvited to an event? Open the link from your invitation.\nWant to host your own event? Tap *Create an event* — it takes 3 quick questions. 🎉`,
                buttons: [{ id: 'START', title: '✨ Create an event' }, { id: 'help', title: '❓ Help' }] });
  }
}

/* ---------- start ---------- */
form.addEventListener('submit', e => {
  e.preventDefault();
  const text = input.value.trim();
  input.value = '';
  send(text);
});
$('menu').addEventListener('click', () => { $('options').hidden = !$('options').hidden; });
$('options').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  $('options').hidden = true;
  if (b.id === 'switch') { store.clear(); location.href = location.pathname; return; }
  if (b.dataset.send) send(b.dataset.send);
});

(async function init() {
  setReady(false);
  const g = params.get('g'), h = params.get('h'), t = params.get('t');
  const saved = store.get();
  try {
    if (g && t) await open({ g, gt: t });
    else if (h && t) await open({ h, ht: t });
    else if (saved && saved.phone && saved.token) await open({ phone: saved.phone, token: saved.token });
    else askNumber();
  } catch (err) {
    store.clear();
    note('⚠️ ' + err.message);
    if (!(g || h)) askNumber();
  }
})();
