// Admin tab "Clientes & Medidas": registered users with role, body measures, fit
// preference, usual size, number of boxes and the status of their current box.
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.clients = (() => {
  // PESTAÑA 2: CLIENTES & PERFILES ANTROPOMÉTRICOS
  function renderClientsTab(clients) {
    return `
      <div>
        <h2 class="display" style="font-size:var(--fs-xl);margin-bottom:16px">Clientes Registrados y Medidas Corporales</h2>
        <div style="overflow-x:auto;background:var(--sheet);border:var(--line);border-radius:var(--r-1)">
          <table class="returns-history-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Rol</th>
                <th>Estatura / Peso</th>
                <th>Silueta / Fit</th>
                <th>Talla Usual</th>
                <th>Cajas</th>
                <th>Estado Actual</th>
              </tr>
            </thead>
            <tbody>
              ${clients.map(c => {
                const p = c.profile || {};
                const m = p.measures || {};
                return `
                  <tr>
                    <td>
                      <strong>${c.name}</strong>
                      <div class="small muted">${c.email}</div>
                    </td>
                    <td><span class="badge ${c.role === 'ADMIN' ? 'badge--accent' : 'badge--dark'}">${c.role}</span></td>
                    <td>${m.height ? `${m.height} cm / ${m.weight} kg` : (p.heightCm ? `${p.heightCm} cm / ${p.weightKg} kg` : '174 cm / 68 kg')}</td>
                    <td>${m.build || p.bodyBuild || 'Media'} · ${p.fit || p.fitPreference || 'Regular'}</td>
                    <td><span class="mono" style="font-weight:700">${m.usual || p.usualSizeTop || 'M'}</span></td>
                    <td>${c.boxesCount || 1} cajas</td>
                    <td><span class="badge badge--dark">${c.currentBoxStatus || 'ACTIVA'}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return { render: data => renderClientsTab(data.clients) };
})();
