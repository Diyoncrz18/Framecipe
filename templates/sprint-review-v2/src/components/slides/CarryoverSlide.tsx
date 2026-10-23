import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../../config/theme';
import { hexToRgba } from '../../../../../lib/components/utils';
import type { CarryoverContent } from '../../config/types';

interface CarryoverSlideProps {
  content: CarryoverContent;
}

const STATUS_COLORS: Record<string, string> = {
  'in-progress': '#f59e0b',
  'blocked': '#ef4444',
  'deferred': '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  'in-progress': 'In Progress',
  'blocked': 'Blocked',
  'deferred': 'Deferred',
};

export const CarryoverSlide: React.FC<CarryoverSlideProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const title = content.title ?? 'Carried Over';

  // Header
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
          marginBottom: 20,
          textTransform: 'uppercase',
          letterSpacing: 3,
          opacity: headerOpacity,
        }}
      >
        {title}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1200, width: '100%' }}>
        {content.items.map((item, index) => {
          const itemDelay = 30 + index * 40;
          const itemSpring = spring({
            frame: frame - itemDelay,
            fps,
            config: { damping: 14, stiffness: 100, mass: 0.8 },
          });
          const itemX = interpolate(itemSpring, [0, 1], [-60, 0]);
          const color = STATUS_COLORS[item.status];

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                padding: '24px 36px',
                borderRadius: 16,
                backgroundColor: hexToRgba(color, 0.06),
                borderLeft: `5px solid ${color}`,
                opacity: itemSpring,
                transform: `translateX(${itemX}px)`,
              }}
            >
              {/* Status badge */}
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color,
                  backgroundColor: hexToRgba(color, 0.12),
                  padding: '6px 16px',
                  borderRadius: 8,
                  flexShrink: 0,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {STATUS_LABELS[item.status]}
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  style={{
                    fontSize: 38,
                    fontWeight: 600,
                    color: theme.colors.textDark,
                  }}
                >
                  {item.title}
                </span>
                {item.reason && (
                  <span
                    style={{
                      fontSize: 26,
                      color: theme.colors.textLight,
                    }}
                  >
                    {item.reason}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
