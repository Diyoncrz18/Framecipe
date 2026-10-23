import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { allEnvKeys, envStatus, readCatalog, repoContextForValidation, templateInfo } from './catalog.mjs';
import { makeFixtureRepo } from './test-utils.mjs';

const realRoot = path.resolve(import.meta.dirname, '..', '..');

it('menggabungkan registry dan folder', () => {
  const c = readCatalog(makeFixtureRepo());
  expect(c.templates.find(t => t.id === 'rem')).toMatchObject({ engine: 'remotion', aspectRatio: '16:9', width: 1920, height: 1080, source: 'both' });
  expect(c.templates.find(t => t.id === 'pyt').engine).toBe('python');
  expect(c.examples.find(e => e.id === 'ghost').mismatch).toBe('missing-folder');
  expect(c.examples.find(e => e.id === 'unreg').mismatch).toBe('unregistered');
  expect(c.examples.find(e => e.id === 'ex-a').renderedVideo).toBe('examples/ex-a/out/v.mp4');
  expect(c.skills.find(s => s.id === 'bar')).toMatchObject({ source: 'folder', mismatch: 'unregistered' });
  expect(c.brands.find(b => b.id === 'other').mismatch).toBe('unregistered');
});
it('skillName: nama frontmatter, atau id folder bila tidak ada', () => {
  const root = makeFixtureRepo();
  fs.mkdirSync(path.join(root, '.claude', 'skills', 'baz'));
  fs.writeFileSync(path.join(root, '.claude', 'skills', 'baz', 'SKILL.md'), '---\nname: baz-invoked\ndescription: Baz\n---\n');
  const regFile = path.join(root, '_internal', 'toolkit-registry.json');
  const reg = JSON.parse(fs.readFileSync(regFile, 'utf8')); reg.skills.ghost = { path: '.claude/skills/ghost/', description: 'No folder' };
  fs.writeFileSync(regFile, JSON.stringify(reg));
  const c = readCatalog(root);
  expect(c.skills.map(s => [s.id, s.skillName])).toEqual([['bar', 'bar'], ['baz', 'baz-invoked'], ['foo', 'foo'], ['ghost', 'ghost']]);
});
it('registry rusak tidak menjatuhkan katalog', () => {
  const root = makeFixtureRepo(); fs.writeFileSync(path.join(root, '_internal', 'toolkit-registry.json'), '{');
  const c = readCatalog(root);
  expect(c.registryError).toMatch(/toolkit-registry\.json/);
  expect(c.templates.map(t => t.id).sort()).toEqual(['pyt', 'rem']);
});
it('envStatus hanya melaporkan terisi atau kosong', () => {
  const root = makeFixtureRepo();
  expect(envStatus(root, ['ELEVENLABS_API_KEY', 'RUNPOD_API_KEY', 'IDEOGRAM_API_KEY'])).toEqual([
    { key: 'ELEVENLABS_API_KEY', present: true }, { key: 'RUNPOD_API_KEY', present: false }, { key: 'IDEOGRAM_API_KEY', present: false }]);
  expect(allEnvKeys(readCatalog(root))).toEqual(['ELEVENLABS_API_KEY', 'RUNPOD_API_KEY']);
});
it('templateInfo: rasio, python tanpa konfigurasi, dan id yang tidak aman', () => {
  const root = makeFixtureRepo();
  expect(templateInfo(root, 'rem')).toEqual({ engine: 'remotion', aspectRatio: '16:9', width: 1920, height: 1080 });
  expect(templateInfo(root, 'pyt')).toEqual({ engine: 'python', aspectRatio: 'unknown', width: null, height: null });
  for (const bad of ['nope', '', '..', '../brands', 'rem/src']) expect(templateInfo(root, bad)).toBeNull();
  fs.writeFileSync(path.join(root, 'templates', 'rem', 'src', 'config', 'video.ts'), 'export const v = { width: 1080, height: 1920 };');
  expect(templateInfo(root, 'rem')).toMatchObject({ aspectRatio: '9:16', width: 1080, height: 1920 });
});
it('repoContextForValidation memuat template, brand, dan transisi yang ada', () => {
  expect(repoContextForValidation(makeFixtureRepo())).toEqual({
    templates: { rem: { engine: 'remotion', aspectRatio: '16:9' }, pyt: { engine: 'python', aspectRatio: 'unknown' } },
    brands: ['default', 'other'],
    transitions: ['zoomBlur'],
  });
});
it('brand: logo, dan brand.json rusak ditandai', () => {
  const root = makeFixtureRepo();
  fs.mkdirSync(path.join(root, 'brands', 'default', 'assets'));
  fs.writeFileSync(path.join(root, 'brands', 'default', 'assets', 'logo.png'), 'x');
  fs.writeFileSync(path.join(root, 'brands', 'other', 'brand.json'), '{');
  const c = readCatalog(root);
  expect(c.brands.find(b => b.id === 'default')).toMatchObject({ logo: 'brands/default/assets/logo.png', corrupt: false });
  expect(c.brands.find(b => b.id === 'other')).toMatchObject({ brand: null, corrupt: true, logo: null });
});
// Guard from the plan: tests that read the real repo are skipped when its registry file is absent (e.g. a checkout without the toolkit).
it.skipIf(!fs.existsSync(path.join(realRoot, '_internal', 'toolkit-registry.json')))('repo asli: fakta Lampiran A PRD', () => {
  const c = readCatalog(realRoot);
  expect(c.templates.find(t => t.id === 'sprint-review')).toMatchObject({ engine: 'remotion', aspectRatio: '16:9' });
  expect(c.templates.find(t => t.id === 'concept-explainer-short').engine).toBe('python');
  expect(c.templates.find(t => t.id === 'ai-engineering-review').mismatch).toBe('unregistered');
  expect(c.examples.find(e => e.id === 'the-space-between').mismatch).toBe('missing-folder');
  expect(c.skills.find(s => s.id === 'remotion-official')).toMatchObject({ skillName: 'remotion-best-practices' });
});
