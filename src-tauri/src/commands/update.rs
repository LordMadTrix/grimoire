use serde::{Deserialize, Serialize};

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");
const UPDATE_URL: &str =
    "https://raw.githubusercontent.com/LordMadTrix/grimoire/main/update.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateManifest {
    pub version: String,
    pub changelog: String,
    pub download_url: String,
    pub release_date: String,
}

/// Compare semver strings — returns true if `remote` > `current`.
fn is_newer(remote: &str, current: &str) -> bool {
    let parse = |s: &str| -> (u32, u32, u32) {
        let s = s.trim_start_matches('v');
        let mut p = s.split('.');
        let maj = p.next().and_then(|x| x.parse().ok()).unwrap_or(0);
        let min = p.next().and_then(|x| x.parse().ok()).unwrap_or(0);
        let pat = p.next().and_then(|x| x.parse().ok()).unwrap_or(0);
        (maj, min, pat)
    };
    parse(remote) > parse(current)
}

#[tauri::command]
pub async fn check_for_updates() -> Result<Option<UpdateManifest>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Grimoire-Updater/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let manifest: UpdateManifest = client
        .get(UPDATE_URL)
        .header("Cache-Control", "no-cache")
        .send()
        .await
        .map_err(|e| format!("Réseau: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Parsing: {}", e))?;

    if is_newer(&manifest.version, CURRENT_VERSION) {
        Ok(Some(manifest))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn get_current_version() -> String {
    CURRENT_VERSION.to_string()
}
