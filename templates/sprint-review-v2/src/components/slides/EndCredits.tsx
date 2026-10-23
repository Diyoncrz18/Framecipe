import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useTheme } from '../../config/theme';
import { hexToRgba } from '../../../../../lib/components/utils';
import type { CreditsContent, SprintInfo } from '../../config/types';

interface EndCreditsProps {
  content: CreditsContent;
  info: SprintInfo;
}

export const EndCredits: React.FC<EndCreditsProps> = ({ content, info }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const theme = useTheme();
  const { sections } = content;

  // Calculate total content height for scroll
  const totalContentHeight =
    sections.reduce((acc, section) => acc + 40 + section.items.length * 45 + 60, 0) + 200;

  // Classic upward scroll driven by frame
  const scrollY = interpolate(frame, [30, 850], [height * 0.8, -totalContentHeight], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Horizontal rule spring animation
  const hrProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  const hrWidth = interpolate(hrProgress, [0, 1], [0, 300]);

  // Product name glow at bottom - fades in late
  const productOpacity = interpolate(frame, [600, 650], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.colors.bgDark,
        fontFamily: theme.fonts.primary,
        overflow: 'hidden',
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, ${hexToRgba(theme.colors.primary, 0.08)} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Gradient fade mask at top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 180,
          background: `linear-gradient(to bottom, ${theme.colors.bgDark} 0%, transparent 100%)`,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      {/* Gradient fade mask at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 180,
          background: `linear-gradient(to top, ${theme.colors.bgDark} 0%, transparent 100%)`,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      {/* Scrolling credits content */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: `translateY(${scrollY}px)`,
        }}
      >
        {/* Animated horizontal rule */}
        <div
          style={{
            width: hrWidth,
            height: 2,
            backgroundColor: theme.colors.primary,
            opacity: 0.6,
            marginBottom: 60,
            borderRadius: 1,
          }}
        />

        {/* CREDITS header */}
        <h1
          style={{
            fontSize: 48,
            fontWeight: 600,
            color: theme.colors.primary,
            letterSpacing: 6,
            marginBottom: 60,
          }}
        >
          CREDITS
        </h1>

        {/* Credit sections */}
        {sections.map((section, sectionIndex) => (
          <div
            key={sectionIndex}
            style={{
              textAlign: 'center',
              marginBottom: 60,
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 500,
                color: theme.colors.primary,
                marginBottom: 12,
                textTransform: 'uppercase',
                letterSpacing: 4,
              }}
            >
              {section.category}
            </div>
            {section.items.map((item, itemIndex) => (
              <div
                key={itemIndex}
                style={{
                  fontSize: 36,
                  fontWeight: 300,
                  color: '#ffffff',
                  lineHeight: 1.5,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Product name with soft glow text-shadow at bottom (fixed position) */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: productOpacity,
          zIndex: 3,
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: theme.colors.primary,
            letterSpacing: 6,
            textShadow: `0 0 30px ${hexToRgba(theme.colors.primary, 0.5)}, 0 0 60px ${hexToRgba(theme.colors.primary, 0.2)}`,
          }}
        >
          {info.product.toUpperCase()}
        </span>
      </div>
    </AbsoluteFill>
  );
};
