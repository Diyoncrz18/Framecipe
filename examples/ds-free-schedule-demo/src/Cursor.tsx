import React from 'react';
import { Easing, interpolate } from 'remotion';

export type Point = { f: number; x: number; y: number };

const ease = Easing.bezier(0.65, 0, 0.35, 1);

// Position along a list of keyframes; holds still between a keyframe and the next move
export const cursorAt = (frame: number, path: Point[]) => {
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

// 0 -> 1 -> 0 over a short press starting at `at`
export const press = (frame: number, at: number) =>
  interpolate(frame, [at, at + 3, at + 9], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

export const Cursor: React.FC<{ x: number; y: number; clicks: number[]; frame: number; opacity?: number }> = ({
  x,
  y,
  clicks,
  frame,
  opacity = 1,
}) => {
  const squash = Math.max(0, ...clicks.map((c) => press(frame, c)));
  return (
    <>
      {clicks.map((c) => {
        const t = frame - c;
        if (t < 0 || t > 18) return null;
        const p = t / 18;
        return (
          <div
            key={c}
            style={{
              position: 'absolute',
              left: x - 22,
              top: y - 22,
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '3px solid rgba(55,113,224,0.7)',
              transform: `scale(${0.4 + p * 0.9})`,
              opacity: 1 - p,
            }}
          />
        );
      })}
      <svg
        width={28}
        height={28}
        viewBox="0 0 28 28"
        style={{
          position: 'absolute',
          left: x - 6,
          top: y - 3,
          opacity,
          transform: `scale(${1 - squash * 0.15})`,
          transformOrigin: '6px 3px',
          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))',
        }}
      >
        <path d="M6 3 L6 23 L11 18.5 L14.5 26 L18 24.5 L14.5 17 L21 17 Z" fill="#000" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </>
  );
};
