// Admin tab "Facturación" (HU-15): SIMULADO electronic invoices with their status and
// retry schedule, open invoicing alerts, and the button that retries pending invoices.
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.invoices = (() => {
  const { cop } = TCB.adminFormat;

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

  function mount(root, ctx) {
    root.querySelector('#btn-run-invoice-retries')?.addEventListener('click', async () => {
      try {
        const res = await TCB.api.admin.runInvoiceRetries();
        await ctx.loadAdminData();
        ctx.rerender();
        TCB.state.toast(`Facturas reintentadas: ${res.retried} · emitidas: ${res.issued} · siguen pendientes: ${res.stillPending}.`);
      } catch (e) {
        TCB.state.toast(e.message || 'Error al reintentar facturas.', { type: 'danger' });
      }
    });
  }

  return { render: data => renderInvoicesTab(data.invoices), mount };
})();
