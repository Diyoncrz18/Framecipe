import React from 'react';
import paths from './icon-paths.json';

// Glyphs from react-frontend's icomoon font (src/assets/fonts/icons/selection.json), 1024 grid
export type IconName = keyof typeof paths;

export const RIcon: React.FC<{ name: IconName; size?: number; color?: string; style?: React.CSSProperties }> = ({
  name,
  size = 24,
  color = 'currentColor',
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 1024 1024" fill={color} style={{ flexShrink: 0, ...style }}>
    {(paths[name] as string[]).map((d, i) => (
      <path key={i} d={d} />
    ))}
  </svg>
);
