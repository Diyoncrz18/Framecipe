import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../../config/theme';
import { hexToRgba } from '../../../../../lib/components/utils';

interface AnimatedLabelProps {
  text: string;
  jiraRef?: string;
}

/**
 * Cinematic lower-third label with spring-animated slide-in,
 * accent color bar, and frosted glass background.
 */
export const AnimatedLabel: React.FC<AnimatedLabelProps> = ({ text, jiraRef }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();

  // Slide in from left with spring
  const slideProgress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.9 },
  });

  const translateX = interpolate(slideProgress, [0, 1], [-400, 0]);

  // Accent bar grows in height
  const barHeight = interpolate(slideProgress, [0, 1], [0, 100]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        left: 0,
        display: 'flex',
        alignItems: 'stretch',
        opacity: slideProgress,
        transform: `translateX(${translateX}px)`,
      }}
    >
      {/* Accent color bar */}
      <div
        style={{
          width: 5,
          backgroundColor: theme.colors.primary,
          borderRadius: '3px 0 0 3px',
          clipPath: `inset(${100 - barHeight}% 0 0 0)`,
        }}
      />

      {/* Frosted glass label body */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '16px 32px 16px 20px',
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '0 10px 10px 0',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
        }}
      >
        <span
          style={{
            fontFamily: theme.fonts.primary,
            fontSize: 28,
            fontWeight: 600,
            color: theme.colors.textDark,
          }}
        >
          {text}
        </span>

        {jiraRef && (
          <span
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 20,
              fontWeight: 500,
              color: theme.colors.primary,
              backgroundColor: hexToRgba(theme.colors.primary, 0.1),
              padding: '4px 10px',
              borderRadius: 6,
            }}
          >
            {jiraRef}
          </span>
        )}
      </div>
    </div>
  );
};

