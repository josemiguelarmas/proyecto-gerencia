// Admin tab "KPIs del mes" (HU-17): active subscribers, new subscribers, churn, average
// rating and size returns for a month and plan, the editable churn threshold and its alert.
// It owns the month and plan filter, which the shell also uses when it reloads all data.
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.monthly = (() => {
  let filter = { month: null, plan: 'all' };

  const PLAN_FILTERS = { all: 'Todos los planes', esencial: 'Esencial', estilo: 'Estilo' };
  const pct = v => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('es-CO')} %`);

  // HU-17: indicadores del mes con filtros, umbral de churn editable y alerta
  function renderMonthlyKpisTab(k) {
    if (!k) return '<p class="muted">Sin indicadores.</p>';
    const monthName = m => new Date(`${m}-15T12:00:00`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    const max = Math.max(1, ...k.cancellationReasons.reasons.map(r => r.count));
    return `
      <div class="stack" style="--stack:24px">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap">
          <div>
            <h2 class="display" style="font-size:var(--fs-xl)">KPIs del mes</h2>
            <p class="small muted">Churn = cancelaciones del mes ÷ suscriptores activos al inicio del mes.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
            <div class="field" style="margin:0">
              <label for="kpi-month" class="small">Mes</label>
              <select class="input" id="kpi-month">${k.months.map(m => `<option value="${m}" ${m === k.month ? 'selected' : ''}>${monthName(m)}</option>`).join('')}</select>
            </div>
            <div class="field" style="margin:0">
              <label for="kpi-plan" class="small">Plan</label>
              <select class="input" id="kpi-plan">${Object.entries(PLAN_FILTERS).map(([v, l]) => `<option value="${v}" ${v === k.plan ? 'selected' : ''}>${l}</option>`).join('')}</select>
            </div>
            <div class="field" style="margin:0">
              <label for="kpi-threshold" class="small">Umbral de churn (%)</label>
              <div style="display:flex;gap:6px">
                <input class="input mono" id="kpi-threshold" type="number" min="0.1" max="100" step="0.1" value="${k.churnAlert.threshold}" style="width:90px">
                <button type="button" class="btn btn--ghost btn--sm" id="btn-save-threshold">Guardar</button>
              </div>
            </div>
          </div>
        </div>
        ${k.churnAlert.active ? `<div class="banner banner--danger" role="alert"><p class="small"><strong>Alerta de churn.</strong> ${k.churnAlert.message}</p></div>` : `<p class="small muted">Churn dentro del umbral de ${k.churnAlert.threshold} %.</p>`}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
          ${[
            ['Suscriptores activos', k.activeSubscribers, `${k.activeAtStart} al inicio del mes`],
            ['Altas', k.newSubscribers, 'Suscripciones nuevas o reactivadas'],
            ['Churn mensual', pct(k.churnPct), `${k.cancellations} cancelaciones`],
            ['Calificación promedio', k.averageRating === null ? '—' : `★ ${k.averageRating}`, `${k.ratingsCount} calificaciones`],
            ['Devoluciones por talla', pct(k.sizeReturnPct), `${k.sizeReturns} de ${k.deliveredItems} prendas entregadas`]
          ].map(([label, value, hint]) => `
            <div style="background:var(--sheet);border:var(--line);padding:14px">
              <p class="small muted">${label}</p>
              <p class="display" style="font-size:var(--fs-2xl);margin-top:4px">${value}</p>
              <p class="small muted">${hint}</p>
            </div>
          `).join('')}
        </div>
        <div style="max-width:640px">
          <h3 style="font-weight:700;margin-bottom:8px">Motivos de cancelación (${k.cancellationReasons.total} · ${k.cancellationReasons.unanswered} sin responder)</h3>
          <div class="stack" style="--stack:10px">
            ${k.cancellationReasons.reasons.map(r => `
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
        <p class="small muted">Para demostrar el panel: <span class="mono">node scripts/seed-demo.js</span> genera 100 suscriptores sintéticos marcados como datos de prueba (<span class="mono">--reset</span> los borra).</p>
      </div>
    `;
  }

  function mount(root, ctx) {
    // HU-17: filtros y umbral de churn
    const reloadKpis = async () => {
      filter = { month: root.querySelector('#kpi-month').value, plan: root.querySelector('#kpi-plan').value };
      ctx.data.kpis = await TCB.api.admin.kpis(filter);
      ctx.rerender();
    };
    root.querySelector('#kpi-month')?.addEventListener('change', reloadKpis);
    root.querySelector('#kpi-plan')?.addEventListener('change', reloadKpis);
    root.querySelector('#btn-save-threshold')?.addEventListener('click', async () => {
      try {
        const res = await TCB.api.admin.setChurnThreshold(root.querySelector('#kpi-threshold').value);
        TCB.state.toast(`Umbral de churn guardado: ${res.threshold} %.`);
        await reloadKpis();
      } catch (e) {
        TCB.state.toast(e.message, { type: 'danger' });
      }
    });
  }

  return { render: data => renderMonthlyKpisTab(data.kpis), filter: () => filter, mount };
})();
