// Brand Partner Portal View (HU-19, SCRUM-114..118)
// Panel exclusivo para marcas aliadas colombianas:
// - SCRUM-115: Aislamiento estricto de datos por marca (rol BRAND o ADMIN)
// - SCRUM-116: Gestión de stock por variante y carga masiva de catálogo en CSV con validación de ámbito
// - SCRUM-117: Reportes consolidados de ventas (COP mayorista/detal), devoluciones por talla y calificaciones
// - SCRUM-118: Monitoreo de alertas de stock bajo y agotados
window.TCB = window.TCB || {};
TCB.views = TCB.views || {};

TCB.views.brand = (() => {
  const { icon } = TCB.brand;
  const cop = n => `COP ${Number(n || 0).toLocaleString('es-CO')}`;

  let cachedProducts = null;
  let cachedReports = null;
  let cachedAlerts = null;
  let activeTab = 'inventory'; // 'inventory' | 'reports' | 'alerts' | 'import'

  async function loadBrandData() {
    const [productsRes, reportsRes, alertsRes] = await Promise.all([
      TCB.api.brand.products(),
      TCB.api.brand.reports(),
      TCB.api.brand.alerts()
    ]);
    cachedProducts = productsRes;
    cachedReports = reportsRes;
    cachedAlerts = alertsRes;
    return { cachedProducts, cachedReports, cachedAlerts };
  }

  function render(store) {
    const user = store.user;
    if (!user || (user.role !== 'BRAND' && user.role !== 'ADMIN')) {
      return `
        <div class="screen wrap">
          <div class="banner banner--warn" style="max-width:560px;margin:var(--s-8) auto;text-align:center;padding:36px">
            ${icon('alert', 40)}
            <h2 class="display" style="font-size:var(--fs-2xl);margin-top:12px">Acceso para Marcas Aliadas</h2>
            <p class="muted" style="margin-top:8px">
              Esta sección está restringida a los representantes de <strong>marcas aliadas colombianas</strong> (rol BRAND) o administradores.
            </p>
            <div style="margin-top:24px;display:flex;gap:12px;justify-content:center">
              <button type="button" class="btn btn--gold" id="btn-login-as-brand">
                Iniciar sesión como Marca Aliada
              </button>
              <a href="#/" class="btn btn--ghost">Volver al Inicio</a>
            </div>
          </div>
        </div>
      `;
    }

    const brandName = cachedProducts?.brandName || user.brandName || user.brandId || 'Marca Aliada';
    const products = cachedProducts?.products || [];
    const sales = cachedReports?.sales || {};
    const returns = cachedReports?.returns || {};
    const ratings = cachedReports?.ratings || {};
    const alerts = cachedAlerts?.alerts || [];

    return `
      <div class="screen wrap" style="max-width:1400px">
        <!-- HEADER PORTAL DE MARCA -->
        <div style="background:var(--ink);color:var(--paper);padding:24px 32px;border-radius:var(--r-1);margin-bottom:var(--s-6);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
          <div>
            <div style="display:flex;align-items:center;gap:10px">
              <span class="badge" style="background:var(--brand-box);color:#fff;font-family:var(--font-mono);font-size:11px">PORTAL DE MARCA ALIADA</span>
              <span class="mono small" style="color:rgba(255,255,255,0.7)">Aislamiento Estricto Activo</span>
            </div>
            <h1 class="display" style="font-size:var(--fs-2xl);color:var(--paper);margin-top:6px">${brandName}</h1>
            <p style="color:rgba(255,255,255,0.8);font-size:var(--fs-sm)">
              Usuario: <strong>${user.name}</strong> (${user.email}) · Rol: <code>${user.role}</code>
            </p>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <button type="button" class="btn btn--sm btn--gold" id="btn-refresh-brand">
              ${icon('refresh', 14)} Actualizar Datos
            </button>
          </div>
        </div>

        <!-- TARJETAS DE RESUMEN KPI -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:16px;margin-bottom:var(--s-6)">
          <div style="background:var(--sheet);border:var(--line);padding:20px;border-radius:var(--r-1)">
            <p class="mono small muted">REFERENCIAS EN CATÁLOGO</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:6px;color:var(--ink)">${products.length}</h3>
            <span class="small muted">Prendas publicadas</span>
          </div>
          <div style="background:var(--sheet);border:var(--line);padding:20px;border-radius:var(--r-1)">
            <p class="mono small muted">UNIDADES ENTREGADAS</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:6px;color:var(--ink)">${sales.deliveredItems || 0}</h3>
            <span class="small" style="color:#2a6e4b">En cajas completadas</span>
          </div>
          <div style="background:var(--sheet);border:var(--line);padding:20px;border-radius:var(--r-1)">
            <p class="mono small muted">INGRESOS MAYORISTAS</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:6px;color:var(--brand-box)">${cop(sales.wholesaleRevenueCOP || 0)}</h3>
            <span class="small muted">Liquidado a la marca</span>
          </div>
          <div style="background:var(--sheet);border:var(--line);padding:20px;border-radius:var(--r-1)">
            <p class="mono small muted">TASA DE DEVOLUCIÓN</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:6px;color:var(--ink)">${returns.returnRatePct || 0}%</h3>
            <span class="small ${returns.returnRatePct > 15 ? 'text-warn' : 'muted'}">${returns.returnedItems || 0} devoluciones</span>
          </div>
          <div style="background:var(--sheet);border:var(--line);padding:20px;border-radius:var(--r-1)">
            <p class="mono small muted">CALIFICACIÓN DE CALCE</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:6px;color:var(--ink)">${ratings.averageFitScore ? `★ ${ratings.averageFitScore}` : '—'}</h3>
            <span class="small muted">${ratings.totalRatings || 0} valoraciones de clientes</span>
          </div>
          <div style="background:var(--sheet);border:var(--line);padding:20px;border-radius:var(--r-1)">
            <p class="mono small muted">ALERTAS DE STOCK</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:6px;color:${alerts.length > 0 ? '#b02a37' : 'var(--ink)'}">${alerts.length}</h3>
            <span class="small ${alerts.length > 0 ? 'text-warn' : 'muted'}">Variantes bajo mínimo</span>
          </div>
        </div>

        <!-- NAVEGACIÓN DE PESTAÑAS -->
        <div style="display:flex;gap:8px;border-bottom:2px solid var(--rule);margin-bottom:var(--s-6);overflow-x:auto;padding-bottom:2px">
          <button type="button" class="btn btn--quiet brand-tab ${activeTab === 'inventory' ? 'is-active' : ''}" data-tab="inventory">
            ${icon('tag', 16)} Inventario y Stock (${products.length})
          </button>
          <button type="button" class="btn btn--quiet brand-tab ${activeTab === 'import' ? 'is-active' : ''}" data-tab="import">
            Carga Masiva CSV
          </button>
          <button type="button" class="btn btn--quiet brand-tab ${activeTab === 'reports' ? 'is-active' : ''}" data-tab="reports">
            Ventas y Devoluciones
          </button>
          <button type="button" class="btn btn--quiet brand-tab ${activeTab === 'alerts' ? 'is-active' : ''}" data-tab="alerts">
            Alertas de Stock Bajo (${alerts.length})
          </button>
        </div>

        <!-- CONTENIDO DE PESTAÑA -->
        <div id="brand-tab-content">
          ${renderTab(activeTab, { products, sales, returns, ratings, alerts, brandName })}
        </div>
      </div>
    `;
  }

  function renderTab(tab, { products, sales, returns, ratings, alerts, brandName }) {
    if (tab === 'inventory') {
      return renderInventoryTab(products);
    }
    if (tab === 'import') {
      return renderImportTab(brandName);
    }
    if (tab === 'reports') {
      return renderReportsTab({ sales, returns, ratings });
    }
    if (tab === 'alerts') {
      return renderAlertsTab(alerts);
    }
    return '';
  }

  function renderInventoryTab(products) {
    if (!products.length) {
      return `<p class="muted" style="padding:24px">No tienes productos registrados en tu catálogo.</p>`;
    }
    return `
      <div style="background:var(--sheet);border:var(--line);border-radius:var(--r-1);overflow:hidden">
        <div style="padding:16px 20px;border-bottom:var(--hair);background:var(--paper-2);display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:var(--fs-sm)">Control de Stock por Variante (HU-19, SCRUM-116)</strong>
          <span class="small muted">Modifica el stock en tiempo real y guarda por variante</span>
        </div>
        <div style="overflow-x:auto">
          <table class="table" style="width:100%;font-size:var(--fs-sm);margin:0">
            <thead>
              <tr>
                <th>Prenda</th>
                <th>Categoría</th>
                <th>Precio Detal</th>
                <th>Talla</th>
                <th>Color</th>
                <th>SKU</th>
                <th>Stock Actual</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${products.flatMap(p => (p.variants || []).map(v => `
                <tr data-product-id="${p.id}" data-size="${v.size}" data-color="${v.color || ''}">
                  <td>
                    <strong>${p.name}</strong>
                    <div class="mono small muted" style="font-size:11px">${p.id}</div>
                  </td>
                  <td>${p.category}</td>
                  <td class="mono">${cop(p.priceCOP)}</td>
                  <td><span class="badge badge--neutral">${v.size}</span></td>
                  <td>${v.color || 'Único'}</td>
                  <td class="mono small">${v.sku || `${p.id}-${v.size}`}</td>
                  <td>
                    <input type="number" min="0" value="${v.stock}" class="input input--sm mono stock-input" style="width:75px">
                  </td>
                  <td>
                    <button type="button" class="btn btn--sm btn--gold btn-save-stock">
                      Guardar
                    </button>
                  </td>
                </tr>
              `)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderImportTab(brandName) {
    return `
      <div style="max-width:700px;background:var(--sheet);border:var(--line);padding:28px;border-radius:var(--r-1)">
        <h3 class="display" style="font-size:var(--fs-xl);margin-bottom:8px">Carga Masiva de Catálogo (CSV)</h3>
        <p class="small muted" style="margin-bottom:16px">
          Sube tu inventario mediante un archivo CSV. Por seguridad e integridad (SCRUM-116), todas las filas deben pertenecer a <strong>${brandName}</strong>. Intentar cargar prendas de otra marca será bloqueado.
        </p>

        <form id="brand-csv-form" class="stack" style="--stack:16px">
          <div class="field">
            <label for="brand-csv-text">Pegar contenido CSV:</label>
            <textarea id="brand-csv-text" class="input mono" rows="8" placeholder="marca,nombre,categoria,precio_cop,talla,color,stock,estilos&#10;${brandName},Camiseta Pesada 240g,TOP,85000,M,Negro,12,MINIMALISTA;URBANO"></textarea>
          </div>
          <div class="field">
            <label for="brand-csv-file">O seleccionar archivo .csv:</label>
            <input type="file" id="brand-csv-file" accept=".csv,text/csv">
          </div>
          <div id="brand-csv-feedback"></div>
          <div style="display:flex;gap:10px">
            <button type="submit" class="btn btn--gold" id="btn-submit-csv">Procesar e Importar CSV</button>
          </div>
        </form>
      </div>
    `;
  }

  function renderReportsTab({ sales, returns, ratings }) {
    return `
      <div class="grid" style="--cols:repeat(auto-fit, minmax(320px, 1fr));gap:24px">
        <!-- REPORTE DE VENTAS -->
        <div style="background:var(--sheet);border:var(--line);padding:24px;border-radius:var(--r-1)">
          <h3 class="display" style="font-size:var(--fs-lg);margin-bottom:14px">Liquidación de Ventas</h3>
          <div class="stack" style="--stack:12px">
            <div style="display:flex;justify-content:space-between;border-bottom:var(--hair);padding-bottom:8px">
              <span class="small">Prendas despachadas y entregadas</span>
              <strong class="mono">${sales.deliveredItems || 0} unidades</strong>
            </div>
            <div style="display:flex;justify-content:space-between;border-bottom:var(--hair);padding-bottom:8px">
              <span class="small">Valor detal estimado a clientes</span>
              <strong class="mono">${cop(sales.retailSalesCOP || 0)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:4px">
              <span class="small"><strong>Ingresos mayoristas netos</strong></span>
              <strong class="mono" style="color:var(--brand-box);font-size:var(--fs-md)">${cop(sales.wholesaleRevenueCOP || 0)}</strong>
            </div>
          </div>
        </div>

        <!-- REPORTE DE DEVOLUCIONES -->
        <div style="background:var(--sheet);border:var(--line);padding:24px;border-radius:var(--r-1)">
          <h3 class="display" style="font-size:var(--fs-lg);margin-bottom:14px">Devoluciones por Talla y Motivo</h3>
          <p class="small muted" style="margin-bottom:10px">Total prendas devueltas: <strong>${returns.returnedItems || 0}</strong> (Tasa: ${returns.returnRatePct || 0}%)</p>
          
          <h4 style="font-size:var(--fs-xs);font-weight:700;margin-top:12px;margin-bottom:6px" class="mono muted">POR TALLA:</h4>
          <div class="stack" style="--stack:6px">
            ${Object.entries(returns.bySize || {}).length ? Object.entries(returns.bySize).map(([size, count]) => `
              <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm)">
                <span>Talla ${size}</span>
                <span class="mono">${count}</span>
              </div>
            `).join('') : '<p class="small muted">Sin devoluciones registradas.</p>'}
          </div>

          <h4 style="font-size:var(--fs-xs);font-weight:700;margin-top:14px;margin-bottom:6px" class="mono muted">POR MOTIVO:</h4>
          <div class="stack" style="--stack:6px">
            ${Object.entries(returns.byReason || {}).length ? Object.entries(returns.byReason).map(([reason, count]) => `
              <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm)">
                <span>${reason}</span>
                <span class="mono">${count}</span>
              </div>
            `).join('') : '<p class="small muted">Sin motivos registrados.</p>'}
          </div>
        </div>

        <!-- REPORTE DE SATISFACCIÓN -->
        <div style="background:var(--sheet);border:var(--line);padding:24px;border-radius:var(--r-1)">
          <h3 class="display" style="font-size:var(--fs-lg);margin-bottom:14px">Calificaciones de Prendas</h3>
          <p class="small muted" style="margin-bottom:14px">Basado en ${ratings.totalRatings || 0} calificaciones de clientes.</p>
          <div class="stack" style="--stack:12px">
            <div style="display:flex;justify-content:space-between;border-bottom:var(--hair);padding-bottom:8px">
              <span class="small">Puntuación promedio de calce/talla</span>
              <strong class="mono">${ratings.averageFitScore ? `★ ${ratings.averageFitScore} / 5` : 'Sin datos'}</strong>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span class="small">Puntuación promedio de estilo/gusto</span>
              <strong class="mono">${ratings.averageStyleScore ? `★ ${ratings.averageStyleScore} / 5` : 'Sin datos'}</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAlertsTab(alerts) {
    if (!alerts.length) {
      return `
        <div class="banner banner--success" style="max-width:600px;padding:24px">
          ${icon('check', 24)}
          <h4 style="font-size:var(--fs-md);margin-top:6px">Inventario Saludable</h4>
          <p class="small muted" style="margin-top:4px">Ninguna variante de tu catálogo se encuentra por debajo del umbral de alerta.</p>
        </div>
      `;
    }

    return `
      <div style="background:var(--sheet);border:var(--line);border-radius:var(--r-1);overflow:hidden">
        <div style="padding:16px 20px;border-bottom:var(--hair);background:#fff3cd;display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:var(--fs-sm);color:#664d03">Alertas de Stock Bajo y Agotados (HU-19, SCRUM-118)</strong>
          <span class="badge" style="background:#dc3545;color:#fff">${alerts.length} alertas</span>
        </div>
        <div style="overflow-x:auto">
          <table class="table" style="width:100%;font-size:var(--fs-sm);margin:0">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Prenda</th>
                <th>Categoría</th>
                <th>Talla</th>
                <th>Color</th>
                <th>Stock Actual</th>
                <th>SKU</th>
              </tr>
            </thead>
            <tbody>
              ${alerts.map(a => `
                <tr>
                  <td>
                    <span class="badge ${a.status === 'OUT_OF_STOCK' ? 'badge--danger' : 'badge--warn'}">
                      ${a.status === 'OUT_OF_STOCK' ? 'AGOTADO' : 'STOCK BAJO'}
                    </span>
                  </td>
                  <td><strong>${a.productName}</strong></td>
                  <td>${a.category}</td>
                  <td><span class="badge badge--neutral">${a.size}</span></td>
                  <td>${a.color || 'Único'}</td>
                  <td class="mono"><strong>${a.currentStock}</strong></td>
                  <td class="mono small">${a.sku}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function rerender() {
    const container = document.getElementById('app-view');
    if (container) {
      container.innerHTML = render(TCB.state.get());
      mount(container);
    }
  }

  function mount(root) {
    root.querySelector('#btn-login-as-brand')?.addEventListener('click', () => {
      TCB.views.auth.openLoginModal(async role => {
        if (role !== 'BRAND' && role !== 'ADMIN') {
          TCB.state.toast('Esta cuenta no pertenece a una marca aliada.', { type: 'danger' });
          return;
        }
        await loadBrandData();
        rerender();
      });
    });

    root.querySelector('#btn-refresh-brand')?.addEventListener('click', async () => {
      try {
        await loadBrandData();
        rerender();
        TCB.state.toast('Datos de marca actualizados.');
      } catch (e) {
        TCB.state.toast('Error al actualizar datos.', { type: 'danger' });
      }
    });

    // Pestañas
    root.querySelectorAll('.brand-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        rerender();
      });
    });

    // Guardar stock inline
    root.querySelectorAll('.btn-save-stock').forEach(btn => {
      btn.addEventListener('click', async e => {
        const tr = e.target.closest('tr');
        const productId = tr.getAttribute('data-product-id');
        const size = tr.getAttribute('data-size');
        const color = tr.getAttribute('data-color') || undefined;
        const stock = parseInt(tr.querySelector('.stock-input').value, 10);

        if (isNaN(stock) || stock < 0) {
          TCB.state.toast('Ingresa una cantidad de stock válida.', { type: 'danger' });
          return;
        }

        try {
          await TCB.api.brand.updateStock(productId, { size, color, stock });
          TCB.state.toast(`Stock actualizado para talla ${size}.`);
          await loadBrandData();
          rerender();
        } catch (err) {
          TCB.state.toast(err.data?.error || err.message, { type: 'danger' });
        }
      });
    });

    // Carga de CSV
    const csvForm = root.querySelector('#brand-csv-form');
    if (csvForm) {
      const fileInput = root.querySelector('#brand-csv-file');
      const textInput = root.querySelector('#brand-csv-text');
      const feedback = root.querySelector('#brand-csv-feedback');

      if (fileInput) {
        fileInput.addEventListener('change', () => {
          const file = fileInput.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              textInput.value = reader.result;
            };
            reader.readAsText(file);
          }
        });
      }

      csvForm.addEventListener('submit', async e => {
        e.preventDefault();
        const csv = textInput.value.trim();
        if (!csv) {
          TCB.state.toast('Ingresa o selecciona un archivo CSV con datos.', { type: 'danger' });
          return;
        }

        feedback.innerHTML = '<p class="small muted">Importando catálogo...</p>';
        try {
          const res = await TCB.api.brand.importCsv(csv);
          feedback.innerHTML = `
            <div class="banner banner--success" style="margin-top:12px;padding:14px">
              <strong>Importación exitosa:</strong> ${res.imported} prendas nuevas, ${res.updated} actualizadas.
              ${res.errors && res.errors.length ? `<div class="small muted" style="margin-top:6px">${res.errors.length} advertencias.</div>` : ''}
            </div>
          `;
          TCB.state.toast('Catálogo importado correctamente.');
          await loadBrandData();
          setTimeout(() => {
            activeTab = 'inventory';
            rerender();
          }, 1200);
        } catch (err) {
          feedback.innerHTML = `
            <div class="banner banner--danger" style="margin-top:12px;padding:14px">
              <strong>Error en la importación:</strong> ${err.data?.error || err.message}
            </div>
          `;
        }
      });
    }
  }

  return {
    render,
    mount,
    loadBrandData
  };
})();
