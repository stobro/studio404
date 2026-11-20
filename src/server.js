import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as venue from './venue.js';
import { mountMcp } from './mcp.js';
import { startHouse, borrow, status } from './house.js';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PORT = Number(process.env.PORT || 8080);
const ADMIN_KEY = process.env.ADMIN_KEY || crypto.randomBytes(12).toString('base64url');

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  res.set('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'");
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

const ipOf = (req) => String(req.headers['fly-client-ip'] || req.ip || 'unknown');
const baseUrl = (req) => process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
const fail = (res, e) => {
  if (e instanceof venue.VenueError) return res.status(400).json({ error: e.message });
  console.error(e);
  res.status(500).json({ error: 'The venue tripped over a cable.' });
};

mountMcp(app, (req) => ({ ip: ipOf(req), baseUrl: baseUrl(req) }));

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/api/state', (req, res) => res.json(venue.publicState()));

app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  const off = venue.subscribe((ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`));
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => { off(); clearInterval(ping); });
});

app.post('/api/tickets', (req, res) => {
  try {
    const { ticket, id } = venue.createTicket({ ip: ipOf(req) });
    const base = baseUrl(req);
    res.json({ id, mcpUrl: `${base}/mcp/${ticket}`, watchUrl: `${base}/?d=${id}`, receiptUrl: `${base}/r/${id}` });
  } catch (e) { fail(res, e); }
});

app.post('/api/borrow', (req, res) => {
  try { res.json(borrow({ ip: ipOf(req), baseUrl: baseUrl(req) })); } catch (e) { fail(res, e); }
});

app.get('/api/receipt/:id', (req, res) => {
  try { res.json(venue.receipt(req.params.id, baseUrl(req))); } catch (e) { res.status(404).json({ error: e.message }); }
});

const admin = (req, res, next) => {
  const key = String(req.headers['x-admin-key'] || '');
  const ok = key.length === ADMIN_KEY.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(ADMIN_KEY));
  return ok ? next() : res.status(401).json({ error: 'Wrong admin key.' });
};
app.get('/api/admin', admin, (req, res) => res.json({ ...venue.adminState(), llm: status() }));
app.post('/api/admin/hide', admin, (req, res) => {
  try { venue.setHidden(req.body.kind, req.body.id, req.body.hidden); res.json({ ok: true }); } catch (e) { fail(res, e); }
});

app.get('/r/:id', (req, res) => res.sendFile(path.join(PUBLIC, 'receipt.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC, 'admin.html')));
app.use(express.static(PUBLIC, { maxAge: '5m' }));

venue.load();
startHouse();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Studio 404 is open on port ${PORT}`);
  if (!process.env.ADMIN_KEY) console.log(`No ADMIN_KEY set. Temporary admin key for this run: ${ADMIN_KEY}`);
});
