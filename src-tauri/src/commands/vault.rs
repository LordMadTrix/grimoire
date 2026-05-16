use serde::{Deserialize, Serialize};
use std::path::Path;

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
    let full_path = Path::new(&vault_path).join(&relative_path);
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
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(general_purpose::STANDARD.encode(bytes))
}

/// Écrit du contenu dans un fichier du vault
#[tauri::command]
pub fn write_file(vault_path: String, relative_path: String, content: String) -> Result<(), String> {
    let full_path = Path::new(&vault_path).join(&relative_path);

    // Sécurité
    let vault_canonical = Path::new(&vault_path).canonicalize().map_err(|e| e.to_string())?;
    if let Ok(canonical) = full_path.canonicalize() {
        if !canonical.starts_with(&vault_canonical) {
            return Err("Path traversal detected".to_string());
        }
    }

    // Créer les dossiers parents si nécessaire
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    std::fs::write(&full_path, content).map_err(|e| e.to_string())
}

/// Crée un nouveau dossier dans le vault
#[tauri::command]
pub fn create_directory(vault_path: String, relative_path: String) -> Result<(), String> {
    let full_path = Path::new(&vault_path).join(&relative_path);
    std::fs::create_dir_all(&full_path).map_err(|e| e.to_string())
}

/// Supprime un fichier du vault
#[tauri::command]
pub fn delete_file(vault_path: String, relative_path: String) -> Result<(), String> {
    let full_path = Path::new(&vault_path).join(&relative_path);

    let vault_canonical = Path::new(&vault_path).canonicalize().map_err(|e| e.to_string())?;
    let canonical = full_path.canonicalize().map_err(|e| e.to_string())?;
    if !canonical.starts_with(&vault_canonical) {
        return Err("Path traversal detected".to_string());
    }

    if full_path.is_dir() {
        std::fs::remove_dir_all(&full_path).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(&full_path).map_err(|e| e.to_string())
    }
}

/// Renomme un fichier ou dossier
#[tauri::command]
pub fn rename_entry(vault_path: String, old_path: String, new_path: String) -> Result<(), String> {
    let old_full = Path::new(&vault_path).join(&old_path);
    let new_full = Path::new(&vault_path).join(&new_path);

    // Créer les dossiers parents du nouveau chemin
    if let Some(parent) = new_full.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    std::fs::rename(&old_full, &new_full).map_err(|e| e.to_string())
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
            .to_string();

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
    opener::open_browser(&url).map_err(|e| e.to_string())
}
