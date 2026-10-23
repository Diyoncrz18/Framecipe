import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Stage, cursorPos, fade, near } from '../Stage';
import { Shell } from '../ac/Shell';
import { C, FONT } from '../ac/theme';
import { Button, FieldLabel, Switch, TextField } from '../ac/primitives';
import { RFONT } from '../room/theme';

// Digital Samba Free roundup (react-account-center): contact groups, the invitation toggle,
// public registration, and the crop dialog. Three quick vignettes.
export const FREE_LEN = 330;
const V = 110;
export const FREE_CLICKS = [50, V + 40, V + 76, 2 * V + 24];

const X = 281;

// --- A: contact groups (contact-list/_components/group-filter.js, table.js) -------------------------
const CONTACTS = [
  { name: 'Anna Schmidt', email: 'anna.schmidt@acme.eu', groups: ['Design team'] },
  { name: 'Marco Rossi', email: 'marco.rossi@acme.eu', groups: ['Customers'] },
  { name: 'Lea Novak', email: 'lea.novak@acme.eu', groups: ['Design team', 'Partners'] },
  { name: 'Tomás Ruiz', email: 'tomas.ruiz@acme.eu', groups: ['Customers'] },
  { name: 'Priya Shah', email: 'priya.shah@acme.eu', groups: ['Design team'] },
  { name: 'Oskar Berg', email: 'oskar.berg@acme.eu', groups: ['Partners'] },
  { name: 'Nina Weber', email: 'nina.weber@acme.eu', groups: ['Design team'] },
];
const CHIPS = [
  { label: 'All', count: 24 },
  { label: 'Design team', count: 4 },
  { label: 'Customers', count: 12 },
  { label: 'Partners', count: 8 },
];
const chipLeft = [870, 950, 1110, 1260];
const designChip = { x: chipLeft[1] + 70, y: 186 };

const GroupChip: React.FC<{ label: string; small?: boolean; active?: boolean }> = ({ label, small, active }) => (
  <span
    style={{
      background: active ? C.primary : C.lightblue,
      color: active ? '#fff' : C.primary,
      borderRadius: 16,
      padding: small ? '3px 10px' : '7px 14px',
      fontSize: small ? 13 : 15,
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </span>
);

const ContactGroups: React.FC = () => {
  const frame = useCurrentFrame();
  const path = [
    { f: 0, x: 1000, y: 520 },
    { f: 14, x: 1000, y: 520 },
    { f: 44, ...designChip },
  ];
  const filtered = frame >= 52;
  const rows = filtered ? CONTACTS.filter((c) => c.groups.includes('Design team')) : CONTACTS;
  const cur = cursorPos(frame, path);
  return (
    <Stage url="my.digitalsamba.com/contact-list" camera={[{ f: 0, z: 1.3, x: 860, y: 340 }]} path={path} clicks={[50]}>
      <Shell active={1}>
        <div style={{ position: 'absolute', left: X, top: 134, fontSize: 24 }}>Contact list</div>
        {CHIPS.map((c, i) => (
          <div key={c.label} style={{ position: 'absolute', left: chipLeft[i], top: 172 }}>
            <GroupChip label={`${c.label} ${c.count}`} active={filtered ? i === 1 : i === 0 || (i === 1 && near(cur, designChip, 60, 16))} />
          </div>
        ))}
        <div style={{ position: 'absolute', left: X, top: 230, width: 1135, height: 48, background: C.lightblue, borderRadius: 5, display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: 16 }}>
          <span style={{ width: 320, paddingLeft: 16 }}>Name</span>
          <span style={{ width: 380 }}>Email</span>
          <span>Groups</span>
        </div>
        {rows.map((c, i) => (
          <div key={c.email} style={{ position: 'absolute', left: X, top: 290 + i * 56, width: 1135, height: 48, display: 'flex', alignItems: 'center', fontSize: 16 }}>
            <span style={{ width: 320, paddingLeft: 16 }}>{c.name}</span>
            <span style={{ width: 380, color: C.textSecondary }}>{c.email}</span>
            <span style={{ display: 'flex', gap: 8 }}>
              {c.groups.map((g) => (
                <GroupChip key={g} label={g} small />
              ))}
            </span>
          </div>
        ))}
      </Shell>
    </Stage>
  );
};

// --- B: invitation toggle + public registration (schedule/_components/form.js, registration.js) ----------
const InvitesAndRegistration: React.FC = () => {
  const frame = useCurrentFrame();
  const invitesOff = { x: X + 551 - 19, y: 239 };
  const publicReg = { x: X + 551 - 19, y: 433 };
  const path = [
    { f: 0, x: 700, y: 560 },
    { f: 12, x: 700, y: 560 },
    { f: 34, ...invitesOff },
    { f: 52, ...invitesOff },
    { f: 70, ...publicReg },
  ];
  const sendOn = frame < 42;
  const pubOn = frame >= 78;
  return (
    <Stage
      url="my.digitalsamba.com/schedule/create"
      camera={[
        { f: 0, z: 1.45, x: 760, y: 300 },
        { f: 50, z: 1.45, x: 760, y: 320 },
        { f: 74, z: 1.45, x: 760, y: 380 },
      ]}
      path={path}
      clicks={[40, 76]}
    >
      <Shell active={0}>
        <div style={{ position: 'absolute', left: X, top: 134, fontSize: 24 }}>Schedule a call</div>
        <Button x={1416 - (sendOn ? 196 : 90) - 16 - 92} y={130} w={92} label="Cancel" variant="secondary" />
        <Button x={1416 - (sendOn ? 196 : 90)} y={130} w={sendOn ? 196 : 90} label={sendOn ? 'Save & Send Invites' : 'Save'} />
        <FieldLabel x={X} y={228} label="Send invitations to participants" info />
        <Switch x={X + 551 - 38} y={228} on={sendOn} />
        <div style={{ position: 'absolute', left: X, top: 256, width: 470, fontSize: 14, lineHeight: 1.3, color: C.textSecondary }}>
          With this on, saving the call emails the invitation to every participant, as it does today. Turn it off to save the call without sending anything and share the link yourself.
        </div>
        <FieldLabel x={X} y={330} label="Registration" />
        <Switch x={X + 551 - 38} y={330} on />
        <FieldLabel x={X} y={370} label="Require registration for" />
        <TextField x={X + 300} y={362} w={251} value="Attendees" select />
        <FieldLabel x={X} y={422} label="Allow public registration" />
        <Switch x={X + 551 - 38} y={422} on={pubOn} />
        <div style={{ position: 'absolute', left: X, top: 450, fontSize: 14, color: C.textSecondary, opacity: interpolate(frame, [78, 88], [0.55, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          Anyone with the link can register, not just invited people.
        </div>
        <FieldLabel x={X} y={500} label="Approval" />
        <div style={{ position: 'absolute', left: X, top: 532, fontSize: 15, color: C.textSecondary }}>Automatically approve · Manually approve</div>
      </Shell>
    </Stage>
  );
};

// --- C: crop dialog (components/common/image-crop-dialog.js) -------------------------------------------
const Crop: React.FC = () => {
  const frame = useCurrentFrame();
  const SL = { x: 400, y: 562, w: 640 };
  const zoom = interpolate(frame, [26, 64], [1, 2.1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const thumbX = SL.x + ((zoom - 1) / 9) * SL.w;
  const path = [
    { f: 0, x: 900, y: 690 },
    { f: 22, x: SL.x, y: SL.y },
    { f: 26, x: SL.x, y: SL.y },
    { f: 64, x: SL.x + ((2.1 - 1) / 9) * SL.w, y: SL.y },
  ];
  return (
    <Stage url="my.digitalsamba.com/schedule/create" camera={[{ f: 0, z: 1.3, x: 720, y: 420 }]} path={path} clicks={[24]}>
      <Shell active={0}>
        <div style={{ position: 'absolute', left: X, top: 134, fontSize: 24 }}>Schedule a call</div>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
        <div style={{ position: 'absolute', left: 376, top: 230, width: 688, background: '#fff', borderRadius: 4, fontFamily: FONT, boxShadow: '0 11px 15px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 24px 12px', fontSize: 24 }}>
            Crop event image <span style={{ fontSize: 22, color: '#757575' }}>✕</span>
          </div>
          <div style={{ margin: '0 24px', width: 640, height: 200, overflow: 'hidden', position: 'relative', background: '#222' }}>
            <Img src={staticFile('banner.jpg')} style={{ width: 640, height: 200, objectFit: 'cover', transform: `scale(${zoom})`, transformOrigin: '55% 50%' }} />
          </div>
          <div style={{ margin: '22px 24px 0', position: 'relative', height: 20 }}>
            <div style={{ position: 'absolute', top: 8, left: 0, width: 640, height: 4, borderRadius: 2, background: 'rgba(55,113,224,0.3)' }} />
            <div style={{ position: 'absolute', top: 8, left: 0, width: thumbX - SL.x, height: 4, borderRadius: 2, background: C.primary }} />
            <div style={{ position: 'absolute', top: 2, left: thumbX - SL.x - 8, width: 16, height: 16, borderRadius: 8, background: C.primary, boxShadow: '0 0 0 6px rgba(55,113,224,0.16)' }} />
          </div>
          <div style={{ padding: '12px 24px 0', fontSize: 14, color: C.textSecondary }}>
            Drag the image to reposition, scroll or use the slider to zoom. Saved as a 1280 x 400 banner.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px 18px', gap: 16, fontSize: 15, fontWeight: 500 }}>
            <span style={{ color: zoom > 1 ? C.primary : 'rgba(0,0,0,0.26)' }}>Reset</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: C.primary }}>Cancel</span>
            <span style={{ background: C.primary, color: '#fff', padding: '6px 16px', borderRadius: 4 }}>Done</span>
          </div>
        </div>
      </Shell>
    </Stage>
  );
};

const LABELS = ['Contact groups', 'Invitation toggle · Public registration', 'Crop event image'];

export const Free: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = Math.min(2, Math.floor(frame / V));
  const local = frame - idx * V;
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={V}>
        <ContactGroups />
      </Sequence>
      <Sequence from={V} durationInFrames={V}>
        <InvitesAndRegistration />
      </Sequence>
      <Sequence from={2 * V}>
        <Crop />
      </Sequence>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 48,
          transform: `translateX(-50%) translateY(${(1 - fade(local, 4, 14)) * 16}px)`,
          opacity: fade(local, 4, 14),
          background: '#323F66',
          color: '#fff',
          fontFamily: RFONT,
          fontSize: 30,
          fontWeight: 600,
          padding: '14px 28px',
          borderRadius: 40,
          boxShadow: '0 12px 30px rgba(50,63,102,0.3)',
        }}
      >
        {LABELS[idx]}
      </div>
    </AbsoluteFill>
  );
};
