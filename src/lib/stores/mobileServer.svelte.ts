import {
  startPlayerServer,
  stopPlayerServer,
  getServerStatus,
  getPlayerConnections,
  setServerVaultPath,
  isTauri,
  type ServerInfo,
  type PlayerInfo,
} from '$lib/api';
import { getVaultPath } from './vault.svelte';
import { getGameConfig } from './gameConfig.svelte';
import { invoke } from '@tauri-apps/api/core';

// ── Mobile Server Store (Svelte 5 Runes) ──────────────────────────

let serverInfo = $state<ServerInfo | null>(null);
let players = $state<PlayerInfo[]>([]);
let starting = $state<boolean>(false);
let initialized = $state<boolean>(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

export const mobileServerStore = {
  get serverInfo() {
    return serverInfo;
  },
  get isRunning() {
    return serverInfo !== null;
  },
  get players() {
    return players;
  },
  get playerCount() {
    return players.length;
  },
  get starting() {
    return starting;
  },
  get url() {
    return serverInfo?.url ?? '';
  },
  get mjUrl() {
    return serverInfo?.mj_url ?? (serverInfo ? `${serverInfo.url}/mj` : '');
  },

  async refresh() {
    if (!isTauri()) return;
    try {
      const status = await getServerStatus();
      serverInfo = status;
      if (status) {
        players = await getPlayerConnections();
      } else {
        players = [];
      }
    } catch {
      serverInfo = null;
      players = [];
    }
  },

  async start(port?: number): Promise<ServerInfo | null> {
    if (!isTauri() || starting) return null;
    starting = true;
    try {
      const info = await startPlayerServer(port);
      serverInfo = info;
      const cfg = getGameConfig();
      if (cfg) {
        try {
          await invoke('set_game_config', { config: cfg });
        } catch {}
      }
      const vp = getVaultPath();
      if (vp) {
        try {
          await setServerVaultPath(vp);
        } catch {}
      }
      players = await getPlayerConnections();
      mobileServerStore.startPolling();
      return info;
    } catch (e) {
      console.error('Erreur démarrage serveur mobile:', e);
      return null;
    } finally {
      starting = false;
    }
  },

  async stop(): Promise<void> {
    if (!isTauri()) return;
    try {
      await stopPlayerServer();
    } catch (e) {
      console.error('Erreur arrêt serveur mobile:', e);
    } finally {
      serverInfo = null;
      players = [];
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
  },

  async toggle(): Promise<void> {
    if (serverInfo) {
      await mobileServerStore.stop();
    } else {
      await mobileServerStore.start();
    }
  },

  startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (!serverInfo) return;
      try {
        players = await getPlayerConnections();
      } catch {}
    }, 4000);
  },

  async init() {
    if (initialized || !isTauri()) return;
    initialized = true;
    await mobileServerStore.refresh();
    if (serverInfo) {
      mobileServerStore.startPolling();
    }
  },
};
