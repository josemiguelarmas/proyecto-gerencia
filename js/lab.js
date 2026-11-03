/* Modo prueba: lo usa el equipo durante las sesiones de usabilidad.
   Muestra qué tarjeta valida cada pantalla, permite cambiar las variantes
   A/B del plan de pruebas y registra los datos de la sesión. */
TCB.lab = (() => {
  const { icon, modal, toast } = TCB.ui;
  const { cards, screenCards } = TCB.data;
  let open = false;
  let screenKey = "landing";
  let host, panel, btn;

  function mmss(ms) {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function metricsRows(state) {
    const m = state.metrics;
    const t = m.onboardStart && m.onboardEnd ? m.onboardEnd - m.onboardStart : null;
    const rows = [
      ["Tiempo del perfil", t == null ? "—" : mmss(t), t == null ? null : t < 180000, "meta < 3:00 (tarjeta 05)"],
      ["Confianza en la talla", m.confidence ?? "—", m.confidence == null ? null : m.confidence >= 4, "meta ≥ 4/5 (tarjeta 01)"],
      ["“Me representa”", m.represents ?? "—", m.represents == null ? null : m.represents >= 4, "meta ≥ 4/5 (tarjeta 05)"],
      ["Aceptó la caja", m.accepted ? "Sí" : "—", m.accepted ? true : null, "decisión declarada (P05)"],
      ["Lista de espera", state.waitlist ? "Registrado" : "—", state.waitlist ? true : null, "conversión (tarjeta 03)"],
    ];
    return rows.map(([k, v, ok, note]) => `
      <div class="lab-metric">
        <dt>${k}<span>${note}</span></dt>
        <dd>${v}${ok == null ? "" : ok ? ` <em class="ok">cumple</em>` : ` <em class="no">no cumple</em>`}</dd>
      </div>`).join("");
  }

  function panelHtml(state) {
    const keys = screenCards[screenKey] || [];
    return `
      <div class="lab-head">
        <p class="eyebrow" id="lab-title">Modo prueba</p>
        <button type="button" class="icon-btn" data-lab-close aria-label="Cerrar modo prueba">${icon("x")}</button>
      </div>
      <section>
        <h3 class="lab-h">Esta pantalla valida</h3>
        ${keys.length ? keys.map((k) => {
          const c = cards[k];
          return `<article class="lab-card" style="--c:var(--${c.front})">
            <p class="lab-card-k"><span class="mono">${k}</span> · ${c.type} · ${c.method}</p>
            <p class="lab-card-q">${c.q}</p>
            <p class="small">${c.goal}</p>
          </article>`;
        }).join("") : `<p class="small muted">Esta pantalla no está en el plan de pruebas.</p>`}
      </section>
      <section>
        <h3 class="lab-h">Variantes</h3>
        <div class="lab-ctl">
          <p class="small" id="lab-v1">Captura de estilo · tarjeta 05</p>
          <div class="segmented" role="radiogroup" aria-labelledby="lab-v1">
            <label><input type="radio" name="lab-style" value="A" ${state.lab.styleVariant === "A" ? "checked" : ""}><span>A · Moodboard</span></label>
            <label><input type="radio" name="lab-style" value="B" ${state.lab.styleVariant === "B" ? "checked" : ""}><span>B · Quiz</span></label>
          </div>
        </div>
        <div class="lab-ctl">
          <p class="small" id="lab-v2">Garantía de cambio · tarjeta 07</p>
          <div class="segmented" role="radiogroup" aria-labelledby="lab-v2">
            <label><input type="radio" name="lab-gar" value="1" ${state.lab.guarantee ? "checked" : ""}><span>Con garantía</span></label>
            <label><input type="radio" name="lab-gar" value="0" ${!state.lab.guarantee ? "checked" : ""}><span>Sin garantía</span></label>
          </div>
        </div>
      </section>
      <section>
        <h3 class="lab-h">Datos de la sesión</h3>
        <dl class="lab-metrics">${metricsRows(state)}</dl>
      </section>
      <section class="lab-actions">
        <button type="button" class="btn btn--ghost btn--sm" data-lab-sample>Cargar perfil de ejemplo</button>
        <button type="button" class="btn btn--quiet btn--sm" data-lab-reset>${icon("refresh")} Reiniciar demo</button>
      </section>
      <p class="small muted">Las prendas, marcas y la curaduría son simuladas con reglas (Mago de Oz). Nada se cobra ni se envía.</p>`;
  }

  function paint() {
    if (!host) return;
    btn.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    if (open) panel.innerHTML = panelHtml(TCB.store.get());
  }

  function sample() {
    TCB.store.update((s) => {
      Object.assign(s.profile, {
        done: true, styleMethod: "A", styles: ["retro", "urbano"], occasions: ["clase", "fiesta"], plan: "esencial",
        fit: "regular", line: "u", risk: 1, prints: 1,
        measures: { height: "172", weight: "66", build: "media", usual: "M", refBrand: "", refSize: "" },
      });
      s.metrics.onboardStart = Date.now() - 151000;
      s.metrics.onboardEnd = Date.now();
      const c = TCB.engine.curate(s.profile);
      s.box = { cycle: 1, items: c.items, bet: c.bet, swap: null, confirmed: false, stage: 0, returns: {} };
    });
    location.hash = "#/talla";
    toast("Perfil de ejemplo cargado.");
  }

  function mountOnce() {
    host = document.createElement("div");
    host.className = "lab";
    host.innerHTML = `
      <button type="button" class="lab-toggle" aria-expanded="false" aria-controls="lab-panel">${icon("flask")}<span>Modo prueba</span></button>
      <aside id="lab-panel" class="lab-panel" aria-labelledby="lab-title" hidden></aside>`;
    document.body.appendChild(host);
    btn = host.querySelector(".lab-toggle");
    panel = host.querySelector(".lab-panel");

    btn.addEventListener("click", () => { open = !open; paint(); if (open) panel.querySelector("[data-lab-close]").focus(); });
    host.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) { open = false; paint(); btn.focus(); } });
    panel.addEventListener("click", (e) => {
      if (e.target.closest("[data-lab-close]")) { open = false; paint(); btn.focus(); }
      if (e.target.closest("[data-lab-sample]")) sample();
      if (e.target.closest("[data-lab-reset]")) {
        modal({
          eyebrow: "Modo prueba",
          title: "¿Reiniciar la demo?",
          body: "<p>Se borra el perfil, la caja, las métricas y la lista de espera de esta sesión. Útil antes de la siguiente persona.</p>",
          foot: `<button type="button" class="btn btn--quiet" data-close>Cancelar</button><button type="button" class="btn" data-ok autofocus>Reiniciar</button>`,
          onMount(dlg, close) {
            dlg.querySelector("[data-ok]").addEventListener("click", () => {
              const lab = { ...TCB.store.get().lab };
              TCB.store.reset();
              TCB.store.update((s) => { s.lab = lab; });
              close();
              location.hash = "#/";
              TCB.app.rerender();
              toast("Demo reiniciada.");
            });
          },
        });
      }
    });
    panel.addEventListener("change", (e) => {
      if (e.target.name === "lab-style") TCB.store.update((s) => { s.lab.styleVariant = e.target.value; });
      if (e.target.name === "lab-gar") TCB.store.update((s) => { s.lab.guarantee = e.target.value === "1"; });
      const focusSel = `input[name="${e.target.name}"][value="${e.target.value}"]`;
      TCB.app.rerender();
      panel.querySelector(focusSel)?.focus();
    });
    TCB.store.subscribe(() => { if (open) { const a = document.activeElement; const sel = a && a.name ? `input[name="${a.name}"][value="${a.value}"]` : null; paint(); if (sel) panel.querySelector(sel)?.focus(); } });
  }

  function setScreen(key) {
    if (!host) mountOnce();
    screenKey = key;
    paint();
  }

  return { setScreen };
})();
