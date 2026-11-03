// Onboarding View (3 Steps: Style, Occasions/Plan, Sizing Measures)
window.TCB = window.TCB || {};
TCB.views = TCB.views || {};

TCB.views.onboarding = (() => {
  const { icon } = TCB.brand;

  const STYLES_CATALOG = [
    { id: 'urbano', name: 'Urbano Relajado', note: 'Cortes boxy, felpa pesada, pantalones cargo.', swatches: ['#5d6066', '#a39a8c', '#2f3a33'] },
    { id: 'minimal', name: 'Minimal Esencial', note: 'Pocas piezas, líneas limpias, algodón pima.', swatches: ['#e8e4dc', '#1f1f22', '#b8b2a6'] },
    { id: 'retro', name: 'Retro & Vintage', note: 'Denim lavado 90s, tonos arcilla, pana acanalada.', swatches: ['#c9873b', '#5b7aa6', '#a2553e'] },
    { id: 'clasico', name: 'Clásico con Giro', note: 'Camisería de lino, pinzas sutiles, tonos sobrios.', swatches: ['#24324a', '#eae4d6', '#7b2d26'] },
    { id: 'deportivo', name: 'Sportswear Técnico', note: 'Ripstop ligero, comodidad activa para la calle.', swatches: ['#2b2d31', '#d4e04b', '#3f6db3'] },
    { id: 'artesanal', name: 'Hecho en Colombia', note: 'Lino puro, tinturas locales, textura viva.', swatches: ['#b7a37f', '#6b7a4f', '#8a4b2e'] }
  ];

  let currentStep = 1;
  let draft = {
    styles: ['urbano', 'minimal'],
    occasions: ['clase'],
    line: 'u',
    fit: 'regular',
    plan: 'esencial',
    risk: 1,
    address: 'Calle 18 # 122-135, Pance, Cali',
    measures: {
      height: 174,
      weight: 68,
      build: 'media',
      usual: 'M',
      refBrand: 'norte',
      refSize: 'M'
    }
  };

  function render(store) {
    // If not authenticated, prompt to register or login first
    if (!store.user) {
      return `
        <div class="wrap-narrow screen" style="text-align:center;padding-top:var(--s-8)">
          <div class="hangtag" style="margin-bottom:24px">
            <span class="label">Paso 0</span>
            <span class="size">★</span>
            <span class="pct">Tu perfil</span>
          </div>
          <h1 class="display" style="font-size:var(--fs-3xl);margin-bottom:12px">Crea tu cuenta para empezar</h1>
          <p class="lede" style="margin-inline:auto;margin-bottom:32px">
            Guardaremos tus medidas corporales, tus gustos y la historia de tus cajas para que cada entrega sea más acertada.
          </p>
          <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
            <button type="button" class="btn btn--gold btn--lg" id="btn-onboard-register">Crear mi cuenta</button>
            <button type="button" class="btn btn--ghost btn--lg" id="btn-onboard-login">Ya tengo cuenta</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="wrap-narrow screen">
        <div class="wizard-progress" role="progressbar" aria-valuenow="${currentStep}" aria-valuemin="1" aria-valuemax="3">
          <i class="${currentStep >= 1 ? 'is-done' : ''}"></i>
          <i class="${currentStep >= 2 ? 'is-done' : ''}"></i>
          <i class="${currentStep >= 3 ? 'is-done' : ''}"></i>
        </div>

        <header class="screen-head">
          <span class="eyebrow">Paso ${currentStep} de 3 · Perfil Personal</span>
          <h1 class="screen-title">
            ${currentStep === 1 ? '¿Qué estilo te representa?' : currentStep === 2 ? 'Ocasión, corte y presupuesto' : 'Tus medidas para una talla exacta'}
          </h1>
          <p class="lede">
            ${currentStep === 1
              ? 'Elige hasta 3 estilos que encajen contigo. El primero tendrá mayor peso en tus cajas.'
              : currentStep === 2
              ? 'Dinos para qué momentos necesitas ropa y qué corte prefieres llevar.'
              : 'Con 4 datos calculamos tu talla en centímetros contra las tablas de patronaje de cada taller.'}
          </p>
        </header>

        <form id="onboarding-form" novalidate>
          <p class="error small" id="step-error" style="margin-bottom:16px" role="alert"></p>

          ${currentStep === 1 ? renderStep1() : currentStep === 2 ? renderStep2() : renderStep3()}

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--s-7);padding-top:var(--s-5);border-top:var(--hair)">
            ${currentStep > 1
              ? `<button type="button" class="btn btn--quiet" id="btn-back">${icon('arrowL')} Anterior</button>`
              : `<a class="btn btn--quiet" href="#/">Cancelar</a>`}
            <button type="submit" class="btn btn--gold btn--lg" id="btn-next">
              ${currentStep === 3 ? `Guardar y armar mi caja ${icon('sparkle')}` : `Continuar ${icon('arrowR')}`}
            </button>
          </div>
        </form>
      </div>
    `;
  }

  function renderStep1() {
    return `
      <div class="style-grid">
        ${STYLES_CATALOG.map(s => {
          const isSelected = draft.styles.includes(s.id);
          const index = draft.styles.indexOf(s.id);
          return `
            <div class="style-choice ${isSelected ? 'is-selected' : ''}" data-style="${s.id}">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <strong>${s.name}</strong>
                ${isSelected ? `<span class="chip chip--ok">${index + 1}</span>` : ''}
              </div>
              <p class="small muted">${s.note}</p>
              <div class="style-swatches">
                ${s.swatches.map(c => `<i style="background:${c}"></i>`).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderStep2() {
    return `
      <div class="stack" style="--stack:28px">
        <fieldset class="field">
          <legend class="field-label">¿Para qué ocasiones te gustaría vestir?</legend>
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:12px;margin-top:8px">
            ${[
              { id: 'clase', name: 'Universidad / Diario', note: 'Cómodo y duradero para el día a día' },
              { id: 'fiesta', name: 'Salidas y Noche', note: 'Planes con amigos, cenas o eventos' },
              { id: 'entrevista', name: 'Entrevistas / Prácticas', note: 'Sobrio, profesional pero con personalidad' }
            ].map(o => `
              <label class="style-choice ${draft.occasions.includes(o.id) ? 'is-selected' : ''}" style="cursor:pointer">
                <input type="checkbox" name="occ" value="${o.id}" ${draft.occasions.includes(o.id) ? 'checked' : ''} style="position:absolute;opacity:0">
                <strong>${o.name}</strong>
                <p class="small muted">${o.note}</p>
              </label>
            `).join('')}
          </div>
        </fieldset>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <fieldset class="field">
            <legend class="field-label">Línea de cortes</legend>
            <div class="segmented" style="margin-top:8px">
              ${[['m', 'Masculino'], ['f', 'Femenino'], ['u', 'Sin género / Ambos']].map(([val, label]) => `
                <label>
                  <input type="radio" name="line" value="${val}" ${draft.line === val ? 'checked' : ''}>
                  <span>${label}</span>
                </label>
              `).join('')}
            </div>
          </fieldset>

          <fieldset class="field">
            <legend class="field-label">Preferencia de calce</legend>
            <div class="segmented" style="margin-top:8px">
              ${[['holgado', 'Holgado / Boxy'], ['regular', 'Regular'], ['ajustado', 'Al cuerpo']].map(([val, label]) => `
                <label>
                  <input type="radio" name="fit" value="${val}" ${draft.fit === val ? 'checked' : ''}>
                  <span>${label}</span>
                </label>
              `).join('')}
            </div>
          </fieldset>
        </div>

        <fieldset class="field">
          <legend class="field-label">Plan de suscripción mensual</legend>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px">
            <label class="style-choice ${draft.plan === 'esencial' ? 'is-selected' : ''}" style="cursor:pointer">
              <input type="radio" name="plan" value="esencial" ${draft.plan === 'esencial' ? 'checked' : ''} style="position:absolute;opacity:0">
              <div style="display:flex;justify-content:space-between">
                <strong>Plan Esencial</strong>
                <span class="mono" style="font-weight:700">COP 129.900</span>
              </div>
              <p class="small muted">3 prendas al mes · Ideal para renovar armario básico.</p>
            </label>
            <label class="style-choice ${draft.plan === 'estilo' ? 'is-selected' : ''}" style="cursor:pointer">
              <input type="radio" name="plan" value="estilo" ${draft.plan === 'estilo' ? 'checked' : ''} style="position:absolute;opacity:0">
              <div style="display:flex;justify-content:space-between">
                <strong>Plan Estilo</strong>
                <span class="mono" style="font-weight:700">COP 199.900</span>
              </div>
              <p class="small muted">5 prendas al mes · Rotación completa con capas y pantalones.</p>
            </label>
          </div>
        </fieldset>

        <div class="field">
          <label for="f-address">Dirección de entrega en Cali</label>
          <input class="input" id="f-address" name="address" value="${draft.address}" required placeholder="Calle, carrera, número y barrio en Cali">
          <span class="hint">El piloto inicial opera exclusivamente en el área metropolitana de Cali.</span>
        </div>
      </div>
    `;
  }

  function renderStep3() {
    const m = draft.measures;
    return `
      <div class="stack" style="--stack:24px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div class="field">
            <label for="m-height">Estatura</label>
            <div class="input-unit">
              <input class="input num" id="m-height" name="height" type="number" min="140" max="215" value="${m.height}" required>
              <span>cm</span>
            </div>
          </div>
          <div class="field">
            <label for="m-weight">Peso corporal aproximado</label>
            <div class="input-unit">
              <input class="input num" id="m-weight" name="weight" type="number" min="40" max="160" value="${m.weight}" required>
              <span>kg</span>
            </div>
          </div>
        </div>

        <fieldset class="field">
          <legend class="field-label">Contextura corporal</legend>
          <div class="segmented" style="margin-top:8px">
            ${[['delgada', 'Delgada / Ectomorfo'], ['media', 'Media / Mesomorfo'], ['robusta', 'Robusta / Endomorfo']].map(([val, label]) => `
              <label>
                <input type="radio" name="build" value="${val}" ${m.build === val ? 'checked' : ''}>
                <span>${label}</span>
              </label>
            `).join('')}
          </div>
        </fieldset>

        <fieldset class="field">
          <legend class="field-label">Talla habitual que más compras en tiendas</legend>
          <div class="segmented" style="margin-top:8px">
            ${['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(s => `
              <label>
                <input type="radio" name="usual" value="${s}" ${m.usual === s ? 'checked' : ''}>
                <span class="mono" style="min-width:44px;justify-content:center">${s}</span>
              </label>
            `).join('')}
          </div>
        </fieldset>

        <div style="background:var(--paper-2);border:1px solid var(--rule-strong);padding:20px;border-radius:var(--r-1)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            ${icon('ruler')}
            <strong>Prenda de calibración (Opcional, sube la precisión al 98%)</strong>
          </div>
          <p class="small muted" style="margin-bottom:16px">Si tienes una prenda que te quede soñada, dinos de qué marca es y qué talla compraste.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="field">
              <label for="m-refBrand">Marca de la prenda</label>
              <select class="select" id="m-refBrand" name="refBrand">
                <option value="norte" ${m.refBrand === 'norte' ? 'selected' : ''}>Taller Norte</option>
                <option value="ceiba" ${m.refBrand === 'ceiba' ? 'selected' : ''}>Ceiba Estudio</option>
                <option value="mono" ${m.refBrand === 'mono' ? 'selected' : ''}>Mono Textil</option>
                <option value="mattelsa" ${m.refBrand === 'mattelsa' ? 'selected' : ''}>Mattelsa</option>
                <option value="punto-blanco" ${m.refBrand === 'punto-blanco' ? 'selected' : ''}>Punto Blanco</option>
                <option value="otra">Otra marca</option>
              </select>
            </div>
            <div class="field">
              <label for="m-refSize">Talla de esa prenda</label>
              <select class="select" id="m-refSize" name="refSize">
                ${['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(s => `
                  <option value="${s}" ${m.refSize === s ? 'selected' : ''}>${s}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function mount(root, rerender) {
    const store = TCB.state.get();

    // Trigger register / login if unauthenticated
    root.querySelector('#btn-onboard-register')?.addEventListener('click', () => {
      TCB.views.auth.openRegisterModal(() => rerender());
    });
    root.querySelector('#btn-onboard-login')?.addEventListener('click', () => {
      TCB.views.auth.openLoginModal(() => rerender());
    });

    // Style picker in step 1
    root.querySelectorAll('[data-style]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.style;
        const exists = draft.styles.indexOf(id);
        if (exists > -1) {
          if (draft.styles.length > 1) draft.styles.splice(exists, 1);
        } else {
          if (draft.styles.length >= 3) draft.styles.pop();
          draft.styles.push(id);
        }
        rerender();
      });
    });

    // Back button
    root.querySelector('#btn-back')?.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        rerender();
      }
    });

    // Form submit
    root.querySelector('#onboarding-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const errEl = root.querySelector('#step-error');
      errEl.textContent = '';

      if (currentStep === 1) {
        if (draft.styles.length === 0) {
          errEl.textContent = 'Selecciona al menos un estilo.';
          return;
        }
        currentStep = 2;
        return rerender();
      }

      if (currentStep === 2) {
        const occEls = [...root.querySelectorAll('input[name="occ"]:checked')];
        draft.occasions = occEls.map(x => x.value);
        if (draft.occasions.length === 0) {
          errEl.textContent = 'Selecciona al menos una ocasión.';
          return;
        }
        const lineEl = root.querySelector('input[name="line"]:checked');
        if (lineEl) draft.line = lineEl.value;
        const fitEl = root.querySelector('input[name="fit"]:checked');
        if (fitEl) draft.fit = fitEl.value;
        const planEl = root.querySelector('input[name="plan"]:checked');
        if (planEl) draft.plan = planEl.value;
        const addrEl = root.querySelector('#f-address');
        if (addrEl) draft.address = addrEl.value.trim();

        currentStep = 3;
        return rerender();
      }

      if (currentStep === 3) {
        const h = Number(root.querySelector('#m-height').value);
        const w = Number(root.querySelector('#m-weight').value);
        if (!h || h < 140 || h > 220) {
          errEl.textContent = 'Ingresa una estatura válida entre 140 y 220 cm.';
          return;
        }
        if (!w || w < 38 || w > 180) {
          errEl.textContent = 'Ingresa un peso válido entre 38 y 180 kg.';
          return;
        }

        const buildEl = root.querySelector('input[name="build"]:checked');
        const usualEl = root.querySelector('input[name="usual"]:checked');
        draft.measures = {
          height: h,
          weight: w,
          build: buildEl ? buildEl.value : 'media',
          usual: usualEl ? usualEl.value : 'M',
          refBrand: root.querySelector('#m-refBrand')?.value || '',
          refSize: root.querySelector('#m-refSize')?.value || ''
        };

        const submitBtn = root.querySelector('#btn-next');
        submitBtn.classList.add('is-loading');

        try {
          // LLAMADA AL BACKEND REAL: PUT /api/profile
          await TCB.api.profile.save(draft);
          await TCB.state.loadUserSession();
          TCB.state.toast('¡Perfil guardado! Tu primera caja está en preparación.');
          currentStep = 1;
          window.location.hash = '#/caja';
        } catch (err) {
          errEl.textContent = err.data?.error || err.message;
        } finally {
          submitBtn.classList.remove('is-loading');
        }
      }
    });
  }

  return { render, mount };
})();
