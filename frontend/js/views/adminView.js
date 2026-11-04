// Admin View — Panel Profesional de Gestión y Operaciones para The Clothes Box
window.TCB = window.TCB || {};
TCB.views = TCB.views || {};

TCB.views.admin = (() => {
  const { icon, logoSvg, garmentPhoto } = TCB.brand;

  let activeTab = 'kpis'; // 'kpis', 'boxes', 'clients', 'products', 'returns', 'feedback'
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
    dataRequests: null
  };

  async function loadAdminData() {
    try {
      const [metrics, boxesRes, clientsRes, productsRes, returnsRes, feedbackRes, outboxRes, cancellationReasons, payments, invoices, dispatch, dataRequests] = await Promise.all([
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
                Ingresar como Administrador (admin123)
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
            <button type="button" class="btn btn--sm btn--ghost" id="btn-switch-to-client" style="border-color:rgba(255,255,255,0.3);color:#fff">
              Ver como Cliente Demo
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
        ${renderTabContent({ boxes, clients, products, returns, feedback })}
      </div>
    `;
  }

  function renderTabContent({ boxes, clients, products, returns, feedback }) {
    switch (activeTab) {
      case 'boxes':
        return renderBoxesTab(boxes);
      case 'clients':
        return renderClientsTab(clients);
      case 'products':
        return renderProductsTab(products);
      case 'returns':
        return renderReturnsTab(returns);
      case 'feedback':
        return renderFeedbackTab(feedback);
      case 'cancellations':
        return renderCancellationsTab(cachedData.cancellationReasons);
      case 'outbox':
        return renderOutboxTab(cachedData.outbox);
      case 'datarequests':
        return renderDataRequestsTab(cachedData.dataRequests);
      case 'dispatch':
        return renderDispatchTab(cachedData.dispatch);
      case 'payments':
        return renderPaymentsTab(cachedData.payments);
      case 'invoices':
        return renderInvoicesTab(cachedData.invoices);
      default:
        return renderBoxesTab(boxes);
    }
  }

  function formatDuration(sec) {
    if (!Number.isFinite(sec)) return '—';
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min`;
  }

  const cop = n => `$${Number(n || 0).toLocaleString('es-CO')}`;

  const STATUS_LABELS = {
    PROPOSED: 'PROPOSED (En curaduría)',
    APPROVED: 'APPROVED (Lista para despacho)',
    PREPARING: 'PREPARING (En taller)',
    SHIPPED: 'SHIPPED (En reparto)',
    DELIVERED: 'DELIVERED (Entregada)',
    RATED: 'RATED (Calificada)'
  };

  // PESTAÑA 1: GESTIÓN DE CAJAS (El Admin puede ver los ítems incluso antes de entrega)
  function renderBoxesTab(boxes) {
    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px;gap:12px;flex-wrap:wrap">
          <div>
            <h2 class="display" style="font-size:var(--fs-xl)">Pipeline de Cajas por Ciclo</h2>
            <p class="small muted">
              <strong>Privilegio administrativo:</strong> Puedes inspeccionar las prendas en cualquier estado. Las cajas PROPOSED se aprueban en la <a href="#/estilista">cola de curaduría</a>.
            </p>
          </div>
          <button type="button" class="btn btn--gold btn--sm" id="btn-generate-batch">${icon('sparkle', 14)} Generar cajas del mes</button>
        </div>
        <div id="batch-report"></div>

        <div class="stack" style="--stack:20px">
          ${boxes.map(box => {
            const statusColor = {
              PROPOSED: '#8a5a00',
              APPROVED: '#5b3fa6',
              PREPARING: 'var(--brand-box)',
              SHIPPED: '#2b55b8',
              DELIVERED: '#2a6e4b',
              RATED: 'var(--ink)'
            }[box.status] || 'var(--ink)';

            return `
              <div style="background:var(--sheet);border:var(--line);border-radius:var(--r-1);padding:24px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;border-bottom:var(--hair);padding-bottom:14px;margin-bottom:16px">
                  <div>
                    <div style="display:flex;gap:8px;align-items:center">
                      <span class="badge badge--dark">Ciclo #${box.cycle}</span>
                      <span class="mono small muted">ID: ${box.id}</span>
                      <span class="badge" style="background:${statusColor};color:#fff;font-weight:700">${box.status}</span>
                      ${box.unboxed ? '<span class="badge badge--accent">Desempacada</span>' : '<span class="badge">Sellada</span>'}
                    </div>
                    <h3 style="font-size:var(--fs-lg);font-weight:700;margin-top:6px">Cliente: ${box.userName}</h3>
                    <p class="small muted">Correo: ${box.userEmail} · Dirección Cali: ${box.address}</p>
                  </div>

                  <!-- CONTROL MANUAL DE ESTADO DE LA CAJA (ADMIN) -->
                  <div style="display:flex;align-items:center;gap:8px">
                    <span class="small muted">Cambiar estado:</span>
                    <select class="input admin-status-select" data-box-id="${box.id}" style="width:auto;padding:6px 12px">
                      ${['PROPOSED', 'APPROVED'].includes(box.status) ? `<option value="${box.status}" selected disabled>${STATUS_LABELS[box.status]}</option>` : ''}
                      ${['PREPARING', 'SHIPPED', 'DELIVERED', 'RATED'].map(st => `
                        <option value="${st}" ${box.status === st ? 'selected' : ''}>${STATUS_LABELS[st]}</option>
                      `).join('')}
                    </select>
                  </div>
                </div>

                <!-- PRENDAS ASIGNADAS (FOTOGRAFÍAS REALES AUDITADAS POR ADMIN) -->
                <div>
                  <p class="small mono muted" style="margin-bottom:10px;text-transform:uppercase">
                    Prendas curadas en esta caja (${(box.items || []).length})
                    ${box.targetCostCOP ? ` · costo ${cop(box.totalCostCOP)} / objetivo ${cop(box.targetCostCOP)}${box.withinCap === false ? ' · SUPERA EL TOPE' : ''}` : ''}
                  </p>
                  <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:14px">
                    ${(box.items || []).map(item => `
                      <div style="background:var(--paper-2);border:var(--hair);border-radius:var(--r-1);padding:10px;display:flex;gap:12px;align-items:center">
                        <div style="width:54px;height:68px;flex:none;border-radius:2px;overflow:hidden">
                          <img src="${item.imageUrl}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover" />
                        </div>
                        <div style="overflow:hidden">
                          <span class="badge badge--dark" style="font-size:9px">${item.brandName || item.brandCity || 'Marca'}</span>
                          <h5 style="font-weight:700;font-size:var(--fs-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${item.name}</h5>
                          <p class="small muted" style="font-size:11px">${item.fabric?.split(' ')[0] || ''} · $${Number(item.priceCOP || 89000).toLocaleString('es-CO')}</p>
                          ${(() => {
                            const rec = (box.recommendations || []).find(x => x.productId === item.id);
                            return rec ? `<p class="small" style="font-size:11px;white-space:normal;margin-top:2px">${rec.explanation}</p>` : '';
                          })()}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // PESTAÑA 2: CLIENTES & PERFILES ANTROPOMÉTRICOS
  function renderClientsTab(clients) {
    return `
      <div>
        <h2 class="display" style="font-size:var(--fs-xl);margin-bottom:16px">Clientes Registrados y Medidas Corporales</h2>
        <div style="overflow-x:auto;background:var(--sheet);border:var(--line);border-radius:var(--r-1)">
          <table class="returns-history-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Rol</th>
                <th>Estatura / Peso</th>
                <th>Silueta / Fit</th>
                <th>Talla Usual</th>
                <th>Cajas</th>
                <th>Estado Actual</th>
              </tr>
            </thead>
            <tbody>
              ${clients.map(c => {
                const p = c.profile || {};
                const m = p.measures || {};
                return `
                  <tr>
                    <td>
                      <strong>${c.name}</strong>
                      <div class="small muted">${c.email}</div>
                    </td>
                    <td><span class="badge ${c.role === 'ADMIN' ? 'badge--accent' : 'badge--dark'}">${c.role}</span></td>
                    <td>${m.height ? `${m.height} cm / ${m.weight} kg` : (p.heightCm ? `${p.heightCm} cm / ${p.weightKg} kg` : '174 cm / 68 kg')}</td>
                    <td>${m.build || p.bodyBuild || 'Media'} · ${p.fit || p.fitPreference || 'Regular'}</td>
                    <td><span class="mono" style="font-weight:700">${m.usual || p.usualSizeTop || 'M'}</span></td>
                    <td>${c.boxesCount || 1} cajas</td>
                    <td><span class="badge badge--dark">${c.currentBoxStatus || 'ACTIVA'}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // PESTAÑA 3: CATÁLOGO DE PRODUCTOS (FOTOGRAFÍAS REALES DE MARCAS COLOMBIANAS)
  function renderProductsTab(products) {
    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px">
          <div>
            <h2 class="display" style="font-size:var(--fs-xl)">Catálogo de Marcas Reales (${products.length} productos)</h2>
            <p class="small muted">Todas las prendas cuentan con fotografía oficial de alta resolución y tabla de medidas en centímetros.</p>
          </div>
        </div>

        <!-- HU-05: IMPORTACIÓN DE CATÁLOGO POR CSV -->
        <section style="background:var(--sheet);border:var(--line);padding:18px;margin-bottom:20px;border-radius:var(--r-1)">
          <h3 style="font-weight:700">Importar catálogo (CSV)</h3>
          <p class="small muted" style="margin-top:4px">
            Una fila por variante. Columnas: marca, nombre, categoria, estilo, ocasion, talla, color, precio_mayorista, stock.
            Varios estilos u ocasiones se separan con |. <a href="/docs/ejemplo_catalogo.csv" download>Descargar ejemplo</a>
          </p>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px">
            <input type="file" id="csv-file" accept=".csv,text/csv" class="input" style="width:auto;max-width:100%">
            <button type="button" class="btn btn--gold btn--sm" id="btn-import-csv">Importar</button>
          </div>
          <div id="import-report" style="margin-top:12px"></div>
        </section>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:20px">
          ${products.map(p => `
            <div style="background:var(--sheet);border:var(--line);border-radius:var(--r-1);overflow:hidden;display:flex;flex-direction:column">
              <div style="height:220px;position:relative">
                <img src="${p.imageUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover" />
                <span style="position:absolute;top:10px;left:10px;background:rgba(22,21,24,0.85);color:#fff;font-family:var(--font-mono);font-size:10px;padding:3px 8px;border-radius:2px">
                  ${p.brandName} (${p.brandCity})
                </span>
                <span style="position:absolute;bottom:10px;right:10px;background:var(--paper-2);font-weight:700;font-family:var(--font-mono);font-size:11px;padding:3px 8px;border:1px solid var(--ink)">
                  $${Number(p.priceCOP).toLocaleString('es-CO')}
                </span>
              </div>
              <div style="padding:16px;flex:1;display:flex;flex-direction:column;gap:8px">
                <div style="display:flex;justify-content:space-between;align-items:baseline">
                  <span class="small mono muted">${p.category.toUpperCase()} · ${p.type}</span>
                  <span class="small" style="font-weight:600">${p.colorName || p.color}</span>
                </div>
                <h4 style="font-weight:700;font-size:var(--fs-base)">${p.name}</h4>
                <p class="small muted" style="font-size:12px;line-height:1.4">${p.story || ''}</p>
                <div style="background:var(--paper-2);padding:6px 10px;border-radius:var(--r-1);font-size:11px;margin-top:auto;display:grid;gap:4px">
                  <span><strong>Tejido:</strong> ${p.fabric}</span>
                  <span><strong>Mayorista:</strong> ${cop(p.wholesalePriceCOP)}${p.wholesaleEstimated ? ' (estimado)' : ''}</span>
                  <span><strong>Stock:</strong> ${(p.variants || []).map(v => `<span class="mono" style="${v.stock === 0 ? 'color:var(--danger)' : ''}">${v.size} ${v.stock}</span>`).join(' · ')}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // PESTAÑA 4: GESTIÓN DE DEVOLUCIONES POR TALLA
  function renderReturnsTab(returns) {
    return `
      <div>
        <h2 class="display" style="font-size:var(--fs-xl);margin-bottom:16px">Solicitudes de Cambio Exclusivo por Talla (${returns.length})</h2>
        <div style="overflow-x:auto;background:var(--sheet);border:var(--line);border-radius:var(--r-1)">
          <table class="returns-history-table">
            <thead>
              <tr>
                <th>Radicado</th>
                <th>Cliente</th>
                <th>Prenda</th>
                <th>Problema de Talla</th>
                <th>Talla Pedida</th>
                <th>Dirección Recolección</th>
                <th>Estado</th>
                <th>Acción Operador</th>
              </tr>
            </thead>
            <tbody>
              ${returns.map(ret => {
                return `
                  <tr>
                    <td class="mono" style="font-weight:700">${ret.id}</td>
                    <td>
                      <strong>${ret.userName}</strong>
                      <div class="small muted">${ret.userEmail}</div>
                    </td>
                    <td>
                      <div style="display:flex;align-items:center;gap:10px">
                        ${ret.productImage ? `<img src="${ret.productImage}" alt="${ret.productName}" style="width:36px;height:46px;object-fit:cover;border-radius:2px" />` : ''}
                        <div>
                          <strong>${ret.productName}</strong>
                          <div class="small muted">${ret.brand || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="badge ${ret.reason === 'TOO_SMALL' ? 'badge--accent' : 'badge--dark'}">${ret.reason}</span>
                      ${ret.notes ? `<div class="small muted" style="font-size:11px;max-width:180px">${ret.notes}</div>` : ''}
                    </td>
                    <td><span class="mono" style="font-weight:700;color:var(--brand-box)">${ret.requestedSize}</span></td>
                    <td class="small">
                      <div>${ret.pickupAddress || 'Cali, Colombia'}</div>
                      <div class="muted">${ret.scheduledPickupDate || 'Hoy'}</div>
                    </td>
                    <td><span class="badge badge--accent">${ret.status}</span></td>
                    <td>
                      <select class="input admin-return-select" data-return-id="${ret.id}" style="width:auto;padding:4px 8px;font-size:11px">
                        <option value="PENDING_PICKUP" ${ret.status === 'PENDING_PICKUP' || ret.status === 'PENDING' ? 'selected' : ''}>Agendar Mensajero</option>
                        <option value="RECEIVED" ${ret.status === 'RECEIVED' ? 'selected' : ''}>Prenda recibida (reingresa stock)</option>
                        <option value="PROCESSING" ${ret.status === 'PROCESSING' ? 'selected' : ''}>En Taller / Reempaque</option>
                        <option value="COMPLETED" ${ret.status === 'COMPLETED' ? 'selected' : ''}>Completado y Cambiado</option>
                      </select>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // HU-13: motivos de la encuesta de salida
  function renderCancellationsTab(data) {
    if (!data) return '<p class="muted">Sin datos de cancelación.</p>';
    const max = Math.max(1, ...data.reasons.map(r => r.count));
    return `
      <div style="max-width:640px">
        <h2 class="display" style="font-size:var(--fs-xl);margin-bottom:6px">Motivos de cancelación</h2>
        <p class="small muted" style="margin-bottom:16px">${data.total} cancelaciones · ${data.unanswered} sin responder la encuesta</p>
        <div class="stack" style="--stack:10px">
          ${data.reasons.map(r => `
            <div style="display:grid;grid-template-columns:150px 1fr 36px;gap:10px;align-items:center">
              <span class="small">${r.label}</span>
              <div style="background:var(--paper-2);height:14px;border-radius:var(--r-full);overflow:hidden">
                <div style="width:${(r.count / max) * 100}%;height:100%;background:var(--brand-box)"></div>
              </div>
              <span class="mono small" style="text-align:right">${r.count}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const SUB_STATUS = { ACTIVE: 'Activa', PAUSED: 'En pausa', PAST_DUE: 'Pago pendiente', CANCELLED: 'Cancelada' };

  const PLAN_FILTERS = { all: 'Todos los planes', esencial: 'Esencial', estilo: 'Estilo' };
  const pct = v => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('es-CO')} %`);

  // HU-16: solicitudes de los titulares y tiempo de respuesta frente al plazo legal
  function renderDataRequestsTab(data) {
    if (!data) return '<p class="muted">Sin solicitudes.</p>';
    const TYPES = { EXPORT: 'Consulta (exportación)', RECTIFICATION: 'Rectificación', DELETION: 'Supresión' };
    const time = ms => (ms < 1000 ? `${ms} ms` : `${Math.round(ms / 1000)} s`);
    return `
      <div class="stack" style="--stack:20px">
        <div>
          <h2 class="display" style="font-size:var(--fs-xl)">Solicitudes de datos personales</h2>
          <p class="small muted">Derechos del titular (Ley 1581 de 2012). Las solicitudes desde "Mis datos" se resuelven en el acto.</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
          ${data.summary.map(t => `
            <div style="background:var(--sheet);border:var(--line);padding:14px">
              <p class="small muted">${TYPES[t.type] || t.type}</p>
              <p class="display" style="font-size:var(--fs-2xl)">${t.count}</p>
              <p class="small muted">Respuesta promedio ${time(t.avgResponseMs)} · plazo legal ${t.deadlineBusinessDays} días hábiles${t.blocked ? ` · ${t.blocked} bloqueadas` : ''}</p>
            </div>
          `).join('') || '<p class="muted">Aún no hay solicitudes.</p>'}
        </div>
        ${data.requests.length ? `
          <div style="overflow-x:auto">
            <table class="returns-history-table">
              <thead><tr><th>Fecha</th><th>Titular</th><th>Tipo</th><th>Estado</th><th>Respuesta</th><th>Detalle</th></tr></thead>
              <tbody>${data.requests.map(r => `
                <tr>
                  <td class="small">${new Date(r.requestedAt).toLocaleString('es-CO')}</td>
                  <td class="small">${r.userName}</td>
                  <td class="small">${TYPES[r.type] || r.type}</td>
                  <td class="small">${r.status === 'BLOCKED' ? 'Bloqueada' : 'Resuelta'}</td>
                  <td class="mono small">${time(r.responseMs)}</td>
                  <td class="small">${r.detail}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    `;
  }

  // HU-09: cajas por despachar con lista de picking y empaque
  function renderDispatchTab(data) {
    if (!data) return '<p class="muted">Sin datos de despacho.</p>';
    return `
      <div class="stack" style="--stack:24px">
        <div>
          <h2 class="display" style="font-size:var(--fs-xl)">Cajas por despachar</h2>
          <p class="small muted">${data.boxes.length} cajas aprobadas o en preparación · ${data.readyCount} listas para salir. Al marcar despachada se genera la guía del operador logístico SIMULADO, se descuenta el stock y se avisa al suscriptor.</p>
        </div>
        ${data.pickingList.length ? `
          <div>
            <h3 style="font-weight:700;margin-bottom:8px">Lista de picking (${data.pickingList.reduce((acc, p) => acc + p.quantity, 0)} prendas)</h3>
            <div style="overflow-x:auto">
              <table class="returns-history-table">
                <thead><tr><th>Marca</th><th>Prenda</th><th>Talla</th><th>Color</th><th>Cantidad</th><th>Stock</th></tr></thead>
                <tbody>${data.pickingList.map(p => `
                  <tr>
                    <td class="small">${p.brandName}</td>
                    <td>${p.name}</td>
                    <td class="mono">${p.size}</td>
                    <td class="small">${p.color}</td>
                    <td class="mono" style="font-weight:700">${p.quantity}</td>
                    <td class="mono ${p.shortage ? 'error' : ''}">${p.stock}${p.shortage ? ' · falta stock' : ''}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
        ${data.boxes.length === 0 ? '<p class="muted">No hay cajas por despachar.</p>' : `
          <div class="stack" style="--stack:12px">
            <h3 style="font-weight:700">Empaque por caja</h3>
            ${data.boxes.map(b => `
              <div style="background:var(--sheet);border:var(--line);padding:16px">
                <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline">
                  <div>
                    <strong>${b.subscriber ? b.subscriber.name : b.id}</strong>
                    <span class="mono small muted">· ${b.id} · ciclo #${b.cycle} · ${b.status === 'APPROVED' ? 'Aprobada' : 'En preparación'}</span>
                    <p class="small muted">${b.address}</p>
                  </div>
                  ${b.blockedReason ? `<span class="small error"><strong>${b.blockedReason}</strong></span>` : '<span class="small" style="color:var(--ok)"><strong>Pago confirmado</strong></span>'}
                </div>
                <ul class="small" style="margin:10px 0 0;padding-left:18px">
                  ${b.items.map(i => `<li>${i.brandName} · ${i.name} · talla <span class="mono">${i.size}</span> · ${i.color}</li>`).join('')}
                </ul>
                <div class="sub-actions">
                  ${b.status === 'APPROVED' ? `<button type="button" class="btn btn--ghost btn--sm" data-dispatch-box="${b.id}" data-dispatch-status="PREPARING" ${b.blockedReason ? 'disabled' : ''}>Marcar en preparación</button>` : ''}
                  <button type="button" class="btn btn--gold btn--sm" data-dispatch-box="${b.id}" data-dispatch-status="SHIPPED" ${b.blockedReason ? 'disabled' : ''}>Marcar despachada y generar guía</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // HU-08: comisión de la pasarela, conciliación, suscripciones y cobro recurrente manual
  function renderPaymentsTab(data) {
    if (!data) return '<p class="muted">Sin datos de pagos.</p>';
    const r = data.report;
    return `
      <div class="stack" style="--stack:24px">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap">
          <div>
            <h2 class="display" style="font-size:var(--fs-xl)">Pagos <span class="badge badge--dark" style="vertical-align:middle">SIMULADO</span></h2>
            <p class="small muted">Pasarela simulada · comisión ${(r.feeRate * 100).toLocaleString('es-CO')} % por cobro aprobado.</p>
          </div>
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
            <div class="field" style="margin:0">
              <label for="billing-date" class="small">Simular fecha (opcional)</label>
              <input class="input" type="date" id="billing-date">
            </div>
            <button type="button" class="btn btn--gold btn--sm" id="btn-run-billing">Ejecutar cobro recurrente</button>
          </div>
        </div>
        <div id="billing-report"></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
          ${[
            ['Cobrado', cop(r.grossCOP)],
            ['Comisión pasarela', cop(r.feeCOP)],
            ['Neto', cop(r.netCOP)],
            ['Aprobados / rechazados', `${r.approvedCount} / ${r.declinedCount}`],
            ['Conciliados', `${r.reconciliation.OK} OK · ${r.reconciliation.PENDING} pendientes · ${r.reconciliation.MISMATCH} con diferencia`]
          ].map(([label, value]) => `
            <div style="background:var(--sheet);border:var(--line);padding:14px">
              <p class="small muted">${label}</p>
              <p class="mono" style="font-weight:700;margin-top:4px">${value}</p>
            </div>
          `).join('')}
        </div>
        ${r.byMonth.length ? `
          <div>
            <h3 style="font-weight:700;margin-bottom:8px">Comisión por mes</h3>
            <table class="returns-history-table">
              <thead><tr><th>Mes</th><th>Cobros</th><th>Bruto</th><th>Comisión</th><th>Neto</th></tr></thead>
              <tbody>${r.byMonth.map(m => `<tr><td class="mono">${m.month}</td><td>${m.count}</td><td class="mono">${cop(m.grossCOP)}</td><td class="mono">${cop(m.feeCOP)}</td><td class="mono">${cop(m.netCOP)}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        ` : ''}
        <div>
          <h3 style="font-weight:700;margin-bottom:8px">Suscripciones (${data.subscriptions.length})</h3>
          <div style="overflow-x:auto">
            <table class="returns-history-table">
              <thead><tr><th>Cliente</th><th>Plan</th><th>Estado</th><th>Tarjeta</th><th>Próximo cobro</th></tr></thead>
              <tbody>${data.subscriptions.map(s => `
                <tr>
                  <td class="small">${s.userName || s.userId}</td>
                  <td>${s.planName}${s.pendingPlanName ? ` → ${s.pendingPlanName}` : ''}</td>
                  <td>${SUB_STATUS[s.status] || s.status}${s.dunning && s.status === 'ACTIVE' ? ' · reintentando' : ''}</td>
                  <td class="mono small">${s.cardLast4 ? `${s.cardBrand} •••• ${s.cardLast4}` : '—'}</td>
                  <td class="small">${s.nextChargeAt ? new Date(s.nextChargeAt).toLocaleDateString('es-CO') : '—'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 style="font-weight:700;margin-bottom:8px">Últimos pagos</h3>
          <div style="overflow-x:auto">
            <table class="returns-history-table">
              <thead><tr><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Monto</th><th>Comisión</th><th>Estado</th><th>Conciliación</th></tr></thead>
              <tbody>${data.payments.slice(0, 30).map(p => `
                <tr>
                  <td class="small">${new Date(p.createdAt).toLocaleString('es-CO')}</td>
                  <td class="small">${p.userName || p.userId}</td>
                  <td class="mono small">${p.kind}</td>
                  <td class="mono">${cop(p.amountCOP)}</td>
                  <td class="mono">${cop(p.feeCOP)}</td>
                  <td class="small">${p.status === 'APPROVED' ? 'Aprobado' : `Rechazado · ${p.reason}`}</td>
                  <td class="small">${p.reconciliation.status}${p.reconciliation.detail ? ` · ${p.reconciliation.detail}` : ''}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // HU-15: facturas, cola de reintentos y alertas
  function renderInvoicesTab(data) {
    if (!data) return '<p class="muted">Sin datos de facturación.</p>';
    const open = data.alerts.filter(a => !a.resolvedAt);
    const STATUS = { ISSUED: 'Emitida', PENDING_RETRY: 'Pendiente de reintento', FAILED: 'Fallida' };
    return `
      <div class="stack" style="--stack:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <h2 class="display" style="font-size:var(--fs-xl)">Facturación electrónica <span class="badge badge--dark" style="vertical-align:middle">SIMULADO</span></h2>
            <p class="small muted">Proveedor simulado · ambiente de habilitación DIAN${data.provider.failMode ? ' · <strong>INVOICING_FAIL=1 activo</strong>' : ''}.</p>
          </div>
          <button type="button" class="btn btn--ghost btn--sm" id="btn-run-invoice-retries">Reintentar facturas pendientes</button>
        </div>
        ${open.length ? `
          <div class="banner banner--danger">
            <p class="small"><strong>${open.length} alerta${open.length === 1 ? '' : 's'} de facturación abierta${open.length === 1 ? '' : 's'}</strong></p>
            <ul class="small" style="margin:6px 0 0;padding-left:18px">${open.map(a => `<li>${a.message} <span class="muted">· ${new Date(a.createdAt).toLocaleString('es-CO')}</span></li>`).join('')}</ul>
          </div>
        ` : '<p class="small muted">Sin alertas abiertas.</p>'}
        <div style="overflow-x:auto">
          <table class="returns-history-table">
            <thead><tr><th>Número</th><th>Cliente</th><th>Documento</th><th>Subtotal</th><th>IVA</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>${data.invoices.map(i => `
              <tr>
                <td class="mono">${i.number}</td>
                <td class="small">${i.buyer.name}</td>
                <td class="mono small">${i.buyer.docType || '—'} ${i.buyer.docNumber || ''}</td>
                <td class="mono">${cop(i.subtotalCOP)}</td>
                <td class="mono">${cop(i.ivaCOP)}</td>
                <td class="mono">${cop(i.totalCOP)}</td>
                <td class="small">${STATUS[i.status] || i.status}${i.status === 'PENDING_RETRY' ? ` · intento ${i.attempts}, próximo ${new Date(i.nextRetryAt).toLocaleTimeString('es-CO')}` : ''}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Correos simulados (MAIL_PROVIDER=simulated): no se envía nada real
  function renderOutboxTab(messages) {
    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
          <div>
            <h2 class="display" style="font-size:var(--fs-xl)">Bandeja de salida <span class="badge badge--dark" style="vertical-align:middle">SIMULADO</span></h2>
            <p class="small muted">Correos que el sistema habría enviado. No se envía correo real.</p>
          </div>
          <button type="button" class="btn btn--ghost btn--sm" id="btn-run-reminders">Ejecutar recordatorios de calificación</button>
        </div>
        ${messages.length === 0 ? '<p class="muted">La bandeja está vacía.</p>' : `
          <div class="stack" style="--stack:10px">
            ${messages.map(m => `
              <details style="background:var(--sheet);border:var(--line);border-radius:var(--r-1);padding:12px 16px">
                <summary style="cursor:pointer;display:flex;gap:10px;flex-wrap:wrap;align-items:baseline">
                  <span class="mono small muted">${m.type}</span>
                  <strong class="small" style="flex:1;min-width:200px">${m.subject}</strong>
                  <span class="small muted">${m.to} · ${new Date(m.createdAt).toLocaleString('es-CO')}</span>
                </summary>
                <p class="small" style="margin-top:10px;word-break:break-all">${m.body}</p>
              </details>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // PESTAÑA 5: FEEDBACK Y CALIFICACIONES DE ESTILO
  function renderFeedbackTab(feedback) {
    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
          <h2 class="display" style="font-size:var(--fs-xl)">Feedback de Estilo y Valoraciones de Clientes (${feedback.length})</h2>
          <button type="button" class="btn btn--gold btn--sm" id="btn-ingest-feedback">Reentrenar motor con el feedback</button>
        </div>
        <div id="ingest-report"></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px">
          ${feedback.map(fb => `
            <div style="background:var(--sheet);border:var(--line);border-radius:var(--r-1);padding:18px;display:flex;gap:14px">
              ${fb.productImage ? `
                <div style="width:64px;height:84px;flex:none;border-radius:var(--r-1);overflow:hidden">
                  <img src="${fb.productImage}" alt="${fb.productName}" style="width:100%;height:100%;object-fit:cover" />
                </div>
              ` : ''}
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;align-items:baseline">
                  <span class="badge badge--dark" style="font-size:10px">${fb.productBrand || 'Marca'}</span>
                  <span style="color:var(--brand-box);font-weight:700;text-align:right">
                    ★ ${fb.score}/5
                    ${fb.fitScore || fb.styleScore ? `<span class="small muted" style="display:block;font-weight:500">Ajuste ${fb.fitScore || '—'} · Estilo ${fb.styleScore || '—'}</span>` : ''}
                  </span>
                </div>
                <h4 style="font-weight:700;font-size:var(--fs-sm);margin-top:4px">${fb.productName}</h4>
                <p class="small" style="margin-top:6px;font-style:italic">"${fb.styleFeedback || fb.feedback || 'Sin comentario adicional'}"</p>
                <div style="margin-top:8px;padding-top:6px;border-top:var(--hair);font-size:11px;color:var(--muted);display:flex;justify-content:space-between">
                  <span>Por: <strong>${fb.userName}</strong></span>
                  <span>Ciclo #${fb.boxCycle || 1}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function mount(root) {
    // Botón de login directo como admin
    root.querySelector('#btn-login-as-admin')?.addEventListener('click', async () => {
      try {
        await TCB.api.auth.login('admin@theclothesbox.co', 'admin123');
        await TCB.state.loadUserSession();
        await loadAdminData();
        TCB.state.toast('Sesión iniciada como Administrador de Operaciones.');
        window.location.hash = '#/admin';
      } catch (e) {
        TCB.state.toast('Error al autenticar administrador.', { type: 'danger' });
      }
    });

    // Cambiar a cliente demo
    root.querySelector('#btn-switch-to-client')?.addEventListener('click', async () => {
      try {
        await TCB.api.auth.login('demo@theclothesbox.co', 'demo123');
        await TCB.state.loadUserSession();
        TCB.state.toast('Cambiado a sesión de Cliente Demo.');
        window.location.hash = '#/caja';
      } catch (e) {
        TCB.state.toast('Error al cambiar a cliente demo.', { type: 'danger' });
      }
    });

    // Actualizar datos
    root.querySelector('#btn-refresh-admin')?.addEventListener('click', async () => {
      try {
        await loadAdminData();
        const container = document.getElementById('app-view');
        if (container) {
          container.innerHTML = render(TCB.state.get());
          mount(container);
        }
        TCB.state.toast('Panel administrativo actualizado.');
      } catch (e) {
        TCB.state.toast('Error al actualizar datos.', { type: 'danger' });
      }
    });

    root.querySelector('#btn-run-reminders')?.addEventListener('click', async () => {
      try {
        const res = await TCB.api.admin.runReviewReminders();
        await loadAdminData();
        const container = document.getElementById('app-view');
        if (container) {
          container.innerHTML = render(TCB.state.get());
          mount(container);
        }
        TCB.state.toast(`Recordatorios enviados: ${res.sent}.`);
      } catch (e) {
        TCB.state.toast('Error al ejecutar los recordatorios.', { type: 'danger' });
      }
    });

    function rerender() {
      const container = document.getElementById('app-view');
      if (container) {
        container.innerHTML = render(TCB.state.get());
        mount(container);
      }
    }

    // HU-11: reentrenamiento del motor
    root.querySelector('#btn-ingest-feedback')?.addEventListener('click', async () => {
      try {
        const res = await TCB.api.admin.ingestFeedback();
        document.querySelector('#ingest-report').innerHTML = `
          <div class="banner banner--info" style="margin-bottom:16px"><p class="small">Motor ${res.rulesVersion}: ${res.ratingsProcessed} calificaciones (${res.lowRatings} con estilo ≤ 2) y ${res.correctionsProcessed} correcciones del estilista procesadas · ${res.profilesUpdated} perfiles actualizados.</p></div>
        `;
      } catch (e) {
        TCB.state.toast(e.message || 'Error al reentrenar.', { type: 'danger' });
      }
    });

    root.querySelectorAll('[data-dispatch-box]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const boxId = btn.getAttribute('data-dispatch-box');
        try {
          const res = await TCB.api.admin.updateBoxStatus(boxId, btn.getAttribute('data-dispatch-status'));
          TCB.state.toast(res.box.trackingNumber ? `Caja despachada con guía ${res.box.trackingNumber}. Aviso enviado al suscriptor.` : 'Caja en preparación.', { ms: 6000 });
          await loadAdminData();
          rerender();
        } catch (e) {
          TCB.state.toast(e.message || 'No se pudo actualizar la caja.', { type: 'danger' });
        }
      });
    });

    root.querySelector('#btn-run-billing')?.addEventListener('click', async () => {
      const dateValue = root.querySelector('#billing-date').value;
      try {
        const res = await TCB.api.admin.runBilling(dateValue ? `${dateValue}T12:00:00` : undefined);
        await loadAdminData();
        rerender();
        document.querySelector('#billing-report').innerHTML = `
          <div class="banner banner--info"><p class="small">Cobro del ${new Date(res.ranAt).toLocaleDateString('es-CO')}: <strong>${res.approved}</strong> aprobados · ${res.failed} rechazados con reintento programado · ${res.pastDue} pasaron a pago pendiente · ${res.resumed} reanudadas tras la pausa.</p></div>
        `;
      } catch (e) {
        TCB.state.toast(e.message || 'Error al ejecutar el cobro.', { type: 'danger' });
      }
    });

    root.querySelector('#btn-run-invoice-retries')?.addEventListener('click', async () => {
      try {
        const res = await TCB.api.admin.runInvoiceRetries();
        await loadAdminData();
        rerender();
        TCB.state.toast(`Facturas reintentadas: ${res.retried} · emitidas: ${res.issued} · siguen pendientes: ${res.stillPending}.`);
      } catch (e) {
        TCB.state.toast(e.message || 'Error al reintentar facturas.', { type: 'danger' });
      }
    });

    root.querySelector('#btn-import-csv')?.addEventListener('click', async () => {
      const file = root.querySelector('#csv-file').files[0];
      const reportEl = root.querySelector('#import-report');
      if (!file) {
        reportEl.innerHTML = '<p class="small error">Selecciona un archivo CSV.</p>';
        return;
      }
      try {
        const res = await TCB.api.admin.importProducts(await file.text());
        await loadAdminData();
        rerender();
        document.querySelector('#import-report').innerHTML = `
          <p class="small"><strong>${res.imported}</strong> filas importadas · <strong>${res.rejected}</strong> con error · ${res.createdProducts.length} prendas nuevas · ${res.updatedProducts.length} actualizadas</p>
          ${res.errors.length ? `
            <table class="returns-history-table" style="margin-top:8px">
              <thead><tr><th>Fila</th><th>Motivo</th></tr></thead>
              <tbody>${res.errors.map(e => `<tr><td class="mono">${e.row}</td><td>${e.reason}</td></tr>`).join('')}</tbody>
            </table>
          ` : ''}
        `;
      } catch (e) {
        reportEl.innerHTML = `<p class="small error">${e.message}</p>`;
      }
    });

    root.querySelector('#btn-generate-batch')?.addEventListener('click', async () => {
      try {
        const res = await TCB.api.admin.generateBatch();
        await loadAdminData();
        rerender();
        document.querySelector('#batch-report').innerHTML = `
          <div class="banner banner--info" style="margin-bottom:16px">
            <p class="small">Mes ${res.month}: <strong>${res.generatedCount}</strong> cajas generadas (quedan PROPOSED para el estilista) · ${res.skippedCount} suscriptores omitidos
            ${res.generatedCount ? ` · ${res.withinCapPct} % dentro del costo objetivo · ${res.completePct} % completas` : ''}</p>
          </div>
        `;
      } catch (e) {
        TCB.state.toast(e.message || 'Error al generar las cajas.', { type: 'danger' });
      }
    });

    // Pestañas
    root.querySelectorAll('.admin-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        const container = document.getElementById('app-view');
        if (container) {
          container.innerHTML = render(TCB.state.get());
          mount(container);
        }
      });
    });

    // Cambios de estado de caja por Admin
    root.querySelectorAll('.admin-status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const boxId = sel.getAttribute('data-box-id');
        const newStatus = sel.value;
        try {
          await TCB.api.admin.updateBoxStatus(boxId, newStatus);
          TCB.state.toast(`Estado de caja #${boxId} actualizado a ${newStatus}.`);
          await loadAdminData();
        } catch (e) {
          TCB.state.toast(e.message || 'Error al actualizar estado.', { type: 'danger' });
          await loadAdminData();
          rerender();
        }
      });
    });

    // Cambios de estado de devolución por Admin
    root.querySelectorAll('.admin-return-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const returnId = sel.getAttribute('data-return-id');
        const newStatus = sel.value;
        try {
          await TCB.api.admin.updateReturn(returnId, { status: newStatus });
          TCB.state.toast(`Solicitud de devolución #${returnId} actualizada a ${newStatus}.`);
          await loadAdminData();
        } catch (e) {
          TCB.state.toast(e.message || 'Error al actualizar devolución.', { type: 'danger' });
        }
      });
    });
  }

  return {
    render,
    mount,
    loadAdminData
  };
})();
