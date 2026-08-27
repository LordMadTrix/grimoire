// ── Gestionnaire de Paquets de Campagne .grimoire (Export & Import) ───────────
// Permet la sauvegarde complète et le partage de campagnes (Notes Markdown,
// Cartes HD, Brouillard de guerre, Jetons, Configuration de jeu) en un seul fichier zip.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CampaignManifest {
    pub title: String,
    pub created_at: String,
    pub grimoire_version: String,
    pub files_count: usize,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ExportResult {
    pub success: bool,
    pub file_path: String,
    pub total_files: usize,
    pub total_bytes: u64,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ImportResult {
    pub success: bool,
    pub extracted_files: usize,
    pub target_path: String,
}

/// Exporte l'intégralité du coffre / de la campagne dans un paquet compressé `.grimoire`
#[tauri::command]
pub async fn campaign_export_package(
    vault_path: String,
    output_path: String,
    title: Option<String>,
) -> Result<ExportResult, String> {
    let source_dir = Path::new(&vault_path);
    if !source_dir.exists() || !source_dir.is_dir() {
        return Err(format!("Le dossier source n'existe pas : {vault_path}"));
    }

    let target_file_path = PathBuf::from(&output_path);
    if let Some(parent) = target_file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Erreur création dossier parent : {e}"))?;
    }

    let zip_file = File::create(&target_file_path)
        .map_err(|e| format!("Impossible de créer le fichier d'archive : {e}"))?;
    let mut zip = ZipWriter::new(zip_file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    let mut count = 0;
    let mut total_bytes = 0u64;

    // 1. Ajouter tous les fichiers du dossier
    for entry in WalkDir::new(source_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            let relative_path = match path.strip_prefix(source_dir) {
                Ok(p) => p.to_string_lossy().replace('\\', "/"),
                Err(_) => continue,
            };

            // Éviter de s'auto-inclure si la sortie est dans le même dossier
            if path == target_file_path {
                continue;
            }

            zip.start_file(&relative_path, options)
                .map_err(|e| format!("Erreur ajout fichier dans l'archive ({relative_path}) : {e}"))?;

            let mut f = File::open(path)
                .map_err(|e| format!("Erreur lecture fichier source : {e}"))?;
            let mut buffer = Vec::new();
            f.read_to_end(&mut buffer)
                .map_err(|e| format!("Erreur lecture données : {e}"))?;

            total_bytes += buffer.len() as u64;
            zip.write_all(&buffer)
                .map_err(|e| format!("Erreur écriture dans l'archive : {e}"))?;

            count += 1;
        }
    }

    // 2. Ajouter le manifeste Grimoire
    let manifest = CampaignManifest {
        title: title.unwrap_or_else(|| "Campagne Grimoire".to_string()),
        created_at: chrono::Utc::now().to_rfc3339(),
        grimoire_version: env!("CARGO_PKG_VERSION").to_string(),
        files_count: count,
    };

    if let Ok(manifest_json) = serde_json::to_string_pretty(&manifest) {
        let _ = zip.start_file("grimoire_manifest.json", options);
        let _ = zip.write_all(manifest_json.as_bytes());
    }

    zip.finish()
        .map_err(|e| format!("Erreur finalisation archive : {e}"))?;

    Ok(ExportResult {
        success: true,
        file_path: output_path,
        total_files: count,
        total_bytes,
    })
}

/// Importe et extrait un paquet de campagne `.grimoire` vers un dossier cible
#[tauri::command]
pub async fn campaign_import_package(
    grimoire_file_path: String,
    target_vault_path: String,
) -> Result<ImportResult, String> {
    let source_archive = Path::new(&grimoire_file_path);
    if !source_archive.exists() || !source_archive.is_file() {
        return Err(format!("Le paquet de campagne n'existe pas : {grimoire_file_path}"));
    }

    let target_dir = PathBuf::from(&target_vault_path);
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Impossible de créer le dossier cible : {e}"))?;

    let file = File::open(source_archive)
        .map_err(|e| format!("Impossible d'ouvrir le fichier .grimoire : {e}"))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Archive corrompue ou format invalide : {e}"))?;

    let mut extracted_count = 0;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Erreur extraction entrée {i} : {e}"))?;

        let raw_path = match file.enclosed_name() {
            Some(p) => p.to_owned(),
            None => continue, // Sécurité : ignorer les chemins malicieux hors du dossier
        };

        let outpath = target_dir.join(raw_path);

        if file.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Erreur création sous-dossier : {e}"))?;
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Erreur création dossier parent : {e}"))?;
                }
            }

            let mut outfile = File::create(&outpath)
                .map_err(|e| format!("Erreur création fichier {outpath:?} : {e}"))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Erreur copie de données vers {outpath:?} : {e}"))?;

            extracted_count += 1;
        }
    }

    Ok(ImportResult {
        success: true,
        extracted_files: extracted_count,
        target_path: target_vault_path,
    })
}
