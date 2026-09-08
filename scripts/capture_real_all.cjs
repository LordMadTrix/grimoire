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
        console.log('[MOCK INVOKE]', cmd, args);
        if (cmd === 'open_vault') {
          return [
            { name: 'Bienvenue.md', path: 'Bienvenue.md', is_dir: false, extension: 'md', size: 150 },
            { name: '1er jour.md', path: '1er jour.md', is_dir: false, extension: 'md', size: 350 },
            { name: 'test.md', path: 'test.md', is_dir: false, extension: 'md', size: 120 },
            {
              name: 'assets', path: 'assets', is_dir: true,
              children: [
                {
                  name: 'maps', path: 'assets/maps', is_dir: true,
                  children: [
                    { name: 'Donjon.png', path: 'assets/maps/Donjon.png', is_dir: false, extension: 'png' }
                  ]
                }
              ]
            }
          ];
        }
        if (cmd === 'read_file') {
          return '# 1er jour dans le Grimoire\n\nLes héros découvrent les catacombes oubliées sous la cité d\'Altdorf.\n\n> [!NOTE]\n> La porte de fer est scellée par une rune naine.\n\nUn murmure provient des ténèbres... [[Eldrin]] prépare son arc.';
        }
        if (cmd === 'check_ollama_status') return { binary_exists: true, models: ['llama3:8b'] };
        if (cmd === 'reindex') return 4;
        if (cmd === 'get_local_ip') return '192.168.1.104';
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
  await page.waitForTimeout(1200);

  // 1. Éditeur Réel
  console.log('1. Capturing Real Editor...');
  const noteBtn = page.locator('text="1er jour.md"').first();
  if (await noteBtn.count() > 0) {
    await noteBtn.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: 'd:/DEV/grimoire/docs/interface_editor.png' });

  // 2. Graphe Réel
  console.log('2. Capturing Real Graphe...');
  const grapheBtn = page.locator('button:has-text("Graphe")').first();
  if (await grapheBtn.count() > 0) {
    await grapheBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'd:/DEV/grimoire/docs/interface_graphe.png' });
  }

  // 3. Timeline Réelle
  console.log('3. Capturing Real Timeline...');
  const timelineBtn = page.locator('button:has-text("Timeline")').first();
  if (await timelineBtn.count() > 0) {
    await timelineBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'd:/DEV/grimoire/docs/interface_timeline.png' });
  }

  // 4. Calendrier Réel
  console.log('4. Capturing Real Calendrier...');
  const calBtn = page.locator('button:has-text("Calendrier")').first();
  if (await calBtn.count() > 0) {
    await calBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'd:/DEV/grimoire/docs/interface_calendrier.png' });
  }

  // Revenir à l'éditeur
  const editorBtn = page.locator('button:has-text("Éditeur")').first();
  if (await editorBtn.count() > 0) await editorBtn.click();
  await page.waitForTimeout(500);

  // 5. Bibliothèque Céleste Réelle
  console.log('5. Capturing Real Bibliothèque Céleste...');
  const addonBtn = page.locator('button:has-text("Bibliothèque Céleste")').first();
  if (await addonBtn.count() > 0) {
    await addonBtn.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'd:/DEV/grimoire/docs/interface_bibliotheque_celeste.png' });
    // Close modal via close button
    const closeBtn = page.locator('button.close-btn').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // 6. Hub Joueurs Réel
  console.log('6. Capturing Real Hub Joueurs...');
  const joueursMenu = page.locator('button:has-text("👥 Joueurs")').first();
  if (await joueursMenu.count() > 0) {
    await joueursMenu.click();
    await page.waitForTimeout(400);
    const hubItem = page.locator('button:has-text("Hub des Joueurs"), button:has-text("Serveur Mobile")').first();
    if (await hubItem.count() > 0) {
      await hubItem.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: 'd:/DEV/grimoire/docs/interface_joueurs_mobile.png' });
      // Close modal
      const closePlayer = page.locator('button.close-btn, button:has-text("✕")').first();
      if (await closePlayer.count() > 0) await closePlayer.click();
      await page.waitForTimeout(400);
    }
  }

  // 7. Ambiance Audio Réelle
  console.log('7. Capturing Real Audio Ambiance...');
  const ambianceMenu = page.locator('button:has-text("🎧 Ambiance")').first();
  if (await ambianceMenu.count() > 0) {
    await ambianceMenu.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'd:/DEV/grimoire/docs/interface_audio_ambiance.png' });
    await page.click('body', { position: { x: 500, y: 500 } });
    await page.waitForTimeout(400);
  }

  // 8. Outils MJ Réels
  console.log('8. Capturing Real Outils MJ...');
  const outilsMenu = page.locator('button:has-text("🎲 Outils MJ")').first();
  if (await outilsMenu.count() > 0) {
    await outilsMenu.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'd:/DEV/grimoire/docs/interface_outils_mj.png' });
    await page.click('body', { position: { x: 500, y: 500 } });
    await page.waitForTimeout(400);
  }

  // 9. Table Virtuelle (VTT) Réelle
  console.log('9. Activating and Capturing Real VTT Table Virtuelle...');
  await page.evaluate(() => {
    // Generate a simple dungeon canvas dataUrl
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1e2430';
    ctx.fillRect(0, 0, 1200, 800);
    
    // Grid tiles
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1200; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 800); ctx.stroke();
    }
    for (let y = 0; y < 800; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke();
    }
    
    // Stone room
    ctx.fillStyle = '#151922';
    ctx.fillRect(150, 100, 900, 600);
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 6;
    ctx.strokeRect(150, 100, 900, 600);

    const dataUrl = c.toDataURL('image/png');
    const bc = new BroadcastChannel('grimoire-map-bridge');
    bc.postMessage({
      type: 'map-send-to-grimoire',
      payload: {
        dataUrl,
        title: 'Donjon de la Crypte des Ombres',
        gridSize: 50
      }
    });
  });

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'd:/DEV/grimoire/docs/interface_vtt.png' });
  console.log('Real VTT captured.');

  await browser.close();
  console.log('All real screens successfully captured!');
})();
