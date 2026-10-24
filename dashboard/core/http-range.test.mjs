import { expect, it } from 'vitest';
import { MEDIA_ROOTS, contentDisposition, contentTypeFor, parseRange } from './http-range.mjs';

it('parseRange', () => {
  expect(parseRange(null, 1000)).toBeNull();
  expect(parseRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 });
  expect(parseRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199 });
  expect(parseRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 });
  expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
  for (const bad of ['bytes=1000-', 'bytes=0-1,5-6', 'items=0-1']) expect(parseRange(bad, 1000)).toBe('invalid');
});
it('parseRange: suffix lebih besar dari file, rentang terbalik, kosong, dan angka raksasa', () => {
  expect(parseRange('bytes=-5000', 1000)).toEqual({ start: 0, end: 999 });
  expect(parseRange('BYTES=0-9', 1000)).toEqual({ start: 0, end: 9 });
  for (const bad of ['bytes=5-2', 'bytes=-0', 'bytes=-', 'bytes=', 'bytes=a-b', `bytes=${'9'.repeat(400)}-`]) expect(parseRange(bad, 1000)).toBe('invalid');
  expect(parseRange('bytes=0-', 0)).toBe('invalid'); // nothing in an empty file can be satisfied
  expect(parseRange('bytes=-1', 0)).toBe('invalid');
});
it('contentTypeFor hanya mengenali tipe media yang diizinkan', () => {
  expect(['a.mp4', 'a.webm', 'a.jpg', 'a.jpeg', 'a.png', 'a.webp', 'a.gif', 'a.svg'].map(contentTypeFor)).toEqual([
    'video/mp4', 'video/webm', 'image/jpeg', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);
  expect(contentTypeFor('projects/x/CLIP.MP4')).toBe('video/mp4');
  for (const other of ['.env', 'a.json', 'a.mp4.', 'a.mp4:stream', 'mp4', 'constructor', 'a.constructor', '']) expect(contentTypeFor(other)).toBeNull();
});
it('MEDIA_ROOTS', () => {
  expect(MEDIA_ROOTS).toEqual(['projects', 'examples', 'brands', 'flows', 'references']);
});
it('contentDisposition: nama aman untuk header, termasuk non-ASCII dan tanda kutip', () => {
  expect(contentDisposition('video.mp4')).toBe(`attachment; filename="video.mp4"; filename*=UTF-8''video.mp4`);
  const h = contentDisposition('Kopi ☕ "x"\r\n.mp4');
  expect(h).toBe(`attachment; filename="Kopi _ _x___.mp4"; filename*=UTF-8''Kopi%20%E2%98%95%20%22x%22%0D%0A.mp4`);
  expect(() => new Headers({ 'Content-Disposition': h })).not.toThrow();
  expect(contentDisposition("a'(b)*.mp4")).toContain(`filename*=UTF-8''a%27%28b%29%2A.mp4`);
});
