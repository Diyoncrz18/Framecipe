// Node built-ins only: hook.mjs imports this module.
import { randomBytes } from 'node:crypto';

const pad2 = (n) => String(n).padStart(2, '0');

// Cut after collapsing, then drop the dash the cut may leave. The cleaned string is plain ASCII, so a cut never splits a character.
export function slugify(text) {
  const slug = text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-/, '').slice(0, 48).replace(/-$/, '');
  return slug || 'video';
}

// The suffix is added after slugify's 48-char cut, so the result can be a few chars longer.
export function uniqueSlug(base, taken) {
  let slug = base;
  for (let n = 2; taken(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export function randomHex(chars) {
  return randomBytes(Math.ceil(chars / 2)).toString('hex').slice(0, chars);
}

// Local time, not UTC, so the id matches the clock the user sees.
export function newRunId(now, suffix) {
  const date = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  return `${date}-${pad2(now.getHours())}${pad2(now.getMinutes())}-${suffix}`;
}

export function newRequestId() {
  return randomHex(6);
}
