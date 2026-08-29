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
    /// Canal d'envoi dédié à chaque connexion WS active, indexé par player_id — permet
    /// à send_to_player() de cibler un seul joueur au lieu de diffuser à tous (broadcast_tx).
    pub unicast_tx: Mutex<HashMap<String, tokio::sync::mpsc::UnboundedSender<String>>>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct SavedCharacter {
    pub data: serde_json::Value,
    pub path: Option<String>,
    pub password: Option<String>,
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
            unicast_tx: Mutex::new(HashMap::new()),
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

    // Extract the player name BEFORE locking saved_characters to avoid holding
    // two Mutex guards simultaneously (deadlock risk with tokio::sync::Mutex).
    let player_name = {
        let mut players = srv.players.lock().await;
        let p = players.get_mut(&player_id).ok_or("Joueur introuvable")?;
        p.character = character.clone();
        p.character_path = Some(path.clone());
        p.name.clone()
        // players lock is dropped here
    };

    // Now safe to lock saved_characters separately
    {
        let existing_pwd = srv.saved_characters.lock().await
            .get(&player_name).and_then(|s| s.password.clone());
        srv.saved_characters.lock().await.insert(player_name, SavedCharacter {
            data: character.clone(),
            path: Some(path.clone()),
            password: existing_pwd, // preserve existing password if any
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

#[tauri::command]
pub async fn send_private_message(player_id: String, message: String) -> Result<(), String> {
    let srv = get_server();
    let msg = serde_json::to_string(&WsEnvelope {
        event: "private_message".into(),
        data: serde_json::json!({ "from": "MJ", "message": message, "target_id": player_id }),
    }).map_err(|e| e.to_string())?;
    send_to_player(srv, &player_id, msg).await;
    Ok(())
}

#[tauri::command]
pub async fn start_poll(question: String, options: Vec<String>) -> Result<(), String> {
    let srv = get_server();
    let msg = serde_json::to_string(&WsEnvelope {
        event: "poll_start".into(),
        data: serde_json::json!({ "question": question, "options": options }),
    }).map_err(|e| e.to_string())?;
    let _ = srv.broadcast_tx.send(msg);
    Ok(())
}

#[tauri::command]
pub async fn end_poll() -> Result<(), String> {
    let srv = get_server();
    let msg = serde_json::to_string(&WsEnvelope {
        event: "poll_end".into(),
        data: serde_json::json!({}),
    }).map_err(|e| e.to_string())?;
    let _ = srv.broadcast_tx.send(msg);
    Ok(())
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
    let (unicast_sender, mut unicast_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Wait for join message
    let (name, password) = if let Some(Ok(Message::Text(raw))) = socket.recv().await {
        if let Ok(env) = serde_json::from_str::<WsEnvelope>(&raw) {
            if env.event == "join" {
                let n = env.data.get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Joueur")
                    .to_string();
                let p = env.data.get("password")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                (n, p)
            } else { ("Joueur".to_string(), None) }
        } else { ("Joueur".to_string(), None) }
    } else { return; };

    // Vérification du mot de passe si un compte existe
    {
        let chars = state.saved_characters.lock().await;
        if let Some(saved) = chars.get(&name) {
            if let Some(ref saved_pwd) = saved.password {
                let provided = password.as_deref().unwrap_or("");
                if provided != saved_pwd {
                    let msg = serde_json::to_string(&WsEnvelope {
                        event: "auth_error".into(),
                        data: serde_json::json!({ "message": "Mot de passe incorrect pour ce personnage." }),
                    }).unwrap_or_default();
                    let _ = socket.send(Message::Text(msg)).await;
                    return;
                }
            }
        }
    }

    // Register player
    // L'insertion du canal unicast doit se faire APRÈS les retours anticipés ci-dessus
    // (join invalide, mot de passe incorrect) : sinon chaque connexion refusée laisserait
    // un UnboundedSender orphelin dans la table, jamais nettoyé (le remove n'a lieu qu'en
    // fin de fonction, après la boucle principale).
    state.unicast_tx.lock().await.insert(player_id.clone(), unicast_sender);
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

    // Enregistrer le mot de passe pour les nouveaux joueurs
    {
        let mut chars = state.saved_characters.lock().await;
        if !chars.contains_key(&name) && password.is_some() {
            chars.insert(name.clone(), SavedCharacter {
                data: serde_json::Value::Null,
                path: None,
                password: password.clone(),
            });
        }
    }

    // Notify GM of new player
    emit_to_gm(&state, "player_joined", serde_json::json!({
        "id": player_id, "name": name
    })).await;
    notify_os(&state, "Joueur connecté", &name).await;
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
            // Message privé ciblé pour ce joueur uniquement (send_to_player)
            msg = unicast_rx.recv() => {
                match msg {
                    Some(text) => { if socket.send(Message::Text(text)).await.is_err() { break; } }
                    None => {}
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
    state.unicast_tx.lock().await.remove(&player_id);
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
            {
                let mut chars = state.saved_characters.lock().await;
                let existing_pwd = chars.get(player_name).and_then(|s| s.password.clone());
                chars.insert(player_name.to_string(), SavedCharacter { data: char_data.clone(), path: path.clone(), password: existing_pwd });
            }
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
            let msg_text = env.data.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let is_whisper = env.event == "whisper";
            emit_to_gm(state, "player_chat", serde_json::json!({
                "id": player_id, "name": player_name,
                "message": msg_text,
                "private": is_whisper,
            })).await;
            if is_whisper {
                notify_os(state, &format!("Chuchotement — {}", player_name), &msg_text).await;
            }
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
        // Déplacement de token par le joueur
        "token_move" => {
            emit_to_gm(state, "player_token_move", serde_json::json!({
                "id": player_id,
                "name": player_name,
                "dx": env.data.get("dx").and_then(|v| v.as_i64()).unwrap_or(0),
                "dy": env.data.get("dy").and_then(|v| v.as_i64()).unwrap_or(0),
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
            notify_os(state, &format!("Demande XP — {}", player_name), &format!("{} demande {} XP", player_name, amount)).await;
        }
        "sketch_push" => {
            emit_to_gm(state, "player_sketch_push", serde_json::json!({
                "id": player_id, "name": player_name, "data": env.data
            })).await;
        }
        "spawn_token" => {
            // Get current character image if any
            let mut img = None;
            {
                let players = state.players.lock().await;
                if let Some(p) = players.get(player_id) {
                    img = p.character.get("portrait").and_then(|v| v.as_str()).map(|s| s.to_string());
                }
            }
            emit_to_gm(state, "player_spawn_token", serde_json::json!({
                "id": player_id, "name": player_name, "image": img
            })).await;
        }
        "poll_vote" => {
            let option = env.data.get("option").and_then(|v| v.as_str()).unwrap_or("").to_string();
            emit_to_gm(state, "player_poll_vote", serde_json::json!({
                "id": player_id, "name": player_name, "option": option
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

async fn notify_os(state: &std::sync::Arc<ServerInner>, title: &str, body: &str) {
    use tauri_plugin_notification::NotificationExt;
    if let Some(handle) = state.app_handle.lock().await.as_ref() {
        let _ = handle.notification().builder().title(title).body(body).show();
    }
}

/// Envoie un message WS à un seul joueur, via son canal de connexion dédié (unicast_tx).
/// Les autres joueurs connectés ne reçoivent jamais cette trame (contrairement à un
/// envoi via broadcast_tx, qui diffuse physiquement à tous les sockets).
async fn send_to_player(state: &std::sync::Arc<ServerInner>, player_id: &str, msg: String) {
    if let Some(tx) = state.unicast_tx.lock().await.get(player_id) {
        let _ = tx.send(msg);
    }
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

const PLAYER_APP_HTML: &str = include_str!("player_app.html");
