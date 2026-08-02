import { catalogue } from './catalogue.js';

const KEY = 'spideyvault-v1';
const state = { filter: 'All', type: 'All', query: '', sort: 'name', selected: null };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { items: {}, updatedAt: null };
  } catch {
    return { items: {}, updatedAt: null };
  }
};

let userData = load();

const personal = item => userData.items[item.id] || {
  status: item.initialStatus || 'Need',
  purchasePrice: '',
  notes: '',
  customImageUrl: '',
  updatedAt: ''
};

const save = () => {
  userData.updatedAt = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(userData));
};

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const money = (number, currency = 'USD') => new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency,
  maximumFractionDigits: 0
}).format(Number(number) || 0);

const toast = message => {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 1800);
};

function merged() {
  return catalogue.map(item => ({ ...item, ...personal(item) }));
}

function imageUrl(item) {
  return item.customImageUrl || item.imageUrl || '';
}

function imageMarkup(item, size = 'card') {
  const url = imageUrl(item);
  const number = escapeHtml(item.number || 'SV');
  const alt = escapeHtml(`${item.name} ${item.variant || ''}`.trim());
  if (url) {
    const sourceClass = url.includes('pops.today/images/') ? ' keyed-white-bg' : '';
    return `<div class="pop-image ${size}${sourceClass}"><img src="${escapeHtml(url)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer" onload="this.closest('.pop-image').classList.add('has-image')" onerror="this.closest('.pop-image').classList.add('image-error');this.remove()"><div class="image-fallback"><span>${number}</span><strong>SPIDEY<br>VAULT</strong></div></div>`;
  }
  return `<div class="pop-image ${size}"><div class="image-fallback"><span>${number}</span><strong>SPIDEY<br>VAULT</strong></div></div>`;
}

function stats() {
  const all = merged();
  const owned = all.filter(item => item.status === 'Owned');
  const need = all.filter(item => item.status === 'Need');
  const incoming = all.filter(item => item.status === 'Incoming');
  return {
    total: all.length,
    owned: owned.length,
    need: need.length,
    incoming: incoming.length,
    value: owned.reduce((sum, item) => sum + (Number(item.estimatedValue) || 0), 0),
    spent: owned.reduce((sum, item) => sum + (Number(item.purchasePrice) || 0), 0)
  };
}

function renderStats() {
  const summary = stats();
  $('#stats').innerHTML = [
    ['Catalogue', summary.total, '▦'],
    ['Owned', summary.owned, '✓'],
    ['Incoming', summary.incoming, '→'],
    ['Est. value', money(summary.value), '◇']
  ].map(([label, value, icon]) => `<div class="stat"><span class="stat-icon">${icon}</span><strong>${value}</strong><span>${label}</span></div>`).join('');
  const percentage = summary.total ? Math.round(summary.owned / summary.total * 100) : 0;
  $('#progressBar').style.width = `${percentage}%`;
  $('#progressLabel').textContent = `${percentage}% complete`;
}

function card(item) {
  return `<button class="card" data-id="${item.id}">
    ${imageMarkup(item)}
    <div class="card-content">
      <div class="card-kicker"><span class="num">${escapeHtml(item.number || 'NO NUMBER')}</span><span class="type-mini">${escapeHtml(item.type)}</span></div>
      <h3>${escapeHtml(item.name)}</h3>
      <div class="meta">${escapeHtml(item.variant || 'Standard')}<br>${escapeHtml(item.line)}</div>
      <span class="status ${item.status}">${item.status}</span>
    </div>
  </button>`;
}

function renderRecent() {
  const updated = merged()
    .filter(item => item.updatedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);
  $('#recentGrid').innerHTML = updated.length
    ? updated.map(card).join('')
    : '<div class="panel empty-state"><div class="empty-icon">🕸</div><h2>Your vault is ready</h2><p>Open the catalogue and mark your first Pop as Owned or Incoming.</p></div>';
}

function filtered() {
  let items = merged();
  if (state.filter !== 'All') items = items.filter(item => item.status === state.filter);
  if (state.type !== 'All') items = items.filter(item => item.type === state.type);
  if (state.query) {
    const query = state.query.toLowerCase();
    items = items.filter(item => [item.name, item.character, item.number, item.line, item.variant, item.exclusive]
      .join(' ').toLowerCase().includes(query));
  }
  items.sort((a, b) => {
    if (state.sort === 'number') {
      const aNumber = parseInt(a.number?.replace(/\D/g, ''), 10);
      const bNumber = parseInt(b.number?.replace(/\D/g, ''), 10);
      return (Number.isNaN(aNumber) ? 999999 : aNumber) - (Number.isNaN(bNumber) ? 999999 : bNumber) || a.name.localeCompare(b.name);
    }
    if (state.sort === 'value-desc') return b.estimatedValue - a.estimatedValue;
    if (state.sort === 'updated') return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    return a.name.localeCompare(b.name);
  });
  return items;
}

function renderCatalogue() {
  const items = filtered();
  $('#resultCount').textContent = `${items.length} items`;
  $('#catalogueGrid').innerHTML = items.length
    ? items.map(card).join('')
    : '<div class="panel empty-state"><div class="empty-icon">⌕</div><h2>No matches</h2><p>Try changing the search or filters.</p></div>';
}

function openDetail(id) {
  const item = merged().find(entry => entry.id === id);
  state.selected = item.id;
  $('#detailContent').innerHTML = `<div class="detail">
    <div class="detail-top">
      <div><span class="pill">${escapeHtml(item.type)}</span><h2>${escapeHtml(item.name)}</h2><p class="meta">${escapeHtml(item.character)}</p></div>
      <button class="close" id="closeDialog" aria-label="Close">✕</button>
    </div>
    ${imageMarkup(item, 'detail-image')}
    <dl>
      <dt>Pop number</dt><dd>${escapeHtml(item.number || '—')}</dd>
      <dt>Line / set</dt><dd>${escapeHtml(item.line || '—')}</dd>
      <dt>Variant</dt><dd>${escapeHtml(item.variant || '—')}</dd>
      <dt>Exclusive</dt><dd>${escapeHtml(item.exclusive || '—')}</dd>
      <dt>Estimated value</dt><dd>${money(item.estimatedValue, item.valueCurrency)}</dd>
    </dl>
    <p class="eyebrow">COLLECTION STATUS</p>
    <div class="status-switch">${['Need', 'Owned', 'Incoming'].map(status => `<button data-set-status="${status}" class="${item.status === status ? 'active' : ''}">${status}</button>`).join('')}</div>
    <label class="field">Purchase price<input id="purchasePrice" type="number" inputmode="decimal" min="0" step="0.01" value="${escapeHtml(item.purchasePrice || '')}" placeholder="0.00"></label>
    <label class="field">Custom image URL <span class="field-hint">Optional</span><input id="customImageUrl" type="url" value="${escapeHtml(item.customImageUrl || '')}" placeholder="https://…"></label>
    <p class="helper-text">Use a direct image address. Leave blank to use the SpideyVault placeholder.</p>
    <label class="field">Personal notes<textarea id="personalNotes" placeholder="Condition, sticker, seller, autograph details…">${escapeHtml(item.notes || '')}</textarea></label>
    <button class="primary save" id="saveDetail">Save changes</button>
  </div>`;
  $('#detailDialog').showModal();
}

function setupTypes() {
  const types = [...new Set(catalogue.map(item => item.type))].sort();
  $('#typeFilter').innerHTML = '<option value="All">All types</option>' + types.map(type => `<option>${escapeHtml(type)}</option>`).join('');
}

function navigate(view) {
  $$('.view').forEach(element => element.classList.remove('active'));
  $(`#${view}View`).classList.add('active');
  $$('.nav-btn').forEach(element => element.classList.toggle('active', element.dataset.nav === view));
  if (view === 'catalogue') renderCatalogue();
  scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('click', event => {
  const navigation = event.target.closest('[data-nav]');
  if (navigation) navigate(navigation.dataset.nav);

  const selectedCard = event.target.closest('.card');
  if (selectedCard) openDetail(selectedCard.dataset.id);

  if (event.target.id === 'closeDialog') $('#detailDialog').close();

  if (event.target.dataset.setStatus) {
    $$('[data-set-status]').forEach(button => button.classList.toggle('active', button === event.target));
  }

  if (event.target.id === 'saveDetail') {
    const status = $('[data-set-status].active').dataset.setStatus;
    userData.items[state.selected] = {
      status,
      purchasePrice: $('#purchasePrice').value,
      customImageUrl: $('#customImageUrl').value.trim(),
      notes: $('#personalNotes').value,
      updatedAt: new Date().toISOString()
    };
    save();
    $('#detailDialog').close();
    renderAll();
    toast('Vault updated');
  }

  if (event.target.matches('#statusFilters .chip')) {
    $$('#statusFilters .chip').forEach(button => button.classList.remove('active'));
    event.target.classList.add('active');
    state.filter = event.target.dataset.status;
    renderCatalogue();
  }
});

$('#searchInput').addEventListener('input', event => { state.query = event.target.value; renderCatalogue(); });
$('#typeFilter').addEventListener('change', event => { state.type = event.target.value; renderCatalogue(); });
$('#sortSelect').addEventListener('change', event => { state.sort = event.target.value; renderCatalogue(); });

$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'SpideyVault', version: 2, exportedAt: new Date().toISOString(), data: userData }, null, 2)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `spideyvault-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  toast('Backup exported');
});

$('#importInput').addEventListener('change', async event => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    const backup = JSON.parse(await file.text());
    if (backup.app !== 'SpideyVault' || !backup.data?.items || typeof backup.data.items !== 'object') throw Error();
    if (!confirm('Import this backup and replace the collection data currently stored on this device?')) return;
    userData = backup.data;
    save();
    renderAll();
    toast('Backup restored');
  } catch {
    toast('Invalid backup file');
  } finally {
    event.target.value = '';
  }
});

$('#resetBtn').addEventListener('click', () => {
  if (confirm('Reset all local collection data?')) {
    userData = { items: {}, updatedAt: null };
    save();
    renderAll();
    toast('Vault reset');
  }
});

let deferredPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  $('#installBtn').classList.remove('hidden');
});

$('#installBtn').addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('#installBtn').classList.add('hidden');
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

function renderAll() {
  renderStats();
  renderRecent();
  renderCatalogue();
}

setupTypes();
renderAll();
