const fs = require('fs');

let path = 'd:\\DEV\\grimoire\\src\\components\\VTTToolbar.svelte';
let content = fs.readFileSync(path, 'utf8');

// 1. Add new imports
if (!content.includes("import GMScreen")) {
  content = content.replace(
    "import SessionExport from './SessionExport.svelte';",
    `import SessionExport from './SessionExport.svelte';
  import GMScreen from './GMScreen.svelte';
  import CriticalWounds from './CriticalWounds.svelte';
  import ChaosMutations from './ChaosMutations.svelte';
  import MerchantGenerator from './MerchantGenerator.svelte';
  import RumorManager from './RumorManager.svelte';
  import { timeStore, advanceTime, formatImperialDate } from '$lib/stores/timeStore';`
  );
}

// 2. Add $state variables
if (!content.includes("let gmScreen: any = $state()")) {
  content = content.replace(
    "let sessionExport: any = $state();",
    `let sessionExport: any = $state();
  let gmScreen: any = $state();
  let critWounds: any = $state();
  let chaosMuts: any = $state();
  let merchantGen: any = $state();
  let rumorMan: any = $state();`
  );
}

// 3. Add to the dropdown menu "Outils du MJ"
// We need to inject these before the divider for generators.
const toolsSection = `        <button class="dropdown-item" onclick={() => { gmScreen?.toggle(); activeMenu = null; }}>🛡️ Écran Tactique (Dashboard)</button>
        <button class="dropdown-item" onclick={() => { critWounds?.toggle(); activeMenu = null; }}>🩸 Blessures Critiques</button>
        <button class="dropdown-item" onclick={() => { chaosMuts?.toggle(); activeMenu = null; }}>🌑 Mutations du Chaos</button>
        <button class="dropdown-item" onclick={() => { merchantGen?.toggle(); activeMenu = null; }}>🛍️ Marchand Générateur</button>
        <button class="dropdown-item" onclick={() => { rumorMan?.toggle(); activeMenu = null; }}>🎭 Système de Murmures</button>`;

if (!content.includes("🛡️ Écran Tactique")) {
  content = content.replace(
    "<button class=\"dropdown-item\" onclick={() => { showNpcModal = true; activeMenu = null; }}>🧟 PNJ Rapide</button>",
    `${toolsSection}\n        <div class="dropdown-divider"></div>\n        <button class="dropdown-item" onclick={() => { showNpcModal = true; activeMenu = null; }}>🧟 PNJ Rapide</button>`
  );
}

// 4. Add the TimeStore UI in the permanent toolbar
const timeUI = `<div class="separator"></div>
    <div class="time-widget" style="display:flex; align-items:center; gap:4px; font-size:11px; background:var(--bg-secondary); padding:2px 8px; border-radius:4px; border:1px solid var(--border);">
      <span style="color:var(--text-secondary)">🕒 {$timeStore ? formatImperialDate($timeStore) : ''}</span>
      <button class="mini-btn text-only" onclick={() => advanceTime(1)} title="+1 Heure">+1h</button>
      <button class="mini-btn text-only" onclick={() => advanceTime(24)} title="+1 Jour">+1j</button>
    </div>`;

if (!content.includes("time-widget")) {
  content = content.replace(
    "<div class=\"separator\"></div>\n    <input type=\"text\" class=\"campaign-title-input\"",
    `${timeUI}\n    <div class="separator"></div>\n    <input type="text" class="campaign-title-input"`
  );
}

// 5. Add to hidden-toggles
const newHidden = `  <GMScreen bind:this={gmScreen} />
  <CriticalWounds bind:this={critWounds} />
  <ChaosMutations bind:this={chaosMuts} />
  <MerchantGenerator bind:this={merchantGen} />
  <RumorManager bind:this={rumorMan} />`;

if (!content.includes("<GMScreen bind:this={gmScreen} />")) {
  content = content.replace(
    "<SessionExport bind:this={sessionExport} />\n</div>",
    `<SessionExport bind:this={sessionExport} />\n${newHidden}\n</div>`
  );
}

fs.writeFileSync(path, content, 'utf8');
console.log('VTTToolbar updated');
