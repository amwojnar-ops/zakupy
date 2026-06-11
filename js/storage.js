import { CATS, STORES } from './data.js';

const STORAGE_KEY = 'zakupy_v1';

// ─── Domyślny stan aplikacji ──────────────────────────────────────────────────
const DEFAULT_STATE = {
  items: [],
  customDictItems: [],   // produkty dodane przez użytkownika do słownika
  nextId: 1,
  activeStore: 'all',
  mode: 'list',          // 'list' | 'shop'
};

// ─── Załaduj stan z localStorage ─────────────────────────────────────────────
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const saved = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...saved };
  } catch (e) {
    return { ...DEFAULT_STATE };
  }
}

// ─── Zapisz stan do localStorage ─────────────────────────────────────────────
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Nie można zapisać stanu:', e);
  }
}

// ─── Eksport listy do schowka (tekst) ─────────────────────────────────────────
export function exportToClipboard(items, activeStore) {
  const filtered = activeStore === 'all'
    ? items
    : items.filter(i => i.store === activeStore);

  const undone = filtered.filter(i => !i.done);
  if (!undone.length) return false;

  const storeName = activeStore === 'all'
    ? 'Wszystkie sklepy'
    : (STORES.find(s => s.id === activeStore)?.label ?? activeStore);

  const byCat = {};
  CATS.forEach(c => {
    const arr = undone.filter(i => i.cat === c.id);
    if (arr.length) byCat[c.id] = { label: c.label, items: arr };
  });

  const lines = [`🛒 Lista zakupów — ${storeName}`, ''];
  Object.values(byCat).forEach(({ label, items: arr }) => {
    lines.push(`${label}:`);
    arr.forEach(item => lines.push(`  • ${item.name}  ×${item.qty}`));
    lines.push('');
  });

  navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  return true;
}

// ─── Wyczyść kupione produkty ─────────────────────────────────────────────────
export function clearDone(state) {
  return { ...state, items: state.items.filter(i => !i.done) };
}

// ─── Przenieś kupione na dół w obrębie kategorii ──────────────────────────────
export function sortItems(items) {
  return [...items].sort((a, b) => Number(a.done) - Number(b.done));
}
