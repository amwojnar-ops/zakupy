import { CATS, STORES } from './data.js';
import { guessCat, getSuggestions } from './autocomplete.js';
import { exportToClipboard } from './storage.js';
import {
  subscribeToData, saveItem, updateItem,
  deleteItem, deleteItems, saveDictItem,
  removeDictItem, saveMeta,
} from './firebase.js';

// ─── Stan ─────────────────────────────────────────────────────────────────────
let items           = [];
let customDictItems = [];
let nextId          = 1;
let screen          = 'home';   // 'home' | 'list' | 'store' | 'dict'
let activeStoreId   = null;     // dla ekranu sklepu
let acIdx           = -1;

const $ = id => document.getElementById(id);

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
function showOnly(id) {
  ['homeScreen','listScreen','storeSelectScreen','storeShopScreen','dictScreen']
    .forEach(s => $(s).classList.toggle('hidden', s !== id));
}

function goHome() {
  screen = 'home';
  showOnly('homeScreen');
  renderHome();
}

function goList() {
  screen = 'list';
  showOnly('listScreen');
  renderList();
}

function goStoreSelect() {
  screen = 'storeSelect';
  showOnly('storeSelectScreen');
  renderStoreSelect();
}

function goStoreShop(storeId) {
  screen = 'storeShop';
  activeStoreId = storeId;
  showOnly('storeShopScreen');
  renderStoreShop();
}

function goDict() {
  screen = 'dict';
  showOnly('dictScreen');
  renderDictScreen();
}

// ─── Selekty ──────────────────────────────────────────────────────────────────
function buildSelects() {
  const ss = $('inputStore');
  ss.innerHTML = '';
  STORES.forEach(s => ss.append(new Option(s.label, s.id)));
  const sc = $('inputCat');
  sc.innerHTML = '';
  CATS.forEach(c => sc.append(new Option(c.label, c.id)));
  const dc = $('dictCatSelect');
  dc.innerHTML = '';
  CATS.forEach(c => dc.append(new Option(c.label, c.id)));
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────
function onNameInput() {
  const v = $('inputName').value;
  if (v.length > 1) $('inputCat').value = guessCat(v);
  renderAC(v);
}
function renderAC(q) {
  const dd = $('acDrop');
  const suggs = getSuggestions(q, customDictItems);
  if (!suggs.length) { dd.style.display = 'none'; return; }
  dd.innerHTML = '';
  acIdx = -1;
  suggs.forEach(([name, catId]) => {
    const cat = CATS.find(c => c.id === catId) ?? CATS.at(-1);
    const item = document.createElement('div');
    item.className = 'ac-item';
    item.innerHTML = `<span>${name}</span><span class="ac-cat-badge ${cat.cls}">${cat.label}</span>`;
    item.addEventListener('mousedown', () => pickAC(name, catId));
    dd.appendChild(item);
  });
  dd.style.display = 'block';
}
function pickAC(name, catId) {
  $('inputName').value = name;
  $('inputCat').value  = catId;
  $('acDrop').style.display = 'none';
  acIdx = -1;
}
function onNameKey(e) {
  const dd = $('acDrop');
  const els = dd.querySelectorAll('.ac-item');
  if (e.key === 'ArrowDown')  { e.preventDefault(); acIdx = Math.min(acIdx+1, els.length-1); highlightAC(els); }
  else if (e.key === 'ArrowUp')    { e.preventDefault(); acIdx = Math.max(acIdx-1, -1); highlightAC(els); }
  else if (e.key === 'Enter') {
    if (acIdx >= 0 && els[acIdx]) { e.preventDefault(); els[acIdx].dispatchEvent(new MouseEvent('mousedown')); }
    else { dd.style.display = 'none'; addItem(); }
  } else if (e.key === 'Escape') { dd.style.display = 'none'; acIdx = -1; }
}
function highlightAC(els) { els.forEach((e,i) => e.classList.toggle('ac-sel', i===acIdx)); }
document.addEventListener('click', e => {
  if (!e.target.closest('.name-wrap')) { $('acDrop').style.display = 'none'; acIdx = -1; }
});

// ─── Akcje ────────────────────────────────────────────────────────────────────
async function addItem() {
  const name = $('inputName').value.trim();
  if (!name) { $('inputName').focus(); return; }
  const item = { id: nextId, name,
    qty: $('inputQty').value || '1',
    store: $('inputStore').value,
    cat: $('inputCat').value,
    done: false, addedAt: Date.now() };
  nextId++;
  await saveMeta({ nextId });
  await saveItem(item);
  $('inputName').value = '';
  $('inputQty').value = '1';
  $('acDrop').style.display = 'none';
  $('inputName').focus();
}

async function toggleDone(id) {
  const it = items.find(i => i.id === id);
  if (it) await updateItem(id, { done: !it.done });
}

async function doDeleteItem(id) {
  await deleteItem(id);
}

async function doClearDone() {
  const doneIds = items.filter(i => i.done).map(i => i.id);
  if (!doneIds.length) { showToast('Brak kupionych produktów'); return; }
  await deleteItems(doneIds);
  showToast(`Usunięto ${doneIds.length} ${doneIds.length === 1 ? 'produkt' : 'produktów'}`);
}

function doCopy() {
  const ok = exportToClipboard(items, 'all');
  showToast(ok ? 'Lista skopiowana do schowka' : 'Brak produktów do skopiowania');
}

async function addDictItem() {
  const name = $('dictName').value.trim();
  const cat  = $('dictCatSelect').value;
  if (!name) return;
  if (customDictItems.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    showToast('Ten produkt już jest w słowniku'); return;
  }
  await saveDictItem(name, cat);
  $('dictName').value = '';
  showToast(`Dodano „${name}" do słownika`);
}
async function doRemoveDictItem(name) { await removeDictItem(name); }
window._removeDict = doRemoveDictItem;

// ─── Render: ekran główny ─────────────────────────────────────────────────────
function renderHome() {
  const rem   = items.filter(i => !i.done).length;
  const total = items.length;
  const storeCounts = STORES
    .map(s => ({ ...s, count: items.filter(i => i.store === s.id && !i.done).length }))
    .filter(s => s.count > 0);
  const pills = storeCounts.map(s =>
    `<span class="home-pill" style="background:${s.dot}22;color:${s.dot}">${s.label} ${s.count}</span>`
  ).join('');
  const now = new Date();
  const days = ['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'];
  const months = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
  $('homeDate').textContent    = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
  $('homeTileCount').textContent = rem;
  $('homeTileSub').textContent   = total > 0 ? `${total} produktów łącznie` : 'Lista jest pusta';
  $('homePills').innerHTML = pills || `<span style="font-size:12px;opacity:.5">brak produktów</span>`;
  $('homeDictSub').textContent = customDictItems.length > 0
    ? `${customDictItems.length} własnych wpisów` : 'brak własnych wpisów';
}

// ─── Render: ekran listy (dodawanie) ─────────────────────────────────────────
function renderList() {
  const con = $('listItems');
  if (!items.length) {
    con.innerHTML = '<div class="empty-state"><i class="ti ti-clipboard-list" aria-hidden="true"></i>Lista jest pusta.</div>';
    return;
  }
  con.innerHTML = '';
  CATS.forEach(cat => {
    const arr = [...items.filter(i => i.cat === cat.id)].sort((a,b) => Number(a.done)-Number(b.done));
    if (!arr.length) return;
    const grp = document.createElement('div');
    grp.className = 'cat-group';
    const rem = arr.filter(i => !i.done).length;
    grp.innerHTML = `<div class="cat-header"><span class="cat-badge ${cat.cls}">${cat.label}</span><div class="cat-divider"></div><span class="cat-count">${rem}/${arr.length}</span></div>`;
    arr.forEach(item => {
      const store = STORES.find(s => s.id === item.store) ?? STORES.at(-1);
      const card  = document.createElement('div');
      card.className = 'item-card' + (item.done ? ' done' : '');
      card.innerHTML = `
        <button class="item-check ${item.done?'checked':''}" data-id="${item.id}" aria-label="Przełącz status">
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
  const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  con.innerHTML = '';
  STORES.forEach((s, idx) => {
    const count = items.filter(i => i.store === s.id && !i.done).length;
    const bg  = darkMode ? s.tileBgDark  : s.tileBgLight;
    const fg  = darkMode ? s.tileFgDark  : s.tileFgLight;
    const sub = darkMode ? s.tileSubDark : s.tileSubLight;
    const isWide = idx === STORES.length - 1;  // "Inne" — pełna szerokość

    const tile = document.createElement('button');
    tile.className = 'store-tile' + (isWide ? ' store-tile-wide' : '');
    tile.style.cssText = `background:${bg};color:${fg}`;
    tile.setAttribute('aria-label', `${s.label} — ${count} produktów`);

    // Logo circle
    let logoInner = '';
    if (s.id === 'lidl') {
      logoInner = `<span style="color:#fff">Li</span><span style="color:#FFCC00">dl</span>`;
    } else if (s.id === 'inny') {
      logoInner = `<i class="ti ti-dots-circle-horizontal" aria-hidden="true"></i>`;
    } else {
      logoInner = s.logoLabel;
    }

    if (isWide) {
      tile.innerHTML = `
        <div class="store-logo" style="background:${s.logoBg};color:${s.logoFg};flex-shrink:0">${logoInner}</div>
        <div style="flex:1">
          <div class="store-tile-name">${s.label}</div>
          <div class="store-tile-sub" style="color:${sub}">${count > 0 ? count+' produktów' : 'brak produktów'}</div>
        </div>
        <i class="ti ti-arrow-right" style="opacity:.35;font-size:18px;flex-shrink:0" aria-hidden="true"></i>`;
    } else {
      tile.innerHTML = `
        <div class="store-logo" style="background:${s.logoBg};color:${s.logoFg}">${logoInner}</div>
        <div class="store-tile-name">${s.label}</div>
        <div class="store-tile-sub" style="color:${sub}">${count > 0 ? count+' produktów' : 'brak'}</div>
        <i class="ti ti-arrow-right store-tile-arr" aria-hidden="true"></i>`;
    }

    tile.addEventListener('click', () => goStoreShop(s.id));
    con.appendChild(tile);
  });
}

// ─── Render: tryb sklepu (tylko odhaczanie) ───────────────────────────────────
function renderStoreShop() {
  const store = STORES.find(s => s.id === activeStoreId) ?? STORES.at(-1);
  const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const fg = darkMode ? store.tileFgDark : store.tileFgLight;

  // nagłówek
  $('storeShopName').textContent = store.label;
  $('storeShopName').style.color = fg;

  const fi = items.filter(i => i.store === activeStoreId);
  const undone = fi.filter(i => !i.done).length;
  const total  = fi.length;
  const pct    = total > 0 ? Math.round((total - undone) / total * 100) : 0;

  $('storeShopProgress').innerHTML = `
    <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
    <span class="progress-text">${total - undone} / ${total}</span>`;

  const con = $('storeShopList');
  if (!fi.length) {
    con.innerHTML = '<div class="empty-state"><i class="ti ti-clipboard-list" aria-hidden="true"></i>Brak produktów dla tego sklepu.<br>Dodaj je w widoku listy.</div>';
    return;
  }
  if (!undone) {
    con.innerHTML = '<div class="shop-done-banner"><i class="ti ti-circle-check" aria-hidden="true"></i>Wszystko kupione!</div>';
    return;
  }
  con.innerHTML = '';
  CATS.forEach(cat => {
    const arr = [...fi.filter(i => i.cat === cat.id)].sort((a,b) => Number(a.done)-Number(b.done));
    if (!arr.length) return;
    const grp = document.createElement('div');
    grp.className = 'shop-group';
    grp.innerHTML = `<div class="shop-group-title"><span class="cat-badge ${cat.cls}">${cat.label}</span></div>`;
    arr.forEach(item => {
      const div = document.createElement('div');
      div.className = 'shop-item' + (item.done ? ' done' : '');
      div.innerHTML = `
        <div class="shop-check"><i class="ti ti-check" aria-hidden="true"></i></div>
        <span class="shop-item-name">${item.name}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="shop-item-qty">${item.qty} szt.</span>
          <button class="btn-icon" data-del="${item.id}" aria-label="Usuń" style="width:26px;height:26px;font-size:14px">
            <i class="ti ti-trash" aria-hidden="true"></i>
          </button>
        </div>`;
      div.querySelector('.shop-check').parentElement.addEventListener('click', e => {
        if (!e.target.closest('[data-del]')) toggleDone(item.id);
      });
      grp.appendChild(div);
    });
    con.appendChild(grp);
  });
  con.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    doDeleteItem(+b.dataset.del);
  }));
}

// ─── Render: słownik ──────────────────────────────────────────────────────────
function renderDictScreen() {
  const list = $('dictTagList');
  list.innerHTML = '';
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

// ─── Główny render (po każdej zmianie Firebase) ───────────────────────────────
function render() {
  renderHome();
  if (screen === 'list')        renderList();
  if (screen === 'storeSelect') renderStoreSelect();
  if (screen === 'storeShop')   renderStoreShop();
  if (screen === 'dict')        renderDictScreen();
}

// ─── Firebase ─────────────────────────────────────────────────────────────────
function initFirebase() {
  setConnected(false);
  subscribeToData(({ type, items: newItems, customDict, meta }) => {
    setConnected(true);
    if (type === 'items')  items           = newItems ?? [];
    if (type === 'dict')   customDictItems = customDict ?? [];
    if (type === 'meta')   nextId          = meta?.nextId ?? 1;
    render();
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  buildSelects();

  // home tiles
  $('tileList').addEventListener('click',  goList);
  $('tileShop').addEventListener('click',  goStoreSelect);
  $('tileDict').addEventListener('click',  goDict);

  // back buttons
  $('btnBackList').addEventListener('click',       goHome);
  $('btnBackStoreSelect').addEventListener('click', goHome);
  $('btnBackStoreShop').addEventListener('click',   goStoreSelect);
  $('btnBackDict').addEventListener('click',        goHome);

  // list actions
  $('inputName').addEventListener('input',   onNameInput);
  $('inputName').addEventListener('keydown', onNameKey);
  $('btnAdd').addEventListener('click',       addItem);
  $('btnClearDone').addEventListener('click', doClearDone);
  $('btnCopy').addEventListener('click',      doCopy);

  // dict
  $('btnDictAdd').addEventListener('click', addDictItem);
  $('dictName').addEventListener('keydown', e => { if (e.key === 'Enter') addDictItem(); });

  initFirebase();
}

document.addEventListener('DOMContentLoaded', init);
