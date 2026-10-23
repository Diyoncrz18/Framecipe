import { Composition } from 'remotion';
import { SprintReview } from './SprintReview';
import { videoConfig, totalDurationInFrames } from './config/sprint-config';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SprintReviewV2"
        component={SprintReview}
        durationInFrames={totalDurationInFrames}
        fps={videoConfig.fps}
        width={videoConfig.width}
        height={videoConfig.height}
      />
    </>
  );
};
