// Auth Modals & Views (Register, Login, Demo Account)
window.TCB = window.TCB || {};
TCB.views = TCB.views || {};

TCB.views.auth = (() => {
  const { icon } = TCB.brand;

  function openLoginModal(onSuccess) {
    TCB.state.modal({
      eyebrow: 'Tu Cuenta',
      title: 'Iniciar sesión',
      body: `
        <div class="stack" style="--stack:18px">
          <!-- Botones de acceso rápido por rol -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="background:var(--paper-2);border:1px dashed var(--brand-box);padding:12px;border-radius:var(--r-1);display:flex;flex-direction:column;justify-content:space-between">
              <div>
                <p style="font-weight:700;font-size:var(--fs-xs)">Cuenta Cliente</p>
                <p class="small muted" style="font-size:11px">demo@theclothesbox.co</p>
              </div>
              <button type="button" class="btn btn--gold btn--sm" id="btn-quick-demo" style="margin-top:8px">Entrar Cliente</button>
            </div>
            <div style="background:var(--paper-2);border:1px dashed var(--ink);padding:12px;border-radius:var(--r-1);display:flex;flex-direction:column;justify-content:space-between">
              <div>
                <p style="font-weight:700;font-size:var(--fs-xs)">Cuenta Admin</p>
                <p class="small muted" style="font-size:11px">admin@theclothesbox.co</p>
              </div>
              <button type="button" class="btn btn--ghost btn--sm" id="btn-quick-admin" style="margin-top:8px">Entrar Admin</button>
            </div>
          </div>

          <div style="text-align:center;position:relative;margin-block:4px">
            <span style="background:var(--paper);padding:0 12px;font-size:var(--fs-xs);color:var(--muted);font-weight:600;text-transform:uppercase">o con tu correo</span>
            <hr style="position:absolute;left:0;right:0;top:50%;z-index:-1;border:0;border-top:var(--hair);margin:0">
          </div>

          <form id="login-form" class="stack" style="--stack:14px" novalidate>
            <p class="error small" id="login-error" role="alert"></p>
            <div class="field">
              <label for="login-email">Correo electrónico</label>
              <input class="input" id="login-email" name="email" type="email" autocomplete="email" required placeholder="tu@correo.com">
            </div>
            <div class="field">
              <label for="login-password">Contraseña</label>
              <input class="input" id="login-password" name="password" type="password" autocomplete="current-password" required placeholder="••••••••">
              <button type="button" class="link-btn small" id="btn-to-forgot" style="justify-self:start;margin-top:4px">¿Olvidaste tu contraseña?</button>
            </div>
            <button type="submit" class="btn btn--block btn--lg" style="margin-top:8px">Ingresar a mi cuenta ${icon('arrowR')}</button>
          </form>

          <p class="small muted" style="text-align:center">
            ¿No tienes cuenta? <button type="button" class="link-btn" id="btn-to-register">Regístrate gratis</button>
          </p>
        </div>
      `,
      onMount(modalEl, close) {
        const form = modalEl.querySelector('#login-form');
        const errEl = modalEl.querySelector('#login-error');

        modalEl.querySelector('#btn-quick-demo').addEventListener('click', async () => {
          try {
            const data = await TCB.api.auth.login('demo@theclothesbox.co', 'demo123');
            await TCB.state.loadUserSession();
            close();
            TCB.state.toast('Bienvenido de vuelta, Jose Miguel (Cliente).');
            if (onSuccess) onSuccess();
            else window.location.hash = '#/caja';
          } catch (e) {
            errEl.textContent = 'Error al ingresar con cuenta demo.';
          }
        });

        modalEl.querySelector('#btn-quick-admin')?.addEventListener('click', async () => {
          try {
            const data = await TCB.api.auth.login('admin@theclothesbox.co', 'admin123');
            await TCB.state.loadUserSession();
            close();
            TCB.state.toast('Bienvenido al Panel de Operaciones (ADMIN).');
            if (onSuccess) onSuccess();
            else window.location.hash = '#/admin';
          } catch (e) {
            errEl.textContent = 'Error al ingresar con cuenta admin.';
          }
        });

        modalEl.querySelector('#btn-to-register').addEventListener('click', () => {
          close();
          openRegisterModal(onSuccess);
        });

        modalEl.querySelector('#btn-to-forgot').addEventListener('click', () => {
          close();
          openForgotModal(form.elements.email.value.trim());
        });

        form.addEventListener('submit', async e => {
          e.preventDefault();
          errEl.textContent = '';
          const email = form.elements.email.value.trim();
          const password = form.elements.password.value;
          if (!email || !password) {
            errEl.textContent = 'Escribe tu correo y contraseña.';
            return;
          }

          const btn = form.querySelector('button[type="submit"]');
          btn.classList.add('is-loading');

          try {
            await TCB.api.auth.login(email, password);
            await TCB.state.loadUserSession();
            close();
            TCB.state.toast('Sesión iniciada con éxito.');
            if (onSuccess) onSuccess();
            else window.location.hash = '#/caja';
          } catch (err) {
            errEl.textContent = err.data?.error || err.message;
          } finally {
            btn.classList.remove('is-loading');
          }
        });
      }
    });
  }

  function openRegisterModal(onSuccess) {
    TCB.state.modal({
      eyebrow: 'Registro',
      title: 'Crear tu cuenta',
      body: `
        <form id="register-form" class="stack" style="--stack:14px" novalidate>
          <p class="error small" id="reg-error" role="alert"></p>
          <div class="field">
            <label for="reg-name">Tu nombre completo</label>
            <input class="input" id="reg-name" name="name" autocomplete="name" required placeholder="Ej. Camila Morales">
          </div>
          <div class="field">
            <label for="reg-email">Correo electrónico</label>
            <input class="input" id="reg-email" name="email" type="email" autocomplete="email" required placeholder="tu@correo.com">
          </div>
          <div class="field">
            <label for="reg-birth">Fecha de nacimiento</label>
            <input class="input" id="reg-birth" name="birthDate" type="date" autocomplete="bday" required max="${maxBirthDate()}">
            <p class="small muted">Debes ser mayor de ${MIN_AGE} años.</p>
          </div>
          <div class="field">
            <label for="reg-password">Crea una contraseña segura</label>
            <input class="input" id="reg-password" name="password" type="password" autocomplete="new-password" required minlength="6" placeholder="Mínimo 6 caracteres">
          </div>
          <label style="display:flex;gap:10px;align-items:flex-start;font-size:var(--fs-sm);line-height:1.4;cursor:pointer">
            <input type="checkbox" name="acceptedPolicy" id="reg-consent" style="margin-top:3px;width:18px;height:18px;flex:none">
            <span>Acepto la <button type="button" class="link-btn" id="btn-open-policy">política de tratamiento de datos</button> (Ley 1581 de 2012).</span>
          </label>
          <button type="submit" class="btn btn--block btn--lg" style="margin-top:8px">Registrarme y empezar ${icon('arrowR')}</button>
          <p class="small muted" style="text-align:center">
            ¿Ya tienes cuenta? <button type="button" class="link-btn" id="btn-to-login">Iniciar sesión</button>
          </p>
        </form>
      `,
      onMount(modalEl, close) {
        const form = modalEl.querySelector('#register-form');
        const errEl = modalEl.querySelector('#reg-error');

        modalEl.querySelector('#btn-to-login').addEventListener('click', () => {
          close();
          openLoginModal(onSuccess);
        });

        modalEl.querySelector('#btn-open-policy').addEventListener('click', openPolicyModal);

        form.addEventListener('submit', async e => {
          e.preventDefault();
          errEl.textContent = '';
          const name = form.elements.name.value.trim();
          const email = form.elements.email.value.trim();
          const password = form.elements.password.value;
          const birthDate = form.elements.birthDate.value;

          if (!name || !email || !password || !birthDate) {
            errEl.textContent = 'Completa todos los campos.';
            return;
          }
          if (ageFrom(birthDate) < MIN_AGE) {
            errEl.textContent = `Debes ser mayor de ${MIN_AGE} años para crear una cuenta en The Clothes Box.`;
            return;
          }
          if (password.length < 6) {
            errEl.textContent = 'La contraseña debe tener mínimo 6 caracteres.';
            return;
          }
          if (!form.elements.acceptedPolicy.checked) {
            errEl.textContent = 'El consentimiento es obligatorio. Marca la casilla para aceptar la política de tratamiento de datos.';
            return;
          }

          const btn = form.querySelector('button[type="submit"]');
          btn.classList.add('is-loading');

          try {
            const policy = await loadPolicy();
            await TCB.api.auth.register({
              name, email, password, birthDate,
              acceptedPolicy: true,
              policyVersion: policy.version
            });
            await TCB.state.loadUserSession();
            close();
            TCB.state.toast(`¡Bienvenido a The Clothes Box, ${name}! Te enviamos un correo para verificar tu cuenta.`);
            window.location.hash = '#/empezar';
          } catch (err) {
            if (err.data?.code === 'EMAIL_EXISTS') {
              errEl.innerHTML = `${err.data.error}. <button type="button" class="link-btn" data-dup-login>Iniciar sesión</button> · <button type="button" class="link-btn" data-dup-forgot>Recuperar contraseña</button>`;
              errEl.querySelector('[data-dup-login]').addEventListener('click', () => { close(); openLoginModal(onSuccess); });
              errEl.querySelector('[data-dup-forgot]').addEventListener('click', () => { close(); openForgotModal(email); });
            } else {
              errEl.textContent = err.data?.error || err.message;
            }
          } finally {
            btn.classList.remove('is-loading');
          }
        });
      }
    });
  }

  function openForgotModal(prefillEmail = '') {
    TCB.state.modal({
      eyebrow: 'Tu Cuenta',
      title: 'Recuperar contraseña',
      body: `
        <form id="forgot-form" class="stack" style="--stack:14px" novalidate>
          <p class="small muted">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña. El enlace vence en 1 hora.</p>
          <p class="error small" id="forgot-error" role="alert"></p>
          <div class="field">
            <label for="forgot-email">Correo electrónico</label>
            <input class="input" id="forgot-email" name="email" type="email" autocomplete="email" required value="${prefillEmail}" placeholder="tu@correo.com">
          </div>
          <button type="submit" class="btn btn--block btn--lg">Enviar enlace ${icon('arrowR')}</button>
        </form>
      `,
      onMount(modalEl, close) {
        const form = modalEl.querySelector('#forgot-form');
        const errEl = modalEl.querySelector('#forgot-error');
        form.addEventListener('submit', async e => {
          e.preventDefault();
          errEl.textContent = '';
          const email = form.elements.email.value.trim();
          if (!email) {
            errEl.textContent = 'Escribe tu correo.';
            return;
          }
          try {
            const res = await TCB.api.auth.forgot(email);
            close();
            TCB.state.toast(res.message, { ms: 7000 });
          } catch (err) {
            errEl.textContent = err.data?.error || err.message;
          }
        });
      }
    });
  }

  function openPolicyModal() {
    loadPolicy().then(policy => {
      TCB.state.modal({
        eyebrow: `Versión ${policy.version}`,
        title: policy.title,
        body: `
          <div class="stack" style="--stack:12px">
            ${policy.pendingLegalReview ? `<p class="badge badge--dark" style="justify-self:start">Pendiente de revisión legal</p>` : ''}
            ${policy.text.map(p => `<p class="small" style="line-height:1.55">${p}</p>`).join('')}
          </div>
        `
      });
    }).catch(() => TCB.state.toast('No se pudo cargar la política. Intenta de nuevo.'));
  }

  const MIN_AGE = 18;
  let policyCache = null;

  async function loadPolicy() {
    if (!policyCache) policyCache = await TCB.api.policy();
    return policyCache;
  }

  function ageFrom(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const now = new Date();
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
    return age;
  }

  function maxBirthDate() {
    const now = new Date();
    return `${now.getFullYear() - MIN_AGE}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  return {
    openLoginModal,
    openRegisterModal,
    openForgotModal,
    openPolicyModal
  };
})();
