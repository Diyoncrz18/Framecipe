import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, getStaticFiles } from 'remotion';
import { useTheme } from '../../config/theme';
import { hexToRgba } from '../../../../../lib/components/utils';
import type { TitleContent, SprintInfo } from '../../config/types';

interface TitleSlideProps {
  content: TitleContent;
  info: SprintInfo;
}

/**
 * Word-by-word spring entrance component
 */
const SpringWords: React.FC<{
  text: string;
  style: React.CSSProperties;
  startFrame: number;
  staggerFrames?: number;
}> = ({ text, style, startFrame, staggerFrames = 4 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');

  return (
    <span style={{ ...style, display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 18px' }}>
      {words.map((word, i) => {
        const delay = startFrame + i * staggerFrames;
        const progress = spring({
          frame: frame - delay,
          fps,
          config: { damping: 14, stiffness: 120, mass: 0.8 },
        });
        const y = interpolate(progress, [0, 1], [30, 0]);

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: progress,
              transform: `translateY(${y}px)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Highlight wipe - colored bar sweeps across the text
 */
const HighlightWipe: React.FC<{
  children: React.ReactNode;
  color: string;
  startFrame: number;
  durationFrames?: number;
}> = ({ children, color, startFrame, durationFrames = 20 }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '35%',
          width: `${progress}%`,
          backgroundColor: color,
          opacity: 0.25,
          borderRadius: 4,
        }}
      />
      {children}
    </span>
  );
};

export const TitleSlide: React.FC<TitleSlideProps> = ({ content, info }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const logoFile = content.logoFile ?? 'images/logo.png';

  // Slow Ken Burns zoom drift (1.0 -> 1.03 over full scene)
  const kenBurns = interpolate(frame, [0, 150], [1, 1.03], {
    extrapolateRight: 'clamp',
  });

  // Logo spring entrance
  const logoProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const logoScale = interpolate(logoProgress, [0, 1], [0.6, 1]);

  // Staggered elements
  const sprintOpacity = interpolate(frame, [35, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dateOpacity = interpolate(frame, [45, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sectionOpacity = interpolate(frame, [55, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const versionOpacity = interpolate(frame, [65, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const staticFiles = getStaticFiles();
  const hasLogo = staticFiles.some((f) => f.name === logoFile);

  const versionString = info.build
    ? `Version ${info.version} (BUILD ${info.build})`
    : `Version ${info.version}`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.fonts.primary,
      }}
    >
      {/* Subtle glow radial gradient behind title */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, ${hexToRgba(theme.colors.primary, 0.08)} 0%, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          transform: `scale(${kenBurns})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Logo with spring entrance */}
        {hasLogo ? (
          <Img
            src={staticFile(logoFile)}
            style={{
              width: 200,
              height: 200,
              marginBottom: 48,
              opacity: logoProgress,
              transform: `scale(${logoScale})`,
            }}
          />
        ) : (
          <div
            style={{
              width: 200,
              height: 200,
              marginBottom: 48,
              backgroundColor: theme.colors.primary,
              borderRadius: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 48,
              fontWeight: 700,
              opacity: logoProgress,
              transform: `scale(${logoScale})`,
            }}
          >
            {info.product.charAt(0)}
          </div>
        )}

        {/* Product name - word-by-word spring entrance */}
        <h1 style={{ margin: 0, textAlign: 'center' }}>
          <SpringWords
            text={info.product}
            style={{
              color: theme.colors.textDark,
              fontSize: 88,
              fontWeight: 700,
            }}
            startFrame={8}
            staggerFrames={5}
          />
        </h1>

        {/* Sprint name with highlight wipe */}
        <p
          style={{
            color: theme.colors.textDark,
            fontSize: 52,
            fontWeight: 500,
            margin: '24px 0 10px 0',
            opacity: sprintOpacity,
          }}
        >
          Sprint Review :{' '}
          <HighlightWipe color={theme.colors.primary} startFrame={42} durationFrames={25}>
            <span style={{ color: theme.colors.primary, fontWeight: 600 }}>
              {info.name}
            </span>
          </HighlightWipe>
        </p>

        <p
          style={{
            color: theme.colors.textLight,
            fontSize: 34,
            margin: '0 0 48px 0',
            opacity: dateOpacity,
          }}
        >
          {info.dateRange}
        </p>

        <p
          style={{
            color: theme.colors.textDark,
            fontSize: 48,
            fontWeight: 700,
            margin: '0 0 10px 0',
            opacity: sectionOpacity,
          }}
        >
          {info.platform}
        </p>

        <p
          style={{
            color: theme.colors.textLight,
            fontSize: 38,
            fontWeight: 500,
            margin: 0,
            opacity: versionOpacity,
          }}
        >
          {versionString}
        </p>
      </div>
    </AbsoluteFill>
  );
};
