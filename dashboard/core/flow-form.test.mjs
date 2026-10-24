import { expect, it } from 'vitest';
import { parseFlow } from './contracts.mjs';
import { MUSIC_KEYS, VOICE_PROVIDER_KEYS, coerceDraft, defaultFlow, durationSegments, moveScene } from './flow-form.mjs';
import { fixtureFlow } from './test-utils.mjs';

it('moveScene dan durationSegments', () => {
  const s = ['a', 'b', 'c'].map(id => ({ id }));
  expect(moveScene(s, 0, -1)).toBe(s);
  expect(moveScene(s, 2, 1)).toBe(s);
  expect(moveScene(s, 5, -1)).toBe(s);
  expect(moveScene(s, 1, -1).map(x => x.id)).toEqual(['b', 'a', 'c']);
  expect(moveScene(s, 1, 1).map(x => x.id)).toEqual(['a', 'c', 'b']);
  expect(s.map(x => x.id)).toEqual(['a', 'b', 'c']); // the input is not changed
  expect(durationSegments(fixtureFlow().scenes).map(x => x.percent)).toEqual([14.3, 42.9, 25, 17.9]);
  expect(durationSegments(fixtureFlow().scenes)[0]).toEqual({ id: 'hook', label: 'Hook', seconds: 4, percent: 14.3 });
  expect(durationSegments([{ id: 'x', label: 'X', durationSeconds: 0 }])[0].percent).toBe(0);
  expect(durationSegments([])).toEqual([]);
});

it('defaultFlow menghasilkan alur yang lolos skema setelah id dan nama diisi', () => {
  const flow = defaultFlow('rem', 'default', { width: 1080, height: 1920, aspectRatio: '9:16' });
  expect(flow).toMatchObject({ template: 'rem', brand: 'default', language: 'id', approval: 'auto', references: [], skills: [],
    output: { aspectRatio: '9:16', width: 1080, height: 1920, targetDurationSeconds: 30 },
    scenes: [{ id: 'pembuka', label: 'Pembuka', goal: '', durationSeconds: 5, rules: [], narration: false }],
    audio: { voiceover: { enabled: false }, music: { enabled: false }, captions: { enabled: false } } });
  expect(defaultFlow('rem', 'default', { width: 1, height: 1, aspectRatio: '1:1' }).scenes).not.toBe(flow.scenes); // a fresh object each call
  const filled = { ...flow, id: 'x', name: 'X', scenes: [{ ...flow.scenes[0], goal: 'tujuan' }], version: 1, updatedAt: '2026-10-24T00:00:00.000Z' };
  expect(parseFlow(filled).ok).toBe(true);
});

it('daftar key cloud per provider', () => {
  expect(VOICE_PROVIDER_KEYS).toEqual({ elevenlabs: ['ELEVENLABS_API_KEY'], qwen3: ['RUNPOD_API_KEY'], '60db': ['SIXTYDB_API_KEY'] });
  expect(MUSIC_KEYS).toEqual(['ACEMUSIC_API_KEY']);
});

it('coerceDraft: alur yang sah lolos tanpa perubahan isi', () => {
  const flow = fixtureFlow();
  const draft = coerceDraft(flow);
  expect(draft).toMatchObject({ id: flow.id, name: flow.name, template: flow.template, brand: flow.brand, language: flow.language,
    skills: flow.skills, approval: flow.approval, notes: flow.notes, references: flow.references,
    output: flow.output, style: flow.style, audio: { voiceover: { enabled: false }, music: { enabled: false }, captions: { enabled: false } } });
  expect(draft.scenes).toEqual(flow.scenes.map(s => ({ visualHint: undefined, transitionOut: undefined, ...s })));
  expect(parseFlow({ ...draft, version: 1, updatedAt: flow.updatedAt }).ok).toBe(true);
});

it('coerceDraft: tipe salah di flow.json yang diedit tangan tidak membuat editor error', () => {
  const crash = (patch) => coerceDraft({ ...fixtureFlow(), ...patch });
  const scene = (patch) => crash({ scenes: [{ ...fixtureFlow().scenes[0], ...patch }] }).scenes[0];
  expect(scene({ rules: 'x' }).rules).toEqual([]);
  expect(scene({ rules: ['a', 1, null, 'b'] }).rules).toEqual(['a', 'b']);
  expect(scene({ label: null }).label).toBe('');
  expect(scene({ id: 5, goal: {}, visualHint: 7 })).toMatchObject({ id: '', goal: '', visualHint: undefined });
  expect(scene({ durationSeconds: '4' }).durationSeconds).toBe('');
  expect(scene({ durationSeconds: NaN }).durationSeconds).toBe('');
  expect(scene({ narration: 'ya' }).narration).toBe(false);
  expect(crash({ style: { rules: 'x' } }).style.rules).toEqual([]);
  expect(crash({ skills: 'x' }).skills).toEqual([]);
  expect(crash({ skills: ['a', 2] }).skills).toEqual(['a']);
  expect(crash({ references: {} }).references).toEqual([]);
  expect(crash({ references: [null, 'x', { kind: 'link', url: 'u', note: 3 }] }).references).toEqual([{ kind: 'link', id: undefined, path: undefined, url: 'u', note: undefined }]);
  expect(crash({ scenes: 'x' }).scenes).toEqual([]);
  expect(crash({ scenes: [null, 4, {}] }).scenes).toHaveLength(1);
  expect(crash({ approval: 'nope' }).approval).toBe('auto');
});

it('coerceDraft: bagian yang bukan objek atau JSON yang bukan objek tetap menghasilkan draf utuh', () => {
  for (const raw of [null, 'x', 7, [], { output: 5, audio: 'x', style: [], scenes: {}, references: 'r', skills: null }]) {
    const d = coerceDraft(raw);
    expect(d).toMatchObject({ id: '', name: '', scenes: [], references: [], skills: [], approval: 'auto',
      output: { aspectRatio: '', width: '', targetDurationSeconds: '' }, style: { rules: [] },
      audio: { voiceover: { enabled: false }, music: { enabled: false }, captions: { enabled: false } } });
  }
  expect(coerceDraft({ audio: { voiceover: { enabled: 'true', provider: 'qwen3' }, captions: null } }).audio)
    .toMatchObject({ voiceover: { enabled: false, provider: 'qwen3' }, captions: { enabled: false } });
});
