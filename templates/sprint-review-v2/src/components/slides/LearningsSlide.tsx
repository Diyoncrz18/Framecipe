import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../../config/theme';
import { hexToRgba } from '../../../../../lib/components/utils';
import type { LearningsContent } from '../../config/types';

interface LearningsSlideProps {
  content: LearningsContent;
}

const COLUMN_CONFIG = {
  wentWell: { label: 'Went Well', color: '#22c55e', icon: '\u2713' },
  needsImprovement: { label: 'Needs Improvement', color: '#f59e0b', icon: '\u26A0' },
} as const;

export const LearningsSlide: React.FC<LearningsSlideProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const title = content.title ?? 'Retrospective';

  const headerOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const renderColumn = (
    items: string[],
    config: { label: string; color: string; icon: string },
    baseDelay: number,
  ) => {
    const colSpring = spring({
      frame: frame - baseDelay,
      fps,
      config: { damping: 14, stiffness: 100, mass: 0.8 },
    });

    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          opacity: colSpring,
        }}
      >
        {/* Column header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: hexToRgba(config.color, 0.15),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              color: config.color,
            }}
          >
            {config.icon}
          </span>
          <span
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: config.color,
            }}
          >
            {config.label}
          </span>
        </div>

        {/* Items */}
        {items.map((text, index) => {
          const itemDelay = baseDelay + 15 + index * 30;
          const itemSpring = spring({
            frame: frame - itemDelay,
            fps,
            config: { damping: 14, stiffness: 120, mass: 0.7 },
          });
          const itemY = interpolate(itemSpring, [0, 1], [20, 0]);

          return (
            <div
              key={index}
              style={{
                padding: '16px 24px',
                borderRadius: 12,
                backgroundColor: hexToRgba(config.color, 0.05),
                borderLeft: `4px solid ${config.color}`,
                fontSize: 30,
                color: theme.colors.textDark,
                lineHeight: 1.3,
                opacity: itemSpring,
                transform: `translateY(${itemY}px)`,
              }}
            >
              {text}
            </div>
          );
        })}
      </div>
    );
  };

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

      {/* Two columns */}
      <div style={{ display: 'flex', gap: 60, width: '100%', maxWidth: 1400 }}>
        {renderColumn(content.wentWell, COLUMN_CONFIG.wentWell, 20)}
        {renderColumn(content.needsImprovement, COLUMN_CONFIG.needsImprovement, 35)}
      </div>

      {/* Action items */}
      {content.actionItems && content.actionItems.length > 0 && (
        <div
          style={{
            marginTop: 48,
            width: '100%',
            maxWidth: 1400,
            opacity: interpolate(frame, [120, 145], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <p
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: theme.colors.primary,
              marginBottom: 16,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            Action Items
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {content.actionItems.map((action, i) => (
              <span
                key={i}
                style={{
                  fontSize: 26,
                  color: theme.colors.textMedium,
                  backgroundColor: hexToRgba(theme.colors.primary, 0.06),
                  padding: '8px 20px',
                  borderRadius: 10,
                  border: `1px solid ${hexToRgba(theme.colors.primary, 0.12)}`,
                }}
              >
                {action}
              </span>
            ))}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
