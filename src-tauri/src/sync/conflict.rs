use crate::sync::{SyncEvent, SyncEventType, SyncSource, ConflictMode};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileConflict {
    pub id: String,
    pub file_path: PathBuf,
    pub pc_version: Option<VersionInfo>,
    pub mobile_version: Option<VersionInfo>,
    pub detected_at: DateTime<Utc>,
    pub resolution_strategy: ConflictMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub hash: String,
    pub size: u64,
    pub modified: DateTime<Utc>,
    pub source: SyncSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictResolution {
    pub conflict_id: String,
    pub winning_version: SyncSource,
    pub reason: String,
    pub backup_created: bool,
    pub backup_path: Option<PathBuf>,
}

pub struct ConflictResolver;

impl ConflictResolver {
    /// Detect conflict between two versions
    pub fn detect_conflict(
        pc_event: Option<&SyncEvent>,
        mobile_event: Option<&SyncEvent>,
    ) -> Option<FileConflict> {
        match (pc_event, mobile_event) {
            (Some(pc), Some(mobile)) => {
                if pc.file_path == mobile.file_path && pc.file_hash != mobile.file_hash {
                    Some(FileConflict {
                        id: format!("conflict-{}", uuid::Uuid::new_v4()),
                        file_path: pc.file_path.clone(),
                        pc_version: Some(VersionInfo {
                            hash: pc.file_hash.clone(),
                            size: pc.file_size,
                            modified: pc.timestamp,
                            source: SyncSource::PC,
                        }),
                        mobile_version: Some(VersionInfo {
                            hash: mobile.file_hash.clone(),
                            size: mobile.file_size,
                            modified: mobile.timestamp,
                            source: SyncSource::Mobile,
                        }),
                        detected_at: Utc::now(),
                        resolution_strategy: ConflictMode::LatestWins,
                    })
                } else {
                    None
                }
            }
            _ => None,
        }
    }

    /// Resolve conflict based on strategy
    pub fn resolve(
        conflict: &FileConflict,
        mode: &ConflictMode,
    ) -> ConflictResolution {
        let (winning_version, reason) = match mode {
            ConflictMode::LatestWins => {
                let pc_time = conflict.pc_version.as_ref().map(|v| v.modified);
                let mobile_time = conflict.mobile_version.as_ref().map(|v| v.modified);

                match (pc_time, mobile_time) {
                    (Some(pc), Some(mobile)) => {
                        if pc > mobile {
                            (SyncSource::PC, format!("PC version is newer: {} > {}", pc, mobile))
                        } else {
                            (SyncSource::Mobile, format!("Mobile version is newer: {} > {}", mobile, pc))
                        }
                    }
                    (Some(_), None) => (SyncSource::PC, "Only PC version available".to_string()),
                    (None, Some(_)) => (SyncSource::Mobile, "Only Mobile version available".to_string()),
                    (None, None) => (SyncSource::PC, "Unable to determine versions, defaulting to PC".to_string()),
                }
            }
            ConflictMode::PCWins => (SyncSource::PC, "PC version wins by policy".to_string()),
            ConflictMode::MobileWins => (SyncSource::Mobile, "Mobile version wins by policy".to_string()),
            ConflictMode::Manual => (SyncSource::PC, "Manual resolution required".to_string()),
        };

        ConflictResolution {
            conflict_id: conflict.id.clone(),
            winning_version,
            reason,
            backup_created: false,
            backup_path: None,
        }
    }
}