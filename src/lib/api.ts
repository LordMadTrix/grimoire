import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';

// ── Types ────────────────────────────────────────────────────────

export interface VaultEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: VaultEntry[];
  extension?: string;
  size?: number;
}

export interface SearchResult {
  path: string;
  title: string;
  entity_type: string;
  tags: string;
  snippet: string;
  rank: number;
}

export interface BacklinkResult {
  source_path: string;
  source_title: string;
  context: string;
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

// ── Vault API ────────────────────────────────────────────────────

export async function openVault(path: string): Promise<VaultEntry[]> {
  if (!isTauri()) {
    return [
      { name: 'Bienvenue.md', path: `${path}/Bienvenue.md`, is_dir: false },
      { name: 'Le Sanctuaire Oublié.md', path: `${path}/Le Sanctuaire Oublié.md`, is_dir: false }
    ];
  }
  return invoke('open_vault', { path });
}

export async function listDirectory(vaultPath: string, relativePath: string): Promise<VaultEntry[]> {
  if (!isTauri()) return [];
  return invoke('list_directory', { vaultPath, relativePath });
}

export async function readFile(vaultPath: string, relativePath: string): Promise<string> {
  if (!isTauri()) {
    const key = `vf:${vaultPath}/${relativePath}`;
    return localStorage.getItem(key) || `# ${relativePath}\n\nNote de démonstration dans le navigateur.\n\nPour ouvrir ou sauvegarder de vrais dossiers sur votre disque dur, utilisez l'application native Grimoire depuis votre barre des tâches.`;
  }
  return invoke('read_file', { vaultPath, relativePath });
}

export async function readFileBase64(path: string): Promise<string> {
  if (!isTauri()) return '';
  return invoke('read_file_base64', { path });
}

export async function writeFile(vaultPath: string, relativePath: string, content: string): Promise<void> {
  if (!isTauri()) {
    const key = `vf:${vaultPath}/${relativePath}`;
    localStorage.setItem(key, content);
    return;
  }
  return invoke('write_file', { vaultPath, relativePath, content });
}

export async function writeFileBase64(vaultPath: string, relativePath: string, base64Content: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('write_file_base64', { vaultPath, relativePath, base64Content });
}

export async function saveBinaryFileToDisk(filePath: string, base64Content: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('save_binary_file_to_disk', { filePath, base64Content });
}

export async function openFileInOs(path: string): Promise<void> {
  if (!isTauri()) {
    window.open(path, '_blank');
    return;
  }
  return invoke('open_file_in_os', { path });
}

export async function saveTempHtmlAndOpen(filename: string, htmlContent: string): Promise<string> {
  if (!isTauri()) {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return url;
  }
  return invoke('save_temp_html_and_open', { filename, htmlContent });
}

export async function createDirectory(vaultPath: string, relativePath: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('create_directory', { vaultPath, relativePath });
}

export async function deleteFile(vaultPath: string, relativePath: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('delete_file', { vaultPath, relativePath });
}

export async function renameEntry(vaultPath: string, oldPath: string, newPath: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('rename_entry', { vaultPath, oldPath, newPath });
}

export interface NoteSnapshot {
  id: string;
  timestamp: number;
  date_formatted: string;
  size: number;
  preview: string;
}

export async function getFileHistory(vaultPath: string, relativePath: string): Promise<NoteSnapshot[]> {
  if (!isTauri()) return [];
  return invoke('get_file_history', { vaultPath, relativePath });
}

export async function restoreFileSnapshot(vaultPath: string, relativePath: string, snapshotId: string): Promise<string> {
  if (!isTauri()) return '';
  return invoke('restore_file_snapshot', { vaultPath, relativePath, snapshotId });
}

// ── Search API ───────────────────────────────────────────────────

export async function searchVault(query: string, limit?: number): Promise<SearchResult[]> {
  if (!isTauri()) return [];
  return invoke('search_vault', { query, limit });
}

export async function getBacklinks(path: string): Promise<BacklinkResult[]> {
  if (!isTauri()) return [];
  return invoke('get_backlinks', { path });
}

export async function reindex(vaultPath: string): Promise<number> {
  if (!isTauri()) return 0;
  return invoke('reindex', { vaultPath });
}

// ── Multi-Window API ─────────────────────────────────────────────

export interface MonitorInfo {
  name: string;
  size: [number, number];
  position: [number, number];
  is_primary: boolean;
}

export async function listMonitors(): Promise<MonitorInfo[]> {
  if (!isTauri()) {
    return [{
      name: 'Navigateur Web',
      size: [typeof window !== 'undefined' ? window.innerWidth : 1920, typeof window !== 'undefined' ? window.innerHeight : 1080],
      position: [0, 0],
      is_primary: true
    }];
  }
  return invoke('list_monitors');
}

export async function openPlayerView(monitorIndex: number): Promise<void> {
  if (!isTauri()) {
    window.open('/player.html', '_blank');
    return;
  }
  return invoke('open_player_view', { monitorIndex });
}

export async function emitToPlayerView(eventName: string, payload: any): Promise<void> {
  if (!isTauri()) {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('grimoire-player-bridge');
        bc.postMessage({ event: eventName, payload });
      } catch {}
    }
    return;
  }
  await invoke('emit_to_player_view', { event: eventName, payload });
}

export async function openMapEditor(): Promise<void> {
  if (!isTauri()) {
    window.open('/map-editor.html', '_blank');
    return;
  }
  return invoke('open_map_editor');
}

export async function openMapEditorWithMap(mapDataUrl: string, title?: string, projectJson?: any): Promise<void> {
  if (isTauri()) {
    await invoke('open_map_editor');
  } else {
    window.open('/map-editor.html', '_blank');
  }
  
  const payload = {
    title: title || 'Carte Importée',
    backgroundImageUrl: mapDataUrl,
    projectJson: projectJson || null
  };

  // 1. Envoyer via Tauri
  if (isTauri()) {
    try {
      setTimeout(async () => {
        try {
          await emit('open-map-in-editor', payload);
        } catch {}
      }, 500);
    } catch {}
  }

  // 2. Envoyer via BroadcastChannel
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    const bc = new BroadcastChannel('grimoire-map-bridge');
    setTimeout(() => {
      bc.postMessage({ type: 'open-map-in-editor', payload });
    }, 500);
  }
}

// ── AI ──────────────────────────────────────────────────────────

export interface OllamaStatus {
  binary_exists: boolean;
  server_running: boolean;
  models: string[];
}

export async function askOllama(prompt: string, model: string, systemPrompt: string): Promise<string> {
  if (!isTauri()) return "Ollama requiert l'application de bureau Grimoire.";
  return invoke('ask_ollama', { prompt, model, systemPrompt });
}

export async function getOllamaModels(): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke('get_ollama_models');
}

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  if (!isTauri()) {
    return { binary_exists: false, server_running: false, models: [] };
  }
  return invoke('check_ollama_status');
}

// ── Transcription locale (whisper.cpp) ───────────────────────────────────────
export interface TranscribeStatus {
  binary_exists: boolean;
  model_exists: boolean;
  model_size_bytes: number | null;
  binary_path: string;
  model_path: string;
}

export async function transcribeStatus(): Promise<TranscribeStatus> {
  if (!isTauri()) return { binary_exists: false, model_exists: false, model_size_bytes: null, binary_path: '', model_path: '' };
  return invoke('transcribe_status');
}

export async function transcribeDownloadModel(): Promise<void> {
  if (!isTauri()) return;
  return invoke('transcribe_download_model');
}

export async function transcribeOpenBinFolder(): Promise<string> {
  if (!isTauri()) return '';
  return invoke('transcribe_open_bin_folder');
}

export async function transcribeAudio(audioPath: string, language?: string): Promise<string> {
  if (!isTauri()) return '';
  return invoke('transcribe_audio', { audioPath, language });
}

export async function downloadOllamaBinary(): Promise<void> {
  if (!isTauri()) return;
  return invoke('download_ollama_binary');
}

export async function pullOllamaModel(modelName: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('pull_ollama_model', { modelName });
}

// ── Player Mobile Server ─────────────────────────────────────────

export interface ServerInfo {
  ip: string;
  port: number;
  url: string;
  qr_svg: string;
  mj_url?: string;
  mj_qr_svg?: string;
}

export interface PlayerInfo {
  id: string;
  name: string;
  character: any;
  character_path?: string;
  conditions: string[];
  active_turn: boolean;
  pending_xp?: number;
}

export interface PlayerAccountSummary {
  name: string;
  has_password: boolean;
  password?: string | null;
  character: any;
  character_path?: string | null;
  is_online: boolean;
  player_id?: string | null;
  conditions?: string[];
}

export async function getSavedPlayerAccounts(): Promise<PlayerAccountSummary[]> {
  if (!isTauri()) return [];
  return invoke('get_saved_player_accounts');
}

export async function savePlayerAccount(
  accountName: string,
  newName: string | null,
  newPassword: string | null,
  character: any,
  characterPath?: string | null
): Promise<void> {
  if (!isTauri()) return;
  return invoke('save_player_account', {
    accountName,
    newName,
    newPassword,
    character,
    characterPath: characterPath || null,
  });
}

export async function deletePlayerAccount(accountName: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('delete_player_account', { accountName });
}

export async function startPlayerServer(port?: number): Promise<ServerInfo> {
  if (!isTauri()) {
    return {
      ip: '127.0.0.1',
      port: port || 8000,
      url: `http://localhost:${port || 8000}`,
      qr_svg: ''
    };
  }
  return invoke('start_player_server', { port });
}

export async function stopPlayerServer(): Promise<void> {
  if (!isTauri()) return;
  return invoke('stop_player_server');
}

export async function broadcastToPlayers(event: string, data: any): Promise<void> {
  if (!isTauri()) return;
  return invoke('broadcast_to_players', { event, data });
}

export async function getPlayerConnections(): Promise<PlayerInfo[]> {
  if (!isTauri()) return [];
  return invoke('get_player_connections');
}

export async function getServerStatus(): Promise<ServerInfo | null> {
  if (!isTauri()) return null;
  return invoke('get_server_status');
}

export async function setServerVaultPath(vaultPath: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('set_server_vault_path', { vaultPath });
}

export async function applyDamageToPlayer(playerId: string, damage: number): Promise<void> {
  if (!isTauri()) return;
  return invoke('apply_damage_to_player', { playerId, damage });
}

export async function applyConditionToPlayer(playerId: string, condition: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('apply_condition_to_player', { playerId, condition });
}

export async function removeConditionFromPlayer(playerId: string, condition: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('remove_condition_from_player', { playerId, condition });
}

export async function setActiveTurn(playerId: string | null): Promise<void> {
  if (!isTauri()) return;
  return invoke('set_active_turn', { playerId });
}

export async function approveXpRequest(playerId: string, amount: number): Promise<void> {
  if (!isTauri()) return;
  return invoke('approve_xp_request', { playerId, amount });
}

export async function requestRoll(playerId: string | null, stat: string, modifier: number): Promise<void> {
  if (!isTauri()) return;
  return invoke('request_roll', { playerId, stat, modifier });
}

export async function assignCharacter(playerId: string, path: string, character: any): Promise<void> {
  if (!isTauri()) return;
  return invoke('assign_character', { playerId, path, character });
}

export async function pushMapSnapshot(imgData: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('push_map_snapshot', { imgData });
}

export async function sendPrivateMessage(playerId: string, message: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('send_private_message', { playerId, message });
}

export async function startPoll(question: string, options: string[]): Promise<void> {
  if (!isTauri()) return;
  return invoke('start_poll', { question, options });
}

export async function endPoll(): Promise<void> {
  if (!isTauri()) return;
  return invoke('end_poll');
}

// ── Updater ──────────────────────────────────────────────────────

export interface UpdateManifest {
  version: string;
  changelog: string;
  download_url: string;
  release_date: string;
}

export async function checkForUpdates(): Promise<UpdateManifest | null> {
  if (!isTauri()) return null;
  return invoke<UpdateManifest | null>('check_for_updates');
}

export async function getCurrentVersion(): Promise<string> {
  if (!isTauri()) return '0.8.3';
  return invoke<string>('get_current_version');
}

export async function openUrl(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, '_blank');
    return;
  }
  return invoke<void>('open_url', { url });
}

/**
 * Lit un fichier binaire depuis le backend natif sous forme de buffer brut (zéro overhead Base64)
 */
export async function readFileBinary(path: string): Promise<ArrayBuffer> {
  if (!isTauri()) return new ArrayBuffer(0);
  return invoke<ArrayBuffer>('read_file_binary', { path });
}

/**
 * Charge un asset binaire brut et produit une ObjectURL pour affichage immédiat
 */
export async function fetchBinaryAssetUrl(path: string, mimeType: string = 'image/png'): Promise<string> {
  if (!isTauri()) return path;
  const buffer = await readFileBinary(path);
  const blob = new Blob([buffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

