import React from 'react';
import { OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { VO } from './Soundtrack';
import { C, FONT } from './ui/theme';

const SIZE = 300;

// How strongly Lugh is "speaking" at this frame, eased in and out around each VO line
const speaking = (frame: number) =>
  Math.max(
    0,
    ...VO.map(([, at, len]) =>
      interpolate(frame, [at - 4, at + 2, at + len - 2, at + len + 6], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
    ),
  );

// A participant tile in the style of a Digital Samba room: dark frame, rounded video,
// name pill bottom-left, primary-blue ring while talking (the room's active-speaker cue).
export const NarratorTile: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 2, fps, config: { damping: 200 }, durationInFrames: 20 });
  const talk = speaking(frame);

  return (
    <div
      style={{
        position: 'absolute',
        right: 40,
        bottom: 40,
        width: SIZE,
        height: SIZE,
        padding: 6,
        borderRadius: 16,
        background: '#272a2e',
        boxShadow: `0 0 0 ${3 * talk}px ${C.primary}, 0 18px 50px rgba(20,24,40,0.35)`,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 30}px)`,
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden' }}>
        <OffthreadVideo src={staticFile('narrator.mp4')} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div
          style={{
            position: 'absolute',
            left: 10,
            bottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 10px',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.55)',
            color: C.white,
            fontFamily: FONT,
            fontSize: 17,
            fontWeight: 500,
          }}
        >
          {/* Mic level: three bars that move while talking */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  borderRadius: 2,
                  background: talk > 0.5 ? '#4ade80' : 'rgba(255,255,255,0.7)',
                  height: 4 + talk * (5 + 5 * Math.abs(Math.sin(frame * 0.6 + i * 1.7))),
                }}
              />
            ))}
          </div>
          Lugh
          <span style={{ fontSize: 12, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: C.primary }}>AI</span>
        </div>
      </div>
    </div>
  );
};
