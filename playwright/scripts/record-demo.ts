/**
 * Generic demo recording script
 *
 * Usage:
 *   npx tsx scripts/record-demo.ts
 *
 * Or import and customize the RecordingConfig
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ============================================================
// CONFIGURATION - Edit these for your recording
// ============================================================

interface RecordingConfig {
  name: string;                    // Output filename (without extension)
  url: string;                     // Starting URL
  viewport: { width: number; height: number };
  slowMo: number;                  // Delay between actions (ms)
  outputDir: string;               // Where to save the final video
  convertToMp4: boolean;           // Auto-convert WebM to MP4
  targetFps: number;               // Target frame rate for Remotion (default: 30)
  headless: boolean;               // Run headless (set false for debugging)
}

const config: RecordingConfig = {
  name: 'demo',
  url: 'https://example.com',
  viewport: { width: 1920, height: 1080 },
  slowMo: 50,
  outputDir: './output',           // Default to local output (override per project)
  convertToMp4: true,
  targetFps: 30,                   // Match Remotion default
  headless: process.env.DEBUG !== 'true', // Set DEBUG=true to see browser
};

// ============================================================
// RECORDING ACTIONS - Customize this function
// ============================================================

async function performActions(page: Page): Promise<void> {
  // Navigate to starting URL
  await page.goto(config.url);

  // Inject cursor visualization after page loads
  await injectCursorVisualization(page);
  await page.waitForTimeout(2000);

  // === ADD YOUR RECORDING ACTIONS HERE ===

  // Hover over the "Learn more" link to show cursor
  await page.hover('text=Learn more');
  await page.waitForTimeout(1000);

  // Click the link
  await page.click('text=Learn more');
  await page.waitForTimeout(3000);

  // Final pause before ending
  await page.waitForTimeout(1000);
}

// ============================================================
// RECORDING ENGINE - Usually no need to modify below
// ============================================================

async function injectCursorVisualization(page: Page): Promise<void> {
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
    const cursor = document.createElement('div');
    cursor.className = 'playwright-cursor';
    document.body.appendChild(cursor);

    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });

    document.addEventListener('mousedown', (e) => {
      cursor.classList.add('clicking');

      // Add ripple effect
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

async function record(): Promise<void> {
  console.log(`\n🎬 Starting recording: ${config.name}`);
  console.log(`   URL: ${config.url}`);
  console.log(`   Viewport: ${config.viewport.width}x${config.viewport.height}`);
  console.log(`   SlowMo: ${config.slowMo}ms\n`);

  const browser: Browser = await chromium.launch({
    slowMo: config.slowMo,
    headless: config.headless,
  });

  const tempDir = './recordings';
  fs.mkdirSync(tempDir, { recursive: true });

  const context: BrowserContext = await browser.newContext({
    viewport: config.viewport,
    recordVideo: {
      dir: tempDir,
      size: config.viewport,
    },
  });

  const page: Page = await context.newPage();

  try {
    // Perform the recording actions (includes navigation)
    // Cursor visualization is injected after first page load in performActions
    await performActions(page);

    console.log('✓ Recording actions completed');

  } catch (error) {
    console.error('✗ Recording failed:', error);
  } finally {
    await context.close();

    // Get and move video
    const video = page.video();
    const videoPath = await video?.path();

    if (videoPath && fs.existsSync(videoPath)) {
      fs.mkdirSync(config.outputDir, { recursive: true });

      const webmPath = path.join(config.outputDir, `${config.name}.webm`);
      fs.renameSync(videoPath, webmPath);
      console.log(`✓ WebM saved: ${webmPath}`);

      // Convert to MP4 if requested
      if (config.convertToMp4) {
        const mp4Path = path.join(config.outputDir, `${config.name}.mp4`);
        console.log(`  Converting to MP4...`);

        try {
          // Convert to MP4 with target frame rate for Remotion compatibility
          execSync(
            `ffmpeg -y -i "${webmPath}" -c:v libx264 -crf 20 -preset medium -r ${config.targetFps} -movflags faststart "${mp4Path}"`,
            { stdio: 'pipe' }
          );
          console.log(`✓ MP4 saved: ${mp4Path}`);

          // Remove WebM after successful conversion
          fs.unlinkSync(webmPath);

          // Get duration and calculate frames at target fps
          const duration = getVideoDuration(mp4Path);
          const frames = Math.ceil(duration * config.targetFps);
          console.log(`\n📊 Video stats:`);
          console.log(`   Duration: ${duration.toFixed(2)}s`);
          console.log(`   Frames (${config.targetFps}fps): ${frames}`);
          console.log(`   For sprint-config.ts: durationSeconds: ${Math.ceil(duration)}`);

        } catch (ffmpegError) {
          console.log(`⚠ FFmpeg conversion failed. WebM file retained.`);
          console.log(`  Run manually: ffmpeg -i "${webmPath}" -c:v libx264 -crf 20 -r ${config.targetFps} -movflags faststart "${mp4Path}"`);
        }
      }
    }

    await browser.close();
    console.log('\n✓ Recording complete!\n');
  }
}

// Run if executed directly
record();
