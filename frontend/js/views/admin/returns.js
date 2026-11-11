// Admin tab "Devoluciones por Talla": size exchange and return requests with the
// pickup data and a status selector; marking a garment received puts it back in stock (HU-14).
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.returns = (() => {
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

  function mount(root, ctx) {
    // Cambios de estado de devolución por Admin
    root.querySelectorAll('.admin-return-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const returnId = sel.getAttribute('data-return-id');
        const newStatus = sel.value;
        try {
          await TCB.api.admin.updateReturn(returnId, { status: newStatus });
          TCB.state.toast(`Solicitud de devolución #${returnId} actualizada a ${newStatus}.`);
          await ctx.loadAdminData();
        } catch (e) {
          TCB.state.toast(e.message || 'Error al actualizar devolución.', { type: 'danger' });
        }
      });
    });
  }

  return { render: data => renderReturnsTab(data.returns), mount };
})();
