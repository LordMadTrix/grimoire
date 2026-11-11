import {
  listen as tauriListen,
  type EventCallback,
  type EventName,
  type Options,
  type UnlistenFn,
} from '@tauri-apps/api/event';
import { isTauri } from './api';

export type { Event, EventCallback, UnlistenFn } from '@tauri-apps/api/event';

/**
 * Version protégée de `listen` de Tauri.
 * Hors de l'application native (mode web Vite, hub mobile), l'API Tauri n'existe pas :
 * on renvoie une fonction de désinscription vide au lieu de lever une erreur non gérée.
 */
export function listen<T>(
  event: EventName,
  handler: EventCallback<T>,
  options?: Options,
): Promise<UnlistenFn> {
  if (!isTauri()) return Promise.resolve(() => {});
  return tauriListen<T>(event, handler, options);
}
