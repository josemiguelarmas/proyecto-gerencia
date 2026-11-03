/* Perfil — estilo y perfil corporal; muestra cómo te queda cada marca
   (Sistema 1: "talla verificada por historial de ajuste"). */
TCB.screens.perfil = (() => {
  const { icon, esc, modal, toast } = TCB.ui;
  const { styles, occasions, brands } = TCB.data;

  function render(state) {
    const p = state.profile;
    if (!p.done) {
      return `
        <div class="wrap empty">
          <p class="front front--talla">Perfil</p>
          <h1 tabindex="-1">Tu perfil está vacío.</h1>
          <p class="lede">Son tres minutos: estilo, ocasiones y cuatro medidas.</p>
          <a class="btn" href="#/empezar">Armar mi perfil ${icon("arrowR")}</a>
        </div>`;
    }
    const m = p.measures;
    const fitName = { holgado: "Holgado", regular: "A la medida", ajustado: "Ajustado" }[p.fit];
    const lineName = { m: "Masculino", f: "Femenino", u: "Los dos" }[p.line];
    const buildName = { delgada: "Delgada", media: "Media", robusta: "Robusta" }[m.build];

    return `
      <div class="wrap account">
        <header class="box-head">
          <p class="eyebrow">Perfil</p>
          <h1 tabindex="-1">${state.waitlist ? esc(state.waitlist.name) : "Tu perfil"}</h1>
          ${state.waitlist ? `<p class="small muted">En la lista de espera con ${esc(state.waitlist.email)}</p>` : ""}
        </header>

        <div class="profile-cols">
          <section aria-labelledby="pf-style">
            <div class="sec-row"><h2 id="pf-style" class="front front--curaduria">Estilo</h2><a class="link-btn small" href="#/empezar/estilo">Rehacer</a></div>
            <ol class="style-rank">
              ${p.styles.map((id, i) => {
                const s = styles.find((x) => x.id === id);
                return `<li><span class="mono muted">${i + 1}</span><span class="style-sw">${s.palette.slice(0, 3).map((c) => `<i style="background:${c}"></i>`).join("")}</span><span><strong>${s.name}</strong><br><span class="small muted">${s.note}</span></span></li>`;
              }).join("")}
            </ol>
            <dl class="kv">
              <div><dt>Ocasiones</dt><dd>${p.occasions.map((o) => occasions.find((x) => x.id === o).name).join(", ") || "—"}</dd></div>
              <div><dt>Cortes</dt><dd>${lineName}</dd></div>
              <div><dt>Ajuste preferido</dt><dd>${fitName}</dd></div>
              <div><dt>Cómo lo definiste</dt><dd>${state.lab.styleVariant === "A" ? "Moodboard" : "Quiz de 8 preguntas"}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="pf-body">
            <div class="sec-row">
              <h2 id="pf-body" class="front front--talla">Medidas</h2>
              <div style="display:flex;gap:12px">
                <a class="link-btn small" href="#/talla">Ver recomendación</a>
                <a class="link-btn small" href="#/empezar/medidas">Editar</a>
              </div>
            </div>
            <dl class="kv">
              <div><dt>Estatura</dt><dd class="num">${esc(m.height)} cm</dd></div>
              <div><dt>Peso</dt><dd class="num">${esc(m.weight)} kg</dd></div>
              <div><dt>Contextura</dt><dd>${buildName}</dd></div>
              <div><dt>Talla habitual</dt><dd>${m.usual}</dd></div>
              <div><dt>Prenda de referencia</dt><dd>${m.refBrand && m.refSize ? `${brands[m.refBrand] ? brands[m.refBrand].name : "Otra marca"}, talla ${m.refSize}` : "No agregada"}</dd></div>
            </dl>

            <h3 class="eyebrow" style="margin-top:28px">Cómo te queda cada marca</h3>
            <ul class="brand-fit">
              ${Object.values(brands).map((b) => {
                const total = b.runs + (p.brandAdj[b.id] || 0);
                const txt = total > 0.25 ? "Pides una talla más" : total < -0.25 ? "Pides una talla menos" : "Tu talla de siempre";
                return `<li><span><strong>${b.name}</strong><br><span class="small muted">${b.runsText}${p.brandAdj[b.id] ? " · ajustado por tus cajas" : ""}</span></span><span class="small">${txt}</span></li>`;
              }).join("")}
            </ul>
            <p class="small muted" style="margin-top:8px">Marcas de demostración.</p>
          </section>
        </div>

        <section class="danger-zone" aria-labelledby="del-t">
          <h2 id="del-t" class="setting-t">Borrar mis datos</h2>
          <p class="small muted">Elimina tu perfil, medidas y cajas de este dispositivo.</p>
          <button type="button" class="btn btn--danger btn--sm" data-wipe>Borrar todo</button>
        </section>
      </div>`;
  }

  function mount(root) {
    root.addEventListener("click", (e) => {
      if (!e.target.closest("[data-wipe]")) return;
      modal({
        eyebrow: "Borrar datos",
        title: "¿Borramos todo?",
        body: "<p>Se eliminan tu estilo, tus medidas, tus cajas y tu historial. No se puede deshacer.</p>",
        foot: `<button type="button" class="btn" data-close autofocus>No borrar</button><button type="button" class="btn btn--danger" data-ok>Borrar todo</button>`,
        onMount(dlg, close) {
          dlg.querySelector("[data-ok]").addEventListener("click", () => {
            TCB.store.reset();
            close();
            location.hash = "#/";
            toast("Borramos tus datos.");
          });
        },
      });
    });
  }

  return { key: "perfil", shell: "app", title: "Perfil — The Clothes Box", render, mount };
})();
