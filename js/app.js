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
let activeStore     = 'all';
let mode            = 'list';   // 'list' | 'shop' | 'dict'
let screen          = 'home';   // 'home' | 'app'
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
  ['connDot','connDot2'].forEach(id => {
    const d = $(id);
    if (d) d.style.background = ok ? '#22c55e' : '#e24b4a';
  });
  ['connLabel','connLabel2'].forEach(id => {
    const l = $(id);
    if (l) l.textContent = ok ? 'połączono' : 'łączenie…';
  });
}

// ─── Nawigacja ekranów ────────────────────────────────────────────────────────
function goHome() {
  screen = 'home';
  $('homeScreen').classList.remove('hidden');
  $('appScreen').classList.add('hidden');
  renderHome();
}

function goApp(targetMode) {
  screen = 'app';
  mode = targetMode ?? 'list';
  $('homeScreen').classList.add('hidden');
  $('appScreen').classList.remove('hidden');
  render();
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

// ─── Autocomplete ──────────────────────────────────────────────────────────────
function onNameInput() {
  const v = $('inputName').value;
  if (v.length > 1) $('inputCat').value = guessCat(v);
  renderAC(v);
}

function renderAC(q) {
  const dd    = $('acDrop');
  const suggs = getSuggestions(q, customDictItems);
  if (!suggs.length) { dd.style.display = 'none'; return; }
  dd.innerHTML = '';
  acIdx = -1;
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
  $('inputName').value = name;
  $('inputCat').value  = catId;
  $('acDrop').style.display = 'none';
  acIdx = -1;
}

function onNameKey(e) {
  const dd  = $('acDrop');
  const els = dd.querySelectorAll('.ac-item');
  if (e.key === 'ArrowDown')  { e.preventDefault(); acIdx = Math.min(acIdx + 1, els.length - 1); highlightAC(els); }
  else if (e.key === 'ArrowUp')    { e.preventDefault(); acIdx = Math.max(acIdx - 1, -1); highlightAC(els); }
  else if (e.key === 'Enter') {
    if (acIdx >= 0 && els[acIdx]) { e.preventDefault(); els[acIdx].dispatchEvent(new MouseEvent('mousedown')); }
    else { dd.style.display = 'none'; addItem(); }
  } else if (e.key === 'Escape') { dd.style.display = 'none'; acIdx = -1; }
}

function highlightAC(els) {
  els.forEach((e, i) => e.classList.toggle('ac-sel', i === acIdx));
}

document.addEventListener('click', e => {
  if (!e.target.closest('.name-wrap')) { $('acDrop').style.display = 'none'; acIdx = -1; }
});

// ─── Akcje ────────────────────────────────────────────────────────────────────
async function addItem() {
  const name = $('inputName').value.trim();
  if (!name) { $('inputName').focus(); return; }
  const item = {
    id: nextId, name,
    qty:   $('inputQty').value || '1',
    store: $('inputStore').value,
    cat:   $('inputCat').value,
    done:  false,
    addedAt: Date.now(),
  };
  nextId++;
  await saveMeta({ nextId });
  await saveItem(item);
  $('inputName').value = '';
  $('inputQty').value  = '1';
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
  const ok = exportToClipboard(items, activeStore);
  showToast(ok ? 'Lista skopiowana do schowka' : 'Brak produktów do skopiowania');
}

function setMode(m) {
  mode = m;
  $('btnList').classList.toggle('active', m === 'list');
  $('btnShop').classList.toggle('active', m === 'shop');
  $('listSection').classList.toggle('hidden', m !== 'list');
  $('shopSection').classList.toggle('hidden', m !== 'shop');
  render();
}

function setStore(id) {
  activeStore = id;
  render();
}

function filteredItems() {
  return activeStore === 'all' ? items : items.filter(i => i.store === activeStore);
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

async function doRemoveDictItem(name) {
  await removeDictItem(name);
}
window._removeDict = doRemoveDictItem;

// ─── Render: ekran główny ─────────────────────────────────────────────────────
function renderHome() {
  const rem   = items.filter(i => !i.done).length;
  const total = items.length;

  // liczniki per sklep
  const storeCounts = STORES.map(s => ({
    ...s,
    count: items.filter(i => i.store === s.id && !i.done).length,
  })).filter(s => s.count > 0);

  const pills = storeCounts.map(s =>
    `<span class="home-pill" style="background:${s.dot}22;color:${s.dot}">${s.label} ${s.count}</span>`
  ).join('');

  const now  = new Date();
  const days = ['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'];
  const months = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
  const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;

  $('homeDate').textContent   = dateStr;
  $('homeTileCount').textContent = rem;
  $('homeTileSub').textContent   = total > 0
    ? `${total} produktów łącznie`
    : 'Lista jest pusta';
  $('homePills').innerHTML = pills || `<span style="font-size:12px;opacity:.5">brak produktów</span>`;

  // dict count
  const dictTotal = customDictItems.length;
  $('homeDictSub').textContent = dictTotal > 0
    ? `${dictTotal} własnych wpisów`
    : 'brak własnych wpisów';
}

// ─── Render: store tabs ───────────────────────────────────────────────────────
function renderStoreTabs() {
  const el = $('storeTabs');
  el.innerHTML = '';
  [{ id: 'all', label: 'Wszystkie', dot: null }, ...STORES].forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'store-tab' + (activeStore === s.id ? ' active' : '');
    if (s.dot) {
      const dot = document.createElement('span');
      dot.className = 'store-dot';
      dot.style.background = s.dot;
      btn.appendChild(dot);
    }
    const rem = s.id === 'all'
      ? items.filter(i => !i.done).length
      : items.filter(i => i.store === s.id && !i.done).length;
    btn.appendChild(document.createTextNode(s.label + (rem > 0 ? ` (${rem})` : '')));
    btn.addEventListener('click', () => setStore(s.id));
    el.appendChild(btn);
  });
}

function renderSummary(fi) {
  const rem  = fi.filter(i => !i.done).length;
  const done = fi.filter(i =>  i.done).length;
  $('summaryStrip').innerHTML = `
    <div class="stat-pill"><div class="stat-val">${rem}</div><div class="stat-lbl">Do kupienia</div></div>
    <div class="stat-pill"><div class="stat-val">${done}</div><div class="stat-lbl">Kupione</div></div>
    <div class="stat-pill"><div class="stat-val">${fi.length}</div><div class="stat-lbl">Łącznie</div></div>`;
}

function renderList(fi) {
  const con = $('itemsList');
  if (!fi.length) {
    con.innerHTML = '<div class="empty-state"><i class="ti ti-clipboard-list" aria-hidden="true"></i>Lista jest pusta. Dodaj pierwszy produkt powyżej.</div>';
    return;
  }
  con.innerHTML = '';
  CATS.forEach(cat => {
    const arr = [...fi.filter(i => i.cat === cat.id)].sort((a, b) => Number(a.done) - Number(b.done));
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
        <button class="item-check ${item.done ? 'checked' : ''}" data-id="${item.id}" aria-label="${item.done ? 'Odznacz' : 'Oznacz jako kupione'}">
          <i class="ti ti-check" aria-hidden="true"></i>
        </button>
        <div class="item-body">
          <div class="item-name">${item.name}</div>
          <div class="item-meta">
            <span>${item.qty} szt.</span>
            <span class="store-pill" style="background:${store.bg};color:${store.fg}">${store.label}</span>
          </div>
        </div>
        <button class="btn-icon" data-del="${item.id}" aria-label="Usuń produkt"><i class="ti ti-trash" aria-hidden="true"></i></button>`;
      grp.appendChild(card);
    });
    con.appendChild(grp);
  });
  con.querySelectorAll('[data-id]').forEach(b  => b.addEventListener('click', () => toggleDone(+b.dataset.id)));
  con.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => doDeleteItem(+b.dataset.del)));
}

function renderShop(fi) {
  const undone = fi.filter(i => !i.done).length;
  const total  = fi.length;
  const pct    = total > 0 ? Math.round((total - undone) / total * 100) : 0;
  $('shopProgress').innerHTML = `
    <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
    <span class="progress-text">${total - undone} / ${total}</span>`;
  const con = $('shopList');
  if (!fi.length) { con.innerHTML = '<div class="empty-state"><i class="ti ti-clipboard-list" aria-hidden="true"></i>Lista jest pusta.</div>'; return; }
  if (!undone)    { con.innerHTML = '<div class="shop-done-banner"><i class="ti ti-circle-check" aria-hidden="true"></i>Wszystko kupione!</div>'; return; }
  con.innerHTML = '';
  CATS.forEach(cat => {
    const arr = [...fi.filter(i => i.cat === cat.id)].sort((a, b) => Number(a.done) - Number(b.done));
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
        <span class="shop-item-qty">${item.qty} szt.</span>`;
      div.addEventListener('click', () => toggleDone(item.id));
      grp.appendChild(div);
    });
    con.appendChild(grp);
  });
}

function renderDictTags() {
  const list = $('dictTagList');
  list.innerHTML = '';
  if (!customDictItems.length) {
    list.innerHTML = '<span style="font-size:12px;color:var(--text-3)">Brak własnych wpisów — dodaj poniżej</span>';
    return;
  }
  customDictItems.forEach(({ name, cat }) => {
    const catDef = CATS.find(c => c.id === cat) ?? CATS.at(-1);
    const tag    = document.createElement('span');
    tag.className = `dict-tag ${catDef.cls}`;
    tag.innerHTML = `${name} <button aria-label="Usuń ${name}" onclick="window._removeDict('${name.replace(/'/g, "\\'")}')">×</button>`;
    list.appendChild(tag);
  });
}

function render() {
  if (screen === 'home') { renderHome(); return; }
  renderStoreTabs();
  const fi = filteredItems();
  renderSummary(fi);
  renderList(fi);
  renderShop(fi);
  renderDictTags();
  $('btnList').classList.toggle('active', mode === 'list');
  $('btnShop').classList.toggle('active', mode === 'shop');
  $('listSection').classList.toggle('hidden', mode !== 'list');
  $('shopSection').classList.toggle('hidden', mode !== 'shop');
}

// ─── Firebase ─────────────────────────────────────────────────────────────────
function initFirebase() {
  setConnected(false);
  subscribeToData(({ type, items: newItems, customDict, meta }) => {
    setConnected(true);
    if (type === 'items')  { items           = newItems ?? []; }
    if (type === 'dict')   { customDictItems = customDict ?? []; }
    if (type === 'meta')   { nextId          = (meta?.nextId ?? 1); }
    render();
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  buildSelects();

  // home tiles
  $('tileList').addEventListener('click',  () => goApp('list'));
  $('tileShop').addEventListener('click',  () => goApp('shop'));
  $('tileDict').addEventListener('click',  () => {
    goApp('list');
    setTimeout(() => {
      const p = $('dictPanel');
      p.classList.remove('hidden');
      $('btnDictToggle').querySelector('i').className = 'ti ti-book-open';
      p.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  });

  // back button
  $('btnBack').addEventListener('click', goHome);

  // app controls
  $('inputName').addEventListener('input',   onNameInput);
  $('inputName').addEventListener('keydown', onNameKey);
  $('btnAdd').addEventListener('click',       addItem);
  $('btnList').addEventListener('click',      () => setMode('list'));
  $('btnShop').addEventListener('click',      () => setMode('shop'));
  $('btnClearDone').addEventListener('click', doClearDone);
  $('btnCopy').addEventListener('click',      doCopy);
  $('btnDictAdd').addEventListener('click',   addDictItem);
  $('dictName').addEventListener('keydown',   e => { if (e.key === 'Enter') addDictItem(); });
  $('btnDictToggle').addEventListener('click', () => {
    const p = $('dictPanel');
    p.classList.toggle('hidden');
    $('btnDictToggle').querySelector('i').className =
      p.classList.contains('hidden') ? 'ti ti-book' : 'ti ti-book-open';
  });

  initFirebase();
}

document.addEventListener('DOMContentLoaded', init);
