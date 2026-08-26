mod commands;
mod indexer;

use commands::search::DbState;
use rusqlite::Connection;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Installer le CryptoProvider Rustls par défaut (Ring) pour le support TLS sécurisé
    let _ = rustls::crypto::ring::default_provider().install_default();

    // Initialiser la base SQLite en mémoire (sera remplacée par fichier au vault open)
    let db = Connection::open_in_memory()
        .expect("Failed to create SQLite database");
    indexer::init_db(&db).expect("Failed to initialize database schema");

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DbState(Mutex::new(db)))
        .invoke_handler(tauri::generate_handler![
            // Vault filesystem
            commands::vault::open_vault,
            commands::vault::list_directory,
            commands::vault::read_file,
            commands::vault::read_file_base64,
            commands::vault::write_file,
            commands::vault::create_directory,
            commands::vault::delete_file,
            commands::vault::rename_entry,
            commands::vault::open_url,
            // Game config (addon system)
            commands::config::load_game_config,
            commands::config::save_game_config,
            // Search
            commands::search::search_vault,
            commands::search::get_backlinks,
            commands::search::reindex,
            commands::search::get_graph_data,
            // Player View
            commands::player_view::list_monitors,
            commands::player_view::open_player_view,
            commands::player_view::emit_to_player_view,
            commands::player_view::open_map_editor,
            // AI
            commands::ai::ask_ollama,
            commands::ai::get_ollama_models,
            commands::ai::check_ollama_status,
            commands::ai::download_ollama_binary,
            commands::ai::pull_ollama_model,
            // Player mobile server
            commands::player_server::start_player_server,
            commands::player_server::stop_player_server,
            commands::player_server::broadcast_to_players,
            commands::player_server::get_player_connections,
            commands::player_server::get_server_status,
            commands::player_server::set_game_config,
            commands::player_server::apply_damage_to_player,
            commands::player_server::apply_condition_to_player,
            commands::player_server::remove_condition_from_player,
            commands::player_server::set_active_turn,
            commands::player_server::approve_xp_request,
            commands::player_server::request_roll,
            commands::player_server::assign_character,
            commands::player_server::push_map_snapshot,
            commands::player_server::send_private_message,
            commands::player_server::start_poll,
            commands::player_server::end_poll,
            // Updater
            commands::update::check_for_updates,
            commands::update::get_current_version,
            // Addon store & Drive
            commands::addons::addon_fetch_catalog,
            commands::addons::addon_list_installed,
            commands::addons::addon_check_installed_files,
            commands::addons::addon_download_file,
            commands::addons::addon_download_pack,
            commands::addons::addon_install,
            commands::addons::addon_install_local_file,
            commands::addons::addon_uninstall,
            commands::addons::addon_open_folder,
            commands::addons::addon_fetch_pdf_bytes,
            // TTS Synthèse Neuronale IA
            commands::edge_tts::tts_synthesize_neural,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Grimoire");
}
