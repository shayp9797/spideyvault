import { catalogue } from './catalogue.js';

const KEY = 'spideyvault-v1';
const state = { filter: 'All', type: 'All', query: '', sort: 'name', world: 'All', selected: null, openOrigin: null, lastStats: null };
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
  updatedAt: '',
  grail: false,
  signed: false,
  signedBy: '',
  authentication: '',
  certificateNumber: ''
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

function displayImageUrl(url) {
  if (!url) return '';
  if (url.includes('pops.today/images/')) {
    const clean = url.replace(/^https?:\/\//, '');
    return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&output=png`;
  }
  return url;
}

window.handlePopImage = function handlePopImage(img) {
  const wrap = img.closest('.pop-image');
  if (wrap) wrap.classList.add('has-image');
  if (img.dataset.cleanBackground !== 'true' || img.dataset.cleaned === 'true') return;

  try {
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) return;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const frame = ctx.getImageData(0, 0, width, height);
    const pixels = frame.data;
    const seen = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;

    // Only remove neutral, very light pixels connected to the outside edge.
    // This preserves white eyes, webbing and suit details inside the figure.
    const bgScore = (index) => {
      const offset = index * 4;
      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      return { min, spread: max - min };
    };
    const isBackground = (index) => {
      const { min, spread } = bgScore(index);
      return min >= 224 && spread <= 22;
    };
    const add = (index) => {
      if (index < 0 || index >= width * height || seen[index] || !isBackground(index)) return;
      seen[index] = 1;
      queue[tail++] = index;
    };

    for (let x = 0; x < width; x += 1) {
      add(x);
      add((height - 1) * width + x);
    }
    for (let y = 0; y < height; y += 1) {
      add(y * width);
      add(y * width + width - 1);
    }

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      pixels[index * 4 + 3] = 0;
      if (x > 0) add(index - 1);
      if (x + 1 < width) add(index + 1);
      if (y > 0) add(index - width);
      if (y + 1 < height) add(index + width);
    }

    // Feather only the pale fringe touching removed background, avoiding a white halo.
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        const offset = index * 4;
        if (pixels[offset + 3] === 0) continue;
        const touchesClear =
          pixels[(index - 1) * 4 + 3] === 0 || pixels[(index + 1) * 4 + 3] === 0 ||
          pixels[(index - width) * 4 + 3] === 0 || pixels[(index + width) * 4 + 3] === 0;
        if (!touchesClear) continue;
        const { min, spread } = bgScore(index);
        if (min > 188 && spread < 38) {
          const alpha = Math.max(0, Math.min(255, Math.round((255 - min) * 4.2)));
          pixels[offset + 3] = Math.min(pixels[offset + 3], alpha);
          // Decontaminate pale edge colour so it blends naturally on the navy card.
          pixels[offset] = Math.max(0, pixels[offset] - Math.round((255 - alpha) * 0.22));
          pixels[offset + 1] = Math.max(0, pixels[offset + 1] - Math.round((255 - alpha) * 0.22));
          pixels[offset + 2] = Math.max(0, pixels[offset + 2] - Math.round((255 - alpha) * 0.22));
        }
      }
    }

    ctx.putImageData(frame, 0, 0);

    // Crop excess transparent space, then place the figure on a square transparent canvas.
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] > 14) {
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX >= minX && maxY >= minY) {
      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const pad = Math.round(Math.max(cropW, cropH) * 0.07);
      const side = Math.max(cropW, cropH) + pad * 2;
      const clean = document.createElement('canvas');
      clean.width = side;
      clean.height = side;
      const cleanCtx = clean.getContext('2d');
      cleanCtx.drawImage(canvas, minX, minY, cropW, cropH,
        Math.round((side - cropW) / 2), Math.round((side - cropH) / 2), cropW, cropH);
      img.dataset.cleaned = 'true';
      img.removeAttribute('crossorigin');
      img.src = clean.toDataURL('image/png');
    }
  } catch (error) {
    console.warn('SpideyVault could not clean this image background.', error);
  }
};

function imageMarkup(item, size = 'card') {
  const originalUrl = imageUrl(item);
  const url = displayImageUrl(originalUrl);
  const shouldClean = originalUrl.includes('pops.today/images/');
  const number = escapeHtml(item.number || 'SV');
  const alt = escapeHtml(`${item.name} ${item.variant || ''}`.trim());
  if (url) {
    return `<div class="pop-image ${size}"><img src="${escapeHtml(url)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer" ${shouldClean ? 'crossorigin="anonymous" data-clean-background="true"' : ''} onload="handlePopImage(this)" onerror="this.closest('.pop-image').classList.add('image-error');this.remove()"><div class="image-fallback"><span>${number}</span><strong>SPIDEY<br>VAULT</strong></div></div>`;
  }
  return `<div class="pop-image ${size}"><div class="image-fallback"><span>${number}</span><strong>SPIDEY<br>VAULT</strong></div></div>`;
}

const WORLDS = [
  { id: 'MCU', label: 'MCU', image: 'images/world-mcu.webp', position: '68% center', matcher: item => /Homecoming|Infinity War|Endgame|Far From Home|No Way Home|NWH Final Battle|Brand New Day/i.test(item.line || '') },
  { id: 'Spider-Verse', label: 'Spider-Verse', image: 'images/world-spiderverse.webp', position: '58% center', matcher: item => /Spider-Verse/i.test(item.line || '') },
  { id: 'Insomniac', label: 'Insomniac', image: 'images/world-insomniac.webp', position: '62% center', matcher: item => /Gamerverse|Marvel.?s Spider-Man|Spider-Man 1|Spider-Man 2|Miles Morales/i.test(item.line || '') },
  { id: 'Comic Covers', label: 'Comic Covers', image: 'images/world-comic-covers.webp', position: '55% 42%', matcher: item => /Comic Cover/i.test(`${item.type || ''} ${item.line || ''}`) },
  { id: 'Spider-Gwen', label: 'Spider-Gwen', image: 'images/world-spider-gwen.webp', position: '66% center', matcher: item => /Gwen|Ghost-Spider|Gwenom/i.test(`${item.character || ''} ${item.name || ''}`) },
  { id: 'Spider-Man 2099', label: 'Spider-Man 2099', image: 'images/world-spider-man-2099.webp', position: '62% center', matcher: item => /2099/i.test(`${item.character || ''} ${item.name || ''} ${item.variant || ''}`) }
];

function worldFor(id) {
  return WORLDS.find(world => world.id === id);
}

function matchesWorld(item, worldId) {
  if (!worldId || worldId === 'All') return true;
  return worldFor(worldId)?.matcher(item) ?? true;
}


function enterWorld(worldCard, worldId) {
  const world = worldFor(worldId);
  if (!world) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    state.world = worldId;
    navigate('catalogue');
    renderCatalogue({ animate: true });
    return;
  }

  const rect = worldCard.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.className = 'world-transition';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.setProperty('--world-x', `${rect.left}px`);
  overlay.style.setProperty('--world-y', `${rect.top}px`);
  overlay.style.setProperty('--world-w', `${rect.width}px`);
  overlay.style.setProperty('--world-h', `${rect.height}px`);
  overlay.style.setProperty('--world-image', `url("${world.image}")`);
  overlay.style.setProperty('--world-position', world.position || 'center');
  overlay.innerHTML = `<div class="world-transition-card"><span class="world-transition-art"></span><div class="world-transition-shade"></div><div class="world-transition-copy"><small>ENTERING WORLD</small><strong>${escapeHtml(world.label)}</strong><span>LOADING COLLECTION...</span></div><div class="world-transition-scan"></div></div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('world-transitioning');
  worldCard.classList.add('world-card-entering');

  requestAnimationFrame(() => overlay.classList.add('is-active'));

  window.setTimeout(() => {
    state.world = worldId;
    navigate('catalogue');
    renderCatalogue({ animate: true });
    overlay.classList.add('is-revealing');
  }, 520);

  window.setTimeout(() => {
    overlay.classList.add('is-exiting');
    document.body.classList.remove('world-transitioning');
    worldCard.classList.remove('world-card-entering');
  }, 760);

  window.setTimeout(() => overlay.remove(), 980);
}

function renderWorldFilter() {
  const bar = $('#activeWorldFilter');
  if (state.world === 'All') {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }
  bar.classList.remove('hidden');
  bar.innerHTML = `<span>WORLD FILTER: ${escapeHtml(state.world)}</span><button type="button" data-clear-world>Clear ×</button>`;
}

function dailyOwnedPick() {
  const owned = merged().filter(item => item.status === 'Owned');
  if (!owned.length) return null;
  const day = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (const char of day) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return owned[Math.abs(hash) % owned.length];
}

function renderDailySpotlight() {
  const item = dailyOwnedPick();
  const root = $('#dailySpotlight');
  if (!item) {
    root.innerHTML = `<div class="spotlight-empty"><span class="empty-pixel-icon">?</span><div><strong>NO VAULT PICK YET</strong><p>Mark your first Pop as Owned and tomorrow's spotlight will have something to show.</p></div></div>`;
    return;
  }
  root.innerHTML = `<button class="spotlight-card" data-open-id="${escapeHtml(item.id)}">
    <div class="spotlight-art">${imageMarkup(item, 'spotlight-image')}</div>
    <div class="spotlight-copy">
      <span class="eyebrow">TODAY'S VAULT PICK</span>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.number || 'No number')} · ${escapeHtml(item.line)}</p>
      <div class="spotlight-flags">${item.grail ? '<span>♛ GRAIL</span>' : ''}${item.signed ? '<span>✎ SIGNED</span>' : ''}</div>
      <em>OPEN CARD →</em>
    </div>
  </button>`;
}

function renderCollectionWorlds() {
  const all = merged();
  $('#collectionWorlds').innerHTML = WORLDS.map(world => {
    const items = all.filter(world.matcher);
    const owned = items.filter(item => item.status === 'Owned').length;
    const percent = items.length ? Math.round((owned / items.length) * 100) : 0;
    const remaining = Math.max(0, items.length - owned);
    return `<button class="world-card" data-world="${escapeHtml(world.id)}">
      <span class="world-art" aria-hidden="true" style="background-image:url('${escapeHtml(world.image)}');background-position:${escapeHtml(world.position || 'center')}"></span>
      <span class="world-copy">
        <strong>${escapeHtml(world.label)}</strong>
        <small>${owned} / ${items.length} owned</small>
      </span>
      <div class="world-progress"><i style="width:${percent}%"></i></div>
      <em>${remaining ? `${remaining} remaining` : 'WORLD COMPLETE'}</em>
    </button>`;
  }).join('');
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

function animateNumber(element, from, to, formatter = value => String(Math.round(value))) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || from === to) {
    element.textContent = formatter(to);
    return;
  }
  const start = performance.now();
  const duration = 520;
  const tick = now => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = formatter(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderStats() {
  const summary = stats();
  const previous = state.lastStats || { total: 0, owned: 0, incoming: 0, value: 0, percentage: 0 };
  const percentage = summary.total ? Math.round(summary.owned / summary.total * 100) : 0;
  const statRows = [
    ['Catalogue', summary.total, previous.total, '▦', value => String(Math.round(value))],
    ['Owned', summary.owned, previous.owned, '✓', value => String(Math.round(value))],
    ['Incoming', summary.incoming, previous.incoming, '→', value => String(Math.round(value))],
    ['Est. value', summary.value, previous.value, '◇', value => money(Math.round(value))]
  ];
  $('#stats').innerHTML = statRows.map(([label, value, from, icon], index) => `<div class="stat stat-enter" style="--stat-delay:${index * 55}ms"><span class="stat-icon">${icon}</span><strong data-stat-value></strong><span>${label}</span></div>`).join('');
  $$('[data-stat-value]').forEach((element, index) => {
    const [, value, from, , formatter] = statRows[index];
    animateNumber(element, from, value, formatter);
  });
  const bar = $('#progressBar');
  bar.style.width = `${previous.percentage || 0}%`;
  requestAnimationFrame(() => { bar.style.width = `${percentage}%`; });
  animateNumber($('#progressLabel'), previous.percentage || 0, percentage, value => `${Math.round(value)}% complete`);
  state.lastStats = { ...summary, percentage };
}

function card(item) {
  const markers = `${item.grail ? '<span class="card-marker grail" title="Grail">♛</span>' : ''}${item.signed ? '<span class="card-marker signed" title="Signed">✎</span>' : ''}`;
  return `<button class="card" data-id="${item.id}">
    <span class="card-markers">${markers}</span>
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
    : '<div class="panel empty-state"><div class="empty-icon">◌</div><h2>THE VAULT IS QUIET</h2><p>Open the catalogue and log your first collection update.</p></div>';
}

function filtered() {
  let items = merged();
  if (state.filter !== 'All') items = items.filter(item => item.status === state.filter);
  if (state.type !== 'All') items = items.filter(item => item.type === state.type);
  if (state.world !== 'All') items = items.filter(item => matchesWorld(item, state.world));
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

function renderCatalogue(options = {}) {
  const { animate = false } = options;
  const grid = $('#catalogueGrid');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const oldRects = new Map();
  if (animate && !reducedMotion) {
    grid.querySelectorAll('.card[data-id]').forEach(element => oldRects.set(element.dataset.id, element.getBoundingClientRect()));
  }
  const items = filtered();
  $('#resultCount').textContent = `${items.length} items`;
  renderWorldFilter();
  grid.innerHTML = items.length
    ? items.map(card).join('')
    : '<div class="panel empty-state"><div class="empty-icon">⌕</div><h2>SPIDER-SENSE FOUND NOTHING</h2><p>Try another search, world or filter combination.</p></div>';
  if (animate && !reducedMotion) {
    grid.querySelectorAll('.card[data-id]').forEach((element, index) => {
      const oldRect = oldRects.get(element.dataset.id);
      const newRect = element.getBoundingClientRect();
      if (oldRect) {
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        element.animate([
          { transform: `translate(${dx}px, ${dy}px) scale(.98)`, opacity: .72 },
          { transform: 'translate(0, 0) scale(1)', opacity: 1 }
        ], { duration: 360, delay: Math.min(index * 12, 120), easing: 'cubic-bezier(.2,.8,.2,1)' });
      } else {
        element.animate([
          { transform: 'translateY(14px) scale(.96)', opacity: 0 },
          { transform: 'translateY(0) scale(1)', opacity: 1 }
        ], { duration: 300, delay: Math.min(index * 16, 140), easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    });
  }
}

function showUnlockBurst(item) {
  const burst = document.createElement('div');
  const originalUrl = imageUrl(item);
  const resolvedUrl = displayImageUrl(originalUrl);
  const alt = escapeHtml(`${item.name} ${item.variant || ''}`.trim());
  const number = escapeHtml(item.number || 'SV');
  const image = resolvedUrl
    ? `<img class="unlock-figure" src="${escapeHtml(resolvedUrl)}" alt="${alt}" referrerpolicy="no-referrer">`
    : `<div class="unlock-fallback"><span>${number}</span><strong>SV</strong></div>`;

  burst.className = 'unlock-burst';
  burst.setAttribute('role', 'status');
  burst.setAttribute('aria-live', 'polite');
  burst.innerHTML = `
    <div class="unlock-comic-burst" aria-hidden="true"></div>
    <div class="unlock-particles" aria-hidden="true"></div>
    <div class="unlock-stage">
      <div class="unlock-card">
        <div class="unlock-scan" aria-hidden="true"></div>
        ${image}
        <span class="unlock-number">#${number}</span>
      </div>
      <div class="unlock-copy">
        <span>VAULT SCAN COMPLETE</span>
        <strong>POP UNLOCKED!</strong>
        <small>${escapeHtml(item.name)} joined your vault</small>
        <em>OWNED</em>
      </div>
    </div>`;
  document.body.appendChild(burst);
  requestAnimationFrame(() => burst.classList.add('show'));
  window.setTimeout(() => burst.classList.add('leave'), 1750);
  window.setTimeout(() => burst.remove(), 2000);
}

function makeFlipStage(sourceCard, startRect, endRect, reverse = false) {
  const clone = document.createElement('div');
  clone.className = `card-flip-stage ${reverse ? 'is-reverse' : ''}`;
  clone.style.left = `${startRect.left}px`;
  clone.style.top = `${startRect.top}px`;
  clone.style.width = `${startRect.width}px`;
  clone.style.height = `${startRect.height}px`;
  clone.innerHTML = `<div class="card-flip-inner"><div class="card-flip-front">${sourceCard.innerHTML}</div><div class="card-flip-back"><span class="flip-spider">SV</span><span>${reverse ? 'RETURNING TO VAULT' : 'OPENING VAULT'}</span></div></div>`;
  document.body.appendChild(clone);
  requestAnimationFrame(() => {
    clone.style.setProperty('--flip-x', `${endRect.left - startRect.left}px`);
    clone.style.setProperty('--flip-y', `${endRect.top - startRect.top}px`);
    clone.style.setProperty('--flip-scale-x', `${endRect.width / startRect.width}`);
    clone.style.setProperty('--flip-scale-y', `${endRect.height / startRect.height}`);
    clone.classList.add('is-flipping');
  });
  return clone;
}

function closeDetail({ reverse = true } = {}) {
  const dialog = $('#detailDialog');
  if (!dialog.open) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targetCard = state.openOrigin ? document.querySelector(`.card[data-id="${CSS.escape(state.openOrigin.id)}"]`) : null;
  if (!reverse || reducedMotion || !targetCard) {
    dialog.close();
    state.openOrigin = null;
    return;
  }
  const targetRect = targetCard.getBoundingClientRect();
  const dialogRect = dialog.getBoundingClientRect();
  const startRect = {
    left: dialogRect.left + dialogRect.width / 2 - targetRect.width / 2,
    top: dialogRect.top + Math.min(90, dialogRect.height * .16),
    width: targetRect.width,
    height: targetRect.height
  };
  dialog.close();
  const clone = makeFlipStage(targetCard, startRect, targetRect, true);
  window.setTimeout(() => clone.classList.add('is-fading'), 520);
  window.setTimeout(() => clone.remove(), 720);
  state.openOrigin = null;
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
    <div class="collector-flags">
      <label><input id="grailToggle" type="checkbox" ${item.grail ? 'checked' : ''}><span>♛ Mark as Grail</span></label>
      <label><input id="signedToggle" type="checkbox" ${item.signed ? 'checked' : ''}><span>✎ Signed copy</span></label>
    </div>
    <div id="signedFields" class="signed-fields ${item.signed ? '' : 'hidden'}">
      <label class="field">Signed by<input id="signedBy" type="text" value="${escapeHtml(item.signedBy || '')}" placeholder="Actor, creator or voice artist"></label>
      <label class="field">Authentication<input id="authentication" type="text" value="${escapeHtml(item.authentication || '')}" placeholder="Beckett, JSA, PSA…"></label>
      <label class="field">Certificate number<input id="certificateNumber" type="text" value="${escapeHtml(item.certificateNumber || '')}" placeholder="Optional"></label>
    </div>
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
  const current = $('.view.active');
  const next = $(`#${view}View`);
  if (current === next) return;
  current?.classList.add('view-leaving');
  window.setTimeout(() => {
    $$('.view').forEach(element => element.classList.remove('active', 'view-leaving', 'view-entering'));
    next.classList.add('active', 'view-entering');
    requestAnimationFrame(() => next.classList.remove('view-entering'));
  }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 110);
  $$('.nav-btn').forEach(element => element.classList.toggle('active', element.dataset.nav === view));
  if (view === 'catalogue') renderCatalogue({ animate: true });
  scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('click', event => {
  const navigation = event.target.closest('[data-nav]');
  if (navigation) navigate(navigation.dataset.nav);

  const spotlight = event.target.closest('[data-open-id]');
  if (spotlight) openDetail(spotlight.dataset.openId);

  const worldCard = event.target.closest('[data-world]');
  if (worldCard && !document.body.classList.contains('world-transitioning')) {
    enterWorld(worldCard, worldCard.dataset.world);
  }

  if (event.target.closest('[data-clear-world]')) {
    state.world = 'All';
    renderCatalogue({ animate: true });
  }

  if (event.target.id === 'signedToggle') {
    $('#signedFields').classList.toggle('hidden', !event.target.checked);
  }

  const selectedCard = event.target.closest('.card');
  if (selectedCard && !selectedCard.classList.contains('card-opening')) {
    const id = selectedCard.dataset.id;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.openOrigin = { id };
    if (reducedMotion) {
      openDetail(id);
    } else {
      selectedCard.classList.add('card-opening');
      const rect = selectedCard.getBoundingClientRect();
      const targetWidth = Math.min(360, window.innerWidth * .78);
      const targetHeight = Math.min(rect.height * 1.08, window.innerHeight * .58);
      const targetRect = {
        left: (window.innerWidth - targetWidth) / 2,
        top: Math.max(74, (window.innerHeight - targetHeight) / 2),
        width: targetWidth,
        height: targetHeight
      };
      const clone = makeFlipStage(selectedCard, rect, targetRect);
      window.setTimeout(() => {
        openDetail(id);
        clone.classList.add('is-fading');
      }, 500);
      window.setTimeout(() => {
        clone.remove();
        selectedCard.classList.remove('card-opening');
      }, 760);
    }
  }

  if (event.target.id === 'closeDialog') closeDetail();

  if (event.target.dataset.setStatus) {
    $$('[data-set-status]').forEach(button => button.classList.toggle('active', button === event.target));
  }

  if (event.target.id === 'saveDetail') {
    const status = $('[data-set-status].active').dataset.setStatus;
    const before = merged().find(item => item.id === state.selected);
    const currentPersonal = personal(before);
    userData.items[state.selected] = {
      ...currentPersonal,
      status,
      purchasePrice: $('#purchasePrice').value,
      customImageUrl: $('#customImageUrl').value.trim(),
      notes: $('#personalNotes').value,
      grail: $('#grailToggle').checked,
      signed: $('#signedToggle').checked,
      signedBy: $('#signedBy')?.value.trim() || '',
      authentication: $('#authentication')?.value.trim() || '',
      certificateNumber: $('#certificateNumber')?.value.trim() || '',
      updatedAt: new Date().toISOString()
    };
    save();
    closeDetail({ reverse: false });
    renderAll();
    const updated = merged().find(item => item.id === state.selected);
    if (status === 'Owned' && before?.status !== 'Owned') showUnlockBurst(updated);
    else toast('Vault updated');
  }

  if (event.target.matches('#statusFilters .chip')) {
    $$('#statusFilters .chip').forEach(button => button.classList.remove('active'));
    event.target.classList.add('active');
    state.filter = event.target.dataset.status;
    renderCatalogue({ animate: true });
  }
});

let searchTimer;
$('#searchInput').addEventListener('input', event => {
  state.query = event.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => renderCatalogue({ animate: true }), 90);
});
$('#typeFilter').addEventListener('change', event => { state.type = event.target.value; renderCatalogue({ animate: true }); });
$('#sortSelect').addEventListener('change', event => { state.sort = event.target.value; renderCatalogue({ animate: true }); });

const tiltEnabled = window.matchMedia('(hover:hover) and (pointer:fine)');
document.addEventListener('pointermove', event => {
  if (!tiltEnabled.matches) return;
  const cardElement = event.target.closest('.card[data-id]');
  if (!cardElement || cardElement.classList.contains('card-opening')) return;
  const rect = cardElement.getBoundingClientRect();
  const rx = ((event.clientY - rect.top) / rect.height - .5) * -7;
  const ry = ((event.clientX - rect.left) / rect.width - .5) * 9;
  cardElement.style.setProperty('--tilt-x', `${rx.toFixed(2)}deg`);
  cardElement.style.setProperty('--tilt-y', `${ry.toFixed(2)}deg`);
  cardElement.style.setProperty('--shine-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
  cardElement.style.setProperty('--shine-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
  cardElement.classList.add('is-tilting');
});
document.addEventListener('pointerout', event => {
  const cardElement = event.target.closest?.('.card[data-id]');
  if (!cardElement || cardElement.contains(event.relatedTarget)) return;
  cardElement.classList.remove('is-tilting');
  cardElement.style.removeProperty('--tilt-x');
  cardElement.style.removeProperty('--tilt-y');
});

$('#detailDialog').addEventListener('cancel', event => {
  event.preventDefault();
  closeDetail();
});

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
  renderDailySpotlight();
  renderCollectionWorlds();
  renderRecent();
  renderCatalogue();
}

setupTypes();
renderAll();
window.setTimeout(() => document.body.classList.add('app-ready'), 1050);
