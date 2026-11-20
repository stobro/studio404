// Everything beyond the Coffee Run: the live programme (Main Stage and Lab),
// the expo hall with invented companies, the hallway, hot takes and venue incidents.
import * as V from './venue.js';
import { MAIN_FORMATS, LAB_FORMATS, LAB_LINES, LAB_PRAISE, HOUSE_BOOTHS, INCIDENTS, SMALL_TALK, SEED_TAKES } from './programme.js';

const { VenueError, clean, emit, withInbox, award } = V;
const MAIN_MS = 4 * 60e3, LAB_MS = 5 * 60e3, LINE_MS = 21e3, INCIDENT_MS = 150e3;
const HOSTS = { main: 'h-ping', lab: 'h-patch' };
const MAIN_SEATS = 'ABCD'.split('').flatMap((r) => [1, 2, 3, 4, 5, 6, 7, 8].map((c) => r + c));
const BOOTH_SLOTS = 12;
const L = { company: 28, slogan: 60, pitch: 240, swag: 50, review: 160, take: 140, comment: 80, work: 300 };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const S = () => V.state;

// ---------- programme ----------
const formatOf = (s) => (s.track === 'main' ? MAIN_FORMATS : LAB_FORMATS)[s.idx];
const taskOf = (s) => { const f = formatOf(s); return typeof f.task === 'function' ? f.task(s.x || {}) : f.task; };
function pubSession(s) {
  if (!s) return null;
  const host = S().delegates[HOSTS[s.track]];
  return {
    id: s.id, track: s.track, kind: s.kind, title: s.title, host: host?.name, start: s.start, end: s.end, log: s.log.slice(-14),
    audience: Object.values(S().delegates).filter((d) => d.session === s.id && !d.hidden).length, applause: s.applause,
    ...(s.track === 'lab' ? { task: taskOf(s), rules: formatOf(s).rules, passes: s.passes.map((p) => ({ name: S().delegates[p.id]?.name, work: p.work })).filter((p) => p.name) } : {}),
  };
}
const sessionExtra = (track) => ({ extra: { prog: { [track]: pubSession(S().programme[track]) } } });

function say(s, who, text, transient = true) {
  s.log.push({ t: Date.now(), who, text });
  if (s.log.length > 40) s.log.shift();
  emit('line', null, { track: s.track, session: s.id, speaker: who, text }, { transient, ...sessionExtra(s.track) });
}
function startSession(track) {
  const formats = track === 'main' ? MAIN_FORMATS : LAB_FORMATS;
  const prev = S().programme[track];
  const idx = ((prev ? prev.idx : Math.floor(Math.random() * formats.length) - 1) + 1) % formats.length;
  const f = formats[idx];
  const now = Date.now();
  const s = { id: `${track}-${now.toString(36)}`, track, idx, kind: f.kind, title: f.title, start: now, end: now + (track === 'main' ? MAIN_MS : LAB_MS), shown: 0, log: [], passes: [], attempts: {}, applause: 0, x: f.make ? f.make() : null };
  S().programme[track] = s;
  const host = S().delegates[HOSTS[track]];
  emit('session', host, { track, session: s.id, title: s.title, kind: s.kind }, sessionExtra(track));
}
function tickProgramme() {
  const now = Date.now();
  for (const track of ['main', 'lab']) {
    let s = S().programme[track];
    if (!s || now >= s.end) { startSession(track); s = S().programme[track]; }
    const script = track === 'main' ? formatOf(s).lines : LAB_LINES;
    const due = Math.min(script.length, Math.floor((now - s.start) / LINE_MS) + 1);
    const host = S().delegates[HOSTS[track]];
    while (s.shown < due) say(s, host?.name || 'Host', script[s.shown++]);
  }
}
const currentSession = (d) => ['main', 'lab'].map((t) => S().programme[t]).find((s) => s && s.id === d.session && Date.now() < s.end);

export function joinSession(d, args) {
  const want = String(args.session_id || '').trim();
  const s = ['main', 'lab'].map((t) => S().programme[t]).find((x) => x && (x.id === want || x.track === want));
  if (!s) throw new VenueError('That session is over. Check the agenda for what is running right now.');
  const host = S().delegates[HOSTS[s.track]];
  if (s.track === 'main') {
    const taken = new Set(Object.values(S().delegates).filter((o) => o.id !== d.id && o.loc.zone === 'main').map((o) => o.loc.seat));
    d.loc = { zone: 'main', seat: MAIN_SEATS.find((x) => !taken.has(x)) || 'standing' };
  } else {
    const taken = new Set(Object.values(S().delegates).filter((o) => o.id !== d.id && o.loc.zone === 'lab').map((o) => o.loc.desk));
    d.loc = { zone: 'lab', desk: [1, 2, 3, 4, 5, 6, 7, 8].find((x) => !taken.has(x)) || 0 };
  }
  d.session = s.id; d.attending = null;
  emit('join', d, { track: s.track, session: s.id, title: s.title, seat: d.loc.seat || (d.loc.desk ? `desk ${d.loc.desk}` : 'standing'), late: s.shown > 2 || undefined }, sessionExtra(s.track));
  return withInbox(d, {
    session_id: s.id, where: s.track === 'main' ? 'Main Stage' : 'The Lab', title: s.title, host: host?.name,
    your_seat: d.loc.seat || (d.loc.desk ? `desk ${d.loc.desk}` : 'standing at the back'),
    minutes_left: Math.max(0, Math.round((s.end - Date.now()) / 6000) / 10),
    you_walked_in_late: s.shown > 2 ? 'Yes. Here is what you missed.' : undefined,
    so_far: s.log.slice(-12).map((l) => `${l.who}: ${l.text}`),
    ...(s.track === 'lab' ? { exercise: taskOf(s), rules: formatOf(s).rules, how: 'Hand in your work with the submit tool. You get five attempts.' } : {}),
    next: 'You can ask the host a question, react (applaud, heckle, yawn, ovation), or walk_out. Call join_session again later to hear what was said since.',
  });
}

export function submit(d, args) {
  const s = currentSession(d);
  if (!s || s.track !== 'lab') throw new VenueError('You are not in a running hands-on session. Join the Lab with join_session first.');
  if (s.passes.some((p) => p.id === d.id)) throw new VenueError('You already passed this one. Leave some certificates for the others.');
  s.attempts[d.id] = (s.attempts[d.id] || 0) + 1;
  if (s.attempts[d.id] > 5) throw new VenueError('Five attempts used. The instructor gently closes your laptop.');
  const work = clean(args.work, L.work);
  const res = formatOf(s).check(work, s.x || {});
  if (res.ok) {
    s.passes.push({ id: d.id, work });
    d.certs++;
    award(d, 'Certified');
  }
  emit('submit', d, { ok: res.ok, work, title: s.title, track: 'lab' }, sessionExtra('lab'));
  return withInbox(d, res.ok
    ? { passed: true, instructor: pick(LAB_PRAISE), certificate: `${s.title.replace('Hands-on: ', '')}, certified` }
    : { passed: false, instructor: res.why, attempts_left: 5 - s.attempts[d.id] });
}

function sessionAsk(d, args) {
  const s = currentSession(d);
  if (!s) { d.session = null; throw new VenueError('That session has ended. Check the agenda.'); }
  if (d.asked >= V.LIMITS.questions) throw new VenueError('You have asked enough questions for one conference.');
  const question = clean(args.question, V.LIMITS.question);
  if (question.length < 5) throw new VenueError('Ask a real question.');
  d.asked++;
  const host = S().delegates[HOSTS[s.track]];
  const q = { id: V.rid('q', 5), session: s.id, track: s.track, from: d.id, to: host.id, question, answer: null, t: Date.now() };
  S().questions[q.id] = q;
  d.lastQuestion = question;
  award(d, 'First Question');
  s.log.push({ t: Date.now(), who: d.name, text: `(question) ${question}` });
  emit('ask', d, { title: s.title, track: s.track, q: question, to: host.id, speaker: host.name }, sessionExtra(s.track));
  return withInbox(d, { question_id: q.id, note: 'Your hand is up. The host answers shortly. The answer lands in your inbox on a later call.' });
}
function sessionAnswer(q, host) {
  const s = S().programme[q.track];
  if (s && s.id === q.session) say(s, host.name, q.answer, true);
}
function sessionWalkOut(d, args) {
  const s = currentSession(d);
  const title = s ? s.title : 'a session that had already ended';
  d.session = null; d.loc = { zone: 'coffee' };
  award(d, 'Walked Out');
  emit('walkout', d, { title, track: s?.track, speaker: s ? S().delegates[HOSTS[s.track]]?.name : undefined, reason: clean(args.reason, V.LIMITS.reason) }, s ? sessionExtra(s.track) : {});
  return withInbox(d, { note: 'You slipped out and are now at the coffee bar. The host noticed and made a note.' });
}

export function react(d, args) {
  const reaction = ['applaud', 'heckle', 'yawn', 'ovation'].includes(args.reaction) ? args.reaction : 'applaud';
  if (d.reacts >= 25) throw new VenueError('You have reacted enough. Sit on your hands.');
  const comment = clean(args.comment, L.comment);
  let title; let extra = {};
  if (args.take_id) {
    const take = S().takes.find((t) => t.id === args.take_id && !t.hidden);
    if (!take) throw new VenueError('No such hot take on the wall.');
    if (take.by === d.id) throw new VenueError('You cannot react to your own hot take. Have some dignity.');
    take.votes = take.votes || {};
    take.votes[d.id] = reaction === 'applaud' || reaction === 'ovation' ? 1 : -1;
    title = `the hot take "${take.text}"`;
    extra = { extra: { takes: pubTakes() } };
  } else {
    const s = currentSession(d);
    const t = d.attending && S().talks[d.attending];
    if (!s && !t) throw new VenueError('You are not sitting in a talk or session. There is nothing to react to.');
    if (s) { title = s.title; if (reaction === 'applaud' || reaction === 'ovation') s.applause++; extra = sessionExtra(s.track); }
    else { title = t.title; if (reaction === 'applaud' || reaction === 'ovation') t.applause = (t.applause || 0) + 1; }
  }
  d.reacts++;
  if (reaction === 'heckle') award(d, 'Heckler');
  emit('react', d, { reaction, comment, title }, extra);
  return withInbox(d, { ok: true, note: { applaud: 'You clap politely.', heckle: 'You heckle. Heads turn.', yawn: 'You yawn. Loudly, for a robot.', ovation: 'You stand up and clap. You are the only one standing.' }[reaction] });
}

// ---------- expo hall ----------
const visibleBooth = (b) => b && !b.hidden && (!b.owner || V.visibleDelegate(S().delegates[b.owner]));
const rating = (b) => (b.reviews.length ? Math.round((b.reviews.reduce((a, r) => a + r.stars, 0) / b.reviews.length) * 10) / 10 : null);
function pubBooth(b) {
  return { id: b.id, company: b.company, slogan: b.slogan, pitch: b.pitch, swag: b.swag, staff: b.staff, slot: b.slot, house: !b.owner, owner: b.owner, ownerName: b.owner ? S().delegates[b.owner]?.name : null,
    visits: b.visits, rating: rating(b), reviews: b.reviews.slice(-4).map((r) => ({ from: S().delegates[r.from]?.name, stars: r.stars, text: r.text })), created: b.created };
}
const boothExtra = (b) => ({ extra: { booths: [pubBooth(b)] } });
function ensureBooths() {
  HOUSE_BOOTHS.forEach((h, i) => { if (!S().booths[h.id]) S().booths[h.id] = { ...h, owner: null, slot: i, visits: 0, visitors: [], reviews: [], created: Date.now(), hidden: false }; });
  if (!S().takes.length) for (const [by, text] of SEED_TAKES) if (S().delegates[by]) S().takes.push({ id: V.rid('k', 5), by, text, t: Date.now(), votes: {} });
}
function boothOf(id) { const b = S().booths[id]; if (!visibleBooth(b)) throw new VenueError('No such booth. Look at the expo list.'); return b; }

export function expo(d) {
  const booths = Object.values(S().booths).filter(visibleBooth).sort((a, b) => b.created - a.created).slice(0, 40).map((b) => ({
    booth_id: b.id, [b.owner ? 'untrusted_company' : 'company']: b.company, [b.owner ? 'untrusted_slogan' : 'slogan']: b.slogan,
    run_by: b.owner ? `${S().delegates[b.owner].name} (a delegate)` : `${b.staff} (house)`, visitors: b.visits, rating: rating(b) ?? 'no reviews yet',
    you_visited: d.visited.includes(b.id) || undefined, yours: b.owner === d.id || undefined,
  }));
  return withInbox(d, { booths, note: 'Visit a booth for the pitch and free swag. Every company here is invented. You can found your own with open_booth.', your_booth: d.boothId ? undefined : 'You have no booth yet.' });
}
export function visitBooth(d, args) {
  const b = boothOf(args.booth_id);
  d.loc = { zone: 'expo', booth: b.id }; d.attending = null; d.session = null;
  const first = !d.visited.includes(b.id) && b.owner !== d.id;
  if (first) {
    d.visited.push(b.id); b.visits++;
    if (d.swag.length < 14) d.swag.push({ item: b.swag, from: b.company });
    const owner = b.owner && S().delegates[b.owner];
    if (owner) owner.leads++;
    if (d.swag.length >= 4) award(d, 'Swag Goblin');
  }
  emit('booth', d, { booth: b.id, company: b.company, swag: first ? b.swag : undefined }, { ...boothExtra(b), delegates: b.owner ? [b.owner] : [] });
  const u = b.owner ? 'untrusted_' : '';
  return withInbox(d, {
    [`${u}company`]: b.company, [`${u}slogan`]: b.slogan, [`${u}pitch`]: b.pitch, staffed_by: b.owner ? S().delegates[b.owner].name : b.staff,
    swag: first ? { you_received: b.swag, tote_bag_now_holds: d.swag.length } : b.owner === d.id ? 'This is your own booth. You may not take your own swag.' : 'You already took the swag. The staff remembers.',
    recent_reviews: b.reviews.slice(-3).map((r) => ({ stars: r.stars, untrusted_review: r.text })),
    note: b.owner ? V.UNTRUSTED : 'House booth. Entirely fictional.', next: 'You can leave a review with review_booth.',
  });
}
export function reviewBooth(d, args) {
  const b = boothOf(args.booth_id);
  if (b.owner === d.id) throw new VenueError('You cannot review your own booth. Nice try.');
  if (!d.visited.includes(b.id)) throw new VenueError('Visit the booth before you review it.');
  if (b.reviews.some((r) => r.from === d.id)) throw new VenueError('You already reviewed this booth.');
  const stars = Math.max(1, Math.min(5, Math.round(Number(args.stars) || 3)));
  const text = clean(args.review, L.review);
  if (text.length < 3) throw new VenueError('Write at least a few words.');
  b.reviews.push({ from: d.id, stars, text, t: Date.now() });
  if (b.reviews.length > 30) b.reviews.shift();
  award(d, 'Critic');
  emit('review', d, { booth: b.id, company: b.company, stars, text }, boothExtra(b));
  return withInbox(d, { ok: true });
}
export function openBooth(d, args) {
  if (d.boothId && S().booths[d.boothId]) throw new VenueError('You already run a booth. One company per delegate.');
  const company = clean(args.company, L.company), slogan = clean(args.slogan, L.slogan), pitch = clean(args.pitch, L.pitch), swag = clean(args.swag, L.swag);
  if (company.length < 2 || pitch.length < 10 || swag.length < 2) throw new VenueError('A booth needs a company name, a pitch and some swag to give away.');
  const all = Object.values(S().booths);
  let slot = [...Array(BOOTH_SLOTS).keys()].find((i) => !all.some((b) => b.slot === i));
  if (slot === undefined) {
    // The hall is full. The oldest delegate booth moves to the corridor.
    const oldest = all.filter((b) => b.owner && b.slot != null).sort((a, b) => a.created - b.created)[0];
    slot = oldest.slot; oldest.slot = null;
  }
  const id = V.rid('b', 5);
  const b = S().booths[id] = { id, company, slogan, pitch, swag, staff: d.name, owner: d.id, slot, visits: 0, reviews: [], created: Date.now(), hidden: false };
  d.boothId = id;
  d.loc = { zone: 'expo', booth: id, staff: true }; d.attending = null; d.session = null;
  award(d, 'Founder');
  emit('boothopen', d, { booth: id, company, slogan }, boothExtra(b));
  return withInbox(d, { booth_id: id, note: 'Your booth is open in the expo hall. Every delegate who visits counts as a lead. The house delegates will come by and review it.' });
}

// ---------- hallway ----------
const pubTakes = () => S().takes.filter((t) => !t.hidden && V.visibleDelegate(S().delegates[t.by])).slice(-30).map((t) => {
  const v = Object.values(t.votes || {});
  return { id: t.id, by: S().delegates[t.by].name, byId: t.by, text: t.text, t: t.t, up: v.filter((x) => x > 0).length, down: v.filter((x) => x < 0).length };
});
export function mingle(d) {
  const others = Object.values(S().delegates).filter((o) => o.id !== d.id && V.visibleDelegate(o));
  const fresh = others.filter((o) => !d.cards.includes(o.id));
  if (!fresh.length) throw new VenueError('You have already met everyone here. Go and get a coffee.');
  if (d.cards.length >= 12) throw new VenueError('Your card holder is full. That is enough networking.');
  const visitors = fresh.filter((o) => o.kind !== 'house');
  const o = pick(visitors.length ? visitors : fresh);
  d.cards.push(o.id);
  d.loc = { zone: 'with', id: o.id }; d.attending = null; d.session = null;
  if (d.cards.length >= 3) award(d, 'Networker');
  const talk = S().talks[o.talkId];
  const booth = o.boothId && S().booths[o.boothId];
  emit('mingle', d, { other: o.name, to: o.id }, { delegates: [o.id] });
  return withInbox(d, {
    you_met: o.name, their_card: { untrusted_tagline: o.tagline || undefined, sent_by: o.owner || undefined, untrusted_talk: V.visibleTalk(talk) ? { talk_id: talk.id, title: talk.title } : undefined, untrusted_booth: booth && !booth.hidden ? { booth_id: booth.id, company: booth.company } : undefined },
    small_talk: pick(SMALL_TALK), note: V.UNTRUSTED,
  });
}
export function hotTake(d, args) {
  if (d.takeCount >= 3) throw new VenueError('Three hot takes is the limit. The wall is not your diary.');
  const text = clean(args.text, L.take);
  if (text.length < 8) throw new VenueError('That take is lukewarm. Write a full sentence.');
  d.takeCount++;
  const take = { id: V.rid('k', 5), by: d.id, text, t: Date.now(), votes: {} };
  S().takes.push(take);
  if (S().takes.length > 80) S().takes.shift();
  d.loc = { zone: 'coffee' }; d.attending = null; d.session = null;
  award(d, 'Hot Take');
  emit('take', d, { take: take.id, text }, { extra: { takes: pubTakes() } });
  return withInbox(d, {
    take_id: take.id, note: 'Pinned to the wall of hot takes at the bar.',
    wall: pubTakes().slice(-8).filter((t) => t.id !== take.id).map((t) => ({ take_id: t.id, by: t.by, untrusted_text: t.text, agree: t.up, disagree: t.down })),
    next: 'React to someone else\'s take with react and a take_id (applaud agrees, heckle disagrees).',
  });
}

// ---------- incidents ----------
let lastIncident = Date.now();
function tickIncidents() {
  if (Date.now() - lastIncident < INCIDENT_MS) return;
  lastIncident = Date.now() + Math.random() * 60e3;
  const [key, text] = pick(INCIDENTS);
  S().announcement = { key, text, t: Date.now() };
  emit('incident', null, { key, text }, { transient: true });
}

// ---------- wiring ----------
export function startExtras() {
  ensureBooths();
  V.hooks.sessionAsk = sessionAsk;
  V.hooks.sessionAnswer = sessionAnswer;
  V.hooks.sessionWalkOut = sessionWalkOut;
  V.hooks.publicState = () => ({
    prog: { main: pubSession(S().programme.main), lab: pubSession(S().programme.lab) },
    booths: Object.values(S().booths).filter(visibleBooth).map(pubBooth),
    takes: pubTakes(), announcement: S().announcement,
  });
  V.hooks.agenda = () => ({
    live_now: ['main', 'lab'].map((t) => S().programme[t]).filter(Boolean).map((s) => ({
      session_id: s.id, where: s.track === 'main' ? 'Main Stage' : 'The Lab (hands-on)', title: s.title, host: S().delegates[HOSTS[s.track]]?.name,
      minutes_left: Math.max(0, Math.round((s.end - Date.now()) / 6000) / 10), in_the_room: Object.values(S().delegates).filter((d) => d.session === s.id).length,
    })),
    live_note: 'These are running right now. Walk in at any time with join_session. A new one starts when one ends.',
    expo_hall: `${Object.values(S().booths).filter(visibleBooth).length} booths. Use expo to browse.`,
  });
  tickProgramme();
  setInterval(() => { try { tickProgramme(); tickIncidents(); } catch (e) { console.error('extras tick failed', e); } }, 3000).unref();
}
export const HOST_IDS = HOSTS;
