use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, net::SocketAddr, sync::OnceLock};
use tauri::{AppHandle, Emitter};
use tokio::sync::{broadcast, Mutex};

// ── Shared state ──────────────────────────────────────────────────────────────

pub struct ServerInner {
    pub broadcast_tx: broadcast::Sender<String>,
    pub players: Mutex<HashMap<String, PlayerInfo>>,
    pub shutdown_tx: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
    pub port: Mutex<Option<u16>>,
    pub app_handle: Mutex<Option<AppHandle>>,
    /// Config du système de jeu (races, carrières…) lue depuis le vault
    pub game_config: Mutex<Option<serde_json::Value>>,
    /// Personnages sauvegardés par nom de joueur (persistance entre reconnexions)
    pub saved_characters: Mutex<HashMap<String, SavedCharacter>>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct SavedCharacter {
    pub data: serde_json::Value,
    pub path: Option<String>,
}

static SERVER: OnceLock<std::sync::Arc<ServerInner>> = OnceLock::new();

fn get_server() -> &'static std::sync::Arc<ServerInner> {
    SERVER.get_or_init(|| {
        let (tx, _) = broadcast::channel(256);
        std::sync::Arc::new(ServerInner {
            broadcast_tx: tx,
            players: Mutex::new(HashMap::new()),
            shutdown_tx: Mutex::new(None),
            port: Mutex::new(None),
            app_handle: Mutex::new(None),
            game_config: Mutex::new(None),
            saved_characters: Mutex::new(HashMap::new()),
        })
    })
}

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct PlayerInfo {
    pub id: String,
    pub name: String,
    pub character: serde_json::Value,
    pub character_path: Option<String>,
    pub conditions: Vec<String>,
    pub active_turn: bool,
    pub pending_xp: Option<u32>,
}

#[derive(Serialize, Deserialize)]
struct WsEnvelope {
    event: String,
    data: serde_json::Value,
}

#[derive(Serialize)]
pub struct ServerInfo {
    pub ip: String,
    pub port: u16,
    pub url: String,
    pub qr_svg: String,
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_player_server(
    app: AppHandle,
    port: Option<u16>,
) -> Result<ServerInfo, String> {
    let srv = get_server();

    // Stop previous instance — scoped block so the MutexGuard is dropped
    // before the sleep and before re-locking shutdown_tx later.
    let had_previous = {
        let mut shutdown = srv.shutdown_tx.lock().await;
        if let Some(tx) = shutdown.take() { let _ = tx.send(()); true } else { false }
    };
    if had_previous {
        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
    }

    // Store app handle for event emission
    *srv.app_handle.lock().await = Some(app);

    let bind_port = port.unwrap_or(7438);
    let addr = SocketAddr::from(([0, 0, 0, 0], bind_port));

    let app_state = std::sync::Arc::clone(srv);
    let router = Router::new()
        .route("/", get(serve_player_app))
        .route("/ws", get(ws_handler))
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Impossible de démarrer le serveur sur :{bind_port} — {e}"))?;

    let actual_port = listener.local_addr().map(|a| a.port()).unwrap_or(bind_port);
    *srv.port.lock().await = Some(actual_port);

    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    *srv.shutdown_tx.lock().await = Some(tx); // safe — previous guard was dropped above

    tauri::async_runtime::spawn(async move {
        axum::serve(listener, router)
            .with_graceful_shutdown(async { let _ = rx.await; })
            .await
            .ok();
    });

    // Get local IP
    let ip = local_ip().unwrap_or_else(|| "127.0.0.1".to_string());
    let url = format!("http://{}:{}", ip, actual_port);
    let qr_svg = generate_qr_svg(&url);

    Ok(ServerInfo { ip, port: actual_port, url, qr_svg })
}

#[tauri::command]
pub async fn stop_player_server() -> Result<(), String> {
    let srv = get_server();
    let mut shutdown = srv.shutdown_tx.lock().await;
    if let Some(tx) = shutdown.take() {
        let _ = tx.send(());
    }
    srv.players.lock().await.clear();
    *srv.port.lock().await = None;
    Ok(())
}

#[tauri::command]
pub async fn broadcast_to_players(event: String, data: serde_json::Value) -> Result<(), String> {
    let srv = get_server();
    let msg = serde_json::to_string(&WsEnvelope { event, data })
        .map_err(|e| e.to_string())?;
    let _ = srv.broadcast_tx.send(msg);
    Ok(())
}

#[tauri::command]
pub async fn get_player_connections() -> Result<Vec<PlayerInfo>, String> {
    let players = get_server().players.lock().await;
    Ok(players.values().cloned().collect())
}

/// Pousse la config du système de jeu vers le serveur mobile
#[tauri::command]
pub async fn set_game_config(config: serde_json::Value) -> Result<(), String> {
    *get_server().game_config.lock().await = Some(config);
    Ok(())
}

/// Applique des dégâts à un joueur (réduit bless). Valeur négative = soin.
#[tauri::command]
pub async fn apply_damage_to_player(player_id: String, damage: i32) -> Result<(), String> {
    let srv = get_server();
    let msg = {
        let mut players = srv.players.lock().await;
        let p = players.get_mut(&player_id).ok_or("Joueur introuvable")?;
        let cur = p.character.get("bless").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
        let new_val = (cur - damage).max(-10);
        if let Some(obj) = p.character.as_object_mut() {
            obj.insert("bless".into(), serde_json::json!(new_val));
        }
        serde_json::to_string(&WsEnvelope {
            event: "damage_applied".into(),
            data: serde_json::json!({ "target_id": player_id, "damage": damage, "bless": new_val }),
        }).unwrap_or_default()
    };
    send_to_player(&srv, &player_id, msg).await;
    broadcast_group_state(&srv).await;
    Ok(())
}

/// Ajoute une condition à un joueur
#[tauri::command]
pub async fn apply_condition_to_player(player_id: String, condition: String) -> Result<(), String> {
    let srv = get_server();
    let msg = {
        let mut players = srv.players.lock().await;
        let p = players.get_mut(&player_id).ok_or("Joueur introuvable")?;
        if !p.conditions.contains(&condition) {
            p.conditions.push(condition.clone());
        }
        serde_json::to_string(&WsEnvelope {
            event: "condition_added".into(),
            data: serde_json::json!({ "target_id": player_id, "condition": condition, "conditions": p.conditions }),
        }).unwrap_or_default()
    };
    send_to_player(&srv, &player_id, msg).await;
    broadcast_group_state(&srv).await;
    Ok(())
}

/// Retire une condition d'un joueur
#[tauri::command]
pub async fn remove_condition_from_player(player_id: String, condition: String) -> Result<(), String> {
    let srv = get_server();
    let msg = {
        let mut players = srv.players.lock().await;
        let p = players.get_mut(&player_id).ok_or("Joueur introuvable")?;
        p.conditions.retain(|c| c != &condition);
        serde_json::to_string(&WsEnvelope {
            event: "condition_removed".into(),
            data: serde_json::json!({ "target_id": player_id, "condition": condition, "conditions": p.conditions }),
        }).unwrap_or_default()
    };
    send_to_player(&srv, &player_id, msg).await;
    broadcast_group_state(&srv).await;
    Ok(())
}

/// Définit le joueur dont c'est le tour (None = personne)
#[tauri::command]
pub async fn set_active_turn(player_id: Option<String>) -> Result<(), String> {
    let srv = get_server();
    {
        let mut players = srv.players.lock().await;
        for p in players.values_mut() {
            p.active_turn = Some(p.id.clone()) == player_id;
        }
    }
    if let Some(ref pid) = player_id {
        let msg = serde_json::to_string(&WsEnvelope {
            event: "your_turn".into(),
            data: serde_json::json!({ "target_id": pid, "active": true }),
        }).unwrap_or_default();
        send_to_player(&srv, pid, msg).await;
    }
    // Notify all other players their turn ended
    if let Ok(msg) = serde_json::to_string(&WsEnvelope {
        event: "your_turn".into(),
        data: serde_json::json!({ "target_id": null, "active": false }),
    }) {
        let _ = srv.broadcast_tx.send(msg);
    }
    broadcast_group_state(&srv).await;
    Ok(())
}

/// Approuve et attribue des XP à un joueur
#[tauri::command]
pub async fn approve_xp_request(player_id: String, amount: u32) -> Result<(), String> {
    let srv = get_server();
    let msg = {
        let mut players = srv.players.lock().await;
        let p = players.get_mut(&player_id).ok_or("Joueur introuvable")?;
        p.pending_xp = None;
        let cur_xp = p.character.get("xp").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
        let new_xp = cur_xp + amount;
        if let Some(obj) = p.character.as_object_mut() {
            obj.insert("xp".into(), serde_json::json!(new_xp));
        }
        serde_json::to_string(&WsEnvelope {
            event: "xp_approved".into(),
            data: serde_json::json!({ "target_id": player_id, "amount": amount, "total_xp": new_xp }),
        }).unwrap_or_default()
    };
    send_to_player(&srv, &player_id, msg).await;
    Ok(())
}

#[tauri::command]
pub async fn assign_character(player_id: String, path: String, character: serde_json::Value) -> Result<(), String> {
    let srv = get_server();
    {
        let mut players = srv.players.lock().await;
        let p = players.get_mut(&player_id).ok_or("Joueur introuvable")?;
        p.character = character.clone();
        p.character_path = Some(path.clone());
        
        // Also save for persistence
        srv.saved_characters.lock().await.insert(p.name.clone(), SavedCharacter {
            data: character.clone(),
            path: Some(path.clone()),
        });
    }

    // Push to player
    let msg = serde_json::to_string(&WsEnvelope {
        event: "push_character".into(),
        data: character,
    }).map_err(|e| e.to_string())?;
    
    send_to_player(&srv, &player_id, msg).await;
    broadcast_group_state(&srv).await;
    
    Ok(())
}

#[tauri::command]
pub async fn push_map_snapshot(img_data: String) -> Result<(), String> {
    let srv = get_server();
    let msg = serde_json::to_string(&WsEnvelope {
        event: "map_snapshot".into(),
        data: serde_json::json!({ "img": img_data }),
    }).map_err(|e| e.to_string())?;
    
    let _ = srv.broadcast_tx.send(msg);
    Ok(())
}

#[tauri::command]
pub async fn request_roll(player_id: Option<String>, stat: String, modifier: i32) -> Result<(), String> {
    let srv = get_server();
    let msg = serde_json::to_string(&WsEnvelope {
        event: "request_roll".into(),
        data: serde_json::json!({
            "target_id": player_id,
            "stat": stat,
            "modifier": modifier,
        }),
    }).unwrap_or_default();

    if let Some(ref pid) = player_id {
        send_to_player(&srv, pid, msg).await;
    } else {
        let _ = srv.broadcast_tx.send(msg);
    }
    Ok(())
}

#[tauri::command]
pub async fn get_server_status() -> Result<Option<ServerInfo>, String> {
    let srv = get_server();
    let port = *srv.port.lock().await;
    if let Some(p) = port {
        let ip = local_ip().unwrap_or_else(|| "127.0.0.1".to_string());
        let url = format!("http://{}:{}", ip, p);
        let qr_svg = generate_qr_svg(&url);
        Ok(Some(ServerInfo { ip, port: p, url, qr_svg }))
    } else {
        Ok(None)
    }
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

async fn serve_player_app() -> impl IntoResponse {
    Html(PLAYER_APP_HTML)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<std::sync::Arc<ServerInner>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(mut socket: WebSocket, state: std::sync::Arc<ServerInner>) {
    let player_id = uuid::Uuid::new_v4().to_string();
    let mut rx = state.broadcast_tx.subscribe();

    // Wait for join message
    let name = if let Some(Ok(Message::Text(raw))) = socket.recv().await {
        if let Ok(env) = serde_json::from_str::<WsEnvelope>(&raw) {
            if env.event == "join" {
                env.data.get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Joueur")
                    .to_string()
            } else { "Joueur".to_string() }
        } else { "Joueur".to_string() }
    } else { return; };

    // Register player
    {
        let mut players = state.players.lock().await;
        players.insert(player_id.clone(), PlayerInfo {
            id: player_id.clone(),
            name: name.clone(),
            character: serde_json::Value::Null,
            character_path: None,
            conditions: vec![],
            active_turn: false,
            pending_xp: None,
        });
    }

    // Notify GM of new player
    emit_to_gm(&state, "player_joined", serde_json::json!({
        "id": player_id, "name": name
    })).await;
    broadcast_group_state(&state).await;

    // Send welcome
    let welcome = serde_json::to_string(&WsEnvelope {
        event: "welcome".into(),
        data: serde_json::json!({ "id": player_id, "name": name }),
    }).unwrap_or_default();
    let _ = socket.send(Message::Text(welcome)).await;

    // Send game config (races, carrières…) if available
    if let Some(cfg) = state.game_config.lock().await.clone() {
        let msg = serde_json::to_string(&WsEnvelope {
            event: "game_config".into(),
            data: cfg,
        }).unwrap_or_default();
        let _ = socket.send(Message::Text(msg)).await;
    }

    // Restore saved character if player reconnects with same name
    if let Some(saved) = state.saved_characters.lock().await.get(&name).cloned() {
        {
            let mut players = state.players.lock().await;
            if let Some(p) = players.get_mut(&player_id) {
                p.character = saved.data.clone();
                p.character_path = saved.path.clone();
            }
        }
        let msg = serde_json::to_string(&WsEnvelope {
            event: "restore_character".into(),
            data: saved.data,
        }).unwrap_or_default();
        let _ = socket.send(Message::Text(msg)).await;
    }

    // Main loop
    loop {
        tokio::select! {
            // Broadcast from server → player
            msg = rx.recv() => {
                match msg {
                    Ok(text) => { if socket.send(Message::Text(text)).await.is_err() { break; } }
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(_) => break,
                }
            }
            // Message from player → server
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(raw))) => {
                        if let Ok(env) = serde_json::from_str::<WsEnvelope>(&raw) {
                            handle_player_message(&state, &player_id, &name, env).await;
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => {}
                }
            }
        }
    }

    // Clean up
    state.players.lock().await.remove(&player_id);
    emit_to_gm(&state, "player_left", serde_json::json!({ "id": player_id, "name": name })).await;
    broadcast_group_state(&state).await;
}

async fn handle_player_message(
    state: &std::sync::Arc<ServerInner>,
    player_id: &str,
    player_name: &str,
    env: WsEnvelope,
) {
    match env.event.as_str() {
        "character_update" => {
            let char_data = env.data.clone();
            let mut path = None;
            {
                let mut players = state.players.lock().await;
                if let Some(p) = players.get_mut(player_id) {
                    p.character = char_data.clone();
                    path = p.character_path.clone();
                }
            }
            state.saved_characters.lock().await
                .insert(player_name.to_string(), SavedCharacter { data: char_data.clone(), path: path.clone() });
            emit_to_gm(state, "player_character_update", serde_json::json!({
                "id": player_id, "name": player_name, "character": char_data, "path": path
            })).await;
            broadcast_group_state(state).await;
        }
        "journal_push" => {
            emit_to_gm(state, "player_journal_push", serde_json::json!({
                "id": player_id, "name": player_name, "entry": env.data
            })).await;
        }
        "ai_query" => {
            // Forward AI query to Ollama
            let prompt = env.data.get("prompt").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let model = env.data.get("model").and_then(|v| v.as_str()).unwrap_or("llama3").to_string();
            let sys = env.data.get("system").and_then(|v| v.as_str()).unwrap_or("Tu es un assistant de jeu de rôle Fantasy.").to_string();
            
            let srv_clone = state.clone();
            let pid_clone = player_id.to_string();
            let app_handle_opt = state.app_handle.lock().await.clone();
            
            if let Some(app_handle) = app_handle_opt {
                tokio::spawn(async move {
                    match crate::commands::ai::ask_ollama(app_handle, prompt, model, sys).await {
                        Ok(resp) => {
                            let msg = serde_json::to_string(&WsEnvelope {
                                event: "ai_response".into(),
                                data: serde_json::json!({ "response": resp }),
                            }).unwrap_or_default();
                            send_to_player(&srv_clone, &pid_clone, msg).await;
                        }
                        Err(e) => {
                            let msg = serde_json::to_string(&WsEnvelope {
                                event: "ai_response".into(),
                                data: serde_json::json!({ "error": e }),
                            }).unwrap_or_default();
                            send_to_player(&srv_clone, &pid_clone, msg).await;
                        }
                    }
                });
            }
        }
        "dice_roll_broadcast" => {
            // Broadcast a visual dice roll to the VTT
            emit_to_gm(state, "visual_dice_roll", serde_json::json!({
                "id": player_id, "name": player_name, "roll": env.data
            })).await;
        }
        "roll" | "action" => {
            emit_to_gm(state, &format!("player_{}", env.event), serde_json::json!({
                "id": player_id, "name": player_name, "data": env.data
            })).await;
        }
        // Chat privé vers le MJ uniquement
        "chat" | "whisper" => {
            emit_to_gm(state, "player_chat", serde_json::json!({
                "id": player_id, "name": player_name,
                "message": env.data.get("message").and_then(|v| v.as_str()).unwrap_or(""),
                "private": env.event == "whisper",
            })).await;
        }
        // Chat de groupe — relayé à tous les joueurs
        "group_chat" => {
            if let Ok(msg) = serde_json::to_string(&WsEnvelope {
                event: "group_chat_msg".into(),
                data: serde_json::json!({
                    "from": player_name,
                    "from_id": player_id,
                    "message": env.data.get("message").and_then(|v| v.as_str()).unwrap_or(""),
                }),
            }) {
                let _ = state.broadcast_tx.send(msg);
            }
            emit_to_gm(state, "player_chat", serde_json::json!({
                "id": player_id, "name": player_name,
                "message": env.data.get("message").and_then(|v| v.as_str()).unwrap_or(""),
                "group": true,
            })).await;
        }
        // Réaction emoji — relayée à tous
        "reaction" => {
            if let Ok(msg) = serde_json::to_string(&WsEnvelope {
                event: "player_reaction".into(),
                data: serde_json::json!({
                    "from": player_name,
                    "emoji": env.data.get("emoji").and_then(|v| v.as_str()).unwrap_or("👍"),
                }),
            }) {
                let _ = state.broadcast_tx.send(msg);
            }
            emit_to_gm(state, "player_reaction", serde_json::json!({
                "id": player_id, "name": player_name,
                "emoji": env.data.get("emoji").and_then(|v| v.as_str()).unwrap_or("👍"),
            })).await;
        }
        // Jet d'initiative — partagé avec MJ et groupe
        "initiative_roll" => {
            if let Ok(msg) = serde_json::to_string(&WsEnvelope {
                event: "group_chat_msg".into(),
                data: serde_json::json!({
                    "from": "⚡ Initiative",
                    "message": format!("{} : {}", player_name,
                        env.data.get("result").and_then(|v| v.as_i64()).unwrap_or(0)),
                }),
            }) {
                let _ = state.broadcast_tx.send(msg);
            }
            emit_to_gm(state, "player_initiative", serde_json::json!({
                "id": player_id, "name": player_name, "data": env.data
            })).await;
        }
        // Demande d'XP au MJ
        "request_xp" => {
            let amount = env.data.get("amount").and_then(|v| v.as_u64()).unwrap_or(1) as u32;
            {
                let mut players = state.players.lock().await;
                if let Some(p) = players.get_mut(player_id) {
                    p.pending_xp = Some(amount);
                }
            }
            emit_to_gm(state, "player_xp_request", serde_json::json!({
                "id": player_id, "name": player_name, "amount": amount,
            })).await;
        }
        _ => {}
    }
}

async fn emit_to_gm(state: &std::sync::Arc<ServerInner>, event: &str, data: serde_json::Value) {
    if let Some(handle) = state.app_handle.lock().await.as_ref() {
        let _ = handle.emit(event, data);
    }
}

/// Envoie un message WS à un joueur spécifique via broadcast (filtré côté client)
async fn send_to_player(state: &std::sync::Arc<ServerInner>, player_id: &str, msg: String) {
    // On embed le player_id cible dans l'enveloppe — le client l'ignore si ce n'est pas lui
    // En pratique on broadcast à tous et chaque client filtre sur son propre id
    let _ = state.broadcast_tx.send(msg);
    let _ = player_id; // utilisé pour la logique côté client
}

/// Diffuse l'état du groupe à tous les joueurs connectés
async fn broadcast_group_state(state: &std::sync::Arc<ServerInner>) {
    let players = state.players.lock().await;
    let summary: Vec<serde_json::Value> = players.values().map(|p| {
        let hp = p.character.get("bless").and_then(|v| v.as_i64()).unwrap_or(0);
        let max_hp = p.character.pointer("/profil/act/b")
            .and_then(|v| v.as_str()).and_then(|s| s.parse::<i64>().ok())
            .or_else(|| p.character.get("maxhp").and_then(|v| v.as_i64()))
            .unwrap_or(0);
        serde_json::json!({
            "id": p.id, "name": p.name,
            "hp": hp, "maxhp": max_hp,
            "character_path": p.character_path,
            "conditions": p.conditions,
            "active_turn": p.active_turn,
            "pending_xp": p.pending_xp,
        })
    }).collect();
    drop(players);
    if let Ok(msg) = serde_json::to_string(&WsEnvelope {
        event: "group_state".into(),
        data: serde_json::json!({ "players": summary }),
    }) {
        let _ = state.broadcast_tx.send(msg);
    }
    // Also emit to GM (Player View)
    emit_to_gm(state, "sync_party_state", serde_json::json!({ "players": summary })).await;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

fn local_ip() -> Option<String> {
    use std::net::UdpSocket;
    let sock = UdpSocket::bind("0.0.0.0:0").ok()?;
    sock.connect("8.8.8.8:80").ok()?;
    sock.local_addr().ok().map(|a| a.ip().to_string())
}

fn generate_qr_svg(url: &str) -> String {
    use qrcode::QrCode;
    use qrcode::render::svg;
    match QrCode::new(url.as_bytes()) {
        Ok(code) => code
            .render::<svg::Color<'_>>()
            .min_dimensions(200, 200)
            .quiet_zone(false)
            .build(),
        Err(_) => String::new(),
    }
}

// ── Embedded player web app ───────────────────────────────────────────────────

const PLAYER_APP_HTML: &str = r##"<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<title>Grimoire — WFRP</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0e1117;--bg2:#161b22;--bg3:#1c2233;--border:#2d3748;--accent:#e5a853;--text:#c9d1d9;--muted:#8899b7;--green:#22c55e;--red:#ef4444;--rad:8px}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;flex-direction:column}
#join{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:16px;padding:32px}
#join h1{color:var(--accent);font-size:26px;letter-spacing:.02em}
#join p{color:var(--muted);font-size:13px;text-align:center}
.jinp{width:100%;max-width:320px;padding:12px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--rad);color:var(--text);font-size:16px;outline:none}
.jinp:focus{border-color:var(--accent)}
.jbtn{padding:12px 28px;background:var(--accent);border:none;border-radius:var(--rad);color:#000;font-size:15px;font-weight:700;cursor:pointer;width:100%;max-width:320px}
.jbtn:active{opacity:.85}
#app{display:none;flex-direction:column;height:100vh}
.status{padding:4px 12px;font-size:11px;text-align:center;color:var(--muted);background:var(--bg2);border-bottom:1px solid var(--border);flex-shrink:0}
.status.ok{color:var(--green)}.status.err{color:var(--red)}
#party-bar{display:flex;gap:6px;padding:6px;background:var(--bg);border-bottom:1px solid var(--border);overflow-x:auto;flex-shrink:0;scrollbar-width:none}
#party-bar::-webkit-scrollbar{display:none}
.pb-item{display:flex;flex-direction:column;gap:3px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:6px 10px;min-width:100px;flex-shrink:0}
.pb-item.active{border-color:var(--accent);background:rgba(229,168,83,0.1)}
.pb-name{font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pb-hp-bar{height:3px;background:rgba(255,255,255,0.1);border-radius:1.5px;overflow:hidden}
.pb-hp-fill{height:100%;transition:width 0.3s}
.tabs{display:flex;background:var(--bg2);border-bottom:1px solid var(--border);flex-shrink:0;overflow-x:auto}
.tab{flex:1;min-width:0;padding:10px 2px;background:transparent;border:none;color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
.tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.panel{display:none;flex:1;overflow-y:auto;padding:12px;flex-direction:column;gap:10px}
.panel.active{display:flex}
.inp{padding:7px 9px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:13px;outline:none;width:100%}
.inp:focus{border-color:var(--accent)}
.inp-sm{padding:4px 3px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:12px;outline:none;width:100%;text-align:center}
.inp-sm:focus{border-color:var(--accent)}
.lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:2px}
.fld{display:flex;flex-direction:column;gap:2px}
.r2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.r4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px}
.sec{font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.1em;padding:6px 0 4px;border-bottom:1px solid var(--border)}
/* Blessures hero */
.bless-row{display:flex;align-items:center;gap:12px;padding:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px}
.bless-lbl{font-size:11px;color:var(--muted);flex-shrink:0}
.bless-cur{font-size:28px;font-weight:800;color:var(--accent);width:56px;text-align:center;background:transparent;border:none;outline:none;font-family:monospace}
.bless-sep{font-size:20px;color:var(--muted);flex-shrink:0}
.bless-max{font-size:18px;color:var(--text);font-family:monospace;flex-shrink:0}
/* Profile table */
.prof-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--border);border-radius:6px}
.prof-tbl{border-collapse:collapse;min-width:max-content;width:100%}
.prof-tbl th{font-size:10px;color:var(--muted);text-transform:uppercase;padding:4px 5px;text-align:center;background:var(--bg2);border-bottom:1px solid var(--border)}
.prof-tbl td{padding:2px 3px;border-bottom:1px solid var(--border)}
.prof-tbl tr:last-child td{border-bottom:none}
.row-lbl{font-size:10px;color:var(--muted);white-space:nowrap;padding:3px 8px 3px 6px;font-weight:600}
.si{width:36px;padding:4px 2px;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:12px;font-weight:700;text-align:center;outline:none}
.si:focus{border-color:var(--accent)}
/* Dynamic rows */
.dyn-hdr{display:flex;gap:4px;margin-bottom:3px}
.dyn-hdr span{font-size:9px;color:var(--muted);text-transform:uppercase;text-align:center;flex-shrink:0}
.dyn-row{display:flex;gap:4px;align-items:center;margin-bottom:4px}
.del-btn{flex-shrink:0;padding:4px 7px;background:transparent;border:1px solid var(--border);border-radius:4px;color:var(--muted);cursor:pointer;font-size:11px}
.del-btn:active{color:var(--red);border-color:var(--red)}
.add-btn{padding:7px;background:transparent;border:1px dashed var(--border);border-radius:6px;color:var(--muted);cursor:pointer;font-size:12px;text-align:center;width:100%;margin-top:2px}
.add-btn:active{border-color:var(--accent);color:var(--accent)}
/* Points d'armure */
.pa-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.pa-cell{background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:3px}
.pa-lbl{font-size:9px;color:var(--muted);text-align:center;line-height:1.3}
.pa-range{font-size:8px;color:var(--muted);opacity:.5}
.pa-inp{width:44px;padding:4px;background:transparent;border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:20px;font-weight:700;text-align:center;outline:none}
.pa-inp:focus{border-color:var(--accent)}
/* Compétences */
.comp-list{display:flex;flex-wrap:wrap;gap:6px;min-height:24px}
.comp-tag{display:flex;align-items:center;gap:4px;background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:4px 10px;font-size:12px}
.comp-tag button{background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px;padding:0;line-height:1}
.comp-add-row{display:flex;gap:6px;margin-top:4px}
/* Points importants */
.pts-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pts-cell{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;display:flex;flex-direction:column;gap:4px}
.pts-name{font-size:10px;color:var(--muted);text-transform:uppercase}
.pts-inp{font-size:22px;font-weight:700;color:var(--accent);background:transparent;border:none;outline:none;text-align:center;width:100%}
/* Allures table */
.al-tbl{width:100%;border-collapse:collapse;font-size:12px}
.al-tbl th{font-size:10px;color:var(--muted);padding:4px 6px;text-align:center;background:var(--bg2);border:1px solid var(--border)}
.al-tbl td{padding:3px 4px;border:1px solid var(--border);text-align:center}
.al-lbl{font-weight:600;color:var(--text);text-align:left;padding-left:6px}
/* Dice */
.dice-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.die-btn{padding:14px 4px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;font-weight:700;cursor:pointer}
.die-btn:active{background:var(--accent);color:#000}
.roll-result{font-size:48px;font-weight:800;color:var(--accent);text-align:center;padding:16px 0;font-family:monospace}
.roll-item{background:var(--bg3);border-radius:6px;padding:8px 12px;font-size:12px;color:var(--muted);display:flex;justify-content:space-between;margin-bottom:4px}
.roll-item span{color:var(--text);font-weight:600}
/* Combat */
.combatant{display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;margin-bottom:6px}
.combatant.cur{border-color:var(--accent);background:rgba(229,168,83,.08)}
.combatant.emy{color:var(--red)}
.c-name{flex:1;font-size:13px;font-weight:500}
.hp-bar{flex:1;height:6px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden}
.hp-fill{height:100%;border-radius:3px;transition:width .3s}
.c-hp{font-size:11px;color:var(--muted);font-family:monospace;min-width:48px;text-align:right}
.no-combat{text-align:center;padding:24px;color:var(--muted);font-size:13px}
/* ── Conditions ── */
.cond-list{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0}
.cond-tag{padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.35);color:#f87171}
.cond-tag.positive{background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.3);color:#4ade80}
/* ── Tour actif ── */
.your-turn-bar{display:none;background:rgba(229,168,83,.18);border:1px solid var(--accent);border-radius:8px;padding:10px 14px;text-align:center;font-size:14px;font-weight:700;color:var(--accent);animation:pulse 1.2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
/* ── Groupe ── */
.grp-card{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.grp-card.turn-active{border-color:var(--accent);background:rgba(229,168,83,.07)}
.grp-name{font-size:13px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px}
.grp-turn-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);animation:pulse 1s infinite}
.grp-hp-row{display:flex;align-items:center;gap:8px}
.grp-hp-bar{flex:1;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden}
.grp-hp-fill{height:100%;border-radius:3px;transition:width .3s}
.grp-hp-txt{font-size:11px;color:var(--muted);font-family:monospace;min-width:42px;text-align:right}
/* ── Réactions ── */
.react-bar{display:flex;gap:6px;flex-wrap:wrap;padding:6px 0}
.react-btn{font-size:20px;padding:6px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:transform .1s}
.react-btn:active{transform:scale(1.3)}
.react-feed{display:flex;flex-direction:column;gap:4px;max-height:120px;overflow-y:auto}
.react-item{font-size:13px;color:var(--muted);padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04)}
/* ── Chat groupe/whisper ── */
.chat-mode-row{display:flex;gap:6px;padding:6px 0;flex-shrink:0}
.chat-mode-btn{flex:1;padding:6px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;text-align:center}
.chat-mode-btn.active{border-color:var(--accent);color:var(--accent);background:rgba(229,168,83,.08)}
.chat-msg.from-group{align-self:flex-start;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.15)}
.chat-msg.from-system{align-self:center;background:transparent;color:var(--muted);font-size:11px;font-style:italic;padding:2px 8px}
/* ── Test de compétence ── */
.test-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}
.test-btn{padding:8px 4px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px}
.test-btn:active{border-color:var(--accent);background:rgba(229,168,83,.1)}
.test-key{font-weight:800;font-size:13px;color:var(--accent)}
.test-val{font-size:10px;color:var(--muted)}
.test-result{margin-top:8px;padding:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;text-align:center;display:none}
.test-roll{font-size:32px;font-weight:800;font-family:monospace}
.test-verdict{font-size:13px;font-weight:700;margin-top:4px}
.test-success{color:var(--green)}.test-fail{color:var(--red)}
/* ── Localisation ── */
.loc-result{text-align:center;padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;margin-top:6px;display:none}
.loc-roll{font-size:36px;font-weight:800;font-family:monospace;color:var(--text)}
.loc-zone{font-size:18px;font-weight:700;color:var(--accent);margin-top:4px}
/* ── Reçus / Handouts ── */
.recv-list{display:flex;flex-direction:column;gap:10px}
.recv-item{background:var(--bg3);border:1px solid var(--border);border-radius:8px;overflow:hidden}
.recv-item img{width:100%;display:block;border-radius:6px}
.recv-note{padding:12px;font-size:13px;line-height:1.6;white-space:pre-wrap}
.recv-title{padding:8px 12px;font-size:11px;font-weight:700;color:var(--accent);border-bottom:1px solid var(--border);text-transform:uppercase;letter-spacing:.06em}
/* ── Handout overlay plein écran ── */
.handout-overlay{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:none;flex-direction:column;align-items:center;justify-content:center;padding:16px}
.handout-overlay.active{display:flex}
.handout-overlay img{max-width:100%;max-height:75vh;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.8)}
.handout-overlay .ho-title{color:var(--accent);font-size:15px;font-weight:700;margin-top:12px;text-align:center}
.handout-overlay .ho-text{color:var(--text);font-size:13px;line-height:1.6;max-width:400px;text-align:left;white-space:pre-wrap;margin-top:8px;max-height:35vh;overflow-y:auto}
.handout-overlay .ho-close{margin-top:16px;padding:10px 28px;background:var(--accent);border:none;border-radius:8px;color:#000;font-weight:700;font-size:14px;cursor:pointer}
/* ── Journal ── */
.journ-area{width:100%;flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;color:var(--text);font-size:14px;line-height:1.6;outline:none;resize:none;font-family:serif}
/* ── Map ── */
#map-container{width:100%;height:300px;background:#000;border:1px solid var(--border);border-radius:8px;overflow:hidden;position:relative}
#map-img{width:100%;height:100%;object-fit:contain}
/* ── AI Assistant ── */
.ai-chat{display:flex;flex-direction:column;gap:8px;flex:1;overflow-y:auto;padding-bottom:8px}
.ai-msg{padding:8px 12px;border-radius:10px;font-size:13px;line-height:1.4;max-width:85%}
.ai-user{align-self:flex-end;background:var(--bg3);border:1px solid var(--border)}
.ai-bot{align-self:flex-start;background:rgba(229,168,83,0.15);border:1px solid var(--accent);color:var(--accent)}
/* ── Particle Effects ── */
@keyframes destiny-pulse {
  0% { transform: scale(1); filter: drop-shadow(0 0 0px var(--accent)); }
  50% { transform: scale(1.1); filter: drop-shadow(0 0 10px var(--accent)); }
  100% { transform: scale(1); filter: drop-shadow(0 0 0px var(--accent)); }
}
.destiny-active { animation: destiny-pulse 0.8s ease-in-out; }
  .sk-wrap { background:#000; border:1px solid var(--border); border-radius:8px; height:300px; touch-action:none; }
  #sk-canvas { width:100%; height:100%; display:block; cursor:crosshair; }
  .sb-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .sb-btn { background:var(--bg3); border:1px solid var(--border); color:var(--text); padding:10px; border-radius:8px; cursor:pointer; font-size:12px; }
  .sb-btn:active { background:var(--bg-hover); transform:scale(0.95); }
  .combat-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .c-action-btn { background:var(--bg3); border:1px solid var(--border); color:var(--accent); padding:15px 10px; border-radius:10px; font-weight:700; font-size:13px; cursor:pointer; }
  .c-action-btn:active { background:var(--accent); color:#000; transform:scale(0.95); }
</style>
</head>
<body>

<div id="join">
  <h1>⚔️ Grimoire WFRP</h1>
  <p>Warhammer Fantasy — Rejoignez la table de votre Maître du Jeu</p>
  <input class="jinp" id="player-name" placeholder="Votre nom de personnage" maxlength="40"/>
  <button class="jbtn" onclick="joinGame()">Rejoindre la Table</button>
</div>

<div id="app">
  <div class="status" id="status-bar">Connexion…</div>
  <div id="party-bar"></div>
  <div class="tabs">
    <button class="tab active" onclick="showTab(this,'perso')">🧙 Perso</button>
    <button class="tab" onclick="showTab(this,'fiche');renderSheet()">📄 Fiche</button>
    <button class="tab" onclick="showTab(this,'combat')">⚔️ Combat</button>
    <button class="tab" onclick="showTab(this,'equip')">🎒 Équip</button>
    <button class="tab" onclick="showTab(this,'des');buildSkillTests()">🎲 Dés</button>
    <button class="tab" onclick="showTab(this,'carte')">🗺️ Carte</button>
    <button class="tab" onclick="showTab(this,'aide')">🤖 Aide</button>
    <button class="tab" onclick="showTab(this,'chat')">💬 Chat</button>
    <button class="tab" onclick="showTab(this,'groupe')">👥 Groupe</button>
    <button class="tab" onclick="showTab(this,'journ')">📜 Journal</button>
    <button class="tab" onclick="showTab(this,'recus')">📬 Reçus</button>
  </div>

  <div id="handout-overlay" class="handout-overlay">
    <img id="ho-img" src="" alt="Handout"/>
    <div id="ho-title" class="ho-title"></div>
    <div id="ho-text" class="ho-text"></div>
    <button class="ho-close" onclick="closeHandout()">Fermer</button>
  </div>

  <div id="roll-request-overlay">
    <div class="rr-box">
      <div class="rr-title">Jet demandé par le MJ</div>
      <div id="rr-stat-name" class="rr-stat">AGILITÉ</div>
      <div id="rr-stat-mod" class="rr-mod">+10</div>
      <button id="rr-roll-btn" class="rr-btn">LANCER LE DÉ</button>
      <button class="sbtn" style="background:transparent;border:1px solid var(--border);color:var(--muted);margin-top:12px" onclick="closeRollRequest()">Ignorer</button>
    </div>
  </div>

  <!-- ══ PERSO ══ -->
  <div id="tab-perso" class="panel active">
    <div class="sec">Identité</div>
    <div class="fld"><div class="lbl">Nom</div><input class="inp" id="f-nom" oninput="sc()"/></div>
    <div class="fld">
      <div class="lbl">Race</div>
      <select class="inp" id="f-race" onchange="onRaceSelect(this.value)">
        <option value="">— Choisir une race —</option>
      </select>
      <div id="race-info" style="display:none;font-size:11px;color:#a78bfa;padding:3px 0 1px;line-height:1.5"></div>
    </div>
    <div class="r2">
      <div class="fld"><div class="lbl">Sexe</div>
        <select class="inp" id="f-sexe" onchange="sc()">
          <option value="">—</option>
          <option>Masculin</option><option>Féminin</option><option>Autre</option>
        </select>
      </div>
      <div class="fld"><div class="lbl">Alignement</div>
        <select class="inp" id="f-align" onchange="sc()">
          <option value="">—</option>
          <option>Loyal</option><option>Neutre</option><option>Chaotique</option><option>Corrompu</option>
        </select>
      </div>
    </div>
    <div class="fld"><div class="lbl">Vocation</div><input class="inp" id="f-voc" oninput="sc()" placeholder="Auto-rempli par la carrière…"/></div>
    <div class="r3">
      <div class="fld"><div class="lbl">Âge</div><input class="inp" id="f-age" type="number" min="1" max="999" oninput="sc()"/></div>
      <div class="fld"><div class="lbl">Taille</div>
        <select class="inp" id="f-taille" onchange="sc()">
          <option value="">—</option>
          <option>Très Petit (&lt;1.3m)</option><option>Petit (1.3–1.6m)</option>
          <option>Moyen (1.6–1.8m)</option><option>Grand (1.8–2.0m)</option>
          <option>Très Grand (&gt;2.0m)</option>
        </select>
      </div>
      <div class="fld"><div class="lbl">Corpulence</div>
        <select class="inp" id="f-poids" onchange="sc()">
          <option value="">—</option>
          <option>Maigre</option><option>Mince</option><option>Moyen</option>
          <option>Trapu</option><option>Costaud</option>
        </select>
      </div>
    </div>
    <div class="r2">
      <div class="fld"><div class="lbl">Cheveux</div>
        <select class="inp" id="f-chev" onchange="sc()">
          <option value="">—</option>
          <option>Noir</option><option>Brun</option><option>Châtain</option>
          <option>Blond</option><option>Roux</option><option>Gris</option>
          <option>Blanc</option><option>Argenté</option><option>Chauve</option>
        </select>
      </div>
      <div class="fld"><div class="lbl">Yeux</div>
        <select class="inp" id="f-yeux" onchange="sc()">
          <option value="">—</option>
          <option>Brun</option><option>Noir</option><option>Bleu</option>
          <option>Vert</option><option>Gris</option><option>Noisette</option>
          <option>Ambre</option><option>Violet</option><option>Rouge</option>
        </select>
      </div>
    </div>
    <div class="fld"><div class="lbl">Description</div><textarea class="inp" id="f-desc" rows="2" oninput="sc()" style="resize:vertical" placeholder="Signes particuliers, apparence…"></textarea></div>

    <div class="sec">Carrière</div>
    <div class="fld">
      <div class="lbl">Carrière Actuelle</div>
      <select class="inp" id="f-car" onchange="onCareerSelect(this.value)">
        <option value="">— Choisir une carrière —</option>
      </select>
      <div id="career-info" style="display:none;font-size:11px;color:var(--muted);padding:3px 0 1px;line-height:1.6"></div>
    </div>
    <div class="fld"><div class="lbl">Cheminement Professionnel</div><textarea class="inp" id="f-chem" rows="2" oninput="sc()" style="resize:vertical"></textarea></div>
    <div class="fld"><div class="lbl">Débouchés</div><textarea class="inp" id="f-deb" rows="2" oninput="sc()" style="resize:vertical"></textarea></div>

    <div class="sec">Blessures</div>
    <div class="bless-row">
      <div class="bless-lbl">Blessures actuelles</div>
      <input class="bless-cur" id="f-bless" type="number" min="0" value="0" oninput="sc()"/>
      <div class="bless-sep">/</div>
      <div class="bless-max" id="bless-max">—</div>
    </div>
    <div id="health-state" style="padding:7px 12px;border-radius:6px;font-size:12px;font-weight:600;text-align:center;background:var(--bg3);border:1px solid var(--border);color:var(--muted)">—</div>

    <div class="sec">Profil</div>
    <div class="prof-wrap">
      <table class="prof-tbl" id="prof-tbl">
        <thead><tr>
          <th></th><th>M</th><th>CC</th><th>CT</th><th>F</th><th>E</th><th>B</th>
          <th>I</th><th>A</th><th>Dex</th><th>Cd</th><th>Int</th><th>Cl</th><th>FM</th><th>Soc</th>
        </tr></thead>
        <tbody>
          <tr id="prow-init"></tr>
          <tr id="prow-plan"></tr>
          <tr id="prow-act"></tr>
        </tbody>
      </table>
    </div>

    <div class="sec">Compétences</div>
    <div class="comp-list" id="comp-list"></div>
    <div class="comp-add-row">
      <input class="inp" id="comp-new" placeholder="Nouvelle compétence…" style="flex:1"/>
      <button class="snd-btn" onclick="addComp()" style="padding:8px 12px">+</button>
    </div>

    <button class="sbtn" onclick="sendCharacter()">📤 Envoyer au MJ</button>
  </div>

  <!-- ══ COMBAT ══ -->
  <div id="tab-combat" class="panel">
    <div class="sec">Armes de Contact</div>
    <div class="dyn-hdr">
      <span style="flex:3">Arme</span>
      <span style="width:34px">I</span><span style="width:34px">CC</span>
      <span style="width:50px">D</span><span style="width:40px">Prd</span>
      <span style="width:26px"></span>
    </div>
    <div id="ac-rows"></div>
    <button class="add-btn" onclick="addAC()">+ arme de contact</button>

    <div class="sec">Armes de Distance</div>
    <div class="dyn-hdr">
      <span style="flex:2">Arme</span>
      <span style="width:30px">PC</span><span style="width:30px">PL</span>
      <span style="width:30px">PE</span><span style="width:30px">FE</span>
      <span style="width:36px">A/T</span><span style="width:26px"></span>
    </div>
    <div id="ad-rows"></div>
    <button class="add-btn" onclick="addAD()">+ arme de distance</button>

    <div class="sec">Armure</div>
    <div class="dyn-hdr">
      <span style="flex:3">Description</span>
      <span style="width:48px">Loc</span><span style="width:42px">ENC</span>
      <span style="width:26px"></span>
    </div>
    <div id="arm-rows"></div>
    <button class="add-btn" onclick="addArm()">+ armure</button>

    <div class="sec">Points d'Armure</div>
    <div class="pa-grid">
      <div class="pa-cell"><div class="pa-lbl">Tête</div><div class="pa-range">01–15</div><input class="pa-inp" id="pa-tete" type="number" min="0" value="0" oninput="sc()"/></div>
      <div class="pa-cell"><div class="pa-lbl">Bras Droit</div><div class="pa-range">16–35</div><input class="pa-inp" id="pa-bd" type="number" min="0" value="0" oninput="sc()"/></div>
      <div class="pa-cell"><div class="pa-lbl">Bras Gauche</div><div class="pa-range">36–55</div><input class="pa-inp" id="pa-bg" type="number" min="0" value="0" oninput="sc()"/></div>
      <div class="pa-cell"><div class="pa-lbl">Tronc</div><div class="pa-range">56–80</div><input class="pa-inp" id="pa-tronc" type="number" min="0" value="0" oninput="sc()"/></div>
      <div class="pa-cell"><div class="pa-lbl">Jambe Droite</div><div class="pa-range">81–90</div><input class="pa-inp" id="pa-jd" type="number" min="0" value="0" oninput="sc()"/></div>
      <div class="pa-cell"><div class="pa-lbl">Jambe Gauche</div><div class="pa-range">91–00</div><input class="pa-inp" id="pa-jg" type="number" min="0" value="0" oninput="sc()"/></div>
    </div>

    <div class="sec">Table de Combat (MJ)</div>
    <div id="combat-list"><div class="no-combat">En attente du MJ…</div></div>
  </div>

  <!-- ══ ÉQUIP ══ -->
  <div id="tab-equip" class="panel">
    <div class="sec">Points Importants</div>
    <div class="pts-grid">
      <div class="pts-cell"><div class="pts-name">Pts de Destin</div><input class="pts-inp" id="p-destin" type="number" min="0" value="0" oninput="sc()"/></div>
      <div class="pts-cell"><div class="pts-name">Pts de Magie</div><input class="pts-inp" id="p-magie" type="number" min="0" value="0" oninput="sc()"/></div>
      <div class="pts-cell"><div class="pts-name">Niv. de Pouvoir</div><input class="pts-inp" id="p-pouvoir" type="number" min="0" value="0" oninput="sc()"/></div>
      <div class="pts-cell"><div class="pts-name">Pts d'Expérience</div><input class="pts-inp" id="p-xp" type="number" min="0" value="0" oninput="sc()"/></div>
    </div>
    <div class="pts-cell" style="margin-top:6px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:10px;text-align:center">
      <div class="pts-name" style="color:var(--red)">Points de Folie</div>
      <input class="pts-inp" id="p-folie" type="number" min="0" value="0" oninput="sc()" style="color:var(--red)"/>
    </div>

    <div class="sec">Emplacements de Sorts</div>
    <div id="spell-slots-panel" style="padding:8px 0"></div>
    <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
      <button class="add-btn" onclick="addSlotLevel()" style="margin:0">+ Niveau</button>
      <button class="add-btn" onclick="restoreAllSlots()" style="margin:0;background:rgba(99,102,241,.15);border-color:rgba(99,102,241,.4)">⟳ Repos long</button>
    </div>

    <div class="sec">Sortilèges</div>
    <div class="dyn-hdr">
      <span style="flex:2">Sortilège</span>
      <span style="width:26px">NS</span><span style="width:26px">PM</span>
      <span style="width:26px">P</span><span style="width:26px">D</span>
      <span style="flex:1.5">Comp.</span><span style="flex:1.5">Effets</span>
      <span style="width:26px"></span>
    </div>
    <div id="sort-rows"></div>
    <button class="add-btn" onclick="addSort()">+ sortilège</button>

    <div class="sec">Équipement / Dotations</div>
    <div class="dyn-hdr">
      <span style="flex:3">Description</span>
      <span style="width:48px">Loc</span><span style="width:42px">ENC</span>
      <span style="width:26px"></span>
    </div>
    <div id="eq-rows"></div>
    <button class="add-btn" onclick="addEq()">+ équipement</button>

    <div class="sec">Richesses</div>
    <div class="dyn-hdr">
      <span style="flex:3">Description</span>
      <span style="width:48px">Loc</span><span style="width:42px">ENC</span>
      <span style="width:26px"></span>
    </div>
    <div id="rich-rows"></div>
    <button class="add-btn" onclick="addRich()">+ richesse</button>

    <div class="sec">Allures de Déplacement</div>
    <table class="al-tbl">
      <thead><tr><th></th><th>m/Round</th><th>m/Tour</th><th>km/h</th></tr></thead>
      <tbody>
        <tr><td class="al-lbl">Prudente</td><td><input class="inp-sm" id="dp-pr" oninput="sc()"/></td><td><input class="inp-sm" id="dp-pt" oninput="sc()"/></td><td><input class="inp-sm" id="dp-pk" oninput="sc()"/></td></tr>
        <tr><td class="al-lbl">Normale</td><td><input class="inp-sm" id="dp-nr" oninput="sc()"/></td><td><input class="inp-sm" id="dp-nt" oninput="sc()"/></td><td><input class="inp-sm" id="dp-nk" oninput="sc()"/></td></tr>
        <tr><td class="al-lbl">Rapide</td><td><input class="inp-sm" id="dp-rr" oninput="sc()"/></td><td><input class="inp-sm" id="dp-rt" oninput="sc()"/></td><td><input class="inp-sm" id="dp-rk" oninput="sc()"/></td></tr>
      </tbody>
    </table>

    <div class="sec">Langages</div>
    <textarea class="inp" id="f-lang" rows="2" placeholder="Langues connues…" oninput="sc()" style="resize:vertical"></textarea>

    <div class="sec">Psychologie &amp; Santé</div>
    <textarea class="inp" id="f-psycho" rows="3" placeholder="Phobies, folies, états mentaux…" oninput="sc()" style="resize:vertical"></textarea>

    <div class="sec">Origines Sociales</div>
    <div class="fld"><div class="lbl">Lieu de Naissance</div>
      <select class="inp" id="f-lieu" onchange="sc()">
        <option value="">— Choisir —</option>
        <optgroup label="Reikland">
          <option>Altdorf</option><option>Ubersreik</option><option>Bögenhafen</option>
        </optgroup>
        <optgroup label="Provinces de l'Empire">
          <option>Middenheim (Middenland)</option><option>Nuln (Wissenland)</option>
          <option>Talabheim (Talabecland)</option><option>Averheim (Averland)</option>
          <option>Wulfburg (Hochland)</option><option>Wolfenburg (Ostland)</option>
          <option>Bechafen (Ostermark)</option><option>Wörden (Nordland)</option>
          <option>Wissenburg (Stirland)</option>
          <option>Province inconnue (Empire)</option>
        </optgroup>
        <optgroup label="Hors Empire">
          <option>Marienburg (Estalie)</option><option>Bretonnie</option>
          <option>Kislev</option><option>Tilea</option><option>Araby</option>
        </optgroup>
        <optgroup label="Terres non-humaines">
          <option>Karaz-a-Karak (Nains)</option><option>Zhufbar (Nains)</option>
          <option>Ulthuan (Hauts Elfes)</option><option>Athel Loren (Elfes Sylvains)</option>
          <option>La Moot (Halflings)</option>
        </optgroup>
      </select>
    </div>
    <div class="fld"><div class="lbl">Profession des Parents</div>
      <select class="inp" id="f-parents" onchange="sc()">
        <option value="">— Choisir —</option>
        <option>Agriculteur / Paysan</option><option>Éleveur</option>
        <option>Pêcheur</option><option>Chasseur</option>
        <option>Artisan (forgeron)</option><option>Artisan (charpentier)</option>
        <option>Artisan (cordonnier)</option><option>Tisserand</option>
        <option>Aubergiste / Tavernier</option><option>Marchand</option>
        <option>Soldat / Milicien</option><option>Garde de la cité</option>
        <option>Marin</option><option>Cocher / Charretier</option>
        <option>Prêtre / Ecclésiastique</option><option>Médecin des rues</option>
        <option>Fonctionnaire impérial</option><option>Écrivain public</option>
        <option>Serviteur noble</option><option>Criminel / Brigand</option>
        <option>Inconnu / Orphelin</option>
      </select>
    </div>
    <div class="fld"><div class="lbl">Membres de la Famille</div>
      <textarea class="inp" id="f-famille" rows="2" oninput="sc()" style="resize:vertical" placeholder="Noms, liens, situation actuelle…"></textarea>
    </div>
    <div class="r2">
      <div class="fld"><div class="lbl">Rang Social</div>
        <select class="inp" id="f-rang" onchange="sc()">
          <option value="">—</option>
          <option>Serf</option><option>Paysan libre</option>
          <option>Artisan</option><option>Marchand</option>
          <option>Bourgeois</option><option>Écuyer</option>
          <option>Prêtre</option><option>Chevalier</option>
          <option>Noble</option><option>Hors-la-loi</option>
        </select>
      </div>
      <div class="fld"><div class="lbl">Religion</div>
        <select class="inp" id="f-relig" onchange="sc()">
          <option value="">—</option>
          <option>Sigmar</option><option>Ulric</option><option>Morr</option>
          <option>Taal &amp; Rhya</option><option>Verena</option>
          <option>Manann</option><option>Shallya</option><option>Ranald</option>
          <option>Myrmidiah</option><option>Solkan</option>
          <option>Ancestres Nains</option><option>Isha (Elfes)</option>
          <option>Aucune / Athée</option><option>Inconnue</option>
        </select>
      </div>
    </div>
  </div>

  <!-- ══ FICHE ══ -->
  <div id="tab-fiche" class="panel">
    <div id="sheet-content" style="display:flex;flex-direction:column;gap:10px;padding-bottom:16px"></div>
  </div>

  <!-- ══ DÉS ══ -->
  <div id="tab-des" class="panel">
    <div class="dice-grid" id="dice-grid"></div>
    <button class="add-btn" onclick="fureurUlric()" style="border-style:solid;color:var(--accent);border-color:rgba(229,168,83,.5);margin-top:4px;font-weight:600">⚡ Fureur d'Ulric — d10 explosif</button>
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
      <span style="font-size:12px;color:var(--muted)">Mod :</span>
      <input class="inp" id="mod-val" type="number" value="0" style="width:72px"/>
      <span style="font-size:12px;color:var(--muted)" id="last-formula"></span>
    </div>
    <div class="roll-result" id="roll-result">—</div>
    <div id="roll-history"></div>

    <div class="sec">Test de Compétence</div>
    <div id="test-grid" class="test-grid"></div>
    <div class="test-result" id="test-result">
      <div class="test-roll" id="test-roll-num">—</div>
      <div class="test-verdict" id="test-verdict"></div>
    </div>

    <div class="sec">Table de Localisation</div>
    <button class="sbtn" style="margin-top:0" onclick="rollLocalisation()">🎲 Jet de Localisation (d100)</button>
    <div class="loc-result" id="loc-result">
      <div class="loc-roll" id="loc-roll">—</div>
      <div class="loc-zone" id="loc-zone"></div>
    </div>

    <div class="sec">Jet d'Initiative</div>
    <button class="sbtn" style="margin-top:0" onclick="rollInitiative()">⚡ Lancer l'Initiative (I + d10)</button>
    <div class="loc-result" id="init-result">
      <div class="loc-roll" id="init-roll">—</div>
      <div class="loc-zone" id="init-zone" style="font-size:13px;color:var(--text)"></div>
    </div>
  </div>

  <!-- ══ CHAT ══ -->
  <div id="tab-chat" class="panel" style="height:calc(100vh - 110px)">
    <div class="chat-wrap">
      <div class="chat-mode-row">
        <button class="chat-mode-btn active" id="mode-gm" onclick="setChatMode('gm')">🔒 Privé MJ</button>
        <button class="chat-mode-btn" id="mode-group" onclick="setChatMode('group')">👥 Groupe</button>
      </div>
      <div class="react-bar" style="padding:4px 0 6px">
        <button class="react-btn" onclick="sendReaction('👍')">👍</button>
        <button class="react-btn" onclick="sendReaction('❤️')">❤️</button>
        <button class="react-btn" onclick="sendReaction('⚔️')">⚔️</button>
        <button class="react-btn" onclick="sendReaction('😱')">😱</button>
        <button class="react-btn" onclick="sendReaction('🤣')">🤣</button>
        <button class="react-btn" onclick="sendReaction('🎲')">🎲</button>
      </div>
      <div class="chat-msgs" id="chat-msgs"></div>
      <div class="chat-row">
        <input class="chat-inp" id="chat-input" placeholder="Message…" onkeydown="if(event.key==='Enter')sendChat()"/>
        <button class="snd-btn" onclick="sendChat()">➤</button>
      </div>
    </div>
  </div>

  <!-- ══ GROUPE ══ -->
  <div id="tab-groupe" class="panel">
    <div class="your-turn-bar" id="your-turn-bar">⚡ C'est votre tour !</div>
    <div class="sec">État du Groupe</div>
    <div id="group-list"></div>
    <div class="sec">Mes Conditions</div>
    <div class="cond-list" id="my-conditions"><span style="color:var(--muted);font-size:12px">Aucune condition active</span></div>
    <div class="sec">Réactions Rapides</div>
    <div class="react-bar">
      <button class="react-btn" onclick="sendReaction('👍')">👍</button>
      <button class="react-btn" onclick="sendReaction('❤️')">❤️</button>
      <button class="react-btn" onclick="sendReaction('⚔️')">⚔️</button>
      <button class="react-btn" onclick="sendReaction('😱')">😱</button>
      <button class="react-btn" onclick="sendReaction('🤣')">🤣</button>
      <button class="react-btn" onclick="sendReaction('🎲')">🎲</button>
      <button class="react-btn" onclick="sendReaction('💀')">💀</button>
    </div>
    <div class="react-feed" id="react-feed"></div>
    <div class="sec">Demande d'XP</div>
    <div class="xp-row">
      <input class="inp" id="xp-req-amt" type="number" min="1" max="9999" value="100" style="width:100px"/>
      <button class="sbtn" style="margin-top:0;flex:1" onclick="requestXP()">💫 Demander des XP au MJ</button>
    </div>
    <div id="xp-pending-msg"></div>

    <div class="sec">Soundboard (Ambiance)</div>
    <div class="sb-grid">
      <button class="sb-btn" onclick="send('play_sound',{id:'war-horn'})">📯 Cor</button>
      <button class="sb-btn" onclick="send('play_sound',{id:'clash'})">⚔️ Choc</button>
      <button class="sb-btn" onclick="send('play_sound',{id:'magic'})">✨ Sort</button>
    </div>
  </div>

  <!-- ══ CARTE ══ -->
  <div id="tab-carte" class="panel">
    <div class="sec">Carte Tactique</div>
    <div id="map-container">
      <img id="map-img" src="" alt="Pas de carte partagée"/>
    </div>
    <p style="font-size:11px;color:var(--muted);text-align:center;margin-top:8px">Synchronisé en temps réel par le MJ</p>
  </div>

  <!-- ══ CROQUIS ══ -->
  <div id="tab-croquis" class="panel">
    <div class="sec">Zone de Dessin Rapide</div>
    <div class="sk-wrap">
      <canvas id="sk-canvas"></canvas>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="sbtn" style="flex:1" onclick="sendSketch()">➤ Envoyer au MJ</button>
      <button class="sbtn" style="width:60px" onclick="clearSketch()">🗑️</button>
    </div>
    <p style="font-size:11px;color:var(--muted);text-align:center;margin-top:8px">Dessinez ici pour montrer vos intentions au MJ</p>
  </div>

  <!-- ══ COMBAT HUD ══ -->
  <div id="tab-combat" class="panel">
    <div class="sec">Actions de Combat Rapides</div>
    <div class="combat-grid">
      <button class="c-action-btn" onclick="send('action',{type:'attack'})">⚔️ Attaque Normale</button>
      <button class="c-action-btn" onclick="send('action',{type:'dodge'})">🛡️ Esquive / Parade</button>
      <button class="c-action-btn" onclick="send('action',{type:'charge'})">🏃 Charge !</button>
      <button class="c-action-btn" onclick="send('action',{type:'disengage'})">💨 Désengagement</button>
    </div>
    <div class="sec">Ma Santé</div>
    <div id="combat-my-hp"></div>
    <p style="font-size:11px;color:var(--muted);text-align:center;margin-top:12px">Ces actions envoient une notification au MJ</p>
  </div>

  <!-- ══ AIDE AI ══ -->
  <div id="tab-aide" class="panel">
    <div class="sec">Assistant Grimoire (Ollama)</div>
    <div style="display:flex;gap:12px;margin-bottom:10px;background:var(--bg3);padding:8px;border-radius:8px;border:1px solid var(--border)">
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--accent);font-weight:700;cursor:pointer">
        <input type="checkbox" id="ai-mj-mode"> 🎭 MODE MJ
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);font-weight:700;cursor:pointer">
        <input type="checkbox" id="ai-tts-mode"> 🔊 PAROLE
      </label>
      <button onclick="window.speechSynthesis.cancel()" style="margin-left:auto;background:none;border:none;color:var(--red);font-size:10px;cursor:pointer">Arrêter l'audio</button>
    </div>
    <div class="ai-chat" id="ai-chat">
      <div class="ai-msg ai-bot">Bonjour ! Je suis votre assistant. Activez le "Mode MJ" pour que je mène la partie, ou demandez-moi de l'aide sur les règles.</div>
    </div>
    <div class="chat-row">
      <input class="chat-inp" id="ai-input" placeholder="Posez une question…" onkeydown="if(event.key==='Enter')askAI()"/>
      <button class="snd-btn" onclick="askAI()">➤</button>
    </div>
  </div>

  <!-- ══ JOURNAL ══ -->
  <div id="tab-journ" class="panel">
    <div class="sec">Notes de Session</div>
    <textarea class="journ-area" id="journ-text" placeholder="Racontez votre aventure ici…"></textarea>
    <button class="sbtn" onclick="sendJournal()">💾 Sauvegarder dans le Grimoire</button>
  </div>

  <!-- ══ REÇUS ══ -->
  <div id="tab-recus" class="panel">
    <div class="sec">Handouts Reçus</div>
    <div id="recv-list" class="recv-list">
      <div style="text-align:center;color:var(--muted);font-size:13px;padding:24px 0">Aucun handout reçu pour le moment</div>
    </div>
  </div>
</div>

<!-- Handout overlay plein écran -->
<div class="handout-overlay" id="handout-overlay">
  <img id="ho-img" src="" style="display:none"/>
  <div class="ho-title" id="ho-title"></div>
  <div class="ho-text" id="ho-text"></div>
  <button class="ho-close" onclick="closeHandout()">Fermer</button>
</div>

<script>
const STATS = ['m','cc','ct','f','e','b','i','a','dex','cd','int','cl','fm','soc'];
const STAT_H = ['M','CC','CT','F','E','B','I','A','Dex','Cd','Int','Cl','FM','Soc'];
const DICE = [4,6,8,10,12,20,100];

let ch = {
  nom:'',race:'',sexe:'',align:'',voc:'',age:'',taille:'',poids:'',chev:'',yeux:'',desc:'',
  car:'',chem:'',deb:'',
  bless:0,
  profil:{
    init: Object.fromEntries(STATS.map(s=>[s,''])),
    plan: Object.fromEntries(STATS.map(s=>[s,''])),
    act:  Object.fromEntries(STATS.map(s=>[s,''])),
  },
  comps:[],
  ac:[],ad:[],arm:[],
  pa:{tete:0,bd:0,bg:0,tronc:0,jd:0,jg:0},
  sort:[],eq:[],rich:[],
  spellSlots:[], // [{level:1, total:4, used:0}]
  dep:{pr:{r:'',t:'',k:''},nr:{r:'',t:'',k:''},rr:{r:'',t:'',k:''}},
  lang:'',psycho:'',
  destin:0,magie:0,pouvoir:0,xp:0,folie:0,
  lieu:'',parents:'',famille:'',rang:'',relig:'',
};

let ws=null, playerId=null, playerName=null, reconnDelay=1000, gameConfig=null;
let chatMode='gm', myConditions=[], recus=[];

// ── Config-driven dropdowns ────────────────────────────────────────────
function populateRaceDropdown(){
  const sel=document.getElementById('f-race');
  const cur=ch.race||'';
  sel.innerHTML='<option value="">— Choisir une race —</option>';
  if(gameConfig&&gameConfig.races){
    gameConfig.races.forEach(r=>{
      const opt=document.createElement('option');
      opt.value=r.name; opt.textContent=r.emoji+' '+r.name;
      if(r.name===cur)opt.selected=true;
      sel.appendChild(opt);
    });
  }
  // Préserver la valeur custom si pas dans la liste
  if(cur&&(!gameConfig||!gameConfig.races||!gameConfig.races.find(r=>r.name===cur))){
    const opt=document.createElement('option');
    opt.value=cur;opt.textContent=cur;opt.selected=true;
    sel.appendChild(opt);
  }
  if(cur)showRaceInfo(cur);
}

function populateCareerDropdown(){
  const sel=document.getElementById('f-car');
  const cur=ch.car||'';
  sel.innerHTML='<option value="">— Choisir une carrière —</option>';
  if(gameConfig&&gameConfig.careers){
    const cats={};
    gameConfig.careers.forEach(c=>{
      if(!cats[c.category])cats[c.category]=[];
      cats[c.category].push(c);
    });
    Object.entries(cats).forEach(([cat,careers])=>{
      const grp=document.createElement('optgroup');
      grp.label=cat;
      careers.forEach(c=>{
        const opt=document.createElement('option');
        opt.value=c.name;opt.textContent=c.name;
        if(c.name===cur)opt.selected=true;
        grp.appendChild(opt);
      });
      sel.appendChild(grp);
    });
    // Enrichir aussi le select "Profession des parents" avec les carrières du vault
    const parSel=document.getElementById('f-parents');
    if(parSel){
      // Supprimer les options vault précédentes (gardent les hardcodées)
      [...parSel.querySelectorAll('optgroup[data-vault]')].forEach(g=>g.remove());
      const grp=document.createElement('optgroup');
      grp.label='Carrières (vault)'; grp.dataset.vault='1';
      gameConfig.careers.forEach(c=>{
        const opt=document.createElement('option');
        opt.value=c.name; opt.textContent=c.name;
        if(c.name===(ch.parents||''))opt.selected=true;
        grp.appendChild(opt);
      });
      parSel.appendChild(grp);
    }
  }
  if(cur&&(!gameConfig||!gameConfig.careers||!gameConfig.careers.find(c=>c.name===cur))){
    const opt=document.createElement('option');
    opt.value=cur;opt.textContent=cur;opt.selected=true;
    sel.appendChild(opt);
  }
  if(cur)showCareerInfo(cur);
}

// Âge de départ typique par race
const RACE_AGE = {
  'Humain':16,'Elfe':70,'Nain':30,'Halfling':22,'Gnome':40
};

function onRaceSelect(name){
  ch.race=name;
  if(gameConfig&&name){
    const race=gameConfig.races.find(r=>r.name===name);
    if(race){
      STATS.forEach(s=>{
        const base=race.stats[s]||0;
        ch.profil.init[s]=base;
        ch.profil.act[s]=base;
        const initEl=document.querySelector('[data-k="init"][data-s="'+s+'"]');
        const actEl=document.querySelector('[data-k="act"][data-s="'+s+'"]');
        if(initEl)initEl.value=base||'';
        if(actEl)actEl.value=base||'';
      });
      document.getElementById('bless-max').textContent=race.stats.b||'—';
      ch.bless=race.stats.b||0;
      sv('f-bless',ch.bless);
      sv('p-destin',race.fate||0);
      ch.destin=race.fate||0;
      // Âge par défaut selon la race si non rempli
      if(!ch.age||ch.age==='0'){
        const age=RACE_AGE[name];
        if(age){ sv('f-age',age); ch.age=age; }
      }
    }
  }
  showRaceInfo(name);
  sc();
}

function showRaceInfo(name){
  const el=document.getElementById('race-info');
  if(!el)return;
  if(!gameConfig||!name){el.style.display='none';return;}
  const race=gameConfig.races.find(r=>r.name===name);
  if(race&&race.special&&race.special.length>0){
    el.textContent='✦ '+race.special.join(' • ');
    el.style.display='block';
  }else{el.style.display='none';}
}

function onCareerSelect(name){
  ch.car=name; ch.voc=name; sv('f-voc',name);
  if(gameConfig&&name){
    const career=gameConfig.careers.find(c=>c.name===name);
    if(career){
      sv('f-deb',career.exits.join(', '));
      ch.deb=career.exits.join(', ');
      // Ajouter les compétences de carrière
      const existing=new Set(ch.comps||[]);
      career.skills.forEach(s=>existing.add(s));
      ch.comps=[...existing];
      rComps();
    }
  }
  showCareerInfo(name);
  sc();
}

function showCareerInfo(name){
  const el=document.getElementById('career-info');
  if(!el)return;
  if(!gameConfig||!name){el.style.display='none';return;}
  const career=gameConfig.careers.find(c=>c.name===name);
  if(career){
    el.innerHTML='Plan: <strong>'+career.stat_plan.map(s=>s.toUpperCase()).join(', ')+'</strong> · Débouchés: '+career.exits.join(', ');
    el.style.display='block';
  }else{el.style.display='none';}
}

function loadCharFromData(data){
  Object.assign(ch,data);
  if(data.profil){
    if(data.profil.init)Object.assign(ch.profil.init,data.profil.init);
    if(data.profil.plan)Object.assign(ch.profil.plan,data.profil.plan);
    if(data.profil.act) Object.assign(ch.profil.act, data.profil.act);
  }
  sv('f-nom',ch.nom);sv('f-sexe',ch.sexe);sv('f-align',ch.align);
  sv('f-voc',ch.voc);sv('f-age',ch.age);sv('f-taille',ch.taille);sv('f-poids',ch.poids);
  sv('f-chev',ch.chev);sv('f-yeux',ch.yeux);sv('f-desc',ch.desc);
  sv('f-chem',ch.chem);sv('f-deb',ch.deb);
  sv('f-bless',ch.bless);
  sv('pa-tete',ch.pa.tete);sv('pa-bd',ch.pa.bd);sv('pa-bg',ch.pa.bg);
  sv('pa-tronc',ch.pa.tronc);sv('pa-jd',ch.pa.jd);sv('pa-jg',ch.pa.jg);
  sv('p-destin',ch.destin);sv('p-magie',ch.magie);sv('p-pouvoir',ch.pouvoir);
  sv('p-xp',ch.xp);sv('p-folie',ch.folie);
  sv('f-lang',ch.lang);sv('f-psycho',ch.psycho);
  sv('f-lieu',ch.lieu);sv('f-parents',ch.parents);sv('f-famille',ch.famille);
  sv('f-rang',ch.rang);sv('f-relig',ch.relig);
  if(ch.dep){
    sv('dp-pr',ch.dep.pr?.r);sv('dp-pt',ch.dep.pr?.t);sv('dp-pk',ch.dep.pr?.k);
    sv('dp-nr',ch.dep.nr?.r);sv('dp-nt',ch.dep.nr?.t);sv('dp-nk',ch.dep.nr?.k);
    sv('dp-rr',ch.dep.rr?.r);sv('dp-rt',ch.dep.rr?.t);sv('dp-rk',ch.dep.rr?.k);
  }
  ['init','plan','act'].forEach(key=>{
    STATS.forEach(s=>{
      const el=document.querySelector('[data-k="'+key+'"][data-s="'+s+'"]');
      if(el)el.value=ch.profil[key][s]||'';
    });
  });
  document.getElementById('bless-max').textContent=ch.profil.act.b||'—';
  populateRaceDropdown();populateCareerDropdown();
  rAC();rAD();rArm();rSort();rEq();rRich();rComps();rSpellSlots();
  updateHealthState();
}

// ── Profile table ──────────────────────────────────────────────────────
function buildProf() {
  [['prow-init','init','Init.'],['prow-plan','plan','Plan'],['prow-act','act','Act.']].forEach(([rid,key,lbl])=>{
    const tr = document.getElementById(rid);
    const ltd = document.createElement('td'); ltd.className='row-lbl'; ltd.textContent=lbl; tr.appendChild(ltd);
    STATS.forEach(s=>{
      const td = document.createElement('td');
      td.innerHTML = '<input class="si" data-k="'+key+'" data-s="'+s+'" type="number" min="0" max="999" value="'+(ch.profil[key][s]||'')+'" oninput="onStat(this)"/>';
      tr.appendChild(td);
    });
  });
}

function onStat(el) {
  ch.profil[el.dataset.k][el.dataset.s] = el.value;
  if (el.dataset.k==='act' && el.dataset.s==='b') {
    document.getElementById('bless-max').textContent = el.value||'—';
  }
  sc();
}

// ── Dynamic rows ───────────────────────────────────────────────────────
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function rAC(){
  document.getElementById('ac-rows').innerHTML = ch.ac.map((a,i)=>
    '<div class="dyn-row">'+
    '<input class="inp" style="flex:3" value="'+esc(a.nom)+'" placeholder="Arme" oninput="ch.ac['+i+'].nom=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:34px" value="'+esc(a.i)+'" oninput="ch.ac['+i+'].i=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:34px" value="'+esc(a.cc)+'" oninput="ch.ac['+i+'].cc=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:50px" value="'+esc(a.d)+'" oninput="ch.ac['+i+'].d=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:40px" value="'+esc(a.prd)+'" oninput="ch.ac['+i+'].prd=this.value;sc()"/>'+
    '<button class="del-btn" onclick="ch.ac.splice('+i+',1);rAC();sc()">✕</button></div>'
  ).join('');
}
function addAC(){ch.ac.push({nom:'',i:'',cc:'',d:'',prd:''});rAC();sc();}

function rAD(){
  document.getElementById('ad-rows').innerHTML = ch.ad.map((a,i)=>
    '<div class="dyn-row">'+
    '<input class="inp" style="flex:2" value="'+esc(a.nom)+'" placeholder="Arme" oninput="ch.ad['+i+'].nom=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:30px" value="'+esc(a.pc)+'" oninput="ch.ad['+i+'].pc=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:30px" value="'+esc(a.pl)+'" oninput="ch.ad['+i+'].pl=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:30px" value="'+esc(a.pe)+'" oninput="ch.ad['+i+'].pe=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:30px" value="'+esc(a.fe)+'" oninput="ch.ad['+i+'].fe=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:36px" value="'+esc(a.at)+'" oninput="ch.ad['+i+'].at=this.value;sc()"/>'+
    '<button class="del-btn" onclick="ch.ad.splice('+i+',1);rAD();sc()">✕</button></div>'
  ).join('');
}
function addAD(){ch.ad.push({nom:'',pc:'',pl:'',pe:'',fe:'',at:''});rAD();sc();}

function rArm(){
  document.getElementById('arm-rows').innerHTML = ch.arm.map((a,i)=>
    '<div class="dyn-row">'+
    '<input class="inp" style="flex:3" value="'+esc(a.nom)+'" placeholder="Description" oninput="ch.arm['+i+'].nom=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:48px" value="'+esc(a.loc)+'" oninput="ch.arm['+i+'].loc=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:42px" value="'+esc(a.enc)+'" oninput="ch.arm['+i+'].enc=this.value;sc()"/>'+
    '<button class="del-btn" onclick="ch.arm.splice('+i+',1);rArm();sc()">✕</button></div>'
  ).join('');
}
function addArm(){ch.arm.push({nom:'',loc:'',enc:''});rArm();sc();}

function rSort(){
  document.getElementById('sort-rows').innerHTML = ch.sort.map((s,i)=>
    '<div class="dyn-row">'+
    '<input class="inp-sm" style="flex:2" value="'+esc(s.nom)+'" placeholder="Sortilège" oninput="ch.sort['+i+'].nom=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:26px" value="'+esc(s.ns)+'" oninput="ch.sort['+i+'].ns=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:26px" value="'+esc(s.pm)+'" oninput="ch.sort['+i+'].pm=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:26px" value="'+esc(s.p)+'" oninput="ch.sort['+i+'].p=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:26px" value="'+esc(s.d)+'" oninput="ch.sort['+i+'].d=this.value;sc()"/>'+
    '<input class="inp-sm" style="flex:1.5" value="'+esc(s.comp)+'" placeholder="Comp." oninput="ch.sort['+i+'].comp=this.value;sc()"/>'+
    '<input class="inp-sm" style="flex:1.5" value="'+esc(s.eff)+'" placeholder="Effets" oninput="ch.sort['+i+'].eff=this.value;sc()"/>'+
    '<button class="del-btn" onclick="ch.sort.splice('+i+',1);rSort();sc()">✕</button></div>'
  ).join('');
}
function addSort(){ch.sort.push({nom:'',ns:'',pm:'',p:'',d:'',comp:'',eff:''});rSort();sc();}

function rSpellSlots(){
  if(!ch.spellSlots) ch.spellSlots=[];
  const el=document.getElementById('spell-slots-panel');
  if(!el) return;
  if(ch.spellSlots.length===0){el.innerHTML='<div style="color:#64748b;font-size:12px;padding:4px 0">Aucun emplacement — cliquez "+ Niveau" pour ajouter.</div>';return;}
  el.innerHTML=ch.spellSlots.map((sl,i)=>{
    const boxes=Array.from({length:sl.total},(_, bi)=>
      '<button onclick="toggleSlot('+i+','+bi+')" style="width:22px;height:22px;border-radius:4px;border:1px solid rgba(129,140,248,.5);background:'+(bi<sl.used?'rgba(99,102,241,.6)':'rgba(99,102,241,.1)')+';cursor:pointer;margin:1px;font-size:9px;">'+(bi<sl.used?'✦':'·')+'</button>'
    ).join('');
    return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;flex-wrap:wrap">'+
      '<span style="font-size:12px;color:#c4b5fd;min-width:52px">Niv. '+sl.level+'</span>'+
      '<div style="display:flex;flex-wrap:wrap;gap:1px">'+boxes+'</div>'+
      '<span style="font-size:11px;color:#64748b">'+(sl.total-sl.used)+'/'+sl.total+'</span>'+
      '<input type="number" min="1" max="9" value="'+sl.total+'" style="width:36px;font-size:11px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:4px;color:#e2e8f0;padding:1px 4px;text-align:center" oninput="ch.spellSlots['+i+'].total=Math.max(1,parseInt(this.value)||1);ch.spellSlots['+i+'].used=Math.min(ch.spellSlots['+i+'].used,ch.spellSlots['+i+'].total);rSpellSlots();sc()" title="Total" />'+
      '<button onclick="ch.spellSlots.splice('+i+',1);rSpellSlots();sc()" style="border:none;background:rgba(239,68,68,.15);color:#f87171;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:11px">✕</button></div>';
  }).join('');
}
function toggleSlot(levelIdx,boxIdx){
  const sl=ch.spellSlots[levelIdx];
  if(boxIdx<sl.used) sl.used=boxIdx; else sl.used=boxIdx+1;
  rSpellSlots(); sc();
}
function addSlotLevel(){
  if(!ch.spellSlots) ch.spellSlots=[];
  const nextLevel=ch.spellSlots.length>0?ch.spellSlots[ch.spellSlots.length-1].level+1:1;
  ch.spellSlots.push({level:Math.min(9,nextLevel),total:4,used:0});
  rSpellSlots(); sc();
}
function restoreAllSlots(){
  (ch.spellSlots||[]).forEach(sl=>sl.used=0);
  rSpellSlots(); sc();
}

function rEq(){
  document.getElementById('eq-rows').innerHTML = ch.eq.map((e,i)=>
    '<div class="dyn-row">'+
    '<input class="inp" style="flex:3" value="'+esc(e.nom)+'" placeholder="Description" oninput="ch.eq['+i+'].nom=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:48px" value="'+esc(e.loc)+'" oninput="ch.eq['+i+'].loc=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:42px" value="'+esc(e.enc)+'" oninput="ch.eq['+i+'].enc=this.value;sc()"/>'+
    '<button class="del-btn" onclick="ch.eq.splice('+i+',1);rEq();sc()">✕</button></div>'
  ).join('');
}
function addEq(){ch.eq.push({nom:'',loc:'',enc:''});rEq();sc();}

function rRich(){
  document.getElementById('rich-rows').innerHTML = ch.rich.map((r,i)=>
    '<div class="dyn-row">'+
    '<input class="inp" style="flex:3" value="'+esc(r.nom)+'" placeholder="Description" oninput="ch.rich['+i+'].nom=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:48px" value="'+esc(r.loc)+'" oninput="ch.rich['+i+'].loc=this.value;sc()"/>'+
    '<input class="inp-sm" style="width:42px" value="'+esc(r.enc)+'" oninput="ch.rich['+i+'].enc=this.value;sc()"/>'+
    '<button class="del-btn" onclick="ch.rich.splice('+i+',1);rRich();sc()">✕</button></div>'
  ).join('');
}
function addRich(){ch.rich.push({nom:'',loc:'',enc:''});rRich();sc();}

function rComps(){
  document.getElementById('comp-list').innerHTML = ch.comps.map((c,i)=>
    '<div class="comp-tag"><span>'+esc(c)+'</span><button onclick="ch.comps.splice('+i+',1);rComps();sc()">✕</button></div>'
  ).join('');
}
function addComp(){
  const inp=document.getElementById('comp-new'); const v=inp.value.trim();
  if(!v)return; ch.comps.push(v); inp.value=''; rComps(); sc();
}

// ── Save / Load ────────────────────────────────────────────────────────
function gv(id){const e=document.getElementById(id);return e?e.value:'';}
function sv(id,v){const e=document.getElementById(id);if(e)e.value=v||'';}

function collect(){
  ch.nom=gv('f-nom');ch.race=gv('f-race');ch.sexe=gv('f-sexe');ch.align=gv('f-align');
  ch.voc=gv('f-voc');ch.age=gv('f-age');ch.taille=gv('f-taille');ch.poids=gv('f-poids');
  ch.chev=gv('f-chev');ch.yeux=gv('f-yeux');ch.desc=gv('f-desc');
  ch.car=gv('f-car');ch.chem=gv('f-chem');ch.deb=gv('f-deb');
  ch.bless=parseInt(gv('f-bless'))||0;
  ch.pa={tete:parseInt(gv('pa-tete'))||0,bd:parseInt(gv('pa-bd'))||0,bg:parseInt(gv('pa-bg'))||0,
         tronc:parseInt(gv('pa-tronc'))||0,jd:parseInt(gv('pa-jd'))||0,jg:parseInt(gv('pa-jg'))||0};
  ch.dep={pr:{r:gv('dp-pr'),t:gv('dp-pt'),k:gv('dp-pk')},
          nr:{r:gv('dp-nr'),t:gv('dp-nt'),k:gv('dp-nk')},
          rr:{r:gv('dp-rr'),t:gv('dp-rt'),k:gv('dp-rk')}};
  ch.lang=gv('f-lang');ch.psycho=gv('f-psycho');
  ch.destin=parseInt(gv('p-destin'))||0;ch.magie=parseInt(gv('p-magie'))||0;
  ch.pouvoir=parseInt(gv('p-pouvoir'))||0;ch.xp=parseInt(gv('p-xp'))||0;ch.folie=parseInt(gv('p-folie'))||0;
  ch.lieu=gv('f-lieu');ch.parents=gv('f-parents');ch.famille=gv('f-famille');
  ch.rang=gv('f-rang');ch.relig=gv('f-relig');
}

function sc(){
  collect();
  localStorage.setItem('grimoire_wfrp2',JSON.stringify(ch));
  updateHealthState();
}

function updateHealthState(){
  const cur=parseInt(document.getElementById('f-bless')?.value)||0;
  const maxB=parseInt(ch.profil?.act?.b)||0;
  const el=document.getElementById('health-state');
  const combatHp=document.getElementById('combat-my-hp');
  
  let statusTxt='', statusCol='var(--muted)', statusBorder='var(--border)';
  if(maxB>0){
    if(cur<=0){
      statusTxt='💀 Inconscient / Sans Défense — risque de mort';
      statusCol='var(--red)';statusBorder='rgba(239,68,68,.4)';
    }else if(cur<=3){
      statusTxt='🩸 Gravement Blessé — guérison 1 B/semaine';
      statusCol='#f97316';statusBorder='rgba(249,115,22,.4)';
    }else{
      statusTxt='✅ Légèrement Blessé — guérison 1 B/jour';
      statusCol='var(--green)';statusBorder='rgba(34,197,94,.4)';
    }
  } else { statusTxt='—'; }

  if(el){ el.textContent=statusTxt;el.style.color=statusCol;el.style.borderColor=statusBorder; }
  
  if(combatHp){
    const pct=maxB>0?Math.max(0,Math.min(100,cur/maxB*100)):0;
    combatHp.innerHTML='<div style="font-size:24px;font-weight:800;text-align:center;color:'+statusCol+'">'+cur+' / '+maxB+'</div>'+
      '<div style="height:12px;background:var(--bg3);border-radius:6px;overflow:hidden;margin:8px 0">'+
      '<div style="width:'+pct+'%;height:100%;background:'+statusCol+';transition:width 0.4s"></div></div>'+
      '<div style="font-size:12px;text-align:center;color:var(--text-muted)">'+statusTxt+'</div>';
  }
}

function loadChar(){
  const s=localStorage.getItem('grimoire_wfrp2');
  if(!s)return;
  try{ loadCharFromData(JSON.parse(s)); }catch(e){}
}

function sendCharacter(){
  collect();
  send('character_update',{
    ...ch,
    name:ch.nom, class:ch.voc||ch.car,
    hp:ch.bless, maxhp:parseInt(ch.profil.act.b)||0,
  });
  showStatus('Fiche envoyée au MJ !',true);
}

// ── Rendu de la fiche personnage ───────────────────────────────────────
function renderSheet(){
  const el=document.getElementById('sheet-content');
  if(!el)return;

  const maxB=parseInt(ch.profil?.act?.b)||0;
  const curB=parseInt(ch.bless)||0;
  const pct=maxB>0?Math.min(100,Math.round(curB/maxB*100)):0;
  const hpCol=pct>60?'var(--green)':pct>25?'#eab308':'var(--red)';
  let healthTxt='—',healthCol='var(--muted)';
  if(maxB>0){
    if(curB<=0){healthTxt='💀 Inconscient / Sans Défense';healthCol='var(--red)';}
    else if(curB<=3){healthTxt='🩸 Gravement Blessé';healthCol='#f97316';}
    else{healthTxt='✅ Légèrement Blessé';healthCol='var(--green)';}
  }

  // Stats en deux rangées de 7
  const R1=[['m','M'],['cc','CC'],['ct','CT'],['f','F'],['e','E'],['b','B'],['i','I']];
  const R2=[['a','A'],['dex','Dex'],['cd','Cd'],['int','Int'],['cl','Cl'],['fm','FM'],['soc','Soc']];
  function statCell(key,lbl){
    const val=ch.profil?.act?.[key]||'—';
    const inPlan=ch.profil?.plan?.[key];
    const border=inPlan?'border-color:rgba(229,168,83,.5);background:rgba(229,168,83,.07)':'';
    const vc=inPlan?'color:var(--accent)':'';
    return '<div class="sh-stat" style="'+border+'">'
      +'<div class="sh-sv" style="'+vc+'">'+val+'</div>'
      +'<div class="sh-sk">'+lbl+(inPlan?'<span style="color:var(--accent)"> ✦</span>':'')+'</div>'
      +'</div>';
  }

  // Plan de carrière
  const planStats=Object.entries(ch.profil?.plan||{}).filter(([,v])=>v).map(([k])=>k.toUpperCase());
  const planLine=planStats.length?'Plan : <strong style="color:var(--accent)">'+planStats.join(', ')+'</strong>':'';

  // Armes
  let weapHtml='';
  (ch.ac||[]).forEach(w=>{if(w.nom)weapHtml+='<div class="sh-weapon"><span>⚔️ '+esc(w.nom)+'</span><span>CC '+esc(w.cc)+'&nbsp;&nbsp;'+esc(w.d)+'</span></div>';});
  (ch.ad||[]).forEach(w=>{if(w.nom)weapHtml+='<div class="sh-weapon"><span>🏹 '+esc(w.nom)+'</span><span>CT '+esc(w.pc)+'&nbsp;&nbsp;'+esc(w.d)+'</span></div>';});

  // Sorts
  let sortHtml='';
  (ch.sort||[]).forEach(s=>{if(s.nom)sortHtml+='<div class="sh-weapon"><span>✨ '+esc(s.nom)+'</span><span>Niv.'+esc(s.niv)+'  PM '+esc(s.pm)+'</span></div>';});

  // Compétences
  const skillHtml=(ch.comps||[]).length
    ?(ch.comps||[]).map(c=>'<span class="sh-skill">'+esc(c)+'</span>').join('')
    :'<span class="sh-empty">Aucune compétence</span>';

  // Armure (seulement si non zéro)
  const pa=ch.pa||{};
  const anyPa=Object.values(pa).some(v=>parseInt(v)>0);
  function pac(v,lbl){
    const n=parseInt(v)||0;
    const c=n>=4?'var(--green)':n>=2?'#eab308':n>0?'var(--text)':'var(--muted)';
    return '<div class="sh-pa-c"><div class="sh-pa-v" style="color:'+c+'">'+n+'</div><div class="sh-pa-l">'+lbl+'</div></div>';
  }

  // Richesses
  const rich=(ch.rich||[]).map(r=>r.desc?esc(r.desc+(r.val?' ('+r.val+')':'')):null).filter(Boolean);

  let html='';

  // ── Hero ──
  html+='<div class="sh-hero">'
    +'<div class="sh-name">'+esc(ch.nom||'Sans Nom')+'</div>'
    +'<div class="sh-meta">'+(ch.race?esc(ch.race):'')+( ch.race&&ch.car?' — ':'')+(ch.car?esc(ch.car):'')+(ch.age?' · '+esc(String(ch.age))+' ans':'')+'</div>'
    +([ch.sexe,ch.align].filter(Boolean).length?'<div class="sh-sub">'+[ch.sexe,ch.align].filter(Boolean).map(esc).join(' · ')+'</div>':'')
    +'</div>';

  // ── Blessures ──
  html+='<div class="sh-hp-block">'
    +'<div class="sh-hp-row"><span class="sh-hp-lbl">Blessures</span>'
    +'<span class="sh-hp-num" style="color:'+hpCol+'">'+curB+'</span>'
    +'<span class="sh-hp-sep">/</span>'
    +'<span class="sh-hp-max">'+(maxB||'—')+'</span></div>'
    +'<div class="sh-bar-bg"><div class="sh-bar-fill" style="width:'+pct+'%;background:'+hpCol+'"></div></div>'
    +'<div class="sh-health-txt" style="color:'+healthCol+'">'+healthTxt+'</div>'
    +'</div>';

  // ── Profil ──
  html+='<div class="sh-section">Profil</div>'
    +'<div class="sh-stats">'
    +'<div class="sh-stats-row">'+R1.map(([k,l])=>statCell(k,l)).join('')+'</div>'
    +'<div class="sh-stats-row">'+R2.map(([k,l])=>statCell(k,l)).join('')+'</div>'
    +'</div>'
    +(planLine?'<div class="sh-plan-bar">'+planLine+'</div>':'');

  // ── Points importants ──
  html+='<div class="sh-section">Points</div>'
    +'<div class="sh-pts">'
    +'<div class="sh-pt"><div class="sh-pt-v" style="color:var(--accent)">'+(ch.destin||0)+'</div><div class="sh-pt-l">✨ Destin</div></div>'
    +'<div class="sh-pt"><div class="sh-pt-v" style="color:#a78bfa">'+(ch.magie||0)+'</div><div class="sh-pt-l">🔮 Magie</div></div>'
    +'<div class="sh-pt"><div class="sh-pt-v">'+(ch.xp||0)+'</div><div class="sh-pt-l">💫 XP</div></div>'
    +'<div class="sh-pt"><div class="sh-pt-v" style="color:var(--red)">'+(ch.folie||0)+'</div><div class="sh-pt-l">🌀 Folie</div></div>'
    +'</div>';

  // ── Compétences ──
  html+='<div class="sh-section">Compétences</div><div class="sh-skills">'+skillHtml+'</div>';

  // ── Armes ──
  if(weapHtml){html+='<div class="sh-section">Armes</div>'+weapHtml;}

  // ── Sorts ──
  if(sortHtml){html+='<div class="sh-section">Sortilèges</div>'+sortHtml;}

  // ── Armure ──
  if(anyPa){
    html+='<div class="sh-section">Points d\'Armure</div>'
      +'<div class="sh-pa-row">'+pac(pa.tete,'🧢 Tête')+pac(pa.tronc,'🛡️ Tronc')+'</div>'
      +'<div class="sh-pa-row">'+pac(pa.bd,'💪 Bras D.')+pac(pa.bg,'💪 Bras G.')+'</div>'
      +'<div class="sh-pa-row">'+pac(pa.jd,'🦵 Jambe D.')+pac(pa.jg,'🦵 Jambe G.')+'</div>';
  }

  // ── Richesses ──
  if(rich.length){
    html+='<div class="sh-section">Richesses</div>'
      +'<div class="sh-bg">'+rich.map(r=>'<div class="sh-bg-row"><span>💰 '+r+'</span></div>').join('')+'</div>';
  }

  // ── Origines ──
  const bgRows=[];
  if(ch.lieu)bgRows.push('<div class="sh-bg-row"><span class="sh-bg-l">🏠 Lieu</span><span>'+esc(ch.lieu)+'</span></div>');
  if(ch.relig)bgRows.push('<div class="sh-bg-row"><span class="sh-bg-l">⛪ Religion</span><span>'+esc(ch.relig)+'</span></div>');
  if(ch.rang)bgRows.push('<div class="sh-bg-row"><span class="sh-bg-l">🎖️ Rang</span><span>'+esc(ch.rang)+'</span></div>');
  if(ch.parents)bgRows.push('<div class="sh-bg-row"><span class="sh-bg-l">👨‍👩 Parents</span><span>'+esc(ch.parents)+'</span></div>');
  if(ch.desc)bgRows.push('<div class="sh-desc">'+esc(ch.desc)+'</div>');
  if(bgRows.length){html+='<div class="sh-section">Origines</div><div class="sh-bg">'+bgRows.join('')+'</div>';}

  // ── Psychologie ──
  if(ch.psycho){
    html+='<div class="sh-section">Psychologie</div>'
      +'<div class="sh-bg"><div class="sh-desc">'+esc(ch.psycho)+'</div></div>';
  }

  // ── Conditions actives ──
  if(myConditions.length){
    html+='<div class="sh-section">Conditions</div>'
      +'<div class="cond-list">'+myConditions.map(c=>'<span class="cond-tag">'+esc(c)+'</span>').join('')+'</div>';
  }

  // ── Suivi de carrière ──
  if(gameConfig&&ch.car){
    const career=gameConfig.careers.find(c=>c.name===ch.car);
    if(career&&career.stat_plan&&career.stat_plan.length){
      html+='<div class="sh-section">Suivi de Carrière — '+esc(ch.car)+'</div>'
        +'<div class="career-track">';
      career.stat_plan.forEach(s=>{
        const initV=parseInt(ch.profil?.init?.[s])||0;
        const actV=parseInt(ch.profil?.act?.[s])||0;
        const target=initV+10;
        const pct=initV>0?Math.min(100,Math.round((actV-initV)/(target-initV)*100)):0;
        const done=actV>=target;
        html+='<div class="ct-row">'
          +'<span class="ct-key'+(done?' ct-done':'')+'">'+s.toUpperCase()+'</span>'
          +'<div class="ct-bar-bg"><div class="ct-bar-fill" style="width:'+pct+'%'+(done?';background:var(--green)':'')+'"></div></div>'
          +'<span class="ct-vals">'+actV+' / '+target+(done?' ✓':'')+'</span>'
          +'</div>';
      });
      html+='</div>';
    }
  }

  // ── Bouton retour ──
  html+='<button class="sbtn" style="margin-top:4px" onclick="document.querySelectorAll(\'.tab\')[0].click()">✏️ Modifier le personnage</button>';

  el.innerHTML=html;
}

// ── Fureur d'Ulric (d10 explosif) ──────────────────────────────────────
function fureurUlric(){
  let total=0, rolls=[], r;
  do{ r=Math.floor(Math.random()*10)+1; total+=r; rolls.push(r); }while(r===10);
  const formula=rolls.join('+')+( rolls.length>1?' 💥':'');
  document.getElementById('roll-result').textContent=total;
  document.getElementById('last-formula').textContent=formula+' (Fureur d\'Ulric)';
  const hist=document.getElementById('roll-history');
  const item=document.createElement('div');item.className='roll-item';
  item.innerHTML='Fureur d\'Ulric <span>'+total+'</span>';
  hist.prepend(item);
  while(hist.children.length>12)hist.removeChild(hist.lastChild);
  send('roll',{die:10,raw:total,modifier:0,total,formula:'Fureur d\'Ulric: '+formula});
  send('dice_roll_broadcast',{die:10,total,formula:'Fureur d\'Ulric'});
}

// ── Dice ───────────────────────────────────────────────────────────────
function buildDice(){
  const grid=document.getElementById('dice-grid');
  DICE.forEach(d=>{
    const btn=document.createElement('button');
    btn.className='die-btn';btn.textContent='d'+d;
    btn.onclick=()=>rollDie(d);grid.appendChild(btn);
  });
}

function rollDie(sides){
  const mod=parseInt(document.getElementById('mod-val').value)||0;
  const raw=Math.floor(Math.random()*sides)+1;
  const total=raw+mod;
  const ms=mod!==0?(mod>0?'+'+mod:''+mod):'';
  const formula='d'+sides+ms;
  document.getElementById('roll-result').textContent=total;
  document.getElementById('last-formula').textContent='('+raw+ms+') — '+formula;
  const hist=document.getElementById('roll-history');
  const item=document.createElement('div');item.className='roll-item';
  item.innerHTML=formula+' <span>'+total+'</span>';
  hist.prepend(item);
  while(hist.children.length>12)hist.removeChild(hist.lastChild);
  send('roll',{die:sides,raw,modifier:mod,total,formula});
  send('dice_roll_broadcast',{die:sides,total,formula});
}

// ── Combat display ─────────────────────────────────────────────────────
function renderCombat(data){
  const list=document.getElementById('combat-list');
  if(!data||!data.combatants||!data.combatants.length){
    list.innerHTML='<div class="no-combat">Pas de combat en cours</div>';return;
  }
  list.innerHTML=data.combatants.map((c,i)=>{
    const pct=c.maxHp>0?Math.max(0,c.hp/c.maxHp)*100:0;
    const col=pct>50?'var(--green)':pct>20?'#eab308':'var(--red)';
    return '<div class="combatant'+(i===data.currentTurn?' cur':'')+( c.isEnemy?' emy':'')+'">'+
      '<span style="font-size:10px;color:var(--muted);width:18px">'+(i+1)+'</span>'+
      '<span class="c-name">'+esc(c.name)+'</span>'+
      '<div class="hp-bar"><div class="hp-fill" style="width:'+pct+'%;background:'+col+'"></div></div>'+
      '<span class="c-hp">'+c.hp+'/'+c.maxHp+'</span></div>';
  }).join('');
}

// ── Chat ───────────────────────────────────────────────────────────────
function sendChat(){
  const inp=document.getElementById('chat-input');
  const msg=inp.value.trim();if(!msg)return;
  inp.value='';
  const event=chatMode==='group'?'group_chat':'chat';
  addChatMsg(playerName||'Moi',msg,true,chatMode==='group');
  send(event,{message:msg});
}
function addChatMsg(from,text,isMe,isGroup){
  const msgs=document.getElementById('chat-msgs');
  const div=document.createElement('div');
  let cls='chat-msg ';
  if(isMe)cls+='from-me';
  else if(isGroup)cls+='from-group';
  else cls+='from-gm';
  div.className=cls;
  div.innerHTML='<div class="sndr">'+esc(from)+(isGroup?' 👥':'')+'</div>'+esc(text);
  msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;
}
function setChatMode(mode){
  chatMode=mode;
  document.getElementById('mode-gm').classList.toggle('active',mode==='gm');
  document.getElementById('mode-group').classList.toggle('active',mode==='group');
  const inp=document.getElementById('chat-input');
  if(inp)inp.placeholder=mode==='group'?'Message au groupe…':'Message privé au MJ…';
}

// ── WebSocket ──────────────────────────────────────────────────────────
function connect(){
  if(ws){ws.close();ws=null;}
  const proto=location.protocol==='https:'?'wss':'ws';
  ws=new WebSocket(proto+'://'+location.host+'/ws');
  ws.onopen=()=>{
    reconnDelay=1000;
    ws.send(JSON.stringify({event:'join',data:{name:playerName}}));
    showStatus('Connecté',true);
  };
  ws.onmessage=(e)=>{
    try{
      const env=JSON.parse(e.data);
      if(env.event==='welcome'){
        playerId=env.data.id;
      }else if(env.event==='game_config'){
        gameConfig=env.data;
        populateRaceDropdown();
        populateCareerDropdown();
      }else if(env.event==='restore_character'){
        // Personnage sauvegardé côté serveur — priorité sur localStorage
        loadCharFromData(env.data);
        localStorage.setItem('grimoire_wfrp2',JSON.stringify(ch));
        showStatus('Personnage restauré !',true);
        setTimeout(()=>showStatus('Connecté',true),2000);
      }else if(env.event==='push_character'){
        // MJ envoie un perso créé depuis le Créateur de personnage
        if(!env.data.playerId||env.data.playerId===playerId){
          loadCharFromData(env.data.character||env.data);
          localStorage.setItem('grimoire_wfrp2',JSON.stringify(ch));
          showStatus('Nouveau personnage reçu du MJ !',true);
          setTimeout(()=>showStatus('Connecté',true),2500);
        }
      }else if(env.event==='scene'){
        renderCombat(env.data);
      }else if(env.event==='chat'){
        addChatMsg(env.data.from||'MJ',env.data.message,false,false);
      }else if(env.event==='ping'){
        addChatMsg('📢 MJ',env.data.message||'Ping !',false,false);
      }else if(env.event==='group_chat_msg'){
        // Ne pas afficher ses propres messages (déjà ajoutés dans sendChat)
        if(env.data.from_id!==playerId){
          addChatMsg(env.data.from||'Joueur',env.data.message,false,true);
        }
      }else if(env.event==='group_state'){
        renderGroupState(env.data);
      }else if(env.event==='damage_applied'){
        if(env.data.target_id!==playerId)return;
        ch.bless=env.data.bless;
        sv('f-bless',ch.bless);updateHealthState();
        const delta=env.data.damage;
        showStatus(delta>0?'💥 -'+delta+' blessures':'💚 +'+Math.abs(delta)+' soins',delta<=0||env.data.bless>0);
        setTimeout(()=>showStatus('Connecté',true),2500);
      }else if(env.event==='condition_added'){
        if(env.data.target_id!==playerId)return;
        myConditions=env.data.conditions||[];
        renderMyConditions();
        showStatus('⚠️ Condition : '+env.data.condition,false);
        setTimeout(()=>showStatus('Connecté',true),3000);
      }else if(env.event==='condition_removed'){
        if(env.data.target_id!==playerId)return;
        myConditions=env.data.conditions||[];
        renderMyConditions();
      }else if(env.event==='your_turn'){
        const isMe=env.data.target_id===playerId;
        const bar=document.getElementById('your-turn-bar');
        if(bar)bar.style.display=(isMe&&env.data.active)?'block':'none';
        if(isMe&&env.data.active){
          showStatus('⚡ C\'est votre tour !',true);
          setTimeout(()=>showStatus('Connecté',true),4000);
          if(navigator.vibrate)navigator.vibrate([200,100,200,100,400]);
          try{
            const ac=new(window.AudioContext||window.webkitAudioContext)();
            const playBeep=(freq,start,dur)=>{
              const o=ac.createOscillator();const g=ac.createGain();
              o.connect(g);g.connect(ac.destination);
              o.type='sine';o.frequency.value=freq;
              g.gain.setValueAtTime(0.3,ac.currentTime+start);
              g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+start+dur);
              o.start(ac.currentTime+start);o.stop(ac.currentTime+start+dur+0.05);
            };
            playBeep(440,0,0.15);playBeep(660,0.2,0.15);playBeep(880,0.4,0.3);
          }catch(e){}
        }
      }else if(env.event==='xp_approved'){
        if(env.data.target_id!==playerId)return;
        ch.xp=env.data.total_xp;
        sv('p-xp',ch.xp);sc();
        showStatus('💫 +'+env.data.amount+' XP approuvés ! Total : '+env.data.total_xp,true);
        const pm=document.getElementById('xp-pending-msg');if(pm)pm.textContent='';
        setTimeout(()=>showStatus('Connecté',true),4000);
      }else if(env.event==='player_reaction'){
        addReactionFeed(env.data.from,env.data.emoji);
      }else if(env.event==='handout'){
        showHandout(env.data);
        addToRecus(env.data);
      }else if(env.event==='request_roll'){
        if(!env.data.target_id || env.data.target_id === playerId) {
          showRollRequest(env.data);
        }
      }else if(env.event==='ai_response'){
        addAiMsg(env.data.response || env.data.error, false);
      }else if(env.event==='map_snapshot'){
        const img = document.getElementById('map-img');
        if(img) img.src = env.data.image_data;
      }else if(env.event==='sketch_sync'){
        if(env.data.target_id === playerId) return;
        drawExternalSketch(env.data.points, env.data.color);
      }
    }catch(err){}
  };
  ws.onerror=()=>showStatus('Erreur de connexion',false);
  ws.onclose=()=>{
    showStatus('Déconnecté — reconnexion…',false);
    setTimeout(()=>{reconnDelay=Math.min(reconnDelay*2,8000);connect();},reconnDelay);
  };
}
function send(event,data){
  if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({event,data}));
}

// ── UI ─────────────────────────────────────────────────────────────────
function joinGame(){
  const n=document.getElementById('player-name').value.trim();
  if(!n){alert('Entrez votre nom de personnage !');return;}
  playerName=n;
  localStorage.setItem('grimoire_player_name',n);
  if(!ch.nom)ch.nom=n;
  document.getElementById('join').style.display='none';
  document.getElementById('app').style.display='flex';
  if(!document.getElementById('f-nom').value)sv('f-nom',n);
  connect();
}
function showTab(btn,id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  btn.classList.add('active');
}
function showStatus(msg,ok){
  const bar=document.getElementById('status-bar');
  bar.textContent=msg;bar.className='status '+(ok?'ok':'err');
}

// ── Groupe ─────────────────────────────────────────────────────────────
function renderGroupState(data){
  const list=document.getElementById('group-list');
  if(!list)return;
  const players=data.players||[];
  if(!players.length){list.innerHTML='<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px">Aucun joueur connecté</div>';return;}
  list.innerHTML=players.map(p=>{
    const pct=p.maxhp>0?Math.max(0,Math.min(100,p.hp/p.maxhp*100)):0;
    const col=pct>60?'var(--green)':pct>25?'#eab308':'var(--red)';
    const isMe=p.id===playerId;
    const turnDot=p.active_turn?'<span class="grp-turn-dot"></span>':'';
    const conds=p.conditions&&p.conditions.length?'<div class="cond-list">'+p.conditions.map(c=>'<span class="cond-tag">'+esc(c)+'</span>').join('')+'</div>':'';
    const xpPend=p.pending_xp?'<div style="font-size:10px;color:var(--accent);margin-top:2px">💫 Demande XP : '+p.pending_xp+'</div>':'';
    return '<div class="grp-card'+(p.active_turn?' turn-active':'')+'">'
      +'<div class="grp-name">'+turnDot+esc(p.name)+(isMe?' <span style="font-size:10px;color:var(--muted)">(moi)</span>':'')+'</div>'
      +(p.maxhp>0?'<div class="grp-hp-row"><div class="grp-hp-bar"><div class="grp-hp-fill" style="width:'+pct+'%;background:'+col+'"></div></div><span class="grp-hp-txt">'+p.hp+'/'+p.maxhp+'</span></div>':'')
      +conds+xpPend+'</div>';
  }).join('');

  // Update party bar (light list)
  const bar=document.getElementById('party-bar');
  if(bar){
    bar.innerHTML=players.map(p=>{
      const pct=p.maxhp>0?Math.max(0,Math.min(100,p.hp/p.maxhp*100)):0;
      const col=pct>60?'var(--green)':pct>25?'#eab308':'var(--red)';
      return '<div class="pb-item'+(p.active_turn?' active':'')+'">'
        +'<div class="pb-name">'+esc(p.name)+'</div>'
        +'<div class="pb-hp-bar"><div class="pb-hp-fill" style="width:'+pct+'%;background:'+col+'"></div></div>'
        +'</div>';
    }).join('');
  }
}

function renderMyConditions(){
  const el=document.getElementById('my-conditions');
  if(!el)return;
  if(!myConditions.length){el.innerHTML='<span style="color:var(--muted);font-size:12px">Aucune condition active</span>';return;}
  el.innerHTML=myConditions.map(c=>'<span class="cond-tag">'+esc(c)+'</span>').join('');
}

function sendReaction(emoji){
  send('reaction',{emoji});
  addReactionFeed('Moi',emoji);
}

function addReactionFeed(from,emoji){
  const feed=document.getElementById('react-feed');
  if(!feed)return;
  const el=document.createElement('div');
  el.className='react-item';
  el.textContent=emoji+' '+from;
  feed.prepend(el);
  while(feed.children.length>20)feed.removeChild(feed.lastChild);
}

function requestXP(){
  const amt=parseInt(document.getElementById('xp-req-amt')?.value)||100;
  send('request_xp',{amount:amt});
  const msg=document.getElementById('xp-pending-msg');
  if(msg)msg.innerHTML='<div class="xp-pending">💫 Demande de '+amt+' XP envoyée au MJ…</div>';
}

// ── Test de compétence ─────────────────────────────────────────────────
function buildSkillTests(){
  const grid=document.getElementById('test-grid');
  if(!grid)return;
  const shown=[['cc','CC'],['ct','CT'],['f','F'],['e','E'],['i','I'],['dex','Dex'],['cd','Cd'],['int','Int'],['cl','Cl'],['fm','FM'],['soc','Soc']];
  grid.innerHTML=shown.map(([k,l])=>{
    const val=parseInt(ch.profil?.act?.[k])||0;
    return '<button class="test-btn" onclick="rollSkillTest(\''+k+'\','+val+')">'
      +'<span class="test-key">'+l+'</span>'
      +'<span class="test-val">'+val+'</span></button>';
  }).join('');
}

function rollSkillTest(stat,val){
  const mod=parseInt(document.getElementById('mod-val')?.value)||0;
  const target=val+mod;
  const roll=Math.floor(Math.random()*100)+1;
  const success=roll<=target;
  const deg=success?Math.floor((target-roll)/10)+1:Math.floor((roll-target)/10)+1;
  const rEl=document.getElementById('test-result');
  const numEl=document.getElementById('test-roll-num');
  const verdEl=document.getElementById('test-verdict');
  if(rEl)rEl.style.display='block';
  if(numEl){numEl.textContent=roll;numEl.style.color=success?'var(--green)':'var(--red)';}
  if(verdEl){
    verdEl.className='test-verdict '+(success?'test-success':'test-fail');
    verdEl.textContent=success?'✅ Succès (x'+deg+') — vs '+target:'❌ Échec (x'+deg+') — vs '+target;
  }
  send('roll',{die:100,raw:roll,total:roll,formula:stat.toUpperCase()+' test vs '+target,success,degrees:deg});
  send('dice_roll_broadcast',{die:100,total:roll,formula:stat.toUpperCase()+' test'});
  const hist=document.getElementById('roll-history');
  if(hist){
    const item=document.createElement('div');item.className='roll-item';
    item.innerHTML=(success?'✅ ':'❌ ')+stat.toUpperCase()+' <span>'+roll+' / '+target+'</span>';
    hist.prepend(item);while(hist.children.length>12)hist.removeChild(hist.lastChild);
  }
}

// ── Localisation & Initiative ──────────────────────────────────────────
const LOC_TABLE=[
  [1,15,'🧢 Tête'],[16,35,'💪 Bras Droit'],[36,55,'💪 Bras Gauche'],
  [56,80,'🛡️ Tronc'],[81,90,'🦵 Jambe Droite'],[91,100,'🦵 Jambe Gauche']
];

function rollLocalisation(){
  const roll=Math.floor(Math.random()*100)+1;
  const zone=LOC_TABLE.find(([a,b])=>roll>=a&&roll<=b)||[0,0,'?'];
  const rEl=document.getElementById('loc-result');
  if(rEl)rEl.style.display='block';
  const rollEl=document.getElementById('loc-roll');if(rollEl)rollEl.textContent=roll;
  const zoneEl=document.getElementById('loc-zone');if(zoneEl)zoneEl.textContent=zone[2];
}

function rollInitiative(){
  const iVal=parseInt(ch.profil?.act?.i)||0;
  const d10=Math.floor(Math.random()*10)+1;
  const total=iVal+d10;
  const rEl=document.getElementById('init-result');
  if(rEl)rEl.style.display='block';
  const rollEl=document.getElementById('init-roll');if(rollEl)rollEl.textContent=total;
  const zoneEl=document.getElementById('init-zone');if(zoneEl)zoneEl.textContent='I('+iVal+') + d10('+d10+') = '+total;
  send('initiative_roll',{result:total,i_val:iVal,d10});
}

// ── Handout ────────────────────────────────────────────────────────────
function showHandout(data){
  const overlay=document.getElementById('handout-overlay');
  const imgEl=document.getElementById('ho-img');
  const titleEl=document.getElementById('ho-title');
  const textEl=document.getElementById('ho-text');
  if(!overlay)return;
  if(titleEl)titleEl.textContent=data.title||'Handout du MJ';
  if(textEl)textEl.textContent=data.text||'';
  if(imgEl){
    if(data.image_url){imgEl.src=data.image_url;imgEl.style.display='block';}
    else{imgEl.style.display='none';}
  }
  overlay.classList.add('active');
}
function closeHandout(){
  const overlay=document.getElementById('handout-overlay');
  if(overlay)overlay.classList.remove('active');
}

function showRollRequest(data){
  const overlay=document.getElementById('roll-request-overlay');
  if(!overlay)return;
  document.getElementById('rr-stat-name').textContent=data.stat.toUpperCase();
  const m=data.modifier;
  document.getElementById('rr-stat-mod').textContent=m==0?'':'('+(m>0?'+':'')+m+')';
  document.getElementById('rr-roll-btn').onclick=()=>{
    const statKey=data.stat.toLowerCase();
    const val=parseInt(ch.profil?.act?.[statKey])||0;
    rollSkillTest(statKey,val);
    closeRollRequest();
  };
  overlay.classList.add('active');
  if(navigator.vibrate)navigator.vibrate([100,50,100]);
}
function closeRollRequest(){
  const overlay=document.getElementById('roll-request-overlay');
  if(overlay)overlay.classList.remove('active');
}

function addToRecus(data){
  recus.unshift(data);
  const list=document.getElementById('recv-list');
  if(!list)return;
  const item=document.createElement('div');item.className='recv-item';
  const titleDiv=document.createElement('div');titleDiv.className='recv-title';titleDiv.textContent=data.title||'Handout';
  item.appendChild(titleDiv);
  if(data.image_url){
    const img=document.createElement('img');img.src=data.image_url;img.style.cursor='pointer';
    img.onclick=()=>showHandout(data);
    item.appendChild(img);
  }
  if(data.text){const note=document.createElement('div');note.className='recv-note';note.textContent=data.text;item.appendChild(note);}
  if(list.firstChild&&list.firstChild.textContent&&list.firstChild.textContent.includes('Aucun')){list.innerHTML='';}
  list.prepend(item);
}

function sendJournal(){
  const text=document.getElementById('journ-text').value.trim();
  if(!text){alert('Le journal est vide !');return;}
  send('journal_push', { text, date: new Date().toISOString() });
  showStatus('Journal synchronisé !', true);
}

// ── Sketchpad ────────────────────────────────────────────────────────
let skCtx, skCanvas, isSkDrawing=false, skPoints=[];
function initSketch(){
  skCanvas=document.getElementById('sk-canvas');
  if(!skCanvas)return;
  skCtx=skCanvas.getContext('2d');
  const resize=()=>{
    const r=skCanvas.getBoundingClientRect();
    skCanvas.width=r.width;skCanvas.height=r.height;
  };
  window.addEventListener('resize',resize);resize();
  
  const getPos=(e)=>{
    const r=skCanvas.getBoundingClientRect();
    const t=e.touches?e.touches[0]:e;
    return {x:t.clientX-r.left,y:t.clientY-r.top};
  };
  const start=(e)=>{isSkDrawing=true;skPoints=[];move(e);};
  const move=(e)=>{
    if(!isSkDrawing)return;
    const p=getPos(e);skPoints.push(p);
    renderSketch();
  };
  const end=()=>{isSkDrawing=false;};
  skCanvas.addEventListener('mousedown',start);skCanvas.addEventListener('mousemove',move);skCanvas.addEventListener('mouseup',end);
  skCanvas.addEventListener('touchstart',start);skCanvas.addEventListener('touchmove',move);skCanvas.addEventListener('touchend',end);
}
function renderSketch(){
  skCtx.clearRect(0,0,skCanvas.width,skCanvas.height);
  skCtx.strokeStyle='var(--accent)';skCtx.lineWidth=3;skCtx.lineCap='round';skCtx.lineJoin='round';
  if(skPoints.length<2)return;
  skCtx.beginPath();skCtx.moveTo(skPoints[0].x,skPoints[0].y);
  for(let i=1;i<skPoints.length;i++)skCtx.lineTo(skPoints[i].x,skPoints[i].y);
  skCtx.stroke();
}
function clearSketch(){skPoints=[];skCtx.clearRect(0,0,skCanvas.width,skCanvas.height);}
function sendSketch(){
  if(skPoints.length<2)return;
  send('sketch_push',{points:skPoints,color:'#e5a853'});
  showStatus('Croquis envoyé !',true);
}

// ── AI ────────────────────────────────────────────────────────────────
function askAI(){
  const inp=document.getElementById('ai-input');
  const msg=inp.value.trim();if(!msg)return;
  inp.value='';
  addAiMsg(msg, true);
  
  const isMJ = document.getElementById('ai-mj-mode').checked;
  const sys = isMJ 
    ? "Tu es le Maître du Jeu (MJ) de Warhammer Fantasy. Tu décris les scènes de manière sombre, viscérale et immersive. Tu joues les PNJ et réponds aux actions des joueurs. Réponds toujours en français."
    : "Tu es un assistant de jeu expert en règles pour Warhammer Fantasy (WFRP). Réponds de manière concise et utile en français.";
    
  send('ai_query', { prompt: msg, system: sys });
}
function addAiMsg(text, isMe){
  const chat=document.getElementById('ai-chat');
  const div=document.createElement('div');
  div.className='ai-msg '+(isMe?'ai-user':'ai-bot');
  div.textContent=text;
  chat.appendChild(div);
  chat.scrollTop=chat.scrollHeight;
  
  if(!isMe && document.getElementById('ai-tts-mode').checked) {
    speakText(text);
  }
}
function speakText(text) {
  if(!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const ut = new SpeechSynthesisUtterance(text);
  ut.lang = 'fr-FR';
  ut.rate = 1.0;
  window.speechSynthesis.speak(ut);
}

// ── Destiny Animation ─────────────────────────────────────────────────
function triggerDestinyAnim(){
  const el=document.getElementById('p-destin');
  if(!el)return;
  el.classList.remove('destiny-active');
  void el.offsetWidth; // trigger reflow
  el.classList.add('destiny-active');
}
const oldSC = sc;
sc = function() {
  const oldDestin = ch.destin;
  oldSC();
  if(ch.destin < oldDestin) triggerDestinyAnim();
};

// ── Init ───────────────────────────────────────────────────────────────
buildProf();buildDice();loadChar();
const sn=localStorage.getItem('grimoire_player_name');
if(sn)document.getElementById('player-name').value=sn;
document.getElementById('player-name').addEventListener('keydown',e=>{if(e.key==='Enter')joinGame();});
document.getElementById('comp-new').addEventListener('keydown',e=>{if(e.key==='Enter')addComp();});

// Update onmessage to handle AI and Map
const oldOnMessage = ws.onmessage;
// We override inside the connect function instead
</script>
</body>
</html>"##;
