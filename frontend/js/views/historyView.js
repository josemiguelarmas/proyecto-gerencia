// History View — Historial Completo de Cajas Pasadas y Prendas Recibidas
window.TCB = window.TCB || {};
TCB.views = TCB.views || {};

TCB.views.history = (() => {
  const { icon, logoSvg, garmentSvg } = TCB.brand;

  let cachedHistory = null;

  async function loadHistoryData() {
    try {
      const res = await TCB.api.boxes.history();
      cachedHistory = res.history || [];
      return cachedHistory;
    } catch (e) {
      console.error('Error fetching history:', e);
      return [];
    }
  }

  function render(store) {
    const user = store.user;

    if (!user) {
      return `
        <div class="screen wrap">
          <div class="banner banner--warn" style="max-width:540px;margin:var(--s-8) auto;text-align:center">
            ${icon('alert', 32)}
            <h2 style="font-size:var(--fs-xl);margin-top:8px">Historial de Entregas</h2>
            <p class="muted">Inicia sesión para revisar tus cajas y prendas pasadas.</p>
            <div style="margin-top:16px;display:flex;gap:12px;justify-content:center">
              <button type="button" class="btn btn--gold" data-login-trigger>Iniciar Sesión</button>
            </div>
          </div>
        </div>
      `;
    }

    const history = cachedHistory || [];

    return `
      <div class="screen wrap">
        <div class="screen-head">
          <span class="badge badge--dark">Archivo Personal</span>
          <h1 class="screen-title display">Historial de Cajas Recibidas</h1>
          <p class="muted">
            Todas las selecciones de moda independiente colombiana que han llegado a tu puerta.
          </p>
        </div>

        ${history.length === 0 ? `
          <div style="background:var(--sheet);border:var(--line);padding:var(--s-8);text-align:center;max-width:580px;margin:var(--s-6) auto">
            ${logoSvg(48)}
            <h2 class="display" style="font-size:var(--fs-2xl);margin-top:16px">Aún no tienes cajas archivadas</h2>
            <p class="muted" style="margin-top:8px">
              Una vez que tu caja activa sea entregada y desempacada, pasará automáticamente a formar parte de tu historial de estilo.
            </p>
            <div style="margin-top:20px">
              <a href="#/caja" class="btn btn--gold">Consultar mi caja activa</a>
            </div>
          </div>
        ` : `
          <div class="stack" style="--stack:32px">
            ${history.map(box => renderHistoryCycle(box)).join('')}
          </div>
        `}
      </div>
    `;
  }

  function renderHistoryCycle(box) {
    const items = box.items || [];
    const isRated = box.status === 'RATED' || (box.ratings && Object.keys(box.ratings).length > 0);

    return `
      <section class="history-cycle-card">
        <div class="history-cycle-head">
          <div>
            <div style="display:flex;gap:10px;align-items:center">
              <span class="badge badge--dark">Ciclo #${box.cycle || 1}</span>
              <span class="mono small muted">Guía: ${box.trackingNumber || box.id}</span>
            </div>
            <h2 class="display" style="font-size:var(--fs-2xl);margin-top:6px">
              ${box.plan === 'STYLE' ? 'Plan Estilo (5 piezas)' : 'Plan Esencial (3 piezas)'}
            </h2>
            <p class="small muted">
              Entregado: <strong>${box.deliveredAt ? new Date(box.deliveredAt).toLocaleDateString('es-CO') : 'Recientemente'}</strong> · Dirección: ${box.shippingAddress || 'Cali, Colombia'}
            </p>
          </div>
          <div>
            ${isRated 
              ? `<span class="badge badge--accent">${icon('check', 13)} Calificado</span>`
              : `<span class="badge badge--dark">Completado</span>`
            }
          </div>
        </div>

        <!-- GRILLA DE PRENDAS DE ESTE CICLO -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:20px">
          ${items.map(item => {
            const itemRating = box.ratings ? box.ratings[item.id] : null;
            const stars = itemRating ? itemRating.stars : null;

            return `
              <div style="background:var(--paper-2);border:var(--hair);padding:16px;border-radius:var(--r-1);display:grid;gap:12px">
                <div style="display:flex;justify-content:space-between;align-items:baseline">
                  <span class="badge badge--dark" style="font-size:10px">${item.brand}</span>
                  <span class="mono" style="font-weight:700;font-size:var(--fs-sm)">Talla ${item.recommendedSize}</span>
                </div>

                <div style="height:170px;overflow:hidden;border-radius:var(--r-1);background:var(--sheet)">
                  <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80'}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover" loading="lazy" />
                </div>

                <div>
                  <h4 style="font-weight:700;font-size:var(--fs-base)">${item.name}</h4>
                  <p class="small muted">${item.fabric} · Corte ${item.fit}</p>
                  <p class="mono small" style="margin-top:4px;font-weight:600">$${Number(item.price).toLocaleString('es-CO')}</p>
                </div>

                <div style="border-top:var(--hair);padding-top:10px;display:flex;justify-content:space-between;align-items:center">
                  <div>
                    ${stars ? `
                      <span class="small" style="color:var(--brand-box);font-weight:700">★ ${stars}/5</span>
                    ` : `
                      <span class="small muted">Sin calificar</span>
                    `}
                  </div>
                  <a href="#/devoluciones?item=${item.id}" class="btn btn--quiet btn--sm" style="font-size:11px;color:var(--brand-box)">
                    ${icon('return', 12)} Cambio talla
                  </a>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  function mount(root) {
    root.querySelector('[data-login-trigger]')?.addEventListener('click', () => {
      TCB.views.auth.openLoginModal(async () => {
        await loadHistoryData();
        window.location.reload();
      });
    });
  }

  return {
    render,
    mount,
    loadHistoryData
  };
})();
