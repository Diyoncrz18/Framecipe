import { Composition } from 'remotion';
import { ProductDemo } from './ProductDemo';
import { videoConfig, demoConfig, calculateTotalFrames } from './config/demo-config';
import { TransitionGallery, transitionGalleryConfig } from './TransitionGallery';

export const RemotionRoot: React.FC = () => {
  const totalFrames = calculateTotalFrames(demoConfig, videoConfig.fps);

  return (
    <>
      <Composition
        id="ProductDemo"
        component={ProductDemo}
        durationInFrames={totalFrames}
        fps={videoConfig.fps}
        width={videoConfig.width}
        height={videoConfig.height}
      />
      <Composition
        id={transitionGalleryConfig.id}
        component={TransitionGallery}
        durationInFrames={transitionGalleryConfig.durationInFrames}
        fps={transitionGalleryConfig.fps}
        width={transitionGalleryConfig.width}
        height={transitionGalleryConfig.height}
      />
    </>
  );
};
