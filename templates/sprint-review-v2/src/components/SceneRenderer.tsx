import React from 'react';
import type { SceneConfig, SprintInfo } from '../config/types';
import {
  TitleSlide,
  GoalSlide,
  HighlightsSlide,
  CarryoverSlide,
  DecisionsSlide,
  MetricsSlide,
  LearningsSlide,
  RoadmapSlide,
  ContextSlide,
  SummarySlide,
  EndCredits,
} from './slides';
import { DemoSection, SplitScreen } from './demos';

interface SceneRendererProps {
  scene: SceneConfig;
  info: SprintInfo;
}

export const SceneRenderer: React.FC<SceneRendererProps> = ({ scene, info }) => {
  switch (scene.type) {
    case 'title':
      return <TitleSlide content={scene.content} info={info} />;
    case 'goal':
      return <GoalSlide content={scene.content} />;
    case 'highlights':
      return <HighlightsSlide content={scene.content} />;
    case 'demo':
      if (scene.content.type === 'split') {
        return (
          <SplitScreen
            leftVideo={scene.content.leftVideo!}
            rightVideo={scene.content.rightVideo!}
            leftLabel={scene.content.leftLabel}
            rightLabel={scene.content.rightLabel}
            bottomLabel={scene.content.label}
            jiraRef={scene.content.jiraRef}
            leftStartFrom={scene.content.leftStartFrom}
            rightStartFrom={scene.content.rightStartFrom}
            playbackRate={scene.content.playbackRate}
          />
        );
      }
      return (
        <DemoSection
          videoFile={scene.content.videoFile!}
          label={scene.content.label}
          jiraRef={scene.content.jiraRef}
          startFrom={scene.content.startFrom}
          playbackRate={scene.content.playbackRate}
        />
      );
    case 'carryover':
      return <CarryoverSlide content={scene.content} />;
    case 'decisions':
      return <DecisionsSlide content={scene.content} />;
    case 'metrics':
      return <MetricsSlide content={scene.content} />;
    case 'learnings':
      return <LearningsSlide content={scene.content} />;
    case 'roadmap':
      return <RoadmapSlide content={scene.content} />;
    case 'context':
      return <ContextSlide content={scene.content} />;
    case 'summary':
      return <SummarySlide content={scene.content} />;
    case 'credits':
      return <EndCredits content={scene.content} info={info} />;
    default: {
      const _exhaustive: never = scene;
      return null;
    }
  }
};
