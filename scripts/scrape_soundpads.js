import fs from 'fs';
import https from 'https';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
  });
}

const soundpads = [
  { name: 'Dungeon', url: 'https://tabletopaudio.com/bootstrap/js/sp_dungeon_simple_min.js', cat: 'Bruitages_Donjon' },
  { name: 'Combat', url: 'https://tabletopaudio.com/bootstrap/js/sp_combat_simple_min.js', cat: 'Bruitages_Combat' },
  { name: 'Combat_Siege', url: 'https://tabletopaudio.com/bootstrap/js/sp_combat_siege_simple_min.js', cat: 'Bruitages_Combat' },
  { name: 'Combat_Future', url: 'https://tabletopaudio.com/bootstrap/js/sp_combat_future_simple_min.js', cat: 'Bruitages_SciFi' },
  { name: 'Monsters', url: 'https://tabletopaudio.com/bootstrap/js/sp_monsters1_simple_min.js', cat: 'Bruitages_Monstres' },
  { name: 'DM_Tools', url: 'https://tabletopaudio.com/bootstrap/js/sp_dm_tools_simple_min.js', cat: 'Bruitages_Generaux' },
  { name: 'Tavern', url: 'https://tabletopaudio.com/bootstrap/js/sp_tavern_simple_min.js', cat: 'Bruitages_Taverne' },
  { name: 'DarkForest', url: 'https://tabletopaudio.com/bootstrap/js/sp_forest_simple_min.js', cat: 'Bruitages_Nature' },
  { name: 'OldeTowne', url: 'https://tabletopaudio.com/bootstrap/js/sp_olde_towne_simple_min.js', cat: 'Bruitages_Ville' },
  { name: 'CastleRaven', url: 'https://tabletopaudio.com/bootstrap/js/sp_castle_raven_simple_min.js', cat: 'Bruitages_Gothique' },
  { name: 'HouseOnTheHill', url: 'https://tabletopaudio.com/bootstrap/js/sp_house_simple_min.js', cat: 'Bruitages_Horreur' },
  { name: 'Cthulhu', url: 'https://tabletopaudio.com/bootstrap/js/sp_cthulhu_simple_min.js', cat: 'Bruitages_Horreur' },
  { name: 'Vikings', url: 'https://tabletopaudio.com/bootstrap/js/sp_vikings_simple_min.js', cat: 'Bruitages_Historique' },
  { name: 'AgeOfSail', url: 'https://tabletopaudio.com/bootstrap/js/sp_sail_simple_min.js', cat: 'Bruitages_Maritime' },
  { name: 'BleakwaterDocks', url: 'https://tabletopaudio.com/bootstrap/js/sp_bleakwater_docks_simple_min.js', cat: 'Bruitages_Maritime' },
  { name: 'Starship', url: 'https://tabletopaudio.com/bootstrap/js/sp_starship_simple_min.js', cat: 'Bruitages_SciFi' },
  { name: 'FutureCity', url: 'https://tabletopaudio.com/bootstrap/js/sp_future_city_simple_min.js', cat: 'Bruitages_SciFi' },
  { name: 'DeepSix', url: 'https://tabletopaudio.com/bootstrap/js/sp_deep_six_simple_min.js', cat: 'Bruitages_SciFi' },
  { name: 'Steampunk', url: 'https://tabletopaudio.com/bootstrap/js/sp_steampunk_simple_min.js', cat: 'Bruitages_Steampunk' },
  { name: 'Wasteland', url: 'https://tabletopaudio.com/bootstrap/js/sp_wasteland_simple_min.js', cat: 'Bruitages_PostApo' },
  { name: 'TrueWest', url: 'https://tabletopaudio.com/bootstrap/js/sp_western_simple_min.js', cat: 'Bruitages_Western' },
  { name: 'FilmNoir', url: 'https://tabletopaudio.com/bootstrap/js/sp_noir_simple_min.js', cat: 'Bruitages_Moderne' },
  { name: 'SecretAgent', url: 'https://tabletopaudio.com/bootstrap/js/sp_secret_agent_simple_min.js', cat: 'Bruitages_Moderne' },
  { name: 'Vampire', url: 'https://tabletopaudio.com/bootstrap/js/sp_vampire_simple_min.js', cat: 'Bruitages_Horreur' },
  { name: 'Wuxia', url: 'https://tabletopaudio.com/bootstrap/js/sp_wuxia_simple_min.js', cat: 'Bruitages_Wuxia' },
  { name: 'AncientGreece', url: 'https://tabletopaudio.com/bootstrap/js/sp_ancient_greece_simple_min.js', cat: 'Bruitages_Historique' },
  { name: 'DesertPlanet', url: 'https://tabletopaudio.com/bootstrap/js/sp_desert_planet_simple_min.js', cat: 'Bruitages_SciFi' },
  { name: 'IcePlanet', url: 'https://tabletopaudio.com/bootstrap/js/sp_ice_planet_simple_min.js', cat: 'Bruitages_SciFi' },
  { name: 'HellPlanet', url: 'https://tabletopaudio.com/bootstrap/js/sp_hell_planet_simple_min.js', cat: 'Bruitages_SciFi' },
  { name: 'JunglePlanet', url: 'https://tabletopaudio.com/bootstrap/js/sp_jungle_planet_simple_min.js', cat: 'Bruitages_Nature' }
];

async function run() {
  const allSfx = [];
  
  for (const sp of soundpads) {
    try {
      const code = await get(sp.url);
      const baseMatches = [...code.matchAll(/var\s+([a-zA-Z0-9_]+)\s*=\s*["'](https:\/\/sounds\.tabletopaudio\.com\/[^"']+)["']/g)];
      const baseMap = {};
      for (const bm of baseMatches) {
        baseMap[bm[1]] = bm[2];
      }

      const fileMatches = [...code.matchAll(/(?:src:\s*([a-zA-Z0-9_]+)\s*\+\s*["']([^"']+\.(?:ogg|mp3))["']|src:\s*["'](https:\/\/sounds\.tabletopaudio\.com\/[^"']+\.(?:ogg|mp3))["'])/g)];
      
      let count = 0;
      for (const fm of fileMatches) {
        let soundUrl = '';
        let filename = '';
        if (fm[1] && fm[2]) {
          const baseUrl = baseMap[fm[1]] || 'https://sounds.tabletopaudio.com/';
          soundUrl = baseUrl + fm[2];
          filename = fm[2];
        } else if (fm[3]) {
          soundUrl = fm[3];
          filename = fm[3].split('/').pop();
        }

        if (soundUrl) {
          allSfx.push({
            soundpad: sp.name,
            category: sp.cat,
            filename,
            cleanName: `${sp.name}_${filename.replace(/\.[^.]+$/, '')}`,
            url: soundUrl,
            isLoop: filename.includes('_lp') || filename.includes('_bg') || filename.includes('loop')
          });
          count++;
        }
      }
      console.log(`✓ Scraped SoundPad [${sp.name}]: ${count} sounds`);
    } catch (err) {
      console.warn(`[WARN] Failed to scrape ${sp.name}: ${err.message}`);
    }
  }

  // Deduplicate
  const uniqueSfx = [];
  const seenUrls = new Set();
  for (const s of allSfx) {
    if (!seenUrls.has(s.url)) {
      seenUrls.add(s.url);
      uniqueSfx.push(s);
    }
  }

  console.log(`\nTotal unique SoundPad SFX & loops extracted: ${uniqueSfx.length}`);
  fs.writeFileSync('scripts/tta_soundpad_catalog.json', JSON.stringify(uniqueSfx, null, 2));
  console.log('Saved to scripts/tta_soundpad_catalog.json');
}

run();
