// Main Application Router & Shell for The Clothes Box Full-Stack v2
window.TCB = window.TCB || {};

TCB.app = (() => {
  const { icon, logoSvg } = TCB.brand;

  const routes = {
    '#/': TCB.views.landing,
    '#/empezar': TCB.views.onboarding,
    '#/caja': TCB.views.box,
    '#/devoluciones': TCB.views.returns,
    '#/historial': TCB.views.history,
    '#/perfil': TCB.views.profile,
    '#/admin': TCB.views.admin
  };

  function renderAppbar(store) {
    const user = store.user;
    const currentHash = window.location.hash || '#/';
    const isAdmin = user && user.role === 'ADMIN';

    const appbarEl = document.getElementById('app-header');
    if (!appbarEl) return;

    appbarEl.innerHTML = `
      <div class="wrap" style="display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:64px">
        <!-- MARCA & LOGO -->
        <a href="#/" class="appbar-brand" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--ink)">
          ${logoSvg(34)}
          <div style="display:flex;flex-direction:column">
            <span style="font-family:var(--font-display);font-weight:700;font-size:var(--fs-lg);letter-spacing:-0.02em;line-height:1.1">
              The Clothes Box
            </span>
            ${isAdmin ? `<span class="mono" style="font-size:9px;font-weight:700;color:var(--brand-box);letter-spacing:0.1em">PANEL ADMINISTRATIVO</span>` : ''}
          </div>
        </a>

        <!-- NAVEGACIÓN PRINCIPAL (SEGMENTADA POR ROL) -->
        <nav class="appbar-nav" style="display:flex;align-items:center;gap:8px" aria-label="Navegación principal">
          ${isAdmin ? `
            <a class="nav-link ${currentHash.startsWith('#/admin') ? 'is-active' : ''}" href="#/admin" style="font-weight:700;color:var(--brand-box)">
              ${icon('shield', 15)} Panel de Operaciones
            </a>
            <a class="nav-link ${currentHash === '#/' ? 'is-active' : ''}" href="#/">
              Ver Landing
            </a>
            <a class="nav-link ${currentHash.startsWith('#/caja') ? 'is-active' : ''}" href="#/caja">
              Vista Cliente
            </a>
          ` : user ? `
            <a class="nav-link ${currentHash === '#/' ? 'is-active' : ''}" href="#/">Inicio</a>
            <a class="nav-link ${currentHash.startsWith('#/caja') ? 'is-active' : ''}" href="#/caja">
              ${icon('box', 15)} Mi Caja
              ${store.currentBox ? `<span class="indicator-dot"></span>` : ''}
            </a>
            <a class="nav-link ${currentHash.startsWith('#/devoluciones') ? 'is-active' : ''}" href="#/devoluciones">
              ${icon('return', 15)} Devoluciones por Talla
            </a>
            <a class="nav-link ${currentHash.startsWith('#/historial') ? 'is-active' : ''}" href="#/historial">
              Historial
            </a>
            <a class="nav-link ${currentHash.startsWith('#/perfil') ? 'is-active' : ''}" href="#/perfil">
              Mi Perfil
            </a>
          ` : `
            <a class="nav-link" href="#/">Inicio</a>
            <a class="nav-link" href="#estilo">Cómo Funciona</a>
            <a class="nav-link" href="#planes">Planes</a>
          `}
        </nav>

        <!-- ACCIONES DE USUARIO -->
        <div class="appbar-actions" style="display:flex;align-items:center;gap:12px">
          ${user ? `
            <div style="display:flex;align-items:center;gap:10px;background:var(--paper-2);border:var(--hair);padding:6px 14px;border-radius:var(--r-full)">
              <div style="width:24px;height:24px;border-radius:50%;background:${isAdmin ? 'var(--ink)' : 'var(--brand-box)'};color:#fff;display:grid;place-items:center;font-size:11px;font-weight:700">
                ${isAdmin ? 'A' : (user.name ? user.name.charAt(0).toUpperCase() : 'U')}
              </div>
              <div style="display:flex;flex-direction:column;line-height:1.1">
                <span style="font-size:var(--fs-xs);font-weight:700">${user.name ? user.name.split(' ')[0] : 'Usuario'}</span>
                <span class="mono" style="font-size:9px;color:var(--muted)">${user.role}</span>
              </div>
            </div>
            <button type="button" class="btn btn--quiet btn--sm" id="btn-logout" title="Cerrar sesión">
              Salir
            </button>
          ` : `
            <button type="button" class="btn btn--quiet btn--sm" id="btn-open-login">
              Ingresar
            </button>
            <a class="btn btn--gold btn--sm" href="#/empezar">
              Descubrir mi estilo ${icon('arrowR', 14)}
            </a>
          `}
        </div>
      </div>
    `;

    // Event listeners
    appbarEl.querySelector('#btn-open-login')?.addEventListener('click', () => {
      TCB.views.auth.openLoginModal(role => {
        if (role === 'ADMIN') {
          navigate('#/admin');
        } else {
          navigate(window.location.hash || '#/caja');
        }
      });
    });

    appbarEl.querySelector('#btn-logout')?.addEventListener('click', () => {
      TCB.api.auth.logout();
      TCB.state.set({ user: null, profile: null, currentBox: null });
      TCB.state.toast('Has cerrado sesión correctamente.');
      window.location.hash = '#/';
    });
  }

  async function navigate(hash) {
    const cleanHash = (hash || '#/').split('?')[0];
    const view = routes[cleanHash] || TCB.views.landing;

    const appView = document.getElementById('app-view');
    if (!appView) return;

    // Precargar datos si la vista lo requiere
    const user = TCB.state.get().user;

    if (cleanHash === '#/admin') {
      if (user && user.role === 'ADMIN' && TCB.views.admin.loadAdminData) {
        try {
          await TCB.views.admin.loadAdminData();
        } catch (e) {
          console.warn('Error loading admin data:', e);
        }
      }
    } else if (cleanHash === '#/devoluciones' && TCB.views.returns.loadReturnsData) {
      await TCB.views.returns.loadReturnsData();
    } else if (cleanHash === '#/historial' && TCB.views.history.loadHistoryData) {
      await TCB.views.history.loadHistoryData();
    }

    const store = TCB.state.get();

    // Renderizar
    appView.innerHTML = view.render(store);

    // Montar eventos
    if (view.mount) {
      view.mount(appView, store);
    }

    // Actualizar barra de navegación
    renderAppbar(store);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function init() {
    // 1. Cargar catálogo de marcas locales con fotos reales
    await TCB.state.loadCatalog();

    // 2. Cargar sesión de usuario si existe token
    const user = await TCB.state.loadUserSession();

    // 3. Suscribirse a cambios de estado para actualizar appbar
    TCB.state.subscribe(store => {
      renderAppbar(store);
    });

    // 4. Configurar listener de rutas
    window.addEventListener('hashchange', () => {
      navigate(window.location.hash);
    });

    // 5. Navegación inicial
    if (user && user.role === 'ADMIN' && (!window.location.hash || window.location.hash === '#/')) {
      window.location.hash = '#/admin';
    } else {
      navigate(window.location.hash || '#/');
    }
  }

  return { init, navigate };
})();

// Iniciar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  TCB.app.init();
});
