use tauri::{AppHandle, Emitter, WebviewUrl, WebviewWindowBuilder, Manager, Position, Size};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct MonitorInfo {
    pub index: usize,
    pub name: String,
    pub size: (u32, u32),
    pub position: (i32, i32),
    pub is_primary: bool,
    pub scale_factor: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PlayerViewStatus {
    pub is_open: bool,
    pub is_fullscreen: bool,
    pub current_monitor_index: Option<usize>,
}

#[tauri::command]
pub async fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary = app.primary_monitor().map_err(|e| e.to_string())?;
    
    let mut infos = Vec::new();
    for (index, monitor) in monitors.into_iter().enumerate() {
        let name = monitor.name().unwrap_or(&"Écran inconnu".to_string()).to_string();
        let size = monitor.size();
        let position = monitor.position();
        let scale_factor = monitor.scale_factor();
        
        let is_primary = match &primary {
            Some(p) => p.name() == monitor.name(),
            None => false,
        };
        
        infos.push(MonitorInfo {
            index,
            name,
            size: (size.width, size.height),
            position: (position.x, position.y),
            is_primary,
            scale_factor,
        });
    }
    Ok(infos)
}

#[tauri::command]
pub async fn open_player_view(
    app: AppHandle,
    monitor_index: usize,
    fullscreen: Option<bool>,
) -> Result<(), String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    if monitor_index >= monitors.len() {
        return Err("Indice de moniteur hors limites".to_string());
    }
    let target = &monitors[monitor_index];
    let pos = target.position();
    let size = target.size();
    let target_fullscreen = fullscreen.unwrap_or(true);

    // Si la fenêtre existe déjà, on la déplace sur le moniteur cible
    if let Some(window) = app.get_webview_window("player-view") {
        let _ = window.set_fullscreen(false);
        let _ = window.set_decorations(!target_fullscreen);
        let _ = window.set_position(Position::Physical(*pos));
        let _ = window.set_size(Size::Physical(*size));
        let _ = window.show();
        let _ = window.set_focus();
        if target_fullscreen {
            let _ = window.set_fullscreen(true);
        }
        return Ok(());
    }

    // Création de la fenêtre
    let window = WebviewWindowBuilder::new(
        &app,
        "player-view",
        WebviewUrl::App("index.html".into()),
    )
    .title("Grimoire — Vue Joueurs")
    .decorations(!target_fullscreen)
    .visible(false)
    .build()
    .map_err(|e| e.to_string())?;

    // Positionnement et redimensionnement physiques exacts
    let _ = window.set_fullscreen(false);
    let _ = window.set_position(Position::Physical(*pos));
    let _ = window.set_size(Size::Physical(*size));

    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    if target_fullscreen {
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn close_player_view(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("player-view") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn toggle_player_view_fullscreen(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("player-view") {
        let is_fs = window.is_fullscreen().unwrap_or(false);
        let next_fs = !is_fs;
        let _ = window.set_fullscreen(next_fs);
        let _ = window.set_decorations(!next_fs);
        Ok(next_fs)
    } else {
        Err("Vue joueur non ouverte".to_string())
    }
}

#[tauri::command]
pub async fn move_player_view_to_monitor(app: AppHandle, monitor_index: usize) -> Result<(), String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    if monitor_index >= monitors.len() {
        return Err("Indice d'écran invalide".to_string());
    }
    let target = &monitors[monitor_index];
    let pos = target.position();
    let size = target.size();

    if let Some(window) = app.get_webview_window("player-view") {
        let is_fs = window.is_fullscreen().unwrap_or(false);
        let _ = window.set_fullscreen(false);
        let _ = window.set_position(Position::Physical(*pos));
        let _ = window.set_size(Size::Physical(*size));
        if is_fs {
            let _ = window.set_fullscreen(true);
        }
        let _ = window.show();
        let _ = window.set_focus();
        Ok(())
    } else {
        Err("Vue joueur non ouverte".to_string())
    }
}

#[tauri::command]
pub async fn get_player_view_status(app: AppHandle) -> Result<PlayerViewStatus, String> {
    if let Some(window) = app.get_webview_window("player-view") {
        let is_fs = window.is_fullscreen().unwrap_or(false);
        let win_pos = window.outer_position().unwrap_or_default();
        let monitors = app.available_monitors().unwrap_or_default();
        
        let mut found_idx = None;
        for (i, m) in monitors.iter().enumerate() {
            let m_pos = m.position();
            let m_size = m.size();
            if win_pos.x >= m_pos.x && win_pos.x < (m_pos.x + m_size.width as i32) {
                found_idx = Some(i);
                break;
            }
        }
        
        Ok(PlayerViewStatus {
            is_open: true,
            is_fullscreen: is_fs,
            current_monitor_index: found_idx,
        })
    } else {
        Ok(PlayerViewStatus {
            is_open: false,
            is_fullscreen: false,
            current_monitor_index: None,
        })
    }
}

/// Émet un événement directement vers la fenêtre "player-view" via le backend Rust.
#[tauri::command]
pub async fn emit_to_player_view(
    app: AppHandle,
    event: String,
    payload: serde_json::Value,
) -> Result<(), String> {
    app.emit_to("player-view", &event, payload)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_map_editor(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("map-editor") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(dev)]
    let url = WebviewUrl::External("http://localhost:5174/".parse().unwrap());
    #[cfg(not(dev))]
    let url = WebviewUrl::App("map-editor/index.html".into());

    let _window = WebviewWindowBuilder::new(&app, "map-editor", url)
        .title("Fantasy Cartographer — Éditeur de Cartes")
        .inner_size(1400.0, 900.0)
        .resizable(true)
        .decorations(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
