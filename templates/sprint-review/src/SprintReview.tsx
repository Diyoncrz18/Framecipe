import { AbsoluteFill, Audio, Series, Sequence, staticFile, getStaticFiles } from 'remotion';
import { ThemeProvider, defaultTheme } from './config/theme';
import { sprintConfig, seconds } from './config/sprint-config';

// Core components
import { AnimatedBackground, SlideTransition, NarratorPiP } from './components/core';
import { MazeDecoration, Captions, captionsFor } from '../../../lib/components';

// Slides
import { TitleSlide, OverviewSlide, SummarySlide, EndCredits } from './components/slides';

// Demos
import { DemoSection, SplitScreen } from './components/demos';

export const SprintReview: React.FC = () => {
  const { info, overview, demos, summary, audio, narrator, mazeDecoration, captions } = sprintConfig;
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
  const hasPerSceneAudio =
    audioExists(info.audioFile) ||
    audioExists(overview.audioFile) ||
    audioExists(summary.audioFile) ||
    demos.some((d) => audioExists(d.audioFile));

  return (
    <ThemeProvider theme={defaultTheme}>
      <AbsoluteFill>
        {/* Persistent animated background */}
        <AnimatedBackground variant="subtle" />

        {/* Optional maze decoration in corner */}
        {mazeDecoration?.enabled && (
          <MazeDecoration
            corner={mazeDecoration.corner}
            opacity={mazeDecoration.opacity}
            scale={mazeDecoration.scale}
            primaryColor={mazeDecoration.primaryColor || defaultTheme.colors.primary}
            secondaryColor={mazeDecoration.secondaryColor || defaultTheme.colors.backgroundDark}
          />
        )}

        <Series>
          {/* Title Card - 5 seconds */}
          <Series.Sequence durationInFrames={seconds(5)}>
            {audioExists(info.audioFile) && (
              <Audio src={staticFile(`audio/${info.audioFile}`)} />
            )}
            <SlideTransition durationInFrames={seconds(5)} style="zoom">
              <TitleSlide />
            </SlideTransition>
            {sceneCaptions(info.audioFile)}
          </Series.Sequence>

          {/* Overview - 15 seconds */}
          <Series.Sequence durationInFrames={seconds(15)}>
            {audioExists(overview.audioFile) && (
              <Audio src={staticFile(`audio/${overview.audioFile}`)} />
            )}
            <SlideTransition durationInFrames={seconds(15)} style="zoom">
              <OverviewSlide />
            </SlideTransition>
            {sceneCaptions(overview.audioFile)}
          </Series.Sequence>

          {/* Dynamic demo sections from config */}
          {demos.map((demo, index) => (
            <Series.Sequence key={index} durationInFrames={seconds(demo.durationSeconds)}>
              {audioExists(demo.audioFile) && (
                <Audio src={staticFile(`audio/${demo.audioFile}`)} />
              )}
              <SlideTransition durationInFrames={seconds(demo.durationSeconds)} style="blur-fade">
                {demo.type === 'split' ? (
                  <SplitScreen
                    leftVideo={demo.leftVideo!}
                    rightVideo={demo.rightVideo!}
                    leftLabel={demo.leftLabel}
                    rightLabel={demo.rightLabel}
                    bottomLabel={demo.label}
                    jiraRef={demo.jiraRef}
                    leftStartFrom={demo.leftStartFrom}
                    rightStartFrom={demo.rightStartFrom}
                    playbackRate={demo.playbackRate}
                  />
                ) : (
                  <DemoSection
                    videoFile={demo.videoFile!}
                    label={demo.label}
                    jiraRef={demo.jiraRef}
                    startFrom={demo.startFrom}
                    playbackRate={demo.playbackRate}
                  />
                )}
              </SlideTransition>
              {sceneCaptions(demo.audioFile)}
            </Series.Sequence>
          ))}

          {/* Summary - 15 seconds */}
          <Series.Sequence durationInFrames={seconds(15)}>
            {audioExists(summary.audioFile) && (
              <Audio src={staticFile(`audio/${summary.audioFile}`)} />
            )}
            <SlideTransition durationInFrames={seconds(15)} style="zoom" transitionDuration={20}>
              <SummarySlide />
            </SlideTransition>
            {sceneCaptions(summary.audioFile)}
          </Series.Sequence>

          {/* End Credits - 30 seconds */}
          <Series.Sequence durationInFrames={seconds(30)}>
            <EndCredits />
          </Series.Sequence>
        </Series>

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

        {/* Success chime on summary slide */}
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
      </AbsoluteFill>
    </ThemeProvider>
  );
};
