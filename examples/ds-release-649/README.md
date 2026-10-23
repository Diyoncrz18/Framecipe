# ds-release-649: a synthetic release-notes video

An 80s video for [Digital Samba release 649](https://www.digitalsamba.com/release-notes/release-649). It covers five
new features, one fix and a Digital Samba Free roundup.

**Watch:** https://demos.digitalsamba.com/video/ds-release-649.mp4

**Nothing in it is screen-recorded.** Claude Code read the product repos and rebuilt the screens it needed as static
React: the in-call room, the embedded dashboard's settings, and the DS Free account center. A scripted cursor and
camera then drive those screens in Remotion. Every click is a frame number, so a scene re-renders identically and
updates when the product changes.

## How it was made

1. **Read the release.** Each release-note item was traced to the code that ships it: commit, component, exact
   English strings.
2. **Pull a visual spec.** Subagents read the room app (`react-frontend`), the dashboard (`react-dashboard`) and the
   account center (`react-account-center`). They returned palette, spacing, layout, icon glyphs and the exact
   English strings.
3. **Rebuild only what each scene shows** (`src/room/`, `src/ac/`), laid out at fixed positions on a 1440x810 app
   canvas so every click target is a known coordinate.
4. **Script each scene** (`src/scenes/`): cursor path, clicks, camera zoom and pan, and UI state, all as frame numbers.
5. **Voice first, then fit.** Lugh's voice is a Qwen3-TTS clone, one line per scene, measured for pace. Each scene
   is sized to its line (`src/Release.tsx`).
6. **Check stills before rendering.** Click targets were measured off contact sheets and corrected.
7. **Render, then normalise** with `tools/qc.py --fix` to -14 LUFS.

## What's real and what isn't

| Real (from the product code) | Invented |
|---|---|
| Layout, colours, icons (the room's icomoon glyphs), toolbar order | People: FLUX.2 portraits, labelled "AI-generated" on screen, as DS's own release images are |
| Every UI string: menu items, dialogs, settings labels and help text | Names, contacts, call and room details |
| Behaviour: what each control does, defaults, what the recorder keeps | The dashboard side menu (a subset, with stand-in icons) |

## Run it

```bash
cp -r examples/ds-release-649 projects/ds-release-649
cd projects/ds-release-649
npm install
npm run studio                                    # preview
npx remotion render Release649 out/release-649.mp4
cd ../.. && uv run tools/qc.py --render projects/ds-release-649/out/release-649.mp4 --fix
```

All assets are committed: portraits, banner, voice lines, SFX and logos. The product repos are not needed to build.

## Files

| Path | What |
|---|---|
| `src/Release.tsx` | Scene order, lengths, VO placement, SFX. Its header lists each VO line's length. |
| `src/Stage.tsx` | Browser window, camera keyframes, cursor. Every UI scene sits inside one. |
| `src/room/` | Room kit: chrome, left toolbar, tiles, participants panel, menus, dialogs, toasts |
| `src/ac/` | Account-center kit, shared with `ds-free-schedule-demo` |
| `src/scenes/` | One file per release item; click frames and targets are constants at the top |
| `public/audio/scenes/` | Lugh's lines (`.mp3` + `.txt`). `07_free` is split into `07a-d`, one phrase per shot. |

## Tools used

`voiceover.py --provider qwen3` (voice clone, `--max-wpm 165`), `flux2.py` (portraits, banner), `sfx.py`
(click, typing, pop, chime, whoosh), `qc.py` (loudness).
