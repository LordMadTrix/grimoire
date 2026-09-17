// src/lib/spellcheck/spellcheckStore.svelte.ts

export type SpellcheckLang = 'fr' | 'en';
export type SpellcheckStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface TypoItem {
  word: string;
  from: number;
  to: number;
  suggestions: string[];
}

let enabled = $state(true);
let lang = $state<SpellcheckLang>('fr');
let customWords = $state<string[]>([]);
let status = $state<SpellcheckStatus>('idle');
let errorMessage = $state<string | null>(null);

let worker: Worker | null = null;
let reqId = 0;
const pendingRequests = new Map<number, (val: any) => void>();

// Load from localStorage
if (typeof window !== 'undefined') {
  const savedEnabled = localStorage.getItem('grimoire_spellcheck_enabled');
  if (savedEnabled !== null) enabled = savedEnabled === 'true';

  const savedLang = localStorage.getItem('grimoire_spellcheck_lang') as SpellcheckLang | null;
  if (savedLang === 'fr' || savedLang === 'en') lang = savedLang;

  const savedCustomWords = localStorage.getItem('grimoire_spellcheck_custom_words');
  if (savedCustomWords) {
    try {
      const parsed = JSON.parse(savedCustomWords);
      if (Array.isArray(parsed)) customWords = parsed;
    } catch (e) {}
  }
}

function initWorker() {
  if (worker || typeof window === 'undefined') return;

  try {
    worker = new Worker(new URL('./spellcheck.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      const data = e.data;
      if (!data) return;

      switch (data.type) {
        case 'STATUS':
          status = data.status;
          if (data.error) errorMessage = data.error;
          break;

        case 'CHECK_WORDS_RESULT':
          if (data.id && pendingRequests.has(data.id)) {
            const resolver = pendingRequests.get(data.id)!;
            pendingRequests.delete(data.id);
            resolver(data.typos || []);
          }
          break;

        case 'SUGGESTIONS_RESULT':
          if (data.id && pendingRequests.has(data.id)) {
            const resolver = pendingRequests.get(data.id)!;
            pendingRequests.delete(data.id);
            resolver(data.suggestions || []);
          }
          break;
      }
    };

    worker.onerror = (err) => {
      console.error('[SpellcheckStore] Worker error:', err);
      status = 'error';
      errorMessage = err.message || 'Worker failure';
    };

    worker.postMessage({
      type: 'INIT',
      lang,
      customWords
    });
  } catch (err: any) {
    console.error('[SpellcheckStore] Worker initialization failed:', err);
    status = 'error';
    errorMessage = err?.message || String(err);
  }
}

export function getSpellcheckEnabled(): boolean {
  return enabled;
}

export function setSpellcheckEnabled(val: boolean) {
  enabled = val;
  if (typeof window !== 'undefined') {
    localStorage.setItem('grimoire_spellcheck_enabled', String(val));
    document.dispatchEvent(new CustomEvent('spellcheck-settings-changed'));
  }
  if (val && !worker) {
    initWorker();
  }
}

export function toggleSpellcheck(): boolean {
  setSpellcheckEnabled(!enabled);
  return enabled;
}

export function getSpellcheckLang(): SpellcheckLang {
  return lang;
}

export function setSpellcheckLang(newLang: SpellcheckLang) {
  if (newLang !== 'fr' && newLang !== 'en') return;
  lang = newLang;
  if (typeof window !== 'undefined') {
    localStorage.setItem('grimoire_spellcheck_lang', newLang);
  }
  if (worker) {
    worker.postMessage({ type: 'SET_LANG', lang: newLang });
  } else if (enabled) {
    initWorker();
  }
  if (typeof window !== 'undefined') {
    document.dispatchEvent(new CustomEvent('spellcheck-settings-changed'));
  }
}

export function getSpellcheckStatus(): SpellcheckStatus {
  return status;
}

export function getSpellcheckError(): string | null {
  return errorMessage;
}

export function getCustomWords(): string[] {
  return customWords;
}

export function addCustomWord(word: string) {
  const clean = word.trim();
  if (!clean || customWords.includes(clean)) return;

  customWords = [...customWords, clean];
  if (typeof window !== 'undefined') {
    localStorage.setItem('grimoire_spellcheck_custom_words', JSON.stringify(customWords));
  }
  if (worker) {
    worker.postMessage({ type: 'ADD_WORD', word: clean });
  }
  if (typeof window !== 'undefined') {
    document.dispatchEvent(new CustomEvent('spellcheck-settings-changed'));
  }
}

export function removeCustomWord(word: string) {
  customWords = customWords.filter(w => w !== word);
  if (typeof window !== 'undefined') {
    localStorage.setItem('grimoire_spellcheck_custom_words', JSON.stringify(customWords));
  }
  if (worker) {
    worker.postMessage({ type: 'REMOVE_WORD', word });
  }
  if (typeof window !== 'undefined') {
    document.dispatchEvent(new CustomEvent('spellcheck-settings-changed'));
  }
}

export function ignoreSessionWord(word: string) {
  if (worker) {
    worker.postMessage({ type: 'IGNORE_WORD', word });
  }
  if (typeof window !== 'undefined') {
    document.dispatchEvent(new CustomEvent('spellcheck-settings-changed'));
  }
}

export async function checkWordsInWorker(words: Array<{ word: string; from: number; to: number }>): Promise<TypoItem[]> {
  if (!enabled || words.length === 0) return [];
  if (!worker) {
    initWorker();
  }
  if (!worker || status === 'loading' || status === 'error') {
    return [];
  }

  const id = ++reqId;
  return new Promise((resolve) => {
    pendingRequests.set(id, resolve);
    worker!.postMessage({
      type: 'CHECK_WORDS',
      id,
      words
    });

    // Timeout safety (2s max)
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        resolve([]);
      }
    }, 2000);
  });
}

// Auto-initialize worker if enabled
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (getSpellcheckEnabled()) {
      initWorker();
    }
  }, 100);
}
