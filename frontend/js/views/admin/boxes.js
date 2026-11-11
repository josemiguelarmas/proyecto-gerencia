// Admin tab "Cajas & Despachos": every box with its curated garments, cost against the
// target and a manual status selector (approval stays in the stylist queue), plus the button
// that generates the monthly batch of proposed boxes (HU-06). Also the default tab.
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.boxes = (() => {
  const { icon } = TCB.brand;
  const { cop } = TCB.adminFormat;

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

  function mount(root, ctx) {
    root.querySelector('#btn-generate-batch')?.addEventListener('click', async () => {
      try {
        const res = await TCB.api.admin.generateBatch();
        await ctx.loadAdminData();
        ctx.rerender();
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

    // Cambios de estado de caja por Admin
    root.querySelectorAll('.admin-status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const boxId = sel.getAttribute('data-box-id');
        const newStatus = sel.value;
        try {
          await TCB.api.admin.updateBoxStatus(boxId, newStatus);
          TCB.state.toast(`Estado de caja #${boxId} actualizado a ${newStatus}.`);
          await ctx.loadAdminData();
        } catch (e) {
          TCB.state.toast(e.message || 'Error al actualizar estado.', { type: 'danger' });
          await ctx.loadAdminData();
          ctx.rerender();
        }
      });
    });
  }

  return { render: data => renderBoxesTab(data.boxes), mount };
})();
