use crate::indexer::{self, SearchResult, BacklinkResult, GraphData};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

pub struct DbState(pub Mutex<Connection>);

/// Recherche dans l'index FTS5
#[tauri::command]
pub fn search_vault(
    db: State<'_, DbState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    indexer::search(&conn, &query, limit.unwrap_or(20)).map_err(|e| e.to_string())
}

/// Récupère les backlinks d'un fichier
#[tauri::command]
pub fn get_backlinks(
    db: State<'_, DbState>,
    path: String,
) -> Result<Vec<BacklinkResult>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    indexer::get_backlinks(&conn, &path).map_err(|e| e.to_string())
}

/// Force la ré-indexation du vault
#[tauri::command]
pub fn reindex(
    db: State<'_, DbState>,
    vault_path: String,
) -> Result<usize, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let path = std::path::Path::new(&vault_path);
    indexer::reindex_vault(path, &conn).map_err(|e| e.to_string())
}

/// Récupère toutes les données du graphe
#[tauri::command]
pub fn get_graph_data(
    db: State<'_, DbState>,
) -> Result<GraphData, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    indexer::get_graph_data(&conn).map_err(|e| e.to_string())
}
