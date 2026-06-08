import re

with open(r'd:\DEV\grimoire\src\components\VTTToolbar.svelte', 'r', encoding='utf-8') as f:
    content = f.read()

# Add activeMenu state
state_match = re.search(r"let ambientTextInput = \$state\('');", content)
if state_match:
    content = content.replace(
        "let ambientTextInput = $state('');",
        "let ambientTextInput = $state('');\n  let activeMenu: string | null = $state(null);"
    )

html_replacement = """<svelte:window onkeydown={handleKeydown} onclick={() => activeMenu = null} />

<div class="vtt-toolbar menubar-style" bind:this={toolbarEl}>
  <div class="menubar-items">
    
    <!-- 1. Carte & Vue -->
    <div class="menu-dropdown" class:open={activeMenu === 'map'}>
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'map' ? null : 'map'; }}>🗺️ Carte & Vue</button>
      <div class="dropdown-content" class:hidden={activeMenu !== 'map'} onclick={(e) => e.stopPropagation()}>
        {#if !vttStore.currentMap}
          <button class="dropdown-item" onclick={() => { showMapPicker = true; activeMenu = null; }}>🗺️ Charger une carte</button>
        {:else}
          <button class="dropdown-item" onclick={() => { showMapPicker = true; activeMenu = null; }}>🗺️ Changer de carte</button>
          <button class="dropdown-item" onclick={() => { closeMap(); activeMenu = null; }}>✖️ Fermer la carte</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" class:active={vttStore.mode === 'zoom-rect'} onclick={() => { vttStore.mode = 'zoom-rect'; activeMenu = null; }}>🔍 Zoomer sur une zone</button>
          <button class="dropdown-item" onclick={() => { vttStore.fitRequest++; vttStore.mode = 'select'; activeMenu = null; }}>⌂ Réinitialiser le zoom</button>
          <button class="dropdown-item" onclick={() => { undoMapAction(); activeMenu = null; }} disabled={!canUndo()}>↩️ Annuler action carte</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" onclick={() => vttStore.exportRequest++}>🖼️💾 Exporter carte en PNG</button>
        {/if}
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" class:active={vttStore.showGrid} onclick={toggleGrid}>#️⃣ Afficher/masquer grille</button>
        <div class="dropdown-submenu-item">
          <span class="grid-label">Taille grille:</span>
          <input type="number" class="grid-input" value={vttStore.gridSize} min="10" max="200" step="5" onchange={(e) => setGridSize(Number((e.target as HTMLInputElement).value))} />
        </div>
        <button class="dropdown-item blackout-item" class:active={vttStore.isBlackout} onclick={toggleBlackout}>
          {vttStore.isBlackout ? '👁️ Désactiver Écran Noir' : '🕶️ Activer Écran Noir'}
        </button>
      </div>
    </div>

    <!-- 2. Outils interactifs -->
    {#if vttStore.currentMap}
      <div class="menu-dropdown" class:open={activeMenu === 'tools'}>
        <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'tools' ? null : 'tools'; }}>🛠️ Outils</button>
        <div class="dropdown-content" class:hidden={activeMenu !== 'tools'} onclick={(e) => e.stopPropagation()}>
          <button class="dropdown-item" class:active={vttStore.mode === 'select'} onclick={() => vttStore.mode = 'select'}>👆 Sélectionner</button>
          <button class="dropdown-item" class:active={vttStore.mode === 'measure'} onclick={() => vttStore.mode = 'measure'}>📏 Mesurer distance</button>
          <button class="dropdown-item" class:active={vttStore.mode === 'ping'} onclick={() => vttStore.mode = 'ping'}>📍 Ping (Joueurs)</button>
          <button class="dropdown-item" class:active={vttStore.mode === 'pin'} onclick={() => vttStore.mode = 'pin'}>📌 Épingle Permanente</button>
          {#if vttStore.pins.length > 0}
            <button class="dropdown-item text-danger" onclick={clearGmPins}>📌🗑️ Effacer épingles</button>
          {/if}
          
          <div class="dropdown-divider"></div>
          <div class="dropdown-title">Brouillard de Guerre</div>
          <button class="dropdown-item" class:active={!vttStore.fowEnabled} onclick={toggleFow}>🌫️ {vttStore.fowEnabled ? 'Désactiver' : 'Activer'} Brouillard</button>
          {#if vttStore.fowEnabled}
            <button class="dropdown-item" class:active={vttStore.mode === 'fog-reveal'} onclick={() => vttStore.mode = 'fog-reveal'}>👁️ Révéler (Glisser)</button>
            <button class="dropdown-item" class:active={vttStore.mode === 'fog-hide'} onclick={() => vttStore.mode = 'fog-hide'}>⬛ Cacher (Glisser)</button>
            <button class="dropdown-item" class:active={vttStore.mode === 'fog-rect'} onclick={() => vttStore.mode = 'fog-rect'}>▭ Zone rectangulaire</button>
            <div class="dropdown-submenu-item tools-row">
              <button class="mini-btn text-only" onclick={revealAllGmFow}>🌅 Tout révéler</button>
              <button class="mini-btn text-only" onclick={clearGmFow}>🌑 Tout cacher</button>
            </div>
            <button class="dropdown-item" onclick={undoGmFow}>↩️ Annuler FOW</button>
          {/if}

          <div class="dropdown-divider"></div>
          <div class="dropdown-title">Dessin Libre</div>
          <button class="dropdown-item" class:active={vttStore.mode === 'draw'} onclick={() => vttStore.mode = 'draw'}>✏️ Dessiner</button>
          {#if vttStore.mode === 'draw'}
            <div class="dropdown-submenu-item tools-row">
              <input type="color" class="draw-color-input" title="Couleur" value={'#' + vttStore.drawColor.toString(16).padStart(6, '0')} oninput={(e) => { vttStore.drawColor = parseInt((e.target as HTMLInputElement).value.slice(1), 16); }} />
              <input type="range" class="draw-width-input" min="2" max="20" step="1" value={vttStore.drawWidth} oninput={(e) => { vttStore.drawWidth = Number((e.target as HTMLInputElement).value); }} />
            </div>
          {/if}
          {#if vttStore.drawPaths.length > 0}
            <button class="dropdown-item" onclick={undoDrawPath}>✏️↩️ Annuler dessin</button>
            <button class="dropdown-item text-danger" onclick={clearDrawPaths}>✏️🗑️ Effacer dessins</button>
          {/if}

          <div class="dropdown-divider"></div>
          <div class="dropdown-title">Architecture (Murs/LOS)</div>
          <button class="dropdown-item" class:active={vttStore.mode === 'blueprint'} onclick={() => vttStore.mode = 'blueprint'}>🧱 Mode Blueprint</button>
          {#if vttStore.mode === 'blueprint'}
            <div class="dropdown-submenu-item tools-row">
              <button class="mini-btn text-only" class:active={vttStore.blueprintType === 'opaque'} onclick={() => vttStore.blueprintType = 'opaque'}>🧱 Mur</button>
              <button class="mini-btn text-only" class:active={vttStore.blueprintType === 'door'} onclick={() => vttStore.blueprintType = 'door'}>🚪 Porte</button>
            </div>
          {/if}
          {#if vttStore.walls.length > 0}
            <button class="dropdown-item" onclick={undoGmWall}>🧱↩️ Annuler mur</button>
            <button class="dropdown-item text-danger" onclick={clearGmWalls}>🧱🗑️ Effacer murs</button>
          {/if}

          <div class="dropdown-divider"></div>
          <div class="dropdown-title">Sorts & Magie</div>
          <button class="dropdown-item" class:active={vttStore.mode === 'spell'} onclick={() => vttStore.mode = 'spell'}>💫 Placer un sort</button>
          {#if vttStore.mode === 'spell'}
            <div class="dropdown-submenu-item tools-row">
              {#each (['fire','ice','lightning','poison','silence','divine','darkness'] as const) as st}
                <button class="mini-btn" class:active={vttStore.spellType === st} onclick={() => vttStore.spellType = st} title={st}>{st === 'fire' ? '🔥' : st === 'ice' ? '❄️' : st === 'lightning' ? '⚡' : st === 'poison' ? '🧪' : st === 'silence' ? '🔇' : st === 'divine' ? '✨' : '🌑'}</button>
              {/each}
            </div>
            <div class="dropdown-submenu-item tools-row">
              <button class="mini-btn text-only" class:active={vttStore.spellShape === 'circle'} onclick={() => vttStore.spellShape = 'circle'}>⭕ Cercle</button>
              <button class="mini-btn text-only" class:active={vttStore.spellShape === 'cone'} onclick={() => vttStore.spellShape = 'cone'}>🔺 Cône</button>
              <button class="mini-btn text-only" class:active={vttStore.spellShape === 'line'} onclick={() => vttStore.spellShape = 'line'}>➡️ Ligne</button>
            </div>
            <div class="dropdown-submenu-item tools-row">
              {#if vttStore.spellShape === 'circle'}
                <input type="number" class="spell-radius-input" value={vttStore.spellRadius} min="20" max="400" step="10" title="Rayon (px)" onchange={(e) => vttStore.spellRadius = Number((e.target as HTMLInputElement).value)} />
              {:else if vttStore.spellShape === 'cone'}
                <input type="number" class="spell-radius-input" value={vttStore.spellRadius} min="20" max="400" step="10" title="Portée (px)" onchange={(e) => vttStore.spellRadius = Number((e.target as HTMLInputElement).value)} />
                <input type="range" class="draw-width-input" min="0" max="360" step="5" value={Math.round((vttStore.spellConeAngle ?? Math.PI/3) * 180 / Math.PI)} oninput={(e) => vttStore.spellConeAngle = Number((e.target as HTMLInputElement).value) * Math.PI / 180} title="Ouverture du cône (°)" />
                <input type="range" class="draw-width-input" min="0" max="360" step="5" value={vttStore.spellAngleDeg} oninput={(e) => { const v = Number((e.target as HTMLInputElement).value); vttStore.spellAngleDeg = v; vttStore.spellAngle = v * Math.PI / 180; }} title="Direction du cône (°)" />
              {:else if vttStore.spellShape === 'line'}
                <input type="number" class="spell-radius-input" value={vttStore.spellLength} min="50" max="800" step="25" title="Longueur (px)" onchange={(e) => vttStore.spellLength = Number((e.target as HTMLInputElement).value)} />
                <input type="range" class="draw-width-input" min="0" max="360" step="5" value={vttStore.spellAngleDeg} oninput={(e) => { const v = Number((e.target as HTMLInputElement).value); vttStore.spellAngleDeg = v; vttStore.spellAngle = v * Math.PI / 180; }} title="Direction (°)" />
              {/if}
            </div>
          {/if}
          {#if vttStore.spells.length > 0}
            <button class="dropdown-item text-danger" onclick={clearSpells}>🗑️ Effacer sorts</button>
          {/if}

          <div class="dropdown-divider"></div>
          <div class="dropdown-title">Terrain</div>
          <button class="dropdown-item" class:active={vttStore.mode === 'terrain'} onclick={() => vttStore.mode = 'terrain'}>🗺️ Dessiner terrain</button>
          {#if vttStore.mode === 'terrain'}
            <div class="dropdown-submenu-item tools-row">
              {#each ([['difficult','🏔️','Difficile'],['water','🌊','Eau'],['fire','🔥','Feu'],['poison','🧪','Poison'],['safe','✅','Sûr']] as const) as [t, icon, label]}
                <button class="mini-btn" class:active={vttStore.terrainType === t} onclick={() => vttStore.terrainType = t} title={label}>{icon}</button>
              {/each}
            </div>
          {/if}
          {#if vttStore.terrainZones.length > 0}
            <button class="dropdown-item text-danger" onclick={clearTerrainZones}>🗺️🗑️ Effacer terrains</button>
          {/if}

          <div class="dropdown-divider"></div>
          <button class="dropdown-item" onclick={() => { showTokenPicker = true; tokenPickerSearch = ''; activeMenu = null; }}>🖼️ Token image</button>
          <button class="dropdown-item" onclick={createTestToken}>👹 Token basique (test)</button>
        </div>
      </div>
    {/if}

    <!-- 3. Ambiance & Audio -->
    <div class="menu-dropdown" class:open={activeMenu === 'audio'}>
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'audio' ? null : 'audio'; }}>🎭 Ambiance</button>
      <div class="dropdown-content" class:hidden={activeMenu !== 'audio'} onclick={(e) => e.stopPropagation()}>
        <button class="dropdown-item" onclick={() => { showAudioPicker = true; activeMenu = null; }}>{vttStore.audioSrc ? '🔊 Piste 1 en cours...' : '🎵 Choisir Piste 1'}</button>
        {#if vttStore.audioSrc}
          <div class="dropdown-submenu-item">
            <input type="range" min="0" max="1" step="0.05" value={vttStore.audioVolume} oninput={(e) => setGmAudioVolume(Number((e.target as HTMLInputElement).value))} />
            <button class="btn-stop" onclick={stopAudio}>⏹️ Arrêter</button>
          </div>
        {/if}

        <button class="dropdown-item" onclick={() => { showAudio2Picker = true; activeMenu = null; }}>{vttStore.audio2Src ? '🔈 Piste 2 en cours...' : '🎶 Choisir Piste 2'}</button>
        {#if vttStore.audio2Src}
          <div class="dropdown-submenu-item">
            <input type="range" min="0" max="1" step="0.05" value={vttStore.audio2Volume} oninput={(e) => setGmAudio2Volume(Number((e.target as HTMLInputElement).value))} />
            <button class="btn-stop" onclick={stopAudio2}>⏹️ Arrêter</button>
          </div>
        {/if}

        {#if vttStore.currentMap}
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" class:active={vttStore.mode === 'audio-zone'} onclick={() => { vttStore.mode = 'audio-zone'; activeMenu = null; }}>🎶 Dessiner zone sonore locale</button>
        {/if}

        <div class="dropdown-divider"></div>
        <div class="dropdown-title">Météo</div>
        <div class="dropdown-submenu-item tools-row">
          {#each (['none','rain','snow','fog','embers'] as const) as w}
            <button class="mini-btn" class:active={vttStore.weather === w} onclick={() => setWeather(w)} title={w}>{w === 'none' ? '☀️' : w === 'rain' ? '🌧️' : w === 'snow' ? '❄️' : w === 'fog' ? '🌫️' : '🔥'}</button>
          {/each}
        </div>
        <button class="dropdown-item" onclick={sendWeatherNarrative}>🌦️ Envoyer narration météo</button>

        <div class="dropdown-divider"></div>
        <div class="dropdown-submenu-item">
          <input type="text" class="ambient-input" style="width: 100%" placeholder="Texte d'ambiance personnalisé..." bind:value={ambientTextInput} onkeydown={(e) => { if (e.key === 'Enter') { const v = ambientTextInput.trim(); if (v) { sendAmbientText(v); ambientTextInput = ''; activeMenu = null; } } }} />
        </div>
      </div>
    </div>

    <!-- 4. Joueurs & Groupe -->
    <div class="menu-dropdown" class:open={activeMenu === 'players'}>
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'players' ? null : 'players'; }}>👥 Joueurs</button>
      <div class="dropdown-content" class:hidden={activeMenu !== 'players'} onclick={(e) => e.stopPropagation()}>
        <button class="dropdown-item" onclick={() => { onTogglePlayerManager?.(); activeMenu = null; }}>📝 Gestionnaire de Groupe</button>
        <button class="dropdown-item" onclick={() => { onTogglePlayerHub?.(); activeMenu = null; }}>📱 Hub des Joueurs</button>
        <button class="dropdown-item" onclick={() => { onTogglePlayerMobileManager?.(); activeMenu = null; }}>📲 Serveur Mobile (QR)</button>
        
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" onclick={() => { showHandoutPicker = true; activeMenu = null; }}>📤 Envoyer un Handout</button>
        <button class="dropdown-item" onclick={() => { showSharedNotes = true; activeMenu = null; }}>📋 Notes Partagées</button>

        <div class="dropdown-divider"></div>
        <button class="dropdown-item" class:active={vttStore.sessionTimerStart !== null} onclick={toggleTimer}>⏱️ Session: {sessionDisplay}</button>
        
        <div class="dropdown-title">Compte à rebours</div>
        {#if vttStore.countdownEnd !== null}
          <button class="dropdown-item text-danger" onclick={stopCountdown}>⏹️ Arrêter le compte à rebours</button>
        {:else}
          <div class="dropdown-submenu-item tools-row">
            {#each [15, 30, 60] as s}
              <button class="mini-btn text-only" onclick={() => { countdownSecs = s; startCountdown(s); activeMenu = null; }}>{s}s</button>
            {/each}
            <input type="number" class="grid-input" bind:value={countdownSecs} min="5" max="600" step="5" style="width:46px"/>
            <button class="mini-btn text-only" onclick={() => { startCountdown(countdownSecs); activeMenu = null; }}>▶️</button>
          </div>
        {/if}
      </div>
    </div>

    <!-- 5. Outils du MJ -->
    <div class="menu-dropdown" class:open={activeMenu === 'gm'}>
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); activeMenu = activeMenu === 'gm' ? null : 'gm'; }}>🧙‍♂️ Outils MJ</button>
      <div class="dropdown-content" class:hidden={activeMenu !== 'gm'} onclick={(e) => e.stopPropagation()}>
        <button class="dropdown-item" onclick={() => { showNpcModal = true; activeMenu = null; }}>🧟 PNJ Rapide</button>
        <button class="dropdown-item" onclick={() => { showLootModal = true; activeMenu = null; }}>💰 Butin Rapide</button>
        
        <div class="dropdown-divider"></div>
        <div class="dropdown-title">Générateurs</div>
        <button class="dropdown-item" onclick={() => { showEncounterGen = true; activeMenu = null; }}>⚡ Rencontres</button>
        <button class="dropdown-item" onclick={() => { showRoomGen = true; activeMenu = null; }}>🏚️ Salles</button>
        <button class="dropdown-item" onclick={() => { showWeatherPlanner = true; activeMenu = null; }}>🌦️ Météo</button>
        
        <div class="dropdown-divider"></div>
        <div class="dropdown-title">Bibliothèques & Éditeurs</div>
        <button class="dropdown-item" onclick={() => { showSharedLibrary = true; activeMenu = null; }}>📚 Bibliothèque partagée</button>
        <!-- Components mounting -->
        <div style="display: flex; flex-direction: column; padding: 0 4px; gap: 2px;">
            <CharacterCreator />
            <SoundBoard />
            <MonsterLibrary />
            <AdventureLibrary />
            <SessionExport />
        </div>

        <div class="dropdown-divider"></div>
        <button class="dropdown-item" class:active={showRelationMap} onclick={() => { showRelationMap = !showRelationMap; activeMenu = null; }}>🕸️ Carte des Relations</button>
        <button class="dropdown-item" class:active={showCombatLogPanel} onclick={() => { showCombatLogPanel = !showCombatLogPanel; activeMenu = null; }}>📜 Log de Combat</button>
        <button class="dropdown-item" onclick={() => { showDamageCalc = true; activeMenu = null; }}>💥 Calculateur de Dégâts</button>
        <button class="dropdown-item" class:active={showDurationTracker} onclick={() => { showDurationTracker = !showDurationTracker; activeMenu = null; }}>⏱️ Suivi des durées</button>
      </div>
    </div>

  </div>

  <!-- Élément permanent à droite -->
  <div class="toolbar-permanent">
    <DiceRoller onRoll={handleDiceRoll} />
    <button class="btn icon-btn combat-btn ml-1" class:active={vttStore.combatActive}
      onclick={() => vttStore.combatActive ? stopCombat() : startCombat()}
      title={vttStore.combatActive ? 'Terminer le combat' : 'Démarrer le tracker de combat'}>
      ⚔️
    </button>
    <div class="separator"></div>
    <input type="text" class="campaign-title-input" placeholder="Titre de campagne…"
      value={vttStore.campaignTitle}
      oninput={(e) => setCampaignTitle((e.target as HTMLInputElement).value)}
      title="Titre affiché sur l'écran joueur" />
  </div>
</div>"""

pattern = re.compile(r'<svelte:window onkeydown=\{handleKeydown\} />.*?(?=<!-- Modals -->)', re.DOTALL)
content = pattern.sub(html_replacement + '\n\n', content)

css_replacement = """
  /* Menubar UI */
  .menubar-style {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
    padding: 0 8px;
    height: 40px;
    flex-shrink: 0;
  }

  .menubar-items {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 100%;
  }

  .menu-dropdown {
    position: relative;
    height: 100%;
    display: flex;
    align-items: center;
  }

  .menu-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .menu-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
  .menu-dropdown.open .menu-btn { background: rgba(255,255,255,0.12); color: var(--accent); }

  .dropdown-content {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 240px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 1000;
    animation: slideDown 0.1s ease-out;
  }
  .dropdown-content.hidden { display: none !important; }

  .dropdown-item {
    display: flex;
    align-items: center;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 13px;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
  }
  .dropdown-item:hover { background: var(--bg-hover); color: var(--text-primary); }
  .dropdown-item.active { background: rgba(229,168,83,0.15); color: var(--accent); }
  .dropdown-item.sub-item { padding-left: 20px; }
  .dropdown-item.text-danger:hover { background: rgba(239,68,68,0.15); color: #ef4444; }

  .dropdown-divider {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }

  .dropdown-title {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-muted);
    padding: 4px 8px;
    letter-spacing: 0.05em;
  }

  .dropdown-submenu-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
  }

  .tools-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .mini-btn {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }
  .mini-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
  .mini-btn.active { background: rgba(229,168,83,0.15); border-color: var(--accent); color: var(--accent); }
  .mini-btn.text-only { font-size: 11px; padding: 3px 8px; }

  .toolbar-permanent {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ml-1 { margin-left: 4px; }
  .ml-2 { margin-left: 8px; }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
"""

css_pattern = re.compile(r'\.vtt-toolbar \{.*?(?=\.handout-modal \{)', re.DOTALL)
content = css_pattern.sub(css_replacement + '\n', content)

# Remove .overflow-tool-btn and .overflow-grid and .tools-overflow-panel CSS to clean up
content = re.sub(r'/\* ── Overflow panel ──────────────────────────────────────────── \*/.*?</style>', '</style>', content, flags=re.DOTALL)

with open(r'd:\DEV\grimoire\src\components\VTTToolbar.svelte', 'w', encoding='utf-8') as f:
    f.write(content)
