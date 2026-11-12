// Admin tab "Solicitudes de datos" (HU-16): export, rectification and deletion requests
// by type with average response time against the legal deadline, and the request log.
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.datarequests = (() => {
  // HU-16: solicitudes de los titulares y tiempo de respuesta frente al plazo legal
  function renderDataRequestsTab(data) {
    if (!data) return '<p class="muted">Sin solicitudes.</p>';
    const TYPES = { EXPORT: 'Consulta (exportación)', RECTIFICATION: 'Rectificación', DELETION: 'Supresión' };
    const time = ms => (ms < 1000 ? `${ms} ms` : `${Math.round(ms / 1000)} s`);
    return `
      <div class="stack" style="--stack:20px">
        <div>
          <h2 class="display" style="font-size:var(--fs-xl)">Solicitudes de datos personales</h2>
          <p class="small muted">Derechos del titular (Ley 1581 de 2012). Las solicitudes desde "Mis datos" se resuelven en el acto.</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
          ${data.summary.map(t => `
            <div style="background:var(--sheet);border:var(--line);padding:14px">
              <p class="small muted">${TYPES[t.type] || t.type}</p>
              <p class="display" style="font-size:var(--fs-2xl)">${t.count}</p>
              <p class="small muted">Respuesta promedio ${time(t.avgResponseMs)} · plazo legal ${t.deadlineBusinessDays} días hábiles${t.blocked ? ` · ${t.blocked} bloqueadas` : ''}</p>
            </div>
          `).join('') || '<p class="muted">Aún no hay solicitudes.</p>'}
        </div>
        ${data.requests.length ? `
          <div style="overflow-x:auto">
            <table class="returns-history-table">
              <thead><tr><th>Fecha</th><th>Titular</th><th>Tipo</th><th>Estado</th><th>Respuesta</th><th>Detalle</th></tr></thead>
              <tbody>${data.requests.map(r => `
                <tr>
                  <td class="small">${new Date(r.requestedAt).toLocaleString('es-CO')}</td>
                  <td class="small">${r.userName}</td>
                  <td class="small">${TYPES[r.type] || r.type}</td>
                  <td class="small">${r.status === 'BLOCKED' ? 'Bloqueada' : 'Resuelta'}</td>
                  <td class="mono small">${time(r.responseMs)}</td>
                  <td class="small">${r.detail}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    `;
  }

  return { render: data => renderDataRequestsTab(data.dataRequests) };
})();
