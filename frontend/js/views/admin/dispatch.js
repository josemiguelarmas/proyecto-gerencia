// Admin tab "Por despachar" (HU-09): picking list and packing per approved box, with the
// buttons that move a box to preparation or dispatch it with a SIMULADO shipping label.
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.dispatch = (() => {
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

  function mount(root, ctx) {
    root.querySelectorAll('[data-dispatch-box]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const boxId = btn.getAttribute('data-dispatch-box');
        try {
          const res = await TCB.api.admin.updateBoxStatus(boxId, btn.getAttribute('data-dispatch-status'));
          TCB.state.toast(res.box.trackingNumber ? `Caja despachada con guía ${res.box.trackingNumber}. Aviso enviado al suscriptor.` : 'Caja en preparación.', { ms: 6000 });
          await ctx.loadAdminData();
          ctx.rerender();
        } catch (e) {
          TCB.state.toast(e.message || 'No se pudo actualizar la caja.', { type: 'danger' });
        }
      });
    });
  }

  return { render: data => renderDispatchTab(data.dispatch), mount };
})();
