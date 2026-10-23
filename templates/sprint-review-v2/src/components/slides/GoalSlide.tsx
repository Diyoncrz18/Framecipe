import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../../config/theme';
import { hexToRgba } from '../../../../../lib/components/utils';
import type { GoalContent } from '../../config/types';

interface GoalSlideProps {
  content: GoalContent;
}

const STATUS_CONFIG = {
  achieved: { icon: '\u2713', color: '#22c55e', label: 'Achieved' },
  partial: { icon: '\u23F3', color: '#f59e0b', label: 'Partial' },
  missed: { icon: '\u2717', color: '#ef4444', label: 'Missed' },
} as const;

export const GoalSlide: React.FC<GoalSlideProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const statusCfg = STATUS_CONFIG[content.status];

  // Header entrance
  const headerOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Goal text entrance
  const goalSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });
  const goalY = interpolate(goalSpring, [0, 1], [40, 0]);

  // Status badge entrance
  const badgeSpring = spring({
    frame: frame - 45,
    fps,
    config: { damping: 12, stiffness: 150 },
  });
  const badgeScale = interpolate(badgeSpring, [0, 1], [0.5, 1]);

  // Progress bar entrance
  const barSpring = spring({
    frame: frame - 60,
    fps,
    config: { damping: 16, stiffness: 80 },
  });

  const completionRatio = content.planned > 0
    ? Math.min(content.completed / content.planned, 1)
    : 0;
  const barWidth = interpolate(barSpring, [0, 1], [0, completionRatio * 100]);
  const unit = content.unit ?? 'items';

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
      {/* Section label */}
      <p
        style={{
          color: theme.colors.primary,
          fontSize: 34,
          fontWeight: 500,
          marginBottom: 20,
          textTransform: 'uppercase',
          letterSpacing: 3,
          opacity: headerOpacity,
        }}
      >
        Sprint Goal
      </p>

      {/* Goal text */}
      <h1
        style={{
          color: theme.colors.textDark,
          fontSize: 64,
          fontWeight: 700,
          margin: '0 0 48px 0',
          textAlign: 'center',
          maxWidth: 1400,
          lineHeight: 1.2,
          opacity: goalSpring,
          transform: `translateY(${goalY}px)`,
        }}
      >
        {content.goal}
      </h1>

      {/* Status badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 60,
          opacity: badgeSpring,
          transform: `scale(${badgeScale})`,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: hexToRgba(statusCfg.color, 0.15),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            color: statusCfg.color,
            fontWeight: 700,
          }}
        >
          {statusCfg.icon}
        </div>
        <span
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: statusCfg.color,
          }}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ width: 800, opacity: barSpring }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 12,
            fontSize: 28,
            color: theme.colors.textMedium,
          }}
        >
          <span>{content.completed} / {content.planned} {unit}</span>
          <span>{Math.round(completionRatio * 100)}%</span>
        </div>
        <div
          style={{
            width: '100%',
            height: 20,
            borderRadius: 10,
            backgroundColor: hexToRgba(theme.colors.primary, 0.12),
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${barWidth}%`,
              height: '100%',
              borderRadius: 10,
              backgroundColor: statusCfg.color,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
