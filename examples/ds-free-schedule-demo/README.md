# ds-free-schedule-demo: a synthetic product demo

A 26s demo of scheduling a call in the Digital Samba Free account center, presented by Lugh in a picture-in-picture
tile.

**Watch:** https://demos.digitalsamba.com/video/ds-free-schedule-demo.mp4

**Nothing in it is screen-recorded.** Claude Code read the account center's source (Next.js + MUI) and rebuilt the
dashboard, the schedule form and the confirmation dialog as static React. The theme values, English strings and
icon paths come straight from the app. A scripted cursor and camera then perform the flow:
1. Open the schedule form.
2. Type a title.
3. Pick the type of call.
4. Add two participants from contacts.
5. Save.
6. See the call land on the dashboard.

It is the simpler companion to [`ds-release-649`](../ds-release-649), which applies the same method to a whole
release.

## How it was made

- **UI:** `src/ui/` is laid out absolutely on a 1440x810 canvas, so click targets (`FORM`, `SCHEDULE_BTN`) are known
  coordinates.
- **Timeline:** `src/Demo.tsx` holds every cursor keyframe, click and camera move as frame numbers. Its header lists
  each voice line's start and length.
- **Voice:** Lugh, a Qwen3-TTS clone, one line per beat in `public/audio/scenes/`.
- **Narrator tile:** `public/narrator.mp4` is SoulX-FlashHead Pro (`tools/soulx.py`, 512x512) from
  `public/lugh-still.jpg`. It is driven by `public/audio/vo-full.mp3`, which places the voice lines at their timeline
  starts, so the lip-sync matches. `src/NarratorTile.tsx` styles it as a Digital Samba room tile: name pill, AI badge,
  and a speaking ring timed from the voice lines.
- **SFX:** `tools/sfx.py`.
- **Loudness:** `tools/qc.py --fix`.

What's invented: the user, participants, call list and call-type descriptions. After saving, the real app opens the
call's details page; the demo cuts to the dashboard instead.

## Run it

```bash
cp -r examples/ds-free-schedule-demo projects/ds-free-schedule-demo
cd projects/ds-free-schedule-demo
npm install
npm run studio
npx remotion render ScheduleDemo out/schedule-demo.mp4
```

If a voice line or its start frame changes, rebuild `vo-full.mp3` from the lines and re-run SoulX, or the lips drift:

```bash
uv run tools/soulx.py --image projects/ds-free-schedule-demo/public/lugh-still.jpg \
  --audio projects/ds-free-schedule-demo/public/audio/vo-full.mp3 --width 512 --height 512 \
  --output projects/ds-free-schedule-demo/public/narrator.mp4
```
