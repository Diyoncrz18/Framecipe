/**
 * Smart transition resolver for sprint-review-v2
 *
 * Picks sensible default transitions between scene pairs.
 * Can be overridden per-scene via `transition` in SceneConfig.
 */

import { linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { lightLeak } from '../../../../lib/transitions/presentations/light-leak';
import { glitch } from '../../../../lib/transitions/presentations/glitch';
import { rgbSplit } from '../../../../lib/transitions/presentations/rgb-split';
import { zoomBlur } from '../../../../lib/transitions/presentations/zoom-blur';
import type { TransitionPresentation } from '@remotion/transitions';
import type { SceneConfig, SceneType, TransitionPreset } from './types';

export interface ResolvedTransition {
  presentation: TransitionPresentation<Record<string, unknown>>;
  timing: ReturnType<typeof linearTiming>;
  durationFrames: number;
}

const DEFAULT_DURATIONS: Record<TransitionPreset, number> = {
  'fade': 25,
  'slide': 20,
  'slide-left': 20,
  'slide-up': 20,
  'light-leak-warm': 35,
  'light-leak-cool': 35,
  'glitch': 20,
  'rgb-split': 20,
  'zoom-blur': 25,
  'wipe': 25,
  'none': 0,
};

function getPresentation(preset: TransitionPreset): TransitionPresentation<Record<string, unknown>> {
  switch (preset) {
    case 'fade':
      return fade() as TransitionPresentation<Record<string, unknown>>;
    case 'slide':
      return slide({ direction: 'from-right' }) as TransitionPresentation<Record<string, unknown>>;
    case 'slide-left':
      return slide({ direction: 'from-left' }) as TransitionPresentation<Record<string, unknown>>;
    case 'slide-up':
      return slide({ direction: 'from-bottom' }) as TransitionPresentation<Record<string, unknown>>;
    case 'light-leak-warm':
      return lightLeak({ temperature: 'warm' }) as TransitionPresentation<Record<string, unknown>>;
    case 'light-leak-cool':
      return lightLeak({ temperature: 'cool' }) as TransitionPresentation<Record<string, unknown>>;
    case 'glitch':
      return glitch() as TransitionPresentation<Record<string, unknown>>;
    case 'rgb-split':
      return rgbSplit() as TransitionPresentation<Record<string, unknown>>;
    case 'zoom-blur':
      return zoomBlur() as TransitionPresentation<Record<string, unknown>>;
    case 'wipe':
      return wipe() as TransitionPresentation<Record<string, unknown>>;
    case 'none':
      return fade() as TransitionPresentation<Record<string, unknown>>;
  }
}

/**
 * Pick a default transition preset based on the previous and next scene types.
 */
function getDefaultPreset(_prev: SceneType, next: SceneType): TransitionPreset {
  switch (next) {
    case 'demo':
      return 'slide';
    case 'summary':
      return 'light-leak-warm';
    case 'credits':
      return 'fade';
    case 'goal':
      return 'fade';
    case 'highlights':
      return 'fade';
    case 'carryover':
      return 'slide-left';
    case 'decisions':
      return 'fade';
    case 'metrics':
      return 'zoom-blur';
    case 'learnings':
      return 'fade';
    case 'roadmap':
      return 'light-leak-cool';
    case 'context':
      return 'fade';
    case 'title':
      return 'fade';
    default:
      return 'fade';
  }
}

/**
 * Resolve the transition to use between two scenes.
 * If `nextScene` has a transition override, use that; otherwise use smart defaults.
 */
export function resolveTransition(
  prevScene: SceneConfig,
  nextScene: SceneConfig,
): ResolvedTransition | null {
  const override = nextScene.transition;

  if (override?.preset === 'none') {
    return null;
  }

  const preset = override?.preset ?? getDefaultPreset(prevScene.type, nextScene.type);
  const durationFrames = override?.durationFrames ?? DEFAULT_DURATIONS[preset];

  return {
    presentation: getPresentation(preset),
    timing: linearTiming({ durationInFrames: durationFrames }),
    durationFrames,
  };
}

/**
 * Calculate total video duration in frames from scenes and transitions.
 * TransitionSeries overlaps reduce total duration by each transition's duration.
 */
export function calculateTotalFrames(scenes: SceneConfig[], fps: number): number {
  if (scenes.length === 0) return 0;

  // Sum of all scene durations
  const totalSceneFrames = scenes.reduce(
    (sum, scene) => sum + Math.round(scene.durationSeconds * fps),
    0,
  );

  // Sum of all transition overlaps
  let totalTransitionOverlap = 0;
  for (let i = 1; i < scenes.length; i++) {
    const resolved = resolveTransition(scenes[i - 1], scenes[i]);
    if (resolved) {
      totalTransitionOverlap += resolved.durationFrames;
    }
  }

  return totalSceneFrames - totalTransitionOverlap;
}
