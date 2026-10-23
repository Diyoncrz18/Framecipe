/**
 * Scripted Mouse Cursor
 *
 * An arrow cursor that follows a keyframe path with eased moves, squashes on each
 * click and throws a ripple. Built for synthetic UI demos, where the screens are
 * rebuilt as React and every click is a frame number (see the synthetic-ui-demo skill).
 *
 * Coordinates are in the parent's pixel space. Inside a <Stage> that is the app canvas,
 * so click targets can be layout constants.
 *
 * @example
 * ```tsx
 * import { Cursor, cursorAt } from '../../../../lib/components';
 *
 * const PATH = [
 *   { f: 0, x: 900, y: 600 },
 *   { f: 20, x: 900, y: 600 },   // hold
 *   { f: 46, x: 412, y: 318 },   // move to the button
 * ];
 * const CLICKS = [52];
 *
 * const frame = useCurrentFrame();
 * const pos = cursorAt(frame, PATH);
 * <Cursor x={pos.x} y={pos.y} clicks={CLICKS} frame={frame} />
 * ```
 */

import React from 'react';
import { Easing, interpolate } from 'remotion';

export type CursorPoint = { f: number; x: number; y: number };

const ease = Easing.bezier(0.65, 0, 0.35, 1);

/** Position along a list of keyframes. Holds still between equal keyframes, eases between different ones. */
export const cursorAt = (frame: number, path: CursorPoint[]): CursorPoint => {
  if (frame <= path[0].f) return path[0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (frame <= b.f) {
      const t = ease((frame - a.f) / (b.f - a.f));
      return { f: frame, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return path[path.length - 1];
};

/** 0 -> 1 -> 0 over a short press starting at `at` */
export const press = (frame: number, at: number) =>
  interpolate(frame, [at, at + 3, at + 9], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

/** Whether the cursor is over a point, for hover states */
export const near = (a: { x: number; y: number }, b: { x: number; y: number }, rx = 60, ry = 18) =>
  Math.abs(a.x - b.x) < rx && Math.abs(a.y - b.y) < ry;

export interface CursorProps {
  /** Tip position */
  x: number;
  y: number;
  /** Frames at which a click starts */
  clicks: number[];
  /** Current frame (pass useCurrentFrame()) */
  frame: number;
  opacity?: number;
  /** Click ripple colour (default: a soft blue) */
  rippleColor?: string;
  /** Cursor size in px (default: 28) */
  size?: number;
}

const RIPPLE_FRAMES = 18;

export const Cursor: React.FC<CursorProps> = ({
  x,
  y,
  clicks,
  frame,
  opacity = 1,
  rippleColor = 'rgba(55,113,224,0.7)',
  size = 28,
}) => {
  const squash = Math.max(0, ...clicks.map((c) => press(frame, c)));
  const k = size / 28;
  return (
    <>
      {clicks.map((c) => {
        const t = frame - c;
        if (t < 0 || t > RIPPLE_FRAMES) return null;
        const p = t / RIPPLE_FRAMES;
        return (
          <div
            key={c}
            style={{
              position: 'absolute',
              left: x - 22 * k,
              top: y - 22 * k,
              width: 44 * k,
              height: 44 * k,
              borderRadius: '50%',
              border: `${3 * k}px solid ${rippleColor}`,
              transform: `scale(${0.4 + p * 0.9})`,
              opacity: (1 - p) * opacity,
            }}
          />
        );
      })}
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        style={{
          position: 'absolute',
          left: x - 6 * k,
          top: y - 3 * k,
          opacity,
          transform: `scale(${1 - squash * 0.15})`,
          transformOrigin: `${6 * k}px ${3 * k}px`,
          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))',
        }}
      >
        <path d="M6 3 L6 23 L11 18.5 L14.5 26 L18 24.5 L14.5 17 L21 17 Z" fill="#000" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </>
  );
};
