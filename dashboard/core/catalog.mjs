// Toolkit catalog: _internal/toolkit-registry.json merged with what actually sits in the repo folders.
// Never throws for a broken registry or brand.json; the problem is reported in the result (NFR-07).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readJson } from './jsonfile.mjs';
import { resolveInside, toRepoRelative } from './paths.mjs';

const REGISTRY = '_internal/toolkit-registry.json';
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : null);

// Absolute path inside root, or null when it leaves the root or the root is unusable (NFR-02).
function inside(root, ...segs) {
  try { return resolveInside(root, ...segs); } catch { return null; }
}

function list(root, ...segs) {
  const dir = inside(root, ...segs);
  try { return dir ? fs.readdirSync(/*turbopackIgnore: true*/ dir, { withFileTypes: true }) : []; } catch { return []; }
}
const dirNames = (root, ...segs) => list(root, ...segs).filter((e) => e.isDirectory()).map((e) => e.name);
const fileNames = (root, ...segs) => list(root, ...segs).filter((e) => e.isFile()).map((e) => e.name);

function exists(root, rel) {
  const p = inside(root, rel);
  return p !== null && fs.existsSync(/*turbopackIgnore: true*/ p);
}

function readText(root, ...segs) {
  const file = inside(root, ...segs);
  try { return file ? fs.readFileSync(file, 'utf8') : ''; } catch { return ''; }
}

// Top-level `key: value` pairs; indented lines continue the previous value (YAML `description: >` blocks, used by plugin skills)
// and are joined with spaces. shortcut: no escapes or nested maps; add a YAML parser if a SKILL.md needs them.
function frontmatter(root, ...segs) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(readText(root, ...segs));
  const out = {};
  let key = null;
  for (const line of m ? m[1].split(/\r?\n/) : []) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*?)\s*$/.exec(line);
    if (kv) out[key = kv[1]] = /^[>|][-+]?$/.test(kv[2]) ? '' : kv[2];
    else if (key && /^\s+\S/.test(line)) out[key] = `${out[key]} ${line.trim()}`.trimStart();
  }
  for (const k of Object.keys(out)) out[k] = out[k].replace(/^(["'])(.*)\1$/, '$2');
  return out;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// null when the template folder does not exist or id is not a plain folder name.
export function templateInfo(root, id) {
  if (typeof id !== 'string' || !id || id === '.' || id === '..' || /[\\/]/.test(id)) return null;
  const dir = inside(root, 'templates', id);
  if (!dir || !fs.statSync(/*turbopackIgnore: true*/ dir, { throwIfNoEntry: false })?.isDirectory()) return null;
  const pkg = readJson(path.join(dir, 'package.json'));
  const engine = pkg.ok && (pkg.value?.dependencies?.remotion || pkg.value?.devDependencies?.remotion) ? 'remotion' : 'python';
  const config = fileNames(root, 'templates', id, 'src', 'config').filter((f) => f.endsWith('.ts')).sort()
    .map((f) => readText(root, 'templates', id, 'src', 'config', f)).join('\n');
  const num = (name) => Number(new RegExp(`\\b${name}\\s*:\\s*(\\d+)`).exec(config)?.[1]) || null; // types.ts has "width: number;", no digits, so it never matches
  const width = num('width');
  const height = num('height');
  const g = width && height ? gcd(width, height) : 0;
  return { engine, aspectRatio: g ? `${width / g}:${height / g}` : 'unknown', width, height };
}

const NO_TEMPLATE_INFO = { engine: 'python', aspectRatio: 'unknown', width: null, height: null };

// Newest out/*.mp4 of an example, repo-relative.
function newestVideo(root, id) {
  const dir = inside(root, 'examples', id, 'out');
  const videos = fileNames(root, 'examples', id, 'out').filter((f) => f.toLowerCase().endsWith('.mp4'))
    .map((f) => ({ f, mtime: fs.statSync(path.join(/*turbopackIgnore: true*/ dir, f)).mtimeMs })).sort((a, b) => b.mtime - a.mtime);
  return videos.length ? `examples/${id}/out/${videos[0].f}` : null;
}

// brand.json assets.logo, relative to the brand folder and not allowed to leave it (the media route serves brands/ only, and
// ../ would reach other folders), else the first assets/logo.* file.
function brandLogo(root, id, brand) {
  const declared = str(brand?.assets?.logo);
  const abs = declared ? inside(root, 'brands', id, declared) : null;
  const rel = abs && toRepoRelative(root, abs);
  if (abs && rel?.startsWith(`brands/${id}/`) && fs.statSync(/*turbopackIgnore: true*/ abs, { throwIfNoEntry: false })?.isFile()) return rel;
  const found = fileNames(root, 'brands', id, 'assets').find((f) => /^logo\.[^.]+$/i.test(f));
  return found ? `brands/${id}/assets/${found}` : null;
}

function readBrand(root, id) {
  const r = readJson(inside(root, 'brands', id, 'brand.json') ?? '');
  const ok = r.ok && isObj(r.value);
  return { brand: ok ? r.value : null, corrupt: !ok };
}

// Each section: scan() -> Map(id -> found data) from folders; conv(id) -> where the folder is expected when the
// registry gives no path; extra(found, registryEntry) -> section-specific fields. Sections without scan() are registry only.
const SECTIONS = {
  skills: {
    conv: (id) => `.claude/skills/${id}`,
    scan: (root) => new Map(dirNames(root, '.claude', 'skills')
      .filter((id) => fileNames(root, '.claude', 'skills', id).includes('SKILL.md'))
      // The folder name stays the id (it is the registry key). skillName is what the Skill tool and hook events use:
      // .claude/skills/remotion-official/ is invoked as "remotion-best-practices".
      .map((id) => {
        const fm = frontmatter(root, '.claude', 'skills', id, 'SKILL.md');
        return [id, { path: `.claude/skills/${id}`, description: fm.description, skillName: fm.name || id }];
      })),
    extra: (f, r, id) => ({ skillName: f?.skillName ?? id }),
  },
  commands: {
    conv: (id) => `.claude/commands/${id}.md`,
    scan: (root) => new Map(fileNames(root, '.claude', 'commands').filter((f) => f.endsWith('.md')).map((f) => {
      const id = f.slice(0, -3);
      return [id, { path: `.claude/commands/${f}`, description: frontmatter(root, '.claude', 'commands', f).description }];
    })),
  },
  tools: {
    conv: (id) => `tools/${id}.py`,
    // A tool has a __main__ entry point; the other files (__init__.py, config.py, cloud_gpu.py, ...) are modules the tools import.
    scan: (root) => new Map(fileNames(root, 'tools').filter((f) => f.endsWith('.py') && readText(root, 'tools', f).includes('__main__'))
      .map((f) => [f.slice(0, -3), { path: `tools/${f}` }])),
  },
  templates: {
    conv: (id) => `templates/${id}`,
    scan: (root) => new Map(dirNames(root, 'templates').map((id) => [id, { path: `templates/${id}`, info: templateInfo(root, id) }])),
    extra: (f) => f?.info ?? NO_TEMPLATE_INFO,
  },
  examples: {
    conv: (id) => `examples/${id}`,
    scan: (root) => new Map(dirNames(root, 'examples').map((id) => [id, { path: `examples/${id}`, renderedVideo: newestVideo(root, id) }])),
    extra: (f, r) => ({ template: str(r?.template), complexity: str(r?.complexity), renderedVideo: f?.renderedVideo ?? null }),
  },
  transitions: {},
  components: {},
  brands: {
    conv: (id) => `brands/${id}`,
    scan: (root) => new Map(dirNames(root, 'brands').filter((id) => fileNames(root, 'brands', id).includes('brand.json')).map((id) => {
      const { brand, corrupt } = readBrand(root, id);
      return [id, { path: `brands/${id}`, description: str(brand?.description), brand, corrupt, logo: brandLogo(root, id, brand) }];
    })),
    extra: (f) => ({ brand: f?.brand ?? null, corrupt: f?.corrupt ?? false, logo: f?.logo ?? null }),
  },
  cloudProviders: {},
};

function buildItems(root, reg, registryOk, { conv, scan, extra }) {
  const found = scan ? scan(root) : new Map();
  const ids = [...new Set([...Object.keys(reg), ...found.keys()])].sort();
  return ids.map((id) => {
    const r = Object.hasOwn(reg, id) && isObj(reg[id]) ? reg[id] : null;
    const f = found.get(id) ?? null;
    const regPath = str(r?.path)?.replace(/\/+$/, '') ?? conv?.(id) ?? null;
    const p = f?.path ?? regPath;
    return {
      id,
      description: str(r?.description) || f?.description || '',
      status: str(r?.status),
      path: p,
      source: r && f ? 'both' : r ? 'registry' : 'folder',
      // Nothing to compare against when the registry could not be read, so no "unregistered" noise then.
      mismatch: f ? (r || !registryOk ? null : 'unregistered') : p && !exists(root, p) ? 'missing-folder' : null,
      envVars: Array.isArray(r?.envVars) ? r.envVars.filter((v) => typeof v === 'string') : [],
      requires: str(r?.requires),
      category: str(r?.category),
      usage: str(r?.usage),
      options: r?.options ?? null,
      bestFor: str(r?.bestFor),
      ...extra?.(f, r, id),
    };
  });
}

/** @typedef {{ id: string, description: string, status: string | null, path: string | null, source: 'registry' | 'folder' | 'both', mismatch: 'missing-folder' | 'unregistered' | null,
 *   envVars: string[], requires: string | null, category: string | null, usage: string | null, options: unknown, bestFor: string | null }} CatalogItem */
/** @typedef {CatalogItem & { skillName: string }} SkillItem */
/** @typedef {CatalogItem & { engine: 'remotion' | 'python', aspectRatio: string, width: number | null, height: number | null }} TemplateItem */
/** @typedef {CatalogItem & { template: string | null, complexity: string | null, renderedVideo: string | null }} ExampleItem */
/** @typedef {CatalogItem & { brand: Record<string, unknown> | null, corrupt: boolean, logo: string | null }} BrandItem */
/** @typedef {{ registryError: string | null, skills: SkillItem[], commands: CatalogItem[], tools: CatalogItem[], templates: TemplateItem[], examples: ExampleItem[],
 *   transitions: CatalogItem[], components: CatalogItem[], brands: BrandItem[], cloudProviders: CatalogItem[] }} Catalog */

/** @returns {Catalog} */
export function readCatalog(root) {
  const r = readJson(inside(root, ...REGISTRY.split('/')) ?? '');
  const problem = !r.ok ? (r.error === 'missing' ? 'tidak ditemukan' : `rusak (${r.message})`) : !isObj(r.value) ? 'rusak (bukan objek JSON)' : null;
  const reg = problem ? {} : r.value;
  const catalog = { registryError: problem && `${REGISTRY} ${problem}` };
  for (const [name, section] of Object.entries(SECTIONS)) {
    catalog[name] = buildItems(root, isObj(reg[name]) ? reg[name] : {}, !problem, section);
  }
  return catalog;
}

// Only what exists on disk can be used by a flow; transitions are checked against the registry only.
export function repoContextForValidation(root) {
  const c = readCatalog(root);
  const onDisk = (items) => items.filter((i) => i.source !== 'registry');
  return {
    templates: Object.fromEntries(onDisk(c.templates).map((t) => [t.id, { engine: t.engine, aspectRatio: t.aspectRatio }])),
    brands: onDisk(c.brands).map((b) => b.id),
    transitions: c.transitions.map((t) => t.id),
  };
}

// Reads only <root>/.env. Values never leave this function, only whether a key has one.
/** @param {string} root @param {string[]} keys @returns {{ key: string, present: boolean }[]} */
export function envStatus(root, keys) {
  const filled = new Set();
  for (const line of readText(root, '.env').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][\w.-]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue; // blank lines and "# KEY=x" comments
    const value = m[2].startsWith('#') ? '' : m[2].replace(/^(["'])(.*)\1$/, '$2');
    if (value) filled.add(m[1]); else filled.delete(m[1]);
  }
  return keys.map((key) => ({ key, present: filled.has(key) }));
}

/** @param {Catalog} catalog @returns {string[]} */
export function allEnvKeys(catalog) {
  return [...new Set([...catalog.skills, ...catalog.tools, ...catalog.cloudProviders].flatMap((i) => i.envVars))].sort();
}

// Readiness on the Skill page. Keys are only known as filled or empty, and `requires` (a Modal account, ffmpeg) is not checked,
// so such an item says what it needs instead of claiming to be ready.
/** @param {CatalogItem} item @param {Set<string>} filled keys that have a value @returns {'ready' | 'partial' | 'needs-key' | 'needs-setup' | 'missing'} */
export function readiness(item, filled) {
  if (item.mismatch === 'missing-folder') return 'missing';
  const n = item.envVars.filter((k) => filled.has(k)).length;
  if (item.envVars.length) return n === item.envVars.length ? 'ready' : n ? 'partial' : 'needs-key';
  return item.requires ? 'needs-setup' : 'ready';
}

// Claude Code's own folder for user settings, skills and plugins; CLAUDE_CONFIG_DIR moves it, as in Claude Code.
export const defaultClaudeDir = () => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');

/** @typedef {{ id: string, skillName: string, description: string, plugin: string | null, doc: { root: string, path: string } }} GlobalSkill */

// Skills Claude Code loads from outside the repo: <claudeDir>/skills and the skills of every enabled plugin, invoked as
// "<plugin>:<skill>". Frontmatter only, read only, and through resolveInside with claudeDir as the root (AGENTS.md hard rule 2).
// shortcut: user-scope plugin installs only; add project-scope ones (installed_plugins.json projectPath) if a project uses them.
/** @param {string} claudeDir @returns {{ error: string | null, skills: GlobalSkill[] }} */
export function readGlobalSkills(claudeDir) {
  const isSkill = (...segs) => fileNames(claudeDir, ...segs).includes('SKILL.md');
  const skillAt = (...segs) => {
    const fm = frontmatter(claudeDir, ...segs, 'SKILL.md');
    return { id: segs.at(-1), skillName: fm.name || segs.at(-1), description: fm.description || '', doc: { root: claudeDir, path: segs.join('/') } };
  };
  const skillsIn = (...segs) => dirNames(claudeDir, ...segs).filter((d) => isSkill(...segs, d)).sort().map((d) => skillAt(...segs, d));
  // Installers link user skills in from elsewhere (~/.claude/skills/x -> ~/.agents/skills/x), which resolveInside rejects. Only the
  // link target's own SKILL.md is read, guarded with that target as the root.
  const linked = list(claudeDir, 'skills').filter((e) => e.isSymbolicLink()).flatMap((e) => {
    let target;
    try { target = fs.realpathSync.native(/*turbopackIgnore: true*/ path.join(e.parentPath, e.name)); } catch { return []; } // dangling link
    if (!fileNames(target).includes('SKILL.md')) return [];
    const fm = frontmatter(target, 'SKILL.md');
    return [{ id: e.name, skillName: fm.name || e.name, description: fm.description || '', doc: { root: target, path: '' } }];
  });
  const skills = [...skillsIn('skills'), ...linked].sort((a, b) => (a.id < b.id ? -1 : 1)).map((s) => ({ ...s, plugin: null }));
  const settings = readJson(inside(claudeDir, 'settings.json') ?? '');
  const installed = readJson(inside(claudeDir, 'plugins', 'installed_plugins.json') ?? '');
  const enabled = settings.ok && isObj(settings.value?.enabledPlugins) ? settings.value.enabledPlugins : {};
  const plugins = installed.ok && isObj(installed.value?.plugins) ? installed.value.plugins : {};
  for (const key of Object.keys(plugins).sort()) {
    const entry = Array.isArray(plugins[key]) ? plugins[key].find((e) => e?.scope === 'user' && typeof e.installPath === 'string') : null;
    if (enabled[key] !== true || !entry) continue;
    const plugin = key.split('@')[0];
    // An installPath outside claudeDir turns into a ../ path, which resolveInside rejects, so nothing there is read.
    const home = path.relative(claudeDir, entry.installPath).split(path.sep);
    // plugin.json "skills" adds skill folders, or folders of skills, relative to the plugin root (mattpocock-skills uses it).
    const manifest = readJson(inside(claudeDir, ...home, '.claude-plugin', 'plugin.json') ?? '');
    const listed = (manifest.ok ? [manifest.value?.skills].flat() : []).filter((p) => typeof p === 'string')
      .map((p) => [...home, ...p.split('/').filter((s) => s && s !== '.')]);
    const found = [...skillsIn(...home, 'skills'), ...listed.flatMap((segs) => (isSkill(...segs) ? [skillAt(...segs)] : skillsIn(...segs)))];
    for (const s of new Map(found.map((f) => [f.skillName, f])).values()) skills.push({ ...s, skillName: `${plugin}:${s.skillName}`, plugin });
  }
  const broken = [['settings.json', settings], ['plugins/installed_plugins.json', installed]].find(([, r]) => !r.ok && r.error !== 'missing');
  return { error: broken ? `${broken[0]} di folder Claude Code rusak` : null, skills };
}

/** @typedef {{ format: 'markdown' | 'text', file: string, text: string }} ItemDoc */

// What an item does, in its own words, for the Skill detail page: the body of <folder>/SKILL.md or of a command .md file
// (frontmatter removed), or a tool's module docstring (.py). null when there is none. `rel` comes from the catalog, never the URL.
/** @param {string} root @param {string | null} rel @returns {ItemDoc | null} */
export function readItemDoc(root, rel) {
  if (rel === null) return null;
  const segs = rel ? rel.split('/') : [];
  if (rel.endsWith('.py')) {
    // Shebang, comments and blank lines may come first; the docstring is the first statement.
    const m = /^(?:[ \t]*(?:#[^\n]*)?\r?\n)*[ \t]*[rRuU]?("""|''')([\s\S]*?)\1/.exec(readText(root, ...segs));
    const text = m ? m[2].replace(/\r\n/g, '\n').trim() : '';
    return text ? { format: 'text', file: rel, text } : null;
  }
  const file = rel.endsWith('.md') ? segs : [...segs, 'SKILL.md'];
  const text = readText(root, ...file).replace(/^﻿?---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '').replace(/\r\n/g, '\n').trim();
  return text ? { format: 'markdown', file: file.filter(Boolean).join('/'), text } : null;
}
