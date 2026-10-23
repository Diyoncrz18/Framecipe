import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { fade, typed } from '../Stage';
import { RoomChrome, TileGrid, Toast } from '../room/Room';
import { PEOPLE } from '../room/people';
import { RFONT } from '../room/theme';

// "Recording bookmarks through the SDK": addRecordingBookmark(bookmark), embedded SDK 0.0.58+.
// The room confirms with the "Recording bookmark added" toast (onRecordingBookmarkCreatedSaga.ts).
export const SDK_LEN = 260;
const TYPE_AT = 34;
const LINE = "sambaFrame.addRecordingBookmark('Q&A starts');";
const TOAST_AT = TYPE_AT + LINE.length * 2 + 22;

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace';
const K = { kw: '#c792ea', fn: '#82aaff', str: '#c3e88d', cm: '#697098', tx: '#d6deeb' };

const Code: React.FC<{ frame: number }> = ({ frame }) => {
  const line = typed(frame, LINE, TYPE_AT, 2);
  const caret = frame % 30 < 18;
  const done = line.length === LINE.length;
  const L = (n: number, children: React.ReactNode) => (
    <div style={{ display: 'flex', minHeight: 40 }}>
      <span style={{ width: 44, color: '#4b5263', textAlign: 'right', marginRight: 22 }}>{n}</span>
      <span>{children}</span>
    </div>
  );
  // Colour the typed line by splitting at the method name and the string
  const m = line.match(/^(sambaFrame\.?)(addRecordingBookmark)?(\(?)('[^']*'?)?(.*)$/);
  return (
    <div style={{ fontFamily: MONO, fontSize: 25, color: K.tx, lineHeight: '40px' }}>
      {L(1, <><span style={{ color: K.kw }}>const</span> sambaFrame = DigitalSambaEmbedded.<span style={{ color: K.fn }}>createControl</span>({'{'}</>)}
      {L(2, <>&nbsp;&nbsp;url: <span style={{ color: K.str }}>'https://acme.digitalsamba.com/all-hands'</span>,</>)}
      {L(3, <>{'}'});</>)}
      {L(4, <>sambaFrame.<span style={{ color: K.fn }}>load</span>();</>)}
      {L(5, '')}
      {L(6, <>sambaFrame.<span style={{ color: K.fn }}>on</span>(<span style={{ color: K.str }}>'recordingStarted'</span>, () =&gt; {'{'}</>)}
      {L(7, <span style={{ color: K.cm }}>&nbsp;&nbsp;// Mark the moment the Q&amp;A begins</span>)}
      {L(
        8,
        <>
          &nbsp;&nbsp;{m?.[1]}
          <span style={{ color: K.fn }}>{m?.[2]}</span>
          {m?.[3]}
          <span style={{ color: K.str }}>{m?.[4]}</span>
          {m?.[5]}
          {(!done || caret) && <span style={{ display: 'inline-block', width: 2, height: 28, background: '#fff', verticalAlign: 'middle', marginLeft: 1 }} />}
        </>,
      )}
      {L(9, <>{'}'});</>)}
    </div>
  );
};

export const SdkBookmark: React.FC = () => {
  const frame = useCurrentFrame();
  const inE = fade(frame, 0, 12);
  const inR = fade(frame, 8, 22);
  const toast = fade(frame, TOAST_AT, TOAST_AT + 8);
  const tiles = PEOPLE.slice(0, 6).map((person) => ({ person, camOff: person.you, speaking: person.id === 'matthias' }));

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #f8fafe 0%, #EBF1FC 100%)', fontFamily: RFONT }}>
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 200,
          width: 980,
          height: 520,
          borderRadius: 14,
          background: '#1b1e2b',
          boxShadow: '0 24px 60px rgba(50,63,102,0.3)',
          overflow: 'hidden',
          opacity: inE,
          transform: `translateY(${(1 - inE) * 24}px)`,
        }}
      >
        <div style={{ height: 52, background: '#14161f', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
          ))}
          <span style={{ marginLeft: 16, color: '#8b93b1', fontFamily: MONO, fontSize: 18 }}>app.js</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: '#8b93b1', fontFamily: MONO, fontSize: 16 }}>@digitalsamba/embedded-sdk 0.0.58</span>
        </div>
        <div style={{ padding: '22px 10px' }}>
          <Code frame={frame} />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 1090,
          top: 290,
          width: 780,
          height: 439,
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(50,63,102,0.3)',
          opacity: inR,
          transform: `translateY(${(1 - inR) * 24}px)`,
        }}
      >
        <div style={{ transform: `scale(${780 / 1440})`, transformOrigin: '0 0' }}>
          <RoomChrome recording>
            <TileGrid tiles={tiles} x={96} y={52} w={1336} h={746} cols={3} />
          </RoomChrome>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: 'scale(1.35)', transformOrigin: '1480px 330px' }}>
        <Toast text="Recording bookmark added" opacity={toast} x={1300} y={330} icon="rec" />
      </div>
      <div style={{ position: 'absolute', left: 1090, top: 240, fontSize: 28, fontWeight: 600, color: '#323F66', opacity: inR }}>Your app, with the room embedded</div>
      <div style={{ position: 'absolute', left: 24, bottom: 16, fontSize: 18, color: 'rgba(50,63,102,0.55)' }}>People shown are AI-generated</div>
    </AbsoluteFill>
  );
};

export const SDK_TOAST_AT = TOAST_AT;
