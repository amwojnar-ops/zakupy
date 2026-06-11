import { DICT, KEYWORD_RULES } from './data.js';

// ─── Zgadnij kategorię na podstawie nazwy produktu ────────────────────────────
// 1. Dokładne dopasowanie ze słownika
// 2. Dopasowanie słów kluczowych (substring)
// 3. Fallback → 'inne'
export function guessCat(name) {
  const n = name.trim().toLowerCase();
  if (!n) return 'inne';

  // Dokładne dopasowanie
  const exact = DICT.find(([d]) => d.toLowerCase() === n);
  if (exact) return exact[1];

  // Częściowe dopasowanie ze słownika (rozpoczyna się od)
  const startsWith = DICT.find(([d]) => n.startsWith(d.toLowerCase()) || d.toLowerCase().startsWith(n));
  if (startsWith) return startsWith[1];

  // Słowa kluczowe
  for (const { kws, cat } of KEYWORD_RULES) {
    if (kws.some(k => n.includes(k))) return cat;
  }

  return 'inne';
}

// ─── Podpowiedzi autocomplete ─────────────────────────────────────────────────
// Zwraca max `limit` pozycji pasujących do zapytania q
// Najpierw te zaczynające się od q, potem zawierające q
export function getSuggestions(q, customItems = [], limit = 8) {
  const ql = q.trim().toLowerCase();
  if (ql.length < 1) return [];

  // Połącz słownik z produktami użytkownika
  const allDict = [
    ...DICT,
    ...customItems.map(c => [c.name, c.cat]),
  ];

  // Deduplikacja po nazwie (case-insensitive)
  const seen = new Set();
  const unique = [];
  for (const entry of allDict) {
    const key = entry[0].toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(entry); }
  }

  const startsWith = unique.filter(([n]) => n.toLowerCase().startsWith(ql));
  const contains   = unique.filter(([n]) => !n.toLowerCase().startsWith(ql) && n.toLowerCase().includes(ql));

  return [...startsWith, ...contains].slice(0, limit);
}
