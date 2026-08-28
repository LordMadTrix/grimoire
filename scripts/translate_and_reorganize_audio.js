import fs from 'fs';
import path from 'path';

const basePublic = path.resolve('public/assets/audio/Grimoire_Audio');
const baseVault = path.resolve('wfrp_vault/assets/audio/Grimoire_Audio');

const WORD_MAP = {
  // RPG Genres & Atmospheres
  "attack": "Attaque",
  "battle": "Bataille",
  "combat": "Combat",
  "siege": "Siege",
  "war": "Guerre",
  "fight": "Combat",
  "duel": "Duel",
  "clash": "Choc",
  "ambience": "Ambiance",
  "music": "Musique",
  "theme": "Theme",
  "loop": "Boucle",
  "bg": "Ambiance_Fond",
  "lp": "Boucle",
  "dungeon": "Donjon",
  "crypt": "Crypte",
  "tomb": "Tombeau",
  "temple": "Temple",
  "castle": "Chateau",
  "palace": "Palais",
  "ruins": "Ruines",
  "sanctuary": "Sanctuaire",
  "altar": "Autel",
  "cave": "Grotte",
  "cavern": "Caverne",
  "tower": "Tour",
  "keep": "Fortresse",
  "fort": "Fortresse",
  "outpost": "Avant_Poste",
  "bridge": "Pont",
  "road": "Route",
  "path": "Sentier",
  "trail": "Piste",
  "ashes": "Cendres",
  "nest": "Nid",
  "feast": "Banquet",
  "beacons": "Feux_d_Alarme",
  "dust": "Poussiere",
  "steam": "Vapeur",
  "oxen": "Boeufs",
  "plains": "Plaines",
  "shadows": "Ombres",
  "shadow": "Ombre",
  "above": "Au_Dessus",
  "alchemist": "Alchimiste",
  "lab": "Laboratoire",
  "forge": "Forge",
  "fury": "Fureur",
  "office": "Bureau",
  "garret": "Grenier",
  "tinkerer": "Bricoleur",
  "workshop": "Atelier",
  "pool": "Bassin",
  "radiance": "Rayonnement",
  "hall": "Salle",
  "angels": "Anges",
  "capes": "Capes",
  "canes": "Cannes",
  "waypoint": "Relais",
  "kingdom": "Royaume",
  "mist": "Brume",
  "fog": "Brouillard",
  "city": "Cite",
  "town": "Ville",
  "village": "Village",
  "market": "Marche",
  "bazaar": "Bazar",
  "tavern": "Taverne",
  "inn": "Auberge",
  "pub": "Taverne",
  "docks": "Quais",
  "port": "Port",
  "harbor": "Port",
  "sewer": "Egouts",
  "slum": "Bas_Fonds",
  "graveyard": "Cimetiere",
  "cemetery": "Cimetiere",
  "forest": "Foret",
  "woods": "Bois",
  "jungle": "Jungle",
  "swamp": "Marecage",
  "marsh": "Marais",
  "desert": "Desert",
  "mountain": "Montagne",
  "mountains": "Montagnes",
  "pass": "Col",
  "cliff": "Falaise",
  "canyon": "Canyon",
  "valley": "Vallee",
  "river": "Riviere",
  "stream": "Ruisseau",
  "lake": "Lac",
  "ocean": "Ocean",
  "sea": "Mer",
  "shore": "Rivage",
  "island": "Ile",
  "ice": "Glace",
  "snow": "Neige",
  "winter": "Hiver",
  "storm": "Tempete",
  "rain": "Pluie",
  "wind": "Vent",
  "thunder": "Tonnerre",
  "lightning": "Eclair",
  "fire": "Feu",
  "flame": "Flamme",
  "dark": "Sombre",
  "darkness": "Tenebres",
  "night": "Nuit",
  "dawn": "Aube",
  "dusk": "Crepuscule",
  "sun": "Soleil",
  "moon": "Lune",
  "star": "Etoile",
  "space": "Espace",
  "planet": "Planete",
  "station": "Station",
  "starship": "Vaisseau",
  "ship": "Navire",
  "boat": "Bateau",
  "sail": "Voile",
  "dragon": "Dragon",
  "monster": "Monstre",
  "monsters": "Monstres",
  "beast": "Bete",
  "creature": "Creature",
  "giant": "Geant",
  "wyrm": "Vouivre",
  "demon": "Demon",
  "demons": "Demons",
  "devil": "Diable",
  "vampire": "Vampire",
  "werewolf": "Loup_Garou",
  "ghost": "Spectre",
  "phantom": "Fantome",
  "witch": "Sorciere",
  "witches": "Sorcieres",
  "wizard": "Mage",
  "sorcerer": "Sorcier",
  "priest": "Pretre",
  "monk": "Moine",
  "knight": "Chevalier",
  "guard": "Garde",
  "soldier": "Soldat",
  "warrior": "Guerrier",
  "rogue": "Voleur",
  "assassin": "Assassin",
  "hunter": "Chasseur",
  "king": "Roi",
  "queen": "Reine",
  "lord": "Seigneur",
  "lady": "Dame",

  // SFX Actions & Objects
  "door_open": "Porte_Ouverture",
  "door_close": "Porte_Fermeture",
  "door": "Porte",
  "gate": "Grille_Porte",
  "lock": "Serrure",
  "key": "Clef",
  "chest": "Coffre",
  "footsteps": "Bruits_de_Pas",
  "footstep": "Pas",
  "steps": "Pas",
  "chains": "Chaines",
  "chain": "Chaine",
  "bats": "Chauves_Souris",
  "torches": "Torches_Crepitantes",
  "torch": "Torche",
  "fire_crackle": "Crepitement_Feu",
  "fireplace": "Cheminee",
  "drips": "Gouttes_Eau",
  "drip": "Goutte_Eau",
  "water_drop": "Goutte_Eau",
  "waterfall": "Cascade_Eau",
  "splash": "Eclaboussure",
  "waves": "Vagues",
  "bell": "Cloche",
  "bells": "Cloches",
  "church_bell": "Cloche_Eglise",
  "sword_hit": "Coup_Epee",
  "sword_clash": "Choc_de_Lames",
  "sword_draw": "Degainage_Epee",
  "sword": "Epee",
  "blade": "Lame",
  "axe": "Hache",
  "hammer": "Marteau",
  "club": "Masse",
  "shield_block": "Parade_Bouclier",
  "shield": "Bouclier",
  "arrow_shot": "Tir_Arc",
  "bow_single_shot": "Tir_Arc",
  "bow_multi": "Volee_de_Fleches",
  "bow": "Arc",
  "crossbow": "Arbalete",
  "gunshot": "Coup_de_Feu",
  "cannon": "Tir_de_Canon",
  "explosion": "Explosion",
  "spell": "Sortilege",
  "magic": "Magie",
  "conjuring": "Incantation",
  "chant": "Chant_Rituel",
  "chants": "Chants_Rituels",
  "growl": "Grognement",
  "roar": "Rugissement",
  "screamer": "Cri_Effrayant",
  "scream": "Cri",
  "yell": "Cri_Combat",
  "howl": "Hurlement",
  "howlers": "Hurleurs",
  "groan": "Gemissement",
  "whisper": "Murmure",
  "whispers": "Murmures",
  "crowd": "Foule",
  "cheer": "Acclamations",
  "laughter": "Rires",
  "glasses": "Verres_qui_Trinquent",
  "tavern_ambience": "Ambiance_Taverne",
  "coins": "Pieces_de_Monnaie",
  "dice": "Lancer_de_Des",
  "drum": "Tambour",
  "drums": "Tambours_de_Guerre",
  "flute": "Flute",
  "horn": "Cor_de_Chasse",
  "organ": "Orgue",
  "piano": "Piano",
  "birds": "Chant_Oiseaux",
  "insects": "Insectes_Nuit",
  "frogs": "Grenouilles",
  "wolves": "Loups",
  "horse": "Cheval_Hennissement",
  "horses": "Chevaux_Galop",
  "cart": "Charette",
  "wagon": "Chariot",
  "thunder_clap": "Coup_de_Tonnerre",
  "rain_heavy": "Forte_Pluie",
  "wind_howl": "Vent_Violent",
  "laser": "Tir_Laser",
  "engine": "Moteur",
  "alarm": "Alarme",
  "scanner": "Scanner",
  "airlock": "Sas_Pneumatique",
  "radio": "Transmission_Radio",
  "static": "Gresillement",
  "glitch": "Parasites_Electroniques",
  "portal": "Portail_Dimensionnel",
  "acid": "Acide",
  "poison": "Poison",
  "trap": "Piege",
  "blade_trap": "Piege_a_Lames",
  "net_trap": "Piege_a_Filet",
  "torch_light": "Torche_Allumee",
  "water_dripping": "Gouttes_Eau",
  "heavy_door": "Porte_Lourde",
  "creak": "Grincement",
  "scrape": "Frottement",
  "flies": "Mouches",
  "low_tone": "Grave_Sourd",
  "hi_tone": "Aigu_Cristallin",
  "male_voice": "Voix_Homme",
  "female_voice": "Voix_Femme",
  "ghostly": "Spectral",
  "curse": "Malediction",
  "ritual": "Rituel",
  "chase": "Poursuite",
  "stealth": "Discretion",
  "sneaking": "Pas_Furtifs",
  "creepy": "Angoissant",
  "eerie": "Mysterieux",
  "peaceful": "Paisible",
  "epic": "Epique",
  "tension": "Tension",
  "somber": "Sombre",
  "explore": "Exploration",
  "journey": "Voyage",
  "brawl": "Bagarre"
};

// Grammar connector words to ignore or translate
const CONNECTORS = {
  "of": "de",
  "the": "le",
  "and": "et",
  "in": "dans",
  "to": "a",
  "at": "a",
  "from": "depuis",
  "with": "avec",
  "on": "sur"
};

function translateWord(w) {
  const low = w.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (WORD_MAP[low]) return WORD_MAP[low];
  if (CONNECTORS[low]) return CONNECTORS[low];
  if (low.match(/^\d+$/)) return low;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function translateName(name) {
  if (!name) return "";
  const parts = name.split(/[_ \-]+/);
  const transParts = parts.map(p => translateWord(p));
  return transParts.join('_');
}

function cleanName(n) {
  return n
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function safeRename(oldPath, newPath) {
  if (oldPath === newPath) return true;
  if (oldPath.toLowerCase() === newPath.toLowerCase()) {
    // Windows case-only rename trick
    const tempPath = oldPath + '.tmp_' + Date.now();
    fs.renameSync(oldPath, tempPath);
    fs.renameSync(tempPath, newPath);
    return true;
  }
  if (fs.existsSync(newPath)) {
    try { fs.unlinkSync(newPath); } catch (e) {}
  }
  fs.renameSync(oldPath, newPath);
  return true;
}

function organizeFolder(dir) {
  if (!fs.existsSync(dir)) return;

  const manifestPath = path.join(dir, 'audio_manifest.json');
  let manifest = null;
  if (fs.existsSync(manifestPath)) {
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) {}
  }

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.name !== 'audio_manifest.json') {
        const ext = path.extname(e.name);
        const base = path.basename(e.name, ext);

        // Check if starts with ID (e.g. 522_Dragon_Clan_Attack)
        const idMatch = base.match(/^(\d{1,4})_(.*)$/);
        let frenchBase = '';
        if (idMatch) {
          const num = idMatch[1].padStart(3, '0');
          frenchBase = `${num}_${cleanName(translateName(idMatch[2]))}`;
        } else {
          frenchBase = cleanName(translateName(base));
        }

        const targetName = `${frenchBase}${ext}`;
        const targetFull = path.join(current, targetName);

        if (full !== targetFull) {
          try {
            safeRename(full, targetFull);
          } catch (err) {
            console.warn(`Rename error on ${e.name} -> ${targetName}: ${err.message}`);
          }
        }
      }
    }
  }

  walk(dir);

  // Update manifest
  if (manifest && manifest.items) {
    for (const item of manifest.items) {
      const ext = path.extname(item.path);
      const base = path.basename(item.path, ext);
      const idMatch = base.match(/^(\d{1,4})_(.*)$/);
      let frenchBase = '';
      if (idMatch) {
        const num = idMatch[1].padStart(3, '0');
        frenchBase = `${num}_${cleanName(translateName(idMatch[2]))}`;
      } else {
        frenchBase = cleanName(translateName(base));
      }

      const dirName = path.dirname(item.path);
      item.path = `${dirName}/${frenchBase}${ext}`.replace(/\\/g, '/');
      item.vaultPath = `assets/audio/Grimoire_Audio/${item.path}`;
      item.publicPath = `/assets/audio/Grimoire_Audio/${item.path}`;
      item.title = frenchBase.replace(/^\d+_/, '').replace(/_/g, ' ');
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
}

console.log("Renommage et traduction de Grimoire_Audio...");
organizeFolder(basePublic);
organizeFolder(baseVault);
console.log("✓ Dossiers et manifestes 100% harmonisés et traduits en français !");
