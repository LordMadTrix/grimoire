# 📱 API Synchronisation Bidirectionnelle - Référence Complète

## Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Structures de Données](#structures-de-données)
3. [Modules](#modules)
4. [Exemples d'Utilisation](#exemples-dutilisation)
5. [Gestion des Erreurs](#gestion-des-erreurs)
6. [Patterns Courants](#patterns-courants)

---

## Vue d'ensemble

La synchronisation bidirectionnelle dans Grimoire utilise une architecture modulaire avec:
- **Détection des changements** en temps réel
- **Vérification d'intégrité** des fichiers
- **Gestion intelligente des conflits**
- **Queue fiable** avec retry automatique
- **Communication WebSocket** pour le temps réel

---

## Structures de Données

### SyncEvent

```rust
pub struct SyncEvent {
    pub id: String,                    // UUID unique pour tracking
    pub file_path: PathBuf,            // Chemin complet du fichier
    pub event_type: SyncEventType,     // Type d'événement
    pub source: SyncSource,            // Origine (PC ou Mobile)
    pub timestamp: DateTime<Utc>,      // Quand l'événement s'est produit
    pub file_hash: String,             // Hash SHA256/MD5 du fichier
    pub file_size: u64,                // Taille en bytes
}
```

**Exemple:**
```rust
let event = SyncEvent {
    id: "sync-123".to_string(),
    file_path: PathBuf::from("/data/maps/world.json"),
    event_type: SyncEventType::Modified,
    source: SyncSource::PC,
    timestamp: Utc::now(),
    file_hash: "7a3c8d9e...".to_string(),
    file_size: 524288,
};
```

### SyncStatus

État actuel de la synchronisation:

```rust
pub struct SyncStatus {
    pub is_syncing: bool,           // En cours de sync
    pub last_sync: Option<DateTime<Utc>>,
    pub pending_events: usize,      // Événements en attente
    pub conflicts: usize,           // Conflits détectés
    pub total_synced: u64,          // Bytes synchronisés au total
}
```

### SyncConfig

Configuration personnalisée:

```rust
pub struct SyncConfig {
    pub watch_dir: PathBuf,                    // Dossier à surveiller
    pub mobile_sync_dir: PathBuf,              // Destination mobile
    pub conflict_resolution: ConflictMode,     // Stratégie
    pub hash_algorithm: HashAlgorithm,         // SHA256 ou MD5
    pub auto_sync_enabled: bool,               // Auto-sync activé?
    pub sync_interval_ms: u64,                 // Intervalle de traitement
}
```

**Configuration par défaut:**
```rust
SyncConfig {
    watch_dir: PathBuf::from("./data"),
    mobile_sync_dir: PathBuf::from("./mobile_sync"),
    conflict_resolution: ConflictMode::LatestWins,
    hash_algorithm: HashAlgorithm::SHA256,
    auto_sync_enabled: true,
    sync_interval_ms: 5000,
}
```

### FileConflict

Représente un conflit détecté:

```rust
pub struct FileConflict {
    pub id: String,                        // ID unique du conflit
    pub file_path: PathBuf,                // Fichier en conflit
    pub pc_version: Option<VersionInfo>,   // Informations version PC
    pub mobile_version: Option<VersionInfo>, // Informations version mobile
    pub detected_at: DateTime<Utc>,        // Quand détecté
    pub resolution_strategy: ConflictMode, // Stratégie à appliquer
}
```

### VersionInfo

Métadonnées d'une version de fichier:

```rust
pub struct VersionInfo {
    pub hash: String,              // Hash du fichier
    pub size: u64,                 // Taille en bytes
    pub modified: DateTime<Utc>,   // Dernier accès
    pub source: SyncSource,        // Origine (PC ou Mobile)
}
```

---

## Modules

### 1. FileHasher - Vérification d'Intégrité

#### Hachage de fichier

```rust
use grimoire::sync::FileHasher;
use std::path::Path;

// SHA256 (recommandé)
let hash = FileHasher::hash_file_sha256("./data/map.json")?;

// MD5 (legacy)
let hash = FileHasher::hash_file_md5("./data/map.json")?;

// Auto-détect basé sur config
let hash = FileHasher::hash_file("./data/map.json", &algorithm)?;
```

#### Vérification d'intégrité

```rust
// Vérifier qu'un fichier n'a pas été corrompu
let expected_hash = "abc123def456...";
let is_valid = FileHasher::verify_file(
    "./data/map.json",
    expected_hash,
    &HashAlgorithm::SHA256
)?;

if is_valid {
    println!("✓ Fichier intact");
} else {
    println!("✗ Fichier corrompu!");
}
```

#### Comparaison de fichiers

```rust
// Vérifier si deux fichiers sont identiques
let identical = FileHasher::files_are_identical(
    "./data/map_pc.json",
    "./data/map_mobile.json",
    &HashAlgorithm::SHA256
)?;
```

#### Métadonnées de fichier

```rust
// Obtenir hash et taille en une seule opération
let (hash, size) = FileHasher::compute_file_metadata(
    "./data/map.json",
    &HashAlgorithm::SHA256
)?;

println!("Hash: {}", hash);
println!("Size: {} bytes", size);
```

### 2. SyncQueue - File d'Attente Fiable

#### Ajouter des événements

```rust
use grimoire::sync::SyncQueue;

let queue = SyncQueue::new(1000); // Max 1000 événements

// Ajouter avec max 3 retries
queue.push(sync_event, 3)?;

// Gérer l'erreur si queue pleine
match queue.push(another_event, 3) {
    Ok(_) => println!("✓ Ajouté à la queue"),
    Err(e) => println!("✗ Queue pleine: {}", e),
}
```

#### Traiter les événements

```rust
// Récupérer le prochain événement
if let Some(queued) = queue.pop() {
    println!("Processing: {}", queued.event.id);
    
    match process_file(&queued.event) {
        Ok(_) => {
            queue.mark_success(&queued.event.id)?;
            println!("✓ Succès");
        }
        Err(e) => {
            // Retry automatique
            if let Ok(will_retry) = queue.mark_failed(&queued.event.id) {
                if will_retry {
                    println!("↻ Retry");
                } else {
                    println!("✗ Max retries atteint");
                }
            }
        }
    }
}
```

#### Statistiques et monitoring

```rust
// Obtenir les stats de queue
let stats = queue.get_stats();
println!("Total: {}", stats.total);
println!("Pending: {}", stats.pending);
println!("Processing: {}", stats.processing);
println!("Success: {}", stats.success);
println!("Failed: {}", stats.failed);
println!("Retry: {}", stats.retry);

// Taille de queue
println!("Queue length: {}", queue.len());
println!("Is empty: {}", queue.is_empty());
```

#### Filtrage par statut

```rust
// Obtenir tous les événements en retry
let retrying = queue.get_by_status(QueueStatus::Retry);
println!("Retrying: {} events", retrying.len());

// Retraiter un événement échoué
queue.requeue("failed-event-id")?;
```

### 3. ConflictResolver - Gestion des Conflits

#### Détecter les conflits

```rust
use grimoire::sync::ConflictResolver;

let pc_event = SyncEvent { /* version PC */ };
let mobile_event = SyncEvent { /* version mobile */ };

// Détecter conflit
if let Some(conflict) = ConflictResolver::detect_conflict(
    Some(&pc_event),
    Some(&mobile_event)
) {
    println!("⚠️ Conflit détecté: {:?}", conflict.file_path);
    println!("PC hash: {}", conflict.pc_version.unwrap().hash);
    println!("Mobile hash: {}", conflict.mobile_version.unwrap().hash);
}
```

#### Résoudre les conflits

```rust
// Résoudre avec stratégie LatestWins
let resolution = ConflictResolver::resolve(
    &conflict,
    &ConflictMode::LatestWins
);

match resolution.winning_version {
    SyncSource::PC => println!("PC version wins"),
    SyncSource::Mobile => println!("Mobile version wins"),
}

println!("Reason: {}", resolution.reason);
```

#### Obtenir des suggestions

```rust
// Obtenir des suggestions de résolution
let suggestions = ConflictResolver::get_merge_suggestions(&conflict);

for suggestion in suggestions {
    println!("⚡ {}: {}", suggestion.title, suggestion.description);
    println!("   Severity: {:?}", suggestion.severity);
}
```

#### Créer des sauvegardes

```rust
use std::path::PathBuf;

// Sauvegarder la version en conflit avant résolution
let backup_path = ConflictResolver::create_backup(
    &conflict.file_path,
    &conflict.pc_version.unwrap(),
    &PathBuf::from("./backups")
)?;

println!("✓ Backup créé: {}", backup_path.display());
```

### 4. SyncHandler - Orchestration Principale

#### Initialisation

```rust
use grimoire::sync::{SyncHandler, SyncConfig};
use std::sync::Arc;

let config = SyncConfig::default();
let ws = Arc::new(WebSocketBridge::new().0);
let mut handler = SyncHandler::new(config, ws);
```

#### Démarrer la surveillance

```rust
// Commencer à surveiller les changements de fichiers
match handler.start_watching() {
    Ok(_) => println!("✓ Monitoring started"),
    Err(e) => println!("✗ Error: {}", e),
}
```

#### Traiter la queue

```rust
// Traiter tous les événements en attente
match handler.process_queue() {
    Ok(_) => println!("✓ Queue processed"),
    Err(e) => println!("✗ Error: {}", e),
}
```

#### Gérer les événements mobiles

```rust
// Quand un événement arrive du mobile
let mobile_event = SyncEvent {
    id: "mobile-evt-1".to_string(),
    file_path: PathBuf::from("notes/spell_list.md"),
    event_type: SyncEventType::Modified,
    source: SyncSource::Mobile,
    timestamp: Utc::now(),
    file_hash: "hash123".to_string(),
    file_size: 4096,
};

// Synchroniser du mobile vers PC
handler.handle_mobile_event(mobile_event)?;
```

#### Obtenir le statut

```rust
let status = handler.get_status();
if status.is_syncing {
    println!("Syncing: {} pending events", status.pending_events);
}
println!("Conflicts: {}", status.conflicts);
println!("Last sync: {:?}", status.last_sync);
```

### 5. WebSocketBridge - Communication Temps Réel

#### Créer le bridge

```rust
use grimoire::sync::WebSocketBridge;

let (bridge, mut rx) = WebSocketBridge::new();

// Envoyer
bridge.send_event(&event)?;

// Recevoir dans un thread/tokio::spawn
while let Ok(msg) = rx.recv().await {
    println!("Received: {:?}", msg.message_type);
}
```

#### Envoyer des événements

```rust
// Envoyer un événement de sync
bridge.send_event(&sync_event)?;
```

#### Envoyer des requêtes

```rust
use grimoire::sync::*;

let request = SyncRequest {
    request_id: "req-sync-full".to_string(),
    request_type: RequestType::FullSync,
    data: serde_json::json!({}),
};

bridge.send_request(request)?;
```

#### Acknowledgments

```rust
// Confirmer la réception d'un événement
bridge.send_ack("event-id", true)?;  // Succès
bridge.send_ack("event-id", false)?; // Échec
```

#### Heartbeat

```rust
// Envoyer un heartbeat toutes les 5 secondes
loop {
    bridge.send_heartbeat()?;
    tokio::time::sleep(Duration::from_secs(5)).await;
}
```

---

## Exemples d'Utilisation

### Exemple 1: Sync PC → Mobile Simple

```rust
use grimoire::sync::*;
use std::path::PathBuf;
use std::sync::Arc;

fn main() -> std::io::Result<()> {
    // Configuration
    let config = SyncConfig {
        watch_dir: PathBuf::from("./my_data"),
        mobile_sync_dir: PathBuf::from("./mobile_backup"),
        ..Default::default()
    };

    // Créer handler
    let ws = Arc::new(WebSocketBridge::new().0);
    let mut handler = SyncHandler::new(config, ws);

    // Démarrer monitoring
    handler.start_watching()?;
    println!("✓ Monitoring started");

    // Traiter la queue périodiquement
    loop {
        handler.process_queue()?;
        
        let status = handler.get_status();
        println!("Pending: {}, Conflicts: {}", 
                 status.pending_events, 
                 status.conflicts);

        std::thread::sleep(std::time::Duration::from_secs(5));
    }
}
```

### Exemple 2: Gestion des Conflits

```rust
use grimoire::sync::*;

fn handle_sync_conflict() -> std::io::Result<()> {
    let queue = SyncQueue::new(1000);
    
    // Événements en conflit
    let pc_file = SyncEvent { /* ... */ };
    let mobile_file = SyncEvent { /* ... */ };

    // Détecter
    if let Some(conflict) = ConflictResolver::detect_conflict(
        Some(&pc_file),
        Some(&mobile_file)
    ) {
        println!("⚠️ Conflit détecté!");

        // Obtenir suggestions
        let suggestions = ConflictResolver::get_merge_suggestions(&conflict);
        for sug in suggestions {
            println!("  - {}: {}", sug.title, sug.description);
        }

        // Créer backup avant résolution
        let backup = ConflictResolver::create_backup(
            &conflict.file_path,
            conflict.pc_version.as_ref().unwrap(),
            &PathBuf::from("./backups")
        )?;
        println!("✓ Backup: {}", backup.display());

        // Résoudre
        let resolution = ConflictResolver::resolve(
            &conflict,
            &ConflictMode::LatestWins
        );
        
        println!("Winner: {:?}", resolution.winning_version);
        println!("Reason: {}", resolution.reason);
    }

    Ok(())
}
```

### Exemple 3: Monitoring avec WebSocket

```rust
use grimoire::sync::*;
use tokio::time::{interval, Duration};

#[tokio::main]
async fn monitor_sync() {
    let (bridge, mut rx) = WebSocketBridge::new();

    // Thread de réception
    tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            match msg.message_type {
                MessageType::SyncEvent => {
                    println!("📁 Événement sync reçu");
                }
                MessageType::Heartbeat => {
                    println!("💓 Heartbeat");
                }
                MessageType::Error => {
                    println!("❌ Erreur");
                }
                _ => {}
            }
        }
    });

    // Envoyer heartbeat
    let mut interval = interval(Duration::from_secs(5));
    loop {
        interval.tick().await;
        bridge.send_heartbeat().ok();
    }
}
```

---

## Gestion des Erreurs

### Types d'Erreurs

```rust
// IO Errors (fichier non trouvé, permissions, etc.)
handler.process_queue().map_err(|e| {
    println!("❌ IO Error: {}", e);
});

// Queue Errors
queue.push(event, 3).map_err(|e| {
    println!("❌ Queue Error: {}", e);
});

// WebSocket Errors
bridge.send_event(&event).map_err(|e| {
    println!("❌ WS Error: {}", e);
});
```

### Patterns de Retry

```rust
use std::thread;
use std::time::Duration;

fn sync_with_retry(
    handler: &SyncHandler,
    max_attempts: u32
) -> Result<(), Box<dyn std::error::Error>> {
    for attempt in 1..=max_attempts {
        match handler.process_queue() {
            Ok(_) => return Ok(()),
            Err(e) if attempt < max_attempts => {
                eprintln!("Attempt {} failed: {}, retrying...", attempt, e);
                thread::sleep(Duration::from_secs(2_u64.pow(attempt - 1)));
            }
            Err(e) => return Err(Box::new(e)),
        }
    }
    Ok(())
}
```

---

## Patterns Courants

### Pattern 1: Sync Périodique

```rust
use std::time::Duration;
use std::thread;

fn periodic_sync(handler: &mut SyncHandler) {
    loop {
        if let Err(e) = handler.process_queue() {
            eprintln!("Sync error: {}", e);
        }
        thread::sleep(Duration::from_secs(5));
    }
}
```

### Pattern 2: Verification Complète

```rust
fn verify_sync(
    pc_file: &PathBuf,
    mobile_file: &PathBuf
) -> std::io::Result<bool> {
    let hash_pc = FileHasher::hash_file_sha256(pc_file)?;
    let hash_mobile = FileHasher::hash_file_sha256(mobile_file)?;
    
    Ok(hash_pc == hash_mobile)
}
```

### Pattern 3: Batchement d'Événements

```rust
fn batch_process(queue: &SyncQueue, batch_size: usize) {
    let mut batch = Vec::new();
    
    for _ in 0..batch_size {
        if let Some(queued) = queue.pop() {
            batch.push(queued);
        }
    }
    
    // Traiter le batch...
}
```

---

**Document généré:** 2026-09-15  
**Version:** 1.0.0
