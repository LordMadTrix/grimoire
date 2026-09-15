use crate::sync::{
    SyncEvent, SyncEventType, SyncSource, SyncStatus, SyncConfig, FileHasher, SyncQueue,
    ConflictResolver, WebSocketBridge,
};
use notify::{Watcher, RecursiveMode, Result as NotifyResult};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use chrono::Utc;
use uuid::Uuid;

pub struct SyncHandler {
    config: SyncConfig,
    status: Arc<Mutex<SyncStatus>>,
    queue: Arc<SyncQueue>,
    ws_bridge: Arc<WebSocketBridge>,
    watcher: Option<Box<dyn Watcher>>,
}

impl SyncHandler {
    pub fn new(config: SyncConfig, ws_bridge: Arc<WebSocketBridge>) -> Self {
        Self {
            config,
            status: Arc::new(Mutex::new(SyncStatus {
                is_syncing: false,
                last_sync: None,
                pending_events: 0,
                conflicts: 0,
                total_synced: 0,
            })),
            queue: Arc::new(SyncQueue::new(1000)),
            ws_bridge,
            watcher: None,
        }
    }

    /// Start watching directories for changes
    pub fn start_watching(&mut self) -> NotifyResult<()> {
        use notify::watcher;

        let config = self.config.clone();
        let queue = Arc::clone(&self.queue);
        let status = Arc::clone(&self.status);
        let ws = Arc::clone(&self.ws_bridge);

        let (tx, rx) = std::sync::mpsc::channel();

        let mut watcher = watcher(tx, std::time::Duration::from_secs(2))?;
        watcher.watch(&config.watch_dir, RecursiveMode::Recursive)?;

        // Spawn thread to handle file events
        thread::spawn(move || {
            while let Ok(event) = rx.recv() {
                match event {
                    notify::DebouncedFileSystemEvent::Create(path) => {
                        if let Ok(sync_event) = Self::create_sync_event(
                            path,
                            SyncEventType::Created,
                            SyncSource::PC,
                            &config,
                        ) {
                            let _ = queue.push(sync_event.clone(), 3);
                            let _ = ws.send_event(&sync_event);
                            
                            if let Ok(mut s) = status.lock() {
                                s.pending_events += 1;
                            }
                        }
                    }
                    notify::DebouncedFileSystemEvent::Write(path) => {
                        if let Ok(sync_event) = Self::create_sync_event(
                            path,
                            SyncEventType::Modified,
                            SyncSource::PC,
                            &config,
                        ) {
                            let _ = queue.push(sync_event.clone(), 3);
                            let _ = ws.send_event(&sync_event);

                            if let Ok(mut s) = status.lock() {
                                s.pending_events += 1;
                            }
                        }
                    }
                    notify::DebouncedFileSystemEvent::Remove(path) => {
                        if let Ok(sync_event) = Self::create_sync_event(
                            path,
                            SyncEventType::Deleted,
                            SyncSource::PC,
                            &config,
                        ) {
                            let _ = queue.push(sync_event.clone(), 3);
                            let _ = ws.send_event(&sync_event);

                            if let Ok(mut s) = status.lock() {
                                s.pending_events += 1;
                            }
                        }
                    }
                    notify::DebouncedFileSystemEvent::Rename(old, new) => {
                        if let Ok(sync_event) = Self::create_sync_event(
                            new,
                            SyncEventType::Renamed {
                                old_path: old,
                            },
                            SyncSource::PC,
                            &config,
                        ) {
                            let _ = queue.push(sync_event.clone(), 3);
                            let _ = ws.send_event(&sync_event);

                            if let Ok(mut s) = status.lock() {
                                s.pending_events += 1;
                            }
                        }
                    }
                    _ => {}
                }
            }
        });

        self.watcher = Some(Box::new(watcher));
        Ok(())
    }

    /// Create a SyncEvent from a file change
    fn create_sync_event(
        path: PathBuf,
        event_type: SyncEventType,
        source: SyncSource,
        config: &SyncConfig,
    ) -> std::io::Result<SyncEvent> {
        let file_hash = FileHasher::hash_file(&path, &config.hash_algorithm)?;
        let file_size = FileHasher::get_file_size(&path)?;

        Ok(SyncEvent {
            id: Uuid::new_v4().to_string(),
            file_path: path,
            event_type,
            source,
            timestamp: Utc::now(),
            file_hash,
            file_size,
        })
    }

    /// Process sync queue
    pub fn process_queue(&self) -> std::io::Result<()> {
        while let Some(mut queued) = self.queue.pop() {
            match self.sync_file(&queued.event) {
                Ok(_) => {
                    let _ = self.queue.mark_success(&queued.event.id);
                    if let Ok(mut status) = self.status.lock() {
                        status.pending_events = status.pending_events.saturating_sub(1);
                        status.total_synced += queued.event.file_size;
                    }
                }
                Err(e) => {
                    match self.queue.mark_failed(&queued.event.id) {
                        Ok(true) => {
                            // Retry later
                            eprintln!("Retrying sync for {}: {}", queued.event.id, e);
                        }
                        Ok(false) => {
                            // Max retries reached
                            eprintln!("Max retries reached for {}: {}", queued.event.id, e);
                            if let Ok(mut status) = self.status.lock() {
                                status.conflicts += 1;
                            }
                        }
                        Err(e) => eprintln!("Error marking failed: {}", e),
                    }
                }
            }
        }

        if let Ok(mut status) = self.status.lock() {
            status.last_sync = Some(Utc::now());
        }

        Ok(())
    }

    /// Sync a single file to mobile
    fn sync_file(&self, event: &SyncEvent) -> std::io::Result<()> {
        match event.source {
            SyncSource::PC => self.sync_to_mobile(event),
            SyncSource::Mobile => self.sync_to_pc(event),
        }
    }

    /// Sync file from PC to Mobile
    fn sync_to_mobile(&self, event: &SyncEvent) -> std::io::Result<()> {
        let relative_path = event
            .file_path
            .strip_prefix(&self.config.watch_dir)
            .unwrap_or(&event.file_path);
        let mobile_path = self.config.mobile_sync_dir.join(relative_path);

        // Create parent directories
        if let Some(parent) = mobile_path.parent() {
            fs::create_dir_all(parent)?;
        }

        match &event.event_type {
            SyncEventType::Created | SyncEventType::Modified => {
                fs::copy(&event.file_path, &mobile_path)?;
            }
            SyncEventType::Deleted => {
                if mobile_path.exists() {
                    fs::remove_file(&mobile_path)?;
                }
            }
            SyncEventType::Renamed { old_path } => {
                let old_mobile = self.config.mobile_sync_dir.join(
                    old_path
                        .strip_prefix(&self.config.watch_dir)
                        .unwrap_or(old_path),
                );
                if old_mobile.exists() {
                    fs::rename(&old_mobile, &mobile_path)?;
                }
            }
        }

        Ok(())
    }

    /// Sync file from Mobile to PC
    fn sync_to_pc(&self, event: &SyncEvent) -> std::io::Result<()> {
        let relative_path = event
            .file_path
            .strip_prefix(&self.config.mobile_sync_dir)
            .unwrap_or(&event.file_path);
        let pc_path = self.config.watch_dir.join(relative_path);

        // Create parent directories
        if let Some(parent) = pc_path.parent() {
            fs::create_dir_all(parent)?;
        }

        match &event.event_type {
            SyncEventType::Created | SyncEventType::Modified => {
                fs::copy(&event.file_path, &pc_path)?;
            }
            SyncEventType::Deleted => {
                if pc_path.exists() {
                    fs::remove_file(&pc_path)?;
                }
            }
            SyncEventType::Renamed { old_path } => {
                let old_pc = self.config.watch_dir.join(
                    old_path
                        .strip_prefix(&self.config.mobile_sync_dir)
                        .unwrap_or(old_path),
                );
                if old_pc.exists() {
                    fs::rename(&old_pc, &pc_path)?;
                }
            }
        }

        Ok(())
    }

    /// Get current sync status
    pub fn get_status(&self) -> SyncStatus {
        self.status.lock().unwrap().clone()
    }

    /// Handle mobile sync event
    pub fn handle_mobile_event(&self, event: SyncEvent) -> std::io::Result<()> {
        let mut event = event;
        event.source = SyncSource::Mobile;
        self.queue.push(event.clone(), 3).ok();
        self.sync_file(&event)
    }
}

impl Clone for SyncConfig {
    fn clone(&self) -> Self {
        Self {
            watch_dir: self.watch_dir.clone(),
            mobile_sync_dir: self.mobile_sync_dir.clone(),
            conflict_resolution: self.conflict_resolution.clone(),
            hash_algorithm: self.hash_algorithm.clone(),
            auto_sync_enabled: self.auto_sync_enabled,
            sync_interval_ms: self.sync_interval_ms,
        }
    }
}
