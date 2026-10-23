import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { Stage, cursorPos, fade, near } from '../Stage';
import { RoomChrome, TileGrid, stageRect } from '../room/Room';
import { byId } from '../room/people';
import { APP_W, R, RFONT } from '../room/theme';

// "Unmute by default in breakout rooms": broadcast-setup/modals/PreviewModal.tsx; for reason 'breakout' the
// Camera and Microphone toggles now default on (useBroadcastSetupMedia.ts). Seen from Sofia's side.
export const BREAKOUT_LEN = 240;
const START_AT = 150;
export const BREAKOUT_CLICKS = [START_AT];

const W = 560;
const LEFT = APP_W / 2 - W / 2;
const TOP = 120;
const startBtn = { x: LEFT + W - 24 - 76, y: TOP + 502 };

const PATH = [
  { f: 0, x: 1100, y: 640 },
  { f: 100, x: 1100, y: 640 },
  { f: 140, ...startBtn },
];
const CAMERA = [
  { f: 0, z: 1.25, x: 720, y: 400 },
  { f: 100, z: 1.25, x: 720, y: 420 },
  { f: 160, z: 1.25, x: 720, y: 420 },
  { f: 190, z: 1, x: 720, y: 405 },
];

// Room switch (components/Switch.tsx): 36x22, thumb 16, primary border when on
const RSwitch: React.FC<{ on: boolean; glow: number }> = ({ on, glow }) => (
  <div
    style={{
      width: 36,
      height: 22,
      borderRadius: 11,
      boxSizing: 'border-box',
      border: `1px solid ${on ? R.primary : R.divider}`,
      background: on ? R.primary : '#fff',
      position: 'relative',
      boxShadow: glow ? `0 0 0 ${6 * glow}px rgba(55,113,224,${0.25 * glow})` : 'none',
    }}
  >
    <div style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: 8, background: on ? '#fff' : R.divider }} />
  </div>
);

export const Breakout: React.FC = () => {
  const frame = useCurrentFrame();
  const cur = cursorPos(frame, PATH);
  const modal = frame < START_AT + 4 ? fade(frame, 6, 16) : 0;
  const joined = frame >= START_AT + 6;
  const glow = fade(frame, 40, 52, 90, 110);
  const tiles = [
    ...(joined ? [{ person: { ...byId('sofia'), you: true } }] : []),
    { person: byId('jonas') },
    { person: byId('mei') },
    { person: byId('mateo'), speaking: true },
  ];
  const st = stageRect(false);

  return (
    <Stage url="acme.digitalsamba.com/all-hands" camera={CAMERA} path={PATH} clicks={BREAKOUT_CLICKS} aiNote>
      <RoomChrome roomName="Breakout room 2" micOff={!joined} camOff={!joined}>
        <TileGrid tiles={tiles} {...st} cols={2} />
        {modal > 0 && (
          <>
            <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${0.5 * modal})` }} />
            <div
              style={{
                position: 'absolute',
                left: LEFT,
                top: TOP,
                width: W,
                background: '#fff',
                borderRadius: 4,
                fontFamily: RFONT,
                color: R.text,
                opacity: modal,
                transform: `scale(${0.94 + 0.06 * modal})`,
                boxShadow: '0 11px 15px -7px rgba(0,0,0,0.2), 0 24px 38px 3px rgba(0,0,0,0.14)',
              }}
            >
              <div style={{ padding: '20px 24px 8px', fontSize: 20, fontWeight: 500 }}>Start broadcasting?</div>
              <div style={{ padding: '0 24px 14px', fontSize: 16, lineHeight: 1.45, color: R.text2 }}>
                You have joined <b style={{ color: R.text }}>Breakout room 2</b> with permission to broadcast. You may need to test your media devices.
              </div>
              <div style={{ margin: '0 24px', height: 288, borderRadius: 8, overflow: 'hidden', background: R.tile }}>
                <Img src={staticFile('people/sofia.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              {['Camera', 'Microphone'].map((l) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px 0', fontSize: 16 }}>
                  {l}
                  <RSwitch on glow={glow} />
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '18px 16px 16px' }}>
                {['Cancel', 'Start Broadcast'].map((a) => (
                  <div
                    key={a}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 4,
                      fontSize: 14,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: a === 'Cancel' ? R.grey600 : R.primary,
                      background: a !== 'Cancel' && near(cur, startBtn, 70, 18) ? 'rgba(55,113,224,0.1)' : 'transparent',
                    }}
                  >
                    {a}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </RoomChrome>
    </Stage>
  );
};
