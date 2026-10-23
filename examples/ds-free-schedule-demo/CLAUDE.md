# Example: ds-free-schedule-demo

Synthetic product demo of the Digital Samba Free account center: scheduling a call. Read `README.md` first.

- `src/Demo.tsx` is the timeline. Every click, cursor keyframe and camera move is a frame number. The header lists each
  VO line's start frame and measured length. If a line is regenerated, its length changes, so re-check that the beats
  don't overlap.
- `src/ui/` holds the recreated screens. They were rebuilt from the account center's theme provider, its
  `src/locales/en/common.json` and its icon components (the `react-account-center` repo; it isn't needed to build).
- `src/Soundtrack.tsx` exports `VO` ([file, start, length]). `NarratorTile` uses it for the speaking ring.
- `public/narrator.mp4` must stay in sync with `public/audio/vo-full.mp3`. Rebuild both together (see README).
- Voice: Lugh, a Qwen3-TTS clone. SFX come from `tools/sfx.py`. Normalise the render with
  `uv run tools/qc.py --render <mp4> --fix`.
