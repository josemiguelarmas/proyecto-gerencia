// Reactive State and UI Utilities for The Clothes Box
window.TCB = window.TCB || {};

TCB.state = (() => {
  const store = {
    user: null,
    profile: null,
    currentBox: null,
    products: [],
    history: [],
    returns: []
  };

  const listeners = new Set();

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function emit() {
    listeners.forEach(fn => fn(store));
  }

  async function loadUserSession() {
    const token = TCB.api.getToken();
    if (!token) {
      store.user = null;
      store.profile = null;
      store.currentBox = null;
      emit();
      return null;
    }

    try {
      const data = await TCB.api.auth.me();
      store.user = data.user;
      store.profile = data.profile;

      // Load box
      const boxData = await TCB.api.boxes.current();
      store.currentBox = boxData.box;

      emit();
      return store.user;
    } catch (err) {
      console.warn('Session expired or invalid token');
      TCB.api.setToken(null);
      store.user = null;
      store.profile = null;
      store.currentBox = null;
      emit();
      return null;
    }
  }

  async function loadCatalog() {
    if (store.products.length > 0) return store.products;
    try {
      const products = await TCB.api.products.list();
      store.products = products;
      emit();
      return products;
    } catch (e) {
      console.error('Failed to load products:', e);
      return [];
    }
  }

  // Toasts
  let toastHost;
  function toast(message, { type = 'info', ms = 4000 } = {}) {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'toasts';
      document.body.appendChild(toastHost);
    }
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `
      <span>${message}</span>
      <button type="button" style="margin-left:auto;color:inherit;text-decoration:underline;">Cerrar</button>
    `;
    toastHost.appendChild(el);
    const kill = () => el.remove();
    el.querySelector('button').addEventListener('click', kill);
    setTimeout(kill, ms);
  }

  // Modals
  function modal({ title, eyebrow = '', body, foot = '', onMount }) {
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}
            <h2 style="font-size:var(--fs-2xl)">${title}</h2>
          </div>
          <button type="button" class="btn btn--quiet" data-close aria-label="Cerrar">${TCB.brand.icon('x', 22)}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
      </div>
    `;

    document.body.appendChild(scrim);
    document.body.style.overflow = 'hidden';

    function close() {
      scrim.remove();
      document.body.style.overflow = '';
    }

    scrim.addEventListener('click', e => {
      if (e.target === scrim || e.target.closest('[data-close]')) close();
    });

    if (onMount) onMount(scrim.querySelector('.modal'), close);
    return close;
  }

  return {
    get: () => store,
    set: updates => {
      Object.assign(store, updates);
      emit();
    },
    subscribe,
    loadUserSession,
    loadCatalog,
    toast,
    modal
  };
})();
