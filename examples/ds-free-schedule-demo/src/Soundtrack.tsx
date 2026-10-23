import React from 'react';
import { Audio, Sequence, interpolate, staticFile } from 'remotion';

// Voiceover [file, start frame, length in frames], anchored to the measured durations in the Demo.tsx header.
// vo-full.mp3 (the SoulX driving track) is these same lines at these same starts.
export const VO: [string, number, number][] = [
  ['01_intro', 8, 96],
  ['02_details', 106, 185],
  ['03_participants', 294, 109],
  ['04_save', 424, 87],
  ['05_result', 534, 109],
  ['06_end', 668, 76],
];

type Sfx = { file: string; at: number; volume: number; frames?: number };

const Clip: React.FC<Sfx> = ({ file, at, volume, frames }) => (
  <Sequence from={at} durationInFrames={frames} layout="none">
    <Audio
      src={staticFile(`audio/sfx/${file}.mp3`)}
      // Fade the tail of trimmed clips (typing) so the cut doesn't click
      volume={(f) => (frames ? volume * interpolate(f, [frames - 6, frames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : volume)}
    />
  </Sequence>
);

export const Soundtrack: React.FC<{ clicks: number[]; sfx: Sfx[] }> = ({ clicks, sfx }) => (
  <>
    {VO.map(([name, at]) => (
      <Sequence key={name} from={at} layout="none">
        <Audio src={staticFile(`audio/scenes/${name}.mp3`)} />
      </Sequence>
    ))}
    {clicks.map((at) => (
      <Clip key={`click-${at}`} file="click" at={at} volume={0.45} />
    ))}
    {sfx.map((s) => (
      <Clip key={`${s.file}-${s.at}`} {...s} />
    ))}
  </>
);
