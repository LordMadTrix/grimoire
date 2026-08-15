<script lang="ts">
  import { vttStore } from '$lib/stores/vtt.svelte';
  import { timeStore, formatImperialDate } from '$lib/stores/timeStore';
  import { getVaultPath } from '$lib/stores/vault.svelte';
  import { readFile, writeFile, broadcastToPlayers } from '$lib/api';
  import { notifStore } from '$lib/stores/notifications.svelte';

  let { onclose }: { onclose: () => void } = $props();

  export interface QuestStage {
    text: string;
    done: boolean;
  }

  export interface Quest {
    id: string;
    title: string;
    category: 'main' | 'side' | 'rumor' | 'secret';
    status: 'active' | 'completed' | 'failed';
    giver: string;
    location: string;
    dateAssigned: string;
    rewardXp: number;
    rewardGold: string;
    stages: QuestStage[];
    notes: string;
  }

  let quests = $state<Quest[]>([]);
  let filterCategory = $state<'all' | 'main' | 'side' | 'rumor' | 'secret'>('all');
  let filterStatus = $state<'all' | 'active' | 'completed' | 'failed'>('all');
  let selectedQuestId = $state<string | null>(null);

  // Formulaire d'édition / création
  let editMode = $state(false);
  let editQuest = $state<Quest | null>(null);
  let newStageText = $state('');

  const QUEST_FILE = '.grimoire/quests.json';

  async function loadQuests() {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      const raw = await readFile(vp, QUEST_FILE);
      quests = JSON.parse(raw) ?? [];
    } catch {
      quests = [
        {
          id: 'q_intro_1',
          title: 'L\'Héritage Maudit des von Saponatheim',
          category: 'main',
          status: 'active',
          giver: 'Baron von Saponatheim',
          location: 'Bögenhafen',
          dateAssigned: '1 Jahrdrung 2512',
          rewardXp: 150,
          rewardGold: '25 Couronnes d\'Or',
          stages: [
            { text: 'Interroger l\'aubergiste du Cochon Noyé', done: true },
            { text: 'Explorer les souterrains sous la brasserie', done: false },
            { text: 'Récupérer le médaillon frappé du sceau pourpre', done: false }
          ],
          notes: 'Attention aux spadassins surveillant l\'entrepôt 4.'
        },
        {
          id: 'q_side_2',
          title: 'Rumeurs dans les égouts',
          category: 'rumor',
          status: 'active',
          giver: 'Klaus le Chasseur de rats',
          location: 'Altdorf',
          dateAssigned: '3 Jahrdrung 2512',
          rewardXp: 50,
          rewardGold: '5 Phellings',
          stages: [
            { text: 'Trouver la grille marquée d\'un triangle inversé', done: false }
          ],
          notes: 'Klaus prétend avoir aperçu des silhouettes de taille humaine couvertes de fourrure.'
        }
      ];
    }
  }

  async function saveQuests() {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      await writeFile(vp, QUEST_FILE, JSON.stringify(quests, null, 2));
    } catch (err) {
      console.error('Failed to save quests:', err);
    }
  }

  $effect(() => {
    loadQuests();
  });

  let filteredQuests = $derived(
    quests.filter(q => {
      const matchCat = filterCategory === 'all' || q.category === filterCategory;
      const matchStat = filterStatus === 'all' || q.status === filterStatus;
      return matchCat && matchStat;
    })
  );

  let activeQuest = $derived(
    quests.find(q => q.id === selectedQuestId) || filteredQuests[0] || null
  );

  function createNewQuest() {
    const newQ: Quest = {
      id: `quest_${Date.now()}`,
      title: 'Nouvelle Quête',
      category: 'side',
      status: 'active',
      giver: '',
      location: '',
      dateAssigned: $timeStore ? formatImperialDate($timeStore) : 'Aujourd\'hui',
      rewardXp: 50,
      rewardGold: '5 CO',
      stages: [{ text: 'Première étape', done: false }],
      notes: ''
    };
    quests.unshift(newQ);
    selectedQuestId = newQ.id;
    editQuest = { ...newQ, stages: [...newQ.stages] };
    editMode = true;
  }

  function startEdit(q: Quest) {
    editQuest = JSON.parse(JSON.stringify(q));
    editMode = true;
  }

  function saveEdit() {
    if (!editQuest) return;
    const idx = quests.findIndex(q => q.id === editQuest!.id);
    if (idx !== -1) {
      quests[idx] = editQuest;
    } else {
      quests.unshift(editQuest);
    }
    quests = [...quests];
    saveQuests();
    editMode = false;
    notifStore.add('success', 'Quête enregistrée', editQuest.title);
  }

  function deleteQuest(id: string) {
    quests = quests.filter(q => q.id !== id);
    if (selectedQuestId === id) selectedQuestId = null;
    saveQuests();
  }

  function addStage() {
    if (!editQuest || !newStageText.trim()) return;
    editQuest.stages.push({ text: newStageText.trim(), done: false });
    newStageText = '';
  }

  function removeStage(index: number) {
    if (!editQuest) return;
    editQuest.stages.splice(index, 1);
  }

  function toggleStageLive(q: Quest, sIdx: number) {
    q.stages[sIdx].done = !q.stages[sIdx].done;
    quests = [...quests];
    saveQuests();
  }

  function generateSessionSummary() {
    const imperialDate = $timeStore ? formatImperialDate($timeStore) : 'Date Impériale';
    const activeList = quests.filter(q => q.status === 'active');
    const compList = quests.filter(q => q.status === 'completed');

    const md = `# 📜 Chronique de Session — ${imperialDate}

**Lieu actif** : ${vttStore.currentMapRelPath || 'Vieux Monde'}  
**Météo & Ambiance** : ${vttStore.weather} (${vttStore.ambientLight})  
**Rounds de combat disputés** : ${vttStore.combatRound}

---

### 🏆 Quêtes Accomplies
${compList.length > 0 ? compList.map(q => `- **${q.title}** (${q.location}) — *Récompense : ${q.rewardXp} XP, ${q.rewardGold}*`).join('\n') : '*Aucune quête terminée lors de cette session.*'}

### 🎯 Objectifs en Cours
${activeList.length > 0 ? activeList.map(q => `#### ${q.title} (${q.category.toUpperCase()})
- **Donneur d'ordre** : ${q.giver || 'Inconnu'} | **Lieu** : ${q.location || 'Inconnu'}
- **Étapes** :
${q.stages.map(s => `  - [${s.done ? 'x' : ' '}] ${s.text}`).join('\n')}
- *Notes* : ${q.notes || '—'}
`).join('\n') : '*Aucun objectif actif.*'}

---
*Généré automatiquement par Grimoire.*
`;

    navigator.clipboard.writeText(md);
    broadcastToPlayers('handout_push', {
      type: 'note',
      title: `Chronique de Session — ${imperialDate}`,
      text: md
    });
    notifStore.add('success', 'Chronique diffusée', 'Résumé de session copié et envoyé sur les téléphones des joueurs.');
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="qj-backdrop" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="qj-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="qj-header">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="qj-title">📜 Journal de Campagne & Quêtes</span>
        <button class="qj-btn-summary" onclick={generateSessionSummary} title="Générer et diffuser le résumé de session">
          📢 Diffuser Résumé de Session
        </button>
      </div>
      <button class="qj-close" onclick={onclose}>✕</button>
    </div>

    <!-- Filtres & Bouton Nouvelle Quête -->
    <div class="qj-filters">
      <div class="qj-filter-group">
        <select bind:value={filterCategory} class="qj-select">
          <option value="all">Toutes Catégories</option>
          <option value="main">⭐ Quête Principale</option>
          <option value="side">🗡️ Quête Secondaire</option>
          <option value="rumor">👂 Rumeur / Piste</option>
          <option value="secret">🔒 Secret du MJ</option>
        </select>
        <select bind:value={filterStatus} class="qj-select">
          <option value="all">Tous Statuts</option>
          <option value="active">⏳ En cours</option>
          <option value="completed">✅ Terminée</option>
          <option value="failed">❌ Échouée</option>
        </select>
      </div>
      <button class="qj-btn-new" onclick={createNewQuest}>+ Nouvelle Quête</button>
    </div>

    <div class="qj-layout">
      <!-- Liste des Quêtes (Gauche) -->
      <div class="qj-sidebar">
        {#if filteredQuests.length === 0}
          <div class="qj-empty">Aucune quête correspondante</div>
        {:else}
          {#each filteredQuests as q (q.id)}
            <button
              class="qj-item"
              class:selected={activeQuest?.id === q.id}
              class:completed={q.status === 'completed'}
              class:failed={q.status === 'failed'}
              onclick={() => { selectedQuestId = q.id; editMode = false; }}
            >
              <div class="qj-item-head">
                <span class="qj-item-cat">
                  {q.category === 'main' ? '⭐ Principale' : q.category === 'rumor' ? '👂 Rumeur' : q.category === 'secret' ? '🔒 Secret' : '🗡️ Secondaire'}
                </span>
                <span class="qj-item-status">
                  {q.status === 'completed' ? '✅' : q.status === 'failed' ? '❌' : '⏳'}
                </span>
              </div>
              <div class="qj-item-title">{q.title}</div>
              <div class="qj-item-meta">{q.location || '—'} · {q.rewardXp} XP</div>
            </button>
          {/each}
        {/if}
      </div>

      <!-- Détails ou Édition (Droite) -->
      <div class="qj-main">
        {#if editMode && editQuest}
          <div class="qj-form">
            <div class="qj-form-row">
              <label class="qj-form-lbl">Titre
                <input class="qj-input" bind:value={editQuest.title} />
              </label>
            </div>
            <div class="qj-form-row">
              <label class="qj-form-lbl">Catégorie
                <select bind:value={editQuest.category} class="qj-select">
                  <option value="main">⭐ Principale</option>
                  <option value="side">🗡️ Secondaire</option>
                  <option value="rumor">👂 Rumeur</option>
                  <option value="secret">🔒 Secret</option>
                </select>
              </label>
              <label class="qj-form-lbl">Statut
                <select bind:value={editQuest.status} class="qj-select">
                  <option value="active">⏳ En cours</option>
                  <option value="completed">✅ Terminée</option>
                  <option value="failed">❌ Échouée</option>
                </select>
              </label>
            </div>
            <div class="qj-form-row">
              <label class="qj-form-lbl">Commanditaire / Donneur
                <input class="qj-input" bind:value={editQuest.giver} placeholder="Ex: Baron von Saponatheim" />
              </label>
              <label class="qj-form-lbl">Lieu
                <input class="qj-input" bind:value={editQuest.location} placeholder="Ex: Bögenhafen" />
              </label>
            </div>
            <div class="qj-form-row">
              <label class="qj-form-lbl">Récompense XP
                <input type="number" class="qj-input" bind:value={editQuest.rewardXp} min="0" step="10" />
              </label>
              <label class="qj-form-lbl">Récompense Or/Objets
                <input class="qj-input" bind:value={editQuest.rewardGold} placeholder="Ex: 20 CO" />
              </label>
            </div>

            <!-- Étapes -->
            <div class="qj-form-lbl">Étapes de la quête</div>
            <div class="qj-stages-edit">
              {#each editQuest.stages as s, i}
                <div class="qj-stage-row">
                  <input type="checkbox" bind:checked={s.done} />
                  <input class="qj-input" bind:value={s.text} style="flex:1" />
                  <button class="qj-btn-del-mini" onclick={() => removeStage(i)}>✕</button>
                </div>
              {/each}
              <div class="qj-stage-add">
                <input class="qj-input" placeholder="Ajouter une étape..." bind:value={newStageText} onkeydown={e => e.key === 'Enter' && addStage()} />
                <button class="qj-btn-sec" onclick={addStage}>+ Ajouter</button>
              </div>
            </div>

            <label class="qj-form-lbl">Notes & Indices
              <textarea class="qj-textarea" bind:value={editQuest.notes} rows="3"></textarea>
            </label>

            <div class="qj-form-actions">
              <button class="qj-btn-del" onclick={() => deleteQuest(editQuest!.id)}>🗑️ Supprimer</button>
              <button class="qj-btn-sec" onclick={() => editMode = false}>Annuler</button>
              <button class="qj-btn-pri" onclick={saveEdit}>💾 Enregistrer</button>
            </div>
          </div>
        {:else if activeQuest}
          <div class="qj-view">
            <div class="qj-view-header">
              <div>
                <h2 class="qj-view-title">{activeQuest.title}</h2>
                <div class="qj-view-meta">
                  <span>📍 {activeQuest.location || 'Lieu inconnu'}</span>
                  <span>👤 {activeQuest.giver || 'Donneur anonyme'}</span>
                  <span>📅 {activeQuest.dateAssigned}</span>
                </div>
              </div>
              <button class="qj-btn-edit" onclick={() => startEdit(activeQuest!)}>✏️ Modifier</button>
            </div>

            <div class="qj-view-rewards">
              <span>💫 <strong>{activeQuest.rewardXp} XP</strong></span>
              <span>💰 <strong>{activeQuest.rewardGold}</strong></span>
            </div>

            <div class="qj-section-title">Étapes d'avancement :</div>
            <div class="qj-stages-list">
              {#each activeQuest.stages as stage, idx}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="qj-stage-item" class:done={stage.done} onclick={() => toggleStageLive(activeQuest!, idx)}>
                  <input type="checkbox" checked={stage.done} onclick={e => e.stopPropagation()} onchange={() => toggleStageLive(activeQuest!, idx)} />
                  <span class="qj-stage-text">{stage.text}</span>
                </div>
              {/each}
            </div>

            {#if activeQuest.notes}
              <div class="qj-section-title">Notes & Secrets du MJ :</div>
              <div class="qj-notes-box">{activeQuest.notes}</div>
            {/if}
          </div>
        {:else}
          <div class="qj-no-select">Sélectionnez une quête ou créez-en une nouvelle.</div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .qj-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2600; }
  .qj-modal { background: var(--bg-secondary, #161b22); border: 1px solid var(--border, #30363d); border-radius: 12px; width: 850px; max-width: 95vw; height: 600px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 16px 48px rgba(0,0,0,0.8); overflow: hidden; }
  
  .qj-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-tertiary, #0d1117); border-bottom: 1px solid var(--border); }
  .qj-title { font-size: 15px; font-weight: 700; color: var(--accent, #e5a853); }
  .qj-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; }
  .qj-btn-summary { background: rgba(229,168,83,0.15); border: 1px solid var(--accent); color: var(--accent); border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; }
  .qj-btn-summary:hover { background: var(--accent); color: #000; }

  .qj-filters { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; background: var(--bg-tertiary); border-bottom: 1px solid var(--border); }
  .qj-filter-group { display: flex; gap: 8px; }
  .qj-select, .qj-input, .qj-textarea { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; color: white; padding: 5px 8px; font-size: 12px; outline: none; }
  .qj-btn-new { background: #238636; border: none; border-radius: 6px; color: white; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }

  .qj-layout { display: flex; flex: 1; overflow: hidden; }
  .qj-sidebar { width: 280px; border-right: 1px solid var(--border); overflow-y: auto; display: flex; flex-direction: column; background: rgba(0,0,0,0.15); }
  .qj-item { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: left; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.05); color: inherit; cursor: pointer; transition: background 0.15s; }
  .qj-item:hover { background: rgba(255,255,255,0.03); }
  .qj-item.selected { background: rgba(229,168,83,0.12); border-left: 3px solid var(--accent); }
  .qj-item.completed .qj-item-title { text-decoration: line-through; opacity: 0.7; }
  .qj-item.failed .qj-item-title { color: #f87171; }
  
  .qj-item-head { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-bottom: 2px; }
  .qj-item-title { font-size: 13px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .qj-item-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

  .qj-main { flex: 1; overflow-y: auto; padding: 16px; }
  .qj-view { display: flex; flex-direction: column; gap: 12px; }
  .qj-view-header { display: flex; justify-content: space-between; align-items: flex-start; }
  .qj-view-title { font-size: 18px; color: var(--accent); margin: 0; }
  .qj-view-meta { display: flex; gap: 12px; font-size: 11px; color: var(--text-muted); margin-top: 4px; }
  .qj-btn-edit { background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-muted); border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer; }
  
  .qj-view-rewards { display: flex; gap: 16px; background: var(--bg-tertiary); padding: 8px 12px; border-radius: 6px; font-size: 12px; color: var(--text-primary); }
  .qj-section-title { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 4px; }
  .qj-stages-list { display: flex; flex-direction: column; gap: 6px; }
  .qj-stage-item { display: flex; align-items: center; gap: 8px; background: var(--bg-tertiary); padding: 8px 10px; border-radius: 6px; font-size: 13px; cursor: pointer; }
  .qj-stage-item.done .qj-stage-text { text-decoration: line-through; opacity: 0.6; }
  .qj-notes-box { background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 6px; padding: 10px; font-size: 12px; line-height: 1.5; color: var(--text-primary); white-space: pre-wrap; }

  .qj-form { display: flex; flex-direction: column; gap: 10px; }
  .qj-form-row { display: flex; gap: 10px; }
  .qj-form-lbl { flex: 1; display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
  .qj-stages-edit { display: flex; flex-direction: column; gap: 6px; }
  .qj-stage-row { display: flex; align-items: center; gap: 6px; }
  .qj-stage-add { display: flex; gap: 6px; margin-top: 4px; }
  .qj-btn-del-mini { background: none; border: 1px solid var(--border); border-radius: 4px; color: var(--text-muted); cursor: pointer; padding: 2px 6px; }
  .qj-form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
  
  .qj-btn-pri { background: var(--accent); color: #000; border: none; border-radius: 6px; padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
  .qj-btn-sec { background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-muted); border-radius: 6px; padding: 7px 12px; font-size: 12px; cursor: pointer; }
  .qj-btn-del { background: rgba(239,68,68,0.15); border: 1px solid #ef4444; color: #ef4444; border-radius: 6px; padding: 7px 12px; font-size: 12px; cursor: pointer; margin-right: auto; }
  
  .qj-empty, .qj-no-select { padding: 30px; text-align: center; color: var(--text-muted); font-size: 12px; font-style: italic; }
</style>
