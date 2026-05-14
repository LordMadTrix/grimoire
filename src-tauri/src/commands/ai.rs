use serde::{Deserialize, Serialize};

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

#[tauri::command]
pub async fn ask_ollama(_app_handle: tauri::AppHandle, prompt: String, model: String, system_prompt: String) -> Result<String, String> {
    // Check if ollama is running, if not try to start it from local bin if exists
    let host = "http://localhost:11434";
    
    let client = reqwest::Client::new();
    
    // Check if running
    if let Err(_) = client.get(format!("{}/api/tags", host)).send().await {
        // Not running, try to start local binary
        let exe_path = std::env::current_exe().unwrap_or_default();
        let base_dir = exe_path.parent().unwrap_or(&std::path::PathBuf::new()).to_path_buf();
        let bin_name = if cfg!(windows) { "ollama.exe" } else { "ollama" };
        let local_bin = base_dir.join("bin").join(bin_name);
        
        if local_bin.exists() {
            println!("Starting local Ollama from {:?}", local_bin);
            
            // Configuration portable
            let models_dir = base_dir.join("models");
            let config_dir = base_dir.join("config");
            let _ = std::fs::create_dir_all(&models_dir);
            let _ = std::fs::create_dir_all(&config_dir);

            let mut child = std::process::Command::new(&local_bin);
            child.arg("serve");
            
            // Définir les variables d'environnement pour la portabilité
            child.env("OLLAMA_MODELS", &models_dir);
            if cfg!(windows) {
                child.env("USERPROFILE", &config_dir);
            } else {
                child.env("HOME", &config_dir);
            }

            let _ = child.spawn();
            
            // Attendre un peu que le serveur démarre
            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        }
    }

    let req = OllamaRequest {
        model,
        prompt,
        system: system_prompt,
        stream: false,
    };

    let client = reqwest::Client::new();
    let res = client
        .post("http://localhost:11434/api/generate")
        .json(&req)
        .send()
        .await
        .map_err(|e| format!("Erreur de connexion à Ollama : {}", e))?;

    // On lit le texte brut pour pouvoir gérer les erreurs proprement
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

    // Si on n'arrive pas à parser, c'est probablement une erreur HTTP
    Err(format!("Erreur {}. Réponse brute : {}", status, body_text))
}

#[derive(Deserialize, Debug)]
struct OllamaTagsResponse {
    models: Vec<OllamaModelItem>,
}

#[derive(Deserialize, Debug)]
struct OllamaModelItem {
    name: String,
}

#[tauri::command]
pub async fn get_ollama_models() -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("http://localhost:11434/api/tags")
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
