// Subscribe View — HU-08 elegir plan y registrar el pago (SIMULADO) · HU-15 datos fiscales
window.TCB = window.TCB || {};
TCB.views = TCB.views || {};

TCB.views.subscribe = (() => {
  const { icon } = TCB.brand;
  const cop = n => `COP ${Number(n).toLocaleString('es-CO')}`;
  let appConfig = null;
  let selectedPlan = null;

  async function loadConfig() {
    if (!appConfig) appConfig = await TCB.api.config();
    return appConfig;
  }

  // Campos de tarjeta. Nunca se guardan: se tokenizan y el formulario se limpia.
  function cardFieldsHtml(testCards = []) {
    return `
      <div class="banner banner--info" style="font-size:var(--fs-sm)">
        <strong>Pago SIMULADO.</strong> No se cobra dinero real. Tarjetas de prueba:
        <ul style="margin:6px 0 0;padding-left:18px">
          ${testCards.map(c => `<li><span class="mono">${c.number}</span> · ${c.label}</li>`).join('')}
        </ul>
        <span class="small muted">Cualquier fecha futura y cualquier CVV de 3 dígitos.</span>
      </div>
      <div class="field">
        <label for="c-holder">Nombre en la tarjeta</label>
        <input class="input" id="c-holder" name="holder" autocomplete="cc-name" required>
      </div>
      <div class="field">
        <label for="c-number">Número de tarjeta</label>
        <input class="input mono" id="c-number" name="number" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" required>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field">
          <label for="c-exp">Vence (MM/AA)</label>
          <input class="input mono" id="c-exp" name="exp" inputmode="numeric" autocomplete="cc-exp" placeholder="12/30" required>
        </div>
        <div class="field">
          <label for="c-cvc">CVV</label>
          <input class="input mono" id="c-cvc" name="cvc" inputmode="numeric" autocomplete="cc-csc" maxlength="4" placeholder="123" required>
        </div>
      </div>
    `;
  }

  async function tokenizeFrom(form) {
    const [expMonth, expYear] = form.elements.exp.value.split('/').map(v => v.trim());
    const res = await TCB.api.payments.tokenize({
      holder: form.elements.holder.value.trim(),
      number: form.elements.number.value,
      expMonth,
      expYear,
      cvc: form.elements.cvc.value.trim()
    });
    ['number', 'exp', 'cvc'].forEach(n => { form.elements[n].value = ''; });
    return res;
  }

  function fiscalFieldsHtml(fiscal = {}, docTypes = {}) {
    return `
      <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:12px">
        <div class="field">
          <label for="f-docType">Tipo de documento</label>
          <select class="input" id="f-docType" name="docType" required>
            ${Object.entries(docTypes).map(([k, label]) => `<option value="${k}" ${fiscal.docType === k ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="f-docNumber">Número de documento</label>
          <input class="input mono" id="f-docNumber" name="docNumber" inputmode="numeric" value="${fiscal.docNumber || ''}" required>
        </div>
      </div>
      <div class="field">
        <label for="f-fiscalAddress">Dirección de facturación</label>
        <input class="input" id="f-fiscalAddress" name="fiscalAddress" value="${fiscal.address || ''}" required>
      </div>
      <div class="field">
        <label for="f-city">Ciudad</label>
        <input class="input" id="f-city" name="city" value="${fiscal.city || 'Cali'}" required>
      </div>
    `;
  }

  function readFiscal(form) {
    return {
      docType: form.elements.docType.value,
      docNumber: form.elements.docNumber.value.trim(),
      address: form.elements.fiscalAddress.value.trim(),
      city: form.elements.city.value.trim()
    };
  }

  function render(store) {
    if (!store.user) {
      return `
        <div class="screen wrap">
          <div class="banner banner--warn" style="max-width:540px;margin:var(--s-8) auto;text-align:center">
            <h2 style="font-size:var(--fs-xl)">Elige tu plan</h2>
            <p class="muted">Inicia sesión para activar tu suscripción.</p>
            <button type="button" class="btn btn--gold" data-login-trigger style="margin-top:12px">Iniciar sesión</button>
          </div>
        </div>
      `;
    }
    return `
      <div class="screen wrap" style="max-width:720px">
        <div class="screen-head">
          <span class="badge badge--dark">Suscripción mensual</span>
          <h1 class="screen-title display">Elige tu plan y registra tu pago</h1>
          <p class="muted">Cobramos cada mes el mismo día. Puedes pausar, cambiar de plan o cancelar cuando quieras desde "Mi Perfil".</p>
        </div>
        <div id="subscribe-body"><p class="small muted">Cargando…</p></div>
      </div>
    `;
  }

  async function renderBody(root, store) {
    const bodyEl = root.querySelector('#subscribe-body');
    if (!bodyEl) return;
    try {
      const [cfg, { subscription: sub }] = await Promise.all([loadConfig(), TCB.api.subscription.get()]);
      if (['ACTIVE', 'PAUSED', 'PAST_DUE'].includes(sub.status)) {
        bodyEl.innerHTML = `
          <div class="banner banner--info">
            <p>Ya tienes el plan <strong>${sub.planName}</strong>. Gestiónalo desde <a href="#/perfil">Mi Perfil › Mi suscripción</a>.</p>
          </div>
        `;
        return;
      }
      selectedPlan = selectedPlan || (store.profile && store.profile.plan) || 'esencial';
      bodyEl.innerHTML = `
        <form id="subscribe-form" class="stack" style="--stack:24px" novalidate>
          <fieldset class="field">
            <legend class="field-label">1. Plan</legend>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:8px">
              ${Object.entries(cfg.plans).map(([key, p]) => `
                <label class="style-choice ${selectedPlan === key ? 'is-selected' : ''}" style="cursor:pointer">
                  <input type="radio" name="plan" value="${key}" ${selectedPlan === key ? 'checked' : ''} style="position:absolute;opacity:0">
                  <div style="display:flex;justify-content:space-between;gap:8px">
                    <strong>Plan ${p.name}</strong>
                    <span class="mono" style="font-weight:700">${cop(p.priceCOP)}</span>
                  </div>
                  <p class="small muted">${p.items} prendas al mes · cobro mensual</p>
                </label>
              `).join('')}
            </div>
          </fieldset>

          <fieldset class="stack" style="--stack:12px;border:0;padding:0">
            <legend class="field-label">2. Tarjeta</legend>
            ${cardFieldsHtml(cfg.testCards)}
          </fieldset>

          <fieldset class="stack" style="--stack:12px;border:0;padding:0">
            <legend class="field-label">3. Datos para tu factura electrónica</legend>
            ${fiscalFieldsHtml(store.user.fiscal || {}, cfg.fiscalDocTypes)}
          </fieldset>

          <p class="error small" id="subscribe-error" role="alert"></p>
          <button type="submit" class="btn btn--gold btn--lg btn--block" id="btn-pay">
            ${icon('check')} Pagar ${cop(cfg.plans[selectedPlan].priceCOP)} y activar
          </button>
          <p class="small muted" style="text-align:center">No guardamos el número de tu tarjeta ni el CVV: solo un token, la marca y los últimos 4 dígitos.</p>
        </form>
      `;
      mountForm(root, cfg);
    } catch (e) {
      bodyEl.innerHTML = `<p class="small error">No pudimos cargar los planes. ${e.message}</p>`;
    }
  }

  function mountForm(root, cfg) {
    const form = root.querySelector('#subscribe-form');
    form.querySelectorAll('input[name="plan"]').forEach(input => {
      input.addEventListener('change', () => {
        selectedPlan = input.value;
        form.querySelectorAll('.style-choice').forEach(el => el.classList.toggle('is-selected', el.contains(input)));
        root.querySelector('#btn-pay').innerHTML = `${icon('check')} Pagar ${cop(cfg.plans[selectedPlan].priceCOP)} y activar`;
      });
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const errEl = root.querySelector('#subscribe-error');
      const btn = root.querySelector('#btn-pay');
      errEl.textContent = '';
      btn.classList.add('is-loading');
      btn.disabled = true;
      try {
        const card = await tokenizeFrom(form);
        const res = await TCB.api.subscription.subscribe({ plan: selectedPlan, paymentToken: card.token, fiscal: readFiscal(form) });
        await TCB.state.loadUserSession();
        TCB.state.toast(res.message);
        window.location.hash = '#/caja';
      } catch (err) {
        errEl.textContent = err.data?.error || err.message;
      } finally {
        btn.classList.remove('is-loading');
        btn.disabled = false;
      }
    });
  }

  function mount(root, store) {
    root.querySelector('[data-login-trigger]')?.addEventListener('click', () => {
      TCB.views.auth.openLoginModal(() => window.location.reload());
    });
    renderBody(root, store || TCB.state.get());
  }

  return { render, mount, loadConfig, cardFieldsHtml, tokenizeFrom, fiscalFieldsHtml, readFiscal };
})();
