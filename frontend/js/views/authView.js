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
            <label for="reg-password">Crea una contraseña segura</label>
            <input class="input" id="reg-password" name="password" type="password" autocomplete="new-password" required minlength="6" placeholder="Mínimo 6 caracteres">
          </div>
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

        form.addEventListener('submit', async e => {
          e.preventDefault();
          errEl.textContent = '';
          const name = form.elements.name.value.trim();
          const email = form.elements.email.value.trim();
          const password = form.elements.password.value;

          if (!name || !email || !password) {
            errEl.textContent = 'Completa todos los campos.';
            return;
          }
          if (password.length < 6) {
            errEl.textContent = 'La contraseña debe tener mínimo 6 caracteres.';
            return;
          }

          const btn = form.querySelector('button[type="submit"]');
          btn.classList.add('is-loading');

          try {
            await TCB.api.auth.register(name, email, password);
            await TCB.state.loadUserSession();
            close();
            TCB.state.toast(`¡Bienvenido a The Clothes Box, ${name}!`);
            window.location.hash = '#/empezar';
          } catch (err) {
            errEl.textContent = err.data?.error || err.message;
          } finally {
            btn.classList.remove('is-loading');
          }
        });
      }
    });
  }

  return {
    openLoginModal,
    openRegisterModal
  };
})();
