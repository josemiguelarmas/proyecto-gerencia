// Admin tab "Bandeja de Salida": the simulated e-mails the system would have sent
// (MAIL_PROVIDER=simulated) and the button that runs the rating reminder job (HU-10).
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.outbox = (() => {
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

  function mount(root, ctx) {
    root.querySelector('#btn-run-reminders')?.addEventListener('click', async () => {
      try {
        const res = await TCB.api.admin.runReviewReminders();
        await ctx.loadAdminData();
        ctx.rerender();
        TCB.state.toast(`Recordatorios enviados: ${res.sent}.`);
      } catch (e) {
        TCB.state.toast('Error al ejecutar los recordatorios.', { type: 'danger' });
      }
    });
  }

  return { render: data => renderOutboxTab(data.outbox), mount };
})();
