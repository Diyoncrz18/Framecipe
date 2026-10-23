import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../../config/theme';
import { hexToRgba } from '../../../../../lib/components/utils';
import type { RoadmapContent } from '../../config/types';

interface RoadmapSlideProps {
  content: RoadmapContent;
}

const NODE_STYLES = {
  done: { bg: '#22c55e', icon: '\u2713', opacity: 0.9 },
  current: { bg: '#3b82f6', icon: '\u25CF', opacity: 1 },
  upcoming: { bg: '#6b7280', icon: '\u25CB', opacity: 0.5 },
} as const;

export const RoadmapSlide: React.FC<RoadmapSlideProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const title = content.title ?? "What's Next";

  const headerOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Timeline nodes
  const nodeCount = content.nodes.length;
  const timelineWidth = Math.min(1400, nodeCount * 240);

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
          marginBottom: 60,
          textTransform: 'uppercase',
          letterSpacing: 3,
          opacity: headerOpacity,
        }}
      >
        {title}
      </p>

      {/* Horizontal timeline */}
      <div
        style={{
          position: 'relative',
          width: timelineWidth,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Connector line */}
        <div
          style={{
            position: 'absolute',
            top: 28,
            left: 28,
            right: 28,
            height: 4,
            backgroundColor: hexToRgba(theme.colors.textLight, 0.2),
            borderRadius: 2,
          }}
        />

        {/* Progress line (fills to current node) */}
        {(() => {
          const currentIdx = content.nodes.findIndex((n) => n.status === 'current');
          const progressTarget = currentIdx >= 0 ? currentIdx : content.nodes.filter((n) => n.status === 'done').length;
          const progressPct = nodeCount > 1 ? (progressTarget / (nodeCount - 1)) * 100 : 0;
          const lineGrow = interpolate(frame, [30, 90], [0, progressPct], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <div
              style={{
                position: 'absolute',
                top: 28,
                left: 28,
                width: `calc(${lineGrow}% - 28px)`,
                height: 4,
                backgroundColor: '#22c55e',
                borderRadius: 2,
                zIndex: 1,
              }}
            />
          );
        })()}

        {/* Nodes */}
        {content.nodes.map((node, index) => {
          const nodeDelay = 20 + index * 25;
          const nodeSpring = spring({
            frame: frame - nodeDelay,
            fps,
            config: { damping: 12, stiffness: 150 },
          });
          const nodeScale = interpolate(nodeSpring, [0, 1], [0, 1]);
          const style = NODE_STYLES[node.status];

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 2,
                opacity: nodeSpring,
                transform: `scale(${nodeScale})`,
              }}
            >
              {/* Node circle */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: node.status === 'upcoming'
                    ? 'transparent'
                    : style.bg,
                  border: node.status === 'upcoming'
                    ? `3px solid ${style.bg}`
                    : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: node.status === 'upcoming' ? style.bg : '#fff',
                  fontSize: 24,
                  fontWeight: 700,
                  boxShadow: node.status === 'current'
                    ? `0 0 20px ${hexToRgba(style.bg, 0.4)}`
                    : 'none',
                }}
              >
                {style.icon}
              </div>

              {/* Label */}
              <span
                style={{
                  fontSize: 24,
                  color: theme.colors.textDark,
                  fontWeight: node.status === 'current' ? 700 : 400,
                  marginTop: 16,
                  textAlign: 'center',
                  maxWidth: 180,
                  opacity: style.opacity,
                }}
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Next sprint card */}
      {content.nextSprint && (
        <div
          style={{
            marginTop: 80,
            padding: '32px 56px',
            borderRadius: 20,
            backgroundColor: hexToRgba(theme.colors.primary, 0.06),
            border: `2px solid ${hexToRgba(theme.colors.primary, 0.15)}`,
            textAlign: 'center',
            opacity: interpolate(frame, [80, 110], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <p
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: theme.colors.primary,
              textTransform: 'uppercase',
              letterSpacing: 2,
              margin: '0 0 12px 0',
            }}
          >
            Next Sprint
          </p>
          <p
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: theme.colors.textDark,
              margin: '0 0 8px 0',
            }}
          >
            {content.nextSprint.name}
          </p>
          <p
            style={{
              fontSize: 28,
              color: theme.colors.textLight,
              margin: 0,
            }}
          >
            {content.nextSprint.focus}
          </p>
        </div>
      )}
    </AbsoluteFill>
  );
};
