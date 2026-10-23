# Example: ds-release-649

Synthetic release video for Digital Samba release 649. Read `README.md` first.

## Where the screens came from (the repos are not needed to build)
- In-call room: `react-frontend`. Theme from `src/theme/`, strings from `public/locales/en/*.json`, and icons from
  `src/assets/fonts/icons/selection.json` (extracted to `src/room/icon-paths.json`).
- Hide tiles setting: `react-dashboard`, `src/pages/Settings/Components/Sections/Recordings.js`, strings in
  `src/i18n/locales/en/common.js`.
- DS Free roundup: `react-account-center`. The account-center kit is in `src/ac/`.
- SDK snippet: the Digital Samba embedded SDK reference, `addRecordingBookmark(bookmark)`, 0.0.58+.

## Layout
- `src/Release.tsx`: scene order, lengths, VO start per scene (`moreVo` for split lines), SFX.
- `src/Stage.tsx`: browser window, camera (zoom and pan keyframes) and cursor. It's shared by every UI scene.
- `src/room/`: room kit. The toolbar sits on the left (the default), and the active speaker is shown only by a green mic.
- `src/scenes/`: one file per release item, with click frames and targets as constants at the top.

## Gotchas
- `logo_mono.svg` is black; it needs `filter: brightness(0) invert(1)` on dark backgrounds.
- Measure click targets off rendered stills. A guessed coordinate is usually off by 20-50px once the camera zooms.
- People are FLUX.2 portraits, labelled "AI-generated" on screen.
