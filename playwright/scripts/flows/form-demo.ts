/**
 * Example: Form submission recording
 *
 * Copy this file and customize for your specific flow.
 *
 * Usage:
 *   npx tsx scripts/flows/form-demo.ts
 */

import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const config = {
  name: 'form-submission-demo',
  url: 'https://example.com/contact',  // Change to your form URL
  viewport: { width: 1920, height: 1080 },
  slowMo: 75,
  outputDir: './output',               // Local output by default
  targetFps: 30,                       // Match Remotion default
  headless: process.env.DEBUG !== 'true',
};

async function injectCursor(page: Page) {
  await page.addStyleTag({
    content: `
      .pw-cursor {
        position: fixed;
        width: 20px;
        height: 20px;
        background: rgba(234, 88, 12, 0.6);
        border: 2px solid rgba(234, 88, 12, 0.9);
        border-radius: 50%;
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%);
      }
    `
  });
  await page.evaluate(() => {
    const cursor = document.createElement('div');
    cursor.className = 'pw-cursor';
    document.body.appendChild(cursor);
    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
  });
}

async function record() {
  console.log(`🎬 Recording: ${config.name}\n`);

  const browser = await chromium.launch({ slowMo: config.slowMo, headless: config.headless });
  const context = await browser.newContext({
    viewport: config.viewport,
    recordVideo: { dir: './recordings', size: config.viewport },
  });
  const page = await context.newPage();

  try {
    await page.goto(config.url);
    await injectCursor(page);
    await page.waitForTimeout(1500);

    // === FORM ACTIONS ===

    // Fill name field
    await page.fill('input[name="name"]', 'Jane Smith');
    await page.waitForTimeout(500);

    // Fill email field
    await page.fill('input[name="email"]', 'jane@example.com');
    await page.waitForTimeout(500);

    // Fill message
    await page.fill('textarea[name="message"]', 'Hello! This is a demo message.');
    await page.waitForTimeout(500);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for success
    await page.waitForSelector('.success-message', { timeout: 10000 });
    await page.waitForTimeout(2000);

    console.log('✓ Recording completed');

  } catch (error) {
    console.error('Recording error:', error);
  } finally {
    await context.close();

    const video = page.video();
    const videoPath = await video?.path();

    if (videoPath) {
      fs.mkdirSync(config.outputDir, { recursive: true });
      const mp4Path = path.join(config.outputDir, `${config.name}.mp4`);

      // Convert with target frame rate for Remotion compatibility
      execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -crf 20 -r ${config.targetFps} -movflags faststart "${mp4Path}"`, { stdio: 'pipe' });
      fs.unlinkSync(videoPath);

      const duration = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${mp4Path}"`, { encoding: 'utf-8' }));
      console.log(`✓ Saved: ${mp4Path}`);
      console.log(`  Duration: ${duration.toFixed(2)}s (${Math.ceil(duration * config.targetFps)} frames @ ${config.targetFps}fps)`);
    }

    await browser.close();
  }
}

record();
