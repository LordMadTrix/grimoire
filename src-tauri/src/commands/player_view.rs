use tauri::{AppHandle, Emitter, WebviewUrl, WebviewWindowBuilder, Manager};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct MonitorInfo {
    pub name: String,
    pub size: (u32, u32),
    pub position: (i32, i32),
    pub is_primary: bool,
}

#[tauri::command]
pub async fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary = app.primary_monitor().map_err(|e| e.to_string())?;
    
    let mut infos = Vec::new();
    for monitor in monitors {
        let name = monitor.name().unwrap_or(&"Unknown".to_string()).to_string();
        let size = monitor.size();
        let position = monitor.position();
        
        let is_primary = match &primary {
            Some(p) => p.name() == monitor.name(),
            None => false,
        };
        
        infos.push(MonitorInfo {
            name,
            size: (size.width, size.height),
            position: (position.x, position.y),
            is_primary,
        });
    }
    Ok(infos)
}

#[tauri::command]
pub async fn open_player_view(app: AppHandle, monitor_index: usize) -> Result<(), String> {
    // Si la fenêtre existe déjà, on la focus
    if let Some(window) = app.get_webview_window("player-view") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    if monitor_index >= monitors.len() {
        return Err("Monitor index out of bounds".to_string());
    }
    let target = &monitors[monitor_index];
    
    let pos = target.position();
    let size = target.size();

    // L'URL de la vue joueur est différente, on utilisera un paramètre d'URL (?view=player)
    // puisque nous n'avons pas de backend de routing classique
    let window = WebviewWindowBuilder::new(
        &app,
        "player-view",
        WebviewUrl::App("index.html?view=player".into()),
    )
    .title("Grimoire — Vue Joueurs")
    .position(pos.x as f64, pos.y as f64)
    .inner_size(size.width as f64, size.height as f64)
    .decorations(false)
    .visible(false) // On la crée invisible d'abord
    .build()
    .map_err(|e| e.to_string())?;

    // Mettre en plein écran et afficher
    window.set_fullscreen(true).map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;

    Ok(())
}

/// Émet un événement directement vers la fenêtre "player-view" via le backend Rust.
/// Contrairement au `emit` frontend (qui reste dans la même fenêtre en Tauri v2),
/// ce passage par Rust garantit la livraison inter-fenêtres.
#[tauri::command]
pub async fn emit_to_player_view(
    app: AppHandle,
    event: String,
    payload: serde_json::Value,
) -> Result<(), String> {
    app.emit_to("player-view", &event, payload)
        .map_err(|e| e.to_string())
}
