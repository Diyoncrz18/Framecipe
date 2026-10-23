import React from 'react';
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { fade } from '../Stage';
import { RFONT } from '../room/theme';

const NAVY = '#323F66';
const BLUE = '#3771e0';

export const TITLE_LEN = 150;
export const OUTRO_LEN = 120;

const ITEMS = [
  'Hide tiles in recordings by role',
  'Mute or turn off cameras by role',
  'Safer ban duration',
  'Recording bookmarks through the SDK',
  'Unmute by default in breakout rooms',
  'Fixed: admitting from the lobby',
];

const CORAL = '#F06859';

// Title and outro follow the digitalsamba.com hero: a navy band, bold white type,
// and a white-framed collage of video tiles (one large, three stacked)
const Navy: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: `radial-gradient(1200px 700px at 75% 40%, #3d4b7a 0%, ${NAVY} 60%, #283253 100%)`, fontFamily: RFONT, color: '#fff' }}>
    {children}
  </AbsoluteFill>
);

const Frame: React.FC<{ img: string; w: number; h: number; name?: string; speaking?: boolean; style?: React.CSSProperties }> = ({ img, w, h, name, speaking, style }) => (
  <div style={{ width: w, height: h, borderRadius: 14, overflow: 'hidden', position: 'relative', boxShadow: '0 20px 50px rgba(10,15,40,0.35)', ...style }}>
    <Img src={staticFile(`people/${img}.jpg`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    {name && (
      <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 14, background: 'rgba(0,0,0,0.6)', fontSize: 17 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: speaking ? '#00ff00' : 'rgba(255,255,255,0.7)' }} />
        {name}
      </div>
    )}
  </div>
);

export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (d: number) => spring({ frame: frame - d, fps, config: { damping: 18, mass: 0.9 } });
  const a = s(0);
  const b = s(6);
  const big = s(10);
  const smalls = [s(22), s(28), s(34)];
  const drift = frame * 0.06;
  return (
    <Navy>
      <div style={{ position: 'absolute', left: 140, top: 270, opacity: a, transform: `translateY(${(1 - a) * 20}px)` }}>
        <Img src={staticFile('logo_mono.svg')} style={{ height: 40, filter: 'brightness(0) invert(1)' }} />
      </div>
      <div style={{ position: 'absolute', left: 140, top: 350, opacity: b, transform: `translateY(${(1 - b) * 30}px)` }}>
        <div style={{ fontSize: 136, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>Release 649</div>
        <div style={{ fontSize: 34, color: CORAL, fontWeight: 600, marginTop: 22 }}>What's new · October 2026</div>
      </div>
      <div style={{ position: 'absolute', left: 140, top: 610, display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 44, rowGap: 18, width: 860 }}>
        {ITEMS.map((t, i) => {
          const o = fade(frame, 30 + i * 6, 42 + i * 6);
          return (
            <div key={t} style={{ fontSize: 22, whiteSpace: 'nowrap', opacity: o * 0.92, transform: `translateY(${(1 - o) * 12}px)`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, flexShrink: 0, background: t.startsWith('Fixed') ? '#4ade80' : CORAL }} />
              {t}
            </div>
          );
        })}
      </div>

      {/* Hero collage */}
      <div
        style={{
          position: 'absolute',
          left: 1040,
          top: 280,
          padding: 12,
          borderRadius: 22,
          background: '#fff',
          display: 'flex',
          gap: 12,
          opacity: big,
          transform: `translateY(${(1 - big) * 40 - drift}px) scale(${0.94 + 0.06 * big})`,
          boxShadow: '0 40px 90px rgba(10,15,40,0.45)',
        }}
      >
        <Frame img="elena" w={520} h={520} name="Elena Moreau" speaking style={{ boxShadow: 'none' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['matthias', 'sofia', 'julien'].map((p, i) => (
            <Frame key={p} img={p} w={190} h={165} style={{ boxShadow: 'none', opacity: smalls[i], transform: `translateX(${(1 - smalls[i]) * 30}px)` }} />
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 140, bottom: 30, fontSize: 16, color: 'rgba(255,255,255,0.45)' }}>People shown are AI-generated</div>
    </Navy>
  );
};

export const OutroCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 200 } });
  const people = ['elena', 'matthias', 'sofia', 'jonas', 'julien', 'mateo', 'isabelle', 'amara'];
  return (
    <Navy>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 230, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
        <Img src={staticFile('logo_mono.svg')} style={{ height: 46, filter: 'brightness(0) invert(1)' }} />
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2 }}>Release 649 is available now</div>
        <div style={{ fontSize: 34, color: CORAL, fontWeight: 600, opacity: fade(frame, 16, 28) }}>digitalsamba.com/release-notes</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 640, display: 'flex', justifyContent: 'center', gap: 16 }}>
        {people.map((p, i) => {
          const o = spring({ frame: frame - 10 - i * 3, fps, config: { damping: 16 } });
          return (
            <div key={p} style={{ padding: 6, borderRadius: 16, background: '#fff', opacity: o, transform: `translateY(${(1 - o) * 40}px)` }}>
              <Frame img={p} w={190} h={150} style={{ boxShadow: 'none', borderRadius: 11 }} />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 140, bottom: 30, fontSize: 16, color: 'rgba(255,255,255,0.45)' }}>People shown are AI-generated</div>
    </Navy>
  );
};

// Section heading over each feature scene, worded as in the release notes
export const SceneLabel: React.FC<{ kind: string; title: string }> = ({ kind, title }) => {
  const frame = useCurrentFrame();
  const o = fade(frame, 6, 16, 84, 96);
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        top: 44,
        opacity: o,
        transform: `translateY(${(1 - o) * -10}px)`,
        background: 'rgba(255,255,255,0.96)',
        borderRadius: 14,
        padding: '16px 26px',
        boxShadow: '0 14px 40px rgba(50,63,102,0.25)',
        fontFamily: RFONT,
        zIndex: 50,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: kind === 'Fixed' ? '#1eaf3f' : BLUE }}>{kind}</div>
      <div style={{ fontSize: 34, fontWeight: 600, color: NAVY, marginTop: 4 }}>{title}</div>
    </div>
  );
};
