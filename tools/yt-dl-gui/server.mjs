// 🎬 Téléchargeur YouTube — mini-serveur local (zéro dépendance)
// Lancement : node tools/yt-dl-gui/server.mjs   (ou start-youtube-dl.cmd)
// Interface : http://localhost:5199
import http from 'node:http';
import { spawn } from 'node:child_process';
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// PORT=0 existe dans certains environnements : on n'accepte que un port réel, sinon 5199
const PORT = (() => {
  const v = Number(process.env.PORT);
  return Number.isInteger(v) && v > 0 && v < 65536 ? v : 5199;
})();
const HOST = '127.0.0.1'; // jamais exposé sur le réseau
const TOOLS_DIR =
  process.env.GRIMOIRE_TOOLS ||
  path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'grimoire-tools');
const DEFAULT_OUTPUT = path.join(os.homedir(), 'Downloads', 'youtube-dl');

// ── Outils ──────────────────────────────────────────────────────────────────
function findYtdlp() {
  if (process.env.YTDL_PATH) return process.env.YTDL_PATH;
  const local = path.join(TOOLS_DIR, 'yt-dlp.exe');
  return local; // yt-dlp.exe de Grimoire (installé dans %LOCALAPPDATA%\grimoire-tools)
}

async function findFfmpegDir() {
  try {
    const entries = await fs.readdir(TOOLS_DIR);
    for (const e of entries.sort().reverse()) {
      const bin = path.join(TOOLS_DIR, e, 'bin', 'ffmpeg.exe');
      if (e.startsWith('ffmpeg') && (await exists(bin))) return path.join(TOOLS_DIR, e, 'bin');
    }
  } catch {}
  return null; // yt-dlp cherchera ffmpeg dans le PATH
}

const exists = (p) => fs.access(p).then(() => true, () => false);

const YTDLP = findYtdlp();
let FFMPEG_DIR = null;
let ytdlpVersion = null;

// ── File de travail ─────────────────────────────────────────────────────────
const jobs = new Map();
let jobSeq = 0;

const FORMATS = {
  'mp4-1080': { label: 'MP4 1080p', args: ['-f', 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]', '--merge-output-format', 'mp4'] },
  'mp4-720': { label: 'MP4 720p', args: ['-f', 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/bv*[height<=720]+ba/b[height<=720]', '--merge-output-format', 'mp4'] },
  'mp4-480': { label: 'MP4 480p (léger)', args: ['-f', 'bv*[height<=480][ext=mp4]+ba[ext=m4a]/bv*[height<=480]+ba/b[height<=480]', '--merge-output-format', 'mp4'] },
  best: { label: 'Meilleure qualité', args: ['-f', 'bv*+ba/b', '--merge-output-format', 'mp4'] },
  mp3: { label: 'MP3 (audio)', args: ['-x', '--audio-format', 'mp3', '--audio-quality', '0'] },
  m4a: { label: 'M4A (audio)', args: ['-x', '--audio-format', 'm4a'] },
};

function newJob(body) {
  const id = `job${++jobSeq}`;
  const job = {
    id,
    url: String(body.url || '').trim(),
    format: FORMATS[body.format] ? body.format : 'mp4-1080',
    playlist: !!body.playlist,
    png: !!body.png,
    cookies: String(body.cookies || '').trim(),
    browserCookies: String(body.browserCookies || '').trim(),
    range: String(body.range || '').trim(),
    output: path.resolve(String(body.output || DEFAULT_OUTPUT)),
    title: String(body.title || ''),
    thumb: String(body.thumb || ''),
    status: 'attente',
    phase: '',
    percent: 0,
    speed: '',
    eta: '',
    files: [],
    pngFile: '',
    error: '',
    note: '',
    log: [],
    startedAt: Date.now(),
    endedAt: 0,
    proc: null,
  };
  return job;
}

function buildArgs(job) {
  const args = [
    '--newline',
    '--no-mtime',
    // --print bascule yt-dlp en mode silencieux : --progress réaffiche la progression
    '--progress',
    '--js-runtimes',
    'node', // yt-dlp a besoin d'un runtime JS (node) pour tous les formats YouTube
    '--progress-template',
    'download:DL|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    '--print',
    'after_move:FILE|%(filepath)s',
    '-P',
    job.output,
    '-o',
    '%(title).120B [%(id)s].%(ext)s',
  ];
  if (FFMPEG_DIR) args.push('--ffmpeg-location', FFMPEG_DIR);
  // anti « confirm you're not a bot » : fichier cookies.txt d'abord, sinon cookies lus dans le navigateur (doit être fermé)
  if (job.cookies) args.push('--cookies', job.cookies);
  else if (job.browserCookies) args.push('--cookies-from-browser', job.browserCookies);
  if (job.playlist) {
    args.push('--yes-playlist');
    if (job.range) args.push('--playlist-items', job.range); // plage ex. « 1-5 » ou « 2,4,6-8 »
  } else {
    args.push('--no-playlist');
  }
  args.push(...FORMATS[job.format].args);
  args.push(job.url);
  return args;
}

function handleLine(job, line) {
  if (!line) return;
  job.log.push(line);
  if (job.log.length > 120) job.log.shift();

  if (line.startsWith('DL|')) {
    const [, pct, speed, eta] = line.split('|');
    const p = parseFloat(String(pct).replace(',', '.'));
    if (!Number.isNaN(p)) {
      // yt-dlp télécharge vidéo puis audio séparément : la barre redescend au 2e flux
      if (p < (job.percent || 0) - 10) job.stream = (job.stream || 1) + 1;
      job.percent = p;
    }
    job.speed = (speed || '').trim();
    job.eta = (eta || '').trim();
    if (job.phase !== 'Fusion MP4…' && job.phase !== 'Extraction audio…') {
      job.phase = job.stream > 1 ? `Téléchargement (partie ${job.stream})…` : 'Téléchargement';
    }
    return;
  }
  if (line.startsWith('FILE|')) {
    const f = line.slice(5).trim();
    if (f) {
      job.files.push(f);
      job.file = f;
    }
    return;
  }
  if (line.startsWith('[Merger]')) job.phase = 'Fusion MP4…';
  else if (line.startsWith('[ExtractAudio]')) job.phase = 'Extraction audio…';
  else if (line.startsWith('[download] Destination:')) job.phase = 'Téléchargement';
}

function runJob(job) {
  job.status = 'cours';
  job.phase = 'Préparation…';
  job.startedAt = Date.now();
  const args = buildArgs(job);
  job.cmd = `yt-dlp ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
  job.log.push(`$ ${job.cmd}`);

  const proc = spawn(YTDLP, args, { windowsHide: true });
  job.proc = proc;

  let buf = '';
  const consume = (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.search(/\r|\n/)) >= 0) {
      const line = buf.slice(0, i).replace(/\x1b\[[0-9;]*m/g, '');
      buf = buf.slice(i + 1);
      handleLine(job, line.trimEnd());
    }
  };
  proc.stdout.on('data', consume);
  proc.stderr.on('data', consume);

  proc.on('error', (e) => {
    job.status = 'erreur';
    job.error = `Impossible de lancer yt-dlp : ${e.message} (vérifiez ${YTDLP})`;
    job.endedAt = Date.now();
  });

  proc.on('close', async (code, signal) => {
    if (job.status === 'annulé') return;
    if (code !== 0) {
      job.status = 'erreur';
      job.error =
        job.log.filter((l) => /error|ERROR|erreur/i.test(l)).slice(-2).join(' — ') ||
        `yt-dlp s'est arrêté (code ${code ?? signal})`;
      job.hint = hintFor(job.error);
      job.endedAt = Date.now();
      return;
    }
    job.percent = 100;
    job.phase = 'Post-traitement…';
    if (job.png) {
      try {
        job.pngFile = await extractMidFrame(job);
        if (job.pngFile) job.note = `Image extraite : ${path.basename(job.pngFile)}`;
      } catch (e) {
        job.note = `Extraction PNG impossible : ${e.message}`;
      }
    }
    job.status = 'terminé';
    job.phase = 'Terminé';
    job.endedAt = Date.now();
  });
}

// Extrait une image PNG à mi-parcours d'une vidéo (usage cartes animées)
async function extractMidFrame(job) {
  const file = job.files[job.files.length - 1];
  if (!file || !/\.(mp4|webm|mkv|mov)$/i.test(file)) return '';
  const ffprobe = FFMPEG_DIR ? path.join(FFMPEG_DIR, 'ffprobe.exe') : 'ffprobe';
  const ffmpeg = FFMPEG_DIR ? path.join(FFMPEG_DIR, 'ffmpeg.exe') : 'ffmpeg';
  if (!(await exists(ffprobe)) || !(await exists(ffmpeg))) throw new Error('ffmpeg/ffprobe introuvable');

  const dur = await new Promise((resolve, reject) => {
    const p = spawn(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
      windowsHide: true,
    });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => {
      const v = parseFloat(out.trim());
      Number.isNaN(v) ? reject(new Error('durée illisible')) : resolve(v);
    });
  });

  const outPng = file.replace(/\.[^.]+$/, '.png');
  const at = Math.max(0, dur / 2);
  await new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ['-y', '-ss', String(at), '-i', file, '-frames:v', '1', '-q:v', '2', outPng], {
      windowsHide: true,
    });
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg code ${c}`))));
  });
  return outPng;
}

function analyzeUrl(url) {
  return new Promise((resolve, reject) => {
    const pl = isPlaylistUrl(url);
    // Pour une playlist : mode flat (titres sans appel par vidéo) → rapide et résistant au bot-check
    const args = pl
      ? ['-J', '--flat-playlist', '--js-runtimes', 'node', url]
      : ['-J', '--no-playlist', '--js-runtimes', 'node', url];
    const proc = spawn(YTDLP, args, { windowsHide: true });
    let out = '';
    let err = '';
    const t = setTimeout(() => {
      proc.kill();
      reject(new Error('Délai dépassé pendant l’analyse (60 s)'));
    }, 60000);
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
    proc.on('close', (code) => {
      clearTimeout(t);
      if (code !== 0) return reject(new Error(lastError(err || out) || `yt-dlp (code ${code})`));
      try {
        const j = JSON.parse(out);
        const isPlaylist = pl || j._type === 'playlist' || Array.isArray(j.entries);
        const entries = Array.isArray(j.entries) ? j.entries : [];
        resolve({
          id: j.id,
          url: j.webpage_url || url,
          title: j.title || j.playlist_title || '',
          channel: j.channel || j.uploader || j.playlist_uploader || '',
          duration: j.duration_string || (j.duration ? `${Math.floor(j.duration / 60)} min` : ''),
          thumbnail: j.thumbnail || (entries[0] && entries[0].thumbnail) || '',
          views: j.view_count ?? null,
          isLive: !!j.is_live,
          isPlaylist,
          count: j.playlist_count ?? entries.length ?? (isPlaylist ? 0 : 1),
        });
      } catch {
        reject(new Error('Réponse illisible de yt-dlp'));
      }
    });
  });
}

const lastError = (txt) =>
  txt
    .split(/\r?\n/)
    .filter((l) => /error/i.test(l))
    .slice(-1)[0]
    ?.replace(/^ERROR:\s*/i, '') || '';

// ── HTTP ────────────────────────────────────────────────────────────────────
const json = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (d) => {
      data += d;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        resolve({});
      }
    });
  });

const isValidUrl = (u) => {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
};

// URL de playlist pure (page /playlist ou list= sans v=) → on télécharge la playlist quoi qu'il arrive
const isPlaylistUrl = (u) => {
  try {
    const p = new URL(u);
    return p.pathname.endsWith('/playlist') || (!!p.searchParams.get('list') && !p.searchParams.get('v'));
  } catch {
    return false;
  }
};

const isValidRange = (r) => /^\d{1,5}(-\d{1,5})?(,\d{1,5}(-\d{1,5})?)*$/.test(r);
const BROWSERS = new Set(['chrome', 'edge', 'firefox', 'brave', 'opera', 'vivaldi']);
const BROWSER_PROCESS = { chrome: 'chrome.exe', edge: 'msedge.exe', firefox: 'firefox.exe', brave: 'brave.exe', opera: 'opera.exe', vivaldi: 'vivaldi.exe' };

// Vérifie (via tasklist) que le navigateur est bien fermé — sinon yt-dlp ne peut pas lire ses cookies
function isBrowserRunning(browser) {
  const proc = BROWSER_PROCESS[browser];
  if (!proc) return Promise.resolve(false);
  return new Promise((resolve) => {
    const p = spawn('tasklist', ['/FI', `IMAGENAME eq ${proc}`], { windowsHide: true });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('error', () => resolve(false));
    p.on('close', () => resolve(out.toLowerCase().includes(proc)));
  });
}

// Conseils en français selon l'erreur yt-dlp
function hintFor(err) {
  if (!err) return '';
  if (/Sign in to confirm/i.test(err)) {
    return "YouTube exige une session : fermez complètement Chrome/Edge (y compris en arrière-plan, icône dans la zone de notification) puis choisissez « cookies du navigateur » — ou donnez le chemin d'un cookies.txt exporté (extension « Get cookies.txt »).";
  }
  if (/Could not copy .*cookie database/i.test(err)) {
    return 'Base de cookies verrouillée : seul le navigateur DONT on lit les cookies doit être fermé. L’interface, elle, peut rester ouverte dans un autre navigateur (Edge, Firefox, ou l’onglet Navigateur de Freebuff).';
  }
  return '';
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const route = `${req.method} ${url.pathname}`;

  try {
    if (route === 'GET /' || route === 'GET /index.html') {
      const html = await fs.readFile(path.join(__dirname, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (route === 'GET /api/config') {
      return json(res, 200, {
        ytdlp: YTDLP,
        ytdlpOk: await exists(YTDLP),
        version: ytdlpVersion,
        ffmpeg: FFMPEG_DIR,
        defaultOutput: DEFAULT_OUTPUT,
        formats: Object.fromEntries(Object.entries(FORMATS).map(([k, v]) => [k, v.label])),
      });
    }

    if (route === 'POST /api/analyze') {
      const body = await readBody(req);
      if (!isValidUrl(body.url)) return json(res, 400, { error: 'URL invalide (http/https attendu)' });
      try {
        return json(res, 200, await analyzeUrl(body.url));
      } catch (e) {
        return json(res, 502, { error: e.message });
      }
    }

    if (route === 'GET /api/jobs') {
      const list = [...jobs.values()]
        .sort((a, b) => b.startedAt - a.startedAt)
        .map(({ proc, ...rest }) => rest);
      return json(res, 200, list);
    }

    if (route === 'POST /api/jobs') {
      const body = await readBody(req);
      if (!isValidUrl(body.url)) return json(res, 400, { error: 'URL invalide (http/https attendu)' });
      const range = String(body.range || '').trim();
      if (range && !isValidRange(range)) {
        return json(res, 400, { error: `Plage invalide : « ${range} » (exemples : 1-5, ou 2,4,6-8)` });
      }
      const output = path.resolve(String(body.output || DEFAULT_OUTPUT));
      const cookies = String(body.cookies || '').trim();
      if (cookies && !(await exists(path.resolve(cookies)))) {
        return json(res, 400, { error: `Fichier cookies introuvable : ${cookies}` });
      }
      const browserCookies = String(body.browserCookies || '').trim();
      if (browserCookies && !BROWSERS.has(browserCookies)) {
        return json(res, 400, { error: `Navigateur non pris en charge : ${browserCookies}` });
      }
      if (browserCookies && !cookies && (await isBrowserRunning(browserCookies))) {
        return json(res, 400, {
          error: `${browserCookies} est en cours d'exécution — ses cookies sont verrouillés.`,
          hint: `Fermez ${browserCookies} complètement (y compris en arrière-plan) puis relancez. L’interface n’a pas besoin de lui : elle fonctionne dans un autre navigateur — ou dans l’onglet Navigateur de Freebuff. Alternative sans rien fermer : un fichier cookies.txt.`,
        });
      }
      await fs.mkdir(output, { recursive: true });
      const job = newJob({ ...body, output, cookies, browserCookies, range, playlist: !!body.playlist || isPlaylistUrl(body.url) });
      jobs.set(job.id, job);

      // Analyse automatique pour titre + vignette (best effort)
      analyzeUrl(job.url)
        .then((info) => {
          if (!job.title) job.title = info.title;
          if (!job.thumb) job.thumb = info.thumbnail;
        })
        .catch(() => {});

      runJob(job);
      return json(res, 200, { id: job.id });
    }

    const cancel = route.match(/^POST \/api\/jobs\/(\w+)\/cancel$/);
    if (cancel) {
      const job = jobs.get(cancel[1]);
      if (!job) return json(res, 404, { error: 'inconnu' });
      if (job.proc && job.status === 'cours') {
        job.status = 'annulé';
        job.phase = 'Annulé';
        job.endedAt = Date.now();
        job.proc.kill();
      }
      return json(res, 200, { ok: true });
    }

    const remove = route.match(/^DELETE \/api\/jobs\/(\w+)$/);
    if (remove) {
      const job = jobs.get(remove[1]);
      if (job && job.status === 'cours') return json(res, 409, { error: 'Téléchargement en cours' });
      jobs.delete(remove[1]);
      return json(res, 200, { ok: true });
    }

    if (route === 'POST /api/open-folder') {
      const body = await readBody(req);
      const dir = path.resolve(String(body.path || ''));
      if (!(await exists(dir))) return json(res, 404, { error: 'Dossier introuvable' });
      spawn('explorer.exe', [dir], { windowsHide: true }).on('error', () => {});
      return json(res, 200, { ok: true });
    }

    json(res, 404, { error: 'introuvable' });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

FFMPEG_DIR = await findFfmpegDir();
ytdlpVersion = await new Promise((resolve) => {
  if (!existsSync(YTDLP)) return resolve(null);
  const p = spawn(YTDLP, ['--version'], { windowsHide: true });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  p.on('close', () => resolve(out.trim() || null));
  p.on('error', () => resolve(null));
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`⚠  Le port ${PORT} est déjà utilisé : une instance du téléchargeur tourne déjà.`);
    console.log(`   → Interface disponible sur http://localhost:${PORT}`);
    process.exit(0);
  }
  console.error('Erreur serveur :', e.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const bound = server.address().port;
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🎬  Téléchargeur YouTube — Grimoire');
  console.log(`  ➜  http://localhost:${bound}`);
  console.log(`  yt-dlp  : ${YTDLP}${ytdlpVersion ? ` (v${ytdlpVersion})` : ' ⚠ INTROUVABLE'}`);
  console.log(`  ffmpeg  : ${FFMPEG_DIR || 'PATH'}`);
  console.log(`  Dossier : ${DEFAULT_OUTPUT}`);
  console.log('═══════════════════════════════════════════════════════════');
});
