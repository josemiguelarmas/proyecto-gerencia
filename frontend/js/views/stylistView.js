// Stylist View — Cola de curaduría: el estilista revisa, ajusta y aprueba las cajas propuestas (HU-07)
window.TCB = window.TCB || {};
TCB.views = TCB.views || {};

TCB.views.stylist = (() => {
  const { icon } = TCB.brand;

  let queue = [];
  let selectedId = null;

  const STYLE_NAMES = { urbano: 'Urbano', minimal: 'Minimal', retro: 'Retro', clasico: 'Clásico', deportivo: 'Deportivo', artesanal: 'Artesanal' };
  const cop = n => `$${Number(n || 0).toLocaleString('es-CO')}`;

  async function loadQueue() {
    try {
      queue = (await TCB.api.stylist.queue()).boxes || [];
    } catch (e) {
      queue = [];
    }
    if (!queue.some(b => b.id === selectedId)) selectedId = queue[0] ? queue[0].id : null;
    return queue;
  }

  function render(store) {
    const user = store.user;
    if (!user || (user.role !== 'STYLIST' && user.role !== 'ADMIN')) {
      return `
        <div class="screen wrap">
          <div class="banner banner--warn" style="max-width:540px;margin:var(--s-8) auto;text-align:center">
            ${icon('alert', 32)}
            <h2 style="font-size:var(--fs-xl);margin-top:8px">Cola de curaduría</h2>
            <p class="muted">Esta sección es para el equipo de estilistas. Inicia sesión con una cuenta de estilista.</p>
            <button type="button" class="btn btn--gold" style="margin-top:16px" data-login-trigger>Iniciar sesión</button>
          </div>
        </div>
      `;
    }

    const box = queue.find(b => b.id === selectedId);

    return `
      <div class="screen wrap">
        <div class="screen-head">
          <span class="badge badge--dark">Estilista</span>
          <h1 class="screen-title display">Cola de curaduría</h1>
          <p class="muted">Revisa cada caja propuesta por el motor. Aprueba, reemplaza prendas o rechaza la propuesta. Nada se despacha sin tu aprobación.</p>
        </div>

        ${queue.length === 0 ? `
          <div style="background:var(--sheet);border:var(--line);padding:var(--s-8);text-align:center">
            <h2 class="display" style="font-size:var(--fs-xl)">No hay cajas por revisar</h2>
            <p class="muted" style="margin-top:8px">Cuando el motor proponga nuevas cajas aparecerán aquí.</p>
          </div>
        ` : `
          <div class="stylist-layout">
            <aside class="stack" style="--stack:8px" aria-label="Cajas propuestas">
              <p class="small mono muted">${queue.length} CAJA${queue.length === 1 ? '' : 'S'} PROPUESTA${queue.length === 1 ? '' : 'S'}</p>
              ${queue.map(b => `
                <button type="button" class="stylist-queue-item ${b.id === selectedId ? 'is-active' : ''}" data-select-box="${b.id}">
                  <strong>${b.subscriber ? b.subscriber.name : 'Suscriptor'}</strong>
                  <span class="small muted">Ciclo #${b.cycle} · Plan ${b.plan} · ${b.items.length} prendas</span>
                  ${b.withinCap === false ? '<span class="small" style="color:var(--danger)">Supera el costo objetivo</span>' : ''}
                </button>
              `).join('')}
            </aside>
            ${box ? renderBox(box) : ''}
          </div>
        `}
      </div>
    `;
  }

  function renderBox(box) {
    const p = box.profile;
    const m = p.measures || {};
    return `
      <section class="stack" style="--stack:20px">
        <div style="background:var(--sheet);border:var(--line);padding:20px">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
              <p class="small mono muted">PERFIL DEL SUSCRIPTOR</p>
              <h2 style="font-size:var(--fs-xl);font-weight:700">${box.subscriber ? box.subscriber.name : ''}</h2>
              <p class="small muted">${box.subscriber ? box.subscriber.email : ''}</p>
            </div>
            <div style="text-align:right">
              <p class="small muted">Costo de la caja</p>
              <p class="mono" style="font-weight:700;color:${box.withinCap === false ? 'var(--danger)' : 'inherit'}">${cop(box.totalCostCOP)} / ${cop(box.targetCostCOP)}</p>
              <p class="small muted">costo mayorista / objetivo</p>
            </div>
          </div>
          <div class="grid" style="--cols:repeat(auto-fit, minmax(150px, 1fr));gap:12px;margin-top:14px">
            <div><p class="small muted">Estilos</p><p class="small" style="font-weight:600">${(p.styles || []).map(s => STYLE_NAMES[s] || s).join(' · ') || '—'}</p></div>
            <div><p class="small muted">Ocasiones</p><p class="small" style="font-weight:600">${(p.occasions || []).join(' · ') || '—'}</p></div>
            <div><p class="small muted">Corte preferido</p><p class="small" style="font-weight:600">${p.fit || '—'}</p></div>
            <div><p class="small muted">Medidas</p><p class="small" style="font-weight:600">${m.height || '—'} cm · ${m.weight || '—'} kg · talla ${m.usual || '—'}</p></div>
          </div>
        </div>

        <div class="stack" style="--stack:12px">
          ${box.items.map(item => `
            <article style="background:var(--sheet);border:var(--line);padding:14px;display:flex;gap:14px;flex-wrap:wrap">
              <img src="${item.imageUrl}" alt="${item.name}" style="width:72px;height:90px;object-fit:cover;border-radius:var(--r-1);flex:none" loading="lazy">
              <div style="flex:1;min-width:200px">
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                  <span class="badge badge--dark" style="font-size:10px">${item.brandName}</span>
                  <span class="small mono muted">${item.category} · talla ${item.fit.size} · stock ${item.stockInSize} · ${cop(item.wholesalePriceCOP)}</span>
                </div>
                <h3 style="font-weight:700;font-size:var(--fs-base);margin-top:4px">${item.name}</h3>
                <p class="small" style="margin-top:4px">${item.recommendation.explanation}</p>
                <p class="small mono muted">Puntaje ${item.recommendation.score}</p>
              </div>
              <button type="button" class="btn btn--ghost btn--sm" style="align-self:center" data-replace-item="${item.id}" data-category="${item.category}">Reemplazar</button>
            </article>
          `).join('')}
        </div>

        ${box.reviewLog.length ? `
          <div class="small muted">
            <p class="mono">HISTORIAL DE REVISIÓN</p>
            ${box.reviewLog.map(l => `<p>${new Date(l.at).toLocaleString('es-CO')} · ${l.byName} · ${l.action}${l.reason ? ` · "${l.reason}"` : ''}</p>`).join('')}
          </div>
        ` : ''}

        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end">
          <button type="button" class="btn btn--quiet" id="btn-reject-box" style="color:var(--danger)">Rechazar propuesta</button>
          <button type="button" class="btn btn--gold" id="btn-approve-box">${icon('check')} Aprobar · Lista para despacho</button>
        </div>
      </section>
    `;
  }

  function rerender() {
    const container = document.getElementById('app-view');
    if (!container) return;
    container.innerHTML = render(TCB.state.get());
    mount(container);
  }

  async function afterAction(message) {
    TCB.state.toast(message);
    await loadQueue();
    rerender();
  }

  function askReason({ title, label, confirmText }, onConfirm) {
    TCB.state.modal({
      eyebrow: 'Estilista',
      title,
      body: `
        <form id="reason-form" class="stack" style="--stack:14px" novalidate>
          <div class="field">
            <label for="reason-text">${label}</label>
            <textarea class="input" id="reason-text" name="reason" rows="3" required maxlength="300"></textarea>
          </div>
          <p class="error small" id="reason-error" role="alert"></p>
          <button type="submit" class="btn btn--gold btn--block">${confirmText}</button>
        </form>
      `,
      onMount(modalEl, close) {
        const form = modalEl.querySelector('#reason-form');
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const reason = form.elements.reason.value.trim();
          if (!reason) {
            modalEl.querySelector('#reason-error').textContent = 'Escribe el motivo.';
            return;
          }
          try {
            await onConfirm(reason);
            close();
          } catch (err) {
            modalEl.querySelector('#reason-error').textContent = err.data?.error || err.message;
          }
        });
      }
    });
  }

  async function openReplaceModal(boxId, itemId, category) {
    let alternatives = [];
    try {
      alternatives = (await TCB.api.stylist.alternatives(boxId)).alternatives.filter(a => a.category === category);
    } catch (e) { /* se muestra vacío */ }

    TCB.state.modal({
      eyebrow: 'Reemplazar prenda',
      title: 'Elige la nueva prenda',
      body: `
        <form id="replace-form" class="stack" style="--stack:14px" novalidate>
          ${alternatives.length === 0 ? '<p class="muted">No hay alternativas con stock en la talla del suscriptor.</p>' : `
            <div class="stack" style="--stack:8px;max-height:320px;overflow:auto">
              ${alternatives.map((a, i) => `
                <label style="display:flex;gap:10px;align-items:center;cursor:pointer;border:var(--hair);padding:8px;border-radius:var(--r-1)">
                  <input type="radio" name="newProductId" value="${a.productId}" ${i === 0 ? 'checked' : ''}>
                  <img src="${a.imageUrl}" alt="" style="width:40px;height:50px;object-fit:cover;border-radius:2px">
                  <span class="small"><strong>${a.name}</strong><br>${a.brandName} · talla ${a.size} · stock ${a.stockInSize} · puntaje ${a.score}</span>
                </label>
              `).join('')}
            </div>
          `}
          <div class="field">
            <label for="replace-reason">Motivo del cambio</label>
            <textarea class="input" id="replace-reason" name="reason" rows="2" required maxlength="300" placeholder="Ej. Prefiere colores neutros"></textarea>
          </div>
          <p class="error small" id="replace-error" role="alert"></p>
          <button type="submit" class="btn btn--gold btn--block" ${alternatives.length === 0 ? 'disabled' : ''}>Reemplazar</button>
        </form>
      `,
      onMount(modalEl, close) {
        const form = modalEl.querySelector('#replace-form');
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const errEl = modalEl.querySelector('#replace-error');
          const checked = form.querySelector('input[name="newProductId"]:checked');
          const reason = form.elements.reason.value.trim();
          if (!checked) return;
          if (!reason) {
            errEl.textContent = 'Escribe el motivo del cambio.';
            return;
          }
          try {
            const res = await TCB.api.stylist.replace(boxId, { itemId, newProductId: checked.value, reason });
            close();
            afterAction(res.message);
          } catch (err) {
            errEl.textContent = err.data?.error || err.message;
          }
        });
      }
    });
  }

  function mount(root) {
    root.querySelector('[data-login-trigger]')?.addEventListener('click', () => {
      TCB.views.auth.openLoginModal(() => TCB.app.navigate('#/estilista'));
    });

    root.querySelectorAll('[data-select-box]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedId = btn.dataset.selectBox;
        rerender();
      });
    });

    root.querySelectorAll('[data-replace-item]').forEach(btn => {
      btn.addEventListener('click', () => openReplaceModal(selectedId, btn.dataset.replaceItem, btn.dataset.category));
    });

    root.querySelector('#btn-approve-box')?.addEventListener('click', async () => {
      try {
        const res = await TCB.api.stylist.approve(selectedId);
        afterAction(res.message);
      } catch (err) {
        TCB.state.toast(err.data?.error || err.message);
      }
    });

    root.querySelector('#btn-reject-box')?.addEventListener('click', () => {
      askReason({ title: 'Rechazar propuesta', label: 'Motivo del rechazo', confirmText: 'Rechazar y pedir nueva propuesta' }, async reason => {
        const res = await TCB.api.stylist.reject(selectedId, reason);
        afterAction(res.message);
      });
    });
  }

  return { render, mount, loadQueue };
})();
