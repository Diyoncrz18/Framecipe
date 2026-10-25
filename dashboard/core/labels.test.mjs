import { expect, it } from 'vitest';
import { EVENT_TYPES, PHASE_BY_STAGE, STAGES } from './contracts.mjs';
import { DISPLAY_STATUSES, EVENT_LABELS, PHASE_LABELS, SOURCE_KIND_LABELS, STAGE_LABELS, STATUS_LABELS } from './labels.mjs';
import { SOURCE_KINDS } from './source-files.mjs';

it('setiap status, tahap, fase, dan jenis event punya label', () => {
  expect(Object.keys(STATUS_LABELS).sort()).toEqual([...DISPLAY_STATUSES].sort());
  for (const s of STAGES) expect(STAGE_LABELS[s]).toBeTruthy();
  for (const p of Object.values(PHASE_BY_STAGE)) expect(PHASE_LABELS[p]).toBeTruthy();
  for (const t of [...EVENT_TYPES, 'stage']) expect(EVENT_LABELS[t]).toBeTruthy();
  expect(Object.keys(SOURCE_KIND_LABELS)).toEqual(SOURCE_KINDS);
});
