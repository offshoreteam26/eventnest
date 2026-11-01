/* =====================================================================
 * jinja-lite.js – renders EventAgent's Jinja templates in the browser,
 * so the invitation designs stay exactly as they were in Python.
 *
 * Supported (everything the EventAgent templates use):
 *   {{ expr }}                         HTML-escaped output, like Flask
 *   {% if %} {% elif %} {% else %} {% endif %}
 *   {% for x in list %} / {% for a, b in pairs %} / {% for k, v in dict.items() %} {% endfor %}
 *   loop.index, loop.index0, loop.first, loop.last, loop.length
 *   and / or / not with Python truthiness ([] and {} are false), range(n), (a, b) tuples
 *
 * Templates are our own code (never guest input), so compiling their expressions is safe;
 * every VALUE printed into the page is escaped.
 * ===================================================================== */

const TAG = /\{\{([\s\S]*?)\}\}|\{%([\s\S]*?)%\}/g;

/* ---------- Python-like values ---------- */
const truthy = v => !(v === undefined || v === null || v === false || v === 0 || v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0));

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&#34;', "'": '&#39;' };
function show(v) {
  if (v === undefined) return '';
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  return String(v).replace(/[&<>"']/g, c => ESCAPES[c]);
}

/** Python prints a float result as "2.0" where JavaScript prints "2": an expression with a decimal literal is float maths. */
const FLOAT_LITERAL = /\d\.\d/;
const showNumberLikePython = (v, expr) =>
  typeof v === 'number' && Number.isInteger(v) && FLOAT_LITERAL.test(expr) ? `${v}.0` : show(v);

const range = (a, b, step = 1) => {
  const [start, end] = b === undefined ? [0, a] : [a, b];
  const out = [];
  for (let i = start; step > 0 ? i < end : i > end; i += step) out.push(i);
  return out;
};

/* ---------- expressions: Jinja → JavaScript ---------- */

/** Splits on a word operator (" or ", " and ") only at the top level (not inside brackets or quotes). */
function splitTop(expr, word) {
  const parts = [];
  let depth = 0, quote = null, start = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (quote) { if (c === quote && expr[i - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (depth === 0 && expr.startsWith(` ${word} `, i)) { parts.push(expr.slice(start, i)); start = i + word.length + 2; i = start - 1; }
  }
  parts.push(expr.slice(start));
  return parts.map(p => p.trim());
}

/** Translates one Jinja expression into JavaScript with Python semantics for and / or / not. */
function toJs(expr) {
  expr = expr.trim();
  const ors = splitTop(expr, 'or');
  if (ors.length > 1) return `$or(${ors.map(p => `()=>(${toJs(p)})`).join(',')})`;
  const ands = splitTop(expr, 'and');
  if (ands.length > 1) return `$and(${ands.map(p => `()=>(${toJs(p)})`).join(',')})`;
  if (/^not\s+/.test(expr)) return `!$t(${toJs(expr.replace(/^not\s+/, ''))})`;
  if (/^\(.*,.*\)$/.test(expr)) return `[${expr.slice(1, -1)}]`;              // (1, 2) tuple → list
  return expr
    .replace(/\bTrue\b|\btrue\b/g, 'true')
    .replace(/\bFalse\b|\bfalse\b/g, 'false')
    .replace(/\bNone\b|\bnone\b/g, 'null')
    .replace(/\.items\(\)/g, '');                                            // dict.items() → loop over the object
}

const HELPERS = {
  $t: truthy,
  $or: (...fs) => { let v; for (const f of fs) { v = f(); if (truthy(v)) return v; } return v; },
  $and: (...fs) => { let v; for (const f of fs) { v = f(); if (!truthy(v)) return v; } return v; },
  range
};

const compiled = new Map();
function evaluate(expr, scope) {
  if (!compiled.has(expr)) {
    // eslint-disable-next-line no-new-func
    compiled.set(expr, new Function('$s', `with ($s) { try { return (${toJs(expr)}); } catch (e) { return undefined; } }`));
  }
  return compiled.get(expr)(scope);
}

/* ---------- parse the template into a tree ---------- */
function parse(source) {
  const root = { kind: 'root', body: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const body = () => { const t = top(); return t.kind === 'if' ? t.branches[t.branches.length - 1].body : t.body; };
  let last = 0;

  for (const m of source.matchAll(TAG)) {
    if (m.index > last) body().push({ kind: 'text', text: source.slice(last, m.index) });
    last = m.index + m[0].length;
    if (m[1] !== undefined) { body().push({ kind: 'out', expr: m[1].trim() }); continue; }

    const stmt = m[2].trim();
    const [word] = stmt.split(/\s+/);
    if (word === 'if') {
      const node = { kind: 'if', branches: [{ test: stmt.slice(3), body: [] }] };
      body().push(node); stack.push(node);
    } else if (word === 'elif') {
      top().branches.push({ test: stmt.slice(5), body: [] });
    } else if (word === 'else') {
      const t = top();
      if (t.kind === 'if') t.branches.push({ test: null, body: [] }); else { t.elseBody = []; t.inElse = true; }
    } else if (word === 'for') {
      const f = stmt.match(/^for\s+(.+?)\s+in\s+(.+)$/);
      if (!f) throw new Error('Unsupported for: ' + stmt);
      const node = { kind: 'for', names: f[1].split(',').map(s => s.trim()), iter: f[2], body: [] };
      body().push(node); stack.push(node);
    } else if (word === 'endif' || word === 'endfor') {
      stack.pop();
    } else {
      throw new Error('Unsupported template tag: {% ' + stmt + ' %}');
    }
  }
  if (last < source.length) body().push({ kind: 'text', text: source.slice(last) });
  return root;
}

/* ---------- render ---------- */
function renderNodes(nodes, scope, out) {
  for (const node of nodes) {
    if (node.kind === 'text') out.push(node.text);
    else if (node.kind === 'out') out.push(showNumberLikePython(evaluate(node.expr, scope), node.expr));
    else if (node.kind === 'if') {
      const branch = node.branches.find(b => b.test === null || truthy(evaluate(b.test, scope)));
      if (branch) renderNodes(branch.body, scope, out);
    } else if (node.kind === 'for') {
      const value = evaluate(node.iter, scope);
      const items = Array.isArray(value) ? value
        : value && typeof value === 'object' ? Object.entries(value) : [];
      items.forEach((item, i) => {
        const inner = Object.create(scope);
        if (node.names.length === 1) inner[node.names[0]] = item;
        else node.names.forEach((n, k) => { inner[n] = item[k]; });
        inner.loop = { index: i + 1, index0: i, first: i === 0, last: i === items.length - 1, length: items.length };
        renderNodes(node.body, inner, out);
      });
    }
  }
}

const parsedCache = new Map();

/** render(templateSource, { v: …, L: … }) → HTML string */
export function render(source, context) {
  if (!parsedCache.has(source)) parsedCache.set(source, parse(source));
  const scope = Object.assign(Object.create(null), HELPERS, context);
  const out = [];
  renderNodes(parsedCache.get(source).body, scope, out);
  return out.join('');
}
