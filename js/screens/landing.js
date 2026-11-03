/* Landing — prototipo P04 / tarjeta 03 (fake door) y tarjeta 07 (garantía A/B). */
TCB.screens = TCB.screens || {};

TCB.screens.landing = (() => {
  const { esc, cop, icon, modal, toast } = TCB.ui;
  const { plans, evidence, catalog } = TCB.data;
  const G = TCB.garments;

  const steps = [
    { n: 1, t: "Quiz de estilo", d: "3 minutos: estilo, medidas y presupuesto.", f: ["curaduria", "talla"] },
    { n: 2, t: "Curaduría", d: "Cruzamos tu perfil con el catálogo de marcas aliadas y un estilista lo revisa.", f: ["curaduria"] },
    { n: 3, t: "Vista previa", d: "Ves tu caja antes del envío y puedes cambiar una prenda.", f: ["curaduria"] },
    { n: 4, t: "Caja a domicilio", d: "Esencial: 3 prendas. Estilo: 5 prendas.", f: ["suscripcion"] },
    { n: 5, t: "Se queda o cambia", d: "Lo que no te queda o no te gusta se cambia gratis.", f: ["suscripcion", "talla"] },
    { n: 6, t: "Calificas", d: "Cada prenda recibe una nota y la próxima caja acierta más.", f: ["curaduria"] },
  ];

  function heroSlip() {
    const items = ["p17", "p01", "p10"].map((id) => catalog.find((p) => p.id === id));
    return `
      <figure class="hero-slip" aria-label="Ejemplo de caja: sobrecamisa de pana, camiseta pesada y jean recto, con talla M recomendada al 94 %">
        <div class="hero-slip-head"><span class="mono">CAJA 001 · ESENCIAL</span><span class="mono">3 PRENDAS</span></div>
        <div class="hero-slip-grid">${items.map((p) => G.tile(p, { label: false })).join("")}</div>
        <ul class="hero-slip-list">
          ${items.map((p) => `<li><span>${p.name}</span><span class="mono">M</span></li>`).join("")}
        </ul>
        <div class="hangtag hero-tag" aria-hidden="true"><span class="size-label">Tu talla</span><span class="size">M</span><span class="pct">94 % ajuste</span></div>
      </figure>`;
  }

  function render(state) {
    const g = state.lab.guarantee;
    const joined = state.waitlist;
    return `
    <section class="hero wrap" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow">Caja mensual de moda · piloto en Cali</p>
        <h1 id="hero-title" tabindex="-1">Ropa que te representa, con la talla resuelta <em>antes</em> de pagar.</h1>
        <p class="lede">Respondes un quiz de tres minutos. Armamos tu caja con prendas de marcas locales y te explicamos por qué las elegimos.${g ? " Si algo no te queda o no te gusta, el cambio es gratis." : ""}</p>
        <div class="hero-actions">
          <a class="btn" href="#/empezar">Arma tu perfil ${icon("arrowR")}</a>
          <a class="btn btn--quiet" href="#/inicio/planes">Ver planes</a>
        </div>
        <p class="small muted">Sin tarjeta. Primero ves tu caja; después decides.</p>
      </div>
      ${heroSlip()}
    </section>

    <section class="tension wrap" aria-labelledby="tension-title">
      <h2 id="tension-title" class="visually-hidden">Dónde estamos</h2>
      <div class="tension-axis">
        <div class="tension-end">
          <p class="tension-name">Fast fashion</p>
          <p class="small">Barato y rápido, pero todos terminan vestidos igual.</p>
        </div>
        <div class="tension-mid">
          <p class="eyebrow">Lo que falta</p>
          <p class="tension-us">Identidad + precio alcanzable + talla segura</p>
        </div>
        <div class="tension-end tension-end--r">
          <p class="tension-name">Marcas exclusivas</p>
          <p class="small">Identidad y buenas telas, a precios que un joven no paga.</p>
        </div>
      </div>
    </section>

    <section class="evidence wrap" aria-labelledby="evi-title">
      <div class="section-head">
        <p class="eyebrow">Lo que escuchamos</p>
        <h2 id="evi-title">Le preguntamos a 50 jóvenes de 18 a 30 años qué pesa al comprar ropa.</h2>
      </div>
      <dl class="evi-grid">
        <div><dt class="evi-num" style="color:var(--talla)">${evidence.identity}<span>%</span></dt><dd>quiere que la ropa refleje quién es.</dd></div>
        <div><dt class="evi-num" style="color:var(--suscripcion)">${evidence.price}<span>%</span></dt><dd>decide su compra por el precio.</dd></div>
        <div><dt class="evi-num" style="color:var(--curaduria)">${evidence.fabric}<span>%</span></dt><dd>prioriza la calidad de las telas.</dd></div>
      </dl>
      <p class="evi-quote display">“El problema no es la talla: es el costo de equivocarse.”</p>
      <p class="source small muted">${evidence.source} ${evidence.market.map((m) => `${m.k} ${m.v}`).join("; ")} (${evidence.marketSource})</p>
    </section>

    <section id="como-funciona" class="how wrap" aria-labelledby="how-title">
      <div class="section-head">
        <p class="eyebrow">Cómo funciona</p>
        <h2 id="how-title">Seis pasos, y el último mejora al primero.</h2>
      </div>
      <ol class="how-steps">
        ${steps.map((s) => `
          <li>
            <span class="how-bar">${s.f.map((f) => `<i style="background:var(--${f})"></i>`).join("")}</span>
            <span class="how-n display">${s.n}</span>
            <h3>${s.t}</h3>
            <p class="small">${s.d}</p>
          </li>`).join("")}
      </ol>
      <p class="how-loop">${icon("refresh")} <span><strong>La calificación vuelve a la curaduría:</strong> cada caja acierta más que la anterior.</span></p>
    </section>

    ${g ? `
    <section id="garantia" class="guarantee" aria-labelledby="gar-title">
      <div class="wrap guarantee-inner">
        <div>
          <p class="front front--suscripcion" style="color:#f0a46f">Garantía de cambio</p>
          <h2 id="gar-title">Si no te queda, no pierdes ni plata ni tiempo.</h2>
        </div>
        <ul class="guarantee-list">
          <li>${icon("swap")}<div><strong>Cambio gratis</strong><span>De lo que no te queda o no te gusta. Lo recogemos en tu casa.</span></div></li>
          <li>${icon("ruler")}<div><strong>¿Dudas entre dos tallas?</strong><span>Te enviamos las dos y nos llevamos la que sobra.</span></div></li>
          <li>${icon("pause")}<div><strong>Pausa o cancela</strong><span>Cuando quieras, sin llamar a nadie.</span></div></li>
        </ul>
      </div>
    </section>` : ""}

    <section id="planes" class="plans wrap" aria-labelledby="plans-title">
      <div class="section-head">
        <p class="eyebrow">Planes</p>
        <h2 id="plans-title">Un precio fijo al mes. Tú eliges cuántas prendas.</h2>
      </div>
      <div class="plan-cols">
        ${Object.values(plans).map((p) => `
          <article class="plan-col ${p.id === "estilo" ? "plan-col--alt" : ""}" aria-labelledby="plan-${p.id}">
            <header>
              <h3 id="plan-${p.id}" class="display">${p.name}</h3>
              <p class="plan-price"><span class="num">${cop(p.price)}</span> <span class="muted small">/ mes</span></p>
            </header>
            <ul class="ticks">
              <li>${icon("check")} ${p.items} prendas elegidas para ti</li>
              <li>${icon("check")} Talla recomendada para cada prenda</li>
              <li>${icon("check")} Vista previa y un cambio antes del envío</li>
              ${g ? `<li>${icon("check")} Cambio gratis de lo que no sirva</li>` : ""}
              <li>${icon("check")} Pausa o cancela cuando quieras</li>
            </ul>
            <button type="button" class="btn ${p.id === "estilo" ? "" : "btn--ghost"} btn--block" data-subscribe="${p.id}">
              ${joined ? "Ya estás en la lista" : "Suscribirme"}
            </button>
          </article>`).join("")}
      </div>
      <p class="small muted plans-note">${icon("info")} <span>Precios en validación: el piloto aún no cobra. Al suscribirte entras a la lista de espera de la primera caja en Cali.</span></p>
    </section>

    <footer class="site-foot">
      <div class="wrap foot-inner">
        <div>
          <p class="brand-mark">The Clothes Box</p>
          <p class="small muted">“Esta ropa soy yo.”</p>
        </div>
        <p class="small muted">Prototipo académico · Innovación y Emprendimiento II · Universidad Icesi, 2026.<br>
          Andrés Felipe López · Jaime Muñoz · Jose Miguel Armas · Sebastián Castillo.<br>
          Marcas y prendas de demostración. Ningún cobro es real.</p>
      </div>
    </footer>`;
  }

  function waitlistModal(planId) {
    const state = TCB.store.get();
    if (state.waitlist) {
      toast(`Ya estás en la lista con ${state.waitlist.email}.`, { kind: "info" });
      return;
    }
    modal({
      eyebrow: "Lista de espera",
      title: "Todavía no cobramos.",
      body: `
        <p class="muted" style="margin-bottom:20px">Estamos armando la primera caja en Cali con tiendas aliadas. Déjanos tus datos y te escribimos cuando abra.</p>
        <form id="wl-form" class="stack" style="--stack:18px" novalidate>
          <div class="field">
            <label for="wl-name">Nombre</label>
            <input class="input" id="wl-name" name="name" autocomplete="given-name" required aria-describedby="wl-name-err" autofocus>
            <p class="error" id="wl-name-err" role="alert"></p>
          </div>
          <div class="field">
            <label for="wl-email">Correo</label>
            <input class="input" id="wl-email" name="email" type="email" inputmode="email" autocomplete="email" required aria-describedby="wl-email-err">
            <p class="error" id="wl-email-err" role="alert"></p>
          </div>
          <fieldset class="field">
            <legend class="field-label" style="margin-bottom:6px">Plan que te interesa</legend>
            <div class="segmented">
              ${Object.values(plans).map((p) => `<label><input type="radio" name="plan" value="${p.id}" ${p.id === planId ? "checked" : ""}><span>${p.name} · ${cop(p.price)}</span></label>`).join("")}
            </div>
          </fieldset>
          <label class="option" style="border-top:var(--hair)">
            <input type="checkbox" name="consent" required>
            <span class="mark"></span>
            <span class="opt-text"><span class="small">Acepto que me escriban solo para avisarme del lanzamiento.</span></span>
          </label>
          <p class="error" id="wl-consent-err" role="alert"></p>
        </form>`,
      foot: `<button type="button" class="btn btn--quiet" data-close>Ahora no</button><button type="submit" form="wl-form" class="btn">Unirme a la lista</button>`,
      onMount(dlg, close) {
        const form = dlg.querySelector("#wl-form");
        const rules = {
          name: (v) => (v.trim().length < 2 ? "Escribe tu nombre para saber cómo llamarte." : ""),
          email: (v) => (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "Revisa el correo: debe verse como nombre@dominio.com." : ""),
        };
        const check = (name) => {
          const el = form.elements[name];
          const msg = rules[name](el.value);
          el.setAttribute("aria-invalid", msg ? "true" : "false");
          dlg.querySelector(`#wl-${name}-err`).textContent = msg;
          return !msg;
        };
        ["name", "email"].forEach((n) => form.elements[n].addEventListener("blur", () => form.elements[n].value && check(n)));
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const okName = check("name"), okEmail = check("email");
          const okConsent = form.elements.consent.checked;
          dlg.querySelector("#wl-consent-err").textContent = okConsent ? "" : "Necesitamos tu permiso para escribirte.";
          if (!okName) return form.elements.name.focus();
          if (!okEmail) return form.elements.email.focus();
          if (!okConsent) return form.elements.consent.focus();
          const btn = dlg.querySelector('button[type="submit"]');
          btn.classList.add("is-loading");
          btn.textContent = "Guardando";
          setTimeout(() => {
            const data = { name: form.elements.name.value.trim(), email: form.elements.email.value.trim(), plan: form.elements.plan.value };
            TCB.store.update((s) => { s.waitlist = data; s.profile.plan = data.plan; });
            dlg.querySelector(".modal-body").innerHTML = `
              <div class="success-block">
                <span class="success-mark">${icon("check")}</span>
                <p class="display" style="font-size:var(--fs-xl)">Quedaste en la lista, ${esc(data.name)}.</p>
                <p class="muted">Te escribimos a <strong>${esc(data.email)}</strong> cuando abra la primera caja del plan ${plans[data.plan].name}. Mientras tanto, puedes armar tu perfil y ver cómo se vería tu caja.</p>
              </div>`;
            dlg.querySelector(".modal-foot").innerHTML = `<button type="button" class="btn btn--quiet" data-close>Cerrar</button><a class="btn" href="#/empezar" data-close>Armar mi perfil ${icon("arrowR")}</a>`;
            dlg.querySelector('a[href="#/empezar"]').focus();
          }, 900);
        });
      },
    });
  }

  function mount(root) {
    root.addEventListener("click", (e) => {
      const sub = e.target.closest("[data-subscribe]");
      if (sub) waitlistModal(sub.dataset.subscribe);
    });
  }

  return { key: "landing", shell: "public", title: "The Clothes Box — moda que te representa", render, mount, waitlistModal };
})();
