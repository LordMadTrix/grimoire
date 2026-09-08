const { chromium } = require('d:/DEV/grimoire/map-editor/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();
  console.log('Navigating to http://localhost:5174...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: 'd:/DEV/grimoire/docs/interface_map_editor.png' });
  console.log('Real Map Editor screenshot saved to d:/DEV/grimoire/docs/interface_map_editor.png');
  await browser.close();
})();
