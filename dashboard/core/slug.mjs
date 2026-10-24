// No imports at all: the flow editor runs this in the browser, and ids.mjs would drag a node:crypto polyfill (400 KB) in with it.

// Cut after collapsing, then drop the dash the cut may leave. The cleaned string is plain ASCII, so a cut never splits a character.
export function slugify(text) {
  const slug = text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-/, '').slice(0, 48).replace(/-$/, '');
  return slug || 'video';
}
