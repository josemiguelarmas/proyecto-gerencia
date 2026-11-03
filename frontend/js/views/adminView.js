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
    cancellationReasons: null
  };

  async function loadAdminData() {
    try {
      const [metrics, boxesRes, clientsRes, productsRes, returnsRes, feedbackRes, outboxRes, cancellationReasons] = await Promise.all([
        TCB.api.admin.metrics(),
        TCB.api.admin.boxes(),
        TCB.api.admin.clients(),
        TCB.api.admin.products(),
        TCB.api.admin.returns(),
        TCB.api.admin.feedback(),
        TCB.api.admin.outbox(),
        TCB.api.admin.cancellationReasons()
      ]);

      cachedData = {
        metrics,
        boxes: boxesRes.boxes || [],
        clients: clientsRes.clients || [],
        products: productsRes.products || [],
        returns: returnsRes.returns || [],
        feedback: feedbackRes.ratings || [],
        outbox: outboxRes.messages || [],
        cancellationReasons
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
      default:
        return renderBoxesTab(boxes);
    }
  }

  // PESTAÑA 1: GESTIÓN DE CAJAS (El Admin puede ver los ítems incluso antes de entrega)
  function renderBoxesTab(boxes) {
    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px">
          <h2 class="display" style="font-size:var(--fs-xl)">Pipeline de Cajas por Ciclo</h2>
          <p class="small muted">
            <strong>Privilegio administrativo:</strong> Puedes inspeccionar los ítems y prendas seleccionadas incluso en estado PREPARING o SHIPPED.
          </p>
        </div>

        <div class="stack" style="--stack:20px">
          ${boxes.map(box => {
            const statusColor = {
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
                      <option value="PREPARING" ${box.status === 'PREPARING' ? 'selected' : ''}>PREPARING (En taller)</option>
                      <option value="SHIPPED" ${box.status === 'SHIPPED' ? 'selected' : ''}>SHIPPED (En reparto)</option>
                      <option value="DELIVERED" ${box.status === 'DELIVERED' ? 'selected' : ''}>DELIVERED (Entregada)</option>
                      <option value="RATED" ${box.status === 'RATED' ? 'selected' : ''}>RATED (Calificada)</option>
                    </select>
                  </div>
                </div>

                <!-- PRENDAS ASIGNADAS (FOTOGRAFÍAS REALES AUDITADAS POR ADMIN) -->
                <div>
                  <p class="small mono muted" style="margin-bottom:10px;text-transform:uppercase">Prendas curadas en esta caja (${(box.items || []).length}):</p>
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
                <div style="background:var(--paper-2);padding:6px 10px;border-radius:var(--r-1);font-size:11px;margin-top:auto">
                  <strong>Tejido:</strong> ${p.fabric}
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
        <h2 class="display" style="font-size:var(--fs-xl);margin-bottom:16px">Feedback de Estilo y Valoraciones de Clientes (${feedback.length})</h2>
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
