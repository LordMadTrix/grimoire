// src/lib/spellcheck/spellcheck.worker.ts
import nspell from 'nspell';

interface WordCheckItem {
  word: string;
  from: number;
  to: number;
}

interface WorkerMessageData {
  type: 'INIT' | 'SET_LANG' | 'CHECK_WORDS' | 'ADD_WORD' | 'REMOVE_WORD' | 'IGNORE_WORD' | 'GET_SUGGESTIONS';
  lang?: 'fr' | 'en';
  customWords?: string[];
  words?: WordCheckItem[];
  id?: number;
  word?: string;
}

let spellInstance: any = null;
let currentLang: 'fr' | 'en' = 'fr';
let customWordsSet = new Set<string>();
let ignoredWordsSet = new Set<string>();
const checkCache = new Map<string, boolean>();
const suggestCache = new Map<string, string[]>();

async function loadDictionary(lang: 'fr' | 'en') {
  try {
    currentLang = lang;
    checkCache.clear();
    suggestCache.clear();

    const [affRes, dicRes] = await Promise.all([
      fetch(`/dictionaries/${lang}/index.aff`),
      fetch(`/dictionaries/${lang}/index.dic`)
    ]);

    if (!affRes.ok || !dicRes.ok) {
      throw new Error(`Failed to load dictionary files for ${lang} (${affRes.status}/${dicRes.status})`);
    }

    const [affText, dicText] = await Promise.all([
      affRes.text(),
      dicRes.text()
    ]);

    spellInstance = nspell(affText, dicText);

    // Re-apply custom words
    for (const word of customWordsSet) {
      try {
        spellInstance.add(word);
      } catch (e) {
        // ignore add error
      }
    }

    postMessage({ type: 'STATUS', status: 'ready', lang });
  } catch (error: any) {
    console.error(`[SpellcheckWorker] Dictionary load error for ${lang}:`, error);
    postMessage({ type: 'STATUS', status: 'error', error: error?.message || String(error) });
  }
}

function isWordValid(rawWord: string): boolean {
  const word = rawWord.trim().replace(/’/g, "'");
  if (!word || word.length <= 1) return true;

  // Ignore numbers, dice notation like 1d20, 2d6, d100
  if (/^\d+[dD]\d+([+-]\d+)?$/.test(word) || /^[dD]\d+$/.test(word)) return true;
  if (/^\d+([.,]\d+)?%?$/.test(word)) return true;

  // Ignored or custom words
  const lower = word.toLowerCase();
  if (ignoredWordsSet.has(word) || ignoredWordsSet.has(lower)) return true;
  if (customWordsSet.has(word) || customWordsSet.has(lower)) return true;

  if (checkCache.has(word)) return checkCache.get(word)!;

  if (!spellInstance) return true;

  let correct = spellInstance.correct(word);

  // If false and word starts with capital letter, check lowercased
  if (!correct && /^[A-ZÀ-ÖØ-ß]/.test(word)) {
    correct = spellInstance.correct(lower);
  }

  // French elision check: d', l', qu', etc.
  if (!correct && currentLang === 'fr') {
    const elisionMatch = word.match(/^(?:c|d|j|l|m|n|s|t|qu)[''](.+)$/i);
    if (elisionMatch) {
      const base = elisionMatch[1];
      if (spellInstance.correct(base) || spellInstance.correct(base.toLowerCase()) || customWordsSet.has(base.toLowerCase())) {
        correct = true;
      }
    }
  }

  checkCache.set(word, correct);
  return correct;
}

function getWordSuggestions(rawWord: string): string[] {
  const word = rawWord.trim().replace(/’/g, "'");
  if (suggestCache.has(word)) return suggestCache.get(word)!;
  if (!spellInstance) return [];

  let suggestions: string[] = [];
  try {
    suggestions = spellInstance.suggest(word) || [];
  } catch (e) {
    suggestions = [];
  }

  // French elision fallback if suggest returned nothing
  if (suggestions.length === 0 && currentLang === 'fr') {
    const elisionMatch = word.match(/^((?:c|d|j|l|m|n|s|t|qu)[''])(.+)$/i);
    if (elisionMatch) {
      const prefix = elisionMatch[1];
      const base = elisionMatch[2];
      try {
        const baseSuggestions = spellInstance.suggest(base) || [];
        suggestions = baseSuggestions.map((s: string) => `${prefix}${s}`);
      } catch (e) {}
    }
  }

  // Limit to top 5 suggestions and unique
  const unique = Array.from(new Set(suggestions)).slice(0, 5);
  suggestCache.set(word, unique);
  return unique;
}

self.onmessage = async (e: MessageEvent<WorkerMessageData>) => {
  const { type, lang, customWords, words, id, word } = e.data;

  switch (type) {
    case 'INIT': {
      if (customWords && Array.isArray(customWords)) {
        customWordsSet = new Set(customWords);
      }
      postMessage({ type: 'STATUS', status: 'loading' });
      await loadDictionary(lang || 'fr');
      break;
    }

    case 'SET_LANG': {
      if (lang && lang !== currentLang) {
        postMessage({ type: 'STATUS', status: 'loading' });
        await loadDictionary(lang);
      }
      break;
    }

    case 'CHECK_WORDS': {
      if (!spellInstance || !words) {
        postMessage({ type: 'CHECK_WORDS_RESULT', id, typos: [] });
        return;
      }

      const typos: Array<{ word: string; from: number; to: number; suggestions: string[] }> = [];

      for (const item of words) {
        if (!isWordValid(item.word)) {
          const suggestions = getWordSuggestions(item.word);
          typos.push({
            word: item.word,
            from: item.from,
            to: item.to,
            suggestions
          });
        }
      }

      postMessage({ type: 'CHECK_WORDS_RESULT', id, typos });
      break;
    }

    case 'ADD_WORD': {
      if (word) {
        customWordsSet.add(word);
        checkCache.delete(word);
        checkCache.delete(word.toLowerCase());
        suggestCache.delete(word);
        if (spellInstance) {
          try {
            spellInstance.add(word);
          } catch (e) {}
        }
        postMessage({ type: 'WORD_ADDED', word });
      }
      break;
    }

    case 'REMOVE_WORD': {
      if (word) {
        customWordsSet.delete(word);
        checkCache.delete(word);
        checkCache.delete(word.toLowerCase());
        suggestCache.delete(word);
        // Reload dictionary to purge removed word from nspell trie
        await loadDictionary(currentLang);
        postMessage({ type: 'WORD_REMOVED', word });
      }
      break;
    }

    case 'IGNORE_WORD': {
      if (word) {
        ignoredWordsSet.add(word);
        ignoredWordsSet.add(word.toLowerCase());
        checkCache.set(word, true);
        checkCache.set(word.toLowerCase(), true);
        postMessage({ type: 'WORD_IGNORED', word });
      }
      break;
    }

    case 'GET_SUGGESTIONS': {
      if (word) {
        const suggestions = getWordSuggestions(word);
        postMessage({ type: 'SUGGESTIONS_RESULT', id, word, suggestions });
      }
      break;
    }
  }
};
