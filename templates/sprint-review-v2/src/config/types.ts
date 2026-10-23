/**
 * Type definitions for sprint-review-v2 template
 *
 * Scene-based composable architecture using discriminated unions.
 * Each scene type gets its own content interface and can be mixed,
 * matched, and reordered to tell the sprint's story.
 */

// Re-export theme types from lib
export type {
  Theme,
  ThemeColors,
  ThemeFonts,
  ThemeSpacing,
  ThemeBorderRadius,
  ThemeTypography,
} from '../../../../lib/theme';

import type { CaptionsConfig } from '../../../../lib/components';

// ─── Sprint Info ────────────────────────────────────────────

export interface SprintInfo {
  name: string;           // Sprint name (e.g., "Cho Oyu")
  dateRange: string;      // Date range (e.g., "24th Nov - 8th Dec")
  product: string;        // Product name (e.g., "Digital Samba Mobile")
  platform: string;       // Platform (e.g., "iOS Embedded App Update")
  version: string;        // Version string (e.g., "4.0.2")
  build?: string;         // Build number (e.g., "233")
}

// ─── Base Scene ─────────────────────────────────────────────

export interface BaseScene {
  durationSeconds: number;
  audioFile?: string;              // Per-scene voiceover (e.g., 'scenes/01-title.mp3')
  transition?: TransitionOverride; // Optional override for the transition INTO this scene
}

export interface TransitionOverride {
  preset: TransitionPreset;
  durationFrames?: number;
}

export type TransitionPreset =
  | 'fade'
  | 'slide'
  | 'slide-left'
  | 'slide-up'
  | 'light-leak-warm'
  | 'light-leak-cool'
  | 'glitch'
  | 'rgb-split'
  | 'zoom-blur'
  | 'wipe'
  | 'none';

// ─── Scene Content Types ────────────────────────────────────

export interface TitleContent {
  logoFile?: string;               // Path to logo (e.g., 'images/logo.png')
}

export interface GoalContent {
  goal: string;                    // Sprint goal text
  status: 'achieved' | 'partial' | 'missed';
  planned: number;                 // Planned story points / items
  completed: number;               // Completed story points / items
  unit?: string;                   // "story points" | "tickets" | "items"
}

export interface HighlightsContent {
  title: string;                   // e.g., "What's New in v4.0.2"
  items: HighlightItem[];
}

export interface HighlightItem {
  text: string;                    // Main text
  highlight: string;               // Highlighted portion
}

export interface DemoContent {
  type: 'single' | 'split';
  videoFile?: string;
  leftVideo?: string;
  rightVideo?: string;
  label: string;
  jiraRef?: string;
  playbackRate?: number;
  startFrom?: number;
  leftStartFrom?: number;
  rightStartFrom?: number;
  leftLabel?: string;
  rightLabel?: string;
}

export interface CarryoverItem {
  title: string;
  status: 'in-progress' | 'blocked' | 'deferred';
  reason?: string;
}

export interface CarryoverContent {
  title?: string;                  // Default: "Carried Over"
  items: CarryoverItem[];
}

export interface DecisionItem {
  decision: string;                // "We chose X over Y"
  rationale: string;               // "because..."
  impact?: 'high' | 'medium' | 'low';
}

export interface DecisionsContent {
  title?: string;                  // Default: "Key Decisions"
  items: DecisionItem[];
}

export interface MetricItem {
  value: number;
  label: string;
  trend?: 'up' | 'down' | 'flat';
  unit?: string;                   // e.g., "%", "ms", "x"
  previousValue?: number;          // For showing delta
}

export interface MetricsContent {
  title?: string;                  // Default: "Sprint Metrics"
  mode: 'cards' | 'chart';
  items: MetricItem[];
  chartType?: 'bar' | 'line';     // Only used when mode is 'chart'
}

export interface LearningsContent {
  title?: string;                  // Default: "Retrospective"
  wentWell: string[];
  needsImprovement: string[];
  actionItems?: string[];
}

export interface RoadmapNode {
  label: string;
  status: 'done' | 'current' | 'upcoming';
}

export interface RoadmapContent {
  title?: string;                  // Default: "What's Next"
  nodes: RoadmapNode[];
  nextSprint?: {
    name: string;
    focus: string;
  };
}

export interface ContextContent {
  narrative: string;               // Large narrative text
  pillar?: string;                 // Badge text (e.g., "Mobile Platform")
  keyPoints?: string[];
}

export interface SummaryContent {
  stats: StatItem[];
  screenshotFile?: string;
}

export interface StatItem {
  value: number;
  label: string;
}

export interface CreditSection {
  category: string;
  items: string[];
}

export interface CreditsContent {
  sections: CreditSection[];
}

// ─── Scene Discriminated Union ──────────────────────────────

export interface TitleScene extends BaseScene {
  type: 'title';
  content: TitleContent;
}

export interface GoalScene extends BaseScene {
  type: 'goal';
  content: GoalContent;
}

export interface HighlightsScene extends BaseScene {
  type: 'highlights';
  content: HighlightsContent;
}

export interface DemoScene extends BaseScene {
  type: 'demo';
  content: DemoContent;
}

export interface CarryoverScene extends BaseScene {
  type: 'carryover';
  content: CarryoverContent;
}

export interface DecisionsScene extends BaseScene {
  type: 'decisions';
  content: DecisionsContent;
}

export interface MetricsScene extends BaseScene {
  type: 'metrics';
  content: MetricsContent;
}

export interface LearningsScene extends BaseScene {
  type: 'learnings';
  content: LearningsContent;
}

export interface RoadmapScene extends BaseScene {
  type: 'roadmap';
  content: RoadmapContent;
}

export interface ContextScene extends BaseScene {
  type: 'context';
  content: ContextContent;
}

export interface SummaryScene extends BaseScene {
  type: 'summary';
  content: SummaryContent;
}

export interface CreditsScene extends BaseScene {
  type: 'credits';
  content: CreditsContent;
}

export type SceneConfig =
  | TitleScene
  | GoalScene
  | HighlightsScene
  | DemoScene
  | CarryoverScene
  | DecisionsScene
  | MetricsScene
  | LearningsScene
  | RoadmapScene
  | ContextScene
  | SummaryScene
  | CreditsScene;

export type SceneType = SceneConfig['type'];

// ─── Global Config ──────────────────────────────────────────

export interface NarratorConfig {
  enabled: boolean;
  videoFile?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: 'sm' | 'md' | 'lg';
  startFrame?: number;
}

export interface MazeDecorationConfig {
  enabled: boolean;
  corner?: 'top-right' | 'top-left';
  opacity?: number;
  scale?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface OverlayConfig {
  background?: {
    variant?: 'subtle' | 'tech' | 'warm' | 'dark';
  };
  vignette?: {
    intensity?: number;         // Default: 0.35
  };
  filmGrain?: {
    opacity?: number;           // Default: 0.05
  };
  mazeDecoration?: MazeDecorationConfig;
}

export interface GlobalAudioConfig {
  /** Single voiceover file (legacy mode). Use per-scene audioFile instead. */
  voiceoverFile?: string;
  voiceoverStartFrame?: number;
  backgroundMusicFile?: string;
  backgroundMusicVolume?: number;
  chimeFile?: string;
  chimeFrame?: number;
}

export interface SprintReviewConfig {
  info: SprintInfo;
  scenes: SceneConfig[];
  audio: GlobalAudioConfig;
  narrator?: NarratorConfig;
  overlays?: OverlayConfig;
  /** Burned captions from <audio>.captions.json files (uv run tools/captions.py). Shown when the JSON exists. */
  captions?: CaptionsConfig;
}

// ─── Video Config ───────────────────────────────────────────

export interface VideoConfig {
  fps: number;
  width: number;
  height: number;
}
