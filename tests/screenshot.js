const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');

(async () => {
  // build the site
  execSync('npm run build', { stdio: 'inherit' });

  // start a preview server
  const server = spawn('npx', ['vite', 'preview', '--port', '5173'], { stdio: 'inherit' });

  // wait briefly for server to start
  await new Promise(r => setTimeout(r, 1200));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForSelector('main', { timeout: 5000 });

  // take a full-page screenshot
  await page.screenshot({ path: 'tests/screenshot.png', fullPage: true });
  console.log('Saved screenshot to tests/screenshot.png');

  await browser.close();
  server.kill();
})();
