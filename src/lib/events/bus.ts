import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

/**
 * Union des événements typés de Grimoire alignée sur l'enum Rust GrimoireEvent.
 */
export type GrimoireEvent =
  | {
      type: 'token:moved';
      payload: {
        token_id: string;
        x: number;
        y: number;
      };
    }
  | {
      type: 'dice:rolled';
      payload: {
        player: string;
        formula: string;
        result: number;
      };
    }
  | {
      type: 'handout:revealed';
      payload: {
        item_id: string;
        item_type: string;
        is_mystery: boolean;
      };
    }
  | {
      type: 'vtt:scene_changed';
      payload: {
        scene_id: string;
        map_url: string;
      };
    }
  | {
      type: 'audio:zone_triggered';
      payload: {
        zone_id: string;
        track_url: string;
        volume: number;
      };
    };

/**
 * Écoute un événement typé spécifique émis depuis Rust ou un autre sous-système frontend.
 */
export async function onGrimoireEvent<T extends GrimoireEvent['type']>(
  targetType: T,
  handler: (payload: Extract<GrimoireEvent, { type: T }>['payload']) => void
): Promise<UnlistenFn> {
  return listen<GrimoireEvent>('grimoire://event', (event) => {
    if (event.payload && event.payload.type === targetType) {
      handler(event.payload.payload as any);
    }
  });
}

/**
 * Diffuse un événement typé via le backend Tauri.
 */
export async function broadcastGrimoireEvent(event: GrimoireEvent): Promise<void> {
  await invoke('broadcast_event', { event });
}
