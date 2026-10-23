import { Composition } from 'remotion';
import { Release, RELEASE_LEN } from './Release';

export const RemotionRoot: React.FC = () => (
  <Composition id="Release649" component={Release} durationInFrames={RELEASE_LEN} fps={30} width={1920} height={1080} />
);
