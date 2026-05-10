mod commands;
mod indexer;

use commands::search::DbState;
use rusqlite::Connection;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
            // Search
            commands::search::search_vault,
            commands::search::get_backlinks,
            commands::search::reindex,
            commands::search::get_graph_data,
            // Player View
            commands::player_view::list_monitors,
            commands::player_view::open_player_view,
            // AI
            commands::ai::ask_ollama,
            commands::ai::get_ollama_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Grimoire");
}
