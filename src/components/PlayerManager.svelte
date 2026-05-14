<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { listen } from '@tauri-apps/api/event';
  import { 
    getPlayerConnections, broadcastToPlayers, 
    applyDamageToPlayer, type PlayerInfo,
    readFile, writeFile, type VaultEntry,
    assignCharacter, applyConditionToPlayer, removeConditionFromPlayer
  } from '$lib/api';
  import { getVaultPath, getVaultTree } from '$lib/stores/vault.svelte';
  import { vttStore } from '$lib/stores/vtt.svelte';

  let visible = $state(false);
  let activeTab = $state<'party' | 'library' | 'inventory' | 'notes' | 'ai'>('party');
  let players = $state<PlayerInfo[]>([]);
  let characters = $state<{ path: string; name: string; data: any }[]>([]);
  let selectedChar = $state<{ path: string; name: string; data: any } | null>(null);
  let searchQuery = $state('');
  let isLoading = $state(false);

  // Group Inventory
  let inventory = $state<{ name: string; qty: number; notes: string }[]>([]);
  let showAddItem = $state(false);
  let newItem = $state({ name: '', qty: 1, notes: '' });

  // Session Notes
  let sessionNotes = $state('');
  let lastPushedNote = $state('');

  // AI Assistant (GM side)
  let aiMessages = $state<{ role: 'user' | 'assistant'; content: string }[]>([]);
  let aiInput = $state('');
  let aiMjMode = $state(false);
  let aiTtsMode = $state(false);
  let isAiLoading = $state(false);

  export function toggle() { 
    visible = !visible; 
    if (visible) {
      refreshData();
      loadInventory();
    }
  }

  onMount(() => {
    const unlistenUpdate = listen('player_character_update', (event: any) => {
      const { id, character, path } = event.payload;
      if (path) {
        autoSaveCharacter(path, character);
      }
      refreshData();
    });

    const unlistenJournal = listen('player_journal_push', async (event: any) => {
      const { name, entry } = event.payload;
      const vp = getVaultPath();
      if (!vp) return;
      
      const date = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
      const filename = `Journal/Journal_${date}.md`;
      const content = `\n\n### Note de ${name} (${new Date().toLocaleTimeString()})\n${entry.text}\n`;
      
      try {
        let existing = '';
        try { existing = await readFile(vp, filename); } catch(e) {
          // Si le dossier n'existe pas, on le crée
          await createDirectory(vp, 'Journal').catch(() => {});
        }
        await writeFile(vp, filename, existing + content);
        console.log("Journal updated by player", name);
      } catch(err) {
        console.error("Failed to update journal from player push", err);
      }
    });

    return () => {
      unlistenUpdate.then(u => u());
      unlistenJournal.then(u => u());
    };
  });

  async function refreshData() {
    isLoading = true;
    try {
      players = await getPlayerConnections();
      await scanVaultForCharacters();
    } finally {
      isLoading = false;
    }
  }

  async function loadInventory() {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      const raw = await readFile(vp, '.grimoire/party_inventory.json');
      inventory = JSON.parse(raw);
    } catch {
      inventory = [];
    }
  }

  async function saveInventory() {
    const vp = getVaultPath();
    if (!vp) return;
    await writeFile(vp, '.grimoire/party_inventory.json', JSON.stringify(inventory, null, 2));
  }

  async function scanVaultForCharacters() {
    const vaultPath = getVaultPath();
    const tree = getVaultTree();
    if (!vaultPath || !tree) return;

    const found: { path: string; name: string; data: any }[] = [];
    
    async function walk(entries: VaultEntry[], parent = '') {
      for (const e of entries) {
        if (e.is_dir && e.children) {
          await walk(e.children, parent + e.name + '/');
        } else if (e.extension === 'md') {
          const relPath = parent + e.name;
          if (relPath.toLowerCase().includes('personnages') || relPath.toLowerCase().includes('characters')) {
             try {
               const content = await readFile(vaultPath, relPath);
               const data = parseCharacterMd(content);
               found.push({ path: relPath, name: e.name.replace('.md', ''), data });
             } catch(err) {
               console.warn(`Failed to parse ${relPath}`, err);
             }
          }
        }
      }
    }

    await walk(tree);
    characters = found;
  }

  function parseCharacterMd(content: string) {
    const data: any = { hp: 10, maxhp: 10, stats: {}, race: '', voc: '' };
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const fm = fmMatch[1];
      fm.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) return;
        const k = line.slice(0, colonIndex).trim();
        const v = line.slice(colonIndex + 1).trim();
        if (k === 'hp' || k === 'bless') data.hp = parseInt(v);
        if (k === 'maxhp') data.maxhp = parseInt(v);
        if (k === 'race') data.race = v;
        if (k === 'class' || k === 'voc') data.voc = v;
        if (k === 'nom' || k === 'name') data.nom = v;
      });
    }
    if (!data.nom) {
      const h1Match = content.match(/^#\s+(.*)/m);
      if (h1Match) data.nom = h1Match[1].trim();
    }
    return data;
  }

  async function autoSaveCharacter(path: string, character: any) {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      const content = await readFile(vp, path);
      const updated = serializeCharacterMd(content, character);
      await writeFile(vp, path, updated);
      console.log(`Auto-saved character to ${path}`);
    } catch(err) {
      console.error(`Failed to auto-save to ${path}`, err);
    }
  }

  function serializeCharacterMd(oldContent: string, data: any): string {
    // Simple serialization: update frontmatter values
    let fm = '';
    const fmMatch = oldContent.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      fm = fmMatch[1];
      const lines = fm.split('\n');
      const newLines = lines.map(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) return line;
        const k = line.slice(0, colonIndex).trim();
        if (k === 'hp' || k === 'bless') return `${k}: ${data.hp ?? data.bless ?? 10}`;
        if (k === 'maxhp') return `${k}: ${data.maxhp ?? data.profil?.act?.b ?? 10}`;
        if (k === 'xp') return `${k}: ${data.xp || 0}`;
        return line;
      });
      return `---\n${newLines.join('\n')}\n---${oldContent.slice(fmMatch[0].length)}`;
    }
    // If no frontmatter, prepend basic one
    const basicFm = `---\nnom: ${data.nom}\nhp: ${data.hp}\nmaxhp: ${data.maxhp}\n---`;
    return `${basicFm}\n\n${oldContent}`;
  }

  async function handleAssign(playerId: string, char: any) {
    try {
      const charObj = {
        ...char.data,
        nom: char.data.nom || char.name,
        profil: char.data.profil || { act: { b: char.data.maxhp || 10 } },
        bless: char.data.hp || char.data.bless || 10
      };
      await assignCharacter(playerId, char.path, charObj);
      refreshData();
      activeTab = 'party';
    } catch(err) {
      console.error(err);
    }
  }

  async function handlePushNote() {
    if (!sessionNotes.trim()) return;
    await broadcastToPlayers('handout', { 
      title: 'Note du MJ',
      text: sessionNotes,
      type: 'text'
    });
    lastPushedNote = sessionNotes;
    sessionNotes = '';
  }

  function addItem() {
    if (!newItem.name) return;
    inventory = [...inventory, { ...newItem }];
    newItem = { name: '', qty: 1, notes: '' };
    showAddItem = false;
    saveInventory();
  }

  function removeItem(index: number) {
    inventory = inventory.filter((_, i) => i !== index);
    saveInventory();
  }

  const filteredLibrary = $derived(
    characters.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  function getHpPct(p: PlayerInfo) {
    if (!p.character) return 0;
    const hp = p.character.hp ?? p.character.bless ?? 0;
    const max = p.character.maxhp ?? (parseInt(p.character.profil?.act?.b) || 10);
    return Math.min(100, (hp / max) * 100);
  }

  const WFRP_CONDITIONS = [
    { id: 'sanglant', name: 'Sanglant', icon: '🩸', desc: 'Prend des dégâts au début de chaque tour.' },
    { id: 'etourdi', name: 'Étourdi', icon: '💫', desc: 'Ne peut pas agir ce tour.' },
    { id: 'fatigue', name: 'Fatigué', icon: '😴', desc: 'Malus de -10 à tous les tests.' },
    { id: 'prone', name: 'À terre', icon: '⬇️', desc: 'Cible facile au corps-à-corps.' },
    { id: 'effraye', name: 'Effrayé', icon: '😱', desc: 'Doit s\'éloigner de la source.' }
  ];

  async function toggleCondition(playerId: string, current: string[], condition: string) {
    if (current.includes(condition)) {
      await removeConditionFromPlayer(playerId, condition);
    } else {
      await applyConditionToPlayer(playerId, condition);
    }
    refreshData();
  }

  async function pushMapToPlayers() {
    if (!vttStore.currentMap) return;
    try {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const { pushMapSnapshot } = await import('$lib/api');
        await pushMapSnapshot(dataUrl);
        statusMessage = "Carte poussée aux joueurs !";
        setTimeout(() => statusMessage = "", 3000);
      }
    } catch (err) {
      console.error("Failed to push map", err);
    }
  }

  async function handleAskAi() {
    if (!aiInput.trim() || isAiLoading) return;
    
    const prompt = aiInput;
    aiMessages = [...aiMessages, { role: 'user', content: prompt }];
    aiInput = '';
    isAiLoading = true;

    const sys = aiMjMode 
      ? "Tu es le Maître du Jeu (MJ) de Warhammer Fantasy. Tu es sombre, descriptif et impitoyable. Réponds toujours en français."
      : "Tu es un assistant expert en règles WFRP. Réponds de manière concise.";
    
    try {
      const { askOllama } = await import('$lib/api');
      const response = await askOllama(prompt, 'llama3', sys);
      aiMessages = [...aiMessages, { role: 'assistant', content: response }];
      
      if (aiTtsMode) {
        speakText(response);
      }
      
      // Scroll to bottom
      setTimeout(() => {
        const chat = document.getElementById('gm-ai-chat');
        if (chat) chat.scrollTop = chat.scrollHeight;
      }, 50);
    } catch (err) {
      aiMessages = [...aiMessages, { role: 'assistant', content: `Erreur: ${err}` }];
    } finally {
      isAiLoading = false;
    }
  }

  function speakText(text: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = 'fr-FR';
    window.speechSynthesis.speak(ut);
  }

  let statusMessage = $state("");
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="pm-backdrop" onclick={() => visible = false} transition:fade={{ duration: 200 }}>
    <div class="pm-window" onclick={e => e.stopPropagation()} transition:scale={{ duration: 300, start: 0.95, opacity: 0 }}>
      
      <header class="pm-header">
        <div class="pm-title">
          <span class="pm-icon">👥</span>
          <h1>Gestionnaire de Groupe</h1>
        </div>
        
        <nav class="pm-tabs">
          <button class:active={activeTab === 'party'} onclick={() => activeTab = 'party'}>🛡️ Groupe</button>
          <button class:active={activeTab === 'library'} onclick={() => activeTab = 'library'}>📚 Fiches</button>
          <button class:active={activeTab === 'inventory'} onclick={() => activeTab = 'inventory'}>🎒 Inventaire</button>
          <button class:active={activeTab === 'notes'} onclick={() => activeTab = 'notes'}>📝 Notes</button>
          <button class:active={activeTab === 'ai'} onclick={() => activeTab = 'ai'}>🤖 IA MJ</button>
        </nav>

        <div class="pm-header-actions">
          <button class="btn-push-map" onclick={pushMapToPlayers} title="Pousser la carte aux mobiles">🗺️ Pousser Carte</button>
          <button class="btn-refresh" onclick={refreshData} disabled={isLoading} title="Actualiser"><span class:spinning={isLoading}>🔄</span></button>
          <button class="btn-close" onclick={() => visible = false}>✕</button>
        </div>
      </header>

      {#if statusMessage}
        <div class="pm-status-bar" transition:fly={{ y: -20 }}>{statusMessage}</div>
      {/if}

      <main class="pm-content">
        {#if activeTab === 'party'}
          <section class="party-view" in:fade>
            <div class="party-grid">
              {#each players as p (p.id)}
                <div class="player-card">
                  <div class="player-header">
                    <div class="avatar" style="background-color: hsl({(p.name.length * 65) % 360}, 60%, 45%)">{p.name.charAt(0)}</div>
                    <div class="info">
                      <span class="name">{p.name}</span>
                      <span class="status"><span class="dot"></span> {p.character_path ? 'Synchronisé' : 'Connecté'}</span>
                    </div>
                  </div>

                  {#if p.character}
                    <div class="char-box">
                      <div class="char-header">
                        <span class="char-name">{p.character.nom || 'Sans nom'}</span>
                        <span class="char-path">{p.character_path || ''}</span>
                      </div>
                      <div class="hp-row">
                        <div class="hp-bar-bg"><div class="hp-fill" style="width: {getHpPct(p)}%"></div></div>
                        <span class="hp-txt">{p.character.hp ?? p.character.bless ?? 0}/{p.character.maxhp ?? p.character.profil?.act?.b ?? 10}</span>
                      </div>
                      <div class="cond-row">
                        {#each p.conditions as c}
                          <span class="cond-tag">{c} <button onclick={() => removeConditionFromPlayer(p.id, c)}>✕</button></span>
                        {/each}
                      </div>

                      <div class="cond-selector">
                        {#each WFRP_CONDITIONS as cond}
                          <button 
                            class="btn-cond-add" 
                            class:active={p.conditions.includes(cond.name)}
                            onclick={() => toggleCondition(p.id, p.conditions, cond.name)}
                            title={cond.desc}
                          >
                            {cond.icon}
                          </button>
                        {/each}
                      </div>
                    </div>
                  {:else}
                    <div class="empty-char">En attente de fiche...</div>
                  {/if}
                </div>
              {/each}
            </div>
          </section>

        {:else if activeTab === 'library'}
          <section class="library-view" in:fade>
            <div class="lib-sidebar">
              <input type="text" placeholder="Chercher..." bind:value={searchQuery} class="lib-search" />
              <div class="lib-list">
                {#each filteredLibrary as char}
                  <button class="lib-item" class:selected={selectedChar?.path === char.path} onclick={() => selectedChar = char}>
                    <span class="icon">📜</span>
                    <span class="name">{char.name}</span>
                  </button>
                {/each}
              </div>
            </div>
            <div class="lib-details">
              {#if selectedChar}
                <div class="details-card">
                  <h2>{selectedChar.data.nom || selectedChar.name}</h2>
                  <div class="details-stats">
                    <div class="detail-stat"><label>PV</label><span>{selectedChar.data.hp} / {selectedChar.data.maxhp}</span></div>
                    <div class="detail-stat"><label>Race</label><span>{selectedChar.data.race}</span></div>
                    <div class="detail-stat"><label>Classe</label><span>{selectedChar.data.voc}</span></div>
                  </div>
                  <h3>Assigner à :</h3>
                  <div class="assign-list">
                    {#each players as p}
                      <button class="btn-assign" onclick={() => handleAssign(p.id, selectedChar)}>Assigner à {p.name}</button>
                    {/each}
                  </div>
                </div>
              {:else}
                <div class="details-empty">Sélectionnez une fiche pour l'assigner</div>
              {/if}
            </div>
          </section>

        {:else if activeTab === 'inventory'}
          <section class="inventory-view" in:fade>
            <div class="inv-header">
              <h2>🎒 Inventaire de Groupe</h2>
              <button class="btn-add" onclick={() => showAddItem = true}>+ Ajouter Objet</button>
            </div>
            
            <table class="inv-table">
              <thead><tr><th>Quantité</th><th>Nom</th><th>Notes</th><th>Actions</th></tr></thead>
              <tbody>
                {#each inventory as item, i}
                  <tr>
                    <td><input type="number" bind:value={item.qty} onchange={saveInventory} /></td>
                    <td><input type="text" bind:value={item.name} onchange={saveInventory} /></td>
                    <td><input type="text" bind:value={item.notes} onchange={saveInventory} placeholder="—" /></td>
                    <td><button class="btn-del" onclick={() => removeItem(i)}>✕</button></td>
                  </tr>
                {/each}
              </tbody>
            </table>

            {#if showAddItem}
              <div class="add-modal" transition:fade>
                <div class="modal-box">
                  <h3>Nouveau butin</h3>
                  <input type="text" placeholder="Nom de l'objet" bind:value={newItem.name} />
                  <input type="number" placeholder="Quantité" bind:value={newItem.qty} />
                  <textarea placeholder="Notes (facultatif)" bind:value={newItem.notes}></textarea>
                  <div class="modal-btns">
                    <button class="btn-cancel" onclick={() => showAddItem = false}>Annuler</button>
                    <button class="btn-ok" onclick={addItem}>Ajouter</button>
                  </div>
                </div>
              </div>
            {/if}
          </section>

        {:else if activeTab === 'notes'}
          <section class="notes-view" in:fade>
            <div class="notes-editor">
              <h2>📝 Note de Session</h2>
              <p class="hint">Ces notes sont envoyées instantanément sur les mobiles des joueurs.</p>
              <textarea placeholder="Écrivez quelque chose d'important..." bind:value={sessionNotes}></textarea>
              <button class="btn-push" onclick={handlePushNote} disabled={!sessionNotes.trim()}>Pousser aux Joueurs 🚀</button>
            </div>
            
            {#if lastPushedNote}
              <div class="last-note" transition:fly={{ y: 20 }}>
                <label>Dernière note envoyée :</label>
                <div class="note-content">{lastPushedNote}</div>
              </div>
            {/if}
          </section>

        {:else if activeTab === 'ai'}
          <section class="ai-view" in:fade>
            <div class="ai-controls">
              <div class="ai-toggles">
                <label class="toggle-btn" class:active={aiMjMode}>
                  <input type="checkbox" bind:checked={aiMjMode} /> 🎭 Mode MJ Expert
                </label>
                <label class="toggle-btn" class:active={aiTtsMode}>
                  <input type="checkbox" bind:checked={aiTtsMode} /> 🔊 Parole (Audio)
                </label>
                <button class="btn-stop-audio" onclick={() => window.speechSynthesis.cancel()}>Arrêter Audio</button>
              </div>
              <p class="hint">Posez une question sur les règles ou demandez une description immersive.</p>
            </div>

            <div class="ai-chat-window" id="gm-ai-chat">
              {#each aiMessages as msg}
                <div class="ai-bubble {msg.role}">
                  <span class="bubble-role">{msg.role === 'user' ? 'Vous' : 'Grimoire'}</span>
                  <div class="bubble-content">{msg.content}</div>
                </div>
              {/each}
              {#if isAiLoading}
                <div class="ai-bubble assistant loading">
                  <div class="typing-dots"><span>.</span><span>.</span><span>.</span></div>
                </div>
              {/if}
            </div>

            <div class="ai-input-row">
              <input 
                type="text" 
                placeholder="Décris-moi un combat épique dans la boue..." 
                bind:value={aiInput}
                onkeydown={e => e.key === 'Enter' && handleAskAi()}
              />
              <button class="btn-ask" onclick={handleAskAi} disabled={isAiLoading || !aiInput.trim()}>➤</button>
            </div>
          </section>
        {/if}
      </main>
    </div>
  </div>
{/if}

<style>
  .pm-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); z-index: 9500; display: flex; align-items: center; justify-content: center; padding: 40px; }
  .pm-window { background: #0d1117; border: 1px solid #30363d; border-radius: 20px; width: 1000px; height: 700px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 32px 128px rgba(0,0,0,0.6); }
  .pm-header { padding: 20px 32px; display: flex; align-items: center; gap: 32px; border-bottom: 1px solid #30363d; background: #161b22; }
  .pm-title { display: flex; align-items: center; gap: 12px; }
  .pm-title h1 { font-size: 18px; color: white; margin: 0; font-weight: 800; }
  .pm-tabs { display: flex; background: #010409; padding: 4px; border-radius: 12px; gap: 4px; }
  .pm-tabs button { padding: 6px 16px; border-radius: 8px; border: none; background: transparent; color: #8b949e; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .pm-tabs button.active { background: #21262d; color: #e5a853; }
  .pm-header-actions { margin-left: auto; display: flex; gap: 8px; }
  .btn-refresh, .btn-close { background: transparent; border: none; color: #8b949e; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  .btn-refresh:hover, .btn-close:hover { background: #30363d; color: white; }
  .spinning { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .pm-status-bar { background: #e5a853; color: black; padding: 4px 12px; font-size: 11px; font-weight: 700; text-align: center; }

  .btn-push-map { background: rgba(229, 168, 83, 0.15); border: 1px solid #e5a853; color: #e5a853; padding: 4px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
  .btn-push-map:hover { background: #e5a853; color: black; }

  .pm-content { flex: 1; overflow: hidden; background: #0d1117; }

  /* Party View */
  .party-view { padding: 32px; height: 100%; overflow-y: auto; }
  .party-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
  .player-card { background: #161b22; border: 1px solid #30363d; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
  .player-header { display: flex; align-items: center; gap: 12px; }
  .avatar { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 18px; }
  .name { font-weight: 700; color: white; }
  .status { font-size: 10px; color: #3fb950; display: flex; align-items: center; gap: 5px; }
  .dot { width: 6px; height: 6px; background: #3fb950; border-radius: 50%; }

  .char-box { background: rgba(0,0,0,0.2); border-radius: 12px; padding: 12px; border: 1px solid rgba(255,255,255,0.05); }
  .char-header { display: flex; flex-direction: column; margin-bottom: 8px; }
  .char-name { font-weight: 800; color: #e5a853; font-size: 14px; }
  .char-path { font-size: 9px; color: #484f58; font-family: monospace; }
  .hp-row { display: flex; align-items: center; gap: 10px; }
  .hp-bar-bg { flex: 1; height: 6px; background: #21262d; border-radius: 3px; overflow: hidden; }
  .hp-fill { height: 100%; background: #f85149; transition: width 0.3s; }
  .hp-txt { font-size: 11px; font-family: monospace; color: #8b949e; }
  .cond-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .cond-tag { font-size: 9px; padding: 2px 6px; background: #2b2118; color: #e5a853; border-radius: 4px; text-transform: uppercase; display: flex; align-items: center; gap: 4px; }
  .cond-tag button { background: transparent; border: none; color: #f85149; cursor: pointer; font-size: 10px; padding: 0 2px; }
  .cond-selector { display: flex; gap: 4px; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); }
  .btn-cond-add { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; font-size: 14px; }
  .btn-cond-add:hover { border-color: #e5a853; transform: scale(1.1); }
  .btn-cond-add.active { background: rgba(229,168,83,0.15); border-color: #e5a853; }

  /* Library View */
  .library-view { display: grid; grid-template-columns: 280px 1fr; height: 100%; }
  .lib-sidebar { border-right: 1px solid #30363d; display: flex; flex-direction: column; background: #010409; }
  .lib-search { margin: 16px; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 8px 12px; color: white; outline: none; }
  .lib-list { flex: 1; overflow-y: auto; padding: 8px; }
  .lib-item { width: 100%; text-align: left; background: transparent; border: none; padding: 10px; border-radius: 8px; color: #8b949e; cursor: pointer; display: flex; gap: 10px; }
  .lib-item:hover { background: #161b22; color: white; }
  .lib-item.selected { background: rgba(229,168,83,0.1); color: #e5a853; }
  .lib-details { padding: 40px; }
  .details-card h2 { font-size: 24px; margin-bottom: 24px; color: white; }
  .details-stats { display: flex; gap: 24px; margin-bottom: 32px; }
  .detail-stat { display: flex; flex-direction: column; }
  .detail-stat label { font-size: 10px; color: #8b949e; text-transform: uppercase; }
  .detail-stat span { font-size: 16px; font-weight: 700; color: white; }
  .btn-assign { width: 100%; text-align: left; padding: 12px; background: #161b22; border: 1px solid #30363d; border-radius: 10px; color: white; cursor: pointer; margin-bottom: 8px; }
  .btn-assign:hover { border-color: #e5a853; }

  /* Inventory View */
  .inventory-view { padding: 32px; height: 100%; overflow-y: auto; }
  .inv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .inv-header h2 { font-size: 20px; color: white; }
  .btn-add { background: #238636; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; }
  .inv-table { width: 100%; border-collapse: collapse; }
  .inv-table th { text-align: left; font-size: 11px; text-transform: uppercase; color: #8b949e; padding: 12px; border-bottom: 1px solid #30363d; }
  .inv-table td { padding: 8px; border-bottom: 1px solid #0d1117; }
  .inv-table input { background: transparent; border: 1px solid transparent; color: white; padding: 4px 8px; width: 100%; border-radius: 4px; }
  .inv-table input:focus { border-color: #30363d; background: #161b22; }
  .btn-del { background: transparent; border: none; color: #f85149; cursor: pointer; font-size: 16px; }

  /* Notes View */
  .notes-view { padding: 32px; display: flex; flex-direction: column; gap: 32px; height: 100%; }
  .notes-editor { display: flex; flex-direction: column; gap: 12px; }
  .notes-editor h2 { font-size: 20px; color: white; }
  .notes-editor textarea { height: 200px; background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 16px; color: white; font-family: inherit; resize: none; font-size: 15px; }
  .btn-push { background: #e5a853; color: black; border: none; padding: 12px; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 15px; }
  .btn-push:disabled { opacity: 0.5; cursor: not-allowed; }
  .last-note { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 20px; }
  .last-note label { font-size: 11px; color: #8b949e; text-transform: uppercase; display: block; margin-bottom: 8px; }
  .note-content { color: white; white-space: pre-wrap; line-height: 1.5; font-size: 14px; }

  /* Modals */
  .add-modal { position: absolute; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; }
  .modal-box { background: #161b22; border: 1px solid #30363d; border-radius: 20px; padding: 24px; width: 360px; display: flex; flex-direction: column; gap: 16px; }
  .modal-box h3 { color: white; margin: 0; }
  .modal-box input, .modal-box textarea { background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 10px; color: white; }
  .modal-btns { display: flex; gap: 10px; }
  .modal-btns button { flex: 1; padding: 10px; border-radius: 8px; border: none; cursor: pointer; font-weight: 700; }
  .btn-cancel { background: #30363d; color: white; }
  .btn-ok { background: #e5a853; color: black; }

  /* AI View */
  .ai-view { padding: 32px; display: flex; flex-direction: column; height: 100%; gap: 16px; }
  .ai-controls { display: flex; flex-direction: column; gap: 8px; }
  .ai-toggles { display: flex; gap: 12px; align-items: center; }
  .toggle-btn { background: #161b22; border: 1px solid #30363d; padding: 6px 12px; border-radius: 8px; font-size: 11px; color: #8b949e; cursor: pointer; display: flex; align-items: center; gap: 6px; }
  .toggle-btn.active { border-color: #e5a853; color: #e5a853; background: rgba(229,168,83,0.1); }
  .toggle-btn input { display: none; }
  .btn-stop-audio { margin-left: auto; background: transparent; border: 1px solid #f85149; color: #f85149; font-size: 10px; padding: 4px 10px; border-radius: 6px; cursor: pointer; }
  
  .ai-chat-window { flex: 1; background: #010409; border: 1px solid #30363d; border-radius: 12px; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
  .ai-bubble { max-width: 80%; padding: 12px 16px; border-radius: 14px; position: relative; }
  .ai-bubble.user { align-self: flex-end; background: #238636; color: white; border-bottom-right-radius: 2px; }
  .ai-bubble.assistant { align-self: flex-start; background: #161b22; color: #e5a853; border: 1px solid #e5a853; border-bottom-left-radius: 2px; }
  .bubble-role { font-size: 9px; text-transform: uppercase; opacity: 0.7; margin-bottom: 4px; display: block; }
  .bubble-content { font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
  
  .ai-input-row { display: flex; gap: 12px; padding-top: 8px; }
  .ai-input-row input { flex: 1; background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 12px 16px; color: white; font-size: 14px; outline: none; }
  .ai-input-row input:focus { border-color: #e5a853; }
  .btn-ask { background: #e5a853; color: black; border: none; width: 44px; height: 44px; border-radius: 12px; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .btn-ask:disabled { opacity: 0.5; }
  
  .typing-dots span { animation: typing 1s infinite; margin: 0 2px; }
  .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
  .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typing { 0% { opacity: 0.2; } 50% { opacity: 1; } 100% { opacity: 0.2; } }
</style>
