// Admin tab "Programa de Referidos" (HU-18, SCRUM-110..113):
// Muestra el resumen de conversiones, anti-fraude y listado de referidos.
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.referrals = (() => {
  const cop = n => `COP ${Number(n || 0).toLocaleString('es-CO')}`;
  const day = iso => (iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

  function renderReferralsTab(data) {
    const report = data?.referralsReport || { summary: {}, referrals: [] };
    const { summary = {}, referrals = [] } = report;

    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px;flex-wrap:wrap;gap:12px">
          <div>
            <h2 class="display" style="font-size:var(--fs-xl)">Conversiones y Programa Trae un Amigo (HU-18)</h2>
            <p class="small muted">Métricas de adquisición orgánica por referidos con reglas anti-fraude activas.</p>
          </div>
        </div>

        <!-- TARJETAS DE RESUMEN DE REFERIDOS -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:16px;margin-bottom:var(--s-6)">
          <div style="background:var(--sheet);border:var(--line);padding:18px;border-radius:var(--r-1)">
            <p class="mono small muted">TOTAL REGISTROS REFERIDOS</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:4px">${summary.totalReferrals || 0}</h3>
            <span class="small muted">${summary.pending || 0} pendientes de primera caja</span>
          </div>
          <div style="background:var(--sheet);border:var(--line);padding:18px;border-radius:var(--r-1)">
            <p class="mono small muted">CONVERSIONES EFECTIVAS</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:4px;color:#2a6e4b">${summary.converted || 0}</h3>
            <span class="small" style="color:#2a6e4b">Tasa: ${summary.conversionRatePct || 0}%</span>
          </div>
          <div style="background:var(--sheet);border:var(--line);padding:18px;border-radius:var(--r-1)">
            <p class="mono small muted">BENEFICIOS OTORGADOS</p>
            <h3 class="display" style="font-size:var(--fs-3xl);margin-top:4px;color:var(--brand-box)">${cop(summary.totalRewardsGrantedCOP || 0)}</h3>
            <span class="small muted">Incentivo bilateral de COP 20.000</span>
          </div>
        </div>

        <!-- TABLA DE REFERIDOS -->
        <div style="background:var(--sheet);border:var(--line);border-radius:var(--r-1);overflow:hidden">
          <div style="padding:16px 20px;border-bottom:var(--hair);background:var(--paper-2);display:flex;justify-content:space-between;align-items:center">
            <strong style="font-size:var(--fs-sm)">Registro Histórico de Referidos</strong>
            <span class="mono small muted">${referrals.length} registros</span>
          </div>
          <div style="overflow-x:auto">
            <table class="table" style="width:100%;font-size:var(--fs-sm);margin:0">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Referente (Emisor)</th>
                  <th>Amigo Referido</th>
                  <th>Estado</th>
                  <th>Descuento Referido</th>
                  <th>Recompensa Referente</th>
                  <th>Fecha Registro</th>
                  <th>Fecha Conversión</th>
                </tr>
              </thead>
              <tbody>
                ${referrals.length ? referrals.map(r => `
                  <tr>
                    <td><strong class="mono" style="color:var(--brand-box)">${r.referralCode}</strong></td>
                    <td>
                      <div><strong>${r.referrerName}</strong></div>
                      ${r.referrerEmail ? `<div class="mono small muted">${r.referrerEmail}</div>` : ''}
                    </td>
                    <td>
                      <div><strong>${r.referredName}</strong></div>
                      ${r.referredEmail ? `<div class="mono small muted">${r.referredEmail}</div>` : ''}
                    </td>
                    <td>
                      <span class="badge ${r.status === 'CONVERTED' ? 'badge--success' : 'badge--neutral'}">
                        ${r.status === 'CONVERTED' ? 'Convertido' : 'Pendiente'}
                      </span>
                    </td>
                    <td class="mono">${cop(r.discountCOP)}</td>
                    <td class="mono">${cop(r.referrerRewardCOP)}</td>
                    <td class="mono small">${day(r.createdAt)}</td>
                    <td class="mono small">${r.convertedAt ? day(r.convertedAt) : '—'}</td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="8" class="muted" style="text-align:center;padding:24px">No hay registros de referidos hasta el momento.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  return {
    render: data => renderReferralsTab(data)
  };
})();
