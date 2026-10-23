import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Stage, cursorPos, fade, near } from '../Stage';
import { RoomChrome, TileGrid, stageRect, Menu, Dialog } from '../room/Room';
import { ParticipantsPanel, Section, layoutSections, sectionMenuAt } from '../room/Participants';
import { PEOPLE, Person, byId } from '../room/people';
import { R, RFONT } from '../room/theme';

// Fix "Admitting from the lobby": AwaitingEntrySectionActions.tsx (Waiting section menu) + modals.json:286
export const LOBBY_LEN = 260;
const C = { menu: 50, admitAll: 84, confirm: 128 };
export const LOBBY_CLICKS = Object.values(C);

const WAITING = ['mateo', 'isabelle', 'mei'];
const inRoom = PEOPLE.filter((p) => !WAITING.includes(p.id));

const sections = (admitted: boolean, menuHover: boolean): Section[] => [
  ...(admitted
    ? []
    : [{ title: 'Waiting', waiting: true, menuHover, rows: WAITING.map((id) => ({ person: byId(id), waiting: true, secondary: 'Attendee' })) }]),
  { title: 'Moderators', rows: inRoom.filter((p) => p.role === 'Moderators').map((person) => ({ person })) },
  { title: 'Speakers', rows: inRoom.filter((p) => p.role === 'Speakers').map((person) => ({ person })) },
  {
    title: 'Attendees',
    rows: (admitted ? PEOPLE : inRoom).filter((p) => p.role === 'Attendees').map((person: Person) => ({ person })),
  },
];

const pos = layoutSections(sections(false, false));
const dots = sectionMenuAt(pos[0].header);
const MENU = { x: dots.x - 20, y: dots.y + 20 };
const admitItem = { x: MENU.x + 110, y: MENU.y + 8 + 20 };
const confirmBtn = { x: 819, y: 370 };

const PATH = [
  { f: 0, x: 1000, y: 600 },
  { f: 22, x: 1000, y: 600 },
  { f: 46, ...dots },
  { f: 56, ...dots },
  { f: 74, ...admitItem },
  { f: 96, ...admitItem },
  { f: 120, ...confirmBtn },
];
const CAMERA = [
  { f: 0, z: 1, x: 720, y: 405 },
  { f: 24, z: 1, x: 720, y: 405 },
  { f: 50, z: 1.5, x: 480, y: 330 },
  { f: 88, z: 1.5, x: 480, y: 330 },
  { f: 104, z: 1.45, x: 720, y: 330 },
  { f: 132, z: 1.45, x: 720, y: 330 },
  { f: 162, z: 1, x: 720, y: 405 },
];

export const Lobby: React.FC = () => {
  const frame = useCurrentFrame();
  const cur = cursorPos(frame, PATH);
  const admitted = frame >= C.confirm + 4;
  const menu = frame < C.admitAll ? fade(frame, C.menu, C.menu + 6) : 0;
  const dlg = fade(frame, C.admitAll + 4, C.admitAll + 12, C.confirm, C.confirm + 6);
  const toast = fade(frame, 4, 14, C.menu - 6, C.menu);
  const tiles = (admitted ? PEOPLE : inRoom).map((person) => ({ person, camOff: person.you, speaking: person.id === 'matthias' }));

  return (
    <Stage url="acme.digitalsamba.com/all-hands" camera={CAMERA} path={PATH} clicks={LOBBY_CLICKS} aiNote>
      <RoomChrome activeTool="participants">
        <TileGrid tiles={tiles} {...stageRect(true)} cols={3} />
        <ParticipantsPanel sections={sections(admitted, menu > 0 || near(cur, dots, 20, 20))} />
        {toast > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 464,
              top: 58,
              width: 340,
              padding: '14px 16px',
              background: '#fff',
              borderRadius: 8,
              boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
              fontFamily: RFONT,
              fontSize: 14,
              color: R.text,
              opacity: toast,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: R.waitingAvatar, color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>MF</div>
              Mateo Fernández and 2 more participants want to join
            </div>
            <div style={{ alignSelf: 'flex-end', color: R.primary, fontWeight: 700, textTransform: 'uppercase' }}>Manage</div>
          </div>
        )}
        {menu > 0 && (
          <Menu
            x={MENU.x}
            y={MENU.y}
            opacity={menu}
            items={[
              { icon: 'approve-outlined', label: 'Admit all participants', hover: near(cur, admitItem, 130, 18) },
              { icon: 'delete-outlined', label: 'Reject all participants' },
              { icon: 'message-arrow', label: 'Send lobby message' },
            ]}
          />
        )}
        <Dialog
          title="Admit all waiting participants?"
          opacity={dlg}
          actions={[{ label: 'Cancel' }, { label: 'Admit all participants', primary: true, hover: dlg > 0 && near(cur, confirmBtn, 90, 20) }]}
        >
          Please confirm you want to admit all waiting participants into the session.
        </Dialog>
      </RoomChrome>
    </Stage>
  );
};
