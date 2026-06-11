export const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBiWvckz-UmtajzwityuWlkkONglQ3Y4xI",
  authDomain:        "zakupy-rodzina.firebaseapp.com",
  databaseURL:       "https://zakupy-rodzina-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "zakupy-rodzina",
  storageBucket:     "zakupy-rodzina.firebasestorage.app",
  messagingSenderId: "549840791405",
  appId:             "1:549840791405:web:c3daeb4488a7ad7ec91c64",
};

import { initializeApp }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, onValue, set, remove, update, push }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const app = initializeApp(FIREBASE_CONFIG);
const db  = getDatabase(app);

const r = path => ref(db, path);

// ─── Listy zakupów ────────────────────────────────────────────────────────────
export function subscribeLists(cb) {
  onValue(r('lists'), snap => cb(snap.val() ?? {}));
}
export async function saveList(list) {
  await set(r(`lists/${list.id}`), list);
}
export async function updateList(id, fields) {
  await update(r(`lists/${id}`), fields);
}
export async function deleteList(id) {
  await remove(r(`lists/${id}`));
}

// ─── Produkty (globalne, przypisane do listy przez listId) ────────────────────
export function subscribeItems(cb) {
  onValue(r('items'), snap => cb(snap.val() ?? {}));
}
export async function saveItem(item) {
  await set(r(`items/${item.id}`), item);
}
export async function updateItem(id, fields) {
  await update(r(`items/${id}`), fields);
}
export async function deleteItem(id) {
  await remove(r(`items/${id}`));
}
export async function deleteItems(ids) {
  const u = {};
  ids.forEach(id => { u[`items/${id}`] = null; });
  await update(r('/'), u);
}

// ─── Słownik użytkownika ──────────────────────────────────────────────────────
export function subscribeDict(cb) {
  onValue(r('customDict'), snap => cb(snap.val() ?? {}));
}
export async function saveDictItem(name, cat) {
  await set(r(`customDict/${btoa(encodeURIComponent(name))}`), { name, cat });
}
export async function removeDictItem(name) {
  await remove(r(`customDict/${btoa(encodeURIComponent(name))}`));
}

// ─── Meta (nextId) ────────────────────────────────────────────────────────────
export function subscribeMeta(cb) {
  onValue(r('meta'), snap => cb(snap.val() ?? { nextId: 1, nextListId: 1 }));
}
export async function saveMeta(meta) {
  await set(r('meta'), meta);
}
