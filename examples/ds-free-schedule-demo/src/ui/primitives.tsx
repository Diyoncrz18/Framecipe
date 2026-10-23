import React from 'react';
import { C, FONT } from './theme';
import { ArrowDropDownIcon, InfoIcon } from './icons';

type Box = { x: number; y: number; w: number; h?: number };

const abs = ({ x, y, w, h }: Box): React.CSSProperties => ({
  position: 'absolute',
  left: x,
  top: y,
  width: w,
  height: h,
});

// MUI contained button. `pressed` 0..1 dips it, `hover` darkens it.
export const Button: React.FC<
  Box & {
    label: string;
    icon?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'text';
    hover?: boolean;
    pressed?: number;
    fontSize?: number;
  }
> = ({ label, icon, variant = 'primary', hover, pressed = 0, fontSize = 16, ...box }) => {
  const bg =
    variant === 'primary' ? (hover ? '#2a5fc4' : C.primary) : variant === 'secondary' ? C.secondary : 'transparent';
  const color = variant === 'primary' ? C.white : variant === 'secondary' ? C.secondaryText : C.primary;
  return (
    <div
      style={{
        ...abs({ h: 38, ...box }),
        background: bg,
        color,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: FONT,
        fontSize,
        whiteSpace: 'nowrap',
        transform: `scale(${1 - pressed * 0.04})`,
        boxShadow: hover && variant === 'primary' ? '0 2px 6px rgba(55,113,224,0.35)' : 'none',
      }}
    >
      {icon}
      {label}
    </div>
  );
};

export const FieldLabel: React.FC<{ x: number; y: number; label: string; required?: boolean; info?: boolean; children?: React.ReactNode }> = ({
  x,
  y,
  label,
  required,
  info,
  children,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: FONT,
      fontSize: 16,
      fontWeight: 600,
      color: C.text,
      whiteSpace: 'nowrap',
    }}
  >
    {label}
    {required && <span style={{ color: C.required }}>*</span>}
    {info && <InfoIcon size={18} color={C.primary} />}
    {children}
  </div>
);

// MUI outlined small TextField. `focused` draws the 2px primary ring.
export const TextField: React.FC<
  Box & {
    value?: string;
    placeholder?: string;
    focused?: boolean;
    caret?: boolean;
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
    select?: boolean;
    hint?: string;
  }
> = ({ value, placeholder, focused, caret, startIcon, endIcon, select, hint, ...box }) => (
  <div
    style={{
      ...abs({ h: 40, ...box }),
      boxSizing: 'border-box',
      border: focused ? `2px solid ${C.primary}` : `1px solid ${C.divider}`,
      padding: focused ? '0 13px' : '0 14px',
      borderRadius: 4,
      background: C.white,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: FONT,
      fontSize: 16,
      color: C.text,
      overflow: 'hidden',
    }}
  >
    {startIcon}
    <div style={{ flex: 1, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
      {value ? <span>{value}</span> : !caret && <span style={{ color: '#a2a2a2' }}>{placeholder}</span>}
      {caret && <span style={{ width: 1.5, height: 20, background: C.text, marginLeft: 1 }} />}
      {caret && !value && <span style={{ color: '#a2a2a2', marginLeft: 1 }}>{placeholder}</span>}
      {hint && <span style={{ color: C.textSecondary, marginLeft: 8, fontSize: 14 }}>{hint}</span>}
    </div>
    {endIcon}
    {select && <ArrowDropDownIcon size={24} color="#757575" style={{ marginRight: -6 }} />}
  </div>
);

// iOS-style switch from the theme override (38x22, track #000 off / primary on)
export const Switch: React.FC<{ x: number; y: number; on: boolean }> = ({ x, y, on }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: 38,
      height: 22,
      borderRadius: 11,
      background: on ? C.primary : '#000',
      opacity: on ? 1 : 0.38,
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 3,
        left: on ? 19 : 3,
        width: 16,
        height: 16,
        borderRadius: 8,
        background: C.white,
      }}
    />
  </div>
);

export const Avatar: React.FC<{ x?: number; y?: number; size: number; initials: string; color: string; fontSize?: number; inline?: boolean }> = ({
  x,
  y,
  size,
  initials,
  color,
  fontSize,
  inline,
}) => (
  <div
    style={{
      ...(inline ? { position: 'relative' } : { position: 'absolute', left: x, top: y }),
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      color: C.white,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT,
      fontSize: fontSize ?? size * 0.4,
      flexShrink: 0,
    }}
  >
    {initials}
  </div>
);

export const Chip: React.FC<{ label: string; small?: boolean }> = ({ label, small }) => (
  <span
    style={{
      background: C.lightblue,
      color: C.primary,
      borderRadius: 16,
      padding: small ? '3px 10px' : '6px 12px',
      fontSize: small ? 13 : 14,
      fontWeight: 500,
      fontFamily: FONT,
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </span>
);

// `.RoundedBox` from the theme
export const RoundedBox: React.FC<Box & { children?: React.ReactNode }> = ({ children, ...box }) => (
  <div
    style={{
      ...abs(box),
      boxSizing: 'border-box',
      border: `1px solid ${C.divider}`,
      borderRadius: 20,
      overflow: 'hidden',
    }}
  >
    {children}
  </div>
);
