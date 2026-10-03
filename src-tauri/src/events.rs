use serde::{Deserialize, Serialize};

/// Événements typés échangés entre le backend Rust et le frontend Svelte/VTT
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum GrimoireEvent {
    #[serde(rename = "token:moved")]
    TokenMoved {
        token_id: String,
        x: f64,
        y: f64,
    },
    #[serde(rename = "dice:rolled")]
    DiceRolled {
        player: String,
        formula: String,
        result: i32,
    },
    #[serde(rename = "handout:revealed")]
    HandoutRevealed {
        item_id: String,
        item_type: String,
        is_mystery: bool,
    },
    #[serde(rename = "vtt:scene_changed")]
    SceneChanged {
        scene_id: String,
        map_url: String,
    },
    #[serde(rename = "audio:zone_triggered")]
    AudioZoneTriggered {
        zone_id: String,
        track_url: String,
        volume: f32,
    },
}

/// Helper d'émission typée sur le canal global "grimoire://event"
pub fn emit_event<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    event: GrimoireEvent,
) -> Result<(), tauri::Error> {
    use tauri::Emitter;
    app.emit("grimoire://event", event)
}

/// Commande IPC permettant au frontend de relayer un événement typé
#[tauri::command]
pub fn broadcast_event<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    event: GrimoireEvent,
) -> Result<(), String> {
    emit_event(&app, event).map_err(|e| e.to_string())
}
