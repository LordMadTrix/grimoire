import { invoke } from '@tauri-apps/api/core';

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

// ── Vault API ────────────────────────────────────────────────────

export async function openVault(path: string): Promise<VaultEntry[]> {
  return invoke('open_vault', { path });
}

export async function listDirectory(vaultPath: string, relativePath: string): Promise<VaultEntry[]> {
  return invoke('list_directory', { vaultPath, relativePath });
}

export async function readFile(vaultPath: string, relativePath: string): Promise<string> {
  return invoke('read_file', { vaultPath, relativePath });
}

export async function readFileBase64(path: string): Promise<string> {
  return invoke('read_file_base64', { path });
}

export async function writeFile(vaultPath: string, relativePath: string, content: string): Promise<void> {
  return invoke('write_file', { vaultPath, relativePath, content });
}

export async function createDirectory(vaultPath: string, relativePath: string): Promise<void> {
  return invoke('create_directory', { vaultPath, relativePath });
}

export async function deleteFile(vaultPath: string, relativePath: string): Promise<void> {
  return invoke('delete_file', { vaultPath, relativePath });
}

export async function renameEntry(vaultPath: string, oldPath: string, newPath: string): Promise<void> {
  return invoke('rename_entry', { vaultPath, oldPath, newPath });
}

// ── Search API ───────────────────────────────────────────────────

export async function searchVault(query: string, limit?: number): Promise<SearchResult[]> {
  return invoke('search_vault', { query, limit });
}

export async function getBacklinks(path: string): Promise<BacklinkResult[]> {
  return invoke('get_backlinks', { path });
}

export async function reindex(vaultPath: string): Promise<number> {
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
  return invoke('list_monitors');
}

export async function openPlayerView(monitorIndex: number): Promise<void> {
  return invoke('open_player_view', { monitorIndex });
}

export async function emitToPlayerView(eventName: string, payload: any): Promise<void> {
  await invoke('emit_to_player_view', { event: eventName, payload });
}

export async function openMapEditor(): Promise<void> {
  return invoke('open_map_editor');
}

// ── AI ──────────────────────────────────────────────────────────

export interface OllamaStatus {
  binary_exists: boolean;
  server_running: boolean;
  models: string[];
}

export async function askOllama(prompt: string, model: string, systemPrompt: string): Promise<string> {
  return invoke('ask_ollama', { prompt, model, systemPrompt });
}

export async function getOllamaModels(): Promise<string[]> {
  return invoke('get_ollama_models');
}

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  return invoke('check_ollama_status');
}

export async function downloadOllamaBinary(): Promise<void> {
  return invoke('download_ollama_binary');
}

export async function pullOllamaModel(modelName: string): Promise<void> {
  return invoke('pull_ollama_model', { modelName });
}

// ── Player Mobile Server ─────────────────────────────────────────

export interface ServerInfo {
  ip: string;
  port: number;
  url: string;
  qr_svg: string;
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

export async function startPlayerServer(port?: number): Promise<ServerInfo> {
  return invoke('start_player_server', { port });
}

export async function stopPlayerServer(): Promise<void> {
  return invoke('stop_player_server');
}

export async function broadcastToPlayers(event: string, data: any): Promise<void> {
  return invoke('broadcast_to_players', { event, data });
}

export async function getPlayerConnections(): Promise<PlayerInfo[]> {
  return invoke('get_player_connections');
}

export async function getServerStatus(): Promise<ServerInfo | null> {
  return invoke('get_server_status');
}

export async function applyDamageToPlayer(playerId: string, damage: number): Promise<void> {
  return invoke('apply_damage_to_player', { playerId, damage });
}

export async function applyConditionToPlayer(playerId: string, condition: string): Promise<void> {
  return invoke('apply_condition_to_player', { playerId, condition });
}

export async function removeConditionFromPlayer(playerId: string, condition: string): Promise<void> {
  return invoke('remove_condition_from_player', { playerId, condition });
}

export async function setActiveTurn(playerId: string | null): Promise<void> {
  return invoke('set_active_turn', { playerId });
}

export async function approveXpRequest(playerId: string, amount: number): Promise<void> {
  return invoke('approve_xp_request', { playerId, amount });
}

export async function requestRoll(playerId: string | null, stat: string, modifier: number): Promise<void> {
  return invoke('request_roll', { playerId, stat, modifier });
}

export async function assignCharacter(playerId: string, path: string, character: any): Promise<void> {
  return invoke('assign_character', { playerId, path, character });
}

export async function pushMapSnapshot(imgData: string): Promise<void> {
  return invoke('push_map_snapshot', { imgData });
}

export async function sendPrivateMessage(playerId: string, message: string): Promise<void> {
  return invoke('send_private_message', { playerId, message });
}

export async function startPoll(question: string, options: string[]): Promise<void> {
  return invoke('start_poll', { question, options });
}

export async function endPoll(): Promise<void> {
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
  return invoke<UpdateManifest | null>('check_for_updates');
}

export async function getCurrentVersion(): Promise<string> {
  return invoke<string>('get_current_version');
}

export async function openUrl(url: string): Promise<void> {
  return invoke<void>('open_url', { url });
}
