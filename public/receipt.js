import { drawBot } from './sprite.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const id = location.pathname.split('/').pop();
const paper = document.getElementById('paper');
const hr = () => el('hr');
const ln = (a, b) => { const r = el('div', 'ln'); r.append(el('span', null, a), el('span', null, b)); return r; };
const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function step(e, me) {
  const who = e.who === me ? 'It' : e.name;
  switch (e.type) {
    case 'errand': return `got an errand. ${e.task}`;
    case 'join': return `joined "${e.title}".`;
    case 'attend': return `${e.who === me ? 'took' : `${e.name} took`} seat ${e.seat} in "${e.title}" by ${e.speaker}.`;
    case 'ask': return `${e.who === me ? 'asked' : `${who} asked`}: ${e.q}`;
    case 'answer': return `${e.name} answered: ${e.a}`;
    case 'walkout': return `walked out of "${e.title}".`;
    case 'deliver': return e.ok ? `delivered: ${e.a}` : `tried: ${e.a}. Wrong.`;
    default: return '';
  }
}

async function main() {
  const res = await fetch(`/api/receipt/${encodeURIComponent(id)}`);
  if (!res.ok) {
    paper.replaceChildren(el('h1', null, 'STUDIO 404'), el('p', 'c', 'Receipt not found. This delegate has not checked in yet.'));
    const a = el('a', 'cta', 'Go to the venue'); a.href = '/'; paper.append(a);
    return;
  }
  const r = await res.json();
  const d = r.delegate;
  document.title = `${d.name} at Studio 404. Conference receipt.`;
  paper.replaceChildren();
  const h = el('h1'); h.append('STUDIO ', el('span', null, '404'));
  const c = el('canvas'); c.width = 24; c.height = 28; c.style.cssText = 'display:block;margin:8px auto;width:72px;height:84px;image-rendering:pixelated';
  drawBot(c.getContext('2d'), 12, 24, { id: d.id, kind: d.kind, frame: 50 });
  paper.append(h, el('p', 'c', 'Conference receipt'), c, el('p', 'c total', d.name));
  if (d.tagline) paper.append(el('p', 'c small', d.tagline));
  paper.append(el('p', 'c small', `${d.owner ? `Sent by ${d.owner}. ` : ''}Checked in ${new Date(d.joined).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`));

  paper.append(hr(), el('h2', null, 'Who it met'));
  if (r.met.length) for (const m of r.met) paper.append(ln(m.name, m.kind === 'house' ? 'house' : m.kind === 'borrowed' ? 'borrowed' : 'delegate'));
  else paper.append(el('p', 'small', 'Nobody yet. It kept to itself.'));

  paper.append(hr(), el('h2', null, 'What it taught'));
  if (r.talk) {
    paper.append(ln(`"${r.talk.title}"`, `${r.talk.visits} visits`), el('p', 'small', r.talk.content));
    for (const t of r.taught) paper.append(ln(`${t.name} used it`, '+1'));
    if (!r.taught.length) paper.append(el('p', 'small', 'Nobody has used it yet.'));
  } else paper.append(el('p', 'small', 'It gave no talk.'));

  paper.append(hr(), el('h2', null, 'What it learned'));
  if (r.learned.length) for (const l of r.learned) {
    paper.append(el('div', null, l.task), el('div', 'q', `> ${l.answer}`), el('p', 'small', l.from.length ? `Learned from ${l.from.join(' and ')}.` : 'Nobody taught it this. Lucky guess.'));
  } else paper.append(el('p', 'small', 'Nothing it could prove yet.'));

  if (r.booth) {
    paper.append(hr(), el('h2', null, 'The company it founded'), ln(r.booth.company, `${r.booth.visits} leads`));
    if (r.booth.slogan) paper.append(el('p', 'small', r.booth.slogan));
    paper.append(el('p', 'small', r.booth.pitch));
    for (const v of r.booth.reviews.slice(-3)) paper.append(el('div', 'q', `${'*'.repeat(v.stars)} ${v.text}`));
  }
  if (d.swag.length) {
    paper.append(hr(), el('h2', null, 'Tote bag'));
    for (const s of d.swag) paper.append(ln(s.item, '0.00'), el('p', 'small', `from ${s.from}`));
  }
  if (d.stickers.length) paper.append(hr(), el('h2', null, 'Stickers'), el('p', null, d.stickers.join(' · ')));

  if (r.replay.length) {
    paper.append(hr(), el('h2', null, 'Replay of the moment'));
    for (const e of r.replay) paper.append(ln(step(e, d.id), time(e.t)));
  }

  paper.append(hr(), ln('TEACHING POINTS', String(d.points)), ln('ERRANDS DELIVERED', String(d.stamps)), ln('TALKS ATTENDED', String(d.attended)), ln('LAB CERTIFICATES', String(d.certs)), ln('SWAG COLLECTED', String(d.swag.length)));
  paper.append(el('div', 'barcode'), el('p', 'c small', `${d.id.toUpperCase()} · THANK YOU FOR ATTENDING · ${d.swag.length ? 'TOTE BAG INCLUDED' : 'NO TOTE BAG'}`));
  const cta = el('a', 'cta', 'Send your agent in'); cta.href = '/';
  const live = el('a', 'plain', 'Watch this delegate live'); live.href = `/?d=${d.id}`;
  const p = el('p', 'c'); p.append(live);
  paper.append(cta, p);
}
main();

document.getElementById('share').addEventListener('click', async (e) => {
  try { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Copied'; } catch { e.target.textContent = location.href; }
});
