import React from 'react';
import { Img, staticFile } from 'remotion';
import { C, FONT, APP_W, APP_H, L } from './theme';
import { ArrowDropDownIcon, ContactListIcon, DarkModeIcon, DashboardIcon, HistoryIcon, RecordingIcon, SettingsIcon } from './icons';
import { Avatar } from './primitives';

export const USER = { name: 'Lena Fischer', initials: 'LF', avatarColor: '#7e57c2', plan: 'Free' };

const NAV = [
  { label: 'Dashboard', Icon: DashboardIcon },
  { label: 'Contact list', Icon: ContactListIcon },
  { label: 'Recordings', Icon: RecordingIcon },
  { label: 'History', Icon: HistoryIcon },
  { label: 'Settings', Icon: SettingsIcon },
];

export const NAV_ITEM_Y = (i: number) => 110 + i * 48;

// Header + side menu from src/app/(account)/template.js. The page itself is passed as children.
export const Shell: React.FC<{ active: number; children: React.ReactNode }> = ({ active, children }) => (
  <div style={{ position: 'relative', width: APP_W, height: APP_H, background: C.white, overflow: 'hidden', fontFamily: FONT }}>
    <Img src={staticFile('logo.svg')} style={{ position: 'absolute', left: 24, top: 20, height: 50 }} />
    <div style={{ position: 'absolute', right: 24, top: 25, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <DarkModeIcon size={24} color={C.text} />
      </div>
      <Avatar inline size={40} initials={USER.initials} color={USER.avatarColor} fontSize={16} />
      <ArrowDropDownIcon size={24} color="#757575" />
    </div>

    <div
      style={{
        position: 'absolute',
        left: L.sidebarX,
        top: L.headerBottom + 8,
        width: L.sidebarW,
        height: 320,
        borderRight: `1px solid ${C.divider}`,
      }}
    />
    {NAV.map(({ label, Icon }, i) => {
      const on = i === active;
      return (
        <div
          key={label}
          style={{
            position: 'absolute',
            left: L.sidebarX + 24,
            top: NAV_ITEM_Y(i),
            height: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 16,
            color: on ? C.primary : C.text,
          }}
        >
          <Icon size={24} color={on ? C.primary : C.text} />
          {label}
        </div>
      );
    })}
    {active >= 0 && (
      <div
        style={{
          position: 'absolute',
          left: L.sidebarX + L.sidebarW - 1,
          top: NAV_ITEM_Y(active),
          width: 2,
          height: 40,
          background: C.primary,
        }}
      />
    )}
    <div
      style={{
        position: 'absolute',
        left: L.sidebarX + 24,
        top: 370,
        width: L.sidebarW - 48,
        height: 40,
        boxSizing: 'border-box',
        border: `2px solid ${C.primary}`,
        borderRadius: 50,
        color: C.primary,
        fontWeight: 600,
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Need help?
    </div>

    {children}
  </div>
);
