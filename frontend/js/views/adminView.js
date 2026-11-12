// Admin View — Panel Profesional de Gestión y Operaciones para The Clothes Box.
// Shell of the admin panel: loads every admin dataset in one go, renders the header, the
// summary cards and the tab bar, and delegates the active tab to its module in views/admin/
// (registered in TCB.adminTabs). Tab modules get a context with the cached data, a reload
// function and a re-render function, so each tab can live in its own file.
window.TCB = window.TCB || {};
TCB.views = TCB.views || {};

TCB.views.admin = (() => {
  const { icon } = TCB.brand;
  const tabs = TCB.adminTabs;

  let activeTab = 'kpis'; // Unknown keys fall back to the boxes tab
  let cachedData = {
    metrics: null,
    boxes: [],
    clients: [],
    products: [],
    returns: [],
    feedback: [],
    outbox: [],
    cancellationReasons: null,
    payments: null,
    invoices: null,
    dispatch: null,
    kpis: null,
    dataRequests: null
  };

  async function loadAdminData() {
    try {
      const [metrics, boxesRes, clientsRes, productsRes, returnsRes, feedbackRes, outboxRes, cancellationReasons, payments, invoices, dispatch, kpis, dataRequests] = await Promise.all([
        TCB.api.admin.metrics(),
        TCB.api.admin.boxes(),
        TCB.api.admin.clients(),
        TCB.api.admin.products(),
        TCB.api.admin.returns(),
        TCB.api.admin.feedback(),
        TCB.api.admin.outbox(),
        TCB.api.admin.cancellationReasons(),
        TCB.api.admin.payments(),
        TCB.api.admin.invoices(),
        TCB.api.admin.dispatch(),
        TCB.api.admin.kpis(tabs.monthly.filter()),
        TCB.api.admin.dataRequests()
      ]);

      cachedData = {
        metrics,
        boxes: boxesRes.boxes || [],
        clients: clientsRes.clients || [],
        products: productsRes.products || [],
        returns: returnsRes.returns || [],
        feedback: feedbackRes.ratings || [],
        outbox: outboxRes.messages || [],
        cancellationReasons,
        payments,
        invoices,
        dispatch,
        kpis,
        dataRequests
      };
      return cachedData;
    } catch (e) {
      console.error('Error fetching admin data:', e);
      throw e;
    }
  }

  function render(store) {
    const user = store.user;

    // Control de acceso por rol en el frontend
    if (!user || user.role !== 'ADMIN') {
      return `
        <div class="screen wrap">
          <div class="banner banner--warn" style="max-width:560px;margin:var(--s-8) auto;text-align:center;padding:36px">
            ${icon('alert', 40)}
            <h2 class="display" style="font-size:var(--fs-2xl);margin-top:12px">Acceso Restringido a Operaciones</h2>
            <p class="muted" style="margin-top:8px">
              Esta sección requiere permisos de <strong>Administrador (ADMIN)</strong>. Los clientes no pueden consultar ni gestionar cajas de otros usuarios.
            </p>
            <div style="margin-top:24px;display:flex;gap:12px;justify-content:center">
              <button type="button" class="btn btn--gold" id="btn-login-as-admin">
                Iniciar sesión como Administrador
              </button>
              <a href="#/caja" class="btn btn--ghost">Volver a Mi Cuenta Cliente</a>
            </div>
          </div>
        </div>
      `;
    }

    const { metrics, boxes, clients, products, returns, feedback } = cachedData;

    return `
      <div class="screen wrap" style="max-width:1400px">
        <!-- ADMIN TOPBAR / HEADER -->
        <div style="background:var(--ink);color:var(--paper);padding:24px 32px;border-radius:var(--r-1);margin-bottom:var(--s-6);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
          <div>
            <div style="display:flex;align-items:center;gap:10px">
              <span class="badge" style="background:var(--brand-box);color:#fff;font-family:var(--font-mono);font-size:11px">ADMIN DASHBOARD</span>
              <span class="mono small" style="color:rgba(255,255,255,0.7)">The Clothes Box Operations v2.0</span>
            </div>
            <h1 class="display" style="font-size:var(--fs-2xl);color:var(--paper);margin-top:6px">Consola de Gestión y Curaduría</h1>
            <p style="color:rgba(255,255,255,0.8);font-size:var(--fs-sm)">Operador activo: <strong>${user.name}</strong> (${user.email})</p>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <button type="button" class="btn btn--sm btn--gold" id="btn-refresh-admin">
              ${icon('refresh', 14)} Actualizar Datos
            </button>
          </div>
        </div>

        <!-- KPI SUMMARY CARDS -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:16px;margin-bottom:var(--s-6)">
          <div style="background:var(--sheet);border:var(--line);padding:20px;border-radius:var(--r-1)">
            <p class="mono small muted">TIEMPO DEL QUIZ</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:6px;color:var(--ink)">${formatDuration(metrics?.quiz?.averageDurationSec)}</h3>
            <span class="small ${metrics?.quiz?.averageDurationSec > (metrics?.quiz?.targetSec || 180) ? 'text-warn' : 'muted'}">
              Meta ${formatDuration(metrics?.quiz?.targetSec || 180)} · ${metrics?.quiz?.completed || 0} completados
            </span>
          </div>
          <div style="background:var(--sheet);border:var(--line);padding:20px;border-radius:var(--r-1)">
            <p class="mono small muted">CLIENTES REGISTRADOS</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:6px;color:var(--ink)">${metrics?.totalClients || clients.length}</h3>
            <span class="small" style="color:var(--brand-box)">En Cali, Colombia</span>
          </div>
          <div style="background:var(--sheet);border:var(--line);padding:20px;border-radius:var(--r-1)">
            <p class="mono small muted">CAJAS EN PROCESO</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:6px;color:var(--ink)">${(metrics?.preparingBoxes || 0) + (metrics?.inTransitBoxes || 0)}</h3>
            <span class="small muted">${metrics?.preparingBoxes || 0} taller · ${metrics?.inTransitBoxes || 0} en reparto</span>
          </div>
          <div style="background:var(--sheet);border:var(--line);padding:20px;border-radius:var(--r-1)">
            <p class="mono small muted">CAJAS ENTREGADAS</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:6px;color:var(--ink)">${metrics?.deliveredBoxes || 0}</h3>
            <span class="small" style="color:#2a6e4b">Contenido revelado</span>
          </div>
          <div style="background:var(--sheet);border:var(--line);padding:20px;border-radius:var(--r-1)">
            <p class="mono small muted">DEVOLUCIONES POR TALLA</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:6px;color:var(--ink)">${metrics?.totalReturns || returns.length}</h3>
            <span class="small ${Number(metrics?.returnRate) > 15 ? 'text-warn' : 'muted'}">Tasa: ${metrics?.returnRate || '0.0'}%</span>
          </div>
          <div style="background:var(--sheet);border:var(--line);padding:20px;border-radius:var(--r-1)">
            <p class="mono small muted">SATISFACCIÓN PROMEDIO</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:6px;color:var(--ink)">★ ${metrics?.averageSatisfaction || '4.8'}</h3>
            <span class="small muted">Sobre 5 estrellas</span>
          </div>
          <div style="background:var(--sheet);border:var(--line);padding:20px;border-radius:var(--r-1)">
            <p class="mono small muted">CATÁLOGO NACIONAL</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:6px;color:var(--ink)">${products.length}</h3>
            <span class="small muted">${metrics?.brandsCount || 6} marcas aliadas</span>
          </div>
        </div>

        <!-- NAVEGACIÓN DE PESTAÑAS ADMINISTRATIVAS -->
        <div style="display:flex;gap:8px;border-bottom:2px solid var(--rule);margin-bottom:var(--s-6);overflow-x:auto;padding-bottom:2px">
          <button type="button" class="btn btn--quiet admin-tab ${activeTab === 'boxes' ? 'is-active' : ''}" data-tab="boxes">
            ${icon('box', 16)} Cajas & Despachos (${boxes.length})
          </button>
          <button type="button" class="btn btn--quiet admin-tab ${activeTab === 'clients' ? 'is-active' : ''}" data-tab="clients">
            ${icon('user', 16)} Clientes & Medidas (${clients.length})
          </button>
          <button type="button" class="btn btn--quiet admin-tab ${activeTab === 'products' ? 'is-active' : ''}" data-tab="products">
            ${icon('tag', 16)} Catálogo & Fotografías (${products.length})
          </button>
          <button type="button" class="btn btn--quiet admin-tab ${activeTab === 'returns' ? 'is-active' : ''}" data-tab="returns">
            ${icon('return', 16)} Devoluciones por Talla (${returns.length})
          </button>
          <button type="button" class="btn btn--quiet admin-tab ${activeTab === 'feedback' ? 'is-active' : ''}" data-tab="feedback">
            ${icon('star', 16)} Feedback de Estilo (${feedback.length})
          </button>
          <button type="button" class="btn btn--quiet admin-tab ${activeTab === 'cancellations' ? 'is-active' : ''}" data-tab="cancellations">
            Motivos de Cancelación (${cachedData.cancellationReasons ? cachedData.cancellationReasons.total : 0})
          </button>
          <button type="button" class="btn btn--quiet admin-tab ${activeTab === 'outbox' ? 'is-active' : ''}" data-tab="outbox">
            Bandeja de Salida (${cachedData.outbox.length})
          </button>
          <button type="button" class="btn btn--quiet admin-tab ${activeTab === 'monthly' ? 'is-active' : ''}" data-tab="monthly">
            KPIs del mes${cachedData.kpis && cachedData.kpis.churnAlert.active ? ' ⚠' : ''}
          </button>
          <button type="button" class="btn btn--quiet admin-tab ${activeTab === 'datarequests' ? 'is-active' : ''}" data-tab="datarequests">
            Solicitudes de datos (${cachedData.dataRequests ? cachedData.dataRequests.requests.length : 0})
          </button>
          <button type="button" class="btn btn--quiet admin-tab ${activeTab === 'dispatch' ? 'is-active' : ''}" data-tab="dispatch">
            Por despachar (${cachedData.dispatch ? cachedData.dispatch.boxes.length : 0})
          </button>
          <button type="button" class="btn btn--quiet admin-tab ${activeTab === 'payments' ? 'is-active' : ''}" data-tab="payments">
            Pagos
          </button>
          <button type="button" class="btn btn--quiet admin-tab ${activeTab === 'invoices' ? 'is-active' : ''}" data-tab="invoices">
            Facturación${cachedData.invoices && cachedData.invoices.openAlerts ? ` (${cachedData.invoices.openAlerts} alertas)` : ''}
          </button>
        </div>

        <!-- CONTENIDO DINÁMICO DE PESTAÑA -->
        ${renderTabContent()}
      </div>
    `;
  }

  function renderTabContent() {
    const tab = tabs[activeTab] || tabs.boxes;
    return tab.render(cachedData);
  }

  function formatDuration(sec) {
    if (!Number.isFinite(sec)) return '—';
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min`;
  }

  function rerender() {
    const container = document.getElementById('app-view');
    if (container) {
      container.innerHTML = render(TCB.state.get());
      mount(container);
    }
  }

  function mount(root) {
    // Sin sesión de administrador: abre el inicio de sesión normal (no hay credenciales en el frontend).
    root.querySelector('#btn-login-as-admin')?.addEventListener('click', () => {
      TCB.views.auth.openLoginModal(async role => {
        if (role !== 'ADMIN') {
          TCB.state.toast('Esa cuenta no tiene rol de Administrador.', { type: 'danger' });
          return;
        }
        await loadAdminData();
        rerender();
      });
    });

    // Actualizar datos
    root.querySelector('#btn-refresh-admin')?.addEventListener('click', async () => {
      try {
        await loadAdminData();
        rerender();
        TCB.state.toast('Panel administrativo actualizado.');
      } catch (e) {
        TCB.state.toast('Error al actualizar datos.', { type: 'danger' });
      }
    });

    // Pestañas
    root.querySelectorAll('.admin-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        rerender();
      });
    });

    const ctx = {
      get data() { return cachedData; },
      loadAdminData,
      rerender
    };
    Object.values(tabs).forEach(tab => tab.mount && tab.mount(root, ctx));
  }

  return {
    render,
    mount,
    loadAdminData
  };
})();
