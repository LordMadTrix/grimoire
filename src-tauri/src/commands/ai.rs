use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use tauri::Emitter;

const OLLAMA_HOST: &str = "http://localhost:11435";

#[derive(Serialize, Deserialize)]
pub struct OllamaRequest {
    pub model: String,
    pub prompt: String,
    pub system: String,
    pub stream: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct OllamaResponse {
    pub response: Option<String>,
    pub error: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct OllamaTagsResponse {
    pub models: Vec<OllamaModelItem>,
}

#[derive(Deserialize, Debug)]
pub struct OllamaModelItem {
    pub name: String,
}

#[derive(Serialize)]
pub struct OllamaStatus {
    pub binary_exists: bool,
    pub server_running: bool,
    pub models: Vec<String>,
}

fn local_ollama_paths() -> (PathBuf, PathBuf, PathBuf) {
    let exe_path = std::env::current_exe().unwrap_or_default();
    let base_dir = exe_path.parent().unwrap_or(&std::path::PathBuf::new()).to_path_buf();
    let bin_name = if cfg!(windows) { "ollama.exe" } else { "ollama" };
    let local_bin = base_dir.join("bin").join(bin_name);
    let models_dir = base_dir.join("models");
    let config_dir = base_dir.join("config");
    (local_bin, models_dir, config_dir)
}

async fn wait_server_ready(client: &reqwest::Client, attempts: usize, delay_ms: u64) -> bool {
    for _ in 0..attempts {
        if client
            .get(format!("{}/api/tags", OLLAMA_HOST))
            .send()
            .await
            .is_ok()
        {
            return true;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
    }
    false
}

async fn ensure_ollama_running(client: &reqwest::Client) -> Result<(), String> {
    if client
        .get(format!("{}/api/tags", OLLAMA_HOST))
        .send()
        .await
        .is_ok()
    {
        return Ok(());
    }

    let (local_bin, models_dir, config_dir) = local_ollama_paths();
    if !local_bin.exists() {
        return Err("Binaire Ollama introuvable. Veuillez le télécharger en premier.".to_string());
    }

    let _ = std::fs::create_dir_all(&models_dir);
    let _ = std::fs::create_dir_all(&config_dir);

    let mut child = std::process::Command::new(&local_bin);
    child.arg("serve");
    child.env("OLLAMA_MODELS", &models_dir);
    child.env("OLLAMA_HOST", "127.0.0.1:11435");
    if cfg!(windows) {
        child.env("USERPROFILE", &config_dir);
    } else {
        child.env("HOME", &config_dir);
    }
    child
        .spawn()
        .map_err(|e| format!("Impossible de démarrer le binaire Ollama local: {e}"))?;

    if wait_server_ready(client, 12, 500).await {
        Ok(())
    } else {
        Err("Ollama n'a pas démarré à temps sur le port 11435.".to_string())
    }
}

#[tauri::command]
pub async fn check_ollama_status() -> Result<OllamaStatus, String> {
    let (local_bin, _, _) = local_ollama_paths();
    
    let binary_exists = local_bin.exists();
    
    let client = reqwest::Client::new();
    
    let (server_running, models) = match client.get(format!("{}/api/tags", OLLAMA_HOST)).send().await {
        Ok(res) => {
            if let Ok(parsed) = res.json::<OllamaTagsResponse>().await {
                let mut names = Vec::new();
                for m in parsed.models {
                    names.push(m.name);
                }
                (true, names)
            } else {
                (true, Vec::new())
            }
        }
        Err(_) => (false, Vec::new()),
    };
    
    Ok(OllamaStatus {
        binary_exists,
        server_running,
        models,
    })
}

#[tauri::command]
pub async fn download_ollama_binary(app_handle: tauri::AppHandle) -> Result<(), String> {
    let url = "https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip";
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600)) // 10 minutes timeout
        .build()
        .map_err(|e| e.to_string())?;
        
    let mut response = client.get(url)
        .send()
        .await
        .map_err(|e| format!("Impossible de lancer le téléchargement: {}", e))?;
        
    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    
    let exe_path = std::env::current_exe().unwrap_or_default();
    let base_dir = exe_path.parent().unwrap_or(&std::path::PathBuf::new()).to_path_buf();
    let bin_dir = base_dir.join("bin");
    fs::create_dir_all(&bin_dir).map_err(|e| format!("Impossible de créer le dossier bin: {}", e))?;
    
    let zip_path = bin_dir.join("ollama.zip");
    let mut file = File::create(&zip_path).map_err(|e| format!("Impossible de créer l'archive zip temporaire: {}", e))?;
    
    while let Some(chunk) = response.chunk().await.map_err(|e| format!("Erreur lors de la lecture du flux: {}", e))? {
        file.write_all(&chunk).map_err(|e| format!("Erreur lors de l'écriture sur le disque: {}", e))?;
        downloaded += chunk.len() as u64;
        if total_size > 0 {
            let progress = (downloaded as f64 / total_size as f64 * 100.0) as u32;
            let _ = app_handle.emit("ollama-download-progress", progress);
        }
    }
    
    drop(file);
    
    // Special code 101 to indicate Extraction
    let _ = app_handle.emit("ollama-download-progress", 101);
    
    // Extract zip
    let zip_file = File::open(&zip_path).map_err(|e| format!("Impossible d'ouvrir l'archive zip téléchargée: {}", e))?;
    extract_zip(zip_file, &bin_dir)?;
    
    // Clean up
    let _ = fs::remove_file(&zip_path);
    
    // Special code 102 to indicate Success
    let _ = app_handle.emit("ollama-download-progress", 102);
    
    Ok(())
}

fn extract_zip(reader: impl io::Read + io::Seek, target_dir: &Path) -> Result<(), String> {
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("Erreur archive zip: {}", e))?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("Erreur index zip: {}", e))?;
        let outpath = match file.enclosed_name() {
            Some(path) => target_dir.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| format!("Erreur création dossier: {}", e))?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| format!("Erreur création dossier parent: {}", e))?;
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| format!("Erreur création fichier: {}", e))?;
            io::copy(&mut file, &mut outfile).map_err(|e| format!("Erreur copie contenu: {}", e))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn pull_ollama_model(app_handle: tauri::AppHandle, model_name: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    ensure_ollama_running(&client).await?;

    let url = format!("{}/api/pull", OLLAMA_HOST);
    let payload = serde_json::json!({
        "name": model_name,
        "stream": true
    });

    let mut res = client.post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Impossible de lancer le téléchargement du modèle: {}", e))?;

    let mut buffer = Vec::new();
    while let Some(chunk) = res.chunk().await.map_err(|e| format!("Erreur de téléchargement: {}", e))? {
        buffer.extend_from_slice(&chunk);
        
        while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
            let line_bytes = buffer[..pos].to_vec();
            buffer = buffer[pos + 1..].to_vec();
            
            if let Ok(line_str) = String::from_utf8(line_bytes) {
                let trimmed = line_str.trim();
                if !trimmed.is_empty() {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
                        let is_success = val.get("status").and_then(|s| s.as_str()) == Some("success");
                        let _ = app_handle.emit("ollama-pull-progress", &val);
                        if is_success {
                            return Ok(());
                        }
                    }
                }
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
pub async fn ask_ollama(_app_handle: tauri::AppHandle, prompt: String, model: String, system_prompt: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    ensure_ollama_running(&client).await?;

    // Trouver le meilleur modèle disponible si le modèle demandé n'existe pas
    let mut target_model = model;
    if let Ok(tags_res) = client.get(format!("{}/api/tags", OLLAMA_HOST)).send().await {
        if let Ok(parsed_tags) = tags_res.json::<OllamaTagsResponse>().await {
            let model_exists = parsed_tags.models.iter().any(|m| m.name == target_model || m.name.starts_with(&target_model));
            if !model_exists && !parsed_tags.models.is_empty() {
                target_model = parsed_tags.models[0].name.clone();
            }
        }
    }

    let req = OllamaRequest {
        model: target_model,
        prompt,
        system: system_prompt,
        stream: false,
    };

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/generate", OLLAMA_HOST))
        .json(&req)
        .send()
        .await
        .map_err(|e| format!("Erreur de connexion à Ollama : {}", e))?;

    let status = res.status();
    let body_text = res.text().await.map_err(|e| format!("Impossible de lire la réponse : {}", e))?;

    if let Ok(parsed) = serde_json::from_str::<OllamaResponse>(&body_text) {
        if let Some(err) = parsed.error {
            return Err(format!("Ollama a refusé : {}", err));
        }
        if let Some(resp) = parsed.response {
            return Ok(resp);
        }
    }

    Err(format!("Erreur {}. Réponse brute : {}", status, body_text))
}

#[tauri::command]
pub async fn get_ollama_models() -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    ensure_ollama_running(&client).await?;

    let res = client
        .get(format!("{}/api/tags", OLLAMA_HOST))
        .send()
        .await
        .map_err(|e| format!("Impossible de joindre Ollama : {}", e))?;

    let parsed: OllamaTagsResponse = res
        .json()
        .await
        .map_err(|e| format!("Erreur lors de la lecture des modèles : {}", e))?;

    let mut names = Vec::new();
    for m in parsed.models {
        names.push(m.name);
    }
    
    Ok(names)
}
