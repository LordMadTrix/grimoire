use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::commands::addons::sanitize_relative_path;

/// Entrée dans l'arbre de fichiers du vault
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VaultEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<VaultEntry>>,
    pub extension: Option<String>,
    pub size: Option<u64>,
}

/// Ouvre un vault et retourne son arbre de fichiers
#[tauri::command]
pub fn open_vault(path: String) -> Result<Vec<VaultEntry>, String> {
    let vault_path = Path::new(&path);
    if !vault_path.exists() {
        return Err(format!("Vault path does not exist: {}", path));
    }
    if !vault_path.is_dir() {
        return Err(format!("Vault path is not a directory: {}", path));
    }

    scan_directory(vault_path, vault_path)
}

/// Liste le contenu d'un répertoire du vault
#[tauri::command]
pub fn list_directory(vault_path: String, relative_path: String) -> Result<Vec<VaultEntry>, String> {
    let full_path = Path::new(&vault_path).join(sanitize_relative_path(&relative_path));
    if !full_path.exists() || !full_path.is_dir() {
        return Err(format!("Directory not found: {}", relative_path));
    }
    let base = Path::new(&vault_path);
    scan_directory(&full_path, base)
}

/// Lit le contenu d'un fichier du vault
#[tauri::command]
pub fn read_file(vault_path: String, relative_path: String) -> Result<String, String> {
    let full_path = Path::new(&vault_path).join(&relative_path);

    // Sécurité : vérifier que le chemin est bien dans le vault
    let canonical = full_path.canonicalize().map_err(|e| e.to_string())?;
    let vault_canonical = Path::new(&vault_path).canonicalize().map_err(|e| e.to_string())?;
    if !canonical.starts_with(&vault_canonical) {
        return Err("Path traversal detected".to_string());
    }

    std::fs::read_to_string(&full_path).map_err(|e| e.to_string())
}

use base64::{Engine as _, engine::general_purpose};

/// Lit un fichier binaire et le retourne en base64
#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    if !p.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }
    let metadata = std::fs::metadata(p).map_err(|e| e.to_string())?;
    const MAX_BASE64_READ_BYTES: u64 = 100 * 1024 * 1024; // 100 MiB
    if metadata.len() > MAX_BASE64_READ_BYTES {
        return Err(format!(
            "File too large for base64 read ({} bytes, max {} bytes)",
            metadata.len(),
            MAX_BASE64_READ_BYTES
        ));
    }
    let bytes = std::fs::read(p).map_err(|e| e.to_string())?;
    Ok(general_purpose::STANDARD.encode(bytes))
}

/// Lit un fichier binaire et le retourne sous forme de buffer brut IPC (zéro encodage base64, streaming natif)
#[tauri::command]
pub fn read_file_binary(path: String) -> Result<tauri::ipc::Response, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Fichier non trouvé: {}", path));
    }
    if !p.is_file() {
        return Err(format!("Le chemin n'est pas un fichier: {}", path));
    }
    let bytes = std::fs::read(p).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

use std::io::Write;

/// Écriture atomique anti-corruption : écriture dans un .tmp adjacent, fsync matériel puis rename atomique de l'OS
pub fn write_atomic(target_path: &Path, data: &[u8]) -> Result<(), String> {
    let parent = target_path
        .parent()
        .ok_or_else(|| "Dossier parent invalide".to_string())?;
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let tmp_file_name = format!(".tmp_{}", uuid::Uuid::new_v4());
    let tmp_path = parent.join(tmp_file_name);

    {
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp_path)
            .map_err(|e| format!("Erreur création fichier temporaire : {}", e))?;

        file.write_all(data).map_err(|e| {
            let _ = std::fs::remove_file(&tmp_path);
            format!("Erreur écriture fichier temporaire : {}", e)
        })?;

        file.sync_all().map_err(|e| {
            let _ = std::fs::remove_file(&tmp_path);
            format!("Erreur fsync matériel : {}", e)
        })?;
    }

    std::fs::rename(&tmp_path, target_path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp_path);
        format!("Erreur swap atomique du fichier : {}", e)
    })?;

    Ok(())
}

/// Écrit des données base64 (ex: image PNG générée par le Map Editor) dans un fichier du vault de façon atomique
#[tauri::command]
pub fn write_file_base64(vault_path: String, relative_path: String, base64_content: String) -> Result<(), String> {
    let full_path = Path::new(&vault_path).join(sanitize_relative_path(&relative_path));

    let clean_b64 = if let Some(idx) = base64_content.find(',') {
        &base64_content[idx + 1..]
    } else {
        &base64_content
    };

    let bytes = general_purpose::STANDARD.decode(clean_b64).map_err(|e| format!("Invalid base64: {}", e))?;

    write_atomic(&full_path, &bytes)
}

fn get_history_dir(vault_path: &str, relative_path: &str) -> PathBuf {
    let safe_folder: String = relative_path
        .replace('/', "_")
        .replace('\\', "_")
        .replace(':', "_");
    Path::new(vault_path)
        .join(".grimoire")
        .join("history")
        .join(safe_folder)
}

fn save_snapshot(vault_path: &str, relative_path: &str, content: &str) {
    let hist_dir = get_history_dir(vault_path, relative_path);
    let _ = std::fs::create_dir_all(&hist_dir);

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let file_name = format!("{timestamp}.md");
    let snapshot_file = hist_dir.join(file_name);
    let _ = write_atomic(&snapshot_file, content.as_bytes());

    // Garder seulement les 10 snapshots les plus récents
    if let Ok(entries) = std::fs::read_dir(&hist_dir) {
        let mut files: Vec<PathBuf> = entries
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.extension().map_or(false, |ext| ext == "md"))
            .collect();
        files.sort();
        if files.len() > 10 {
            for old in files.iter().take(files.len() - 10) {
                let _ = std::fs::remove_file(old);
            }
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NoteSnapshot {
    pub id: String,
    pub timestamp: u64,
    pub date_formatted: String,
    pub size: usize,
    pub preview: String,
}

#[tauri::command]
pub fn get_file_history(vault_path: String, relative_path: String) -> Result<Vec<NoteSnapshot>, String> {
    let hist_dir = get_history_dir(&vault_path, &relative_path);
    if !hist_dir.exists() {
        return Ok(Vec::new());
    }

    let mut snapshots = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&hist_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "md") {
                let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
                if let Ok(ts) = stem.parse::<u64>() {
                    let content = std::fs::read_to_string(&path).unwrap_or_default();
                    let size = content.len();
                    let preview = content.chars().take(200).collect::<String>();
                    let date_formatted = chrono::DateTime::from_timestamp(ts as i64, 0)
                        .map(|dt| dt.format("%d/%m/%Y %H:%M:%S").to_string())
                        .unwrap_or_else(|| format!("{ts}"));
                    snapshots.push(NoteSnapshot {
                        id: stem.to_string(),
                        timestamp: ts,
                        date_formatted,
                        size,
                        preview,
                    });
                }
            }
        }
    }
    snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(snapshots)
}

#[tauri::command]
pub fn restore_file_snapshot(
    db: tauri::State<'_, crate::commands::search::DbState>,
    vault_path: String,
    relative_path: String,
    snapshot_id: String,
) -> Result<String, String> {
    let hist_dir = get_history_dir(&vault_path, &relative_path);
    let snapshot_file = hist_dir.join(format!("{}.md", snapshot_id));
    if !snapshot_file.exists() {
        return Err("Snapshot introuvable".to_string());
    }
    let content = std::fs::read_to_string(&snapshot_file).map_err(|e| e.to_string())?;
    write_file(db, vault_path, relative_path, content.clone())?;
    Ok(content)
}

/// Écrit du contenu dans un fichier du vault de manière atomique et met à jour l'index FTS5 en temps réel
#[tauri::command]
pub fn write_file(
    db: tauri::State<'_, crate::commands::search::DbState>,
    vault_path: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    let full_path = Path::new(&vault_path).join(sanitize_relative_path(&relative_path));

    // Si le fichier existe déjà et que c'est un fichier markdown (.md), sauvegarder un snapshot
    if full_path.is_file() && relative_path.ends_with(".md") {
        if let Ok(old_content) = std::fs::read_to_string(&full_path) {
            if old_content != content && !old_content.trim().is_empty() {
                save_snapshot(&vault_path, &relative_path, &old_content);
            }
        }
    }

    write_atomic(&full_path, content.as_bytes())?;

    // Indexation incrémentale immédiate dans SQLite FTS5 (< 2ms)
    if relative_path.ends_with(".md") {
        if let Ok(conn) = db.0.lock() {
            let _ = crate::indexer::index_single_file(&conn, &relative_path, &content);
        }
    }

    Ok(())
}

/// Crée un nouveau dossier dans le vault
#[tauri::command]
pub fn create_directory(vault_path: String, relative_path: String) -> Result<(), String> {
    let full_path = Path::new(&vault_path).join(sanitize_relative_path(&relative_path));
    std::fs::create_dir_all(&full_path).map_err(|e| e.to_string())
}

/// Supprime un fichier du vault et le retire de l'index FTS5
#[tauri::command]
pub fn delete_file(
    db: tauri::State<'_, crate::commands::search::DbState>,
    vault_path: String,
    relative_path: String,
) -> Result<(), String> {
    let full_path = Path::new(&vault_path).join(&relative_path);

    let vault_canonical = Path::new(&vault_path).canonicalize().map_err(|e| e.to_string())?;
    let canonical = full_path.canonicalize().map_err(|e| e.to_string())?;
    if !canonical.starts_with(&vault_canonical) {
        return Err("Path traversal detected".to_string());
    }

    if full_path.is_dir() {
        std::fs::remove_dir_all(&full_path).map_err(|e| e.to_string())?;
    } else {
        std::fs::remove_file(&full_path).map_err(|e| e.to_string())?;
    }

    // Retrait immédiat de l'index FTS5
    if relative_path.ends_with(".md") {
        if let Ok(conn) = db.0.lock() {
            let _ = crate::indexer::remove_from_index(&conn, &relative_path);
        }
    }

    Ok(())
}

/// Renomme un fichier ou dossier et synchronise l'index FTS5
#[tauri::command]
pub fn rename_entry(
    db: tauri::State<'_, crate::commands::search::DbState>,
    vault_path: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let old_full = Path::new(&vault_path).join(sanitize_relative_path(&old_path));
    let new_full = Path::new(&vault_path).join(sanitize_relative_path(&new_path));

    // Créer les dossiers parents du nouveau chemin
    if let Some(parent) = new_full.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    std::fs::rename(&old_full, &new_full).map_err(|e| e.to_string())?;

    // Mettre à jour l'index FTS5 si c'est un fichier markdown
    if new_path.ends_with(".md") {
        if let Ok(conn) = db.0.lock() {
            let _ = crate::indexer::remove_from_index(&conn, &old_path);
            if let Ok(content) = std::fs::read_to_string(&new_full) {
                let _ = crate::indexer::index_single_file(&conn, &new_path, &content);
            }
        }
    }

    Ok(())
}

// ── Helpers ──────────────────────────────────────────────────────

fn scan_directory(dir: &Path, base: &Path) -> Result<Vec<VaultEntry>, String> {
    let mut entries = Vec::new();

    let read_dir = std::fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Ignorer les fichiers/dossiers cachés et .grimoire
        if name.starts_with('.') || name == "node_modules" {
            continue;
        }

        let relative = path.strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        if path.is_dir() {
            let children = scan_directory(&path, base).ok();
            entries.push(VaultEntry {
                name,
                path: relative,
                is_dir: true,
                children,
                extension: None,
                size: None,
            });
        } else {
            let ext = path.extension()
                .map(|e| e.to_string_lossy().to_string());
            let size = std::fs::metadata(&path).ok().map(|m| m.len());

            entries.push(VaultEntry {
                name,
                path: relative,
                is_dir: false,
                children: None,
                extension: ext,
                size,
            });
        }
    }

    // Dossiers d'abord, puis fichiers, triés par nom
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// Ouvre une URL dans le navigateur par défaut du système (cross-platform)
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Only http/https URLs are allowed".to_string());
    }
    opener::open_browser(&url).map_err(|e| e.to_string())
}

/// Sauvegarde un fichier binaire (STL, zip, etc.) sur le disque à l'emplacement choisi par l'utilisateur
#[tauri::command]
pub fn save_binary_file_to_disk(file_path: String, base64_content: String) -> Result<(), String> {
    use base64::{engine::general_purpose, Engine as _};
    let clean_b64 = if let Some(idx) = base64_content.find(',') {
        &base64_content[idx + 1..]
    } else {
        &base64_content
    };
    let bytes = general_purpose::STANDARD.decode(clean_b64).map_err(|e| format!("Invalid base64: {}", e))?;
    std::fs::write(&file_path, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

/// Ouvre un fichier ou chemin local dans l'application par défaut de l'OS (navigateur, slicer 3D, etc.)
#[tauri::command]
pub fn open_file_in_os(path: String) -> Result<(), String> {
    opener::open(&path).map_err(|e| e.to_string())
}

/// Écrit un fichier HTML temporaire et l'ouvre directement dans le navigateur par défaut pour impression
#[tauri::command]
pub fn save_temp_html_and_open(filename: String, html_content: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(&filename);
    std::fs::write(&file_path, html_content).map_err(|e| e.to_string())?;
    let path_str = file_path.to_string_lossy().to_string();
    opener::open(&path_str).map_err(|e| e.to_string())?;
    Ok(path_str)
}

