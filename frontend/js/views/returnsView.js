// Returns View — Módulo Especializado de Devoluciones Exclusivas por Talla
window.TCB = window.TCB || {};
TCB.views = TCB.views || {};

TCB.views.returns = (() => {
  const { icon, logoSvg, garmentSvg } = TCB.brand;

  let cachedData = null;

  async function loadReturnsData() {
    try {
      const res = await TCB.api.returns.get();
      cachedData = res;
      return res;
    } catch (e) {
      console.error('Error fetching returns:', e);
      return { returns: [], returnableGarments: [] };
    }
  }

  function render(store) {
    const user = store.user;
    const profile = store.profile;

    if (!user) {
      return `
        <div class="screen wrap">
          <div class="banner banner--warn" style="max-width:540px;margin:var(--s-8) auto;text-align:center">
            ${icon('alert', 32)}
            <h2 style="font-size:var(--fs-xl);margin-top:8px">Módulo de Devoluciones</h2>
            <p class="muted">Inicia sesión para gestionar cambios de talla de tus prendas recibidas.</p>
            <div style="margin-top:16px;display:flex;gap:12px;justify-content:center">
              <button type="button" class="btn btn--gold" data-login-trigger>Iniciar Sesión</button>
            </div>
          </div>
        </div>
      `;
    }

    const { returns = [], returnableGarments = [] } = cachedData || {};

    return `
      <div class="screen wrap">
        <!-- HEADER -->
        <div class="screen-head">
          <span class="badge badge--accent">${icon('return', 14)} Garantía de Ajuste Real</span>
          <h1 class="screen-title display">Devoluciones Exclusivas por Talla</h1>
          <p class="muted">
            En <strong>The Clothes Box</strong> resolvemos la talla antes de pagar. Si alguna prenda de tus cajas entregadas no tiene el ajuste perfecto para tu cuerpo, te la cambiamos por tu talla exacta sin ningún costo.
          </p>
        </div>

        <!-- REGLA FUNDAMENTAL DE POLÍTICA (Feedback vs Devolución) -->
        <div class="returns-rule-card">
          <div style="display:flex;gap:14px;align-items:flex-start">
            <div style="color:var(--brand-box);padding-top:2px">${icon('info', 22)}</div>
            <div>
              <h3>Política Estricta: Cambios únicamente por ajuste y talla</h3>
              <p class="small muted" style="margin-top:4px;line-height:1.6">
                <strong>¿No es tu estilo o color preferido?</strong> Para eso existe la sección de <a href="#/caja" style="text-decoration:underline;color:var(--ink)">Calificación de Entrega</a>, que ajusta los gustos de tu estilista.<br>
                <strong>¿Te quedó pequeña, grande o con corte inadecuado en medidas?</strong> Esta es la sección donde solicitas la recolección gratuita a tu domicilio en Cali para reposición de talla.
              </p>
            </div>
          </div>
        </div>

        <!-- PRENDAS ELEGIBLES PARA CAMBIO -->
        <section style="margin-bottom:var(--s-8)">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--s-4);flex-wrap:wrap;gap:12px">
            <h2 class="display" style="font-size:var(--fs-2xl)">Prendas recibidas elegibles para cambio (${returnableGarments.length})</h2>
            <span class="small muted">Plazo de cambio: 15 días posteriores a la entrega</span>
          </div>

          ${returnableGarments.length === 0 ? `
            <div style="background:var(--sheet);border:var(--hair);padding:32px;text-align:center;border-radius:var(--r-1)">
              <p style="font-weight:600">No tienes prendas pendientes de cambio de talla.</p>
              <p class="small muted" style="margin-top:4px">
                Cuando una caja sea entregada y desempacada, sus prendas aparecerán automáticamente en esta lista.
              </p>
              <a href="#/caja" class="btn btn--sm btn--gold" style="margin-top:16px;display:inline-flex">Ir a mi caja activa</a>
            </div>
          ` : `
            <div class="returnable-list">
              ${returnableGarments.map(item => `
                <div class="returnable-item" data-item-id="${item.id}">
                  <div style="width:68px;height:84px;border-radius:var(--r-1);overflow:hidden;flex:none;background:var(--paper-2)">
                    <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80'}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover" loading="lazy" />
                  </div>
                  <div>
                    <div style="display:flex;gap:8px;align-items:center">
                      <span class="badge badge--dark" style="font-size:10px">${item.brandName}</span>
                      <span class="small mono muted">Ciclo #${item.cycle}</span>
                    </div>
                    <h3 style="font-weight:700;font-size:var(--fs-base);margin-top:4px">${item.name}</h3>
                    <p class="small muted">
                      Talla recibida: <strong>${item.fit.size}</strong> · Tejido: ${item.fabric} · Corte: ${item.cut}
                    </p>
                  </div>
                  <div>
                    <button type="button" class="btn btn--sm btn--gold" data-open-return-modal='${JSON.stringify(item).replace(/'/g, "&apos;")}'>
                      ${icon('return', 14)} Solicitar cambio de talla
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </section>

        <!-- SOLICITUDES DE DEVOLUCIÓN ACTIVAS O HISTÓRICAS -->
        <section>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--s-4);flex-wrap:wrap;gap:12px">
            <h2 class="display" style="font-size:var(--fs-2xl)">Historial de solicitudes de cambio (${returns.length})</h2>
            <span class="small muted">Estado actualizado en tiempo real</span>
          </div>

          ${returns.length === 0 ? `
            <div style="background:var(--sheet);border:var(--hair);padding:24px;text-align:center;border-radius:var(--r-1)">
              <p class="small muted">No has generado solicitudes de devolución por talla.</p>
            </div>
          ` : `
            <div style="overflow-x:auto">
              <table class="returns-history-table">
                <thead>
                  <tr>
                    <th>Radicado</th>
                    <th>Prenda</th>
                    <th>Talla actual ➔ Solicitada</th>
                    <th>Motivo de talla</th>
                    <th>Recolección</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  ${returns.map(ret => {
                    const statusBadge = {
                      PENDING: '<span class="badge badge--dark">Pendiente</span>',
                      PICKUP_SCHEDULED: '<span class="badge badge--accent">Recolección agendada</span>',
                      PROCESSING: '<span class="badge badge--dark">En taller</span>',
                      COMPLETED: '<span class="badge badge--accent">Talla cambiada</span>'
                    }[ret.status] || `<span class="badge">${ret.status}</span>`;

                    const reasonLabel = {
                      TOO_SMALL: 'Muy pequeña / apretada',
                      TOO_LARGE: 'Muy grande / holgada',
                      FIT_ISSUE: 'Problema de tiro o proporciones'
                    }[ret.reason] || ret.reason;

                    return `
                      <tr>
                        <td class="mono" style="font-weight:700">${ret.id}</td>
                        <td>
                          <strong>${ret.productName || ret.productId}</strong>
                          <div class="small muted">${ret.brand || ''}</div>
                        </td>
                        <td>
                          <span class="mono">${ret.currentSize || 'M'}</span> ➔ 
                          <span class="mono" style="font-weight:700;color:var(--brand-box)">${ret.requestedSize}</span>
                        </td>
                        <td>${reasonLabel}</td>
                        <td class="small">
                          <div>${ret.scheduledPickupDate || 'Hoy'}</div>
                          <div class="muted">${ret.pickupAddress || 'Cali, Colombia'}</div>
                        </td>
                        <td>${statusBadge}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </section>
      </div>
    `;
  }

  // MODAL PARA SOLICITAR CAMBIO DE TALLA
  function openReturnModal(item, onCompleted) {
    const profile = TCB.state.get().profile;

    TCB.state.modal({
      eyebrow: 'Garantía de Ajuste',
      title: 'Cambio de Talla sin Costo',
      body: `
        <div class="stack" style="--stack:18px">
          <!-- Resumen de la prenda -->
          <div style="display:flex;gap:14px;background:var(--paper-2);padding:14px;border:var(--hair);border-radius:var(--r-1);align-items:center">
            <div style="width:64px;height:78px;border-radius:var(--r-1);overflow:hidden;flex:none;background:var(--sheet)">
              <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80'}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover" />
            </div>
            <div>
              <p class="badge badge--dark" style="font-size:10px">${item.brandName}</p>
              <h4 style="font-weight:700;font-size:var(--fs-base)">${item.name}</h4>
              <p class="small muted">Talla recibida: <strong>${item.fit.size}</strong></p>
            </div>
          </div>

          <form id="return-form" class="stack" style="--stack:14px" novalidate>
            <p class="error small" id="return-error" role="alert"></p>

            <div class="field">
              <label for="return-reason"><strong>Motivo exacto del cambio (Solo temas de talla)</strong></label>
              <select class="input" id="return-reason" name="reason" required>
                <option value="" disabled selected>Selecciona el problema de talla...</option>
                <option value="TOO_SMALL">Me queda muy pequeña / muy apretada (TOO_SMALL)</option>
                <option value="TOO_LARGE">Me queda muy grande / muy holgada (TOO_LARGE)</option>
                <option value="FIT_ISSUE">Problema con el tiro, hombros o largo (FIT_ISSUE)</option>
              </select>
              <p class="small muted" style="margin-top:4px">
                Nota: El backend rechazará motivos no relacionados con el ajuste (ej. cambio de opinión).
              </p>
            </div>

            <div class="field">
              <label for="return-size"><strong>Talla de reemplazo solicitada</strong></label>
              <select class="input" id="return-size" name="requestedSize" required>
                <option value="XS" ${item.fit.size === 'S' ? 'selected' : ''}>XS (Extra Small)</option>
                <option value="S" ${item.fit.size === 'M' ? 'selected' : ''}>S (Small)</option>
                <option value="M" ${item.fit.size === 'L' ? 'selected' : ''}>M (Medium)</option>
                <option value="L" ${item.fit.size === 'M' ? 'selected' : ''}>L (Large)</option>
                <option value="XL" ${item.fit.size === 'L' ? 'selected' : ''}>XL (Extra Large)</option>
              </select>
            </div>

            <div class="field">
              <label for="return-notes">Detalles del ajuste (opcional)</label>
              <textarea class="input" id="return-notes" name="notes" rows="2" placeholder="Ej: En los hombros me calzó bien, pero en el pecho me aprieta al mover los brazos..."></textarea>
            </div>

            <div class="field">
              <label for="return-address">Dirección de recolección en Cali</label>
              <input class="input" id="return-address" name="pickupAddress" type="text" required value="${profile?.address || 'Av. San Joaquín # 14-80, Ciudad Jardín, Cali'}">
            </div>

            <div class="field">
              <label for="return-date">Fecha preferida para recolección del mensajero</label>
              <input class="input" id="return-date" name="scheduledPickupDate" type="date" required value="${new Date(Date.now() + 86400000).toISOString().split('T')[0]}">
            </div>

            <button type="submit" class="btn btn--gold btn--block" style="margin-top:8px">
              ${icon('check')} Confirmar Solicitud de Cambio Gratis
            </button>
          </form>
        </div>
      `,
      onMount(modalEl, close) {
        const form = modalEl.querySelector('#return-form');
        const errEl = modalEl.querySelector('#return-error');

        form.addEventListener('submit', async e => {
          e.preventDefault();
          errEl.textContent = '';

          const reason = form.reason.value;
          const requestedSize = form.requestedSize.value;
          const notes = form.notes.value.trim();
          const pickupAddress = form.pickupAddress.value.trim();
          const scheduledPickupDate = form.scheduledPickupDate.value;

          if (!reason) {
            errEl.textContent = 'Por favor selecciona el motivo de talla.';
            return;
          }

          try {
            const result = await TCB.api.returns.create({
              boxId: item.boxId,
              productId: item.id,
              reason,
              requestedSize,
              notes,
              pickupAddress,
              scheduledPickupDate
            });

            close();
            TCB.state.toast(`Solicitud de cambio #${result.returnRequest.id} registrada con éxito.`);
            if (onCompleted) onCompleted();
          } catch (err) {
            errEl.textContent = err.message || 'Error al procesar la solicitud.';
          }
        });
      }
    });
  }

  function mount(root) {
    root.querySelector('[data-login-trigger]')?.addEventListener('click', () => {
      TCB.views.auth.openLoginModal(async () => {
        await loadReturnsData();
        window.location.reload();
      });
    });

    root.querySelectorAll('[data-open-return-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          const item = JSON.parse(btn.getAttribute('data-open-return-modal'));
          openReturnModal(item, async () => {
            await loadReturnsData();
            // Re-render
            const container = document.getElementById('app-view');
            if (container) {
              container.innerHTML = render(TCB.state.get());
              mount(container);
            }
          });
        } catch (e) {
          console.error('Error opening return modal:', e);
        }
      });
    });

    // Check if query param ?item=xxx is present in hash
    const hash = window.location.hash;
    if (hash.includes('?item=') && cachedData) {
      const itemId = hash.split('?item=')[1];
      const match = (cachedData.returnableGarments || []).find(i => i.id === itemId);
      if (match) {
        openReturnModal(match, async () => {
          await loadReturnsData();
          window.location.hash = '#/devoluciones';
        });
      }
    }
  }

  return {
    render,
    mount,
    loadReturnsData
  };
})();
