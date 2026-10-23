import React from 'react';
import { PANEL, R, RFONT } from './theme';
import { RIcon } from './icons';
import { Person, initials } from './people';

// Participants side panel (src/features/users/panel). Sections are "Waiting", then one per role.
export type Row = { person: Person; micOff?: boolean; secondary?: string; waiting?: boolean };
export type Section = { title: string; rows: Row[]; menuHover?: boolean; waiting?: boolean };

const LIST_Y = PANEL.y + 150;
const HEADER_H = 56;
const ROW_H = 56;

// Where every section header and row lands, so scenes can aim the cursor at them
export const layoutSections = (sections: Section[]) => {
  let y = LIST_Y;
  return sections.map((s) => {
    const header = y;
    y += HEADER_H;
    const rows = s.rows.map((r) => {
      const ry = y;
      y += ROW_H;
      return { id: r.person.id, y: ry };
    });
    return { title: s.title, header, rows };
  });
};

// Centres of the ⋯ buttons, in app coordinates
export const sectionMenuAt = (headerY: number) => ({ x: PANEL.x + PANEL.w - 74, y: headerY + HEADER_H / 2 });
export const rowMenuAt = (rowY: number) => ({ x: PANEL.x + PANEL.w - 34, y: rowY + ROW_H / 2 });

const Dots: React.FC<{ hover?: boolean }> = ({ hover }) => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: 16,
      background: hover ? 'rgba(0,0,0,0.08)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <RIcon name="settings1" size={26} color="rgba(0,0,0,0.7)" />
  </div>
);

export const ParticipantsPanel: React.FC<{ sections: Section[]; rowMenuHover?: string; clipBottom?: number }> = ({ sections, rowMenuHover }) => {
  const pos = layoutSections(sections);
  return (
    <div
      style={{
        position: 'absolute',
        left: PANEL.x,
        top: PANEL.y,
        width: PANEL.w,
        height: PANEL.h,
        background: R.paper,
        border: `1px solid ${R.divider}`,
        borderRadius: 8,
        overflow: 'hidden',
        fontFamily: RFONT,
        color: R.text,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ position: 'absolute', left: 20, top: 14, fontSize: 24, lineHeight: 1.4 }}>Participants</div>
      <div style={{ position: 'absolute', right: 10, top: 16, display: 'flex', gap: 10 }}>
        <RIcon name="lock" size={28} color="rgba(0,0,0,0.75)" />
        <RIcon name="close" size={28} color="rgba(0,0,0,0.75)" />
      </div>
      <div style={{ position: 'absolute', left: 20, top: 64, display: 'flex', alignItems: 'center', gap: 8, color: R.primary, fontSize: 15 }}>
        <RIcon name="invite" size={24} color={R.primary} />
        Invite people
      </div>
      <div
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: 100,
          height: 36,
          borderRadius: 4,
          background: R.grey200,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          color: 'rgba(0,0,0,0.45)',
          fontSize: 15,
        }}
      >
        <RIcon name="search" size={22} color="rgba(0,0,0,0.5)" />
        Search
      </div>

      {sections.map((s, si) => (
        <React.Fragment key={s.title}>
          <div
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              top: pos[si].header - PANEL.y + 5,
              height: 46,
              borderRadius: 4,
              background: R.sectionBg,
              display: 'flex',
              alignItems: 'center',
              padding: '0 6px 0 12px',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>{s.title}</span>
            <span
              style={{
                minWidth: 26,
                height: 20,
                borderRadius: 10,
                padding: '0 8px',
                boxSizing: 'border-box',
                background: R.badge,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {s.rows.length}
            </span>
            <div style={{ flex: 1 }} />
            {s.waiting && <RIcon name="notification-bell" size={24} color="rgba(0,0,0,0.7)" />}
            <Dots hover={s.menuHover} />
            <RIcon name="dropdown-arrow" size={24} color="rgba(0,0,0,0.7)" />
          </div>
          {s.rows.map((r, ri) => (
            <div
              key={r.person.id}
              style={{
                position: 'absolute',
                left: 20,
                right: 14,
                top: pos[si].rows[ri].y - PANEL.y,
                height: ROW_H,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  border: '2px solid #fff',
                  boxSizing: 'border-box',
                  background: r.waiting ? R.waitingAvatar : r.person.color,
                  color: '#fff',
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {initials(r.person.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, whiteSpace: 'nowrap' }}>
                  {r.person.name}
                  {r.person.you && <span style={{ color: R.divider, marginLeft: 4 }}>(you)</span>}
                </div>
                {r.secondary && <div style={{ fontSize: 12, color: R.text2 }}>{r.secondary}</div>}
              </div>
              {!r.waiting && <RIcon name={r.micOff ? 'mute' : 'mic'} size={28} color={r.micOff ? R.red : 'rgba(0,0,0,0.8)'} />}
              <Dots hover={rowMenuHover === r.person.id} />
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};
