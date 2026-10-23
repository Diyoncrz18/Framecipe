import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, getStaticFiles } from 'remotion';
import { TransitionSeries } from '@remotion/transitions';

import { ThemeProvider, defaultTheme } from './config/theme';
import { sprintConfig } from './config/sprint-config';
import { resolveTransition } from './config/transitions';

// Core components
import { AnimatedBackground, NarratorPiP, Vignette, FilmGrain } from './components/core';
import { MazeDecoration, Captions, captionsFor } from '../../../lib/components';

// Scene renderer
import { SceneRenderer } from './components/SceneRenderer';

const FPS = 30;

export const SprintReview: React.FC = () => {
  const { info, scenes, audio, narrator, overlays, captions } = sprintConfig;
  const staticFiles = getStaticFiles();

  // Helper to check if an audio file exists
  const audioExists = (path: string | undefined) =>
    path && staticFiles.some((f) => f.name === `audio/${path}`);

  // Burned captions for a voiceover file (renders nothing until its .captions.json exists)
  const { enabled: captionsEnabled = true, ...captionStyle } = captions ?? {};
  const sceneCaptions = (path: string | undefined) =>
    captionsEnabled && audioExists(path) ? (
      <Captions
        src={captionsFor(`audio/${path}`)}
        fontFamily={defaultTheme.fonts.primary}
        highlightColor={defaultTheme.colors.primary}
        {...captionStyle}
      />
    ) : null;

  // Check which global audio files exist
  const hasVoiceover = audioExists(audio.voiceoverFile);
  const hasBackgroundMusic = audioExists(audio.backgroundMusicFile);
  const hasChime = audioExists(audio.chimeFile);

  // Check for per-scene audio (any scene has audioFile configured)
  const hasPerSceneAudio = scenes.some((s) => audioExists(s.audioFile));

  // Overlay config with defaults
  const bgVariant = overlays?.background?.variant ?? 'subtle';
  const vignetteIntensity = overlays?.vignette?.intensity ?? 0.35;
  const filmGrainOpacity = overlays?.filmGrain?.opacity ?? 0.05;
  const maze = overlays?.mazeDecoration;

  // Build TransitionSeries children dynamically from scenes[]
  const transitionChildren: React.ReactNode[] = [];

  scenes.forEach((scene, index) => {
    // Add transition before this scene (except the first)
    if (index > 0) {
      const resolved = resolveTransition(scenes[index - 1], scene);
      if (resolved) {
        transitionChildren.push(
          <TransitionSeries.Transition
            key={`t-${index}`}
            presentation={resolved.presentation}
            timing={resolved.timing}
          />
        );
      }
    }

    // Add scene sequence
    const durationInFrames = Math.round(scene.durationSeconds * FPS);
    transitionChildren.push(
      <TransitionSeries.Sequence key={`s-${index}`} durationInFrames={durationInFrames}>
        {audioExists(scene.audioFile) && (
          <Audio src={staticFile(`audio/${scene.audioFile}`)} />
        )}
        <SceneRenderer scene={scene} info={info} />
        {sceneCaptions(scene.audioFile)}
      </TransitionSeries.Sequence>
    );
  });

  return (
    <ThemeProvider theme={defaultTheme}>
      <AbsoluteFill>
        {/* Persistent animated background */}
        <AnimatedBackground variant={bgVariant} />

        {/* Optional maze decoration in corner */}
        {maze?.enabled && (
          <MazeDecoration
            corner={maze.corner}
            opacity={maze.opacity}
            scale={maze.scale}
            primaryColor={maze.primaryColor || defaultTheme.colors.primary}
            secondaryColor={maze.secondaryColor || defaultTheme.colors.bgDark}
          />
        )}

        {/* Scene sequence with smart transitions */}
        <TransitionSeries>
          {transitionChildren}
        </TransitionSeries>

        {/* Global voiceover audio track (legacy mode - used when no per-scene audio) */}
        {hasVoiceover && !hasPerSceneAudio && (
          <Sequence from={audio.voiceoverStartFrame || 0}>
            <Audio src={staticFile(`audio/${audio.voiceoverFile}`)} />
            {sceneCaptions(audio.voiceoverFile)}
          </Sequence>
        )}

        {/* Background music - low volume */}
        {hasBackgroundMusic && (
          <Audio
            src={staticFile(`audio/${audio.backgroundMusicFile}`)}
            volume={audio.backgroundMusicVolume || 0.15}
          />
        )}

        {/* Success chime */}
        {hasChime && audio.chimeFrame && (
          <Sequence from={audio.chimeFrame}>
            <Audio src={staticFile(`audio/${audio.chimeFile}`)} volume={0.5} />
          </Sequence>
        )}

        {/* Narrator PiP - synced with voiceover */}
        {narrator?.enabled && (
          <Sequence from={narrator.startFrame || audio.voiceoverStartFrame || 0}>
            <NarratorPiP
              videoFile={narrator.videoFile}
              position={narrator.position}
              size={narrator.size}
            />
          </Sequence>
        )}

        {/* Cinematic overlays (render on top of everything) */}
        <Vignette intensity={vignetteIntensity} />
        <FilmGrain opacity={filmGrainOpacity} />
      </AbsoluteFill>
    </ThemeProvider>
  );
};
