import { CATS, STORES } from './data.js';
import { loadState, saveState, exportToClipboard, clearDone } from './storage.js';
import { guessCat, getSuggestions } from './autocomplete.js';

// ─── Stan aplikacji ────────────────────────────────────────────────────────────
let state = loadState();
let acIdx = -1;

// ─── Pomocniki DOM ─────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const el = (tag, attrs = {}, children = []) => {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  });
  children.forEach(c => typeof c === 'string' ? e.append(c) : e.appendChild(c));
  return e;
};

// ─── Toasty ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
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
  if (v.length > 1) {
    const g = guessCat(v);
    $('inputCat').value = g;
  }
  renderAC(v);
}

function renderAC(q) {
  const dd = $('acDrop');
  const suggs = getSuggestions(q, state.customDictItems);
  if (!suggs.length) { dd.style.display = 'none'; return; }

  dd.innerHTML = '';
  acIdx = -1;
  suggs.forEach(([name, catId]) => {
    const cat = CATS.find(c => c.id === catId) ?? CATS.at(-1);
    const item = el('div', { class: 'ac-item', onmousedown: () => pickAC(name, catId) });
    item.innerHTML = `<span>${name}</span><span class="ac-cat-badge ${cat.cls}">${cat.label}</span>`;
    dd.appendChild(item);
  });
  dd.style.display = 'block';
}

function pickAC(name, catId) {
  $('inputName').value = name;
  $('inputCat').value = catId;
  $('acDrop').style.display = 'none';
  acIdx = -1;
}

function onNameKey(e) {
  const dd = $('acDrop');
  const items = dd.querySelectorAll('.ac-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    acIdx = Math.min(acIdx + 1, items.length - 1);
    highlightAC(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    acIdx = Math.max(acIdx - 1, -1);
    highlightAC(items);
  } else if (e.key === 'Enter') {
    if (acIdx >= 0 && items[acIdx]) { e.preventDefault(); items[acIdx].dispatchEvent(new MouseEvent('mousedown')); }
    else { dd.style.display = 'none'; addItem(); }
  } else if (e.key === 'Escape') {
    dd.style.display = 'none'; acIdx = -1;
  }
}

function highlightAC(els) {
  els.forEach((e, i) => e.classList.toggle('ac-sel', i === acIdx));
}

document.addEventListener('click', e => {
  if (!e.target.closest('.name-wrap')) { $('acDrop').style.display = 'none'; acIdx = -1; }
});

// ─── Dodaj produkt ─────────────────────────────────────────────────────────────
function addItem() {
  const name = $('inputName').value.trim();
  if (!name) { $('inputName').focus(); return; }
  const qty   = $('inputQty').value || '1';
  const store = $('inputStore').value;
  const cat   = $('inputCat').value;

  state.items.push({ id: state.nextId++, name, qty, store, cat, done: false });
  $('inputName').value = '';
  $('inputQty').value  = '1';
  $('acDrop').style.display = 'none';
  saveState(state);
  render();
  $('inputName').focus();
}

// ─── Przełącz status ──────────────────────────────────────────────────────────
function toggleDone(id) {
  const it = state.items.find(i => i.id === id);
  if (it) { it.done = !it.done; saveState(state); render(); }
}

// ─── Usuń produkt ─────────────────────────────────────────────────────────────
function deleteItem(id) {
  state.items = state.items.filter(i => i.id !== id);
  saveState(state);
  render();
}

// ─── Wyczyść kupione ──────────────────────────────────────────────────────────
function doClearDone() {
  const count = state.items.filter(i => i.done).length;
  if (!count) { showToast('Brak kupionych produktów'); return; }
  state = clearDone(state);
  saveState(state);
  render();
  showToast(`Usunięto ${count} ${count === 1 ? 'produkt' : 'produktów'}`);
}

// ─── Kopiuj listę ─────────────────────────────────────────────────────────────
function doCopy() {
  const ok = exportToClipboard(state.items, state.activeStore);
  showToast(ok ? 'Lista skopiowana do schowka' : 'Brak produktów do skopiowania');
}

// ─── Tryb ─────────────────────────────────────────────────────────────────────
function setMode(m) {
  state.mode = m;
  saveState(state);
  $('btnList').classList.toggle('active', m === 'list');
  $('btnShop').classList.toggle('active', m === 'shop');
  $('listSection').classList.toggle('hidden', m !== 'list');
  $('shopSection').classList.toggle('hidden', m !== 'shop');
  render();
}

// ─── Słownik użytkownika ───────────────────────────────────────────────────────
function addDictItem() {
  const name = $('dictName').value.trim();
  const cat  = $('dictCatSelect').value;
  if (!name) return;
  if (state.customDictItems.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    showToast('Ten produkt już jest w słowniku'); return;
  }
  state.customDictItems.push({ name, cat });
  $('dictName').value = '';
  saveState(state);
  renderDictTags();
  showToast(`Dodano „${name}" do słownika`);
}

function removeDictItem(name) {
  state.customDictItems = state.customDictItems.filter(c => c.name !== name);
  saveState(state);
  renderDictTags();
}

function renderDictTags() {
  const list = $('dictTagList');
  list.innerHTML = '';
  if (!state.customDictItems.length) {
    list.innerHTML = '<span style="font-size:12px;color:var(--text-3)">Brak własnych wpisów — dodaj poniżej</span>';
    return;
  }
  state.customDictItems.forEach(({ name, cat }) => {
    const catDef = CATS.find(c => c.id === cat) ?? CATS.at(-1);
    const tag = el('span', { class: `dict-tag ${catDef.cls}` });
    tag.innerHTML = `${name} <button aria-label="Usuń ${name}" onclick="window._removeDict('${name.replace(/'/g,"\\'")}')">×</button>`;
    list.appendChild(tag);
  });
}

// expose for inline onclick in dynamically created elements
window._removeDict = removeDictItem;

// ─── Aktywny sklep ────────────────────────────────────────────────────────────
function setStore(id) {
  state.activeStore = id;
  saveState(state);
  render();
}

function filteredItems() {
  return state.activeStore === 'all'
    ? state.items
    : state.items.filter(i => i.store === state.activeStore);
}

// ─── Render: store tabs ───────────────────────────────────────────────────────
function renderStoreTabs() {
  const el = $('storeTabs');
  el.innerHTML = '';
  const tabs = [{ id: 'all', label: 'Wszystkie', dot: null }, ...STORES];
  tabs.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'store-tab' + (state.activeStore === s.id ? ' active' : '');
    if (s.dot) {
      const dot = document.createElement('span');
      dot.className = 'store-dot';
      dot.style.background = s.dot;
      btn.appendChild(dot);
    }
    const rem = s.id === 'all'
      ? state.items.filter(i => !i.done).length
      : state.items.filter(i => i.store === s.id && !i.done).length;
    btn.textContent = s.label + (rem > 0 ? ` (${rem})` : '');
    btn.addEventListener('click', () => setStore(s.id));
    el.appendChild(btn);
  });
}

// ─── Render: summary strip ────────────────────────────────────────────────────
function renderSummary(fi) {
  const rem  = fi.filter(i => !i.done).length;
  const done = fi.filter(i =>  i.done).length;
  $('summaryStrip').innerHTML = `
    <div class="stat-pill"><div class="stat-val">${rem}</div><div class="stat-lbl">Do kupienia</div></div>
    <div class="stat-pill"><div class="stat-val">${done}</div><div class="stat-lbl">Kupione</div></div>
    <div class="stat-pill"><div class="stat-val">${fi.length}</div><div class="stat-lbl">Łącznie</div></div>`;
}

// ─── Render: lista ────────────────────────────────────────────────────────────
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

    const hdr = document.createElement('div');
    hdr.className = 'cat-header';
    const rem = arr.filter(i => !i.done).length;
    hdr.innerHTML = `<span class="cat-badge ${cat.cls}">${cat.label}</span><div class="cat-divider"></div><span class="cat-count">${rem}/${arr.length}</span>`;
    grp.appendChild(hdr);

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

  // delegacja zdarzeń
  con.querySelectorAll('[data-id]').forEach(b  => b.addEventListener('click',  () => toggleDone(+b.dataset.id)));
  con.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click',  () => deleteItem(+b.dataset.del)));
}

// ─── Render: tryb sklepu ──────────────────────────────────────────────────────
function renderShop(fi) {
  const undone = fi.filter(i => !i.done).length;
  const total  = fi.length;
  const pct    = total > 0 ? Math.round((total - undone) / total * 100) : 0;

  $('shopProgress').innerHTML = `
    <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
    <span class="progress-text">${total - undone} / ${total}</span>`;

  const con = $('shopList');
  if (!fi.length) {
    con.innerHTML = '<div class="empty-state"><i class="ti ti-clipboard-list" aria-hidden="true"></i>Lista jest pusta.</div>';
    return;
  }
  if (!undone) {
    con.innerHTML = '<div class="shop-done-banner"><i class="ti ti-circle-check" aria-hidden="true"></i>Wszystko kupione!</div>';
    return;
  }

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

// ─── Render: główny ───────────────────────────────────────────────────────────
function render() {
  renderStoreTabs();
  const fi = filteredItems();
  renderSummary(fi);
  renderList(fi);
  renderShop(fi);
  renderDictTags();

  // tryb widoku
  $('btnList').classList.toggle('active', state.mode === 'list');
  $('btnShop').classList.toggle('active', state.mode === 'shop');
  $('listSection').classList.toggle('hidden', state.mode !== 'list');
  $('shopSection').classList.toggle('hidden', state.mode !== 'shop');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  buildSelects();

  // eventy
  $('inputName').addEventListener('input',   onNameInput);
  $('inputName').addEventListener('keydown', onNameKey);
  $('btnAdd').addEventListener('click', addItem);
  $('btnList').addEventListener('click', () => setMode('list'));
  $('btnShop').addEventListener('click', () => setMode('shop'));
  $('btnClearDone').addEventListener('click', doClearDone);
  $('btnCopy').addEventListener('click', doCopy);
  $('btnDictAdd').addEventListener('click', addDictItem);
  $('dictName').addEventListener('keydown', e => { if (e.key === 'Enter') addDictItem(); });

  // sekcja słownika — toggle
  $('btnDictToggle').addEventListener('click', () => {
    const p = $('dictPanel');
    p.classList.toggle('hidden');
    $('btnDictToggle').querySelector('i').className = p.classList.contains('hidden')
      ? 'ti ti-book' : 'ti ti-book-open';
  });

  render();
}

document.addEventListener('DOMContentLoaded', init);
