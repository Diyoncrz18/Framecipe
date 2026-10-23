import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../../config/theme';
import type { HighlightsContent } from '../../config/types';

interface HighlightsSlideProps {
  content: HighlightsContent;
}

/**
 * Typewriter effect - reveals text character by character
 */
const Typewriter: React.FC<{
  text: string;
  startFrame: number;
  charsPerFrame?: number;
  style?: React.CSSProperties;
}> = ({ text, startFrame, charsPerFrame = 0.8, style }) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const visibleChars = Math.min(Math.floor(elapsed * charsPerFrame), text.length);

  return (
    <span style={style}>
      {text.slice(0, visibleChars)}
      {visibleChars < text.length && (
        <span
          style={{
            display: 'inline-block',
            width: 3,
            height: '0.9em',
            backgroundColor: 'currentColor',
            marginLeft: 2,
            opacity: Math.sin(elapsed * 0.3) > 0 ? 1 : 0,
          }}
        />
      )}
    </span>
  );
};

/**
 * Highlight wipe for items
 */
const ItemHighlightWipe: React.FC<{
  children: React.ReactNode;
  color: string;
  progress: number;
}> = ({ children, color, progress }) => {
  const wipeWidth = interpolate(progress, [0.3, 1], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <span style={{ position: 'relative', display: 'inline' }}>
      <span
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '30%',
          width: `${wipeWidth}%`,
          backgroundColor: color,
          opacity: 0.2,
          borderRadius: 3,
        }}
      />
      {children}
    </span>
  );
};

export const HighlightsSlide: React.FC<HighlightsSlideProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();

  // Title fade in
  const titleOpacity = interpolate(frame, [15, 40], [0, 1], {
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
      {/* Typewriter header */}
      <p
        style={{
          color: theme.colors.primary,
          fontSize: 34,
          fontWeight: 500,
          marginBottom: 20,
          textTransform: 'uppercase',
          letterSpacing: 3,
          minHeight: 42,
        }}
      >
        <Typewriter text="Sprint Highlights" startFrame={0} charsPerFrame={1.2} />
      </p>

      {/* Title */}
      <h1
        style={{
          color: theme.colors.textDark,
          fontSize: 78,
          fontWeight: 700,
          margin: '0 0 60px 0',
          textAlign: 'center',
          opacity: titleOpacity,
        }}
      >
        {content.title}
      </h1>

      {/* Items with spring stagger + highlight wipes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
        {content.items.map((item, index) => {
          const itemDelay = 50 + index * 60;

          // Spring entrance
          const itemSpring = spring({
            frame: frame - itemDelay,
            fps,
            config: { damping: 14, stiffness: 100, mass: 0.8 },
          });

          const itemY = interpolate(itemSpring, [0, 1], [40, 0]);

          // Bullet scale
          const bulletScale = spring({
            frame: frame - (itemDelay + 5),
            fps,
            config: { damping: 10, stiffness: 200 },
          });

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                opacity: itemSpring,
                transform: `translateY(${itemY}px)`,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: theme.colors.primary,
                  flexShrink: 0,
                  transform: `scale(${bulletScale})`,
                }}
              />
              <span style={{ color: theme.colors.textMedium, fontSize: 44 }}>
                {item.text}
                <ItemHighlightWipe color={theme.colors.primary} progress={itemSpring}>
                  <span style={{ color: theme.colors.primary, fontWeight: 600 }}>
                    {item.highlight}
                  </span>
                </ItemHighlightWipe>
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
