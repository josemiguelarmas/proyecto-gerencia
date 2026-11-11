// Admin tab "Pagos" (HU-08): gateway fees and net amounts, reconciliation, fees per
// month, subscriptions and latest payments, plus the manual recurring billing run.
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.payments = (() => {
  const { cop } = TCB.adminFormat;

  const SUB_STATUS = { ACTIVE: 'Activa', PAUSED: 'En pausa', PAST_DUE: 'Pago pendiente', CANCELLED: 'Cancelada' };

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
            ['Conciliados', `${r.reconciliation.OK} OK · ${r.reconciliation.PENDING} pendientes · ${r.reconciliation.MISMATCH} con diferencia · ${r.reconciliation.MISSING || 0} sin registro en la pasarela`]
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

  function mount(root, ctx) {
    root.querySelector('#btn-run-billing')?.addEventListener('click', async () => {
      const dateValue = root.querySelector('#billing-date').value;
      try {
        const res = await TCB.api.admin.runBilling(dateValue ? `${dateValue}T12:00:00` : undefined);
        await ctx.loadAdminData();
        ctx.rerender();
        document.querySelector('#billing-report').innerHTML = `
          <div class="banner banner--info"><p class="small">Cobro del ${new Date(res.ranAt).toLocaleDateString('es-CO')}: <strong>${res.approved}</strong> aprobados · ${res.failed} rechazados con reintento programado · ${res.pastDue} pasaron a pago pendiente · ${res.resumed} reanudadas tras la pausa.</p></div>
        `;
      } catch (e) {
        TCB.state.toast(e.message || 'Error al ejecutar el cobro.', { type: 'danger' });
      }
    });
  }

  return { render: data => renderPaymentsTab(data.payments), mount };
})();
