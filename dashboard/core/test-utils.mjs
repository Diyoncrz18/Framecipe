import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const created = [];

// New empty temp folder. The default prefix contains a space, like the real repo path ("MY FOLDER").
// Tracked so test-setup.mjs can delete it after each test file.
export function makeTempRoot(prefix = 'MY FOLDER ') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  created.push(dir);
  return dir;
}

// Deletes every folder makeTempRoot made. rmSync removes a junction/symlink itself, never the folder it points to.
export function cleanupTempRoots() {
  for (const dir of created.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); // retries: Windows may still hold a handle
    } catch (e) {
      console.warn(`Temp folder not removed: ${dir} (${e.message})`);
    }
  }
}

function write(root, rel, content) {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
}

// The sample flow from fixtures/flow.valid.json, pointed at the fixture repo's "rem" template.
export function fixtureFlow(overrides = {}) {
  const flow = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'flow.valid.json'), 'utf8'));
  return { ...flow, template: 'rem', ...overrides };
}

// Small fake toolkit repo. Registry and folders disagree on purpose: ghost (registered, no folder),
// unreg/bar/other (folder, not registered), video/voiceover/zoomBlur/Cmp (registered, files not created).
export function makeFixtureRepo() {
  const root = makeTempRoot();
  fs.mkdirSync(path.join(root, '.git'));
  write(root, '_internal/toolkit-registry.json', {
    name: 'fixture',
    version: '0.0.0',
    skills: { foo: { path: '.claude/skills/foo/', description: 'Foo skill', status: 'stable' } },
    commands: { video: { path: '.claude/commands/video.md', description: 'Video projects', status: 'stable' } },
    tools: { voiceover: { path: 'tools/voiceover.py', description: 'Voiceover', status: 'stable', envVars: ['ELEVENLABS_API_KEY'] } },
    templates: {
      rem: { path: 'templates/rem/', description: 'Remotion template', status: 'stable' },
      pyt: { path: 'templates/pyt/', description: 'Python template', status: 'beta' },
    },
    examples: {
      'ex-a': { path: 'examples/ex-a/', description: 'Example A', template: 'rem', complexity: 'beginner' },
      ghost: { path: 'examples/ghost/', description: 'Example without a folder', template: 'rem', complexity: 'beginner' },
    },
    transitions: { zoomBlur: { path: 'lib/transitions/presentations/zoom-blur.tsx', description: 'Zoom blur', options: ['direction'], bestFor: 'CTAs', status: 'stable' } },
    components: { Cmp: { path: 'lib/components/Cmp.tsx', description: 'Component' } },
    brands: { default: { path: 'brands/default/', description: 'Default brand' } },
    cloudProviders: { runpod: { name: 'RunPod', description: 'GPU cloud', envVars: ['RUNPOD_API_KEY'] } },
  });
  write(root, 'templates/rem/package.json', {
    name: 'rem',
    dependencies: { remotion: '4.0.529' },
    scripts: { render: 'npx remotion render src/index.ts Rem out/rem.mp4' },
  });
  write(root, 'templates/rem/src/config/video.ts', 'export const video = {\n  width: 1920,\n  height: 1080,\n};\n');
  write(root, 'templates/rem/node_modules/x.txt', 'x');
  write(root, 'templates/rem/out/old.mp4', 'old');
  write(root, 'templates/pyt/build.py', 'print("hi")\n');
  write(root, 'brands/default/brand.json', { name: 'Default', description: 'Default brand' });
  write(root, 'brands/other/brand.json', { name: 'Other', description: 'Other brand' });
  write(root, 'examples/ex-a/out/v.mp4', 'v');
  fs.mkdirSync(path.join(root, 'examples', 'unreg'), { recursive: true });
  write(root, '.claude/skills/foo/SKILL.md', '---\nname: foo\ndescription: Foo skill\n---\n# Foo\n');
  write(root, '.claude/skills/bar/SKILL.md', '---\ndescription: Bar skill\n---\n# Bar\n');
  write(root, '.env', 'ELEVENLABS_API_KEY=abc\nRUNPOD_API_KEY=\n# IDEOGRAM_API_KEY=x\n');
  write(root, 'flows/contoh-penjelasan/flow.json', fixtureFlow());
  return root;
}

// Without a trailing Z the time is local (use it when a runId or archive name is asserted, they use local time);
// with Z it is UTC (use it when an ISO string is asserted).
export function at(iso) {
  return new Date(iso);
}
