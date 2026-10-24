// What GET /api/media serves and how: allowed folders, content types, Range parsing, download header.
import path from 'node:path';

// Repo folders the media route may read from (first path segment).
export const MEDIA_ROOTS = ['projects', 'examples', 'brands', 'flows', 'references'];

// A Map, not an object: an extension like "constructor" must not find an inherited property.
const CONTENT_TYPES = new Map([
  ['mp4', 'video/mp4'], ['webm', 'video/webm'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'],
  ['png', 'image/png'], ['webp', 'image/webp'], ['gif', 'image/gif'], ['svg', 'image/svg+xml'],
]);

export const contentTypeFor = (file) => CONTENT_TYPES.get(path.extname(file).slice(1).toLowerCase()) ?? null;

// null: no Range header (serve it all). 'invalid': malformed, multi-range, or nothing of the file lies in it (answer 416).
// The end is clamped to the file, and a suffix longer than the file means the whole file.
// shortcut: multi-range requests are refused, not served as multipart; browsers do not send them for <video>.
export function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return 'invalid';
  const [, from, to] = m;
  const range = from ? { start: Number(from), end: Math.min(to ? Number(to) : size - 1, size - 1) } : { start: Math.max(0, size - Number(to)), end: size - 1 };
  return range.start > range.end ? 'invalid' : range; // also catches start past the end of the file, "bytes=-0", and an empty file
}

// The file name sits in a quoted header value: a plain ASCII copy (anything else becomes "_") for old clients,
// and the real name percent-encoded (RFC 5987) for the rest. A raw non-ASCII character would make `new Headers` throw.
export function contentDisposition(name) {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
