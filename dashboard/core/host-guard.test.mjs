import { expect, it } from 'vitest';
import { isAllowedHost } from './host-guard.mjs';

it('isAllowedHost menerima 127.0.0.1:3210 dan localhost:3210 (huruf besar boleh)', () => {
  expect(['127.0.0.1:3210', 'localhost:3210', 'LocalHost:3210'].map(isAllowedHost)).toEqual([true, true, true]);
});
it('isAllowedHost menolak nama lain, port lain, tanpa port, dan header kosong (DNS rebinding)', () => {
  const bad = ['evil.test:3210', 'localhost.evil.test:3210', '127.0.0.1:3000', 'localhost', '127.0.0.1', '127.0.0.1:3210.evil.test', '', null, undefined];
  expect(bad.map(isAllowedHost)).toEqual(bad.map(() => false));
});
