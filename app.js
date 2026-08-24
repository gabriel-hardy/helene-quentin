(async () => {
  'use strict';

  // ── Tabs ──────────────────────────────────────────────
  const tabs = document.querySelectorAll('.nav-tab');
  const panels = document.querySelectorAll('.panel');

  const mainHero = document.querySelector('.hero');
  const siteNav = document.querySelector('.site-nav');

  function activate(name, { scroll = true } = {}) {
    tabs.forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(p => {
      const on = p.id === `panel-${name}`;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
    if (mainHero) {
      mainHero.classList.toggle('is-hidden', name !== 'galerie');
    }
    if (siteNav) {
      siteNav.classList.toggle('is-scrolled', window.scrollY > 50);
      siteNav.classList.toggle('is-solid', false);
      siteNav.classList.toggle('is-boutique', name === 'boutique');
    }
    if (location.hash !== `#${name}`) {
      history.replaceState(null, '', `#${name}`);
    }
    if (scroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  tabs.forEach(t => t.addEventListener('click', () => activate(t.dataset.tab)));

  const initial = (location.hash || '').replace('#', '');
  if (['galerie', 'groupes', 'soiree', 'boutique'].includes(initial)) {
    activate(initial);
  }

  // ── Parallax hero + nav switch on scroll ──────────────
  const heroMedias = document.querySelectorAll('.hero-media, .panel-hero-media');

  function onScroll() {
    const y = window.scrollY;
    const vh = window.innerHeight;

    if (siteNav) {
      siteNav.classList.toggle('is-scrolled', y > 50);
    }

    heroMedias.forEach(media => {
      const hero = media.closest('.hero, .panel-hero');
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      // Skip heroes far outside the viewport for performance
      if (rect.bottom < -vh || rect.top > vh * 2) return;
      // Parallax A: background moves at 25% of scroll speed
      media.style.transform = `translateY(${rect.top * 0.25}px)`;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── Gallery loader ────────────────────────────────────
  const galleries = {
    galerie: { photos: [], el: document.getElementById('gallery'), empty: document.getElementById('gallery-empty') },
    selection: { photos: [], el: document.getElementById('gallery-selection'), empty: document.getElementById('gallery-selection-empty') },
    groupes: { photos: [], el: document.getElementById('gallery-groupes'), empty: document.getElementById('gallery-groupes-empty') },
    soiree: { photos: [], el: document.getElementById('gallery-soiree'), empty: document.getElementById('gallery-soiree-empty') }
  };
  const heroImg = document.getElementById('hero-img');
  let currentSet = 'galerie';

  async function loadGallery(set, url) {
    const g = galleries[set];
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('no manifest');
      const data = await res.json();
      g.photos = Array.isArray(data) ? data : (data.photos || []);
      g.photos = g.photos.map(p => typeof p === 'string' ? { src: p } : p);
    } catch {
      g.photos = [];
    }
    renderGallery(set);
  }

  // ── Progressive image loading ─────────────────────────
  // Load images visible in viewport + roughly one full screen in every direction,
  // so scrolling up or down feels smooth and empty slots fill quickly.
  const preloadMargin = Math.max(Math.round(window.innerHeight * 1.2), 800);
  const imageObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            mountItemImage(entry.target);
            imageObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: `${preloadMargin}px 0px ${preloadMargin}px 0px`, threshold: 0 })
    : null;

  function mountItemImage(item) {
    if (item.querySelector('img')) return;
    const set = item.dataset.set;
    const i = parseInt(item.dataset.index, 10);
    const photo = galleries[set] && galleries[set].photos[i];
    if (!photo) return;

    const img = document.createElement('img');
    // We decided to load it now; native lazy would postpone it when off-screen.
    img.loading = 'eager';
    img.decoding = 'async';
    img.src = photo.src;
    img.alt = photo.alt || '';
    img.addEventListener('load', () => img.classList.add('is-loaded'));
    item.insertBefore(img, item.firstChild);
  }

  function renderGallery(set) {
    const g = galleries[set];
    if (g.photos.length === 0) {
      g.empty.hidden = false;
      return;
    }
    g.empty.hidden = true;

    // Hero shot is fixed in HTML (galerie/GH-20260725-2208.jpg); do not override it
    // with the first gallery photo.

    const frag = document.createDocumentFragment();
    const observedItems = [];
    g.photos.forEach((photo, i) => {
      const item = document.createElement('div');
      item.className = 'gallery-item';
      item.role = 'button';
      item.tabIndex = 0;
      item.dataset.index = i;
      item.dataset.set = set;
      item.dataset.src = photo.src;
      item.setAttribute('aria-label', photo.alt || `Photo ${i + 1}`);

      const actions = document.createElement('div');
      actions.className = 'photo-actions';

      const fav = document.createElement('button');
      fav.className = 'fav-btn';
      fav.type = 'button';
      fav.dataset.index = i;
      fav.dataset.set = set;
      fav.setAttribute('aria-label', 'Ajouter aux coups de cœur');
      fav.setAttribute('aria-pressed', 'false');
      fav.innerHTML = '♡';
      fav.addEventListener('click', e => {
        e.stopPropagation();
        toggleFavorite(set, i);
      });

      actions.appendChild(fav);
      item.appendChild(actions);
      item.addEventListener('click', () => openLightbox(set, i));
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(set, i);
        }
      });

      frag.appendChild(item);
      observedItems.push(item);
    });
    g.el.appendChild(frag);

    // Observe only after items are in the DOM, otherwise IntersectionObserver won't fire.
    observedItems.forEach(item => {
      if (imageObserver) {
        imageObserver.observe(item);
      } else {
        mountItemImage(item);
      }
    });
  }

  // ── Lightbox refs (déclarées avant les favoris) ───────
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbCaption = document.getElementById('lb-caption');
  let current = 0;

  // ── Favorites / panier ─────────────────────────────────
  const FAV_KEY = 'hq_favorites_v1';
  let favorites = new Set();
  let lastAutoFill = '';

  function fileNameFromSrc(src) {
    return src.split('/').pop().split('?')[0];
  }

  function photoKey(src) {
    return src.split('?')[0];
  }

  function favoritePhotos() {
    return Array.from(favorites)
      .map(fileName => {
        const match = findFirstPhotoByFileName(fileName);
        return match ? galleries[match.set].photos[match.index] : null;
      })
      .filter(Boolean);
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function appendBytes(parts, bytes) {
    parts.push(bytes);
  }

  async function createFavoritesZip(photos) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const names = new Set();

    for (const photo of photos) {
      const response = await fetch(photo.src);
      if (!response.ok) continue;
      const data = new Uint8Array(await response.arrayBuffer());
      const originalName = fileNameFromSrc(photo.src);
      let name = originalName;
      let suffix = 2;
      while (names.has(name)) name = `${suffix++}-${originalName}`;
      names.add(name);

      const nameBytes = encoder.encode(name);
      const crc = crc32(data);
      const localHeader = new ArrayBuffer(30 + nameBytes.length);
      const localView = new DataView(localHeader);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, 0, true);
      localView.setUint16(12, 0, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, data.length, true);
      localView.setUint32(22, data.length, true);
      localView.setUint16(26, nameBytes.length, true);
      new Uint8Array(localHeader, 30).set(nameBytes);
      appendBytes(localParts, new Uint8Array(localHeader));
      appendBytes(localParts, data);

      const centralHeader = new ArrayBuffer(46 + nameBytes.length);
      const centralView = new DataView(centralHeader);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, 0, true);
      centralView.setUint16(14, 0, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, data.length, true);
      centralView.setUint32(24, data.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint32(42, offset, true);
      new Uint8Array(centralHeader, 46).set(nameBytes);
      appendBytes(centralParts, new Uint8Array(centralHeader));
      offset += 30 + nameBytes.length + data.length;
    }

    const centralDirectory = new Blob(centralParts);
    const localFiles = new Blob(localParts);
    const end = new ArrayBuffer(22);
    const endView = new DataView(end);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, names.size, true);
    endView.setUint16(10, names.size, true);
    endView.setUint32(12, centralDirectory.size, true);
    endView.setUint32(16, localFiles.size, true);
    return new Blob([localFiles, centralDirectory, end], { type: 'application/zip' });
  }

  async function downloadFavorites() {
    const photos = favoritePhotos();
    if (photos.length === 0) {
      alert('Aucun coup de cœur à télécharger.');
      return;
    }

    const zip = await createFavoritesZip(photos);
    const link = document.createElement('a');
    const url = URL.createObjectURL(zip);
    link.href = url;
    link.download = 'mes-favoris.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function favKey(set, i) {
    const photo = galleries[set] && galleries[set].photos[i];
    return photo ? photoKey(photo.src) : `${set}:${i}`;
  }

  function photoRef(set, i) {
    const photo = galleries[set] && galleries[set].photos[i];
    return photo ? `Photo ${fileNameFromSrc(photo.src)}` : `Photo ${i + 1}`;
  }

  function pruneFavorites() {
    const valid = new Set();
    const allPhotos = Object.values(galleries).flatMap(g => g.photos);
    const allPhotoKeys = new Set(allPhotos.map(p => photoKey(p.src)));
    favorites.forEach(key => {
      // Legacy format: "set:index"
      if (key.includes(':')) {
        const [set, idx] = key.split(':');
        const i = parseInt(idx, 10);
        const photo = galleries[set] && galleries[set].photos[i];
        if (photo) valid.add(photoKey(photo.src));
      } else if (allPhotoKeys.has(key)) {
        valid.add(key);
      } else {
        const photo = allPhotos.find(p => fileNameFromSrc(p.src) === key);
        if (photo) valid.add(photoKey(photo.src));
      }
    });
    favorites = valid;
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      data.forEach(item => {
        if (typeof item.src === 'string') {
          favorites.add(photoKey(item.src));
        } else if (item.set && Number.isInteger(item.index)) {
          favorites.add(favKey(item.set, item.index));
        }
      });
      pruneFavorites();
      saveFavorites();
    } catch {}
  }

  function saveFavorites() {
    pruneFavorites();
    const data = Array.from(favorites).map(fileName => ({ src: fileName }));
    localStorage.setItem(FAV_KEY, JSON.stringify(data));
  }

  function isFavorite(set, i) { return favorites.has(favKey(set, i)); }

  function toggleFavorite(set, i) {
    const key = favKey(set, i);
    if (favorites.has(key)) favorites.delete(key);
    else favorites.add(key);
    saveFavorites();
    syncFavUI();
  }

  function applyFavStates() {
    document.querySelectorAll('.fav-btn').forEach(btn => {
      const set = btn.dataset.set;
      const i = parseInt(btn.dataset.index, 10);
      const on = isFavorite(set, i);
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');;
      btn.innerHTML = on ? '♥' : '♡';
    });
    updateLightboxFav();
  }

  function updateFavCount() {
    const count = favorites.size;
    const badge = document.getElementById('fav-count');
    const icon = document.getElementById('nav-fav-icon');
    if (badge) badge.textContent = String(count);
    if (icon) icon.textContent = count > 0 ? '♥' : '♡';
  }

  function updateLightboxFav() {
    const btn = document.getElementById('lb-fav');
    if (!btn || lb.hidden) return;
    const on = isFavorite(currentSet, current);
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.innerHTML = on ? '♥' : '♡';
    btn.setAttribute('aria-label', on ? 'Retirer des coups de cœur' : 'Ajouter aux coups de cœur');
  }

  function findFirstPhotoByFileName(fileName) {
    for (const set of Object.keys(galleries)) {
      const idx = galleries[set].photos.findIndex(p =>
        photoKey(p.src) === fileName || fileNameFromSrc(p.src) === fileName
      );
      if (idx !== -1) return { set, index: idx };
    }
    return null;
  }

  function generateOrderText() {
    if (favorites.size === 0) return '';
    const lines = [];
    favorites.forEach(fileName => {
      const match = findFirstPhotoByFileName(fileName);
      if (!match) return;
      const { set, index } = match;
      lines.push(`${photoRef(set, index)} — `);
    });
    return lines.join('\n');
  }

  function updateOrderText() {
    const ta = document.getElementById('order-photos');
    if (!ta) return;
    const text = generateOrderText();
    if (ta.value === '' || ta.value === lastAutoFill) {
      ta.value = text;
      lastAutoFill = text;
    }
  }

  function syncFavUI() {
    updateFavCount();
    applyFavStates();
    updateOrderText();
    renderFavoritesPreview();
  }

  document.getElementById('nav-fav').addEventListener('click', () => {
    activate('boutique', { scroll: false });
    const favoritesPreview = document.getElementById('favorites-preview');
    if (favoritesPreview) {
      const navHeight = siteNav ? siteNav.offsetHeight : 0;
      const top = favoritesPreview.getBoundingClientRect().top + window.scrollY - navHeight - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });

  document.getElementById('nav-cart').addEventListener('click', () => {
    activate('boutique', { scroll: false });
    const cartPreview = document.getElementById('cart-preview');
    if (cartPreview) {
      const navHeight = siteNav ? siteNav.offsetHeight : 0;
      const top = cartPreview.getBoundingClientRect().top + window.scrollY - navHeight - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });

  function renderFavoritesPreview() {
    const grid = document.getElementById('favorites-preview-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (favorites.size === 0) {
      grid.innerHTML = '<p class="preview-empty">Aucun coup de cœur pour le moment.</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    favorites.forEach(fileName => {
      const match = findFirstPhotoByFileName(fileName);
      if (!match) return;
      const { set, index } = match;
      const photo = galleries[set].photos[index];
      frag.appendChild(createPreviewItem(set, index, photo, fileName, false));
    });
    grid.appendChild(frag);
  }

  function createPreviewItem(set, index, photo, fileName, isCart, line) {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', photo.alt || fileName);

    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = photo.alt || '';
    img.loading = 'lazy';
    img.addEventListener('load', () => img.classList.add('is-loaded'));
    item.appendChild(img);

    const info = document.createElement('div');
    info.className = 'preview-item-info';
    info.textContent = isCart ? line : photoRef(set, index);
    item.appendChild(info);

    const remove = document.createElement('button');
    remove.className = 'preview-remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', isCart ? 'Retirer du panier' : 'Retirer des coups de cœur');
    remove.innerHTML = '×';
    remove.addEventListener('click', e => {
      e.stopPropagation();
      if (isCart) removeFromCart(set, index, line);
      else toggleFavorite(set, index);
    });
    item.appendChild(remove);

    item.addEventListener('click', () => openLightbox(set, index));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(set, index);
      }
    });

    return item;
  }

  document.getElementById('lb-fav').addEventListener('click', e => {
    e.stopPropagation();
    toggleFavorite(currentSet, current);
  });

  document.getElementById('lb-cart').addEventListener('click', e => {
    e.stopPropagation();
    openFormatPicker(currentSet, current, document.getElementById('lb-cart'));
  });

  // ── Cart (panier) ─────────────────────────────────────
  const CART_KEY = 'hq_cart_v1';
  let cart = [];

  function cartKey(item) { return `${item.set}:${item.index}:${item.line}`; }

  function priceFromLine(line) {
    const map = {
      '10×15 cm papier': 5,
      '20×30 cm papier': 15,
      '30×45 cm papier': 25,
      '30×40 cm encadré': 119,
      '40×50 cm encadré': 159,
      '50×60 cm encadré': 209,
      '60×80 cm encadré': 259
    };
    for (const key of Object.keys(map)) {
      if (line.startsWith(key)) return map[key];
    }
    return 0;
  }

  function pruneCart() {
    cart = cart.filter(item => {
      const g = galleries[item.set];
      return g && g.photos[item.index];
    });
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      cart = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(cart)) cart = [];
      pruneCart();
    } catch {
      cart = [];
    }
  }

  function saveCart() {
    pruneCart();
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function addToCart(set, index, line) {
    const item = { set, index, line };
    const key = cartKey(item);
    if (!cart.some(it => cartKey(it) === key)) {
      cart.push(item);
      saveCart();
      syncCartUI();
    }
  }

  function removeFromCart(set, index, line) {
    const key = `${set}:${index}:${line}`;
    cart = cart.filter(it => cartKey(it) !== key);
    saveCart();
    syncCartUI();
  }

  function updateCartCount() {
    const count = cart.length;
    const badge = document.getElementById('cart-count');
    if (badge) badge.textContent = String(count);
  }

  function generateCartOrderText(includeIds = true) {
    if (cart.length === 0) return '';
    return cart.map(item => {
      const photo = galleries[item.set].photos[item.index];
      const id = photo ? fileNameFromSrc(photo.src).replace(/\.[^.]+$/, '') : '';
      const ref = photoRef(item.set, item.index);
      const price = priceFromLine(item.line);
      if (includeIds) {
        return `${ref} — ${id} — ${item.line} — ${price} €`;
      }
      return `${ref} — ${item.line} — ${price} €`;
    }).join('\n');
  }

  function cartTotal() {
    return cart.reduce((sum, item) => sum + priceFromLine(item.line), 0);
  }

  function updateOrderText() {
    const ta = document.getElementById('order-photos');
    const taFull = document.getElementById('order-photos-full');
    const totalInput = document.getElementById('order-total');
    const totalEl = document.getElementById('cart-total');
    const summary = document.getElementById('cart-summary');
    const text = generateCartOrderText(false);
    const textFull = generateCartOrderText(true);
    const total = cartTotal();
    if (ta) ta.value = text;
    if (taFull) taFull.value = textFull;
    if (totalInput) totalInput.value = `${total} €`;
    if (totalEl) totalEl.textContent = `${total} €`;
    if (summary) summary.hidden = cart.length === 0;
  }

  function syncCartUI() {
    updateCartCount();
    applyCartStates();
    updateOrderText();
    renderCartPreview();
  }

  function renderCartPreview() {
    const grid = document.getElementById('cart-preview-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (cart.length === 0) {
      grid.innerHTML = '<p class="cart-empty">Votre panier est vide.</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    cart.forEach(item => {
      const photo = galleries[item.set].photos[item.index];
      if (!photo) return;
      frag.appendChild(createCartItem(item.set, item.index, photo, item.line));
    });
    grid.appendChild(frag);
  }

  function createCartItem(set, index, photo, line) {
    const price = priceFromLine(line);
    const item = document.createElement('div');
    item.className = 'cart-item';

    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = photo.alt || '';
    img.loading = 'lazy';
    img.addEventListener('load', () => img.classList.add('is-loaded'));
    item.appendChild(img);

    const body = document.createElement('div');
    body.className = 'cart-item-body';

    const meta = document.createElement('div');
    meta.className = 'cart-item-meta';

    const ref = document.createElement('span');
    ref.className = 'cart-item-ref';
    ref.textContent = photoRef(set, index);
    meta.appendChild(ref);

    const format = document.createElement('span');
    format.className = 'cart-item-format';
    format.textContent = line;
    meta.appendChild(format);

    body.appendChild(meta);

    const priceEl = document.createElement('strong');
    priceEl.className = 'cart-item-price';
    priceEl.textContent = `${price} €`;
    body.appendChild(priceEl);

    item.appendChild(body);

    const remove = document.createElement('button');
    remove.className = 'cart-item-remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Retirer du panier');
    remove.innerHTML = '×';
    remove.addEventListener('click', () => removeFromCart(set, index, line));
    item.appendChild(remove);

    item.addEventListener('click', e => {
      if (e.target.closest('.cart-item-remove')) return;
      openLightbox(set, index);
    });

    return item;
  }

  function applyCartStates() {
    document.querySelectorAll('.cart-btn').forEach(btn => {
      const set = btn.dataset.set;
      const i = parseInt(btn.dataset.index, 10);
      const inCart = cart.some(it => it.set === set && it.index === i);
      btn.classList.toggle('is-active', inCart);
    });
    updateLightboxCart();
  }

  function updateLightboxCart() {
    const btn = document.getElementById('lb-cart');
    if (!btn || lb.hidden) return;
    const inCart = cart.some(it => it.set === currentSet && it.index === current);
    btn.classList.toggle('is-active', inCart);
  }

  // ── Format picker ─────────────────────────────────────
  const picker = document.getElementById('format-picker');
  const frameColor = document.getElementById('frame-color');
  const frameMargin = document.getElementById('frame-margin');
  const frameFinish = document.getElementById('frame-finish');
  const paperFinish = document.getElementById('paper-finish');
  const pickerConfirm = document.getElementById('format-picker-confirm');
  let pickerTarget = null;
  let pickerFormat = null;

  function formatLine(base) {
    if (base.includes('encadré')) {
      const color = frameColor.value;
      const finish = frameFinish ? frameFinish.value : 'satiné';
      const margin = frameMargin.checked ? 'avec marge' : 'sans marge';
      return `${base} ${color} · ${finish} · ${margin}`;
    }
    if (base.includes('papier') && paperFinish) {
      return `${base} ${paperFinish.value}`;
    }
    return base;
  }

  function updatePickerSelection() {
    picker.querySelectorAll('.format-options button[data-format]').forEach(btn => {
      btn.classList.toggle('is-selected', btn.dataset.format === pickerFormat);
    });
    if (pickerConfirm) pickerConfirm.disabled = !pickerFormat;
  }

  function openFormatPicker(set, index, anchor) {
    pickerTarget = { set, index };
    pickerFormat = null;
    updatePickerSelection();
    picker.hidden = false;
    positionPicker(anchor);
  }

  function closeFormatPicker() {
    picker.hidden = true;
    pickerTarget = null;
    pickerFormat = null;
    updatePickerSelection();
  }

  function positionPicker(anchor) {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const pickerRect = picker.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - pickerRect.width / 2;
    let top = rect.bottom + 10;
    if (left + pickerRect.width > window.innerWidth - 12) left = window.innerWidth - pickerRect.width - 12;
    if (left < 12) left = 12;
    if (top + pickerRect.height > window.innerHeight - 12) top = rect.top - pickerRect.height - 10;
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
  }

  picker.querySelectorAll('.format-options button[data-format]').forEach(btn => {
    btn.addEventListener('click', () => {
      pickerFormat = btn.dataset.format;
      updatePickerSelection();
    });
  });

  pickerConfirm.addEventListener('click', () => {
    if (!pickerTarget || !pickerFormat) return;
    addToCart(pickerTarget.set, pickerTarget.index, formatLine(pickerFormat));
    closeFormatPicker();
  });

  document.getElementById('format-picker-close').addEventListener('click', closeFormatPicker);
  picker.addEventListener('click', e => { if (e.target === picker) closeFormatPicker(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !picker.hidden) closeFormatPicker(); });

  await Promise.all([
    loadGallery('galerie', './photos.json'),
    loadGallery('selection', './photos-selection.json'),
    loadGallery('groupes', './photos-groupes.json'),
    loadGallery('soiree', './photos-soiree.json')
  ]);
  loadFavorites();
  loadCart();
  syncFavUI();
  syncCartUI();

  // ── Lightbox ──────────────────────────────────────────
  function openLightbox(set, i) {
    currentSet = set;
    current = i;
    lb.hidden = false;
    lb.setAttribute('aria-hidden', 'false');
    updateLightbox();
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lb.hidden = true;
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function updateLightbox() {
    const photos = galleries[currentSet].photos;
    if (!photos[current]) return;
    lbImg.src = photos[current].src;
    lbImg.alt = photos[current].alt || '';
    const caption = document.getElementById('lb-caption-text');
    if (caption) caption.textContent = photoRef(currentSet, current);
    updateLightboxFav();
  }

  function next() { current = (current + 1) % galleries[currentSet].photos.length; updateLightbox(); }
  function prev() { current = (current - 1 + galleries[currentSet].photos.length) % galleries[currentSet].photos.length; updateLightbox(); }

  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  document.getElementById('lb-next').addEventListener('click', next);
  document.getElementById('lb-prev').addEventListener('click', prev);
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });

  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
  });

  // ── Order form (Web3Forms) ────────────────────────────
  const orderForm = document.getElementById('order-form');
  const orderEmail = document.getElementById('order-email');
  const orderReplyTo = document.getElementById('order-replyto');
  const orderStatus = document.getElementById('order-status');
  const orderQuote = document.getElementById('order-quote');
  const orderQuoteCustomerName = document.getElementById('order-quote-customer-name');
  const orderQuoteCustomerEmail = document.getElementById('order-quote-customer-email');
  const orderQuoteCustomerAddress = document.getElementById('order-quote-customer-address');
  const orderQuoteDate = document.getElementById('order-quote-date');
  const orderQuoteItems = document.getElementById('order-quote-items');
  const orderQuoteTotal = document.getElementById('order-quote-total');
  const orderQuotePrint = document.getElementById('order-quote-print');

  function renderOrderQuote(customer, orderItems, total) {
    if (!orderQuote || !orderQuoteCustomerName || !orderQuoteCustomerEmail || !orderQuoteCustomerAddress || !orderQuoteDate || !orderQuoteItems || !orderQuoteTotal) return;
    orderQuoteCustomerName.textContent = customer.name;
    orderQuoteCustomerEmail.textContent = customer.email;
    orderQuoteCustomerAddress.textContent = customer.address;
    orderQuoteDate.textContent = new Intl.DateTimeFormat('fr-FR').format(new Date());
    orderQuoteItems.innerHTML = '';
    orderItems.forEach(item => {
      const row = document.createElement('div');
      row.className = 'order-quote-item';
      row.innerHTML = `<span>${item.reference} — ${item.line}</span><strong>${item.price} €</strong>`;
      orderQuoteItems.appendChild(row);
    });
    orderQuoteTotal.textContent = `${total} €`;
    orderQuote.hidden = false;
  }

  async function downloadOrderQuote(customer, orderItems, total) {
    if (!window.PDFLib) {
      if (orderStatus) orderStatus.textContent += ' Le téléchargement du devis est momentanément indisponible.';
      return;
    }

    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.15, 0.13, 0.10);
    const muted = rgb(0.38, 0.34, 0.30);
    const light = rgb(0.90, 0.90, 0.90);
    const margin = 36;
    const right = page.getWidth() - margin;
    const draw = (text, x, y, size = 10, font = regular, color = ink) => {
      page.drawText(String(text), { x, y, size, font, color });
    };
    const drawRight = (text, y, size = 10, font = regular, color = ink) => {
      const value = String(text);
      draw(value, right - font.widthOfTextAtSize(value, size), y, size, font, color);
    };
    const date = new Intl.DateTimeFormat('fr-FR').format(new Date());

    draw('DEVIS RECAPITULATIF', margin, 790, 18, bold);
    draw('Gabriel Hardy', margin, 738, 12, bold);
    draw('2 rue Philippe de Beaumanoir', margin, 721);
    draw('78540 Vernouillet', margin, 706);
    draw('Siret : 879 734 366 00013', margin, 686, 10, bold);
    drawRight(customer.name, 738, 12, bold);
    customer.address.split(/\r?\n/).forEach((line, index) => drawRight(line, 721 - index * 15));
    drawRight(customer.email, 721 - customer.address.split(/\r?\n/).length * 15, 10, regular, muted);

    page.drawRectangle({ x: margin, y: 615, width: 275, height: 30, color: light });
    page.drawRectangle({ x: margin + 275, y: 615, width: 248, height: 30, borderColor: light, borderWidth: 1 });
    draw('Jour de facturation', margin + 38, 625, 10, bold);
    draw(date, margin + 350, 625, 10, bold);

    const tableTop = 565;
    const tableHeight = 28 + Math.max(orderItems.length, 1) * 28;
    page.drawRectangle({ x: margin, y: tableTop, width: 523, height: 28, color: light });
    page.drawRectangle({ x: margin, y: tableTop - tableHeight, width: 523, height: tableHeight, borderColor: light, borderWidth: 1 });
    page.drawLine({ start: { x: 455, y: tableTop + 28 }, end: { x: 455, y: tableTop - tableHeight }, thickness: 1, color: light });
    draw('Description', margin + 190, tableTop + 9, 10, bold);
    draw('Prix total HT', 474, tableTop + 9, 10, bold);
    orderItems.forEach((item, index) => {
      const y = tableTop - 20 - index * 28;
      draw(`${item.reference} - ${item.line}`, margin + 10, y, 9);
      drawRight(`${item.price.toFixed(2).replace('.', ',')} EUR`, y, 9, bold);
    });

    draw('IBAN : FR76 1870 7001 8631 1196 2828 269', margin, 170, 10, regular, muted);
    draw('BIC : CCBPFRPPVER', margin, 154, 10, regular, muted);
    page.drawRectangle({ x: 330, y: 150, width: 150, height: 30, color: light });
    page.drawRectangle({ x: 480, y: 150, width: 79, height: 30, borderColor: light, borderWidth: 1 });
    draw('Total HT', 380, 160, 10, bold);
    drawRight(`${total.toFixed(2).replace('.', ',')} EUR`, 160, 10, regular);
    draw('TVA non applicable, art. 293B du CGI', 205, 56, 10, regular, muted);
    draw('Paiement par virement bancaire pour valider votre commande, IBAN ci-dessus,', 205, 40, 9, regular, muted);
    draw('ou par SMS au 06 52 53 64 70.', 205, 27, 9, regular, muted);

    const bytes = await pdf.save();
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `devis-d'impression-${date.replaceAll('/', '-')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (orderQuotePrint) orderQuotePrint.addEventListener('click', () => window.print());

  if (orderForm) {
    orderForm.addEventListener('submit', async e => {
      e.preventDefault();
      const orderItems = cart.map(item => ({
        reference: photoRef(item.set, item.index),
        line: item.line,
        price: priceFromLine(item.line)
      }));
      const orderTotal = cartTotal();
      const customer = {
        name: document.getElementById('order-name').value,
        email: orderEmail.value,
        address: document.getElementById('order-address').value
      };
      if (orderReplyTo) orderReplyTo.value = orderEmail.value;

      // Ensure the hidden field always contains the full order with photo IDs
      const taFull = document.getElementById('order-photos-full');
      if (taFull) taFull.value = generateCartOrderText(true);

      const submitBtn = orderForm.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : 'Envoyer la commande';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi en cours…';
      }
      if (orderStatus) orderStatus.textContent = '';

      try {
        const formData = new FormData(orderForm);
        const response = await fetch(orderForm.action, {
          method: 'POST',
          body: formData
        });
        const data = await response.json();

        if (response.ok && data.success) {
          if (orderStatus) orderStatus.textContent = 'Commande envoyée ! Votre devis a été téléchargé. Vous recevrez un email de confirmation si l’autorépondeur Web3Forms est activé.';
          renderOrderQuote(customer, orderItems, orderTotal);
          await downloadOrderQuote(customer, orderItems, orderTotal);
          orderForm.reset();
          cart.length = 0;
          saveCart();
          syncCartUI();
        } else {
          throw new Error(data.message || 'Erreur lors de l\'envoi.');
        }
      } catch (err) {
        if (orderStatus) orderStatus.textContent = `Erreur : ${err.message}. Vérifiez votre clé Web3Forms.`;
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  // ── Download favorites ───────────────────────────────
  const downloadBtn = document.getElementById('nav-download');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadFavorites);
  }

})();
