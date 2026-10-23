import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../../config/theme';
import { hexToRgba } from '../../../../../lib/components/utils';
import type { ContextContent } from '../../config/types';

interface ContextSlideProps {
  content: ContextContent;
}

export const ContextSlide: React.FC<ContextSlideProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();

  // Pillar badge
  const badgeSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12, stiffness: 150 },
  });

  // Narrative text
  const textOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textY = interpolate(frame, [20, 50], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 100,
        fontFamily: theme.fonts.primary,
      }}
    >
      {/* Decorative quote mark */}
      <div
        style={{
          fontSize: 120,
          color: hexToRgba(theme.colors.primary, 0.1),
          lineHeight: 0.8,
          marginBottom: -20,
          fontWeight: 700,
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        {'\u201C'}
      </div>

      {/* Pillar badge */}
      {content.pillar && (
        <div
          style={{
            marginBottom: 32,
            opacity: badgeSpring,
            transform: `scale(${interpolate(badgeSpring, [0, 1], [0.8, 1])})`,
          }}
        >
          <span
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: theme.colors.primary,
              backgroundColor: hexToRgba(theme.colors.primary, 0.1),
              padding: '8px 24px',
              borderRadius: 20,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            {content.pillar}
          </span>
        </div>
      )}

      {/* Narrative text */}
      <p
        style={{
          fontSize: 52,
          fontWeight: 500,
          color: theme.colors.textDark,
          textAlign: 'center',
          lineHeight: 1.4,
          maxWidth: 1400,
          margin: '0 0 48px 0',
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        {content.narrative}
      </p>

      {/* Key points */}
      {content.keyPoints && content.keyPoints.length > 0 && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          {content.keyPoints.map((point, index) => {
            const pointDelay = 60 + index * 25;
            const pointSpring = spring({
              frame: frame - pointDelay,
              fps,
              config: { damping: 14, stiffness: 120, mass: 0.7 },
            });

            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 28px',
                  borderRadius: 12,
                  backgroundColor: hexToRgba(theme.colors.primary, 0.05),
                  border: `1px solid ${hexToRgba(theme.colors.primary, 0.1)}`,
                  opacity: pointSpring,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: theme.colors.primary,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 28, color: theme.colors.textMedium }}>
                  {point}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};
