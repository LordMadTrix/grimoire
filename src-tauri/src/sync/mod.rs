// Bidirectional sync module for PC ↔ Mobile synchronization
pub mod handler;
pub mod hasher;
pub mod queue;
pub mod conflict;
pub mod websocket_bridge;

pub use handler::SyncHandler;
pub use hasher::FileHasher;
pub use queue::SyncQueue;
pub use conflict::ConflictResolver;
pub use websocket_bridge::WebSocketBridge;

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncEvent {
    pub id: String,
    pub file_path: PathBuf,
    pub event_type: SyncEventType,
    pub source: SyncSource,
    pub timestamp: DateTime<Utc>,
    pub file_hash: String,
    pub file_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncEventType {
    Created,
    Modified,
    Deleted,
    Renamed { old_path: PathBuf },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncSource {
    PC,
    Mobile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub is_syncing: bool,
    pub last_sync: Option<DateTime<Utc>>,
    pub pending_events: usize,
    pub conflicts: usize,
    pub total_synced: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub watch_dir: PathBuf,
    pub mobile_sync_dir: PathBuf,
    pub conflict_resolution: ConflictMode,
    pub hash_algorithm: HashAlgorithm,
    pub auto_sync_enabled: bool,
    pub sync_interval_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConflictMode {
    LatestWins,
    PCWins,
    MobileWins,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HashAlgorithm {
    MD5,
    SHA256,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            watch_dir: PathBuf::from("./data"),
            mobile_sync_dir: PathBuf::from("./mobile_sync"),
            conflict_resolution: ConflictMode::LatestWins,
            hash_algorithm: HashAlgorithm::SHA256,
            auto_sync_enabled: true,
            sync_interval_ms: 5000,
        }
    }
}