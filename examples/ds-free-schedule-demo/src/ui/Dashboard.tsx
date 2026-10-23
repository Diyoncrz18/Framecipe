import React from 'react';
import { Img, staticFile } from 'remotion';
import { C, L } from './theme';
import { AddIcon, CalendarIcon, CameraIcon, LinkIcon, MoreHorizIcon, RepeatIcon, SearchIcon } from './icons';
import { Avatar, Button, Chip, RoundedBox, TextField } from './primitives';
import { USER } from './Shell';

export type Call = { day: string; title: string; time: string; repeat?: boolean };

export const EXISTING_CALLS: Call[] = [
  { day: 'Thu, 22 Oct', title: 'Weekly design sync', time: '10:00 - 10:30', repeat: true },
  { day: 'Fri, 23 Oct', title: 'Customer onboarding: Nordwind GmbH', time: '15:00 - 16:00' },
  { day: 'Mon, 26 Oct', title: 'Sprint review', time: '11:00 - 12:00', repeat: true },
];

export const PARTICIPANTS = [
  { name: 'Anna Schmidt', email: 'anna.schmidt@acme.eu', initials: 'AS', color: '#26a69a' },
  { name: 'Marco Rossi', email: 'marco.rossi@acme.eu', initials: 'MR', color: '#ef6c00' },
];

const X = L.contentX;
const R = L.contentR;
const LIST_Y = 468;
const GROUP_H = 172;
export const SCHEDULE_BTN = { x: R - 32 - 168, y: 346, w: 168 };
export const NEW_CARD = { x: X + 32, y: LIST_Y + 60, w: R - X - 64, h: 96 };

const DayGroup: React.FC<{ call: Call; y: number; first: boolean; opacity?: number; glow?: number }> = ({ call, y, first, opacity = 1, glow = 0 }) => {
  const stripe = first ? C.success : C.blueStripe;
  return (
    <div style={{ position: 'absolute', left: X + 32, top: y, width: R - X - 64, opacity }}>
      <div style={{ background: C.lightblue, borderRadius: 16, padding: '12px 16px', fontSize: 16 }}>{call.day}</div>
      <div
        style={{
          marginTop: 16,
          height: 96,
          boxSizing: 'border-box',
          border: `1px solid ${first ? C.success : C.divider}`,
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          background: C.white,
          boxShadow: glow ? `0 0 0 ${4 * glow}px rgba(30,175,63,${0.18 * glow})` : 'none',
        }}
      >
        <div style={{ width: 10, background: stripe }} />
        <div style={{ flex: 1, padding: '24px 16px', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{call.title}</div>
            <div style={{ color: C.textSecondary, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              {call.time}
              {call.repeat && <RepeatIcon size={18} color={C.textSecondary} />}
            </div>
          </div>
          <MoreHorizIcon size={24} color="#757575" />
        </div>
      </div>
    </div>
  );
};

export const Dashboard: React.FC<{
  hoverSchedule?: boolean;
  pressSchedule?: number;
  newCall?: Call;
  insert?: number; // 0..1 slide-in progress of the new call
  glow?: number;
  popper?: number; // 0..1 opacity of the hover card
}> = ({ hoverSchedule, pressSchedule = 0, newCall, insert = 0, glow = 0, popper = 0 }) => (
  <>
    {/* Welcome card */}
    <RoundedBox x={X} y={110} w={R - X} h={166} />
    <Avatar x={X + 32} y={142} size={100} initials={USER.initials} color={USER.avatarColor} fontSize={52} />
    <div style={{ position: 'absolute', left: X + 156, top: 160, display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ fontSize: 32, fontWeight: 500 }}>Welcome, {USER.name}</span>
      <Img src={staticFile('welcome.png')} style={{ width: 35, height: 35 }} />
    </div>
    <div style={{ position: 'absolute', left: X + 156, top: 210, fontSize: 16 }}>
      Your subscription plan: <b style={{ fontWeight: 600 }}>{USER.plan}</b>
    </div>

    {/* Scheduler card */}
    <RoundedBox x={X} y={316} w={R - X} h={640} />
    <div style={{ position: 'absolute', left: X + 32, top: 348, fontSize: 24 }}>Scheduled calls</div>
    <div style={{ position: 'absolute', left: X + 228, top: 350, display: 'flex', fontSize: 14 }}>
      <div style={{ background: C.primary, color: C.white, padding: '6px 12px', borderRadius: '4px 0 0 4px' }}>Upcoming</div>
      <div style={{ border: `1px solid ${C.primary}`, color: C.primary, padding: '5px 12px', borderRadius: '0 4px 4px 0' }}>
        Past calls
      </div>
    </div>
    <Button x={SCHEDULE_BTN.x - 16 - 120 - 16 - 132} y={346} w={132} label="Create link" icon={<LinkIcon size={18} color={C.white} />} />
    <Button x={SCHEDULE_BTN.x - 16 - 120} y={346} w={120} label="Call now" icon={<CameraIcon size={18} color={C.white} />} />
    <Button
      {...SCHEDULE_BTN}
      label="Schedule a call"
      icon={<AddIcon size={14} color={C.white} />}
      hover={hoverSchedule}
      pressed={pressSchedule}
    />
    <TextField x={X + 32} y={404} w={320} placeholder="Search by call name" startIcon={<SearchIcon size={22} color="#757575" />} />
    <div style={{ position: 'absolute', left: X + 372, top: 414, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
      <CalendarIcon size={22} color="#757575" />
      October 2026
    </div>

    {/* Calls, grouped by day */}
    <div style={{ position: 'absolute', left: X, top: 440, width: R - X, height: 370, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -X, top: -440 }}>
        {newCall && insert > 0 && (
          <DayGroup call={newCall} y={LIST_Y - 24 * (1 - insert)} first opacity={insert} glow={glow} />
        )}
        {EXISTING_CALLS.map((call, i) => (
          <DayGroup key={call.title} call={call} y={LIST_Y + (i + insert) * GROUP_H} first={i === 0 && insert === 0} />
        ))}
      </div>
    </div>

    {/* Hover card (call-popper.js) */}
    {newCall && popper > 0 && (
      <div
        style={{
          position: 'absolute',
          left: 860,
          top: NEW_CARD.y - 250, // above the card, clear of the narrator tile
          width: 400,
          padding: 24,
          background: C.white,
          borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.16)',
          opacity: popper,
          transform: `translateY(${(1 - popper) * 8}px)`,
          fontSize: 16,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 18 }}>{newCall.title}</div>
        <div style={{ color: C.textSecondary, marginTop: 6 }}>Today, {newCall.time} · Webinar</div>
        <div style={{ fontWeight: 600, marginTop: 20, marginBottom: 12 }}>Participants</div>
        {PARTICIPANTS.map((p) => (
          <div key={p.email} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Avatar inline size={34} initials={p.initials} color={p.color} fontSize={14} />
            <div style={{ flex: 1 }}>
              <div>{p.name}</div>
              <div style={{ color: C.textSecondary, fontSize: 13 }}>{p.email}</div>
            </div>
            <Chip label="Attendee" small />
          </div>
        ))}
      </div>
    )}
  </>
);
