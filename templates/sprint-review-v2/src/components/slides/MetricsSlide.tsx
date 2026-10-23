import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../../config/theme';
import { hexToRgba } from '../../../../../lib/components/utils';
import type { MetricsContent, MetricItem } from '../../config/types';

interface MetricsSlideProps {
  content: MetricsContent;
}

const TREND_ARROWS: Record<string, string> = {
  up: '\u2191',
  down: '\u2193',
  flat: '\u2192',
};

const TREND_COLORS: Record<string, string> = {
  up: '#22c55e',
  down: '#ef4444',
  flat: '#6b7280',
};

/**
 * Animated stat card with count-up and trend arrow
 */
const StatCard: React.FC<{
  item: MetricItem;
  delay: number;
  accentColor: string;
}> = ({ item, delay, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });
  const entranceScale = interpolate(entrance, [0, 1], [0.8, 1]);

  // Count-up
  const countStart = delay + 5;
  const countEnd = countStart + 45;
  const currentValue = Math.round(
    interpolate(frame, [countStart, countEnd], [0, item.value], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  const trendColor = item.trend ? TREND_COLORS[item.trend] : accentColor;
  const trendArrow = item.trend ? TREND_ARROWS[item.trend] : '';

  // Delta text
  let deltaText = '';
  if (item.previousValue !== undefined) {
    const delta = item.value - item.previousValue;
    const sign = delta >= 0 ? '+' : '';
    deltaText = `${sign}${delta}${item.unit ?? ''}`;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 48px',
        borderRadius: 20,
        backgroundColor: hexToRgba(accentColor, 0.04),
        border: `1px solid ${hexToRgba(accentColor, 0.1)}`,
        minWidth: 220,
        opacity: entrance,
        transform: `scale(${entranceScale})`,
      }}
    >
      {/* Value + trend */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span
          style={{
            fontFamily: theme.fonts.primary,
            fontSize: 72,
            fontWeight: 700,
            color: accentColor,
          }}
        >
          {currentValue}{item.unit ?? ''}
        </span>
        {trendArrow && (
          <span style={{ fontSize: 40, color: trendColor, fontWeight: 700 }}>
            {trendArrow}
          </span>
        )}
      </div>

      {/* Label */}
      <span
        style={{
          fontFamily: theme.fonts.primary,
          fontSize: 28,
          color: theme.colors.textLight,
          marginTop: 12,
        }}
      >
        {item.label}
      </span>

      {/* Delta */}
      {deltaText && (
        <span
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 22,
            color: trendColor,
            marginTop: 8,
          }}
        >
          {deltaText}
        </span>
      )}
    </div>
  );
};

/**
 * SVG bar chart for 'chart' mode
 */
const BarChart: React.FC<{
  items: MetricItem[];
  delay: number;
  accentColor: string;
}> = ({ items, delay, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();

  const chartWidth = 1200;
  const chartHeight = 400;
  const barGap = 40;
  const barWidth = Math.min(120, (chartWidth - barGap * (items.length + 1)) / items.length);
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 16, stiffness: 80 },
  });

  return (
    <div style={{ opacity: entrance }}>
      <svg width={chartWidth} height={chartHeight + 60} viewBox={`0 0 ${chartWidth} ${chartHeight + 60}`}>
        {/* Bars */}
        {items.map((item, index) => {
          const barDelay = delay + 10 + index * 15;
          const barGrow = interpolate(frame, [barDelay, barDelay + 40], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          const barHeight = (item.value / maxValue) * (chartHeight - 40) * barGrow;
          const x = barGap + index * (barWidth + barGap);
          const y = chartHeight - barHeight;

          return (
            <g key={index}>
              {/* Bar background */}
              <rect
                x={x}
                y={40}
                width={barWidth}
                height={chartHeight - 40}
                rx={8}
                fill={hexToRgba(accentColor, 0.06)}
              />
              {/* Bar fill */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={8}
                fill={accentColor}
                opacity={0.8}
              />
              {/* Value label */}
              {barGrow > 0.5 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 12}
                  textAnchor="middle"
                  fill={accentColor}
                  fontSize={24}
                  fontWeight={700}
                  fontFamily={theme.fonts.primary}
                >
                  {item.value}{item.unit ?? ''}
                </text>
              )}
              {/* Axis label */}
              <text
                x={x + barWidth / 2}
                y={chartHeight + 36}
                textAnchor="middle"
                fill={theme.colors.textLight}
                fontSize={22}
                fontFamily={theme.fonts.primary}
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const MetricsSlide: React.FC<MetricsSlideProps> = ({ content }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const title = content.title ?? 'Sprint Metrics';

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

      {content.mode === 'cards' ? (
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
          {content.items.map((item, index) => (
            <StatCard
              key={index}
              item={item}
              delay={25 + index * 20}
              accentColor={theme.colors.primary}
            />
          ))}
        </div>
      ) : (
        <BarChart
          items={content.items}
          delay={25}
          accentColor={theme.colors.primary}
        />
      )}
    </AbsoluteFill>
  );
};
