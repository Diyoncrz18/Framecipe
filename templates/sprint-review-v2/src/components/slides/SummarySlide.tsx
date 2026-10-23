import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, getStaticFiles } from 'remotion';
import { useTheme } from '../../config/theme';
import { hexToRgba } from '../../../../../lib/components/utils';
import type { SummaryContent } from '../../config/types';

interface SummarySlideProps {
  content: SummaryContent;
}

/**
 * SVG circular progress ring with animated fill
 */
const ProgressRing: React.FC<{
  value: number;
  maxValue: number;
  label: string;
  color: string;
  delay: number;
}> = ({ value, maxValue, label, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();

  const ringSize = 180;
  const strokeWidth = 10;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Spring entrance
  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });
  const entranceScale = interpolate(entrance, [0, 1], [0.5, 1]);

  // Ring fill animation (slightly delayed after entrance)
  const fillStart = delay + 10;
  const fillEnd = fillStart + 50;
  const fillProgress = interpolate(frame, [fillStart, fillEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // The ring fills proportional to value/maxValue
  const targetFraction = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;
  const dashOffset = circumference * (1 - targetFraction * fillProgress);

  // Count-up number
  const countStart = delay + 5;
  const countEnd = countStart + 50;
  const currentValue = Math.round(
    interpolate(frame, [countStart, countEnd], [0, value], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: entrance,
        transform: `scale(${entranceScale})`,
      }}
    >
      <div style={{ position: 'relative', width: ringSize, height: ringSize }}>
        <svg
          width={ringSize}
          height={ringSize}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background ring */}
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke={hexToRgba(color, 0.15)}
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Count-up number centered inside ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: theme.fonts.primary,
              color,
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {currentValue}
          </span>
        </div>
      </div>

      {/* Label */}
      <span
        style={{
          fontFamily: theme.fonts.primary,
          color: theme.colors.textLight,
          fontSize: 32,
          marginTop: 20,
        }}
      >
        {label}
      </span>
    </div>
  );
};

export const SummarySlide: React.FC<SummarySlideProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();

  const staticFiles = getStaticFiles();
  const screenshotPath = content.screenshotFile ? `images/${content.screenshotFile}` : null;
  const hasScreenshot = screenshotPath && staticFiles.some((f) => f.name === screenshotPath);

  // Header/title fade
  const headerOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Determine max value for ring proportions
  const maxStatValue = Math.max(...content.stats.map((s) => s.value), 1);

  // Phase 2: Screenshot overlay (starts at frame 150)
  const screenshotStart = 150;
  const screenshotProgress = spring({
    frame: frame - screenshotStart,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  const showScreenshot = frame >= screenshotStart && hasScreenshot;
  const screenshotScale = interpolate(screenshotProgress, [0, 1], [0.8, 1]);
  const screenshotOpacity = interpolate(screenshotProgress, [0, 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Stats fade out as screenshot comes in
  const statsFadeOut = showScreenshot
    ? interpolate(frame, [screenshotStart, screenshotStart + 20], [1, 0], {
        extrapolateRight: 'clamp',
      })
    : 1;

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
      {/* Stats layer */}
      <div
        style={{
          opacity: headerOpacity * statsFadeOut,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <p
          style={{
            color: theme.colors.primary,
            fontSize: 34,
            fontWeight: 500,
            marginBottom: 24,
            textTransform: 'uppercase',
            letterSpacing: 3,
          }}
        >
          Sprint Complete
        </p>
        <h1
          style={{
            color: theme.colors.textDark,
            fontSize: 72,
            fontWeight: 700,
            margin: '0 0 80px 0',
          }}
        >
          Release Summary
        </h1>

        {/* Progress rings */}
        <div style={{ display: 'flex', gap: 100 }}>
          {content.stats.map((stat, index) => (
            <ProgressRing
              key={index}
              value={stat.value}
              maxValue={maxStatValue}
              label={stat.label}
              color={theme.colors.primary}
              delay={20 + index * 15}
            />
          ))}
        </div>
      </div>

      {/* Screenshot overlay with spring animation */}
      {showScreenshot && screenshotPath && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.bgOverlay,
            opacity: screenshotOpacity,
          }}
        >
          <Img
            src={staticFile(screenshotPath)}
            style={{
              height: 350,
              borderRadius: theme.borderRadius.lg,
              boxShadow: '0 12px 60px rgba(0, 0, 0, 0.2)',
              border: `2px solid ${theme.colors.divider}`,
              transform: `scale(${screenshotScale})`,
            }}
          />
        </div>
      )}
    </AbsoluteFill>
  );
};
