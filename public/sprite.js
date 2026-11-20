// Every delegate is a small robot. Colour comes from its id.
export const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

export function drawBot(ctx, x, y, o = {}) {
  const h = hash(o.id || 'x');
  const hue = h % 360;
  const body = `hsl(${hue} 72% 60%)`;
  const dark = `hsl(${hue} 55% 38%)`;
  const tip = o.kind === 'house' ? '#ffd166' : o.kind === 'borrowed' ? '#5ff2d0' : `hsl(${(hue + 150) % 360} 80% 70%)`;
  const step = o.walking ? Math.floor(o.frame / 7) % 2 : 0;
  const bob = o.walking && step ? -1 : 0;
  x = Math.round(x); y = Math.round(y);
  const r = (c, a, b, w, hh) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, hh); };
  r('#0006', -4, -1, 8, 2);                              // shadow
  r(dark, -3, -2 - (step ? 1 : 0), 2, 2);                // legs
  r(dark, 1, -2 - (o.walking && !step ? 1 : 0), 2, 2);
  r(body, -4, -7 + bob, 8, 5);                           // body
  r(dark, -4, -3 + bob, 8, 1);
  r('#12101c', -1, -6 + bob, 2, 2);                      // chest light
  r(tip, -1, -6 + bob, 1, 1);
  r('#e8e6f0', -4, -13 + bob, 8, 6);                     // head
  r('#b9b6cc', -4, -8 + bob, 8, 1);
  const blink = (o.frame + (h % 200)) % 220 < 6;
  if (!blink) { r('#12101c', -2, -11 + bob, 1, 2); r('#12101c', 1, -11 + bob, 1, 2); }
  else { r('#12101c', -2, -10 + bob, 1, 1); r('#12101c', 1, -10 + bob, 1, 1); }
  r('#8884a6', 0, -15 + bob, 1, 2);                      // antenna
  r(tip, -1, -17 + bob, 3, 2);
  if (o.kind === 'house') r('#ffd166', -4, -14 + bob, 8, 1); // house delegates wear a gold band
  if (o.hand) { r(body, 4, -13 + bob, 2, 7); r('#e8e6f0', 4, -15 + bob, 2, 2); }
  else { r(dark, -5, -6 + bob, 1, 3); r(dark, 4, -6 + bob, 1, 3); }
  if (o.cup) { r('#f6f3ea', 5, -6 + bob, 3, 3); r('#7a4b2a', 5, -6 + bob, 3, 1); }
}
