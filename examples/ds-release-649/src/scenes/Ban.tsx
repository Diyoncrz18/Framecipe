import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Stage, cursorPos, fade, near } from '../Stage';
import { RoomChrome, TileGrid, stageRect, Menu, Dialog } from '../room/Room';
import { ParticipantsPanel, Section, layoutSections, rowMenuAt } from '../room/Participants';
import { PEOPLE } from '../room/people';
import { R } from '../room/theme';
import { RIcon } from '../room/icons';

// "Safer ban duration": room/modals/BanUserConfirmation.tsx (default '5', Permanently last)
export const BAN_LEN = 310;
const C = { rowMenu: 46, ban: 78, select: 122, pick: 212 };
export const BAN_CLICKS = Object.values(C);

const SECTIONS: Section[] = [
  { title: 'Moderators', rows: PEOPLE.filter((p) => p.role === 'Moderators').map((person) => ({ person })) },
  { title: 'Speakers', rows: PEOPLE.filter((p) => p.role === 'Speakers').map((person) => ({ person })) },
  { title: 'Attendees', rows: PEOPLE.filter((p) => p.role === 'Attendees').map((person) => ({ person })) },
];
const pos = layoutSections(SECTIONS);
const julienY = pos[2].rows.find((r) => r.id === 'julien')!.y;
const dots = rowMenuAt(julienY);

const ITEMS = [
  { icon: 'streaming' as const, label: 'Allow video & audio broadcast' },
  { icon: 'broadcast-audio' as const, label: 'Allow audio only broadcast' },
  { icon: 'mute' as const, label: 'Mute' },
  { icon: 'camera-off' as const, label: 'Turn off camera' },
  { icon: 'roles' as const, label: 'Manage role' },
  { icon: 'chat' as const, label: 'Chat privately' },
  { icon: 'block' as const, label: 'Ban' },
  { icon: 'rename' as const, label: 'Rename' },
  { icon: 'remove' as const, label: 'Remove' },
];
const MENU = { x: dots.x - 280, y: dots.y - 14 - (8 + 34 + ITEMS.length * 40) };
const banItem = { x: MENU.x + 70, y: MENU.y + 8 + 34 + 6 * 40 + 20 };

const SELECT = { x: 522, y: 330, w: 200 };
const OPTIONS = ['5 minutes', '15 minutes', '30 minutes', '60 minutes', 'Permanently'];
const optAt = (i: number) => ({ x: SELECT.x + 80, y: SELECT.y + 44 + 8 + i * 40 + 20 });

const PATH = [
  { f: 0, x: 1000, y: 600 },
  { f: 20, x: 1000, y: 600 },
  { f: 42, ...dots },
  { f: 56, ...dots },
  { f: 72, ...banItem },
  { f: 96, ...banItem },
  { f: 116, x: SELECT.x + 80, y: SELECT.y + 20 },
  { f: 134, x: SELECT.x + 80, y: SELECT.y + 20 },
  { f: 160, ...optAt(4) },
  { f: 185, ...optAt(4) },
  { f: 205, ...optAt(0) },
];
const CAMERA = [
  { f: 0, z: 1, x: 720, y: 405 },
  { f: 20, z: 1, x: 720, y: 405 },
  { f: 46, z: 1.45, x: 520, y: 520 },
  { f: 84, z: 1.45, x: 520, y: 520 },
  { f: 104, z: 1.7, x: 720, y: 380 },
];

export const Ban: React.FC = () => {
  const frame = useCurrentFrame();
  const cur = cursorPos(frame, PATH);
  const menu = frame < C.ban ? fade(frame, C.rowMenu, C.rowMenu + 6) : 0;
  const dlg = fade(frame, C.ban + 4, C.ban + 12);
  const listOpen = frame >= C.select && frame < C.pick ? fade(frame, C.select, C.select + 6) : 0;
  const hoverOpt = OPTIONS.findIndex((_, i) => near(cur, optAt(i), 100, 18));

  return (
    <Stage url="acme.digitalsamba.com/all-hands" camera={CAMERA} path={PATH} clicks={BAN_CLICKS} aiNote>
      <RoomChrome activeTool="participants">
        <TileGrid tiles={PEOPLE.map((person) => ({ person, camOff: person.you, speaking: person.id === 'matthias' }))} {...stageRect(true)} cols={3} />
        <ParticipantsPanel sections={SECTIONS} rowMenuHover={menu > 0 || near(cur, dots, 20, 20) ? 'julien' : undefined} />
        {menu > 0 && (
          <Menu x={MENU.x} y={MENU.y} title="Julien Fontaine" opacity={menu} items={ITEMS.map((it) => ({ ...it, hover: it.label === 'Ban' && near(cur, banItem, 120, 18) }))} />
        )}
        <Dialog title="Ban Julien Fontaine?" opacity={dlg} actions={[{ label: 'Cancel' }, { label: 'Ban', primary: true }]}>
          Are you sure you want to ban <b style={{ color: R.text }}>Julien Fontaine</b>?
          <div style={{ height: 64 }} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff4e5', color: '#663c00', borderRadius: 4, padding: '10px 14px', fontSize: 14 }}>
            <span style={{ color: '#ed6c02', fontSize: 20 }}>⚠</span>
            If you ban this participant they will not be able to join again
          </div>
        </Dialog>
        {dlg > 0 && (
          <div
            style={{
              position: 'absolute',
              left: SELECT.x,
              top: SELECT.y,
              width: SELECT.w,
              height: 40,
              boxSizing: 'border-box',
              border: `${listOpen > 0 ? 2 : 1}px solid ${listOpen > 0 ? R.primary : R.divider}`,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px 0 12px',
              fontSize: 16,
              color: R.text,
              background: '#fff',
              opacity: dlg,
              zIndex: 32,
            }}
          >
            <span style={{ flex: 1 }}>5 minutes</span>
            <RIcon name="dropdown-arrow" size={22} color="rgba(0,0,0,0.6)" />
          </div>
        )}
        {listOpen > 0 && (
          <div
            style={{
              position: 'absolute',
              left: SELECT.x,
              top: SELECT.y + 44,
              width: SELECT.w,
              background: '#fff',
              borderRadius: 4,
              boxShadow: '0 5px 18px rgba(0,0,0,0.22)',
              padding: '8px 0',
              opacity: listOpen,
              zIndex: 33,
            }}
          >
            {OPTIONS.map((o, i) => (
              <div
                key={o}
                style={{
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 14px',
                  fontSize: 16,
                  color: R.text,
                  background: i === hoverOpt ? 'rgba(0,0,0,0.06)' : i === 0 ? 'rgba(55,113,224,0.12)' : 'transparent',
                }}
              >
                {o}
              </div>
            ))}
          </div>
        )}
      </RoomChrome>
    </Stage>
  );
};
