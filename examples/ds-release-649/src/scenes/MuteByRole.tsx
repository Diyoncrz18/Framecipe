import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Stage, cursorPos, fade, near } from '../Stage';
import { RoomChrome, TileGrid, stageRect, Menu, Dialog } from '../room/Room';
import { ParticipantsPanel, Section, layoutSections, sectionMenuAt } from '../room/Participants';
import { PEOPLE } from '../room/people';

// "Mute or turn off cameras by role": RoleSectionActionsMenu.tsx + BulkMute*Confirmation.tsx
export const MUTE_LEN = 320;

const C = { menu1: 50, mute: 80, confirm1: 116, menu2: 184, cams: 206, confirm2: 238 };
export const MUTE_CLICKS = Object.values(C);

const sectionsFor = (attMicOff: boolean, menuHover: boolean): Section[] => [
  { title: 'Moderators', rows: PEOPLE.filter((p) => p.role === 'Moderators').map((person) => ({ person })) },
  { title: 'Speakers', rows: PEOPLE.filter((p) => p.role === 'Speakers').map((person) => ({ person })) },
  { title: 'Attendees', rows: PEOPLE.filter((p) => p.role === 'Attendees').map((person) => ({ person, micOff: attMicOff })), menuHover },
];

const pos = layoutSections(sectionsFor(false, false));
const dots = sectionMenuAt(pos[2].header);
const MENU = { x: dots.x - 20, y: dots.y + 20 };
const muteItem = { x: MENU.x + 90, y: MENU.y + 8 + 34 + 20 };
const camsItem = { x: MENU.x + 110, y: muteItem.y + 40 };
const confirmBtn = { x: 878, y: 370 };

const PATH = [
  { f: 0, x: 980, y: 620 },
  { f: 20, x: 980, y: 620 },
  { f: 45, ...dots },
  { f: 60, ...dots },
  { f: 74, ...muteItem },
  { f: 92, ...muteItem },
  { f: 110, ...confirmBtn },
  { f: 160, ...confirmBtn },
  { f: 180, ...dots },
  { f: 190, ...dots },
  { f: 200, ...camsItem },
  { f: 216, ...camsItem },
  { f: 232, ...confirmBtn },
];

const CAMERA = [
  { f: 0, z: 1, x: 720, y: 405 },
  { f: 22, z: 1, x: 720, y: 405 },
  { f: 52, z: 1.55, x: 520, y: 470 },
  { f: 84, z: 1.55, x: 520, y: 470 },
  { f: 98, z: 1.45, x: 720, y: 330 },
  { f: 122, z: 1.45, x: 720, y: 330 },
  { f: 148, z: 1, x: 720, y: 405 },
  { f: 162, z: 1, x: 720, y: 405 },
  { f: 184, z: 1.55, x: 520, y: 470 },
  { f: 210, z: 1.55, x: 520, y: 470 },
  { f: 222, z: 1.45, x: 720, y: 330 },
  { f: 242, z: 1.45, x: 720, y: 330 },
  { f: 268, z: 1, x: 720, y: 405 },
];

export const MuteByRole: React.FC = () => {
  const frame = useCurrentFrame();
  const cur = cursorPos(frame, PATH);
  const muted = frame >= C.confirm1 + 4;
  const camsOff = frame >= C.confirm2 + 4;

  const menu1 = frame < C.mute ? fade(frame, C.menu1, C.menu1 + 6) : 0;
  const menu2 = frame < C.cams ? fade(frame, C.menu2, C.menu2 + 6) : 0;
  const menuOpen = Math.max(menu1, menu2);
  const dlg1 = fade(frame, C.mute + 4, C.mute + 12, C.confirm1, C.confirm1 + 6);
  const dlg2 = fade(frame, C.cams + 4, C.cams + 12, C.confirm2, C.confirm2 + 6);

  const tiles = PEOPLE.map((person) => {
    const att = person.role === 'Attendees';
    return {
      person,
      camOff: person.you || (att && camsOff),
      micOff: att && muted,
      speaking: person.id === 'matthias',
    };
  });
  const st = stageRect(true);

  return (
    <Stage url="acme.digitalsamba.com/all-hands" camera={CAMERA} path={PATH} clicks={MUTE_CLICKS} aiNote>
      <RoomChrome activeTool="participants">
        <TileGrid tiles={tiles} {...st} cols={3} />
        <ParticipantsPanel sections={sectionsFor(muted, menuOpen > 0 || near(cur, dots, 20, 20))} />
        {menuOpen > 0 && (
          <Menu
            x={MENU.x}
            y={MENU.y}
            title="Attendees"
            opacity={menuOpen}
            items={[
              { icon: 'mute', label: 'Mute all', hover: near(cur, muteItem, 120, 18) },
              { icon: 'camera-off', label: 'Turn off all cameras', hover: near(cur, camsItem, 120, 18) },
              { icon: 'streaming', label: 'Allow video & audio broadcast' },
              { icon: 'broadcast-audio', label: 'Allow audio only broadcast' },
              { icon: 'streaming', label: 'Disallow broadcast' },
              { icon: 'remove', label: 'Remove all' },
            ]}
          />
        )}
        <Dialog
          title="Mute everyone in this group?"
          opacity={dlg1}
          actions={[{ label: 'Cancel' }, { label: 'Mute all', primary: true, hover: dlg1 > 0 && near(cur, confirmBtn, 50, 20) }]}
        >
          Everyone in the <b style={{ color: 'rgba(0,0,0,0.87)' }}>Attendees</b> group will be muted. They can unmute themselves.
        </Dialog>
        <Dialog
          title="Turn off cameras in this group?"
          opacity={dlg2}
          actions={[{ label: 'Cancel' }, { label: 'Turn off all', primary: true, hover: dlg2 > 0 && near(cur, confirmBtn, 50, 20) }]}
        >
          Everyone in the <b style={{ color: 'rgba(0,0,0,0.87)' }}>Attendees</b> group will have their camera turned off. They can turn it back on.
        </Dialog>
      </RoomChrome>
    </Stage>
  );
};
