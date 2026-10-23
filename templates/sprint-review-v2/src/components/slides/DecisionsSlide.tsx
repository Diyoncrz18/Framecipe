import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../../config/theme';
import { hexToRgba } from '../../../../../lib/components/utils';
import type { DecisionsContent } from '../../config/types';

interface DecisionsSlideProps {
  content: DecisionsContent;
}

const IMPACT_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

export const DecisionsSlide: React.FC<DecisionsSlideProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const title = content.title ?? 'Key Decisions';

  const headerOpacity = interpolate(frame, [0, 25], [0, 1], {
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
        padding: 80,
        fontFamily: theme.fonts.primary,
      }}
    >
      <p
        style={{
          color: theme.colors.primary,
          fontSize: 34,
          fontWeight: 500,
          marginBottom: 40,
          textTransform: 'uppercase',
          letterSpacing: 3,
          opacity: headerOpacity,
        }}
      >
        {title}
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 32,
          justifyContent: 'center',
          maxWidth: 1600,
        }}
      >
        {content.items.map((item, index) => {
          const cardDelay = 25 + index * 50;
          const cardSpring = spring({
            frame: frame - cardDelay,
            fps,
            config: { damping: 14, stiffness: 100, mass: 0.8 },
          });
          const cardScale = interpolate(cardSpring, [0, 1], [0.85, 1]);
          const impactColor = item.impact ? IMPACT_COLORS[item.impact] : theme.colors.primary;

          return (
            <div
              key={index}
              style={{
                width: content.items.length <= 2 ? 680 : 460,
                padding: 36,
                borderRadius: 20,
                backgroundColor: hexToRgba(theme.colors.primary, 0.04),
                border: `1px solid ${hexToRgba(theme.colors.primary, 0.12)}`,
                opacity: cardSpring,
                transform: `scale(${cardScale})`,
              }}
            >
              {/* Impact badge */}
              {item.impact && (
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 18,
                    fontWeight: 600,
                    color: impactColor,
                    backgroundColor: hexToRgba(impactColor, 0.12),
                    padding: '4px 14px',
                    borderRadius: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom: 16,
                  }}
                >
                  {item.impact} impact
                </span>
              )}

              {/* Decision */}
              <p
                style={{
                  fontSize: 34,
                  fontWeight: 600,
                  color: theme.colors.textDark,
                  margin: '0 0 12px 0',
                  lineHeight: 1.3,
                }}
              >
                {item.decision}
              </p>

              {/* Rationale */}
              <p
                style={{
                  fontSize: 26,
                  color: theme.colors.textLight,
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {item.rationale}
              </p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
