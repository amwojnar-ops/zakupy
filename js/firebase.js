// ─── Konfiguracja Firebase ─────────────────────────────────────────────────────
// WAŻNE: Zamień poniższe wartości na swoje dane z Firebase Console
// (patrz README — sekcja "Konfiguracja Firebase")

export const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBiWvckz-UmtajzwityuWlkkONglQ3Y4xI",
  authDomain:        "zakupy-rodzina.firebaseapp.com",
  databaseURL:       "https://zakupy-rodzina-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "zakupy-rodzina",
  storageBucket:     "zakupy-rodzina.firebasestorage.app",
  messagingSenderId: "549840791405",
  appId:             "1:549840791405:web:c3daeb4488a7ad7ec91c64",
};

// ─── Inicjalizacja Firebase ────────────────────────────────────────────────────
import { initializeApp }      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, onValue, set, remove, update }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const app = initializeApp(FIREBASE_CONFIG);
const db  = getDatabase(app);

// ─── Ścieżki w bazie ───────────────────────────────────────────────────────────
const ITEMS_REF       = () => ref(db, 'items');
const ITEM_REF        = id => ref(db, `items/${id}`);
const DICT_REF        = () => ref(db, 'customDict');
const DICT_ITEM_REF   = name => ref(db, `customDict/${btoa(encodeURIComponent(name))}`);
const META_REF        = () => ref(db, 'meta');

// ─── Nasłuchiwanie zmian w czasie rzeczywistym ────────────────────────────────
// callback(items, customDict, meta) wywoływany przy każdej zmianie w bazie
export function subscribeToData(callback) {
  // Nasłuchuj produktów
  onValue(ITEMS_REF(), snap => {
    const raw = snap.val() ?? {};
    const items = Object.values(raw);
    callback({ type: 'items', items });
  });

  // Nasłuchuj słownika
  onValue(DICT_REF(), snap => {
    const raw = snap.val() ?? {};
    const customDict = Object.values(raw);
    callback({ type: 'dict', customDict });
  });

  // Nasłuchuj metadanych (nextId)
  onValue(META_REF(), snap => {
    const meta = snap.val() ?? { nextId: 1 };
    callback({ type: 'meta', meta });
  });
}

// ─── Zapis produktu ───────────────────────────────────────────────────────────
export async function saveItem(item) {
  await set(ITEM_REF(item.id), item);
}

// ─── Aktualizacja pola produktu (np. done) ────────────────────────────────────
export async function updateItem(id, fields) {
  await update(ITEM_REF(id), fields);
}

// ─── Usunięcie produktu ───────────────────────────────────────────────────────
export async function deleteItem(id) {
  await remove(ITEM_REF(id));
}

// ─── Usunięcie wielu produktów naraz ─────────────────────────────────────────
export async function deleteItems(ids) {
  const updates = {};
  ids.forEach(id => { updates[`items/${id}`] = null; });
  await update(ref(db, '/'), updates);
}

// ─── Zapis wpisu słownika użytkownika ─────────────────────────────────────────
export async function saveDictItem(name, cat) {
  await set(DICT_ITEM_REF(name), { name, cat });
}

// ─── Usunięcie wpisu słownika ─────────────────────────────────────────────────
export async function removeDictItem(name) {
  await remove(DICT_ITEM_REF(name));
}

// ─── Zapis metadanych (nextId) ─────────────────────────────────────────────────
export async function saveMeta(meta) {
  await set(META_REF(), meta);
}
