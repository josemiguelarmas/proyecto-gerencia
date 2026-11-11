// Account Links — Pantallas que abren los enlaces del correo (restablecer contraseña y verificar correo)
window.TCB = window.TCB || {};
TCB.views = TCB.views || {};

(() => {
  const { icon } = TCB.brand;

  function tokenFromHash() {
    const query = (window.location.hash.split('?')[1] || '');
    return new URLSearchParams(query).get('token') || '';
  }

  function card(inner) {
    return `
      <div class="screen wrap">
        <div style="max-width:460px;margin:var(--s-8) auto;background:var(--sheet);border:var(--line);padding:28px">
          ${inner}
        </div>
      </div>
    `;
  }

  TCB.views.resetPassword = {
    render() {
      if (!tokenFromHash()) {
        return card(`
          <h1 class="display" style="font-size:var(--fs-2xl)">Enlace incompleto</h1>
          <p class="muted" style="margin-top:8px">Abre el enlace completo que te enviamos por correo o solicita uno nuevo.</p>
          <button type="button" class="btn btn--gold" style="margin-top:16px" data-forgot>Solicitar nuevo enlace</button>
        `);
      }
      return card(`
        <p class="eyebrow">Tu Cuenta</p>
        <h1 class="display" style="font-size:var(--fs-2xl)">Crea una nueva contraseña</h1>
        <form id="reset-form" class="stack" style="--stack:14px;margin-top:16px" novalidate>
          <p class="error small" id="reset-error" role="alert"></p>
          <div class="field">
            <label for="reset-password">Nueva contraseña</label>
            <input class="input" id="reset-password" name="password" type="password" autocomplete="new-password" minlength="6" required placeholder="Mínimo 6 caracteres">
          </div>
          <div class="field">
            <label for="reset-confirm">Repite la contraseña</label>
            <input class="input" id="reset-confirm" name="confirm" type="password" autocomplete="new-password" required>
          </div>
          <button type="submit" class="btn btn--block btn--lg">Guardar contraseña ${icon('arrowR')}</button>
        </form>
      `);
    },
    mount(root) {
      root.querySelector('[data-forgot]')?.addEventListener('click', () => TCB.views.auth.openForgotModal());
      const form = root.querySelector('#reset-form');
      if (!form) return;
      const errEl = root.querySelector('#reset-error');
      form.addEventListener('submit', async e => {
        e.preventDefault();
        errEl.textContent = '';
        const password = form.elements.password.value;
        if (password.length < 6) {
          errEl.textContent = 'La contraseña debe tener mínimo 6 caracteres.';
          return;
        }
        if (password !== form.elements.confirm.value) {
          errEl.textContent = 'Las contraseñas no coinciden.';
          return;
        }
        try {
          const res = await TCB.api.auth.reset(tokenFromHash(), password);
          TCB.state.toast(res.message);
          window.location.hash = '#/';
          TCB.views.auth.openLoginModal();
        } catch (err) {
          errEl.innerHTML = `${err.data?.error || err.message} <button type="button" class="link-btn" data-forgot-again>Solicitar nuevo enlace</button>`;
          errEl.querySelector('[data-forgot-again]').addEventListener('click', () => TCB.views.auth.openForgotModal());
        }
      });
    }
  };

  TCB.views.verifyEmail = {
    render() {
      return card(`
        <p class="eyebrow">Verificación</p>
        <h1 class="display" style="font-size:var(--fs-2xl)" id="verify-title">Verificando tu correo…</h1>
        <p class="muted" style="margin-top:8px" id="verify-msg"></p>
        <a href="#/perfil" class="btn btn--gold" style="margin-top:16px;display:inline-flex">Ir a mi perfil</a>
      `);
    },
    async mount(root) {
      const title = root.querySelector('#verify-title');
      const msg = root.querySelector('#verify-msg');
      try {
        const res = await TCB.api.auth.verifyEmail(tokenFromHash());
        title.textContent = '¡Correo verificado!';
        msg.textContent = res.message;
        if (TCB.api.getToken()) await TCB.state.loadUserSession();
      } catch (err) {
        title.textContent = 'No pudimos verificar tu correo';
        msg.textContent = `${err.data?.error || err.message} Puedes pedir un nuevo enlace desde tu perfil.`;
      }
    }
  };
})();
