const { chromium } = require('d:/DEV/grimoire/map-editor/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1.0,
  });

  const page = await context.newPage();

  await page.addInitScript(() => {
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        if (cmd === 'open_vault') return [{ name: '1er jour.md', path: '1er jour.md', is_dir: false, extension: 'md' }];
        if (cmd === 'read_file') return '# Note';
        if (cmd === 'get_local_ip') return '192.168.1.104';
        if (cmd === 'get_player_server_port') return 8080;
        if (cmd === 'get_connected_players') {
          return [
            { id: '1', name: 'Alaric', role: 'Paladin', hp: 45, maxHp: 45, online: true },
            { id: '2', name: 'Lysandra', role: 'Mage', hp: 28, maxHp: 32, online: true }
          ];
        }
        return {};
      },
      transformCallback: (cb) => 1,
      plugins: {}
    };

    localStorage.setItem('last_vault_path', 'C:\\Users\\madtr\\Documents\\Grimoire');
    localStorage.setItem('grimoire_ollama_onboard_dismissed', 'true');
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Ouvrir le Serveur Mobile (QR)
  console.log('Opening Joueurs dropdown...');
  // Find menu button containing "Joueurs"
  const playersBtn = page.locator('.menu-btn:has-text("Joueurs")').first();
  await playersBtn.click();
  await page.waitForTimeout(400);

  console.log('Clicking Serveur Mobile (QR)...');
  const qrItem = page.locator('.dropdown-item:has-text("Serveur Mobile")').first();
  await qrItem.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'd:/DEV/grimoire/docs/interface_joueurs_mobile.png' });
  console.log('Real Hub Joueurs (QR) captured.');

  // Close QR modal
  await page.keyboard.press('Escape');
  const closeBtn = page.locator('button.close-btn, button:has-text("✕")').first();
  if (await closeBtn.count() > 0) await closeBtn.click();
  await page.waitForTimeout(600);

  // 2. Ouvrir Outils MJ
  console.log('Opening Outils MJ dropdown...');
  const gmBtn = page.locator('.menu-btn:has-text("Outils MJ")').first();
  await gmBtn.click();
  await page.waitForTimeout(400);

  console.log('Clicking PNJ Rapide...');
  const npcItem = page.locator('.dropdown-item:has-text("PNJ Rapide")').first();
  await npcItem.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'd:/DEV/grimoire/docs/interface_outils_mj.png' });
  console.log('Real Outils MJ (PNJ Rapide) captured.');

  await browser.close();
  console.log('Done!');
})();
