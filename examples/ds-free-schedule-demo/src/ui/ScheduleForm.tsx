import React from 'react';
import { C, L } from './theme';
import { AccessTimeIcon, CalendarIcon, DeleteIcon, UploadIcon } from './icons';
import { Avatar, Button, FieldLabel, Switch, TextField } from './primitives';
import { PARTICIPANTS } from './Dashboard';

const X = L.contentX;
const R = L.contentR;
const RX = 865; // right column

export const CALL_TYPES = [
  { name: 'Meeting', description: 'Everyone can talk, share and present.' },
  { name: 'Webinar', description: 'Presenters on stage, audience watches and asks questions.' },
  { name: 'Classroom', description: 'A teacher leads, students join in on the whiteboard.' },
];

// Click targets, shared with the timeline so the cursor lands on them
export const FORM = {
  save: { x: R - 196, y: 130, w: 196 },
  title: { x: X, y: 228, w: 551 },
  type: { x: X, y: 320, w: 551 },
  typeOption: (i: number) => ({ x: X, y: 368 + i * 44, w: 551, h: 44 }),
  participant: { x: RX, y: 228, w: 330 },
  suggestion: { x: RX, y: 272, w: 330, h: 60 },
  ok: { x: 876, y: 459, w: 60, h: 36 },
};

export const ScheduleForm: React.FC<{
  title: string;
  titleFocus?: boolean;
  caret?: boolean;
  typeIndex: number;
  typeOpen?: number;
  typeHover?: number;
  participantText: string;
  participantFocus?: boolean;
  suggestion?: number | null;
  suggestionHover?: boolean;
  added: number;
  saveHover?: boolean;
  savePress?: number;
  dialog?: number;
  okHover?: boolean;
}> = ({
  title,
  titleFocus,
  caret,
  typeIndex,
  typeOpen = 0,
  typeHover = -1,
  participantText,
  participantFocus,
  suggestion = null,
  suggestionHover,
  added,
  saveHover,
  savePress = 0,
  dialog = 0,
  okHover,
}) => (
  <>
    <div style={{ position: 'absolute', left: X, top: 134, fontSize: 24 }}>Schedule a call</div>
    <Button x={FORM.save.x - 16 - 92} y={130} w={92} label="Cancel" variant="secondary" />
    <Button {...FORM.save} label="Save & Send Invites" hover={saveHover} pressed={savePress} />

    {/* Left column */}
    <FieldLabel x={X} y={200} label="Title" required />
    <TextField {...FORM.title} value={title} focused={titleFocus} caret={titleFocus && caret} />

    <FieldLabel x={X} y={292} label="Type of call" info />
    <TextField {...FORM.type} value={CALL_TYPES[typeIndex].name} select focused={typeOpen > 0} />
    <div style={{ position: 'absolute', left: X, top: 368, fontSize: 14, color: C.textSecondary }}>
      {CALL_TYPES[typeIndex].description}
    </div>

    <FieldLabel x={X} y={408} label="Date and time" required>
      <span style={{ background: C.lightblue, borderRadius: 12, padding: '2px 10px', fontSize: 13, fontWeight: 500, marginLeft: 4 }}>
        Europe/Berlin
      </span>
    </FieldLabel>
    <TextField x={X} y={436} w={168} value="21 Oct 2026" endIcon={<CalendarIcon size={20} color="#757575" />} />
    <TextField x={X + 184} y={436} w={150} value="14:30" endIcon={<AccessTimeIcon size={20} color="#757575" />} />
    <div style={{ position: 'absolute', left: X + 342, top: 446, width: 24, textAlign: 'center', fontSize: 16 }}>to</div>
    <TextField x={X + 374} y={436} w={177} value="15:00" hint="30 min" endIcon={<AccessTimeIcon size={20} color="#757575" />} />
    <TextField x={X} y={500} w={551} value="Do not repeat" select />

    {[
      { label: 'Send invitations to participants', on: true, y: 568 },
      { label: 'Customised invitation email', on: false, y: 614 },
      { label: 'Use custom room link', on: false, y: 660 },
      { label: 'Registration', on: false, y: 706 },
    ].map((row) => (
      <React.Fragment key={row.label}>
        <FieldLabel x={X} y={row.y} label={row.label} info={row.label !== 'Registration'} />
        <Switch x={X + 551 - 38} y={row.y} on={row.on} />
      </React.Fragment>
    ))}
    <FieldLabel x={X} y={752} label="Event image" info />
    <div style={{ position: 'absolute', left: X + 551 - 110, top: 746 }}>
      <Button x={0} y={0} w={110} h={34} label="Upload" variant="secondary" icon={<UploadIcon size={18} color={C.secondaryText} />} />
    </div>

    {/* Right column */}
    <FieldLabel x={RX} y={200} label="Add participants" />
    <TextField {...FORM.participant} value={participantText} placeholder="Type names or emails" focused={participantFocus} caret={participantFocus && caret} />
    <div style={{ position: 'absolute', left: RX + 338, top: 238, width: 24, textAlign: 'center', fontSize: 16 }}>as</div>
    <TextField x={RX + 370} y={228} w={181} value="Attendee" select />
    <Button x={RX} y={288} w={170} label="Import from CSV" variant="secondary" />
    <Button x={RX + 186} y={288} w={190} label="Download Template" variant="text" />

    {PARTICIPANTS.slice(0, added).map((p, i) => (
      <div
        key={p.email}
        style={{ position: 'absolute', left: RX, top: 348 + i * 60, width: 551, height: 48, display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <Avatar inline size={34} initials={p.initials} color={p.color} fontSize={14} />
        <div style={{ flex: 1, fontSize: 16 }}>
          <div>{p.name}</div>
          <div style={{ color: C.textSecondary, fontSize: 13 }}>{p.email}</div>
        </div>
        <div style={{ position: 'relative', width: 150, height: 40 }}>
          <TextField x={0} y={0} w={150} value="Attendee" select />
        </div>
        <DeleteIcon size={24} color="#757575" />
      </div>
    ))}

    {/* Autocomplete suggestion */}
    {suggestion !== null && (
      <div
        style={{
          position: 'absolute',
          left: FORM.suggestion.x,
          top: FORM.suggestion.y + 4,
          width: FORM.suggestion.w,
          background: C.white,
          borderRadius: 4,
          boxShadow: '0 5px 18px rgba(0,0,0,0.18)',
          padding: '6px 0',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '6px 16px',
            background: suggestionHover ? C.lightblue : 'transparent',
          }}
        >
          <Avatar inline size={34} initials={PARTICIPANTS[suggestion].initials} color={PARTICIPANTS[suggestion].color} fontSize={14} />
          <div style={{ fontSize: 16 }}>
            <div>{PARTICIPANTS[suggestion].name}</div>
            <div style={{ color: C.textSecondary, fontSize: 13 }}>{PARTICIPANTS[suggestion].email}</div>
          </div>
        </div>
      </div>
    )}

    {/* Type of call menu */}
    {typeOpen > 0 && (
      <div
        style={{
          position: 'absolute',
          left: X,
          top: 364,
          width: 551,
          background: C.white,
          borderRadius: 4,
          boxShadow: '0 5px 18px rgba(0,0,0,0.18)',
          padding: '6px 0',
          opacity: typeOpen,
          transform: `scaleY(${0.9 + typeOpen * 0.1})`,
          transformOrigin: 'top',
        }}
      >
        {CALL_TYPES.map((t, i) => (
          <div
            key={t.name}
            style={{
              height: 44,
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              fontSize: 16,
              background: i === typeHover ? C.lightblue : i === typeIndex ? 'rgba(55,113,224,0.08)' : 'transparent',
            }}
          >
            {t.name}
          </div>
        ))}
      </div>
    )}

    <div style={{ position: 'absolute', left: X, top: 790, fontSize: 14, fontStyle: 'italic' }}>
      <span style={{ color: C.required }}>*</span> Fields are required
    </div>

    {/* "Meeting saved & invites sent" dialog */}
    {dialog > 0 && (
      <>
        <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${0.5 * dialog})` }} />
        <div
          style={{
            position: 'absolute',
            left: 1440 / 2 - 240,
            top: 405 - 110,
            width: 480,
            boxSizing: 'border-box',
            background: C.white,
            borderRadius: 4,
            boxShadow: '0 11px 15px rgba(0,0,0,0.2)',
            opacity: dialog,
            transform: `scale(${0.94 + 0.06 * dialog})`,
          }}
        >
          <div style={{ padding: '20px 24px 8px', fontSize: 24, lineHeight: 1.25 }}>Meeting saved &amp; invites sent</div>
          <div style={{ padding: '8px 24px', fontSize: 16, lineHeight: 1.4, color: 'rgba(0,0,0,0.6)' }}>
            Your meeting has been saved and invitations were emailed to participants.
          </div>
          <div style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 }}>
            <div style={{ width: 18, height: 18, border: '2px solid rgba(0,0,0,0.54)', borderRadius: 2, boxSizing: 'border-box' }} />
            Don't show again
          </div>
          <div style={{ height: 52, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                right: 24,
                top: 8,
                width: 60,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: C.primary,
                fontWeight: 600,
                fontSize: 15,
                borderRadius: 4,
                background: okHover ? 'rgba(55,113,224,0.08)' : 'transparent',
              }}
            >
              OK
            </div>
          </div>
        </div>
      </>
    )}
  </>
);
