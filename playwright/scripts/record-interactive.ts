/**
 * Interactive browser recording script
 *
 * Opens a visible browser window and records your manual actions.
 * Press Escape in the browser or Ctrl+C in terminal to stop recording.
 *
 * Usage:
 *   npx tsx scripts/record-interactive.ts --url "https://example.com" --name "my-demo"
 *
 * Options:
 *   --url       URL to open (required)
 *   --name      Output filename without extension (required)
 *   --output    Output directory (default: ./output)
 *   --viewport  Viewport preset: 1080p, 720p, mobile, tablet (default: 1080p)
 *   --scale     Window scale factor 0.5-1.0 (default: 1.0). Use 0.75 for laptops.
 *               Records at full resolution but shows smaller window.
 *   --slowMo    Delay between actions in ms (default: 50)
 *   --duration  Max recording duration in seconds (default: 120)
 *   --cursor    Show cursor visualization: true/false (default: true)
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Parse command line arguments
function parseArgs(): {
  url: string;
  name: string;
  output: string;
  viewport: { width: number; height: number };
  scale: number;
  slowMo: number;
  duration: number;
  showCursor: boolean;
} {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    parsed[key] = value;
  }

  if (!parsed.url || !parsed.name) {
    console.error('Error: --url and --name are required');
    console.error('Usage: npx tsx scripts/record-interactive.ts --url "https://example.com" --name "my-demo"');
    process.exit(1);
  }

  const viewports: Record<string, { width: number; height: number }> = {
    '1080p': { width: 1920, height: 1080 },
    '720p': { width: 1280, height: 720 },
    'mobile': { width: 390, height: 844 },
    'tablet': { width: 1024, height: 768 },
  };

  const viewportName = parsed.viewport || '1080p';
  const viewport = viewports[viewportName] || viewports['1080p'];

  // Scale factor: 0.5-1.0, default 1.0 (no scaling)
  let scale = parseFloat(parsed.scale || '1.0');
  scale = Math.max(0.5, Math.min(1.0, scale)); // Clamp to valid range

  return {
    url: parsed.url,
    name: parsed.name,
    output: parsed.output || './output',
    viewport,
    scale,
    slowMo: parseInt(parsed.slowMo || '50', 10),
    duration: parseInt(parsed.duration || '120', 10),
    showCursor: parsed.cursor !== 'false',
  };
}

const config = parseArgs();
const targetFps = 30;

// Common cookie consent selectors to auto-dismiss
const COOKIE_BANNER_SELECTORS = [
  // Generic patterns
  '[class*="cookie-consent"] button[class*="accept"]',
  '[class*="cookie-banner"] button[class*="accept"]',
  '[class*="cookie"] button[class*="accept"]',
  '[class*="consent"] button[class*="accept"]',
  '[id*="cookie"] button[class*="accept"]',
  '[id*="consent"] button[class*="accept"]',
  // Common cookie consent platforms
  '#onetrust-accept-btn-handler', // OneTrust
  '.onetrust-close-btn-handler',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', // Cookiebot
  '#CybotCookiebotDialogBodyButtonAccept',
  '.cc-btn.cc-dismiss', // Cookie Consent by Insites
  '.cc-accept-all',
  '#accept-cookies',
  '#acceptCookies',
  '.accept-cookies',
  '.acceptCookies',
  '[data-testid="cookie-policy-dialog-accept-button"]',
  '[data-testid="accept-cookies"]',
  'button[aria-label*="Accept"]',
  'button[aria-label*="accept"]',
  // GDPR specific
  '.gdpr-accept',
  '#gdpr-accept',
  '[class*="gdpr"] button[class*="accept"]',
  // Generic button text matches (last resort)
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Accept cookies")',
  'button:has-text("Accept Cookies")',
  'button:has-text("I accept")',
  'button:has-text("Got it")',
  'button:has-text("OK")',
  'button:has-text("Agree")',
];

async function dismissCookieBanners(page: Page): Promise<void> {
  // Wait a moment for cookie banners to appear
  await page.waitForTimeout(500);

  for (const selector of COOKIE_BANNER_SELECTORS) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 100 })) {
        await button.click({ timeout: 500 });
        console.log(`   🍪 Dismissed cookie banner`);
        // Wait for banner to disappear
        await page.waitForTimeout(300);
        return;
      }
    } catch {
      // Selector not found or not clickable, try next
    }
  }
}

async function injectStopListener(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Prevent duplicate injection
    if ((window as any).__escListenerAdded) return;
    (window as any).__escListenerAdded = true;
    (window as any).__stopRecording = false;

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        (window as any).__stopRecording = true;
      }
    });
  });
}

async function injectCursorVisualization(page: Page): Promise<void> {
  if (!config.showCursor) return;

  await page.addStyleTag({
    content: `
      .playwright-cursor {
        position: fixed;
        width: 20px;
        height: 20px;
        background: rgba(234, 88, 12, 0.6);
        border: 2px solid rgba(234, 88, 12, 0.9);
        border-radius: 50%;
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%);
        transition: transform 0.05s ease, background 0.1s ease;
      }
      .playwright-cursor.clicking {
        transform: translate(-50%, -50%) scale(0.8);
        background: rgba(234, 88, 12, 0.9);
      }
      .click-ripple {
        position: fixed;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: rgba(234, 88, 12, 0.3);
        border: 2px solid rgba(234, 88, 12, 0.6);
        pointer-events: none;
        z-index: 999998;
        transform: translate(-50%, -50%) scale(0);
        animation: ripple 0.4s ease-out forwards;
      }
      @keyframes ripple {
        to {
          transform: translate(-50%, -50%) scale(2.5);
          opacity: 0;
        }
      }
    `
  });

  await page.evaluate(() => {
    // Prevent duplicate injection
    if (document.querySelector('.playwright-cursor')) return;

    const cursor = document.createElement('div');
    cursor.className = 'playwright-cursor';
    document.body.appendChild(cursor);

    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });

    document.addEventListener('mousedown', (e) => {
      cursor.classList.add('clicking');

      const ripple = document.createElement('div');
      ripple.className = 'click-ripple';
      ripple.style.left = e.clientX + 'px';
      ripple.style.top = e.clientY + 'px';
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 400);
    });

    document.addEventListener('mouseup', () => {
      cursor.classList.remove('clicking');
    });
  });
}

function getVideoDuration(filePath: string): number {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: 'utf-8' }
    ).trim();
    return parseFloat(output);
  } catch {
    return 0;
  }
}

// Terminal-based timer display (not in browser)
function startTerminalTimer(duration: number): NodeJS.Timeout {
  const startTime = Date.now();

  return setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const remaining = duration - elapsed;

    // Use carriage return to update in place
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    const remainingStr = remaining <= 10 ? ` (${remaining}s remaining)` : '';
    process.stdout.write(`\r   ⏱ Recording: ${timeStr}${remainingStr}    `);
  }, 1000);
}

async function record(): Promise<void> {
  // Calculate scaled window size for display
  const windowWidth = Math.round(config.viewport.width * config.scale);
  const windowHeight = Math.round(config.viewport.height * config.scale);

  console.log(`\n🎬 Interactive Recording`);
  console.log(`   URL: ${config.url}`);
  console.log(`   Output: ${config.name}`);
  console.log(`   Viewport: ${config.viewport.width}x${config.viewport.height}`);
  if (config.scale < 1) {
    console.log(`   Window: ${windowWidth}x${windowHeight} (scaled to ${Math.round(config.scale * 100)}%)`);
  }
  console.log(`   Max duration: ${config.duration}s`);
  console.log(`   Cursor: ${config.showCursor ? 'visible' : 'hidden'}`);
  console.log(`\n📍 Browser will open. Perform your actions.`);
  console.log(`   To stop: Press Esc in the browser, or Ctrl+C in terminal\n`);

  const browser: Browser = await chromium.launch({
    slowMo: config.slowMo,
    headless: false,  // Always visible for interactive mode
  });

  const tempDir = './recordings';
  fs.mkdirSync(tempDir, { recursive: true });

  // Use deviceScaleFactor to show smaller window while recording at full resolution
  const deviceScaleFactor = 1 / config.scale;

  const context: BrowserContext = await browser.newContext({
    viewport: {
      width: windowWidth,
      height: windowHeight,
    },
    deviceScaleFactor,
    recordVideo: {
      dir: tempDir,
      size: config.viewport, // Record at full resolution
    },
  });

  const page: Page = await context.newPage();

  // Handle graceful shutdown on Ctrl+C
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const cleanup = async () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearInterval(timer);
    console.log('\n\n⏹ Stopping recording...');
    await saveRecording(page, context, browser);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    await page.goto(config.url, { waitUntil: 'domcontentloaded' });
    await dismissCookieBanners(page);
    await injectStopListener(page);
    await injectCursorVisualization(page);

    console.log('🔴 Recording... (Press Esc to stop)\n');
    timer = startTerminalTimer(config.duration);

    // Re-inject on navigation
    page.on('load', async () => {
      if (stopped) return;
      try {
        await dismissCookieBanners(page);
        await injectStopListener(page);
        await injectCursorVisualization(page);
      } catch {
        // Page might have closed or navigated again
      }
    });

    // Wait for ESC key, max duration, or Ctrl+C
    const startTime = Date.now();
    while (!stopped) {
      // Check max duration
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= config.duration) {
        console.log(`\n\n⏱ Max duration (${config.duration}s) reached.`);
        await cleanup();
        break;
      }

      // Check for ESC key press in browser
      // Use try/catch to handle navigation - if page context changes, just continue
      try {
        const shouldStop = await page.evaluate(() => (window as any).__stopRecording === true);
        if (shouldStop) {
          console.log('\n\n🛑 Stop requested (Esc pressed)');
          await cleanup();
          break;
        }
      } catch {
        // Page is navigating or context changed - this is fine, continue recording
      }

      // Poll every 200ms
      await new Promise(resolve => setTimeout(resolve, 200));
    }

  } catch (error) {
    if (!stopped) {
      console.error('\nRecording error:', error);
      await cleanup();
    }
  }
}

async function saveRecording(page: Page, context: BrowserContext, browser: Browser): Promise<void> {
  await context.close();

  const video = page.video();
  const videoPath = await video?.path();

  if (videoPath && fs.existsSync(videoPath)) {
    fs.mkdirSync(config.output, { recursive: true });

    const webmPath = path.join(config.output, `${config.name}.webm`);
    fs.renameSync(videoPath, webmPath);

    const mp4Path = path.join(config.output, `${config.name}.mp4`);
    console.log(`  Converting to MP4 (30fps)...`);

    try {
      execSync(
        `ffmpeg -y -i "${webmPath}" -c:v libx264 -crf 20 -preset medium -r ${targetFps} -movflags faststart "${mp4Path}"`,
        { stdio: 'pipe' }
      );

      fs.unlinkSync(webmPath);

      const duration = getVideoDuration(mp4Path);
      const frames = Math.ceil(duration * targetFps);

      console.log(`\n✓ Recording saved!`);
      console.log(`\n📊 Video stats:`);
      console.log(`   File: ${mp4Path}`);
      console.log(`   Duration: ${duration.toFixed(2)}s`);
      console.log(`   Frames (${targetFps}fps): ${frames}`);
      console.log(`\n📋 For sprint-config.ts:`);
      console.log(`   durationSeconds: ${Math.ceil(duration)}`);

    } catch (ffmpegError) {
      console.log(`\n⚠ FFmpeg conversion failed. WebM retained at: ${webmPath}`);
    }
  }

  await browser.close();
  process.exit(0);
}

record();
