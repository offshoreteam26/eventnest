/* =====================================================================
 * host-api.js – the host portal (EventAgent portal.py page) talks to the
 * Google Sheet through these two functions. The page's own code is kept
 * as it was; only its /host/api/... calls are answered here.
 *
 * Login session: a signed token kept in this browser (30 days).
 * ===================================================================== */
(function () {
  var KEY = 'eventnest.host.session';
  var store = {
    get: function () { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } },
    set: function (v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: works until the tab closes */ } },
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) { /* nothing saved */ } }
  };
  var memory = store.get();
  function session() { return memory || store.get(); }
  function keep(s) { memory = s; store.set(s); }

  function call(action, body) {
    return import('/js/api.js').then(function (m) { return m.Api.post(action, body); })
      .then(function (data) { if (data && data.session) keep(data.session); return Object.assign({ ok: true }, data); })
      .catch(function (err) {
        if (err.status === 401) { memory = ''; store.clear(); }
        return { ok: false, error: err.message || 'Something went wrong.' };
      });
  }

  /** The page's old server paths → the Sheet's actions. */
  window.hostApi = function (path, body) {
    var s = session();
    switch (path) {
      case '/host/api/otp/send':   return call('host_otp_send', body);
      case '/host/api/otp/verify': return call('host_otp_verify', body);
      case '/host/api/me':         return s ? call('host_me', { s: s }) : Promise.resolve({ ok: false });
      case '/host/api/name':       return call('host_name', Object.assign({ s: s }, body));
      case '/host/api/logout':     memory = ''; store.clear(); return Promise.resolve({ ok: true });
      case '/host/api/events':
        if (body === undefined) return call('host_events', { s: s });
        var fr = document.getElementById('fr');                    // optional RSVP last date (added by the form layer)
        return call('host_create', Object.assign({ s: s, rsvp_by: fr ? fr.value : '' }, body));
      default: return Promise.resolve({ ok: false, error: 'Unknown request' });
    }
  };

  /** First load: ?t= (one-tap link from the bot) or ?h=&t= (private host link) logs in; else the saved session. */
  window.hostStart = function () {
    var q = new URLSearchParams(location.search);
    var t = q.get('t'), h = q.get('h');
    if (t || h) {
      history.replaceState(null, '', location.pathname);           // the secret leaves the address bar
      return call('host_login', h ? { h: h, ht: t } : { t: t });
    }
    return window.hostApi('/host/api/me');
  };
})();
