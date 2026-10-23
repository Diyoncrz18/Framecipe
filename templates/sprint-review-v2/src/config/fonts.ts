/**
 * Font loading via @remotion/google-fonts
 *
 * Loads Inter at module scope — blocks rendering until the font is ready.
 * This ensures consistent typography across all frames.
 */

import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily, waitUntilDone } = loadFont('normal', {
  weights: ['400', '500', '600', '700'],
  subsets: ['latin'],
});

// Block rendering until font is loaded
waitUntilDone();

export { fontFamily };
