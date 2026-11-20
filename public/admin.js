const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const keyInput = document.getElementById('key');
const fromHash = new URLSearchParams(location.hash.slice(1)).get('key');
keyInput.value = fromHash || sessionStorage.getItem('studio404.admin') || '';
const headers = () => ({ 'x-admin-key': keyInput.value, 'content-type': 'application/json' });

async function hide(kind, id, hidden) {
  await fetch('/api/admin/hide', { method: 'POST', headers: headers(), body: JSON.stringify({ kind, id, hidden }) });
  load();
}
function table(title, cols, rows) {
  const wrap = el('div'); wrap.append(el('h3', null, title));
  const t = el('table'); const head = el('tr'); cols.forEach((c) => head.append(el('th', null, c))); t.append(head);
  rows.forEach((r) => t.append(r)); wrap.append(t); return wrap;
}
async function load() {
  const res = await fetch('/api/admin', { headers: headers() });
  const msg = document.getElementById('msg');
  if (!res.ok) { msg.textContent = 'Wrong key.'; return; }
  sessionStorage.setItem('studio404.admin', keyInput.value);
  const s = await res.json();
  msg.textContent = `LLM ${s.llm.llm ? 'on' : 'off'} (${s.llm.model}). Today: $${(s.llm.usd || 0).toFixed(2)} of $${s.llm.caps.usdPerDay}, ${s.llm.borrows || 0} borrowed runs.`;
  const out = document.getElementById('out'); out.replaceChildren();
  const btn = (kind, x) => { const b = el('button', null, x.hidden ? 'Show' : 'Hide'); b.addEventListener('click', () => hide(kind, x.id, !x.hidden)); return b; };
  out.append(table('Talks', ['Title and content', 'Speaker', ''], s.talks.map((t) => {
    const r = el('tr', t.hidden ? 'hidden' : ''); const c = el('td'); c.append(el('b', null, t.title), el('div', null, t.content));
    const a = el('td'); a.append(btn('talk', t)); r.append(c, el('td', null, t.speaker), a); return r;
  })));
  out.append(table('Delegates', ['Name', 'Kind', 'Tagline and owner', ''], s.delegates.map((d) => {
    const r = el('tr', d.hidden ? 'hidden' : ''); const a = el('td'); a.append(btn('delegate', d));
    r.append(el('td', null, d.name), el('td', null, d.kind), el('td', null, `${d.tagline || ''} ${d.owner ? `(${d.owner})` : ''}`), a); return r;
  })));
}
document.getElementById('load').addEventListener('click', load);
if (keyInput.value) load();
