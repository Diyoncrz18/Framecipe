import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { Stage, cursorPos, fade, near } from '../Stage';
import { C, FONT } from '../ac/theme';
import { Switch } from '../ac/primitives';
import { ContactListIcon, DashboardIcon, HistoryIcon, RecordingIcon, SettingsIcon } from '../ac/icons';
import { RoomChrome, TileGrid } from '../room/Room';
import { PEOPLE, byId } from '../room/people';
import { RFONT } from '../room/theme';

// "Hide tiles in recordings by role": react-dashboard Settings/Components/Sections/Recordings.js (origin/master)
export const HIDE_LEN = 420;
const C_ = { toggle: 44, removeSpeakers: 104 };
export const HIDE_CLICKS = Object.values(C_);
const SPLIT = 200;

const X = 281;
const RCOL = 760;
const ROLES = ['Moderators', 'Speakers', 'Attendees'];

// Chip geometry for the RolesSelect, so the cursor can hit the Speakers ×
const chipX = (i: number) => RCOL + 12 + i * 150;
const speakersX = { x: chipX(1) + 118, y: 524 };
const toggleAt = { x: RCOL + 19, y: 431 };

const NAV = [
  { label: 'Rooms', Icon: DashboardIcon, active: true },
  { label: 'Sessions', Icon: HistoryIcon },
  { label: 'Team', Icon: ContactListIcon },
  { label: 'Recordings', Icon: RecordingIcon },
  { label: 'System check', Icon: SettingsIcon },
];

const Row: React.FC<{ y: number; label: string; desc?: React.ReactNode; children?: React.ReactNode; opacity?: number }> = ({ y, label, desc, children, opacity = 1 }) => (
  <div style={{ position: 'absolute', left: X, top: y, width: 1135, opacity }}>
    <div style={{ width: 440 }}>
      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{label}</div>
      {desc && <div style={{ fontSize: 14, lineHeight: 1.3, color: C.textSecondary }}>{desc}</div>}
    </div>
    <div style={{ position: 'absolute', left: RCOL - X, top: 0 }}>{children}</div>
  </div>
);

const Dashboard: React.FC<{ hideOn: boolean; hidden: string[]; reveal: number; toggleHover: boolean; xHover: boolean }> = ({ hideOn, hidden, reveal, toggleHover, xHover }) => {
  const recorded = ROLES.filter((r) => !hidden.includes(r));
  const push = 110 * reveal;
  return (
    <div style={{ position: 'relative', width: 1440, height: 810, background: '#fff', fontFamily: FONT, color: C.text, overflow: 'hidden' }}>
      <Img src={staticFile('logo-color.svg')} style={{ position: 'absolute', left: 24, top: 20, height: 50 }} />
      <div style={{ position: 'absolute', left: 24, top: 102, width: 225, height: 300, borderRight: `1px solid ${C.divider}` }} />
      {NAV.map(({ label, Icon, active }, i) => (
        <div key={label} style={{ position: 'absolute', left: 48, top: 110 + i * 48, height: 40, display: 'flex', alignItems: 'center', gap: 16, fontSize: 16, color: active ? C.primary : C.text }}>
          <Icon size={24} color={active ? C.primary : C.text} />
          {label}
        </div>
      ))}
      <div style={{ position: 'absolute', left: 248, top: 110, width: 2, height: 40, background: C.primary }} />

      <div style={{ position: 'absolute', left: X, top: 128, fontSize: 24 }}>Edit room</div>
      <div style={{ position: 'absolute', left: 1416 - 110, top: 124, width: 110, height: 38, borderRadius: 4, background: C.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
        Update
      </div>
      <div style={{ position: 'absolute', left: X, top: 196, fontSize: 18, fontWeight: 600 }}>Recordings</div>
      <div style={{ position: 'absolute', left: X, top: 230, width: 1135, height: 1, background: C.divider }} />

      <Row y={250} label="Recordings" desc="Allow participants to record sessions. Remember recordings are not compatible with E2EE.">
        <Switch x={0} y={0} on />
      </Row>
      <Row
        y={318}
        label="Recording layout mode"
        desc="Auto mode automatically magnifies the active speaker while tiled mode renders a basic grid with participant tiles. However, both layout modes will magnify any open content or shared screen."
      >
        <div style={{ display: 'flex', gap: 28, fontSize: 16 }}>
          {['Auto', 'Tiled'].map((l) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: 9, border: `2px solid ${l === 'Tiled' ? C.primary : '#757575'}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {l === 'Tiled' && <div style={{ width: 8, height: 8, borderRadius: 4, background: C.primary }} />}
              </div>
              {l}
            </div>
          ))}
        </div>
      </Row>
      <Row
        y={420}
        label="Hide tiles in recordings"
        desc="When enabled, recordings will not capture participants’ video streams. Participants’ audio, screenshare and other type of content will still be recorded."
      >
        <div style={{ position: 'relative', filter: toggleHover ? 'brightness(1.08)' : undefined }}>
          <Switch x={0} y={0} on={hideOn} />
        </div>
      </Row>
      {reveal > 0 && (
        <Row
          y={506}
          opacity={reveal}
          label="Hide tiles for"
          desc={
            <>
              Tiles recorded: <b style={{ color: C.text }}>{recorded.length ? recorded.join(', ') : 'none'}</b>. Audio and shared content is recorded for everyone.
              <br />
              Roles added to this room later are hidden by default.
            </>
          }
        >
          <div style={{ width: 560, minHeight: 44, border: `1px solid ${C.divider}`, borderRadius: 4, position: 'relative' }}>
            {ROLES.filter((r) => hidden.includes(r)).map((r, i) => {
              const hot = r === 'Speakers' && xHover;
              return (
                <div
                  key={r}
                  style={{
                    position: 'absolute',
                    left: chipX(i) - RCOL,
                    top: 6,
                    height: 32,
                    padding: '0 8px 0 14px',
                    borderRadius: 16,
                    background: '#EFEFEF',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 15,
                  }}
                >
                  {r}
                  <div style={{ width: 20, height: 20, borderRadius: 10, background: hot ? '#757575' : 'rgba(0,0,0,0.26)', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ×
                  </div>
                </div>
              );
            })}
          </div>
        </Row>
      )}
      <Row y={530 + push} label="Show logo in recordings" desc="When enabled, the logo will be shown in this room’s recordings.">
        <Switch x={0} y={0} on />
      </Row>
      <Row y={598 + push} label="Show name badges in recordings" desc="When enabled, recordings in this room will include participant name badges on tiles.">
        <Switch x={0} y={0} on />
      </Row>
    </div>
  );
};

const PATH = [
  { f: 0, x: 1000, y: 650 },
  { f: 16, x: 1000, y: 650 },
  { f: 38, ...toggleAt },
  { f: 70, ...toggleAt },
  { f: 98, ...speakersX },
  { f: 116, ...speakersX },
  { f: 140, x: speakersX.x + 40, y: speakersX.y + 90 },
];
const CAMERA = [
  { f: 0, z: 1, x: 720, y: 405 },
  { f: 14, z: 1, x: 720, y: 405 },
  { f: 40, z: 1.3, x: 820, y: 440 },
  { f: 200, z: 1.3, x: 820, y: 460 },
];

// Recorder output: only visible roles keep tiles (systemSessionSelectors.ts)
const RecordingView: React.FC<{ frame: number }> = ({ frame }) => {
  const t = 37 + Math.floor((frame - SPLIT) / 30);
  return (
    <div style={{ position: 'relative', width: 1440, height: 810, background: '#000', overflow: 'hidden', fontFamily: RFONT }}>
      <TileGrid tiles={[{ person: byId('matthias'), speaking: true }, { person: byId('elena') }]} x={8} y={120} w={1424} h={560} cols={2} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, background: 'linear-gradient(transparent, rgba(0,0,0,0.75))' }} />
      <div style={{ position: 'absolute', left: 28, bottom: 24, color: '#fff', fontSize: 22, display: 'flex', gap: 18, alignItems: 'center' }}>
        <span style={{ fontSize: 26 }}>▶</span> 0:{String(t).padStart(2, '0')} / 1:14
      </div>
      <div style={{ position: 'absolute', left: 200, right: 28, bottom: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }}>
        <div style={{ width: `${(t / 74) * 100}%`, height: '100%', background: '#fff', borderRadius: 2 }} />
      </div>
    </div>
  );
};

const Panel: React.FC<{ label: string; x: number; delay: number; frame: number; children: React.ReactNode }> = ({ label, x, delay, frame, children }) => {
  const o = fade(frame, SPLIT + delay, SPLIT + delay + 14);
  return (
    <div style={{ position: 'absolute', left: x, top: 230, opacity: o, transform: `translateY(${(1 - o) * 24}px)` }}>
      <div style={{ fontFamily: RFONT, fontSize: 34, fontWeight: 600, color: '#323F66', marginBottom: 18 }}>{label}</div>
      <div style={{ width: 860, height: 484, borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 60px rgba(50,63,102,0.25)' }}>
        <div style={{ transform: 'scale(0.5972)', transformOrigin: '0 0' }}>{children}</div>
      </div>
    </div>
  );
};

export const HideTiles: React.FC = () => {
  const frame = useCurrentFrame();
  const cur = cursorPos(frame, PATH);
  const hideOn = frame >= C_.toggle + 2;
  const hidden = frame >= C_.removeSpeakers + 2 ? ['Moderators', 'Attendees'] : ROLES;
  const reveal = fade(frame, C_.toggle + 2, C_.toggle + 12);

  if (frame < SPLIT) {
    return (
      <Stage url="dashboard.digitalsamba.com/teams/acme/rooms/all-hands" camera={CAMERA} path={PATH} clicks={HIDE_CLICKS}>
        <Dashboard
          hideOn={hideOn}
          hidden={hidden}
          reveal={reveal}
          toggleHover={near(cur, toggleAt, 24, 16)}
          xHover={near(cur, speakersX, 14, 14)}
        />
      </Stage>
    );
  }

  const tiles = PEOPLE.map((person) => ({ person, camOff: person.you, speaking: person.id === 'matthias' }));
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #f8fafe 0%, #EBF1FC 100%)' }}>
      <Panel label="In the room" x={70} delay={0} frame={frame}>
        <RoomChrome>
          <TileGrid tiles={tiles} x={96} y={52} w={1336} h={746} cols={3} />
        </RoomChrome>
      </Panel>
      <Panel label="In the recording" x={990} delay={10} frame={frame}>
        <RecordingView frame={frame} />
      </Panel>
      <div
        style={{
          position: 'absolute',
          left: 990,
          top: 870,
          fontFamily: RFONT,
          fontSize: 26,
          color: '#323F66',
          opacity: fade(frame, SPLIT + 70, SPLIT + 86),
        }}
      >
        Hidden: Moderators, Attendees · audio still recorded
      </div>
      <div style={{ position: 'absolute', left: 24, bottom: 16, fontFamily: RFONT, fontSize: 18, color: 'rgba(50,63,102,0.55)' }}>People shown are AI-generated</div>
    </AbsoluteFill>
  );
};

