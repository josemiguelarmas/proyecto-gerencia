// Profile View — Perfil Antropométrico, Calibraciones de Marca y Dirección Cali
window.TCB = window.TCB || {};
TCB.views = TCB.views || {};

TCB.views.profile = (() => {
  const { icon, logoSvg } = TCB.brand;

  function render(store) {
    const user = store.user;
    const profile = store.profile || {};

    if (!user) {
      return `
        <div class="screen wrap">
          <div class="banner banner--warn" style="max-width:540px;margin:var(--s-8) auto;text-align:center">
            ${icon('alert', 32)}
            <h2 style="font-size:var(--fs-xl);margin-top:8px">Perfil de Usuario</h2>
            <p class="muted">Inicia sesión para calibrar tus medidas y marcas preferidas.</p>
            <div style="margin-top:16px;display:flex;gap:12px;justify-content:center">
              <button type="button" class="btn btn--gold" data-login-trigger>Iniciar Sesión</button>
            </div>
          </div>
        </div>
      `;
    }

    const height = profile.heightCm || 178;
    const weight = profile.weightKg || 74;
    const bmi = (weight / Math.pow(height / 100, 2)).toFixed(1);

    return `
      <div class="screen wrap">
        <div class="screen-head">
          <span class="badge badge--dark">Identidad y Medidas</span>
          <h1 class="screen-title display">Mi Perfil y Calibraciones</h1>
          <p class="muted">
            Tus datos físicos y preferencias alimentan el motor algorítmico que calcula la talla exacta para cada marca independiente colombiana.
          </p>
        </div>

        ${user.emailVerified === false ? `
          <div class="banner banner--warn" style="margin-bottom:var(--s-6);display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            ${icon('alert', 20)}
            <p style="flex:1;min-width:200px">Tu correo <strong>${user.email}</strong> aún no está verificado. Revisa el enlace que te enviamos.</p>
            <button type="button" class="btn btn--sm btn--ghost" id="btn-resend-verification">Reenviar enlace</button>
          </div>
        ` : ''}

        <form id="profile-form" class="stack" style="--stack:32px" novalidate>
          <!-- TARJETA 1: DATOS BÁSICOS -->
          <section style="background:var(--sheet);border:var(--line);padding:28px">
            <h2 class="display" style="font-size:var(--fs-xl);margin-bottom:18px">1. Información de Cuenta y Entrega</h2>
            <div class="grid" style="--cols:repeat(auto-fit, minmax(260px, 1fr));gap:16px">
              <div class="field">
                <label for="p-name">Nombre completo</label>
                <input class="input" id="p-name" name="name" type="text" value="${user.name || ''}" required>
              </div>
              <div class="field">
                <label for="p-email">Correo electrónico</label>
                <input class="input" id="p-email" name="email" type="email" value="${user.email || ''}" required autocomplete="email">
                <p class="small muted" style="margin-top:4px">Si lo cambias, te enviamos un enlace para verificar el nuevo correo.</p>
              </div>
              <div class="field" style="grid-column:1 / -1">
                <label for="p-address">Dirección de entrega en Cali</label>
                <input class="input" id="p-address" name="address" type="text" value="${profile.address || 'Av. San Joaquín # 14-80, Ciudad Jardín, Cali'}" required>
                <p class="small muted" style="margin-top:4px">Aquí llegarán mensualmente tus cajas y se recogerán los cambios de talla.</p>
              </div>
            </div>
          </section>

          <!-- TARJETA 2: DATOS ANTROPOMÉTRICOS -->
          <section style="background:var(--sheet);border:var(--line);padding:28px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:18px;flex-wrap:wrap;gap:8px">
              <h2 class="display" style="font-size:var(--fs-xl)">2. Medidas y Silueta Corporal</h2>
              <span class="badge badge--accent">IMC Calculado: ${bmi} kg/m²</span>
            </div>

            <div class="grid" style="--cols:repeat(auto-fit, minmax(220px, 1fr));gap:16px">
              <div class="field">
                <label for="p-height">Estatura (cm)</label>
                <input class="input" id="p-height" name="heightCm" type="number" min="140" max="220" value="${height}" required>
              </div>
              <div class="field">
                <label for="p-weight">Peso aproximado (kg)</label>
                <input class="input" id="p-weight" name="weightKg" type="number" min="40" max="160" value="${weight}" required>
              </div>
              <div class="field">
                <label for="p-build">Contextura corporal</label>
                <select class="input" id="p-build" name="bodyBuild">
                  <option value="DELGADA" ${profile.bodyBuild === 'DELGADA' ? 'selected' : ''}>Delgada / Esbelta</option>
                  <option value="ATLETICA" ${profile.bodyBuild === 'ATLETICA' || !profile.bodyBuild ? 'selected' : ''}>Atlética / Definida</option>
                  <option value="MEDIA" ${profile.bodyBuild === 'MEDIA' ? 'selected' : ''}>Media / Estándar</option>
                  <option value="ROBUSTA" ${profile.bodyBuild === 'ROBUSTA' ? 'selected' : ''}>Robusta / Espalda ancha</option>
                </select>
              </div>
              <div class="field">
                <label for="p-fit">Preferencia de ajuste (Fit)</label>
                <select class="input" id="p-fit" name="fitPreference">
                  <option value="SLIM" ${profile.fitPreference === 'SLIM' ? 'selected' : ''}>Ajustado (Slim / Al cuerpo)</option>
                  <option value="REGULAR" ${profile.fitPreference === 'REGULAR' ? 'selected' : ''}>Regular (Clásico y cómodo)</option>
                  <option value="RELAXED" ${profile.fitPreference === 'RELAXED' || !profile.fitPreference ? 'selected' : ''}>Relajado (Boxy / Oversize ligero)</option>
                </select>
              </div>
            </div>

            <!-- TALLAS HABITUALES -->
            <div style="margin-top:20px;padding-top:16px;border-top:var(--hair)">
              <p style="font-weight:700;font-size:var(--fs-sm);margin-bottom:12px">Tallas que compras comúnmente en tiendas de retail:</p>
              <div class="grid" style="--cols:repeat(auto-fit, minmax(160px, 1fr));gap:16px">
                <div class="field">
                  <label for="p-size-top">Prenda superior</label>
                  <select class="input" id="p-size-top" name="usualSizeTop">
                    <option value="XS" ${profile.usualSizeTop === 'XS' ? 'selected' : ''}>XS</option>
                    <option value="S" ${profile.usualSizeTop === 'S' ? 'selected' : ''}>S</option>
                    <option value="M" ${profile.usualSizeTop === 'M' || !profile.usualSizeTop ? 'selected' : ''}>M</option>
                    <option value="L" ${profile.usualSizeTop === 'L' ? 'selected' : ''}>L</option>
                    <option value="XL" ${profile.usualSizeTop === 'XL' ? 'selected' : ''}>XL</option>
                  </select>
                </div>
                <div class="field">
                  <label for="p-size-bottom">Pantalón / Jean</label>
                  <select class="input" id="p-size-bottom" name="usualSizeBottom">
                    <option value="28" ${profile.usualSizeBottom === '28' ? 'selected' : ''}>28</option>
                    <option value="30" ${profile.usualSizeBottom === '30' ? 'selected' : ''}>30</option>
                    <option value="32" ${profile.usualSizeBottom === '32' || !profile.usualSizeBottom ? 'selected' : ''}>32</option>
                    <option value="34" ${profile.usualSizeBottom === '34' ? 'selected' : ''}>34</option>
                    <option value="36" ${profile.usualSizeBottom === '36' ? 'selected' : ''}>36</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <!-- TARJETA 3: PRENDA DE REFERENCIA -->
          <section style="background:var(--sheet);border:var(--line);padding:28px">
            <h2 class="display" style="font-size:var(--fs-xl);margin-bottom:8px">3. Prenda de Referencia (El Ancla de Ajuste)</h2>
            <p class="small muted" style="margin-bottom:18px">
              Esta prenda de tu clóset nos sirve como patrón geométrico de comparación directa.
            </p>
            <div class="grid" style="--cols:repeat(auto-fit, minmax(240px, 1fr));gap:16px">
              <div class="field">
                <label for="p-ref-brand">Marca de la prenda</label>
                <input class="input" id="p-ref-brand" name="refBrand" type="text" value="${profile.referenceGarment?.brand || 'Zara'}" placeholder="Ej: Zara, Mango, Levi's">
              </div>
              <div class="field">
                <label for="p-ref-size">Talla en esa marca</label>
                <input class="input" id="p-ref-size" name="refSize" type="text" value="${profile.referenceGarment?.size || 'M'}" placeholder="Ej: M o 32">
              </div>
              <div class="field" style="grid-column:1 / -1">
                <label for="p-ref-notes">¿Por qué te queda bien?</label>
                <input class="input" id="p-ref-notes" name="refNotes" type="text" value="${profile.referenceGarment?.notes || 'Caída recta en hombros y no se encoge'}" placeholder="Ej: Buen largo de manga y no me aprieta el pecho">
              </div>
            </div>
          </section>

          <!-- TARJETA 4: CALIBRACIÓN DE MARCAS LOCALES -->
          <section style="background:var(--sheet);border:var(--line);padding:28px">
            <h2 class="display" style="font-size:var(--fs-xl);margin-bottom:8px">4. Marcas Colombianas Aliadas</h2>
            <p class="small muted" style="margin-bottom:18px">
              Nuestro catálogo incluye únicamente diseño local independiente de alto gramaje y confección cuidada.
            </p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px">
              ${[
                { name: 'Ceiba Estudio', city: 'Cali', spec: 'Telas pesadas, siluetas minimalistas y tonos tierra' },
                { name: 'Taller Norte', city: 'Bogotá', spec: 'Sastrería contemporánea, lino y dril estructurado' },
                { name: 'Mono Textil', city: 'Medellín', spec: 'Algodón peinado 240g y cortes relajados' },
                { name: 'True', city: 'Medellín', spec: 'Streetwear vanguardista y tipografía cuidada' },
                { name: 'Punto Blanco', city: 'Medellín', spec: 'Pima peruano y básicos de lujo perdurables' },
                { name: 'Mattelsa', city: 'Medellín', spec: 'Prendas urbanas con enfoque sostenible' }
              ].map(b => `
                <div style="background:var(--paper-2);border:var(--hair);padding:14px;border-radius:var(--r-1)">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <strong style="font-size:var(--fs-sm)">${b.name}</strong>
                    <span class="mono small muted" style="font-size:10px">${b.city}</span>
                  </div>
                  <p class="small muted" style="margin-top:6px;font-size:11px">${b.spec}</p>
                </div>
              `).join('')}
            </div>
          </section>

          <div style="display:flex;justify-content:flex-end;gap:12px">
            <button type="submit" class="btn btn--gold btn--lg" id="btn-save-profile">
              ${icon('check')} Guardar Cambios en Backend
            </button>
          </div>
        </form>

        <!-- HU-03: PERFIL DE ESTILO E HISTORIAL DE VERSIONES -->
        <section style="background:var(--sheet);border:var(--line);padding:28px;margin-top:32px">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline">
            <h2 class="display" style="font-size:var(--fs-xl)">Mi perfil de estilo</h2>
            <button type="button" class="btn btn--ghost btn--sm" id="btn-repeat-quiz">${icon('refresh', 14)} Repetir quiz de estilo</button>
          </div>
          <p class="small muted" style="margin-top:6px">Repetir el quiz crea una nueva versión. Las anteriores se conservan con su fecha.</p>
          <div id="style-history" style="margin-top:14px"><p class="small muted">Cargando…</p></div>
        </section>

        <!-- HU-08/HU-12/HU-13: MI SUSCRIPCIÓN -->
        <section id="subscription-section" style="background:var(--sheet);border:var(--line);padding:28px;margin-top:32px">
          <h2 class="display" style="font-size:var(--fs-xl);margin-bottom:8px">Mi suscripción</h2>
          <div id="subscription-body"><p class="small muted">Cargando…</p></div>
        </section>

        <!-- HU-16: MIS DATOS (derechos del titular, Ley 1581) -->
        <section id="my-data-section" style="background:var(--sheet);border:var(--line);padding:28px;margin-top:32px">
          <h2 class="display" style="font-size:var(--fs-xl);margin-bottom:8px">Mis datos</h2>
          <p class="small muted">Puedes corregir tu nombre y correo arriba en "Información de Cuenta", descargar una copia de todos tus datos o eliminar tu cuenta.</p>
          <div class="sub-actions">
            <button type="button" class="btn btn--ghost" id="btn-export-data">Descargar mis datos (JSON)</button>
            <button type="button" class="btn btn--quiet" id="btn-delete-account" style="color:var(--danger)">Eliminar mi cuenta</button>
          </div>
        </section>

        <!-- HU-15: DATOS DE FACTURACIÓN -->
        <section id="fiscal-section" style="background:var(--sheet);border:var(--line);padding:28px;margin-top:32px">
          <h2 class="display" style="font-size:var(--fs-xl);margin-bottom:8px">Datos de facturación</h2>
          <p class="small muted" style="margin-bottom:12px">Los usamos para tu factura electrónica de cada cobro.</p>
          <div id="fiscal-body"><p class="small muted">Cargando…</p></div>
        </section>
      </div>
    `;
  }

  async function renderStyleHistory(root, profile) {
    const el = root.querySelector('#style-history');
    if (!el) return;
    const describe = p => `${(p.styles || []).join(' · ') || '—'} · ${(p.occasions || []).join(', ') || '—'} · corte ${p.fit || '—'} · plan ${p.plan || '—'}`;
    try {
      const { currentVersion, versions } = await TCB.api.profile.history();
      el.innerHTML = `
        <p class="small"><strong>Versión actual v${currentVersion || 1}:</strong> ${describe(profile)}</p>
        ${versions.length ? `
          <ul class="small muted" style="margin-top:8px;padding-left:18px">
            ${versions.map(v => `<li>v${v.version} · hasta el ${new Date(v.archivedAt).toLocaleDateString('es-CO')} · ${describe(v.snapshot)}</li>`).join('')}
          </ul>
        ` : '<p class="small muted" style="margin-top:6px">Aún no tienes versiones anteriores.</p>'}
      `;
    } catch (e) {
      el.innerHTML = '<p class="small error">No pudimos cargar el historial.</p>';
    }
  }

  const STATUS_NAMES = { ACTIVE: 'Activa', PAUSED: 'En pausa', PAST_DUE: 'Pago pendiente', CANCELLED: 'Cancelada', NONE: 'Sin suscripción' };
  const cop = n => `COP ${Number(n).toLocaleString('es-CO')}`;
  const day = iso => (iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

  async function runAction(root, fn) {
    try {
      const res = await fn();
      TCB.state.toast(res.message);
      await TCB.state.loadUserSession();
      renderSubscription(root);
    } catch (err) {
      TCB.state.toast(err.data?.error || err.message, { type: 'danger' });
    }
  }

  // HU-08/HU-12: estado, tarjeta, próximo cobro y acciones según la matriz de estados.
  async function renderSubscription(root) {
    const bodyEl = root.querySelector('#subscription-body');
    if (!bodyEl) return;
    try {
      const [{ subscription: sub, planChange, payments, invoices }, cfg] = await Promise.all([
        TCB.api.subscription.get(),
        TCB.views.subscribe.loadConfig()
      ]);
      const status = sub.status;
      bodyEl.innerHTML = `
        <p class="small">Plan: <strong>${sub.planName}${sub.priceCOP ? ` · ${cop(sub.priceCOP)}/mes` : ''}</strong> · Estado: <strong>${STATUS_NAMES[status] || status}</strong></p>
        ${sub.cardLast4 && status !== 'CANCELLED' ? `<p class="small muted" style="margin-top:4px">Tarjeta: ${sub.cardBrand} •••• ${sub.cardLast4} <span class="mono">(SIMULADO)</span></p>` : ''}
        ${status === 'ACTIVE' && !sub.dunning ? `<p class="small muted" style="margin-top:4px">Próximo cobro: ${day(sub.nextChargeAt)}</p>` : ''}
        ${sub.pendingPlan ? `<div class="banner banner--info small" style="margin-top:10px">Desde el cobro del ${day(sub.pendingPlanFrom)} pasas al plan <strong>${sub.pendingPlanName}</strong>.</div>` : ''}
        ${status === 'PAUSED' ? `<div class="banner banner--warn small" style="margin-top:10px">Tu plan está en pausa: este mes no te cobramos ni despachamos. Se reanuda solo el <strong>${day(sub.pausedUntil)}</strong>.</div>` : ''}
        ${sub.dunning && status === 'ACTIVE' ? `<div class="banner banner--warn small" style="margin-top:10px">No pudimos cobrar tu plan (${sub.dunning.lastReason}). Lo reintentaremos el ${day(sub.dunning.nextRetryAt)}. Puedes actualizar tu tarjeta ahora.</div>` : ''}
        ${status === 'PAST_DUE' ? `<div class="banner banner--danger small" style="margin-top:10px"><strong>Pago pendiente.</strong> Agotamos los reintentos (${sub.dunning?.lastReason || 'pago rechazado'}). No despacharemos cajas hasta que actualices tu medio de pago.</div>` : ''}
        ${status === 'CANCELLED' ? `<p class="small muted" style="margin-top:6px">Cancelada el ${day(sub.cancelledAt)}. No se harán más cobros ni despachos.</p>` : ''}

        <div class="sub-actions">
          ${status === 'NONE' || status === 'CANCELLED' ? `<a class="btn btn--gold" href="#/suscripcion">${status === 'NONE' ? 'Elegir plan y pagar' : 'Volver a suscribirme'}</a>` : ''}
          ${status === 'PAST_DUE' || sub.dunning ? `<button type="button" class="btn btn--gold" data-sub="card">Actualizar medio de pago</button>` : ''}
          ${status === 'ACTIVE' && !sub.dunning ? `<button type="button" class="btn btn--ghost" data-sub="pause">Pausar 1 mes</button>` : ''}
          ${status === 'PAUSED' ? `<button type="button" class="btn btn--gold" data-sub="resume">Reanudar ahora</button>` : ''}
          ${status === 'ACTIVE' || status === 'PAUSED' ? `<button type="button" class="btn btn--ghost" data-sub="plan">Cambiar plan</button>` : ''}
          ${status === 'ACTIVE' && !sub.dunning ? `<button type="button" class="btn btn--ghost" data-sub="card">Cambiar tarjeta</button>` : ''}
          ${['ACTIVE', 'PAUSED', 'PAST_DUE'].includes(status) ? `<button type="button" class="btn btn--quiet" data-sub="cancel" style="color:var(--danger)">Cancelar suscripción</button>` : ''}
        </div>

        ${payments.length ? `
          <details style="margin-top:16px">
            <summary class="small" style="cursor:pointer;font-weight:600">Pagos y facturas (${payments.length})</summary>
            <table class="returns-history-table" style="margin-top:8px">
              <thead><tr><th>Fecha</th><th>Monto</th><th>Estado</th><th>Factura</th></tr></thead>
              <tbody>
                ${payments.map(p => {
                  const inv = invoices.find(i => i.id === p.invoiceId);
                  return `<tr>
                    <td class="small">${new Date(p.createdAt).toLocaleDateString('es-CO')}</td>
                    <td class="mono small">${cop(p.amountCOP)}</td>
                    <td class="small">${p.status === 'APPROVED' ? 'Aprobado' : `Rechazado · ${p.reason}`}</td>
                    <td class="small">${inv ? `${inv.number} · ${inv.status === 'ISSUED' ? 'emitida' : 'en proceso'}` : '—'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
            <p class="small muted" style="margin-top:6px">Pagos y facturas SIMULADOS (ambiente de habilitación DIAN, sin validez fiscal).</p>
          </details>
        ` : ''}
      `;

      const on = (name, fn) => bodyEl.querySelectorAll(`[data-sub="${name}"]`).forEach(b => b.addEventListener('click', fn));
      on('pause', () => openPauseModal(root));
      on('resume', () => runAction(root, () => TCB.api.subscription.resume()));
      on('plan', () => openPlanModal(root, sub, planChange, cfg));
      on('card', () => openCardModal(root, cfg));
      on('cancel', () => (status === 'ACTIVE' && !sub.dunning ? openPauseInsteadModal(root) : openCancelModal(() => renderSubscription(root))));
    } catch (e) {
      bodyEl.innerHTML = `<p class="small error">No pudimos cargar tu suscripción.</p>`;
    }
  }

  function openPauseModal(root) {
    TCB.state.modal({
      eyebrow: 'Pausar 1 mes',
      title: '¿Pausamos tu próximo mes?',
      body: '<p class="small">No te cobramos ni despachamos la próxima caja. Tu plan se reanuda solo un mes después y puedes reanudarlo antes cuando quieras.</p>',
      foot: '<button type="button" class="btn btn--quiet" data-close>No, mantener</button><button type="button" class="btn btn--gold" data-ok>Pausar 1 mes</button>',
      onMount(modalEl, close) {
        modalEl.querySelector('[data-ok]').addEventListener('click', () => {
          close();
          runAction(root, () => TCB.api.subscription.pause());
        });
      }
    });
  }

  // HU-12: antes de cancelar se ofrece pausar como alternativa.
  function openPauseInsteadModal(root) {
    TCB.state.modal({
      eyebrow: 'Cancelar suscripción',
      title: '¿Prefieres pausar un mes?',
      body: '<p class="small">Si necesitas un respiro, pausa tu plan: no te cobramos ni despachamos el próximo mes y se reanuda solo. Tu perfil de estilo se conserva.</p>',
      foot: '<button type="button" class="btn btn--quiet" data-cancel-anyway style="color:var(--danger)">Quiero cancelar</button><button type="button" class="btn btn--gold" data-pause>Pausar 1 mes</button>',
      onMount(modalEl, close) {
        modalEl.querySelector('[data-pause]').addEventListener('click', () => {
          close();
          runAction(root, () => TCB.api.subscription.pause());
        });
        modalEl.querySelector('[data-cancel-anyway]').addEventListener('click', () => {
          close();
          openCancelModal(() => renderSubscription(root));
        });
      }
    });
  }

  function openPlanModal(root, sub, planChange, cfg) {
    const target = sub.pendingPlan || sub.plan;
    const effectText = planChange && planChange.beforeCutoff
      ? `Hoy es antes del día de corte (${planChange.cutoffDay}): el cambio aplica desde tu próxima caja, con el cobro del ${day(planChange.effectiveFrom)}.`
      : `Ya pasó el día de corte (${planChange ? planChange.cutoffDay : cfg.cutoffDay}): tu próxima caja sigue con el plan actual y el nuevo aplica desde el cobro del ${planChange ? day(planChange.effectiveFrom) : 'siguiente'}.`;
    TCB.state.modal({
      eyebrow: 'Cambiar plan',
      title: 'Elige tu plan',
      body: `
        <form id="plan-form" class="stack" style="--stack:12px" novalidate>
          ${Object.entries(cfg.plans).map(([key, p]) => `
            <label style="display:flex;gap:10px;align-items:center;font-size:var(--fs-sm);cursor:pointer">
              <input type="radio" name="plan" value="${key}" ${target === key ? 'checked' : ''}>
              <span><strong>${p.name}</strong> · ${p.items} prendas · ${cop(p.priceCOP)}/mes${key === sub.plan ? ' <span class="muted">(actual)</span>' : ''}</span>
            </label>
          `).join('')}
          <p class="small muted">${effectText}</p>
          <p class="error small" id="plan-error" role="alert"></p>
          <button type="submit" class="btn btn--gold btn--block">Confirmar cambio</button>
        </form>
      `,
      onMount(modalEl, close) {
        modalEl.querySelector('#plan-form').addEventListener('submit', async e => {
          e.preventDefault();
          const plan = e.target.querySelector('input[name="plan"]:checked').value;
          try {
            const res = await TCB.api.subscription.changePlan(plan);
            close();
            TCB.state.toast(res.message, { ms: 7000 });
            await TCB.state.loadUserSession();
            renderSubscription(root);
          } catch (err) {
            modalEl.querySelector('#plan-error').textContent = err.data?.error || err.message;
          }
        });
      }
    });
  }

  // HU-08: actualizar el medio de pago (en mora cobra en el acto para regularizar).
  function openCardModal(root, cfg) {
    TCB.state.modal({
      eyebrow: 'Medio de pago',
      title: 'Actualiza tu tarjeta',
      body: `
        <form id="card-form" class="stack" style="--stack:12px" novalidate>
          ${TCB.views.subscribe.cardFieldsHtml(cfg.testCards)}
          <p class="error small" id="card-error" role="alert"></p>
          <button type="submit" class="btn btn--gold btn--block">Guardar tarjeta</button>
        </form>
      `,
      onMount(modalEl, close) {
        const form = modalEl.querySelector('#card-form');
        form.addEventListener('submit', async e => {
          e.preventDefault();
          try {
            const card = await TCB.views.subscribe.tokenizeFrom(form);
            const res = await TCB.api.subscription.updatePaymentMethod(card.token);
            close();
            TCB.state.toast(res.message, { ms: 6000 });
            renderSubscription(root);
          } catch (err) {
            modalEl.querySelector('#card-error').textContent = err.data?.error || err.message;
          }
        });
      }
    });
  }

  // HU-15: datos fiscales para la factura electrónica
  async function renderFiscal(root, user) {
    const el = root.querySelector('#fiscal-body');
    if (!el) return;
    const cfg = await TCB.views.subscribe.loadConfig();
    el.innerHTML = `
      <form id="fiscal-form" class="stack" style="--stack:12px;max-width:560px" novalidate>
        ${TCB.views.subscribe.fiscalFieldsHtml(user.fiscal || {}, cfg.fiscalDocTypes)}
        <p class="error small" id="fiscal-error" role="alert"></p>
        <button type="submit" class="btn btn--ghost">Guardar datos de facturación</button>
      </form>
    `;
    el.querySelector('#fiscal-form').addEventListener('submit', async e => {
      e.preventDefault();
      const errEl = el.querySelector('#fiscal-error');
      errEl.textContent = '';
      try {
        const res = await TCB.api.profile.saveFiscal(TCB.views.subscribe.readFiscal(e.target));
        await TCB.state.loadUserSession();
        TCB.state.toast(res.message);
      } catch (err) {
        errEl.textContent = err.data?.error || err.message;
      }
    });
  }

  // HU-16: copia de los datos personales en JSON
  async function downloadMyData() {
    try {
      const data = await TCB.api.account.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `mis-datos-theclothesbox-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      TCB.state.toast('Descargamos una copia de tus datos.');
    } catch (err) {
      TCB.state.toast(err.data?.error || err.message, { type: 'danger' });
    }
  }

  // HU-16: eliminar la cuenta pide la contraseña y explica qué se conserva
  function openDeleteAccountModal() {
    TCB.state.modal({
      eyebrow: 'Eliminar cuenta',
      title: '¿Eliminar tu cuenta?',
      body: `
        <form id="delete-account-form" class="stack" style="--stack:14px" novalidate>
          <p class="small">Cancelamos tu suscripción y anonimizamos tu nombre, correo, perfil y medidas. <strong>No se puede deshacer.</strong></p>
          <p class="small muted">Conservamos tus pagos y facturas porque la ley tributaria nos obliga a guardarlos.</p>
          <div class="field">
            <label for="delete-password">Escribe tu contraseña para confirmar</label>
            <input class="input" id="delete-password" name="password" type="password" autocomplete="current-password" required>
          </div>
          <p class="error small" id="delete-error" role="alert"></p>
          <button type="submit" class="btn btn--block" style="background:var(--danger);color:#fff">Eliminar mi cuenta</button>
          <button type="button" class="btn btn--block btn--ghost" data-close>Conservar mi cuenta</button>
        </form>
      `,
      onMount(modalEl, close) {
        modalEl.querySelector('#delete-account-form').addEventListener('submit', async e => {
          e.preventDefault();
          const errEl = modalEl.querySelector('#delete-error');
          errEl.textContent = '';
          try {
            const res = await TCB.api.account.remove(e.target.elements.password.value);
            close();
            TCB.api.auth.logout();
            TCB.state.set({ user: null, profile: null, currentBox: null });
            TCB.state.toast(res.message, { ms: 7000 });
            window.location.hash = '#/';
          } catch (err) {
            errEl.textContent = err.data?.error || err.message;
          }
        });
      }
    });
  }

  // La encuesta de salida es opcional: se puede cancelar sin responderla.
  async function openCancelModal(onDone) {
    let reasons = {};
    try {
      reasons = (await TCB.api.config()).cancellationReasons;
    } catch (e) { /* sin motivos se puede cancelar igual */ }

    TCB.state.modal({
      eyebrow: 'Antes de irte',
      title: '¿Por qué cancelas?',
      body: `
        <form id="cancel-form" class="stack" style="--stack:14px" novalidate>
          <p class="small muted">Tu respuesta es opcional y nos ayuda a mejorar. Puedes cancelar sin responder.</p>
          <div class="stack" style="--stack:8px" role="radiogroup" aria-label="Motivo de cancelación">
            ${Object.entries(reasons).map(([key, label]) => `
              <label style="display:flex;gap:10px;align-items:center;font-size:var(--fs-sm);cursor:pointer">
                <input type="radio" name="reason" value="${key}"> ${label}
              </label>
            `).join('')}
          </div>
          <div class="field">
            <label for="cancel-comment">Comentario (opcional)</label>
            <textarea class="input" id="cancel-comment" name="comment" rows="3" maxlength="500" placeholder="Cuéntanos qué podríamos mejorar"></textarea>
          </div>
          <p class="error small" id="cancel-error" role="alert"></p>
          <button type="submit" class="btn btn--block" style="background:var(--danger);color:#fff">Confirmar cancelación</button>
          <button type="button" class="btn btn--block btn--ghost" data-close>Seguir con mi suscripción</button>
        </form>
      `,
      onMount(modalEl, close) {
        const form = modalEl.querySelector('#cancel-form');
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const checked = form.querySelector('input[name="reason"]:checked');
          try {
            const res = await TCB.api.subscription.cancel({
              reason: checked ? checked.value : null,
              comment: form.elements.comment.value.trim()
            });
            close();
            TCB.state.toast(res.message);
            onDone();
          } catch (err) {
            modalEl.querySelector('#cancel-error').textContent = err.data?.error || err.message;
          }
        });
      }
    });
  }

  function mount(root) {
    root.querySelector('[data-login-trigger]')?.addEventListener('click', () => {
      TCB.views.auth.openLoginModal(() => window.location.reload());
    });

    root.querySelector('#btn-resend-verification')?.addEventListener('click', async () => {
      try {
        const res = await TCB.api.auth.resendVerification();
        TCB.state.toast(res.message);
      } catch (err) {
        TCB.state.toast(err.message);
      }
    });

    root.querySelector('#btn-export-data')?.addEventListener('click', downloadMyData);
    root.querySelector('#btn-delete-account')?.addEventListener('click', openDeleteAccountModal);

    renderSubscription(root);
    renderFiscal(root, TCB.state.get().user);
    renderStyleHistory(root, TCB.state.get().profile || {});
    root.querySelector('#btn-repeat-quiz')?.addEventListener('click', () => {
      TCB.views.onboarding.startRepeat(TCB.state.get().profile);
    });

    const form = root.querySelector('#profile-form');
    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const currentProfile = TCB.state.get().profile || {};

        // HU-16: nombre y correo se rectifican en la cuenta (validación y correo único en el backend)
        const name = form.name.value.trim();
        const email = form.email.value.trim();
        const currentUser = TCB.state.get().user;
        const accountChanged = name !== currentUser.name || email.toLowerCase() !== currentUser.email.toLowerCase();
        if (accountChanged) {
          try {
            const res = await TCB.api.account.update({ name, email });
            TCB.state.toast(res.message, { ms: 6000 });
          } catch (err) {
            TCB.state.toast(err.data?.error || err.message, { type: 'danger' });
            return;
          }
        }

        const updatedData = {
          address: form.address.value.trim(),
          heightCm: Number(form.heightCm.value),
          weightKg: Number(form.weightKg.value),
          bodyBuild: form.bodyBuild.value,
          fitPreference: form.fitPreference.value,
          usualSizeTop: form.usualSizeTop.value,
          usualSizeBottom: form.usualSizeBottom.value,
          referenceGarment: {
            brand: form.refBrand.value.trim(),
            size: form.refSize.value.trim(),
            notes: form.refNotes.value.trim()
          }
        };

        try {
          const res = await TCB.api.profile.save(updatedData);
          await TCB.state.loadUserSession();
          TCB.state.set({ profile: res.profile });
          TCB.state.toast('Perfil y calibración antropométrica actualizados.');
          // HU-16: el aviso de verificación debe mostrar el correo nuevo
          if (accountChanged) TCB.app.navigate('#/perfil');
        } catch (err) {
          TCB.state.toast(err.message || 'Error al guardar perfil', { type: 'danger' });
        }
      });
    }
  }

  return { render, mount };
})();
