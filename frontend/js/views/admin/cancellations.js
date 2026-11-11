// Admin tab "Motivos de Cancelación": bar chart of the exit survey reasons with the
// number of cancellations that skipped the survey (HU-13).
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.cancellations = (() => {
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

  return { render: data => renderCancellationsTab(data.cancellationReasons) };
})();
