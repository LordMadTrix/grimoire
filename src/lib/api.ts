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
  await emit(eventName, payload);
}

// ── AI ──────────────────────────────────────────────────────────

export async function askOllama(prompt: string, model: string, systemPrompt: string): Promise<string> {
  return invoke('ask_ollama', { prompt, model, systemPrompt });
}

export async function getOllamaModels(): Promise<string[]> {
  return invoke('get_ollama_models');
}
