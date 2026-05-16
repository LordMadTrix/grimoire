use serde::{Deserialize, Serialize};
use serde_yaml::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

// ── Types exportés au frontend ────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StatDef {
    pub key: String,
    pub label: String,
    pub roll: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RaceDef {
    pub name: String,
    pub emoji: String,
    pub description: String,
    pub stats: HashMap<String, i32>,
    pub fate: i32,
    pub special: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CareerDef {
    pub name: String,
    pub category: String,
    pub stat_plan: Vec<String>,
    pub skills: Vec<String>,
    pub exits: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GameConfig {
    pub system: String,
    pub version: String,
    pub stats: Vec<StatDef>,
    pub hp_stat: String,
    pub exploding_dice: bool,
    pub races: Vec<RaceDef>,
    pub careers: Vec<CareerDef>,
    /// Fichiers vault qui ont contribué à cette config
    pub sources: Vec<String>,
}

// ── Commandes Tauri ───────────────────────────────────────────────────────────

/// Charge la config en scannant les fichiers .md du vault (frontmatter grimoire_type)
/// + fichier game.json explicite si présent. Les MD ont priorité.
#[tauri::command]
pub fn load_game_config(vault_path: String) -> Result<GameConfig, String> {
    let mut config = default_wfrp_config();
    let mut sources: Vec<String> = vec![];

    // 1. Chercher un game.json explicite (override complet si présent)
    let json_path = Path::new(&vault_path).join(".grimoire").join("config").join("game.json");
    if json_path.exists() {
        let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
        if let Ok(mut cfg) = serde_json::from_str::<GameConfig>(&content) {
            cfg.sources.push(".grimoire/config/game.json".into());
            return Ok(cfg);
        }
    }

    // 2. Scanner tous les .md du vault pour des frontmatters grimoire_type
    for entry in WalkDir::new(&vault_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("md"))
    {
        let path = entry.path();
        let rel = path.strip_prefix(&vault_path)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let fm = match extract_frontmatter(&content) {
            Some(f) => f,
            None => continue,
        };

        let doc: Value = match serde_yaml::from_str(&fm) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let grimoire_type = match doc.get("grimoire_type").and_then(|v| v.as_str()) {
            Some(t) => t.to_string(),
            None => continue,
        };

        sources.push(rel.clone());

        match grimoire_type.as_str() {
            "system" => {
                if let Some(s) = doc.get("grimoire_system").and_then(|v| v.as_str()) {
                    config.system = s.to_string();
                }
                if let Some(s) = doc.get("grimoire_hp_stat").and_then(|v| v.as_str()) {
                    config.hp_stat = s.to_string();
                }
                if let Some(b) = doc.get("grimoire_exploding_dice").and_then(|v| v.as_bool()) {
                    config.exploding_dice = b;
                }
                if let Some(stats_val) = doc.get("grimoire_stats") {
                    if let Ok(stats) = serde_yaml::from_value::<Vec<StatDef>>(stats_val.clone()) {
                        config.stats = stats;
                    }
                }
            }
            "races" => {
                if let Some(races_val) = doc.get("grimoire_races") {
                    if let Ok(races) = serde_yaml::from_value::<Vec<RaceDef>>(races_val.clone()) {
                        config.races = races;
                    }
                }
            }
            "careers" => {
                if let Some(careers_val) = doc.get("grimoire_careers") {
                    if let Ok(careers) = serde_yaml::from_value::<Vec<CareerDef>>(careers_val.clone()) {
                        config.careers = careers;
                    }
                }
            }
            _ => {}
        }
    }

    config.sources = sources;
    Ok(config)
}

/// Sauvegarde la config modifiée dans .grimoire/config/game.json
#[tauri::command]
pub fn save_game_config(vault_path: String, config: GameConfig) -> Result<(), String> {
    let config_dir = Path::new(&vault_path).join(".grimoire").join("config");
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(config_dir.join("game.json"), content).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn extract_frontmatter(content: &str) -> Option<String> {
    let content = content.trim_start();
    if !content.starts_with("---") { return None; }
    let rest = &content[3..];
    let end = rest.find("\n---")?;
    Some(rest[..end].to_string())
}

// ── Valeurs WFRP 1e par défaut ────────────────────────────────────────────────

fn s(k: &str, l: &str, roll: Option<&str>) -> StatDef {
    StatDef { key: k.into(), label: l.into(), roll: roll.map(|r| r.into()) }
}

fn default_wfrp_config() -> GameConfig {
    let stats = vec![
        s("m",   "Mouvement",            None),
        s("cc",  "Combat Corps-à-Corps", Some("2d6")),
        s("ct",  "Combat à Distance",    Some("2d6")),
        s("f",   "Force",                None),
        s("e",   "Endurance",            None),
        s("b",   "Blessures",            Some("1d10")),
        s("i",   "Initiative",           Some("2d6")),
        s("a",   "Attaques",             None),
        s("dex", "Dextérité",            Some("2d6")),
        s("cd",  "Commandement",         Some("2d6")),
        s("int", "Intelligence",         Some("2d6")),
        s("cl",  "Calme",                Some("2d6")),
        s("fm",  "Force Mentale",        Some("2d6")),
        s("soc", "Sociabilité",          Some("2d6")),
    ];

    let h = |pairs: &[(&str, i32)]| -> HashMap<String, i32> {
        pairs.iter().map(|(k, v)| (k.to_string(), *v)).collect()
    };

    let races = vec![
        RaceDef {
            name: "Humain".into(), emoji: "👤".into(),
            description: "Polyvalents, présents partout dans l'Empire.".into(),
            stats: h(&[("m",4),("cc",25),("ct",25),("f",3),("e",3),("b",8),("i",30),("a",1),("dex",30),("cd",30),("int",30),("cl",30),("fm",30),("soc",30)]),
            fate: 3, special: vec![],
        },
        RaceDef {
            name: "Nain".into(), emoji: "⚒️".into(),
            description: "Robustes et tenaces, maîtres de la pierre et du métal.".into(),
            stats: h(&[("m",3),("cc",35),("ct",20),("f",4),("e",5),("b",9),("i",20),("a",1),("dex",30),("cd",30),("int",30),("cl",40),("fm",20),("soc",20)]),
            fate: 2, special: vec!["Vision dans le noir".into(), "Haine des Orcs & Gobelins".into(), "Résistance à la magie +10".into()],
        },
        RaceDef {
            name: "Elfe".into(), emoji: "🌿".into(),
            description: "Agiles et perceptifs, vivant depuis des siècles.".into(),
            stats: h(&[("m",5),("cc",30),("ct",30),("f",3),("e",2),("b",6),("i",50),("a",1),("dex",30),("cd",30),("int",30),("cl",30),("fm",30),("soc",30)]),
            fate: 4, special: vec!["Vision dans le noir".into(), "Sens aiguisés (+10 I)".into()],
        },
        RaceDef {
            name: "Halfling".into(), emoji: "🍃".into(),
            description: "Petits mais chanceux, excellents archers.".into(),
            stats: h(&[("m",4),("cc",10),("ct",30),("f",2),("e",2),("b",5),("i",30),("a",1),("dex",40),("cd",30),("int",30),("cl",30),("fm",30),("soc",30)]),
            fate: 4, special: vec!["Résistance aux sorts de Chaos".into()],
        },
        RaceDef {
            name: "Gnome".into(), emoji: "🔮".into(),
            description: "Petits illusionnistes nés, rares et discrets.".into(),
            stats: h(&[("m",4),("cc",15),("ct",20),("f",2),("e",2),("b",4),("i",40),("a",1),("dex",40),("cd",20),("int",30),("cl",30),("fm",40),("soc",20)]),
            fate: 3, special: vec!["Accès naturel à la magie d'illusion".into()],
        },
    ];

    let careers = vec![
        CareerDef { name: "Soldat".into(), category: "Combat".into(),
            stat_plan: vec!["cc","ct","f","e"].into_iter().map(String::from).collect(),
            skills: vec!["Port d'armure","Armes lourdes","Combat rapproché","Natation"].into_iter().map(String::from).collect(),
            exits: vec!["Sergent","Mercenaire","Champion"].into_iter().map(String::from).collect() },
        CareerDef { name: "Mercenaire".into(), category: "Combat".into(),
            stat_plan: vec!["cc","ct","e","i"].into_iter().map(String::from).collect(),
            skills: vec!["Combat rapproché","Pilier d'auberge","Équitation","Intimidation"].into_iter().map(String::from).collect(),
            exits: vec!["Champion","Capitaine","Brigand"].into_iter().map(String::from).collect() },
        CareerDef { name: "Brigand".into(), category: "Combat".into(),
            stat_plan: vec!["cc","dex","m","i"].into_iter().map(String::from).collect(),
            skills: vec!["Intimidation","Discrétion","Escalade","Crochetage"].into_iter().map(String::from).collect(),
            exits: vec!["Tueur à Gages","Contrebandier","Voleur"].into_iter().map(String::from).collect() },
        CareerDef { name: "Garde de la Cité".into(), category: "Combat".into(),
            stat_plan: vec!["cc","cd","e","int"].into_iter().map(String::from).collect(),
            skills: vec!["Droit","Intimidation","Loi locale","Armes d'hast"].into_iter().map(String::from).collect(),
            exits: vec!["Sergent de Ville","Enquêteur","Soldat"].into_iter().map(String::from).collect() },
        CareerDef { name: "Archer".into(), category: "Combat".into(),
            stat_plan: vec!["ct","i","dex","m"].into_iter().map(String::from).collect(),
            skills: vec!["Tir de précision","Fabrication de flèches","Pistage","Discrétion"].into_iter().map(String::from).collect(),
            exits: vec!["Pisteur","Garde Forestier","Mercenaire"].into_iter().map(String::from).collect() },
        CareerDef { name: "Cocher".into(), category: "Voyage".into(),
            stat_plan: vec!["m","dex","i","soc"].into_iter().map(String::from).collect(),
            skills: vec!["Conduite attelage","Navigation","Commerce","Soins animaux"].into_iter().map(String::from).collect(),
            exits: vec!["Messager","Espion","Charretier"].into_iter().map(String::from).collect() },
        CareerDef { name: "Marin".into(), category: "Voyage".into(),
            stat_plan: vec!["m","dex","ct","e"].into_iter().map(String::from).collect(),
            skills: vec!["Navigation","Nœuds","Escalade","Boire"].into_iter().map(String::from).collect(),
            exits: vec!["Pirate","Officier de Marine","Marchand"].into_iter().map(String::from).collect() },
        CareerDef { name: "Pisteur".into(), category: "Voyage".into(),
            stat_plan: vec!["m","i","int","dex"].into_iter().map(String::from).collect(),
            skills: vec!["Survie","Pistage","Discrétion","Orientation"].into_iter().map(String::from).collect(),
            exits: vec!["Ranger","Chasseur de Primes","Garde Forestier"].into_iter().map(String::from).collect() },
        CareerDef { name: "Aubergiste".into(), category: "Social".into(),
            stat_plan: vec!["soc","cd","int","cl"].into_iter().map(String::from).collect(),
            skills: vec!["Réseau de contacts","Cuisine","Commerce","Évaluation"].into_iter().map(String::from).collect(),
            exits: vec!["Bourgeois","Marchand","Espion"].into_iter().map(String::from).collect() },
        CareerDef { name: "Étudiant".into(), category: "Social".into(),
            stat_plan: vec!["int","soc","cl","fm"].into_iter().map(String::from).collect(),
            skills: vec!["Érudition","Langues","Lecture/Écriture","Alchimie de base"].into_iter().map(String::from).collect(),
            exits: vec!["Savant","Alchimiste","Médecin"].into_iter().map(String::from).collect() },
        CareerDef { name: "Comédien".into(), category: "Social".into(),
            stat_plan: vec!["soc","i","dex","cd"].into_iter().map(String::from).collect(),
            skills: vec!["Déguisement","Acrobatie","Baratin","Chant"].into_iter().map(String::from).collect(),
            exits: vec!["Maître d'Espions","Escroc","Barde"].into_iter().map(String::from).collect() },
        CareerDef { name: "Initié de Sigmar".into(), category: "Religion".into(),
            stat_plan: vec!["cc","cd","cl","fm"].into_iter().map(String::from).collect(),
            skills: vec!["Bannissement","Lecture de runes","Théologie","Soins"].into_iter().map(String::from).collect(),
            exits: vec!["Prêtre Guerrier","Inquisiteur","Flagellant"].into_iter().map(String::from).collect() },
        CareerDef { name: "Apprenti Sorcier".into(), category: "Magie".into(),
            stat_plan: vec!["int","fm","cl","dex"].into_iter().map(String::from).collect(),
            skills: vec!["Magie de base","Lecture de sorts","Calligraphie runique","Connaissance des vents"].into_iter().map(String::from).collect(),
            exits: vec!["Sorcier Journeyman","Alchimiste","Étudiant"].into_iter().map(String::from).collect() },
        CareerDef { name: "Ratier".into(), category: "Spécial".into(),
            stat_plan: vec!["dex","i","m","int"].into_iter().map(String::from).collect(),
            skills: vec!["Survie dans les égouts","Pièges","Poison","Discrétion"].into_iter().map(String::from).collect(),
            exits: vec!["Empoisonneur","Tueur à Gages","Contrebandier"].into_iter().map(String::from).collect() },
        CareerDef { name: "Médecin des Rues".into(), category: "Spécial".into(),
            stat_plan: vec!["int","dex","cl","soc"].into_iter().map(String::from).collect(),
            skills: vec!["Soins basiques","Alchimie","Herboristerie","Commerce"].into_iter().map(String::from).collect(),
            exits: vec!["Chirurgien","Apothicaire","Étudiant"].into_iter().map(String::from).collect() },
    ];

    GameConfig {
        system: "WFRP 1ère Édition".into(),
        version: "1.0".into(),
        stats,
        hp_stat: "b".into(),
        exploding_dice: true,
        races,
        careers,
        sources: vec![],
    }
}
