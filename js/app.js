import { CATS, STORES } from './data.js';
import { guessCat, getSuggestions } from './autocomplete.js';
import { exportToClipboard } from './storage.js';
import {
  subscribeLists, saveList, updateList, deleteList,
  subscribeItems, saveItem, updateItem, deleteItem, deleteItems,
  subscribeDict, saveDictItem, removeDictItem,
  subscribeMeta, saveMeta,
} from './firebase.js';

// ─── Stan ─────────────────────────────────────────────────────────────────────
let lists           = {};   // { id: { id, name, createdAt } }
let items           = {};   // { id: { id, listId, name, qty, store, cat, done } }
let customDictItems = [];
let meta            = { nextId: 1, nextListId: 1 };
let screen          = 'home';
let activeListId    = null;
let activeStoreId   = null;
let acIdx           = -1;

const $ = id => document.getElementById(id);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const listItems  = listId => Object.values(items).filter(i => i.listId === listId);
const allItems   = ()     => Object.values(items);
const storeItems = storeId => allItems().filter(i => i.store === storeId);

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ─── Połączenie ───────────────────────────────────────────────────────────────
function setConnected(ok) {
  document.querySelectorAll('.conn-dot').forEach(d => d.style.background = ok ? '#22c55e' : '#e24b4a');
  document.querySelectorAll('.conn-lbl').forEach(l => l.textContent = ok ? 'połączono' : 'łączenie…');
}

// ─── Nawigacja ────────────────────────────────────────────────────────────────
const SCREENS = ['homeScreen','listsScreen','listDetailScreen',
                 'storeSelectScreen','storeShopScreen','dictScreen'];

function showOnly(id) {
  SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== id));
}

function goHome()          { screen = 'home';        showOnly('homeScreen');        renderHome(); }
function goLists()         { screen = 'lists';       showOnly('listsScreen');       renderLists(); }
function goListDetail(lid) { screen = 'listDetail';  activeListId = lid; showOnly('listDetailScreen'); renderListDetail(); }
function goStoreSelect()   { screen = 'storeSelect'; showOnly('storeSelectScreen'); renderStoreSelect(); }
function goStoreShop(sid)  { screen = 'storeShop';   activeStoreId = sid; showOnly('storeShopScreen'); renderStoreShop(); }
function goDict()          { screen = 'dict';        showOnly('dictScreen');        renderDictScreen(); }

// ─── Selekty ──────────────────────────────────────────────────────────────────
function buildSelects() {
  const ss = $('inputStore'); ss.innerHTML = '';
  STORES.forEach(s => ss.append(new Option(s.label, s.id)));
  const sc = $('inputCat');   sc.innerHTML = '';
  CATS.forEach(c => sc.append(new Option(c.label, c.id)));
  const dc = $('dictCatSelect'); dc.innerHTML = '';
  CATS.forEach(c => dc.append(new Option(c.label, c.id)));
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────
function onNameInput() {
  const v = $('inputName').value;
  if (v.length > 1) $('inputCat').value = guessCat(v);
  renderAC(v);
}
function renderAC(q) {
  const dd = $('acDrop'); const suggs = getSuggestions(q, customDictItems);
  if (!suggs.length) { dd.style.display = 'none'; return; }
  dd.innerHTML = ''; acIdx = -1;
  suggs.forEach(([name, catId]) => {
    const cat  = CATS.find(c => c.id === catId) ?? CATS.at(-1);
    const item = document.createElement('div');
    item.className = 'ac-item';
    item.innerHTML = `<span>${name}</span><span class="ac-cat-badge ${cat.cls}">${cat.label}</span>`;
    item.addEventListener('mousedown', () => pickAC(name, catId));
    dd.appendChild(item);
  });
  dd.style.display = 'block';
}
function pickAC(name, catId) {
  $('inputName').value = name; $('inputCat').value = catId;
  $('acDrop').style.display = 'none'; acIdx = -1;
}
function onNameKey(e) {
  const dd  = $('acDrop'); const els = dd.querySelectorAll('.ac-item');
  if (e.key === 'ArrowDown')  { e.preventDefault(); acIdx = Math.min(acIdx+1, els.length-1); highlightAC(els); }
  else if (e.key === 'ArrowUp')    { e.preventDefault(); acIdx = Math.max(acIdx-1,-1); highlightAC(els); }
  else if (e.key === 'Enter') {
    if (acIdx >= 0 && els[acIdx]) { e.preventDefault(); els[acIdx].dispatchEvent(new MouseEvent('mousedown')); }
    else { dd.style.display = 'none'; addItem(); }
  } else if (e.key === 'Escape') { dd.style.display = 'none'; acIdx = -1; }
}
function highlightAC(els) { els.forEach((e,i) => e.classList.toggle('ac-sel', i===acIdx)); }
document.addEventListener('click', e => {
  if (!e.target.closest('.name-wrap')) { $('acDrop').style.display = 'none'; acIdx = -1; }
});

// ─── Akcje: listy ─────────────────────────────────────────────────────────────
async function createList() {
  const name = $('newListName').value.trim();
  if (!name) { $('newListName').focus(); return; }

  // bezpieczne ID — weź max z istniejących lub z meta
  const existingListIds = Object.values(lists).map(l => Number(l.id) || 0);
  const id = Math.max(meta.nextListId ?? 1, ...existingListIds, 0) ;

  const list = { id, name, createdAt: Date.now() };
  meta.nextListId  = id + 1;
  meta.nextId      = meta.nextId ?? 1;
  await saveMeta(meta);
  await saveList(list);
  $('newListName').value = '';
  $('newListForm').classList.add('hidden');
  showToast(`Utworzono listę „${name}"`);
}

async function doDeleteList(id) {
  // usuń listę i wszystkie jej produkty
  const toDelete = listItems(id).map(i => i.id);
  if (toDelete.length) await deleteItems(toDelete);
  await deleteList(id);
  showToast('Lista usunięta');
}

// ─── Akcje: produkty ──────────────────────────────────────────────────────────
async function addItem() {
  const name = $('inputName').value.trim();
  if (!name) { $('inputName').focus(); return; }

  // bezpieczne ID
  const existingItemIds = Object.values(items).map(i => Number(i.id) || 0);
  const id = Math.max(meta.nextId ?? 1, ...existingItemIds, 0);

  const item = {
    id, listId: activeListId, name,
    qty:   $('inputQty').value || '1',
    store: $('inputStore').value,
    cat:   $('inputCat').value,
    done:  false, addedAt: Date.now(),
  };
  meta.nextId      = id + 1;
  meta.nextListId  = meta.nextListId ?? 1;
  await saveMeta(meta);
  await saveItem(item);
  $('inputName').value = ''; $('inputQty').value = '1';
  $('acDrop').style.display = 'none'; $('inputName').focus();
}
async function toggleDone(id) {
  const it = items[id]; if (it) await updateItem(id, { done: !it.done });
}
async function doDeleteItem(id) { await deleteItem(id); }
async function doClearDone() {
  const ids = listItems(activeListId).filter(i => i.done).map(i => i.id);
  if (!ids.length) { showToast('Brak kupionych produktów'); return; }
  await deleteItems(ids);
  showToast(`Usunięto ${ids.length} ${ids.length === 1 ? 'produkt' : 'produktów'}`);
}

// ─── Akcje: słownik ───────────────────────────────────────────────────────────
async function addDictItem() {
  const name = $('dictName').value.trim(); const cat = $('dictCatSelect').value;
  if (!name) return;
  if (customDictItems.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    showToast('Ten produkt już jest w słowniku'); return;
  }
  await saveDictItem(name, cat); $('dictName').value = '';
  showToast(`Dodano „${name}" do słownika`);
}
async function doRemoveDictItem(name) { await removeDictItem(name); }
window._removeDict = doRemoveDictItem;

// ─── Render: ekran główny ─────────────────────────────────────────────────────
function renderHome() {
  const listArr = Object.values(lists);
  const totalRem = allItems().filter(i => !i.done).length;
  const now = new Date();
  const days = ['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'];
  const months = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
  $('homeDate').textContent      = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
  $('homeTileCount').textContent = totalRem;
  $('homeTileSub').textContent   = listArr.length > 0
    ? `${listArr.length} ${listArr.length === 1 ? 'lista' : listArr.length < 5 ? 'listy' : 'list'}`
    : 'brak list';

  // pilulki sklepów
  const storeCounts = STORES
    .map(s => ({ ...s, count: allItems().filter(i => i.store === s.id && !i.done).length }))
    .filter(s => s.count > 0);
  $('homePills').innerHTML = storeCounts
    .map(s => `<span class="home-pill" style="background:${s.dot}22;color:${s.dot}">${s.label} ${s.count}</span>`)
    .join('') || `<span style="font-size:12px;opacity:.5">brak produktów</span>`;

  $('homeDictSub').textContent = customDictItems.length > 0
    ? `${customDictItems.length} własnych wpisów` : 'brak własnych wpisów';
}

// ─── Render: spis list ────────────────────────────────────────────────────────
function renderLists() {
  const con = $('listsContainer');
  const listArr = Object.values(lists).sort((a,b) => b.createdAt - a.createdAt);

  if (!listArr.length) {
    con.innerHTML = '<div class="empty-state"><i class="ti ti-clipboard" aria-hidden="true"></i>Brak list. Utwórz pierwszą poniżej.</div>';
    return;
  }
  con.innerHTML = '';
  listArr.forEach(list => {
    const li   = listItems(list.id);
    const rem  = li.filter(i => !i.done).length;
    const done = li.filter(i =>  i.done).length;
    const pct  = li.length > 0 ? Math.round(done / li.length * 100) : 0;

    // pilulki sklepów tej listy
    const storePills = STORES
      .map(s => ({ ...s, c: li.filter(i => i.store === s.id && !i.done).length }))
      .filter(s => s.c > 0)
      .map(s => `<span class="list-store-pill" style="background:${s.dot}22;color:${s.dot}">${s.label} ${s.c}</span>`)
      .join('');

    const card = document.createElement('div');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="list-card-top">
        <div class="list-card-name">${list.name}</div>
        <button class="btn-icon list-del-btn" data-lid="${list.id}" aria-label="Usuń listę">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
      </div>
      ${li.length > 0 ? `
        <div class="list-card-progress">
          <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
          <span class="list-card-count">${rem} do kupienia</span>
        </div>
        <div class="list-store-pills">${storePills}</div>
      ` : `<div class="list-card-empty">Lista jest pusta</div>`}
    `;
    card.addEventListener('click', e => {
      if (!e.target.closest('.list-del-btn')) goListDetail(list.id);
    });
    card.querySelector('.list-del-btn').addEventListener('click', e => {
      e.stopPropagation();
      if (confirm(`Usunąć listę „${list.name}" i wszystkie jej produkty?`)) doDeleteList(list.id);
    });
    con.appendChild(card);
  });
}

// ─── Render: szczegóły listy ──────────────────────────────────────────────────
function renderListDetail() {
  const list = lists[activeListId];
  if (!list) { goLists(); return; }
  $('listDetailName').textContent = list.name;

  const fi = listItems(activeListId);
  const rem = fi.filter(i => !i.done).length;
  $('listDetailSummary').innerHTML = `
    <div class="stat-pill"><div class="stat-val">${rem}</div><div class="stat-lbl">Do kupienia</div></div>
    <div class="stat-pill"><div class="stat-val">${fi.filter(i=>i.done).length}</div><div class="stat-lbl">Kupione</div></div>
    <div class="stat-pill"><div class="stat-val">${fi.length}</div><div class="stat-lbl">Łącznie</div></div>`;

  const con = $('listDetailItems');
  if (!fi.length) {
    con.innerHTML = '<div class="empty-state"><i class="ti ti-clipboard-list" aria-hidden="true"></i>Lista jest pusta. Dodaj produkty powyżej.</div>';
    return;
  }
  con.innerHTML = '';
  CATS.forEach(cat => {
    const arr = [...fi.filter(i => i.cat === cat.id)].sort((a,b) => Number(a.done)-Number(b.done));
    if (!arr.length) return;
    const grp = document.createElement('div'); grp.className = 'cat-group';
    const remC = arr.filter(i => !i.done).length;
    grp.innerHTML = `<div class="cat-header"><span class="cat-badge ${cat.cls}">${cat.label}</span><div class="cat-divider"></div><span class="cat-count">${remC}/${arr.length}</span></div>`;
    arr.forEach(item => {
      const store = STORES.find(s => s.id === item.store) ?? STORES.at(-1);
      const card  = document.createElement('div');
      card.className = 'item-card' + (item.done ? ' done' : '');
      card.innerHTML = `
        <button class="item-check ${item.done?'checked':''}" data-id="${item.id}" aria-label="Przełącz">
          <i class="ti ti-check" aria-hidden="true"></i>
        </button>
        <div class="item-body">
          <div class="item-name">${item.name}</div>
          <div class="item-meta"><span>${item.qty} szt.</span>
            <span class="store-pill" style="background:${store.bg};color:${store.fg}">${store.label}</span>
          </div>
        </div>
        <button class="btn-icon" data-del="${item.id}" aria-label="Usuń"><i class="ti ti-trash" aria-hidden="true"></i></button>`;
      grp.appendChild(card);
    });
    con.appendChild(grp);
  });
  con.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => toggleDone(+b.dataset.id)));
  con.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => doDeleteItem(+b.dataset.del)));
}

// ─── Render: wybór sklepu ─────────────────────────────────────────────────────
function renderStoreSelect() {
  const con = $('storeGrid');
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  con.innerHTML = '';
  STORES.forEach((s, idx) => {
    const count = allItems().filter(i => i.store === s.id && !i.done).length;
    const bg  = dark ? s.tileBgDark  : s.tileBgLight;
    const fg  = dark ? s.tileFgDark  : s.tileFgLight;
    const sub = dark ? s.tileSubDark : s.tileSubLight;
    const isWide = idx === STORES.length - 1;
    const tile = document.createElement('button');
    tile.className = 'store-tile' + (isWide ? ' store-tile-wide' : '');
    tile.style.cssText = `background:${bg};color:${fg}`;
    let logoInner = s.id === 'lidl'
      ? `<span style="color:#fff">Li</span><span style="color:#FFCC00">dl</span>`
      : s.id === 'inny' ? `<i class="ti ti-dots-circle-horizontal"></i>` : s.logoLabel;
    if (isWide) {
      tile.innerHTML = `
        <div class="store-logo" style="background:${s.logoBg};color:${s.logoFg};flex-shrink:0">${logoInner}</div>
        <div style="flex:1"><div class="store-tile-name">${s.label}</div>
          <div class="store-tile-sub" style="color:${sub}">${count > 0 ? count+' produktów' : 'brak produktów'}</div></div>
        <i class="ti ti-arrow-right" style="opacity:.35;font-size:18px;flex-shrink:0"></i>`;
    } else {
      tile.innerHTML = `
        <div class="store-logo" style="background:${s.logoBg};color:${s.logoFg}">${logoInner}</div>
        <div class="store-tile-name">${s.label}</div>
        <div class="store-tile-sub" style="color:${sub}">${count > 0 ? count+' produktów' : 'brak'}</div>
        <i class="ti ti-arrow-right store-tile-arr"></i>`;
    }
    tile.addEventListener('click', () => goStoreShop(s.id));
    con.appendChild(tile);
  });
}

// ─── Render: tryb sklepu ──────────────────────────────────────────────────────
function renderStoreShop() {
  const store = STORES.find(s => s.id === activeStoreId) ?? STORES.at(-1);
  const dark  = window.matchMedia('(prefers-color-scheme: dark)').matches;
  $('storeShopName').textContent = store.label;
  $('storeShopName').style.color = dark ? store.tileFgDark : store.tileFgLight;

  const fi     = allItems().filter(i => i.store === activeStoreId);
  const undone = fi.filter(i => !i.done).length;
  const total  = fi.length;
  const pct    = total > 0 ? Math.round((total-undone)/total*100) : 0;

  $('storeShopProgress').innerHTML = `
    <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
    <span class="progress-text">${total-undone} / ${total}</span>`;

  const con = $('storeShopList');
  if (!fi.length) { con.innerHTML = '<div class="empty-state"><i class="ti ti-clipboard-list"></i>Brak produktów dla tego sklepu.</div>'; return; }
  if (!undone)    { con.innerHTML = '<div class="shop-done-banner"><i class="ti ti-circle-check"></i>Wszystko kupione!</div>'; return; }

  con.innerHTML = '';
  CATS.forEach(cat => {
    const arr = [...fi.filter(i => i.cat === cat.id)].sort((a,b) => Number(a.done)-Number(b.done));
    if (!arr.length) return;
    const grp = document.createElement('div'); grp.className = 'shop-group';
    grp.innerHTML = `<div class="shop-group-title"><span class="cat-badge ${cat.cls}">${cat.label}</span></div>`;
    arr.forEach(item => {
      const listName = lists[item.listId]?.name ?? '';
      const div = document.createElement('div');
      div.className = 'shop-item' + (item.done ? ' done' : '');
      div.innerHTML = `
        <div class="shop-check"><i class="ti ti-check"></i></div>
        <div style="flex:1;min-width:0">
          <div class="shop-item-name">${item.name}</div>
          ${listName ? `<div style="font-size:11px;opacity:.55;margin-top:2px">${listName}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="shop-item-qty">${item.qty} szt.</span>
          <button class="btn-icon" data-del="${item.id}" style="width:26px;height:26px;font-size:14px"><i class="ti ti-trash"></i></button>
        </div>`;
      div.addEventListener('click', e => { if (!e.target.closest('[data-del]')) toggleDone(item.id); });
      grp.appendChild(div);
    });
    con.appendChild(grp);
  });
  con.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation(); doDeleteItem(+b.dataset.del);
  }));
}

// ─── Render: słownik ──────────────────────────────────────────────────────────
function renderDictScreen() {
  const list = $('dictTagList'); list.innerHTML = '';
  if (!customDictItems.length) {
    list.innerHTML = '<span style="font-size:12px;color:var(--text-3)">Brak własnych wpisów — dodaj poniżej</span>';
    return;
  }
  customDictItems.forEach(({ name, cat }) => {
    const catDef = CATS.find(c => c.id === cat) ?? CATS.at(-1);
    const tag = document.createElement('span');
    tag.className = `dict-tag ${catDef.cls}`;
    tag.innerHTML = `${name} <button aria-label="Usuń ${name}" onclick="window._removeDict('${name.replace(/'/g,"\\'")}')">×</button>`;
    list.appendChild(tag);
  });
}

// ─── Główny render ────────────────────────────────────────────────────────────
function render() {
  renderHome();
  if (screen === 'lists')        renderLists();
  if (screen === 'listDetail')   renderListDetail();
  if (screen === 'storeSelect')  renderStoreSelect();
  if (screen === 'storeShop')    renderStoreShop();
  if (screen === 'dict')         renderDictScreen();
}

// ─── Firebase subskrypcje ─────────────────────────────────────────────────────
function initFirebase() {
  setConnected(false);
  let ready = { lists: false, items: false, dict: false, meta: false };
  const checkReady = () => Object.values(ready).every(Boolean);

  subscribeLists(data => {
    lists = data; ready.lists = true;
    if (checkReady()) { setConnected(true); render(); }
  });
  subscribeItems(data => {
    items = data; ready.items = true;
    if (checkReady()) { setConnected(true); render(); }
  });
  subscribeDict(data => {
    customDictItems = Object.values(data); ready.dict = true;
    if (checkReady()) { setConnected(true); render(); }
  });
  subscribeMeta(data => {
    meta = data; ready.meta = true;
    if (checkReady()) { setConnected(true); render(); }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  buildSelects();

  // home
  $('tileList').addEventListener('click',  goLists);
  $('tileShop').addEventListener('click',  goStoreSelect);
  $('tileDict').addEventListener('click',  goDict);

  // lists screen
  $('btnBackLists').addEventListener('click', goHome);
  $('btnShowNewList').addEventListener('click', () => {
    $('newListForm').classList.toggle('hidden');
    if (!$('newListForm').classList.contains('hidden')) $('newListName').focus();
  });
  $('btnCreateList').addEventListener('click', createList);
  $('newListName').addEventListener('keydown', e => { if (e.key === 'Enter') createList(); });

  // list detail
  $('btnBackListDetail').addEventListener('click', goLists);
  $('inputName').addEventListener('input',   onNameInput);
  $('inputName').addEventListener('keydown', onNameKey);
  $('btnAdd').addEventListener('click',       addItem);
  $('btnClearDone').addEventListener('click', doClearDone);

  // stores
  $('btnBackStoreSelect').addEventListener('click', goHome);
  $('btnBackStoreShop').addEventListener('click',   goStoreSelect);

  // dict
  $('btnBackDict').addEventListener('click', goHome);
  $('btnDictAdd').addEventListener('click',  addDictItem);
  $('dictName').addEventListener('keydown',  e => { if (e.key === 'Enter') addDictItem(); });

  initFirebase();
}

document.addEventListener('DOMContentLoaded', init);
