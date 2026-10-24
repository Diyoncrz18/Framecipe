import { expect, it } from 'vitest';
import { parseFlow } from './contracts.mjs';
import { MUSIC_KEYS, VOICE_PROVIDER_KEYS, defaultFlow, durationSegments, moveScene } from './flow-form.mjs';
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
