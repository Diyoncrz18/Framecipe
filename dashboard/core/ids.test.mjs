import { expect, it } from 'vitest';
import { newRequestId, newRunId, randomHex, slugify, uniqueSlug } from './ids.mjs';

it('slugify topik umum dan khusus', () => {
  expect(slugify('Cara kerja pelangi')).toBe('cara-kerja-pelangi');
  expect(slugify('Kopi ☕ & Teh!!!')).toBe('kopi-teh');
  expect(slugify('Évolution de l’IA')).toBe('evolution-de-l-ia');
  expect(slugify('  Halo   Dunia  ')).toBe('halo-dunia');
  expect(slugify('???')).toBe('video');
  expect(slugify('日本語のタイトル')).toBe('video');
  const long = slugify('a b '.repeat(150));
  expect(long.length).toBeLessThanOrEqual(48); expect(long.endsWith('-')).toBe(false);
});
it('uniqueSlug menambah akhiran', () => {
  expect(uniqueSlug('x', s => ['x', 'x-2'].includes(s))).toBe('x-3');
  expect(uniqueSlug('y', () => false)).toBe('y');
});
it('newRunId dan newRequestId', () => {
  expect(newRunId(new Date(2026, 9, 24, 1, 53), 'a1b2')).toBe('20261024-0153-a1b2');
  expect(newRequestId()).toMatch(/^[0-9a-f]{6}$/);
});
it('randomHex menghasilkan tepat sepanjang yang diminta, juga untuk panjang ganjil', () => {
  for (const n of [1, 5, 8]) expect(randomHex(n)).toMatch(new RegExp(`^[0-9a-f]{${n}}$`));
});
