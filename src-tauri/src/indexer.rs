use rusqlite::{Connection, params};
use regex::Regex;
use std::path::Path;
use std::sync::LazyLock;
use walkdir::WalkDir;

static LINK_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]").unwrap()
});

static FRONTMATTER_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?s)^---\n(.*?)\n---").unwrap()
});

/// Initialise la base SQLite avec les tables FTS5 et liens
pub fn init_db(db: &Connection) -> Result<(), rusqlite::Error> {
    db.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS entities USING fts5(
            path, title, entity_type, tags, content,
            tokenize='unicode61 remove_diacritics 2'
        );

        CREATE TABLE IF NOT EXISTS links (
            source_path TEXT NOT NULL,
            target_path TEXT NOT NULL,
            context TEXT DEFAULT '',
            PRIMARY KEY (source_path, target_path)
        );

        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        );"
    )?;
    // Migrate: add label/rel_type columns if they don't exist yet
    let _ = db.execute("ALTER TABLE links ADD COLUMN label TEXT DEFAULT ''", []);
    let _ = db.execute("ALTER TABLE links ADD COLUMN rel_type TEXT DEFAULT ''", []);
    Ok(())
}

/// Ré-indexe tout le vault depuis le système de fichiers
pub fn reindex_vault(vault_path: &Path, db: &Connection) -> Result<usize, Box<dyn std::error::Error>> {
    // Nettoyer les anciennes données
    db.execute("DELETE FROM entities", [])?;
    db.execute("DELETE FROM links", [])?;

    let mut count: usize = 0;

    for entry in WalkDir::new(vault_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension().is_some_and(|ext| ext == "md")
        })
        // Skip hidden directories
        .filter(|e| {
            !e.path()
                .components()
                .any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
        })
    {
        let content = std::fs::read_to_string(entry.path())?;
        let rel_path = entry.path()
            .strip_prefix(vault_path)?
            .to_string_lossy()
            .to_string();

        // Extraire le frontmatter YAML
        let (title, entity_type, tags, body) = parse_frontmatter(&content, &rel_path);

        // Indexer dans FTS5
        db.execute(
            "INSERT INTO entities (path, title, entity_type, tags, content) VALUES (?1,?2,?3,?4,?5)",
            params![rel_path, title, entity_type, tags, body],
        )?;

        // Extraire les liens [[...]]
        for cap in LINK_REGEX.captures_iter(&content) {
            if let Some(target) = cap.get(1) {
                let target_str = target.as_str().trim();
                let context = extract_context(&content, cap.get(0).unwrap().start());

                db.execute(
                    "INSERT OR IGNORE INTO links (source_path, target_path, context, label, rel_type) VALUES (?1,?2,?3,'','')",
                    params![rel_path, target_str, context],
                )?;
            }
        }

        // Extraire les relations nommées du frontmatter (relations: [{target, label, type}])
        if let Some(caps) = FRONTMATTER_REGEX.captures(&content) {
            let yaml_str = caps.get(1).unwrap().as_str();
            if let Ok(yaml) = serde_yaml::from_str::<serde_yaml::Value>(yaml_str) {
                if let Some(relations) = yaml.get("relations").and_then(|v| v.as_sequence()) {
                    for rel in relations {
                        let target = rel.get("target").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                        let label = rel.get("label").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                        let rel_type = rel.get("type").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                        if !target.is_empty() {
                            let _ = db.execute(
                                "INSERT OR REPLACE INTO links (source_path, target_path, context, label, rel_type) VALUES (?1,?2,'',?3,?4)",
                                params![rel_path, target, label, rel_type],
                            );
                        }
                    }
                }
            }
        }

        count += 1;
    }

    // Stocker la date d'indexation
    db.execute(
        "INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_index', datetime('now'))",
        [],
    )?;

    log::info!("Indexed {} markdown files from vault", count);
    Ok(count)
}

/// Sanitise une requête utilisateur pour FTS5 — évite les crashes sur caractères spéciaux
fn sanitize_fts_query(raw: &str) -> String {
    raw.split_whitespace()
        .filter(|w| !w.is_empty())
        .map(|w| {
            let clean: String = w.chars().filter(|c| *c != '"').collect();
            format!("\"{}\"*", clean)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Recherche full-text dans l'index
pub fn search(db: &Connection, query: &str, limit: usize) -> Result<Vec<SearchResult>, rusqlite::Error> {
    let safe_query = sanitize_fts_query(query);
    if safe_query.is_empty() {
        return Ok(vec![]);
    }

    let mut stmt = db.prepare(
        "SELECT path, title, entity_type, tags,
                snippet(entities, 4, '<mark>', '</mark>', '…', 32) as snippet,
                rank
         FROM entities
         WHERE entities MATCH ?1
         ORDER BY rank
         LIMIT ?2"
    )?;

    let results = stmt.query_map(params![safe_query, limit as i64], |row| {
        Ok(SearchResult {
            path: row.get(0)?,
            title: row.get(1)?,
            entity_type: row.get(2)?,
            tags: row.get(3)?,
            snippet: row.get(4)?,
            rank: row.get(5)?,
        })
    })?
    .filter_map(|r| r.ok())
    .collect();

    Ok(results)
}

/// Récupère les backlinks (liens entrants) pour un fichier
pub fn get_backlinks(db: &Connection, target_path: &str) -> Result<Vec<BacklinkResult>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT l.source_path, e.title, l.context
         FROM links l
         LEFT JOIN entities e ON e.path = l.source_path
         WHERE l.target_path LIKE ?1 OR l.target_path LIKE ?2"
    )?;

    // Chercher avec et sans extension .md
    let target_no_ext = target_path.trim_end_matches(".md");
    let results = stmt.query_map(
        params![
            format!("%{}", target_path),
            format!("%{}", target_no_ext)
        ],
        |row| {
            Ok(BacklinkResult {
                source_path: row.get(0)?,
                source_title: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                context: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            })
        }
    )?
    .filter_map(|r| r.ok())
    .collect();

    Ok(results)
}

/// Récupère toutes les données du graphe (nœuds et liens)
pub fn get_graph_data(db: &Connection) -> Result<GraphData, rusqlite::Error> {
    // Récupérer les nœuds
    let mut stmt = db.prepare("SELECT path, title, entity_type FROM entities")?;
    let nodes = stmt.query_map([], |row| {
        Ok(GraphNode {
            id: row.get(0)?,
            title: row.get(1)?,
            group: row.get(2)?,
        })
    })?
    .filter_map(|r| r.ok())
    .collect();

    // Récupérer les liens avec labels
    let mut stmt = db.prepare(
        "SELECT source_path, target_path, COALESCE(label,'') as label, COALESCE(rel_type,'') as rel_type FROM links"
    )?;
    let links = stmt.query_map([], |row| {
        Ok(GraphLink {
            source: row.get(0)?,
            target: row.get(1)?,
            label: row.get(2)?,
            rel_type: row.get(3)?,
        })
    })?
    .filter_map(|r| r.ok())
    .collect();

    Ok(GraphData { nodes, links })
}

// ── Types ────────────────────────────────────────────────────────

#[derive(serde::Serialize, Clone, Debug)]
pub struct SearchResult {
    pub path: String,
    pub title: String,
    pub entity_type: String,
    pub tags: String,
    pub snippet: String,
    pub rank: f64,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct BacklinkResult {
    pub source_path: String,
    pub source_title: String,
    pub context: String,
}

#[derive(serde::Serialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<GraphLink>,
}

#[derive(serde::Serialize)]
pub struct GraphNode {
    pub id: String,
    pub title: String,
    pub group: String,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct GraphLink {
    pub source: String,
    pub target: String,
    pub label: String,
    pub rel_type: String,
}

// ── Helpers ──────────────────────────────────────────────────────

fn parse_frontmatter(content: &str, fallback_title: &str) -> (String, String, String, String) {
    if let Some(caps) = FRONTMATTER_REGEX.captures(content) {
        let yaml_str = caps.get(1).unwrap().as_str();
        let body = &content[caps.get(0).unwrap().end()..];

        // Parse YAML basique sans dépendance lourde
        let mut title = String::new();
        let mut entity_type = String::from("note");
        let mut tags = String::new();

        for line in yaml_str.lines() {
            let line = line.trim();
            if let Some(val) = line.strip_prefix("name:").or(line.strip_prefix("title:")) {
                title = val.trim().trim_matches('"').trim_matches('\'').to_string();
            } else if let Some(val) = line.strip_prefix("type:") {
                entity_type = val.trim().trim_matches('"').trim_matches('\'').to_string();
            } else if let Some(val) = line.strip_prefix("tags:") {
                tags = val.trim().to_string();
            }
        }

        if title.is_empty() {
            title = Path::new(fallback_title)
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
        }

        (title, entity_type, tags, body.to_string())
    } else {
        let title = Path::new(fallback_title)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        (title, "note".to_string(), String::new(), content.to_string())
    }
}

fn extract_context(content: &str, pos: usize) -> String {
    let start = content[..pos].rfind('\n').map(|i| i + 1).unwrap_or(0);
    let end = content[pos..].find('\n').map(|i| pos + i).unwrap_or(content.len());
    content[start..end].trim().chars().take(120).collect()
}
