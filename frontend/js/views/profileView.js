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
                <input class="input" id="p-email" type="email" value="${user.email || ''}" disabled style="background:var(--paper-2);cursor:not-allowed">
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

        <!-- HU-13: MI SUSCRIPCIÓN -->
        <section id="subscription-section" style="background:var(--sheet);border:var(--line);padding:28px;margin-top:32px">
          <h2 class="display" style="font-size:var(--fs-xl);margin-bottom:8px">Mi suscripción</h2>
          <div id="subscription-body"><p class="small muted">Cargando…</p></div>
        </section>
      </div>
    `;
  }

  const PLAN_NAMES = { esencial: 'Esencial · 3 prendas', estilo: 'Estilo · 5 prendas' };
  const STATUS_NAMES = { ACTIVE: 'Activa', CANCELLED: 'Cancelada', NONE: 'Sin suscripción' };

  async function renderSubscription(root) {
    const bodyEl = root.querySelector('#subscription-body');
    if (!bodyEl) return;
    try {
      const { subscription: sub } = await TCB.api.subscription.get();
      bodyEl.innerHTML = `
        <p class="small">Plan: <strong>${PLAN_NAMES[sub.plan] || sub.plan}</strong> · Estado: <strong>${STATUS_NAMES[sub.status] || sub.status}</strong></p>
        ${sub.status === 'CANCELLED' ? `
          <p class="small muted" style="margin-top:6px">Cancelada el ${new Date(sub.cancelledAt).toLocaleDateString('es-CO')}. No se harán más cobros ni despachos.</p>
        ` : sub.status === 'ACTIVE' ? `
          <button type="button" class="btn btn--quiet btn--sm" id="btn-cancel-subscription" style="margin-top:12px;color:var(--danger)">Cancelar suscripción</button>
        ` : `<p class="small muted" style="margin-top:6px">Completa el quiz de estilo para activar tu plan.</p>`}
      `;
      bodyEl.querySelector('#btn-cancel-subscription')?.addEventListener('click', () => openCancelModal(() => renderSubscription(root)));
    } catch (e) {
      bodyEl.innerHTML = `<p class="small error">No pudimos cargar tu suscripción.</p>`;
    }
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

    renderSubscription(root);

    const form = root.querySelector('#profile-form');
    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const currentProfile = TCB.state.get().profile || {};

        const updatedData = {
          name: form.name.value.trim(),
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
          TCB.state.set({ profile: res.profile });
          TCB.state.toast('Perfil y calibración antropométrica actualizados.');
        } catch (err) {
          TCB.state.toast(err.message || 'Error al guardar perfil', { type: 'danger' });
        }
      });
    }
  }

  return { render, mount };
})();
