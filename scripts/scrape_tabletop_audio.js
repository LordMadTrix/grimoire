import fs from 'fs';
import path from 'path';
import https from 'https';

const htmlPath = 'C:/Users/madtr/.gemini/antigravity-ide/brain/5b8576a1-15c1-41c8-982e-e575b30442f8/.system_generated/steps/12/content.md';
const html = fs.readFileSync(htmlPath, 'utf8');

// Load tags_data if available
let useCaseTags = {};
if (fs.existsSync('scripts/tta_tags_data.js')) {
  const content = fs.readFileSync('scripts/tta_tags_data.js', 'utf8');
  const match = content.match(/var\s+useCaseTags\s*=\s*(\{[\s\S]*?\});/);
  if (match) {
    try {
      const fn = new Function(`return ${match[1]};`);
      useCaseTags = fn();
    } catch (e) {
      console.warn('Could not parse useCaseTags:', e.message);
    }
  }
}

const blocks = html.split(/<div class=["']col-md-3 mix\s+/);
console.log('Total blocks found:', blocks.length - 1);

const tracks = [];

for (let i = 1; i < blocks.length; i++) {
  const block = blocks[i];
  const classMatch = block.match(/^([^"']+)/);
  const classes = classMatch ? classMatch[1].trim() : '';

  const titleMatch = block.match(/<div class=["']track_title["']>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  const idMatch = block.match(/id=["']keys_(\d+)["']/);
  const id = idMatch ? parseInt(idMatch[1]) : i;

  const flavorMatch = block.match(/<span class=["']white flavor["']>([\s\S]*?)<\/span>/);
  const flavor = flavorMatch ? flavorMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  const saveMatch = block.match(/saveAs\(['"]([^'"]+)['"]\)/);
  const saveId = saveMatch ? saveMatch[1] : null;

  const tags = useCaseTags[id.toString()] || {};

  // Classification logic based on genres, civ, biome, mood, action
  let category = 'Ambiances';
  const fullText = `${title} ${classes} ${flavor} ${(tags.action || []).join(' ')} ${(tags.mood || []).join(' ')} ${(tags.civ || []).join(' ')} ${(tags.biome || []).join(' ')}`.toLowerCase();

  if (classes.includes('scifi') || fullText.includes('starship') || fullText.includes('space') || fullText.includes('cyber') || fullText.includes('alien') || fullText.includes('orbital') || fullText.includes('future') || (tags.civ && tags.civ.includes('facilities'))) {
    category = 'SciFi_et_Futuriste';
  } else if ((tags.action && (tags.action.includes('war') || tags.action.includes('boss') || tags.action.includes('skirmish') || tags.action.includes('monster') || tags.action.includes('chase'))) || fullText.includes('combat') || fullText.includes('battle') || fullText.includes('attack') || fullText.includes('siege') || fullText.includes('clash') || fullText.includes('duel') || fullText.includes('war')) {
    category = 'Musiques_Combat';
  } else if ((tags.mood && (tags.mood.includes('tension') || tags.mood.includes('mysterious'))) || classes.includes('horror') || fullText.includes('horror') || fullText.includes('dark') || fullText.includes('dungeon') || fullText.includes('creepy') || fullText.includes('crypt') || fullText.includes('tomb') || fullText.includes('cemetery') || fullText.includes('haunted') || fullText.includes('gothic') || fullText.includes('vampire') || fullText.includes('cthulhu')) {
    category = 'Horreur_et_Donjons';
  } else if ((tags.civ && (tags.civ.includes('cities') || tags.civ.includes('public') || tags.civ.includes('interiors') || tags.civ.includes('slums') || tags.civ.includes('temples'))) || fullText.includes('tavern') || fullText.includes('inn') || fullText.includes('town') || fullText.includes('city') || fullText.includes('market') || fullText.includes('village') || fullText.includes('bazaar') || fullText.includes('bar') || fullText.includes('pub')) {
    category = 'Villes_et_Tavernes';
  } else if ((tags.biome && (tags.biome.includes('forest') || tags.biome.includes('water') || tags.biome.includes('weather') || tags.biome.includes('desert') || tags.biome.includes('ice') || tags.biome.includes('swamp') || tags.biome.includes('mountains'))) || classes.includes('nature') || fullText.includes('forest') || fullText.includes('ocean') || fullText.includes('sea') || fullText.includes('rain') || fullText.includes('storm') || fullText.includes('river') || fullText.includes('jungle') || fullText.includes('wind') || fullText.includes('winter')) {
    category = 'Nature_et_Elements';
  } else if ((tags.action && (tags.action.includes('explore') || tags.action.includes('investigate') || tags.action.includes('sneak') || tags.action.includes('ritual'))) || fullText.includes('explore') || fullText.includes('journey') || fullText.includes('travel') || fullText.includes('ruins') || fullText.includes('sanctuary') || fullText.includes('mystic') || fullText.includes('magic')) {
    category = 'Musiques_Exploration';
  }

  if (title) {
    tracks.push({
      id,
      title,
      cleanTitle: title.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_'),
      classes,
      flavor,
      saveId,
      url: saveId ? `https://sounds.tabletopaudio.com/${saveId}.mp3` : null,
      category,
      tags
    });
  }
}

console.log('Total parsed tracks:', tracks.length);
console.log('Tracks with direct URL:', tracks.filter(t => t.url).length);

const categoryCounts = {};
for (const t of tracks) {
  categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
}
console.log('Tracks by Category:', categoryCounts);

fs.writeFileSync('scripts/tta_catalog.json', JSON.stringify(tracks, null, 2));
console.log('Saved catalog to scripts/tta_catalog.json');
