import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Cursor, cursorAt, press } from './Cursor';
import { APP_H, APP_W, C, CHROME_H, FONT } from './ui/theme';
import { Shell } from './ui/Shell';
import { Dashboard, NEW_CARD, SCHEDULE_BTN } from './ui/Dashboard';
import { FORM, ScheduleForm } from './ui/ScheduleForm';
import { Soundtrack } from './Soundtrack';
import { NarratorTile } from './NarratorTile';

// ---------------------------------------------------------------------------
// Timeline (30fps). Every cursor move, click and camera move is anchored here.
//   Dashboard            0 -  92   click "Schedule a call" @78         VO 01_intro        @8   (3.20s)
//   Schedule form       92 - 490   title + type of call               VO 02_details      @106 (6.17s)
//                                  two participants                   VO 03_participants @294 (3.62s)
//                                  save @432, dialog OK @478          VO 04_save         @424 (2.90s)
//   Dashboard (result) 490 - 650   new call slides in, hover card     VO 05_result       @534 (3.62s)
//   End card           650 - 790                                      VO 06_end          @668 (2.54s)
//   Voice: Lugh (Qwen3 clone of the meeting agent's lugh-reference.wav). public/narrator.mp4 is
//   SoulX Pro driven by public/audio/vo-full.mp3, which is these lines placed on this timeline.
// ---------------------------------------------------------------------------
export const DURATION = 790;

const CLICK = {
  schedule: 78,
  title: 128,
  type: 218,
  webinar: 246,
  participant: 283,
  anna: 316,
  participant2: 333,
  marco: 364,
  save: 432,
  ok: 478,
};
const TO_FORM = 92;
const TO_RESULT = 490;
const END = 650;

const TITLE = 'Q4 Product Review';
const typed = (frame: number, text: string, start: number, perChar = 3) =>
  text.slice(0, Math.max(0, Math.min(text.length, Math.floor((frame - start) / perChar) + 1)));

const center = (b: { x: number; y: number; w: number; h?: number }, dx = 0) => ({ x: b.x + b.w / 2 + dx, y: b.y + (b.h ?? 38) / 2 });

const sb = center(SCHEDULE_BTN);
const title = center(FORM.title, -60);
const type = center(FORM.type, -120);
const webinar = center(FORM.typeOption(1), -150);
const part = center(FORM.participant, -40);
const sugg = center(FORM.suggestion, -60);
const save = center(FORM.save);
const ok = center(FORM.ok);

const PATH = [
  { f: 0, x: 860, y: 720 },
  { f: 30, x: 860, y: 720 },
  { f: 70, x: sb.x, y: sb.y },
  { f: 100, x: sb.x, y: sb.y },
  { f: 124, ...title },
  { f: 195, ...title },
  { f: 214, ...type },
  { f: 228, ...type },
  { f: 241, ...webinar },
  { f: 256, ...webinar },
  { f: 279, ...part },
  { f: 300, ...part },
  { f: 312, ...sugg },
  { f: 320, ...sugg },
  { f: 330, ...part },
  { f: 350, ...part },
  { f: 360, ...sugg },
  { f: 374, ...sugg },
  { f: 426, ...save },
  { f: 454, ...save },
  { f: 472, ...ok },
  { f: 492, ...ok },
  { f: 550, x: 720, y: NEW_CARD.y + 50 },
];

// Camera: zoom and the app-space point it centres on
type Cam = { f: number; z: number; x: number; y: number };
const CAMERA: Cam[] = [
  { f: 0, z: 1, x: 720, y: 405 },
  { f: 30, z: 1, x: 720, y: 405 },
  { f: 72, z: 1.45, x: 1150, y: 330 },
  { f: 96, z: 1.45, x: 1150, y: 330 },
  { f: 126, z: 1.6, x: 560, y: 320 },
  { f: 250, z: 1.6, x: 560, y: 340 },
  { f: 280, z: 1.6, x: 1100, y: 300 },
  { f: 372, z: 1.6, x: 1100, y: 300 },
  { f: 426, z: 1.45, x: 1150, y: 240 },
  { f: 436, z: 1.45, x: 1150, y: 240 },
  { f: 462, z: 1.15, x: 720, y: 420 },
  { f: 492, z: 1.15, x: 720, y: 420 },
  { f: 522, z: 1.4, x: 760, y: 560 },
  { f: 550, z: 1.4, x: 760, y: 560 },
  { f: 570, z: 1.4, x: 1000, y: 480 },
  { f: 640, z: 1.4, x: 1000, y: 480 },
  { f: 680, z: 1, x: 720, y: 405 },
];

const ease = Easing.bezier(0.65, 0, 0.35, 1);
const cameraAt = (frame: number): Cam => {
  if (frame <= CAMERA[0].f) return CAMERA[0];
  for (let i = 1; i < CAMERA.length; i++) {
    const a = CAMERA[i - 1];
    const b = CAMERA[i];
    if (frame <= b.f) {
      const t = ease((frame - a.f) / (b.f - a.f));
      return { f: frame, z: a.z + (b.z - a.z) * t, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return CAMERA[CAMERA.length - 1];
};

const BASE = 1.15; // window scale at zoom 1 (1440 -> 1656px wide)
const WIN_H = APP_H + CHROME_H;

const clampCentre = (c: number, half: number, size: number) => (size <= half * 2 ? size / 2 : Math.min(Math.max(c, half), size - half));

const BrowserChrome: React.FC<{ path: string }> = ({ path }) => (
  <div
    style={{
      height: CHROME_H,
      background: '#f1f3f6',
      borderBottom: '1px solid #dfe3ea',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 8,
    }}
  >
    {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
      <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
    ))}
    <div
      style={{
        marginLeft: 120,
        flex: 1,
        maxWidth: 760,
        height: 26,
        borderRadius: 13,
        background: C.white,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        fontFamily: FONT,
        fontSize: 13,
        color: '#5f6368',
      }}
    >
      my.digitalsamba.com<span style={{ color: '#9aa0a6' }}>{path}</span>
    </div>
  </div>
);

export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cur = cursorAt(frame, PATH);
  const clicks = Object.values(CLICK);

  // --- page state -----------------------------------------------------------
  const onForm = frame >= TO_FORM && frame < TO_RESULT;
  const pageFade = onForm
    ? interpolate(frame, [TO_FORM, TO_FORM + 8], [0, 1], { extrapolateRight: 'clamp' })
    : frame >= TO_RESULT
      ? interpolate(frame, [TO_RESULT, TO_RESULT + 8], [0, 1], { extrapolateRight: 'clamp' })
      : 1;

  const caret = frame % 30 < 18;
  const titleText = frame >= CLICK.title + 6 ? typed(frame, TITLE, CLICK.title + 6) : '';
  const typeOpen = frame >= CLICK.type && frame < CLICK.webinar + 4 ? interpolate(frame, [CLICK.type, CLICK.type + 5], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  const typeIndex = frame >= CLICK.webinar ? 1 : 0;

  let participantText = '';
  let suggestion: number | null = null;
  let added = 0;
  if (frame >= CLICK.participant + 5 && frame < CLICK.anna) {
    participantText = typed(frame, 'Ann', CLICK.participant + 5);
    suggestion = frame >= CLICK.participant + 13 ? 0 : null;
  }
  if (frame >= CLICK.anna) added = 1;
  if (frame >= CLICK.participant2 + 4 && frame < CLICK.marco) {
    participantText = typed(frame, 'Mar', CLICK.participant2 + 4);
    suggestion = frame >= CLICK.participant2 + 12 ? 1 : null;
  }
  if (frame >= CLICK.marco) added = 2;

  const dialog =
    frame < CLICK.ok
      ? interpolate(frame, [CLICK.save + 8, CLICK.save + 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : interpolate(frame, [CLICK.ok + 4, CLICK.ok + 11], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const insert = spring({ frame: frame - (TO_RESULT + 14), fps, config: { damping: 18, mass: 0.8 } });
  const glow = interpolate(frame, [TO_RESULT + 30, TO_RESULT + 45, TO_RESULT + 90, TO_RESULT + 110], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const popper = interpolate(frame, [556, 564], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const near = (p: { x: number; y: number }, r = 30) => Math.abs(cur.x - p.x) < r * 2.5 && Math.abs(cur.y - p.y) < r;

  // --- camera -----------------------------------------------------------------
  const cam = cameraAt(frame);
  const intro = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 25 });
  const s = BASE * cam.z * (0.94 + 0.06 * intro);
  const cx = clampCentre(cam.x, 960 / s, APP_W);
  const cy = clampCentre(cam.y + CHROME_H, 540 / s, WIN_H);

  const endT = interpolate(frame, [END, END + 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const endIn = spring({ frame: frame - END - 8, fps, config: { damping: 200 } });

  const urlPath = onForm ? '/schedule/create' : '/dashboard';

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #f8fafe 0%, #EBF1FC 100%)', fontFamily: FONT, overflow: 'hidden' }}>
      <Soundtrack
        clicks={clicks}
        sfx={[
          { file: 'whoosh', at: TO_FORM - 6, volume: 0.25 },
          { file: 'typing', at: CLICK.title + 6, volume: 0.35, frames: TITLE.length * 3 },
          { file: 'pop', at: CLICK.type + 1, volume: 0.35 },
          { file: 'typing', at: CLICK.participant + 5, volume: 0.35, frames: 9 },
          { file: 'pop', at: CLICK.participant + 13, volume: 0.3 },
          { file: 'typing', at: CLICK.participant2 + 4, volume: 0.35, frames: 9 },
          { file: 'pop', at: CLICK.participant2 + 12, volume: 0.3 },
          { file: 'chime', at: CLICK.save + 8, volume: 0.4 },
          { file: 'whoosh', at: TO_RESULT - 6, volume: 0.25 },
          { file: 'pop', at: TO_RESULT + 16, volume: 0.4 },
          { file: 'whoosh', at: END - 4, volume: 0.2 },
        ]}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: APP_W,
          height: WIN_H,
          transformOrigin: '0 0',
          transform: `translate(${960 - cx * s}px, ${540 - cy * s}px) scale(${s})`,
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(50,63,102,0.25), 0 0 0 1px rgba(50,63,102,0.08)',
          opacity: intro,
          filter: endT > 0 ? `blur(${endT * 8}px)` : undefined,
        }}
      >
        <BrowserChrome path={urlPath} />
        <div style={{ position: 'relative', width: APP_W, height: APP_H }}>
          <Shell active={0}>
            <div style={{ opacity: pageFade }}>
              {onForm ? (
                <ScheduleForm
                  title={titleText}
                  titleFocus={frame >= CLICK.title && frame < CLICK.type}
                  caret={caret}
                  typeIndex={typeIndex}
                  typeOpen={typeOpen}
                  typeHover={near(webinar, 22) && typeOpen > 0 ? 1 : -1}
                  participantText={participantText}
                  participantFocus={frame >= CLICK.participant && frame < CLICK.save - 20}
                  suggestion={suggestion}
                  suggestionHover={suggestion !== null && near(sugg, 30)}
                  added={added}
                  saveHover={near(save, 20)}
                  savePress={press(frame, CLICK.save)}
                  dialog={dialog}
                  okHover={dialog > 0 && near(ok, 18)}
                />
              ) : frame < TO_FORM ? (
                <Dashboard hoverSchedule={near(sb, 20)} pressSchedule={press(frame, CLICK.schedule)} />
              ) : (
                <Dashboard
                  newCall={{ day: 'Today', title: TITLE, time: '14:30 - 15:00' }}
                  insert={insert}
                  glow={glow}
                  popper={popper}
                />
              )}
            </div>
          </Shell>
          <Cursor x={cur.x} y={cur.y} clicks={clicks} frame={frame} opacity={1 - endT} />
        </div>
      </div>

      {/* End card */}
      {endT > 0 && (
        <AbsoluteFill
          style={{
            background: `rgba(248,250,254,${0.85 * endT})`,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 36,
          }}
        >
          <Img src={staticFile('logo.svg')} style={{ height: 96, opacity: endIn, transform: `translateY(${(1 - endIn) * 20}px)` }} />
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              color: C.navy,
              letterSpacing: -1,
              opacity: endIn,
              transform: `translateY(${(1 - endIn) * 30}px)`,
            }}
          >
            Schedule a call in seconds.
          </div>
          <div style={{ fontSize: 30, color: C.primary, opacity: interpolate(frame, [END + 30, END + 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
            my.digitalsamba.com
          </div>
        </AbsoluteFill>
      )}

      <NarratorTile />
    </AbsoluteFill>
  );
};
