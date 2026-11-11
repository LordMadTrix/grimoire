<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { listen } from '$lib/tauriEvent';
  import {
    getPlayerConnections, applyDamageToPlayer, setPlayerMaxHp, setPlayerHp, applyConditionToPlayer,
    removeConditionFromPlayer, requestRoll, pushMapSnapshot, sendPrivateMessage, broadcastToPlayers,
    readFile, writeFile, type PlayerInfo, type VaultEntry,
    getSavedPlayerAccounts, savePlayerAccount, deletePlayerAccount, type PlayerAccountSummary
  } from '$lib/api';
  import { getVaultPath, getVaultTree, setActiveFile } from '$lib/stores/vault.svelte';
  import { vttStore, replaceGmToken, addGmToken, updateGmToken, startPlayerPlacement, type Token } from '$lib/stores/vtt.svelte';
  import { notifStore } from '$lib/stores/notifications.svelte';
  import { parseCharacterMd, type ParsedCharacterData } from '$lib/services/characterParser';
  import CelestialArtPickerModal from './CelestialArtPickerModal.svelte';
  import { synthesizeNeuralSpeech } from '$lib/services/edgeTts';
  import { ttsReader } from '$lib/stores/ttsReader.svelte';

  let { visible = $bindable(true), onClose }: { visible?: boolean; onClose?: () => void } = $props();

  // ── Position & Drag de la fenêtre ─────────────────────────────
  let posX = $state(100);
  let posY = $state(70);
  let isDragging = $state(false);
  let dragOffset = { x: 0, y: 0 };
  let collapsed = $state(false);

  // ── Onglets et Données ─────────────────────────────────────────
  let activeTab = $state<'players' | 'vault'>('players');
  let players = $state<PlayerInfo[]>([]);
  let savedAccounts = $state<PlayerAccountSummary[]>([]);
  let vaultCharacters = $state<{ path: string; name: string; data: ParsedCharacterData }[]>([]);
  let isRefreshing = $state(false);
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let unlistenFns: (() => void)[] = [];
  let expandedCards = $state<Set<string>>(new Set());

  function togglePlayerExpand(id: string) {
    const next = new Set(expandedCards);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedCards = next;
  }

  const displayAccounts = $derived.by(() => {
    const list: PlayerAccountSummary[] = savedAccounts.map(a => ({ ...a }));
    const accountNames = new Set(list.map(a => a.name.toLowerCase().trim()));

    // Ajouter tous les joueurs en ligne qui ne sont pas encore dans savedAccounts
    for (const p of players) {
      const pName = p.name.toLowerCase().trim();
      if (!accountNames.has(pName)) {
        list.push({
          name: p.name,
          has_password: false,
          password: null,
          character: p.character,
          character_path: p.character_path,
          is_online: true,
          player_id: p.id,
          conditions: p.conditions || []
        } as PlayerAccountSummary);
        accountNames.add(pName);
      } else {
        // Mettre à jour le statut en ligne et le player_id du compte existant
        const acc = list.find(a => a.name.toLowerCase().trim() === pName);
        if (acc) {
          acc.is_online = true;
          acc.player_id = p.id;
          if (p.character && (!acc.character || Object.keys(acc.character).length === 0)) {
            acc.character = p.character;
          }
          if (p.conditions && p.conditions.length > 0) {
            acc.conditions = p.conditions;
          }
        }
      }
    }
    return list;
  });

  // Avatar picker modal state
  let showAvatarPicker = $state(false);
  let avatarPickerTarget = $state<'quickEdit' | 'newPlayer'>('quickEdit');
  let avatarFileInputRef = $state<HTMLInputElement | null>(null);

  function handleAvatarFileUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const b64 = event.target.result as string;
          if (avatarPickerTarget === 'quickEdit') {
            quickEditForm.imageUrl = b64;
          } else {
            newPlayerForm.imageUrl = b64;
          }
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // Nouveau joueur modal state
  let isCreatingPlayer = $state(false);
  let newPlayerForm = $state({
    nom: '',
    voc: '',
    race: 'Humain',
    hp: 12,
    maxhp: 12,
    ac: 10,
    speed: 4,
    initiative: 30,
    password: '',
    imageUrl: '',
    spawnOnMap: true
  });

  // Quick edit modal state
  let quickEditAccount = $state<PlayerAccountSummary | null>(null);
  let editModalTab = $state<'stats' | 'token' | 'account'>('stats');
  let quickEditForm = $state<{
    nom: string;
    password: string;
    hp: number;
    maxhp: number;
    xp: number;
    race: string;
    voc: string;
    ac: number;
    speed: number;
    initiative: number;
    destin: number;
    fortune: number;
    resilience: number;
    resolution: number;
    tokenSize: number;
    visionRange: number;
    character_path: string;
    imageUrl: string;
  }>({
    nom: '',
    password: '',
    hp: 10,
    maxhp: 10,
    xp: 0,
    race: '',
    voc: '',
    ac: 10,
    speed: 4,
    initiative: 30,
    destin: 2,
    fortune: 2,
    resilience: 1,
    resolution: 1,
    tokenSize: 1,
    visionRange: 0,
    character_path: '',
    imageUrl: ''
  });

  function openQuickEdit(acc: PlayerAccountSummary) {
    quickEditAccount = acc;
    editModalTab = 'stats';
    const c = acc.character || {};
    const maxHp = c.maxhp ?? (parseInt(c.profil?.act?.b) || 10);
    const hp = c.hp ?? c.bless ?? maxHp;
    const token = getPlayerToken(acc);
    const tokenGridSize = vttStore.gridSize || 50;
    const tSize = token ? Math.max(1, Math.round(token.size / tokenGridSize)) : 1;

    quickEditForm = {
      nom: c.nom || acc.name,
      password: acc.password || '',
      hp: hp,
      maxhp: maxHp > 0 ? maxHp : 10,
      xp: c.xp ?? 0,
      race: c.race || '',
      voc: c.voc || c.car || '',
      ac: c.ac ?? 10,
      speed: c.speed ?? (parseInt(c.profil?.act?.m) || 4),
      initiative: c.initiative ?? (parseInt(c.profil?.init?.i) || 30),
      destin: c.destin ?? (parseInt(c.profil?.destin) || 2),
      fortune: c.fortune ?? (parseInt(c.profil?.fortune) || 2),
      resilience: c.resilience ?? 1,
      resolution: c.resolution ?? 1,
      tokenSize: tSize,
      visionRange: token?.visionRange ?? 0,
      character_path: acc.character_path || '',
      imageUrl: c.imageUrl || c.avatar || c.portrait || token?.imageUrl || ''
    };
  }

  function toggleTokenInEditModal() {
    if (!quickEditAccount) return;
    const token = getPlayerToken(quickEditAccount);
    if (token) {
      vttStore.tokens = vttStore.tokens.filter(t => t.id !== token.id);
      notifStore.add('🗺️', quickEditAccount.name, 'Pion retiré de la carte VTT', 'info', 2000);
    } else {
      const tokenGridSize = vttStore.gridSize || 50;
      addGmToken({
        id: Math.random().toString(36).slice(2),
        name: quickEditForm.nom || quickEditAccount.name,
        x: 350 + (vttStore.tokens.length * 30) % 300,
        y: 350 + (vttStore.tokens.length * 20) % 200,
        size: tokenGridSize * (quickEditForm.tokenSize || 1),
        color: 0x22c55e,
        hp: quickEditForm.hp,
        maxHp: quickEditForm.maxhp,
        imageUrl: quickEditForm.imageUrl || undefined,
        visionRange: quickEditForm.visionRange || 0,
        isEnemy: false,
        visible: true,
        playerId: quickEditAccount.name
      });
      notifStore.add('🧙‍♂️', quickEditAccount.name, 'Pion posé sur la carte VTT !', 'success', 2500);
    }
  }

  async function saveQuickEdit() {
    if (!quickEditAccount) return;
    const acc = quickEditAccount;
    const baseChar = acc.character && typeof acc.character === 'object' ? { ...acc.character } : {};
    const maxHp = Math.max(1, quickEditForm.maxhp || 10);
    const hp = Math.max(0, quickEditForm.hp ?? maxHp);
    const updatedChar = {
      ...baseChar,
      nom: quickEditForm.nom || acc.name,
      race: quickEditForm.race,
      voc: quickEditForm.voc,
      hp: hp,
      bless: hp,
      maxhp: maxHp,
      xp: quickEditForm.xp,
      ac: quickEditForm.ac,
      speed: quickEditForm.speed,
      initiative: quickEditForm.initiative,
      destin: quickEditForm.destin,
      fortune: quickEditForm.fortune,
      resilience: quickEditForm.resilience,
      resolution: quickEditForm.resolution,
      imageUrl: quickEditForm.imageUrl || null
    };
    if (!updatedChar.profil) updatedChar.profil = { act: {}, init: {} };
    if (!updatedChar.profil.act) updatedChar.profil.act = {};
    if (!updatedChar.profil.init) updatedChar.profil.init = {};
    updatedChar.profil.act.b = maxHp;
    updatedChar.profil.act.m = quickEditForm.speed;
    updatedChar.profil.init.i = quickEditForm.initiative;

    try {
      await savePlayerAccount(
        acc.name,
        quickEditForm.nom || acc.name,
        quickEditForm.password !== undefined ? quickEditForm.password.trim() : null,
        updatedChar,
        quickEditForm.character_path || null
      );
      const token = getPlayerToken(acc);
      if (token) {
        const tokenGridSize = vttStore.gridSize || 50;
        replaceGmToken({
          ...token,
          name: quickEditForm.nom || acc.name,
          hp: hp,
          maxHp: maxHp,
          size: tokenGridSize * (quickEditForm.tokenSize || 1),
          visionRange: quickEditForm.visionRange || 0,
          imageUrl: quickEditForm.imageUrl || token.imageUrl
        });
      }
      // Mettre à jour dans le combat si présent
      const combatant = vttStore.combatants.find(c => c.name.toLowerCase().trim() === acc.name.toLowerCase().trim());
      if (combatant) {
        combatant.name = quickEditForm.nom || acc.name;
        combatant.hp = hp;
        combatant.maxHp = maxHp;
      }

      notifStore.add('✏️', quickEditForm.nom || acc.name, 'Fiche et pion mis à jour !', 'success', 2500);
    } catch (err) {
      console.error('Save quick edit error:', err);
      notifStore.add('⚠️', 'Erreur', 'Impossible de sauvegarder la fiche', 'danger', 3000);
    }
    quickEditAccount = null;
    await refreshData();
  }

  async function handleDeletePlayer(name: string) {
    if (!name) return;
    if (!confirm(`Supprimer définitivement le joueur « ${name} » et son compte ?`)) return;
    try {
      await deletePlayerAccount(name);
      // Supprimer le token sur la carte VTT s'il existe
      vttStore.tokens = vttStore.tokens.filter(t => 
        t.name.toLowerCase().trim() !== name.toLowerCase().trim() && 
        t.playerId !== name
      );
      // Supprimer du gestionnaire de combat
      vttStore.combatants = vttStore.combatants.filter(c => 
        c.name.toLowerCase().trim() !== name.toLowerCase().trim()
      );
      notifStore.add('🗑️', name, 'Compte et pion joueur supprimés.', 'info', 3000);
    } catch (err) {
      console.error('Delete player error:', err);
      notifStore.add('⚠️', 'Erreur', `Impossible de supprimer le joueur : ${err}`, 'danger', 3500);
    }
    quickEditAccount = null;
    await refreshData();
  }

  async function createNewPlayer() {
    const nom = newPlayerForm.nom.trim();
    if (!nom) {
      notifStore.add('⚠️', 'Nom requis', 'Veuillez saisir un nom pour le joueur.', 'warn', 3000);
      return;
    }
    const maxHp = Math.max(1, Number(newPlayerForm.maxhp) || 12);
    const curHp = Math.max(0, Number(newPlayerForm.hp) || maxHp);
    const charData: any = {
      nom,
      race: newPlayerForm.race.trim() || 'Humain',
      voc: newPlayerForm.voc.trim() || 'Aventurier',
      hp: curHp,
      bless: curHp,
      maxhp: maxHp,
      ac: Number(newPlayerForm.ac) || 10,
      xp: 0,
      imageUrl: newPlayerForm.imageUrl.trim() || null,
      profil: {
        init: {},
        plan: {},
        act: { b: maxHp }
      }
    };

    try {
      await savePlayerAccount(
        nom,
        nom,
        newPlayerForm.password.trim() || null,
        charData,
        null
      );

      // Si demandé, poser directement le token sur la table VTT
      if (newPlayerForm.spawnOnMap) {
        addGmToken({
          id: Math.random().toString(36).slice(2),
          name: nom,
          x: 300 + (vttStore.tokens.length * 35) % 300,
          y: 300 + (vttStore.tokens.length * 25) % 200,
          size: vttStore.gridSize,
          color: 0x22c55e,
          hp: curHp,
          maxHp: maxHp,
          imageUrl: newPlayerForm.imageUrl.trim() || undefined,
          visionRange: 0,
          isEnemy: false,
          visible: true,
          playerId: nom
        });
      }

      notifStore.add('✨', nom, 'Nouveau joueur ajouté avec succès !', 'success', 3500);
      isCreatingPlayer = false;
      newPlayerForm = { nom: '', voc: '', race: 'Humain', hp: 12, maxhp: 12, ac: 10, speed: 4, initiative: 30, password: '', imageUrl: '', spawnOnMap: true };
      await refreshData();
    } catch (err) {
      console.error('Create player error:', err);
      notifStore.add('⚠️', 'Erreur', `Échec de création du joueur : ${err}`, 'danger', 4000);
    }
  }

  // Menu déroulant pour jet rapide
  let activeRollMenuPlayerId = $state<string | null>(null);

  const QUICK_ROLLS = [
    { key: 'cc', lbl: 'CC (Corps-à-corps)' },
    { key: 'ct', lbl: 'CT (Tir)' },
    { key: 'f', lbl: 'Force' },
    { key: 'e', lbl: 'Endurance' },
    { key: 'i', lbl: 'Initiative' },
    { key: 'dex', lbl: 'Dextérité' },
    { key: 'int', lbl: 'Intelligence / Perception' },
    { key: 'fm', lbl: 'Force Mentale' },
    { key: 'soc', lbl: 'Sociabilité' }
  ];

  const QUICK_CONDITIONS = [
    { id: 'Saignant', icon: '🩸', label: 'Saignant' },
    { id: 'Étourdi', icon: '💫', label: 'Étourdi' },
    { id: 'À terre', icon: '⬇️', label: 'À terre' },
    { id: 'Fatigué', icon: '😴', label: 'Fatigué' },
    { id: 'Effrayé', icon: '😱', label: 'Effrayé' },
    { id: 'Empoisonné', icon: '☠️', label: 'Empoisonné' }
  ];

  // ── Initialisation ─────────────────────────────────────────────
  onMount(() => {
    // Restaurer position
    if (typeof window !== 'undefined') {
      try {
        const savedPos = localStorage.getItem('grimoire_player_dock_pos');
        if (savedPos) {
          const parsed = JSON.parse(savedPos);
          posX = Math.max(10, Math.min(window.innerWidth - 320, parsed.x));
          posY = Math.max(10, Math.min(window.innerHeight - 100, parsed.y));
        } else {
          posX = Math.max(10, window.innerWidth - 320);
          posY = 70;
        }

        const savedCollapsed = localStorage.getItem('grimoire_player_dock_collapsed');
        if (savedCollapsed !== null) {
          collapsed = savedCollapsed === 'true';
        }
      } catch (err) {
        console.error('Error restoring dock pos:', err);
      }
    }

    refreshData();
    scanVaultCharacters();

    // Écoute des événements joueurs en temps réel
    (async () => {
      try {
        unlistenFns.push(await listen('player_joined', () => refreshData()));
        unlistenFns.push(await listen('player_left', () => refreshData()));
        unlistenFns.push(await listen('player_character_update', () => refreshData()));
        unlistenFns.push(await listen('player_accounts_updated', () => refreshData()));
      } catch (e) {
        console.warn('Tauri event listen failed in PlayerQuickDock:', e);
      }
    })();

    // Polling doux toutes les 4 secondes
    pollInterval = setInterval(refreshData, 4000);

    // Ajustement sur redimensionnement de l'écran
    const handleResize = () => {
      posX = Math.max(10, Math.min(window.innerWidth - 300, posX));
      posY = Math.max(10, Math.min(window.innerHeight - 80, posY));
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
    unlistenFns.forEach(fn => fn());
  });

  // ── Drag de la fenêtre ─────────────────────────────────────────
  function startDrag(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('button, input, select, .player-card, .avatar-drag-handle')) {
      return;
    }
    isDragging = true;
    dragOffset.x = e.clientX - posX;
    dragOffset.y = e.clientY - posY;

    const onMouseMove = (moveEv: MouseEvent) => {
      if (!isDragging) return;
      posX = Math.max(10, Math.min(window.innerWidth - 280, moveEv.clientX - dragOffset.x));
      posY = Math.max(10, Math.min(window.innerHeight - 60, moveEv.clientY - dragOffset.y));
    };

    const onMouseUp = () => {
      isDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      try {
        localStorage.setItem('grimoire_player_dock_pos', JSON.stringify({ x: posX, y: posY }));
      } catch {}
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function toggleCollapse() {
    collapsed = !collapsed;
    try {
      localStorage.setItem('grimoire_player_dock_collapsed', String(collapsed));
    } catch {}
  }

  // ── Récupération des Données ───────────────────────────────────
  async function refreshData() {
    isRefreshing = true;
    try {
      players = await getPlayerConnections();
      try {
        savedAccounts = await getSavedPlayerAccounts();
      } catch (err) {
        console.warn('Failed to load accounts in dock:', err);
      }
    } catch {
      players = [];
    } finally {
      isRefreshing = false;
    }
  }

  async function scanVaultCharacters() {
    const vaultPath = getVaultPath();
    const tree = getVaultTree();
    if (!vaultPath || !tree) return;

    const found: { path: string; name: string; data: ParsedCharacterData }[] = [];

    async function walk(entries: VaultEntry[], parent = '') {
      for (const e of entries) {
        if (e.is_dir && e.children) {
          await walk(e.children, parent + e.name + '/');
        } else if (e.extension === 'md') {
          const rel = parent + e.name;
          const low = rel.toLowerCase();
          if (low.includes('personnage') || low.includes('character') || low.includes('pj') || low.includes('heros')) {
            try {
              const content = await readFile(vaultPath, rel);
              const data = parseCharacterMd(content);
              found.push({ path: rel, name: data.nom || e.name.replace('.md', ''), data });
            } catch (err) {
              console.warn('Scan character error:', rel, err);
            }
          }
        }
      }
    }

    await walk(tree);
    vaultCharacters = found;
  }

  // ── Helpers Joueurs & Tokens ───────────────────────────────────
  function getPlayerToken(p: { id?: string; name: string }): Token | undefined {
    return vttStore.tokens.find(t => 
      (p.id && t.playerId === p.id) || 
      (t.name.toLowerCase().trim() === p.name.toLowerCase().trim())
    );
  }

  function isTokenOnMap(p: { id?: string; name: string }): boolean {
    return !!getPlayerToken(p);
  }

  function getPlayerHp(p: PlayerInfo | PlayerAccountSummary): { hp: number; maxHp: number; pct: number } {
    const token = getPlayerToken(p);
    if (token && token.hp !== undefined && token.maxHp !== undefined && token.maxHp > 0) {
      const pct = (token.hp / token.maxHp) * 100;
      return { hp: token.hp, maxHp: token.maxHp, pct: Math.min(100, Math.max(0, pct)) };
    }
    if (p.character) {
      const maxHp = p.character.maxhp ?? (parseInt(p.character.profil?.act?.b) || 10);
      const safeMax = maxHp > 0 ? maxHp : 10;
      const hp = p.character.hp ?? p.character.bless ?? safeMax;
      const pct = (hp / safeMax) * 100;
      return { hp, maxHp: safeMax, pct: Math.min(100, Math.max(0, pct)) };
    }
    return { hp: 10, maxHp: 10, pct: 100 };
  }

  function getVaultCharHp(vc: { path: string; name: string; data: ParsedCharacterData }) {
    const token = getPlayerToken(vc);
    if (token && token.hp !== undefined && token.maxHp !== undefined && token.maxHp > 0) {
      const pct = (token.hp / token.maxHp) * 100;
      return { hp: token.hp, maxHp: token.maxHp, pct: Math.min(100, Math.max(0, pct)) };
    }
    const maxHp = vc.data.maxhp || 10;
    const hp = vc.data.hp !== undefined ? vc.data.hp : maxHp;
    const pct = maxHp > 0 ? (hp / maxHp) * 100 : 100;
    return { hp, maxHp, pct: Math.min(100, Math.max(0, pct)) };
  }

  // ── Actions Rapides ────────────────────────────────────────────
  async function setPlayerHpDirect(p: PlayerInfo | PlayerAccountSummary, targetHp: number) {
    const hpData = getPlayerHp(p);
    const maxHp = hpData.maxHp;
    const safeHp = Math.max(0, targetHp);
    const pid = (p as any).id || (p as any).player_id;

    // 1. Sauvegarder dans le compte joueur
    const updatedChar = { ...(p.character || {}), hp: safeHp, bless: safeHp, maxhp: maxHp };
    if (!updatedChar.profil) updatedChar.profil = { act: {} };
    if (!updatedChar.profil.act) updatedChar.profil.act = {};
    updatedChar.profil.act.b = maxHp;
    try {
      await savePlayerAccount(p.name, null, null, updatedChar, p.character_path || null);
    } catch (e) {
      console.warn('savePlayerAccount error in setPlayerHpDirect:', e);
    }

    // 2. Synchronisation WebSocket
    try {
      await setPlayerHp(pid || p.name, safeHp);
    } catch (e) {
      console.warn('setPlayerHp notice:', e);
    }

    // 3. Mise à jour token VTT
    const token = getPlayerToken(p);
    if (token) {
      replaceGmToken({ ...token, hp: safeHp, maxHp });
    }

    await refreshData();
  }

  async function setPlayerMaxHpDirect(p: PlayerInfo | PlayerAccountSummary, targetMaxHp: number) {
    const safeMax = Math.max(1, targetMaxHp);
    const hpData = getPlayerHp(p);
    const currentHp = Math.min(hpData.hp, safeMax);
    const pid = (p as any).id || (p as any).player_id;

    // 1. Sauvegarder dans le compte joueur
    const updatedChar = { ...(p.character || {}), hp: currentHp, bless: currentHp, maxhp: safeMax };
    if (!updatedChar.profil) updatedChar.profil = { act: {} };
    if (!updatedChar.profil.act) updatedChar.profil.act = {};
    updatedChar.profil.act.b = safeMax;
    try {
      await savePlayerAccount(p.name, null, null, updatedChar, p.character_path || null);
    } catch (e) {
      console.warn('savePlayerAccount error in setPlayerMaxHpDirect:', e);
    }

    // 2. Synchronisation WebSocket mobile
    try {
      await setPlayerMaxHp(pid || p.name, safeMax);
    } catch (e) {
      console.warn('setPlayerMaxHp notice:', e);
    }

    // 3. Mise à jour token VTT
    const token = getPlayerToken(p);
    if (token) {
      replaceGmToken({ ...token, hp: currentHp, maxHp: safeMax });
    }

    await refreshData();
  }

  async function adjustMaxHp(p: PlayerInfo | PlayerAccountSummary, delta: number) {
    const hpData = getPlayerHp(p);
    const nextMax = Math.max(1, hpData.maxHp + delta);
    await setPlayerMaxHpDirect(p, nextMax);
  }

  async function adjustHp(p: PlayerInfo | PlayerAccountSummary, delta: number) {
    const hpData = getPlayerHp(p);
    const maxHp = hpData.maxHp;
    const newHp = Math.max(0, hpData.hp + delta);
    const damageAmount = -delta;
    const pid = (p as any).id || (p as any).player_id;

    // 1. Sauvegarder dans le compte joueur (bless, hp, maxhp)
    const updatedChar = { ...(p.character || {}), hp: newHp, bless: newHp, maxhp: maxHp };
    if (!updatedChar.profil) updatedChar.profil = { act: {} };
    if (!updatedChar.profil.act) updatedChar.profil.act = {};
    updatedChar.profil.act.b = maxHp;
    try {
      await savePlayerAccount(p.name, null, null, updatedChar, p.character_path || null);
    } catch (e) {
      console.warn('savePlayerAccount error in adjustHp:', e);
    }

    // 2. Si le joueur est en ligne (ou par nom), envoyer l'événement WebSocket au mobile
    try {
      await applyDamageToPlayer(pid || p.name, damageAmount);
    } catch (e) {
      console.warn('applyDamageToPlayer notice:', e);
    }

    // 3. Mise à jour synchrone du token sur la carte
    const token = getPlayerToken(p);
    if (token) {
      replaceGmToken({ ...token, hp: newHp, maxHp });
    }

    await refreshData();
  }

  async function setVaultCharHpDirect(vc: { path: string; name: string; data: ParsedCharacterData }, newHp: number) {
    const safeHp = Math.max(0, newHp);
    const token = getPlayerToken(vc);
    if (token) {
      replaceGmToken({ ...token, hp: safeHp });
    }
    vc.data.hp = safeHp;

    const vp = getVaultPath();
    if (vp) {
      try {
        const content = await readFile(vp, vc.path);
        const updated = content.replace(/^(hp|bless):\s*\d+/m, `$1: ${safeHp}`);
        if (updated !== content) {
          await writeFile(vp, vc.path, updated);
        }
      } catch (err) {
        console.warn('Failed auto-save character file:', err);
      }
    }
  }

  async function setVaultCharMaxHpDirect(vc: { path: string; name: string; data: ParsedCharacterData }, newMax: number) {
    const safeMax = Math.max(1, newMax);
    const token = getPlayerToken(vc);
    if (token) {
      replaceGmToken({ ...token, maxHp: safeMax });
    }
    vc.data.maxhp = safeMax;

    const vp = getVaultPath();
    if (vp) {
      try {
        const content = await readFile(vp, vc.path);
        let updated = content;
        if (/^maxhp:\s*\d+/m.test(content)) {
          updated = content.replace(/^maxhp:\s*\d+/m, `maxhp: ${safeMax}`);
        } else {
          updated = content.replace(/^(hp:\s*\d+)/m, `$1\nmaxhp: ${safeMax}`);
        }
        if (updated !== content) {
          await writeFile(vp, vc.path, updated);
        }
      } catch (err) {
        console.warn('Failed auto-save character file:', err);
      }
    }
  }

  async function adjustVaultCharMaxHp(vc: { path: string; name: string; data: ParsedCharacterData }, delta: number) {
    const curMax = vc.data.maxhp || 10;
    const nextMax = Math.max(1, curMax + delta);
    await setVaultCharMaxHpDirect(vc, nextMax);
  }

  async function adjustVaultCharHp(vc: { path: string; name: string; data: ParsedCharacterData }, delta: number) {
    const token = getPlayerToken(vc);
    if (token) {
      const cur = token.hp ?? vc.data.hp ?? 10;
      const newHp = Math.max(0, cur + delta);
      replaceGmToken({ ...token, hp: newHp });
    }
    vc.data.hp = Math.max(0, (vc.data.hp || 10) + delta);
    
    // Mise à jour fichier markdown
    const vp = getVaultPath();
    if (vp) {
      try {
        const content = await readFile(vp, vc.path);
        const updated = content.replace(/^(hp|bless):\s*\d+/m, `$1: ${vc.data.hp}`);
        if (updated !== content) {
          await writeFile(vp, vc.path, updated);
        }
      } catch (err) {
        console.warn('Failed auto-save character file:', err);
      }
    }
  }

  async function toggleCondition(p: PlayerInfo | PlayerAccountSummary, condition: string) {
    const pid = (p as any).id || (p as any).player_id;
    if (!pid) {
      notifStore.add('ℹ️', p.name, 'Joueur hors-ligne', 'info', 2000);
      return;
    }
    const active = (p.conditions || []).includes(condition);
    try {
      if (active) {
        await removeConditionFromPlayer(pid, condition);
      } else {
        await applyConditionToPlayer(pid, condition);
      }
    } catch (e) {
      console.warn('Condition toggle failed:', e);
    }

    // Sync token conditions
    const token = getPlayerToken(p);
    if (token) {
      const curConds = token.conditions ? [...token.conditions] : [];
      const idx = curConds.indexOf(condition);
      if (idx >= 0) curConds.splice(idx, 1);
      else curConds.push(condition);
      replaceGmToken({ ...token, conditions: curConds });
    }

    refreshData();
  }

  function centerCameraOnPlayer(p: { id?: string; player_id?: string | null; name: string }) {
    const token = getPlayerToken(p);
    if (token) {
      const pid = p.id || p.player_id;
      window.dispatchEvent(new CustomEvent('vtt-center-token', {
        detail: { tokenId: token.id, playerId: pid }
      }));
      notifStore.add('🎯', p.name, 'Caméra centrée sur le token', 'info', 2000);
    } else {
      notifStore.add('ℹ️', p.name, 'Ce joueur n\'est pas encore sur la carte', 'warn', 2500);
    }
  }

  function startPlacement(p: { id?: string; player_id?: string | null; name: string; character?: any; character_path?: string | null }) {
    const hpData = p.character ? {
      hp: p.character.hp ?? p.character.bless ?? 10,
      maxHp: p.character.maxhp ?? (parseInt(p.character.profil?.act?.b) || 10)
    } : { hp: 10, maxHp: 10 };

    const pid = p.id || p.player_id || p.name;
    const img = p.character?.imageUrl || p.character?.avatar || p.character?.portrait;

    startPlayerPlacement({
      id: pid,
      name: p.name,
      hp: hpData.hp,
      maxHp: hpData.maxHp,
      imageUrl: img || undefined
    });
    notifStore.add('📍', p.name, 'Cliquez sur la carte pour placer ce joueur (ou Échap pour annuler)', 'info', 4000);
  }

  function spawnPlayerTokenNow(p: { id?: string; player_id?: string | null; name: string; character?: any; character_path?: string | null }) {
    const hpData = p.character ? {
      hp: p.character.hp ?? p.character.bless ?? 10,
      maxHp: p.character.maxhp ?? (parseInt(p.character.profil?.act?.b) || 10)
    } : { hp: 10, maxHp: 10 };

    const pid = p.id || p.player_id || p.name;
    const img = p.character?.imageUrl || p.character?.avatar || p.character?.portrait;

    const existing = vttStore.tokens.find(t => t.playerId === pid || t.name.toLowerCase() === p.name.toLowerCase());
    if (existing) {
      updateGmToken(existing.id, Math.round(vttStore.cameraCenter.x), Math.round(vttStore.cameraCenter.y));
      notifStore.add('🧙‍♂️', p.name, 'Token déplacé au centre de votre vue', 'success', 2500);
      return;
    }

    addGmToken({
      id: Math.random().toString(36).slice(2),
      name: p.name,
      x: Math.round(vttStore.cameraCenter.x),
      y: Math.round(vttStore.cameraCenter.y),
      size: vttStore.gridSize,
      color: 0x22c55e,
      hp: hpData.hp,
      maxHp: hpData.maxHp,
      imageUrl: img || undefined,
      visionRange: 0,
      isEnemy: false,
      visible: true,
      playerId: pid
    });
    notifStore.add('🧙‍♂️', p.name, 'Token posé au centre de la vue !', 'success', 2500);
  }

  async function sendRollRequest(playerId: string, statKey: string, statLabel: string) {
    try {
      await requestRoll(playerId, statKey, 0);
      notifStore.add('🎲', 'Demande de jet envoyée', `Jet de ${statLabel}`, 'info', 3000);
    } catch (err) {
      console.error('Request roll error:', err);
    }
    activeRollMenuPlayerId = null;
  }

  async function pushMap() {
    try {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        await pushMapSnapshot(dataUrl);
        notifStore.add('🗺️', 'Table Virtuelle', 'Aperçu de la carte envoyé aux joueurs !', 'success', 3000);
      }
    } catch (err) {
      console.error('Push map error:', err);
    }
  }

  // ── 🤫 Murmures Secrets IA sur Smartphone (Hub Mobile) ─────────────
  let whisperTargetPlayer = $state<any | null>(null);
  let whisperContent = $state('');
  let isSendingWhisper = $state(false);

  function openWhisperModal(p: any) {
    whisperTargetPlayer = p;
    whisperContent = '';
  }

  async function sendSecretWhisper() {
    if (!whisperTargetPlayer || !whisperContent.trim() || isSendingWhisper) return;
    isSendingWhisper = true;
    const targetName = whisperTargetPlayer.name;
    const text = whisperContent.trim();

    try {
      // 1. Envoyer le message secret au smartphone du joueur via WebSocket
      await sendPrivateMessage(targetName, `🤫 [Murmure du MJ] : "${text}"`);
      await broadcastToPlayers('whisper', {
        playerId: whisperTargetPlayer.id || whisperTargetPlayer.name,
        targetName,
        text,
        from: 'MJ'
      });

      // 2. Jouer l'audio neuronal en local dans Grimoire pour vérification du MJ
      const voice = ttsReader.selectedVoiceName || 'fr-FR-DeniseNeural';
      synthesizeNeuralSpeech(text, voice, 0.95, 0.92)
        .then(url => {
          const a = new Audio(url);
          a.volume = 0.85;
          a.play().catch(() => {});
        })
        .catch(() => {});

      notifStore.add('🤫', targetName, `Murmure secret transmis sur son mobile : "${text.slice(0, 35)}…"`, 'success', 4000);
      whisperTargetPlayer = null;
      whisperContent = '';
    } catch (e) {
      console.warn('Erreur envoi murmure secret:', e);
      notifStore.add('⚠️', targetName, 'Échec transmission du murmure', 'warn', 2500);
    } finally {
      isSendingWhisper = false;
    }
  }
</script>

{#if visible}
  <!-- Mode Réduit (Mini onglet ancré) -->
  {#if collapsed}
    <div
      class="player-dock-collapsed"
      style="top: {posY}px; left: {posX}px;"
      transition:fade={{ duration: 150 }}
    >
      <button class="dock-tab-btn" onclick={toggleCollapse} title="Déplier le panneau Joueurs Express">
        <span class="dock-tab-icon">👥</span>
        <span class="dock-tab-label">Joueurs ({players.length})</span>
        {#if players.length > 0}
          <span class="online-indicator-dot"></span>
        {/if}
        <span class="dock-tab-arrow">◀</span>
      </button>
    </div>
  {:else}
    <!-- Fenêtre Flottante Déplaçable -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="player-dock"
      class:is-dragging={isDragging}
      style="top: {posY}px; left: {posX}px;"
      transition:fade={{ duration: 150 }}
    >
      <!-- Barre de Titre (Draggable) -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="dock-header" onmousedown={startDrag}>
        <div class="dock-title">
          <span class="drag-grip" title="Cliquer et glisser pour déplacer">⠿</span>
          <span class="dock-icon">👥</span>
          <span class="dock-text">Joueurs Express</span>
          {#if displayAccounts.length > 0}
            <span class="badge-count" title="Comptes / Joueurs">{displayAccounts.length}</span>
          {/if}
        </div>

        <div class="dock-header-actions">
          <button class="icon-btn" onclick={pushMap} title="Pousser l'aperçu de la carte aux mobiles">🗺️</button>
          <button class="icon-btn" onclick={refreshData} title="Actualiser" disabled={isRefreshing}>
            <span class:spinning={isRefreshing}>🔄</span>
          </button>
          <button class="icon-btn" onclick={toggleCollapse} title="Réduire en onglet">_</button>
          <button class="icon-btn close-btn" onclick={() => { visible = false; onClose?.(); }} title="Fermer">✕</button>
        </div>
      </div>

      <!-- Onglets : Mobiles connectés vs Fiches du coffre -->
      <div class="dock-nav">
        <button
          class="nav-tab"
          class:active={activeTab === 'players'}
          onclick={() => activeTab = 'players'}
        >
          👥 Joueurs ({displayAccounts.length})
        </button>
        <button
          class="nav-tab"
          class:active={activeTab === 'vault'}
          onclick={() => { activeTab = 'vault'; scanVaultCharacters(); }}
        >
          📚 Fiches ({vaultCharacters.length})
        </button>
        <button
          type="button"
          class="dock-add-player-btn"
          onclick={() => isCreatingPlayer = true}
          title="Créer un nouveau joueur"
        >
          ➕ Nouveau
        </button>
      </div>

      <!-- Corps du panneau -->
      <div class="dock-body">
        {#if activeTab === 'players'}
          {#if displayAccounts.length === 0}
            <div class="dock-empty">
              <span class="empty-icon">📲</span>
              <p>Aucun compte joueur créé ou connecté.</p>
              <button
                type="button"
                class="dock-add-player-btn"
                style="margin: 8px auto 0; font-size: 12px; padding: 6px 14px;"
                onclick={() => isCreatingPlayer = true}
              >
                ➕ Créer votre premier joueur
              </button>
            </div>
          {:else}
            <div class="player-list">
              {#each displayAccounts as p (p.name)}
                {@const hpData = getPlayerHp(p)}
                {@const onMap = isTokenOnMap(p)}
                {@const isExpanded = expandedCards.has(p.name)}
                <div class="player-item" class:on-map={onMap} class:is-expanded={isExpanded}>
                  <!-- Ligne supérieure compacte et épurée -->
                  <div class="player-top">
                    <!-- Avatar Draggable -->
                    <div
                      class="avatar-drag-handle"
                      draggable="true"
                      title="Glisser-déposer directement sur la carte VTT !"
                      ondragstart={(e) => {
                        if (e.dataTransfer) {
                          const dataStr = JSON.stringify({
                            id: (p as any).id || (p as any).player_id || p.name,
                            name: p.name,
                            hp: hpData.hp,
                            maxHp: hpData.maxHp,
                            imageUrl: p.character?.imageUrl || p.character?.avatar || p.character?.portrait
                          });
                          e.dataTransfer.setData('vtt/player-token', dataStr);
                          e.dataTransfer.setData('text/plain', dataStr);
                          e.dataTransfer.effectAllowed = 'copyMove';
                        }
                      }}
                    >
                      <div class="avatar-circle" style="background-color: hsl({(p.name.length * 75) % 360}, 65%, 40%)">
                        {#if p.character?.imageUrl || p.character?.avatar || p.character?.portrait}
                          <img src={p.character.imageUrl || p.character.avatar || p.character.portrait} alt={p.name} class="avatar-img-fit" />
                        {:else}
                          {p.name.charAt(0).toUpperCase()}
                        {/if}
                      </div>
                      <span class="drag-hint-badge" title="Attrapez pour glisser sur la carte">✋</span>
                    </div>

                    <!-- Infos joueur -->
                    <div class="player-details">
                      <div class="name-row">
                        <span class="player-name" title={p.name}>{p.name}</span>
                        {#if p.has_password}
                          <span class="pwd-dock-badge" title="Protégé par mot de passe">🔒</span>
                        {/if}
                        {#if p.character_path}
                          <span class="char-sync-tag" title="Fiche synchronisée">📄</span>
                        {/if}
                        <button
                          type="button"
                          class="quick-edit-btn"
                          onclick={() => openQuickEdit(p)}
                          title="Modifier la fiche et le compte de {p.name}"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          class="quick-del-btn"
                          onclick={() => handleDeletePlayer(p.name)}
                          title="Supprimer définitivement {p.name}"
                        >
                          🗑️
                        </button>
                      </div>
                      <div class="sub-status">
                        <span class={p.is_online ? "dot-online" : "dot-offline"}></span>
                        <span>{p.is_online ? (p.character?.voc || p.character?.race || 'En ligne') : 'Hors-ligne'}</span>
                      </div>
                    </div>

                    <!-- Outils rapides en haut à droite : Chuchoter & Déplier -->
                    <div class="player-top-tools">
                      <button
                        type="button"
                        class="map-btn whisper-btn"
                        onclick={() => openWhisperModal(p)}
                        title="🤫 Chuchoter un secret IA sur le smartphone de ce joueur"
                      >
                        🤫
                      </button>
                      <button
                        type="button"
                        class="map-btn expand-btn"
                        class:active={isExpanded}
                        onclick={() => togglePlayerExpand(p.name)}
                        title={isExpanded ? "Replier les contrôles" : "Déplier réglages PV et conditions"}
                      >
                        {isExpanded ? '▲' : '⚙️'}
                      </button>
                    </div>
                  </div>

                  <!-- Ligne Basse : Jauge PV fine + Santé & Actions Placer/Focus alignés à droite -->
                  <div class="player-footer-row">
                    <div class="mini-hp-track">
                      <div 
                        class="mini-hp-fill" 
                        style="width: {hpData.pct}%; background-color: {hpData.pct > 50 ? '#22c55e' : hpData.pct > 20 ? '#eab308' : '#ef4444'};"
                      ></div>
                    </div>

                    <div class="hp-and-map-actions">
                      <div class="compact-hp-box" title="Modifier directement les PV actuels ou PV Max">
                        <input
                          type="number"
                          class="compact-hp-inp cur"
                          value={hpData.hp}
                          min="0"
                          title="Modifier les PV actuels de {p.name}"
                          onclick={(e) => e.stopPropagation()}
                          onchange={(e) => setPlayerHpDirect(p, parseInt(e.currentTarget.value) || 0)}
                        />
                        <span class="compact-hp-slash">/</span>
                        <input
                          type="number"
                          class="compact-hp-inp max"
                          value={hpData.maxHp}
                          min="1"
                          title="Modifier les PV Max de {p.name}"
                          onclick={(e) => e.stopPropagation()}
                          onchange={(e) => setPlayerMaxHpDirect(p, parseInt(e.currentTarget.value) || 1)}
                        />
                        <span class="compact-hp-unit">PV</span>
                      </div>

                      <button
                        type="button"
                        class="map-btn place-target-btn"
                        onclick={() => startPlacement(p)}
                        title="📍 Placer où je veux : cliquez ici puis cliquez n'importe où sur la carte"
                      >
                        📍 Placer
                      </button>
                      {#if onMap}
                        <button
                          type="button"
                          class="map-btn focus-btn"
                          onclick={() => centerCameraOnPlayer(p)}
                          title="Centrer la caméra sur ce pion (sur la carte)"
                        >
                          🎯 Focus
                        </button>
                      {:else}
                        <button
                          type="button"
                          class="map-btn spawn-btn"
                          onclick={() => spawnPlayerTokenNow(p)}
                          title="Poser immédiatement le token au centre de l'écran"
                        >
                          ➕ Poser
                        </button>
                      {/if}
                    </div>
                  </div>

                  <!-- Contrôles détaillés (dépliables d'un clic pour ne pas alourdir la carte) -->
                  {#if isExpanded}
                    <div class="player-expanded-body" transition:slide={{ duration: 140 }}>
                      <div class="hp-row">
                        <span class="hp-text-lbl">PV Actuels : <strong>{hpData.hp} / {hpData.maxHp}</strong></span>
                        <div class="hp-buttons">
                          <button class="hp-btn neg" onclick={() => adjustHp(p, -5)} title="-5 PV">-5</button>
                          <button class="hp-btn neg" onclick={() => adjustHp(p, -1)} title="-1 PV">-1</button>
                          <button class="hp-btn pos" onclick={() => adjustHp(p, 1)} title="+1 PV">+1</button>
                          <button class="hp-btn pos" onclick={() => adjustHp(p, 5)} title="+5 PV">+5</button>
                        </div>
                      </div>

                      <div class="hp-row maxhp-row">
                        <span class="hp-text-lbl">PV Max : <strong>{hpData.maxHp}</strong></span>
                        <div class="hp-buttons">
                          <button class="hp-btn neg" onclick={() => adjustMaxHp(p, -5)} title="-5 PV Max">-5</button>
                          <button class="hp-btn neg" onclick={() => adjustMaxHp(p, -1)} title="-1 PV Max">-1</button>
                          <button class="hp-btn pos" onclick={() => adjustMaxHp(p, 1)} title="+1 PV Max">+1</button>
                          <button class="hp-btn pos" onclick={() => adjustMaxHp(p, 5)} title="+5 PV Max">+5</button>
                        </div>
                      </div>

                      <!-- Conditions Express -->
                      <div class="conditions-row">
                        {#each QUICK_CONDITIONS as cond}
                          {@const hasCond = (p.conditions || []).includes(cond.id)}
                          <button
                            class="condition-pill"
                            class:active={hasCond}
                            onclick={() => toggleCondition(p, cond.id)}
                            title="{hasCond ? 'Retirer' : 'Appliquer'} {cond.label}"
                          >
                            <span>{cond.icon}</span>
                          </button>
                        {/each}

                        <!-- Bouton Jet de dés express -->
                        {#if (p as any).id || (p as any).player_id}
                          {@const pid = (p as any).id || (p as any).player_id}
                          <div class="roll-dropdown-wrap">
                            <button
                              class="roll-trigger-btn"
                              onclick={() => activeRollMenuPlayerId = activeRollMenuPlayerId === pid ? null : pid}
                              title="Demander un test / jet au joueur"
                            >
                              🎲 Jet ▾
                            </button>
                            {#if activeRollMenuPlayerId === pid}
                              <div class="roll-menu" transition:slide={{ duration: 120 }}>
                                {#each QUICK_ROLLS as r}
                                  <button
                                    class="roll-menu-item"
                                    onclick={() => sendRollRequest(pid, r.key, r.lbl)}
                                  >
                                    {r.lbl}
                                  </button>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {:else}
          <!-- Onglet Fiches du Coffre -->
          {#if vaultCharacters.length === 0}
            <div class="dock-empty">
              <span class="empty-icon">📁</span>
              <p>Aucune fiche trouvée dans le coffre.</p>
              <span class="empty-hint">Créez des fiches dans un dossier <code>Personnages/</code> avec frontmatter <code>hp</code> et <code>maxhp</code>.</span>
            </div>
          {:else}
            <div class="player-list">
              {#each vaultCharacters as vc (vc.path)}
                {@const hpData = getVaultCharHp(vc)}
                {@const onMap = isTokenOnMap(vc)}
                {@const isExpanded = expandedCards.has(vc.path)}
                <div class="player-item" class:on-map={onMap} class:is-expanded={isExpanded}>
                  <div class="player-top">
                    <!-- Avatar Draggable -->
                    <div
                      class="avatar-drag-handle"
                      draggable="true"
                      title="Glisser sur la carte pour poser ce personnage"
                      ondragstart={(e) => {
                        if (e.dataTransfer) {
                          const dataStr = JSON.stringify({
                            id: vc.path,
                            name: vc.name,
                            hp: hpData.hp,
                            maxHp: hpData.maxHp,
                            imageUrl: undefined
                          });
                          e.dataTransfer.setData('vtt/player-token', dataStr);
                          e.dataTransfer.setData('text/plain', dataStr);
                          e.dataTransfer.effectAllowed = 'copyMove';
                        }
                      }}
                    >
                      <div class="avatar-circle" style="background-color: #3b82f6;">
                        {vc.name.charAt(0).toUpperCase()}
                      </div>
                      <span class="drag-hint-badge">✋</span>
                    </div>

                    <div class="player-details">
                      <div class="name-row">
                        <span class="player-name" title={vc.name}>{vc.name}</span>
                      </div>
                      <div class="sub-status">
                        <span>{vc.data.voc || vc.data.race || 'Fiche Coffre'}</span>
                      </div>
                    </div>

                    <!-- Outils rapides en haut à droite : Déplier -->
                    <div class="player-top-tools">
                      <button
                        type="button"
                        class="map-btn expand-btn"
                        class:active={isExpanded}
                        onclick={() => togglePlayerExpand(vc.path)}
                        title={isExpanded ? "Replier les contrôles" : "Déplier réglages PV"}
                      >
                        {isExpanded ? '▲' : '⚙️'}
                      </button>
                    </div>
                  </div>

                  <!-- Ligne Basse : Jauge PV fine + Santé & Actions Placer/Focus alignés à droite -->
                  <div class="player-footer-row">
                    <div class="mini-hp-track">
                      <div 
                        class="mini-hp-fill" 
                        style="width: {hpData.pct}%; background-color: {hpData.pct > 50 ? '#22c55e' : hpData.pct > 20 ? '#eab308' : '#ef4444'};"
                      ></div>
                    </div>

                    <div class="hp-and-map-actions">
                      <div class="compact-hp-box" title="Modifier directement les PV ou PV Max">
                        <input
                          type="number"
                          class="compact-hp-inp cur"
                          value={hpData.hp}
                          min="0"
                          title="Modifier les PV de {vc.name}"
                          onclick={(e) => e.stopPropagation()}
                          onchange={(e) => setVaultCharHpDirect(vc, parseInt(e.currentTarget.value) || 0)}
                        />
                        <span class="compact-hp-slash">/</span>
                        <input
                          type="number"
                          class="compact-hp-inp max"
                          value={hpData.maxHp}
                          min="1"
                          title="Modifier les PV Max de {vc.name}"
                          onclick={(e) => e.stopPropagation()}
                          onchange={(e) => setVaultCharMaxHpDirect(vc, parseInt(e.currentTarget.value) || 1)}
                        />
                        <span class="compact-hp-unit">PV</span>
                      </div>

                      <button
                        type="button"
                        class="map-btn place-target-btn"
                        onclick={() => startPlacement({ id: vc.path, name: vc.name, character: vc.data })}
                        title="📍 Placer où je veux : cliquez ici puis cliquez n'importe où sur la carte"
                      >
                        📍 Placer
                      </button>
                      {#if onMap}
                        <button
                          type="button"
                          class="map-btn focus-btn"
                          onclick={() => centerCameraOnPlayer(vc)}
                          title="Centrer la caméra sur ce token"
                        >
                          🎯 Focus
                        </button>
                      {:else}
                        <button
                          type="button"
                          class="map-btn spawn-btn"
                          onclick={() => spawnPlayerTokenNow({ id: vc.path, name: vc.name, character: vc.data })}
                          title="Poser le token au centre de l'écran"
                        >
                          ➕ Poser
                        </button>
                      {/if}
                    </div>
                  </div>

                  <!-- Contrôles détaillés -->
                  {#if isExpanded}
                    <div class="player-expanded-body" transition:slide={{ duration: 140 }}>
                      <div class="hp-row">
                        <span class="hp-text-lbl">PV Actuels : <strong>{hpData.hp} / {hpData.maxHp}</strong></span>
                        <div class="hp-buttons">
                          <button class="hp-btn neg" onclick={() => adjustVaultCharHp(vc, -5)} title="-5 PV">-5</button>
                          <button class="hp-btn neg" onclick={() => adjustVaultCharHp(vc, -1)} title="-1 PV">-1</button>
                          <button class="hp-btn pos" onclick={() => adjustVaultCharHp(vc, 1)} title="+1 PV">+1</button>
                          <button class="hp-btn pos" onclick={() => adjustVaultCharHp(vc, 5)} title="+5 PV">+5</button>
                        </div>
                      </div>

                      <div class="hp-row maxhp-row">
                        <span class="hp-text-lbl">PV Max : <strong>{hpData.maxHp}</strong></span>
                        <div class="hp-buttons">
                          <button class="hp-btn neg" onclick={() => adjustVaultCharMaxHp(vc, -5)} title="-5 PV Max">-5</button>
                          <button class="hp-btn neg" onclick={() => adjustVaultCharMaxHp(vc, -1)} title="-1 PV Max">-1</button>
                          <button class="hp-btn pos" onclick={() => adjustVaultCharMaxHp(vc, 1)} title="+1 PV Max">+1</button>
                          <button class="hp-btn pos" onclick={() => adjustVaultCharMaxHp(vc, 5)} title="+5 PV Max">+5</button>
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <!-- Pied de panneau : Astuce & Statut -->
      <div class="dock-footer">
        <span class="drag-tip">💡 Cliquez sur <strong>📍 Placer</strong> puis cliquez sur la carte, ou attrapez l'avatar pour le glisser</span>
      </div>

      <!-- Modale Murmure Secret IA -->
      {#if whisperTargetPlayer}
        <div class="dock-edit-overlay" transition:fade={{ duration: 150 }}>
          <div class="dock-edit-modal whisper-modal" transition:slide={{ duration: 150 }}>
            <div class="dock-edit-header">
              <div class="header-title-box">
                <span class="header-icon">🤫</span>
                <div>
                  <h4>Murmure Secret IA</h4>
                  <span class="header-acc-name">Pour {whisperTargetPlayer.name} uniquement</span>
                </div>
              </div>
              <button class="dock-btn-close-sm" onclick={() => whisperTargetPlayer = null}>✕</button>
            </div>

            <div class="whisper-body">
              <label class="whisper-label">
                Message secret (sera lu ou affiché sur son smartphone) :
              </label>
              <textarea
                class="whisper-textarea"
                rows="3"
                bind:value={whisperContent}
                placeholder="Ex : Tu ressens une présence glaciale qui s'approche de ton dos..."
              ></textarea>

              <div class="whisper-presets">
                <button type="button" class="preset-chip" onclick={() => whisperContent = "Tu sens qu'on t'observe dans l'ombre..."}>
                  👁️ Ombre
                </button>
                <button type="button" class="preset-chip" onclick={() => whisperContent = "Un frisson magique parcourt ton échine..."}>
                  🔮 Frisson
                </button>
                <button type="button" class="preset-chip" onclick={() => whisperContent = "Une voix venue d'outre-tombe résonne dans ta tête..."}>
                  💀 Voix
                </button>
              </div>

              <div class="whisper-footer">
                <button type="button" class="dock-btn-cancel" onclick={() => whisperTargetPlayer = null}>Annuler</button>
                <button
                  type="button"
                  class="whisper-submit-btn"
                  onclick={sendSecretWhisper}
                  disabled={!whisperContent.trim() || isSendingWhisper}
                >
                  {isSendingWhisper ? '⏳ Transmission…' : '🎙️ Envoyer à l\'oreille !'}
                </button>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Quick Edit Modal -->
      {#if quickEditAccount}
        <div class="dock-edit-overlay" transition:fade={{ duration: 150 }}>
          <div class="dock-edit-modal" transition:slide={{ duration: 150 }}>
            <div class="dock-edit-header">
              <div class="header-title-box">
                <span class="header-icon">🧙‍♂️</span>
                <div>
                  <h4>Fiche & Options Joueur</h4>
                  <span class="header-acc-name">{quickEditAccount.name}</span>
                </div>
              </div>
              <button class="dock-btn-close-sm" onclick={() => quickEditAccount = null}>✕</button>
            </div>

            <!-- Sous-Onglets d'Édition -->
            <div class="dock-subtabs">
              <button 
                class="dock-subtab-btn {editModalTab === 'stats' ? 'active' : ''}"
                onclick={() => editModalTab = 'stats'}
              >
                🛡️ Combat & Stats
              </button>
              <button 
                class="dock-subtab-btn {editModalTab === 'token' ? 'active' : ''}"
                onclick={() => editModalTab = 'token'}
              >
                🎨 Pion & VTT
              </button>
              <button 
                class="dock-subtab-btn {editModalTab === 'account' ? 'active' : ''}"
                onclick={() => editModalTab = 'account'}
              >
                ⚙️ Compte & Fiche MD
              </button>
            </div>

            <div class="dock-edit-body">
              {#if editModalTab === 'stats'}
                <!-- Onglet 1 : Stats & Combat -->
                <div class="dock-tab-section">
                  <label class="dock-field-lbl">
                    <span>Nom du personnage</span>
                    <input type="text" bind:value={quickEditForm.nom} class="dock-inp" />
                  </label>

                  <div class="dock-row-2">
                    <label class="dock-field-lbl">
                      <span>Race / Peuple</span>
                      <input type="text" bind:value={quickEditForm.race} placeholder="Humain, Elfe..." class="dock-inp" />
                    </label>
                    <label class="dock-field-lbl">
                      <span>Métier / Classe</span>
                      <input type="text" bind:value={quickEditForm.voc} placeholder="Guerrier, Voleur..." class="dock-inp" />
                    </label>
                  </div>

                  <div class="dock-row-3">
                    <label class="dock-field-lbl">
                      <span>PV Actuels</span>
                      <input type="number" bind:value={quickEditForm.hp} min="0" class="dock-inp" />
                    </label>
                    <label class="dock-field-lbl">
                      <span>PV Max</span>
                      <input type="number" bind:value={quickEditForm.maxhp} min="1" class="dock-inp" />
                    </label>
                    <label class="dock-field-lbl">
                      <span>CA / Armure</span>
                      <input type="number" bind:value={quickEditForm.ac} min="0" class="dock-inp" />
                    </label>
                  </div>

                  <div class="dock-row-2">
                    <label class="dock-field-lbl">
                      <span>Vitesse (M)</span>
                      <input type="number" bind:value={quickEditForm.speed} min="1" class="dock-inp" />
                    </label>
                    <label class="dock-field-lbl">
                      <span>Initiative (I)</span>
                      <input type="number" bind:value={quickEditForm.initiative} min="0" class="dock-inp" />
                    </label>
                  </div>

                  <div class="dock-row-4">
                    <label class="dock-field-lbl">
                      <span>Destin</span>
                      <input type="number" bind:value={quickEditForm.destin} min="0" class="dock-inp" />
                    </label>
                    <label class="dock-field-lbl">
                      <span>Fortune</span>
                      <input type="number" bind:value={quickEditForm.fortune} min="0" class="dock-inp" />
                    </label>
                    <label class="dock-field-lbl">
                      <span>Résilience</span>
                      <input type="number" bind:value={quickEditForm.resilience} min="0" class="dock-inp" />
                    </label>
                    <label class="dock-field-lbl">
                      <span>Résolution</span>
                      <input type="number" bind:value={quickEditForm.resolution} min="0" class="dock-inp" />
                    </label>
                  </div>
                </div>

              {:else if editModalTab === 'token'}
                <!-- Onglet 2 : Avatar & Pion VTT -->
                <div class="dock-tab-section">
                  <div class="avatar-custom-row">
                    <div class="avatar-preview-box">
                      {#if quickEditForm.imageUrl}
                        <img src={quickEditForm.imageUrl} alt="Avatar" class="avatar-preview-img" />
                      {:else}
                        <span class="avatar-preview-placeholder">👤</span>
                      {/if}
                    </div>

                    <div class="avatar-actions-col">
                      <span class="avatar-label">Illustration / Portrait du Joueur</span>
                      <div class="avatar-btns-grid">
                        <button 
                          class="dock-btn-celestial"
                          onclick={() => {
                            avatarPickerTarget = 'quickEdit';
                            showAvatarPicker = true;
                          }}
                        >
                          🌌 Galerie Céleste
                        </button>
                        <button 
                          class="dock-btn-pc"
                          onclick={() => {
                            avatarPickerTarget = 'quickEdit';
                            avatarFileInputRef?.click();
                          }}
                        >
                          📁 Mon Image (PC)
                        </button>
                      </div>
                      {#if quickEditForm.imageUrl}
                        <button 
                          class="dock-btn-clear-img"
                          onclick={() => quickEditForm.imageUrl = ''}
                        >
                          Effacer le portrait
                        </button>
                      {/if}
                    </div>
                  </div>

                  <div class="dock-row-2">
                    <label class="dock-field-lbl">
                      <span>Taille du Pion VTT</span>
                      <select bind:value={quickEditForm.tokenSize} class="dock-inp">
                        <option value={1}>Normal (1 case - 1x1)</option>
                        <option value={2}>Grand (2 cases - 2x2)</option>
                        <option value={3}>Très Grand (3 cases - 3x3)</option>
                        <option value={4}>Gigantesque (4 cases - 4x4)</option>
                      </select>
                    </label>

                    <label class="dock-field-lbl">
                      <span>Vision Nocturne (mètres)</span>
                      <input type="number" bind:value={quickEditForm.visionRange} min="0" step="5" placeholder="0 = normale" class="dock-inp" />
                    </label>
                  </div>

                  <!-- Contrôle Rapide Carte VTT -->
                  <div class="vtt-quick-actions">
                    <button 
                      class="dock-btn-vtt-action {isTokenOnMap(quickEditAccount) ? 'btn-remove-map' : 'btn-spawn-map'}"
                      onclick={toggleTokenInEditModal}
                    >
                      {isTokenOnMap(quickEditAccount) ? '❌ Retirer le Pion de la Carte VTT' : '🗺️ Poser le Pion sur la Carte VTT'}
                    </button>

                    {#if isTokenOnMap(quickEditAccount)}
                      <button 
                        class="dock-btn-focus-cam"
                        onclick={() => quickEditAccount && centerCameraOnPlayer(quickEditAccount)}
                      >
                        🎯 Centrer la Caméra (Focus)
                      </button>
                    {/if}
                  </div>
                </div>

              {:else if editModalTab === 'account'}
                <!-- Onglet 3 : Compte Mobile & Fiche MD -->
                <div class="dock-tab-section">
                  <label class="dock-field-lbl">
                    <span>Mot de passe connexion Joueur (Mobile GSM)</span>
                    <input type="text" bind:value={quickEditForm.password} placeholder="Vide = connexion libre sans code" class="dock-inp" />
                    <span class="field-hint">Permet au joueur de se reconnecter sur son smartphone avec ses données.</span>
                  </label>

                  <label class="dock-field-lbl">
                    <span>Fiche Markdown liée (.md)</span>
                    <select bind:value={quickEditForm.character_path} class="dock-inp">
                      <option value="">-- Aucune fiche liée --</option>
                      {#each vaultCharacters as vc}
                        <option value={vc.path}>{vc.name} ({vc.path})</option>
                      {/each}
                    </select>
                  </label>

                  {#if quickEditForm.character_path}
                    <button 
                      class="dock-btn-open-md"
                      onclick={() => {
                        setActiveFile(quickEditForm.character_path);
                        notifStore.add('📄', 'Grimoire', `Fiche ouverte : ${quickEditForm.character_path}`, 'info', 2000);
                      }}
                    >
                      📄 Ouvrir cette fiche dans l'éditeur
                    </button>
                  {/if}

                  <div class="danger-zone-box">
                    <span class="danger-title">Zone de Danger</span>
                    <button 
                      class="dock-btn-del-full" 
                      onclick={() => quickEditAccount && handleDeletePlayer(quickEditAccount.name)}
                    >
                      🗑️ Supprimer définitivement ce joueur et son compte
                    </button>
                  </div>
                </div>
              {/if}
            </div>

            <div class="dock-edit-footer">
              <button class="dock-btn-save" onclick={saveQuickEdit}>💾 Enregistrer les Modifications</button>
              <button class="dock-btn-cancel" onclick={() => quickEditAccount = null}>Fermer</button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Modal Créer un Nouveau Joueur -->
      {#if isCreatingPlayer}
        <div class="dock-edit-overlay" transition:fade={{ duration: 150 }}>
          <div class="dock-edit-modal" transition:slide={{ duration: 150 }}>
            <div class="dock-edit-header">
              <div class="header-title-box">
                <span class="header-icon">➕</span>
                <h4>Nouveau Joueur / Personnage</h4>
              </div>
              <button class="dock-btn-close-sm" onclick={() => isCreatingPlayer = false}>✕</button>
            </div>

            <div class="dock-edit-body">
              <div class="dock-tab-section">
                <label class="dock-field-lbl">
                  <span>Nom du personnage *</span>
                  <input type="text" bind:value={newPlayerForm.nom} placeholder="ex: Valeros, Elina, Thorgar..." class="dock-inp" />
                </label>

                <!-- Avatar rapide -->
                <div class="avatar-custom-row">
                  <div class="avatar-preview-box">
                    {#if newPlayerForm.imageUrl}
                      <img src={newPlayerForm.imageUrl} alt="Avatar" class="avatar-preview-img" />
                    {:else}
                      <span class="avatar-preview-placeholder">👤</span>
                    {/if}
                  </div>
                  <div class="avatar-actions-col">
                    <span class="avatar-label">Illustration / Avatar</span>
                    <div class="avatar-btns-grid">
                      <button 
                        class="dock-btn-celestial"
                        onclick={() => {
                          avatarPickerTarget = 'newPlayer';
                          showAvatarPicker = true;
                        }}
                      >
                        🌌 Galerie Céleste
                      </button>
                      <button 
                        class="dock-btn-pc"
                        onclick={() => {
                          avatarPickerTarget = 'newPlayer';
                          avatarFileInputRef?.click();
                        }}
                      >
                        📁 Mon Image (PC)
                      </button>
                    </div>
                  </div>
                </div>

                <div class="dock-row-2">
                  <label class="dock-field-lbl">
                    <span>Race / Peuple</span>
                    <input type="text" bind:value={newPlayerForm.race} placeholder="Humain, Elfe, Nain..." class="dock-inp" />
                  </label>
                  <label class="dock-field-lbl">
                    <span>Métier / Classe</span>
                    <input type="text" bind:value={newPlayerForm.voc} placeholder="Guerrier, Mage, Roublard..." class="dock-inp" />
                  </label>
                </div>

                <div class="dock-row-3">
                  <label class="dock-field-lbl">
                    <span>PV Max</span>
                    <input type="number" bind:value={newPlayerForm.maxhp} class="dock-inp" min="1" />
                  </label>
                  <label class="dock-field-lbl">
                    <span>PV Actuels</span>
                    <input type="number" bind:value={newPlayerForm.hp} class="dock-inp" min="0" />
                  </label>
                  <label class="dock-field-lbl">
                    <span>CA / Armure</span>
                    <input type="number" bind:value={newPlayerForm.ac} class="dock-inp" min="0" />
                  </label>
                </div>

                <label class="dock-field-lbl">
                  <span>Mot de passe mobile (optionnel)</span>
                  <input type="text" bind:value={newPlayerForm.password} placeholder="Vide = connexion libre sans mot de passe" class="dock-inp" />
                </label>

                <label class="dock-checkbox-lbl">
                  <input type="checkbox" bind:checked={newPlayerForm.spawnOnMap} />
                  <span>Poser directement le pion sur la carte VTT</span>
                </label>
              </div>
            </div>

            <div class="dock-edit-footer">
              <button class="dock-btn-save" onclick={createNewPlayer}>✨ Créer le Joueur</button>
              <button class="dock-btn-cancel" onclick={() => isCreatingPlayer = false}>Annuler</button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Sélecteur d'Avatar Galerie Céleste -->
      {#if showAvatarPicker}
        <CelestialArtPickerModal
          onselect={(url: string, name?: string, isEmoji?: boolean) => {
            if (avatarPickerTarget === 'quickEdit') {
              quickEditForm.imageUrl = url;
            } else {
              newPlayerForm.imageUrl = url;
              if (name && !newPlayerForm.nom) newPlayerForm.nom = name;
            }
            showAvatarPicker = false;
          }}
          onclose={() => showAvatarPicker = false}
        />
      {/if}

      <!-- Input file masqué pour l'import d'image PC -->
      <input 
        type="file" 
        accept="image/*" 
        style="display:none" 
        bind:this={avatarFileInputRef} 
        onchange={handleAvatarFileUpload} 
      />
    </div>
  {/if}
{/if}

<style>
  /* ── Mode Réduit ──────────────────────────────────────────────── */
  .player-dock-collapsed {
    position: fixed;
    z-index: 900;
    pointer-events: auto;
  }

  .dock-tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(15, 18, 26, 0.95);
    border: 1px solid var(--border, #2d3748);
    border-right: 3px solid var(--accent, #e5a853);
    color: var(--text-primary, #f7fafc);
    padding: 7px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    transition: transform 0.15s, background 0.15s;
  }
  .dock-tab-btn:hover {
    background: rgba(26, 32, 44, 0.98);
    transform: scale(1.03);
  }
  .dock-tab-icon { font-size: 15px; }
  .online-indicator-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 6px #22c55e;
  }
  .dock-tab-arrow { font-size: 10px; color: var(--accent, #e5a853); }

  /* ── Fenêtre Flottante Déplaçable ─────────────────────────────── */
  .player-dock {
    position: fixed;
    z-index: 900;
    width: 360px;
    min-width: 330px;
    max-width: 95vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    background: rgba(14, 17, 24, 0.98);
    border: 1px solid var(--border, #2e384d);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
    overflow: hidden;
    user-select: none;
  }
  .player-dock.is-dragging {
    opacity: 0.92;
    cursor: grabbing;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
  }

  /* ── Barre de Titre ──────────────────────────────────────────── */
  .dock-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: rgba(229, 168, 83, 0.08);
    border-bottom: 1px solid var(--border, #2e384d);
    cursor: grab;
  }
  .dock-header:active {
    cursor: grabbing;
  }

  .dock-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    font-size: 12px;
    color: var(--accent, #e5a853);
    letter-spacing: 0.3px;
  }
  .drag-grip {
    color: #64748b;
    font-size: 13px;
    cursor: grab;
  }
  .dock-icon { font-size: 14px; }
  .badge-count {
    background: #22c55e;
    color: #052e16;
    font-size: 10px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 10px;
  }

  .dock-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .icon-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 12px;
    padding: 3px 5px;
    border-radius: 4px;
    line-height: 1;
    transition: background 0.15s, color 0.15s;
  }
  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f8fafc;
  }
  .close-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
  }
  .spinning {
    display: inline-block;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* ── Navigation Onglets ───────────────────────────────────────── */
  .dock-nav {
    display: flex;
    border-bottom: 1px solid var(--border, #2e384d);
    background: rgba(0, 0, 0, 0.2);
  }
  .nav-tab {
    flex: 1;
    padding: 6px 4px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .nav-tab:hover {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.03);
  }
  .nav-tab.active {
    color: var(--accent, #e5a853);
    border-bottom-color: var(--accent, #e5a853);
    background: rgba(229, 168, 83, 0.05);
  }

  /* ── Corps et Liste ───────────────────────────────────────────── */
  .dock-body {
    flex: 1;
    overflow-y: auto;
    max-height: 480px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .dock-empty {
    padding: 20px 10px;
    text-align: center;
    color: #64748b;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .empty-icon { font-size: 24px; opacity: 0.6; }
  .dock-empty p { margin: 0; font-size: 12px; font-weight: 600; color: #94a3b8; }
  .empty-hint { font-size: 11px; line-height: 1.4; color: #64748b; }

  .player-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .player-item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 0.15s, background 0.15s;
  }
  .player-item:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.12);
  }
  .player-item.on-map {
    border-left: 3px solid #22c55e;
  }

  /* ── Haut de carte joueur ─────────────────────────────────────── */
  .player-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .avatar-drag-handle {
    position: relative;
    cursor: grab;
    flex-shrink: 0;
  }
  .avatar-drag-handle:active {
    cursor: grabbing;
  }
  .avatar-circle {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-weight: 700;
    font-size: 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transition: transform 0.15s, border-color 0.15s;
  }
  .avatar-drag-handle:hover .avatar-circle {
    transform: scale(1.08);
    border-color: var(--accent, #e5a853);
  }
  .drag-hint-badge {
    position: absolute;
    bottom: -3px;
    right: -3px;
    font-size: 10px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 50%;
    padding: 1px;
    line-height: 1;
  }

  .player-details {
    flex: 1;
    min-width: 0;
  }
  .name-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .player-name {
    font-weight: 600;
    font-size: 13px;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .char-sync-tag { font-size: 11px; opacity: 0.8; }
  .pwd-dock-badge { font-size: 10px; }
  .quick-edit-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
    opacity: 0.6;
    transition: opacity 0.15s;
  }
  .quick-edit-btn:hover { opacity: 1; }
  .sub-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #94a3b8;
  }
  .player-top-tools {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    flex-shrink: 0;
  }
  .player-footer-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    padding: 0 1px;
  }
  .player-footer-row .mini-hp-track {
    flex: 1;
    min-width: 30px;
    height: 4px;
    margin: 0;
  }
  .hp-and-map-actions {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-left: auto;
    flex-shrink: 0;
    flex-wrap: nowrap;
  }
  .compact-hp-box {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    white-space: nowrap;
    padding: 2px 5px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.15);
    font-size: 11px;
    font-weight: 700;
  }
  .compact-hp-box:hover, .compact-hp-box:focus-within {
    border-color: var(--accent);
    background: rgba(0, 0, 0, 0.65);
  }
  .compact-hp-inp {
    width: 28px;
    background: transparent;
    border: none;
    outline: none;
    text-align: center;
    font-size: 11px;
    font-weight: 800;
    font-family: inherit;
    padding: 0;
    margin: 0;
    -moz-appearance: textfield;
  }
  .compact-hp-inp::-webkit-outer-spin-button,
  .compact-hp-inp::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .compact-hp-inp.cur {
    color: #4ade80;
  }
  .compact-hp-inp.max {
    color: #cbd5e1;
  }
  .compact-hp-inp:focus {
    background: rgba(229, 168, 83, 0.2);
    border-radius: 2px;
    color: #fff;
  }
  .compact-hp-slash {
    color: #64748b;
    font-weight: 600;
    font-size: 10px;
    user-select: none;
  }
  .compact-hp-unit {
    color: #94a3b8;
    font-size: 9px;
    font-weight: 700;
    user-select: none;
    margin-left: 1px;
  }
  .maxhp-row {
    border-top: 1px dashed rgba(255, 255, 255, 0.08);
    padding-top: 6px;
    margin-top: 4px;
  }
  .dot-online {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
  }
  .dot-offline {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #64748b;
  }

  .map-action-col {
    flex-shrink: 0;
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .map-btn {
    border: none;
    border-radius: 4px;
    padding: 3px 6px;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .map-btn:active { transform: scale(0.96); }
  .expand-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    padding: 3px 5px;
    font-size: 10px;
  }
  .expand-btn:hover, .expand-btn.active {
    background: rgba(229, 168, 83, 0.2);
    color: var(--accent, #e5a853);
    border-color: var(--accent, #e5a853);
  }

  /* ── Jauge Fine ── */
  .mini-hp-track {
    width: 100%;
    height: 3px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 2px;
  }
  .mini-hp-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.25s ease;
  }

  /* ── Volet Depliable ── */
  .player-expanded-body {
    padding-top: 6px;
    border-top: 1px dashed rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hp-text-lbl {
    font-size: 11px;
    color: #94a3b8;
  }
  .place-target-btn {
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.4);
    color: #38bdf8;
  }
  .place-target-btn:hover {
    background: rgba(56, 189, 248, 0.3);
    color: #fff;
  }
  .focus-btn {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.4);
    color: #4ade80;
  }
  .focus-btn:hover {
    background: rgba(34, 197, 94, 0.25);
  }
  .spawn-btn {
    background: rgba(229, 168, 83, 0.15);
    border: 1px solid rgba(229, 168, 83, 0.4);
    color: var(--accent, #e5a853);
  }
  .spawn-btn:hover {
    background: rgba(229, 168, 83, 0.25);
  }

  /* ── Barre de PV et Ajustements ───────────────────────────────── */
  .hp-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }


  .hp-buttons {
    display: flex;
    gap: 2px;
  }
  .hp-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
    font-size: 10px;
    font-weight: 700;
    font-family: monospace;
    padding: 2px 4px;
    min-width: 22px;
    border-radius: 3px;
    cursor: pointer;
    line-height: 1;
    transition: background 0.1s;
  }
  .hp-btn.neg:hover { background: rgba(239, 68, 68, 0.3); border-color: #ef4444; }
  .hp-btn.pos:hover { background: rgba(34, 197, 94, 0.3); border-color: #22c55e; }

  /* ── Conditions & Roll ────────────────────────────────────────── */
  .conditions-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .condition-pill {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 2px 4px;
    font-size: 11px;
    cursor: pointer;
    line-height: 1;
    opacity: 0.55;
    transition: opacity 0.15s, background 0.15s, border-color 0.15s;
  }
  .condition-pill:hover {
    opacity: 0.85;
    background: rgba(255, 255, 255, 0.1);
  }
  .condition-pill.active {
    opacity: 1;
    background: rgba(229, 168, 83, 0.25);
    border-color: var(--accent, #e5a853);
    box-shadow: 0 0 4px rgba(229, 168, 83, 0.4);
  }

  .roll-dropdown-wrap {
    position: relative;
    margin-left: auto;
  }
  .roll-trigger-btn {
    background: rgba(147, 51, 234, 0.15);
    border: 1px solid rgba(147, 51, 234, 0.4);
    color: #c084fc;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .roll-trigger-btn:hover {
    background: rgba(147, 51, 234, 0.3);
  }

  .roll-menu {
    position: absolute;
    right: 0;
    top: 100%;
    margin-top: 4px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    z-index: 100;
    min-width: 140px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .roll-menu-item {
    background: transparent;
    border: none;
    color: #cbd5e1;
    font-size: 11px;
    text-align: left;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }
  .roll-menu-item:hover {
    background: rgba(229, 168, 83, 0.15);
    color: var(--accent, #e5a853);
  }

  /* ── Pied de page ─────────────────────────────────────────────── */
  .dock-footer {
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.25);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    text-align: center;
  }
  .drag-tip {
    font-size: 10px;
    color: #64748b;
  }

  /* ── Quick Edit Modal ─────────────────────────────────────────── */
  .dock-edit-overlay {
    position: fixed;
    inset: 0;
    background: rgba(4, 7, 15, 0.82);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .dock-edit-modal {
    background: #0f172a;
    border: 1px solid rgba(229, 168, 83, 0.5);
    border-radius: 14px;
    width: 480px;
    max-width: 95vw;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9), 0 0 20px rgba(229, 168, 83, 0.2);
    overflow: hidden;
  }
  .dock-edit-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.4);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .header-title-box {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .header-icon {
    font-size: 20px;
  }
  .dock-edit-header h4 {
    margin: 0;
    font-size: 13px;
    color: var(--accent, #e5a853);
    font-weight: 700;
    line-height: 1.2;
  }
  .header-acc-name {
    font-size: 11px;
    color: #94a3b8;
  }
  .dock-btn-close-sm {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 14px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.15s, color 0.15s;
  }
  .dock-btn-close-sm:hover { 
    background: rgba(255, 255, 255, 0.1); 
    color: #f1f5f9; 
  }

  /* ── Sous-Onglets d'Édition ────────────────────────────────────── */
  .dock-subtabs {
    display: flex;
    background: rgba(0, 0, 0, 0.25);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding: 4px 12px 0 12px;
    gap: 4px;
  }
  .dock-subtab-btn {
    flex: 1;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    padding: 8px 4px;
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
  }
  .dock-subtab-btn:hover {
    color: #f1f5f9;
  }
  .dock-subtab-btn.active {
    color: var(--accent, #e5a853);
    border-bottom-color: var(--accent, #e5a853);
    background: rgba(229, 168, 83, 0.08);
    border-radius: 6px 6px 0 0;
  }

  /* ── Corps & Formulaire ───────────────────────────────────────── */
  .dock-edit-body {
    padding: 14px 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: calc(88vh - 125px);
  }
  .dock-tab-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dock-field-lbl {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 11px;
    color: #94a3b8;
    font-weight: 500;
  }
  .field-hint {
    font-size: 10px;
    color: #64748b;
    margin-top: 1px;
  }
  .dock-inp {
    background: #020617;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 11px;
    color: white;
    outline: none;
    transition: border-color 0.15s;
  }
  .dock-inp:focus { border-color: var(--accent, #e5a853); }
  .dock-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .dock-row-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }
  .dock-row-4 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 6px;
  }

  /* ── Avatar & Miniature ────────────────────────────────────────── */
  .avatar-custom-row {
    display: flex;
    align-items: center;
    gap: 14px;
    background: rgba(0, 0, 0, 0.25);
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .avatar-preview-box {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 2px solid var(--accent, #e5a853);
    background: #1e293b;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
  }
  .avatar-preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .avatar-preview-placeholder {
    font-size: 26px;
    color: #64748b;
  }
  .avatar-actions-col {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }
  .avatar-label {
    font-size: 11px;
    font-weight: 600;
    color: #e2e8f0;
  }
  .avatar-btns-grid {
    display: flex;
    gap: 6px;
  }
  .dock-btn-celestial {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 10px;
    cursor: pointer;
    transition: all 0.15s;
    flex: 1;
  }
  .dock-btn-celestial:hover {
    background: linear-gradient(135deg, #818cf8, #6366f1);
    transform: translateY(-1px);
  }
  .dock-btn-pc {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #e2e8f0;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 10px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .dock-btn-pc:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .dock-btn-clear-img {
    background: transparent;
    border: none;
    color: #ef4444;
    font-size: 10px;
    cursor: pointer;
    align-self: flex-start;
    padding: 0;
    text-decoration: underline;
  }

  /* ── Actions VTT Rapides ───────────────────────────────────────── */
  .vtt-quick-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
  }
  .dock-btn-vtt-action {
    border: none;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .dock-btn-vtt-action.btn-spawn-map {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
  }
  .dock-btn-vtt-action.btn-spawn-map:hover {
    background: linear-gradient(135deg, #34d399, #10b981);
    transform: translateY(-1px);
  }
  .dock-btn-vtt-action.btn-remove-map {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #f87171;
  }
  .dock-btn-vtt-action.btn-remove-map:hover {
    background: rgba(239, 68, 68, 0.25);
  }
  .dock-btn-focus-cam {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.4);
    color: #60a5fa;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 10px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .dock-btn-focus-cam:hover {
    background: rgba(59, 130, 246, 0.25);
  }
  .dock-btn-open-md {
    background: rgba(229, 168, 83, 0.12);
    border: 1px solid rgba(229, 168, 83, 0.4);
    color: var(--accent, #e5a853);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 7px 10px;
    cursor: pointer;
    transition: background 0.15s;
    text-align: center;
  }
  .dock-btn-open-md:hover {
    background: rgba(229, 168, 83, 0.22);
  }
  .danger-zone-box {
    margin-top: 10px;
    padding: 10px;
    border: 1px dashed rgba(239, 68, 68, 0.35);
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.05);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .danger-title {
    font-size: 10px;
    font-weight: 700;
    color: #ef4444;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .dock-btn-del-full {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
    color: #fca5a5;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    text-align: center;
  }
  .dock-btn-del-full:hover {
    background: #ef4444;
    color: white;
  }

  /* ── Footer ───────────────────────────────────────────────────── */
  .dock-edit-footer {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.4);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .dock-btn-save {
    flex: 2;
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    color: white;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.15s;
    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
  }
  .dock-btn-save:hover { 
    background: linear-gradient(135deg, #34d399, #10b981);
    transform: translateY(-1px);
  }
  .dock-btn-cancel {
    flex: 1;
    background: #334155;
    border: none;
    color: #cbd5e1;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .dock-btn-cancel:hover { background: #475569; color: white; }

  .dock-add-player-btn {
    background: rgba(229, 168, 83, 0.15);
    border: 1px solid rgba(229, 168, 83, 0.4);
    border-radius: 4px;
    color: var(--accent, #e5a853);
    font-size: 10px;
    font-weight: 700;
    padding: 3px 7px;
    cursor: pointer;
    margin-left: auto;
    transition: all 0.15s ease;
  }
  .dock-add-player-btn:hover {
    background: var(--accent, #e5a853);
    color: #000;
    transform: none;
    box-shadow: 0 0 8px rgba(229, 168, 83, 0.3);
  }
  .quick-del-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
    opacity: 0.6;
    transition: opacity 0.15s;
  }
  .quick-del-btn:hover {
    opacity: 1;
    filter: drop-shadow(0 0 3px #ef4444);
  }
  .avatar-img-fit {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }
  .dock-checkbox-lbl {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #cbd5e1;
    cursor: pointer;
    margin-top: 4px;
  }

  /* ── Modale Murmure Secret ── */
  .whisper-modal {
    max-width: 360px;
    border-color: rgba(168, 85, 247, 0.45);
  }

  .whisper-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px 14px;
  }

  .whisper-label {
    font-size: 11px;
    color: #cbd5e1;
    font-weight: 500;
  }

  .whisper-textarea {
    width: 100%;
    background: #020617;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    padding: 8px 10px;
    color: #f8fafc;
    font-size: 12px;
    font-family: inherit;
    resize: none;
    outline: none;
    box-sizing: border-box;
  }

  .whisper-textarea:focus {
    border-color: #a855f7;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
  }

  .whisper-presets {
    display: flex;
    gap: 6px;
    margin-top: 2px;
  }

  .preset-chip {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #94a3b8;
    font-size: 10px;
    border-radius: 4px;
    padding: 4px 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .preset-chip:hover {
    background: rgba(168, 85, 247, 0.2);
    color: #e9d5ff;
    border-color: #a855f7;
  }

  .whisper-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  .whisper-submit-btn {
    background: linear-gradient(135deg, #a855f7, #6366f1);
    border: none;
    color: #fff;
    font-weight: 700;
    font-size: 11px;
    padding: 7px 14px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .whisper-submit-btn:hover:not(:disabled) {
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.5);
    transform: translateY(-1px);
  }

  .whisper-submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
