# Playwright Video Recording

Record browser demos for Remotion video projects.

## Setup

```bash
cd playwright
npm install
npm run install-browsers
```

## Quick Start

1. Edit `scripts/record-demo.ts`:
   - Set `config.url` to your target
   - Set `config.name` for output filename
   - Set `config.outputDir` to your project's `public/demos/`
   - Customize `performActions()` with your recording steps

2. Run:
   ```bash
   npm run record
   ```

3. Video is saved to your output directory as MP4 (30fps, H.264)

## Configuration

```typescript
const config = {
  name: 'my-demo',                           // Output filename
  url: 'https://myapp.com',                  // Starting URL
  viewport: { width: 1920, height: 1080 },   // Match Remotion
  slowMo: 50,                                // Delay between actions (ms)
  outputDir: './output',                     // Where to save (default: local)
  convertToMp4: true,                        // Auto-convert WebM→MP4
  targetFps: 30,                             // Frame rate for Remotion
  headless: process.env.DEBUG !== 'true',    // Set DEBUG=true to see browser
};
```

## Debugging

To see the browser while recording (useful for debugging):

```bash
DEBUG=true npm run record
```

## Recording Actions

Common patterns in `performActions()`:

```typescript
// Navigate
await page.goto('https://example.com');

// Wait for page to settle
await page.waitForTimeout(2000);
await page.waitForLoadState('networkidle');

// Click
await page.click('button.submit');
await page.click('text=Click me');

// Fill form
await page.fill('#email', 'user@example.com');
await page.fill('input[name="password"]', '••••••••');

// Scroll
await page.evaluate(() => window.scrollBy({ top: 500, behavior: 'smooth' }));

// Wait for element
await page.waitForSelector('.success-message');

// Hover
await page.hover('.dropdown-trigger');
```

## Output

After recording:
- MP4 file in your output directory (30fps, H.264)
- Console shows duration and frame count for `sprint-config.ts`

```
📊 Video stats:
   Duration: 15.23s
   Frames (30fps): 457
   For sprint-config.ts: durationSeconds: 16
```

## Frame Rate

Playwright outputs WebM at 25fps by default. This script automatically converts to **30fps** to match Remotion's default frame rate. This ensures:
- Accurate timing in compositions
- Correct frame count calculations
- Proper audio sync

If your Remotion project uses a different fps, update `config.targetFps`.

## Custom Flows

Create specific recording scripts in `scripts/flows/`:
- `form-demo.ts` - Form submission example
- Copy and customize for your needs

Run specific flow:
```bash
npx tsx scripts/flows/form-demo.ts
```

## Tips

- Use `slowMo: 50-100` for visible actions
- Add `waitForTimeout()` between steps for comprehension
- Cursor is automatically visualized (orange dot)
- Click ripples show where clicks happen
- Use `DEBUG=true` to see the browser during recording
- Test without recording first to debug selectors
