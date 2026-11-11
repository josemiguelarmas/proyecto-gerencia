// Admin tab "Feedback de Estilo": every garment rating with fit and style scores and
// comments, and the button that retrains the engine with the pending feedback (HU-11).
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.feedback = (() => {
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

  function mount(root, ctx) {
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
  }

  return { render: data => renderFeedbackTab(data.feedback), mount };
})();
