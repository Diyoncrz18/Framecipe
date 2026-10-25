import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { allEnvKeys, envStatus, readCatalog, readGlobalSkills, readiness, repoContextForValidation, templateInfo } from './catalog.mjs';
import { makeFixtureRepo, makeTempRoot } from './test-utils.mjs';

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
it('deskripsi multi-baris (description: >) digabung dengan spasi', () => {
  const root = makeFixtureRepo();
  fs.mkdirSync(path.join(root, '.claude', 'skills', 'multi'));
  // CRLF like a Windows checkout; a blank line inside the block and the nested metadata key must not break description.
  fs.writeFileSync(path.join(root, '.claude', 'skills', 'multi', 'SKILL.md'),
    ['---', 'name: multi', 'description: >', '  Baris satu,', '', '  baris dua.', 'metadata:', '  type: x', '---', ''].join('\r\n'));
  fs.writeFileSync(path.join(root, '.claude', 'skills', 'bar', 'SKILL.md'), ['---', 'description: "Satu', '  dua"', '---', ''].join('\n'));
  const c = readCatalog(root);
  expect(c.skills.find(s => s.id === 'multi').description).toBe('Baris satu, baris dua.');
  expect(c.skills.find(s => s.id === 'bar').description).toBe('Satu dua');
});
it('tool hanya skrip dengan __main__; modul pembantu tidak ikut', () => {
  const root = makeFixtureRepo();
  fs.mkdirSync(path.join(root, 'tools'));
  for (const f of ['voiceover.py', 'cutdown.py']) fs.writeFileSync(path.join(root, 'tools', f), 'if __name__ == "__main__": main()');
  for (const f of ['__init__.py', 'config.py']) fs.writeFileSync(path.join(root, 'tools', f), 'X = 1');
  expect(readCatalog(root).tools.map(t => [t.id, t.source])).toEqual([['cutdown', 'folder'], ['voiceover', 'both']]);
});
it('readiness: siap, sebagian, perlu key, perlu prasyarat, folder hilang', () => {
  const item = (o) => ({ envVars: [], requires: null, mismatch: null, ...o });
  const filled = new Set(['A']);
  expect(readiness(item({}), filled)).toBe('ready');
  expect(readiness(item({ envVars: ['A'] }), filled)).toBe('ready');
  expect(readiness(item({ envVars: ['A', 'B'] }), filled)).toBe('partial');
  expect(readiness(item({ envVars: ['B'], requires: 'Modal' }), filled)).toBe('needs-key');
  expect(readiness(item({ requires: 'ffmpeg' }), filled)).toBe('needs-setup');
  expect(readiness(item({ mismatch: 'missing-folder' }), filled)).toBe('missing');
});
it('readGlobalSkills: skill pengguna dan plugin aktif, tanpa keluar dari folder Claude', () => {
  const dir = makeTempRoot();
  const write = (rel, text) => { const p = path.join(dir, ...rel.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  const skill = (...lines) => ['---', ...lines, '---', ''].join('\n');
  write('skills/mine/SKILL.md', skill('name: mine', 'description: Milik saya'));
  write('skills/empty/README.md', 'bukan skill');
  write('plugins/cache/m/hf/1.0/skills/hyperframes/SKILL.md', skill('name: hyperframes', 'description: >', '  Tulis HTML,', '  render video.'));
  write('plugins/cache/m/off/1.0/skills/x/SKILL.md', skill('name: x'));
  // plugin.json "skills": one skill folder, one folder of skills, and a path back into the default skills/ (no duplicate).
  write('plugins/cache/m/hf/1.0/.claude-plugin/plugin.json', JSON.stringify({ skills: ['./skills/eng/tdd', './extra', './skills/hyperframes', 5] }));
  write('plugins/cache/m/hf/1.0/skills/eng/tdd/SKILL.md', skill('name: tdd'));
  write('plugins/cache/m/hf/1.0/extra/grill/SKILL.md', skill('name: grill'));
  const outside = makeTempRoot();
  fs.mkdirSync(path.join(outside, 'skills', 'evil'), { recursive: true });
  fs.writeFileSync(path.join(outside, 'skills', 'evil', 'SKILL.md'), skill('name: evil'));
  // A user skill linked in from elsewhere is read (its SKILL.md only); a dangling link and a linked non-skill folder are not.
  fs.mkdirSync(path.join(outside, 'agents', 'linked'), { recursive: true });
  fs.writeFileSync(path.join(outside, 'agents', 'linked', 'SKILL.md'), skill('name: linked', 'description: Lewat tautan'));
  fs.mkdirSync(path.join(outside, 'agents', 'plain'));
  fs.mkdirSync(path.join(outside, 'agents', 'gone'));
  for (const name of ['linked', 'plain', 'gone']) fs.symlinkSync(path.join(outside, 'agents', name), path.join(dir, 'skills', name), 'junction');
  fs.rmdirSync(path.join(outside, 'agents', 'gone'));
  const user = (p) => [{ scope: 'user', installPath: p }];
  write('plugins/installed_plugins.json', JSON.stringify({ version: 2, plugins: {
    'hf@m': user(path.join(dir, 'plugins', 'cache', 'm', 'hf', '1.0')),
    'off@m': user(path.join(dir, 'plugins', 'cache', 'm', 'off', '1.0')),
    'evil@m': user(outside),
    'proj@m': [{ scope: 'project', installPath: path.join(dir, 'plugins', 'cache', 'm', 'hf', '1.0') }],
  } }));
  write('settings.json', JSON.stringify({ enabledPlugins: { 'hf@m': true, 'off@m': false, 'evil@m': true, 'proj@m': true } }));
  expect(readGlobalSkills(dir)).toEqual({ error: null, skills: [
    { id: 'linked', skillName: 'linked', description: 'Lewat tautan', plugin: null },
    { id: 'mine', skillName: 'mine', description: 'Milik saya', plugin: null },
    { id: 'hyperframes', skillName: 'hf:hyperframes', description: 'Tulis HTML, render video.', plugin: 'hf' },
    { id: 'tdd', skillName: 'hf:tdd', description: '', plugin: 'hf' },
    { id: 'grill', skillName: 'hf:grill', description: '', plugin: 'hf' },
  ] });

  write('plugins/installed_plugins.json', '{');
  expect(readGlobalSkills(dir)).toMatchObject({ error: expect.stringContaining('installed_plugins.json'), skills: [{ id: 'linked' }, { id: 'mine' }] });
  expect(readGlobalSkills(path.join(dir, 'tidak-ada'))).toEqual({ error: null, skills: [] });
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
  const regFile = path.join(root, '_internal', 'toolkit-registry.json');
  const reg = JSON.parse(fs.readFileSync(regFile, 'utf8')); reg.skills.foo.envVars = ['IDEOGRAM_API_KEY'];
  fs.writeFileSync(regFile, JSON.stringify(reg));
  expect(allEnvKeys(readCatalog(root))).toEqual(['ELEVENLABS_API_KEY', 'IDEOGRAM_API_KEY', 'RUNPOD_API_KEY']); // skills count too
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
it('brand: logo dari assets.logo di brand.json, tidak boleh keluar dari folder brand', () => {
  const root = makeFixtureRepo();
  const touch = (rel) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), 'x'); };
  const setLogo = (id, logo) => fs.writeFileSync(path.join(root, 'brands', id, 'brand.json'), JSON.stringify({ name: id, assets: { logo } }));
  const logoOf = (id) => readCatalog(root).brands.find(b => b.id === id).logo;

  touch('brands/default/assets/ds-logo.png');
  touch('brands/default/assets/logo.png');
  setLogo('default', 'assets/ds-logo.png');
  expect(logoOf('default')).toBe('brands/default/assets/ds-logo.png'); // declared wins over assets/logo.*

  touch('x.png');
  touch('brands/other/assets/o.png');
  // Leaves the repo, reaches the repo root, reaches another brand, absolute path, missing file, not a string: all ignored.
  for (const bad of ['../../../x.png', '../../x.png', '../other/assets/o.png', path.join(root, 'x.png'), 'assets/missing.png', 5]) {
    setLogo('default', bad);
    expect(logoOf('default'), String(bad)).toBe('brands/default/assets/logo.png');
  }
  setLogo('other', '../../x.png');
  expect(logoOf('other')).toBeNull(); // nothing valid and no assets/logo.*
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
