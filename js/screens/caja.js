/* Vista previa de la caja — prototipo P05 / tarjetas 05 y 02. */
TCB.screens.caja = (() => {
  const { icon, esc, modal, toast, fmtDate, addDays } = TCB.ui;
  const E = TCB.engine;
  const G = TCB.garments;
  const { plans, brands, occasions } = TCB.data;
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function emptyState() {
    return `
      <div class="wrap empty">
        <p class="front front--curaduria">Tu caja</p>
        <h1 tabindex="-1">Aún no hay caja para ti.</h1>
        <p class="lede">Cuéntanos tu estilo y tus medidas, y en tres minutos ves qué te enviaríamos.</p>
        <a class="btn" href="#/empezar">Armar mi perfil ${icon("arrowR")}</a>
      </div>`;
  }

  function listJoin(arr) {
    return arr.length < 2 ? arr.join("") : arr.slice(0, -1).join(", ") + " y " + arr[arr.length - 1];
  }

  function render(state) {
    const box = state.box;
    if (!box) return emptyState();
    const p = state.profile;
    const plan = plans[p.plan];
    const month = MONTHS[addDays(new Date(), 5).getMonth()];
    const outfits = E.outfits(p, box);
    const occNames = listJoin(p.occasions.map((o) => occasions.find((x) => x.id === o).name.toLowerCase()));
    const swapUsed = !!box.swap;
    const rep = state.metrics.represents;
    const avgFit = Math.round(box.items.reduce((acc, id) => acc + E.fit(p, E.byId(id)).pct, 0) / box.items.length);

    return `
      <div class="wrap box">
        ${box.confirmed ? `<p class="note note--ok banner">${icon("check")}<span>Caja confirmada. <a href="#/envio">Ver el envío</a></span></p>` : ""}
        <header class="box-head">
          <p class="front front--curaduria">Caja ${box.cycle} · Plan ${plan.name}</p>
          <h1 tabindex="-1">Tu caja de ${month}.</h1>
          <p class="lede">${box.items.length} prendas pensadas para ${occNames || "tu día a día"}. ${box.confirmed ? "" : "Antes de enviarla puedes cambiar una."}</p>
          <div class="box-actions-bar">
            <a class="link-btn small" href="#/talla">${icon("ruler")} Ver análisis de ajuste por prenda (${avgFit} % match promedio)</a>
          </div>
        </header>

        <section class="slip" aria-labelledby="slip-title">
          <div class="slip-head">
            <h2 id="slip-title" class="eyebrow">Remisión · lo que va en la caja</h2>
            <span class="mono small">${String(box.cycle).padStart(3, "0")}-${p.plan.toUpperCase().slice(0, 3)}</span>
          </div>
          <ul class="slip-list">
            ${box.items.map((id, i) => {
              const it = E.byId(id);
              const fit = E.fit(p, it);
              const isSwapped = box.swap && box.swap.to === id;
              return `
              <li class="slip-row">
                <span class="slip-n mono">${String(i + 1).padStart(2, "0")}</span>
                <div class="slip-thumb" data-detail="${id}" style="cursor:pointer" title="Ver ficha técnica de ${esc(it.name)}">${G.tile(it, { label: false })}</div>
                <div class="slip-info">
                  <p><button type="button" class="link-btn slip-name" data-detail="${id}" style="text-align:left;cursor:pointer">${it.name}</button></p>
                  <p class="small muted">${brands[it.brand].name} · ${it.colorName} · ${it.fabric}</p>
                  <p class="slip-tags">
                    ${id === box.bet ? `<span class="chip">La apuesta</span>` : ""}
                    ${isSwapped ? `<span class="chip chip--ok">${icon("swap")} Cambiada</span>` : ""}
                  </p>
                </div>
                <a href="#/talla" class="slip-size" style="text-decoration:none" title="Ver por qué recomendamos talla ${fit.size}"><span class="size-label">Talla</span><span class="mono">${fit.size}</span><span class="small muted num">${fit.pct} %</span></a>
                <div class="slip-act">
                  ${box.confirmed ? "" : isSwapped
                    ? `<button type="button" class="btn btn--quiet btn--sm" data-undo>Deshacer</button>`
                    : `<button type="button" class="btn btn--ghost btn--sm" data-swap="${id}" ${swapUsed ? "disabled" : ""} aria-label="Cambiar ${esc(it.name)}">${icon("swap")} Cambiar</button>`}
                </div>
              </li>`;
            }).join("")}
          </ul>
          ${swapUsed && !box.confirmed ? `<p class="small muted slip-foot">Usaste el cambio de esta caja. Si quieres cambiar otra prenda, deshaz el anterior.</p>` : ""}
        </section>

        <section class="outfits" aria-labelledby="out-title">
          <div class="section-head">
            <p class="eyebrow">Cómo combinarlas</p>
            <h2 id="out-title">Tres outfits, y por qué los armamos así.</h2>
          </div>
          <div class="outfit-grid">
            ${outfits.map((o) => `
              <article class="outfit" aria-labelledby="${o.id}-t">
                <h3 id="${o.id}-t" class="outfit-title"><span class="mono small muted">${o.id.toUpperCase()}</span> ${o.title}</h3>
                <div class="outfit-pieces">${o.pieces.map((it) => `<div data-detail="${it.id}" style="cursor:pointer" title="Ver ficha técnica de ${esc(it.name)}">${G.tile(it)}</div>`).join("")}</div>
                <p class="small outfit-closet">+ De tu clóset: ${o.fromCloset.join(", ")}</p>
                <ul class="outfit-why">${o.why.map((w) => `<li>${w}</li>`).join("")}</ul>
              </article>`).join("")}
          </div>
        </section>

        ${box.confirmed ? "" : `
        <section class="decide" aria-labelledby="rep-q">
          <div>
            <h2 id="rep-q" class="pulse-q">¿Estos outfits te representan?</h2>
            <div class="scale" role="radiogroup" aria-labelledby="rep-q">
              ${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="rep" value="${n}" ${rep === n ? "checked" : ""}><span>${n}</span></label>`).join("")}
            </div>
            <div class="scale-ends"><span>Nada que ver</span><span>Esta ropa soy yo</span></div>
            ${rep != null && rep <= 2 ? `<p class="small" style="margin-top:12px">Gracias por decirlo. <a href="#/empezar/estilo">Ajusta tu estilo</a> y armamos otra caja.</p>` : ""}
          </div>
          <div class="decide-act">
            <button type="button" class="btn" data-confirm>Confirmar caja ${icon("arrowR")}</button>
            <p class="small muted">No se cobra nada en este prototipo.</p>
          </div>
        </section>`}
      </div>`;
  }

  function swapModal(itemId) {
    const s = TCB.store.get();
    const cur = E.byId(itemId);
    const alts = E.alternatives(s.profile, s.box, itemId);
    if (!alts.length) return toast("No hay otra prenda de ese tipo para tu perfil este mes.", { kind: "info" });
    modal({
      eyebrow: "Cambiar una prenda",
      title: `En vez de ${cur.name.toLowerCase()}…`,
      body: `
        <p class="muted small" style="margin-bottom:12px">Tienes un cambio por caja. Estas opciones encajan con tu estilo y tu talla.</p>
        <fieldset>
          <legend class="visually-hidden">Elige la prenda de reemplazo</legend>
          <div class="options">
            ${alts.map((a, i) => {
              const f = E.fit(s.profile, a);
              return `
              <label class="option option--alt">
                <input type="radio" name="alt" value="${a.id}" ${i === 0 ? "checked autofocus" : ""}>
                <span class="mark"></span>
                <span class="alt-thumb">${G.tile(a, { label: false })}</span>
                <span class="opt-text"><span class="opt-title">${a.name}</span><span class="opt-sub">${brands[a.brand].name} · ${a.colorName} · talla ${f.size} (${f.pct} %)</span></span>
              </label>`;
            }).join("")}
          </div>
        </fieldset>`,
      foot: `<button type="button" class="btn btn--quiet" data-close>Mantener la original</button><button type="button" class="btn" data-do-swap>Cambiar por esta</button>`,
      onMount(dlg, close) {
        dlg.querySelector("[data-do-swap]").addEventListener("click", () => {
          const to = dlg.querySelector('input[name="alt"]:checked').value;
          TCB.store.update((st) => {
            st.box.items = st.box.items.map((x) => (x === itemId ? to : x));
            st.box.swap = { from: itemId, to };
            if (st.box.bet === itemId) st.box.bet = null;
          });
          close();
          TCB.app.rerender();
          toast(`Cambiaste ${cur.name.toLowerCase()} por ${E.byId(to).name.toLowerCase()}.`, { action: "Deshacer", onAction: undo });
        });
      },
    });
  }

  function undo() {
    TCB.store.update((st) => {
      if (!st.box.swap) return;
      const { from, to } = st.box.swap;
      st.box.items = st.box.items.map((x) => (x === to ? from : x));
      st.box.swap = null;
    });
    TCB.app.rerender();
  }

  function confirmModal() {
    const s = TCB.store.get();
    const arrive = addDays(new Date(), 4);
    modal({
      eyebrow: "Confirmar caja",
      title: "¿A dónde la llevamos?",
      body: `
        <form id="ship" class="stack" style="--stack:16px" novalidate>
          <div class="field">
            <label for="ship-addr">Dirección en Cali</label>
            <input class="input" id="ship-addr" name="addr" autocomplete="street-address" value="${esc(s.box.address || "")}" aria-describedby="ship-addr-hint ship-addr-err" required autofocus>
            <p class="hint" id="ship-addr-hint">Calle, número y barrio. El piloto solo entrega en Cali.</p>
            <p class="error" id="ship-addr-err" role="alert"></p>
          </div>
          <dl class="kv">
            <div><dt>Llega</dt><dd>${fmtDate(arrive)}</dd></div>
            <div><dt>Prendas</dt><dd>${s.box.items.length}</dd></div>
            <div><dt>Plan</dt><dd>${plans[s.profile.plan].name}</dd></div>
            <div><dt>Pago</dt><dd>No se cobra en el prototipo</dd></div>
          </dl>
        </form>`,
      foot: `<button type="button" class="btn btn--quiet" data-close>Volver</button><button type="submit" form="ship" class="btn">Confirmar y enviar</button>`,
      onMount(dlg, close) {
        const form = dlg.querySelector("#ship");
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const v = form.elements.addr.value.trim();
          const err = v.length < 8 ? "Necesitamos una dirección completa para entregarte la caja." : "";
          form.elements.addr.setAttribute("aria-invalid", err ? "true" : "false");
          dlg.querySelector("#ship-addr-err").textContent = err;
          if (err) return form.elements.addr.focus();
          const btn = dlg.querySelector('button[type="submit"]');
          btn.classList.add("is-loading");
          btn.textContent = "Confirmando";
          setTimeout(() => {
            TCB.store.update((st) => {
              st.box.confirmed = true;
              st.box.address = v;
              st.box.stage = 1;
              st.box.arrive = arrive.toISOString();
              st.metrics.accepted = true;
            });
            close();
            location.hash = "#/envio";
            toast("Caja confirmada. Te avisamos cuando salga.");
          }, 900);
        });
      },
    });
  }

  function garmentModal(itemId) {
    const s = TCB.store.get();
    const it = E.byId(itemId);
    const fit = E.fit(s.profile, it);
    const b = brands[it.brand];
    const isBottom = it.cat === "bottom";

    modal({
      eyebrow: `${b.name} · ${b.city}`,
      title: it.name,
      body: `
        <div class="garment-detail">
          <div class="garment-detail-thumb">
            ${G.tile(it, { label: false, fabric: true })}
          </div>
          <div class="garment-detail-info">
            <dl class="kv">
              <div><dt>Color</dt><dd>${it.colorName}</dd></div>
              <div><dt>Tela</dt><dd>${it.fabric}</dd></div>
              <div><dt>Corte</dt><dd>${it.fit === "holgado" ? "Holgado / Oversized" : it.fit === "ajustado" ? "Ajustado al cuerpo" : "Regular / Recto"}</dd></div>
              <div><dt>Talla recomendada</dt><dd><strong class="mono" style="font-size:var(--fs-lg)">${fit.size}</strong> (${fit.pct} % ajuste)</dd></div>
              <div><dt>${isBottom ? "Cintura de la prenda" : "Pecho de la prenda"}</dt><dd class="num">${fit.garmentCm} cm (holgura ${fit.room} cm)</dd></div>
              <div><dt>Tu ${fit.measure} estimado</dt><dd class="num">${fit.bodyCm} cm</dd></div>
              <div><dt>Taller aliado</dt><dd>${b.name} (${b.runsText})</dd></div>
            </dl>
            ${fit.alert ? `<p class="note note--warn small" style="margin-top:12px">${icon("alert")}<span>${fit.alert}: nuestro motor ya recalibró la talla para que te quede a la medida.</span></p>` : ""}
          </div>
        </div>`,
      foot: `<button type="button" class="btn btn--quiet" data-close>Cerrar</button><a class="btn" href="#/talla" data-close>Ver reporte de tallas ${icon("arrowR")}</a>`
    });
  }

  function mount(root, params, rerender) {
    root.addEventListener("click", (e) => {
      const det = e.target.closest("[data-detail]");
      if (det) garmentModal(det.dataset.detail);
      const sw = e.target.closest("[data-swap]");
      if (sw && !sw.disabled) swapModal(sw.dataset.swap);
      if (e.target.closest("[data-undo]")) { undo(); toast("Volvió la prenda original."); }
      if (e.target.closest("[data-confirm]")) confirmModal();
    });
    root.addEventListener("change", (e) => {
      if (e.target.name === "rep") {
        TCB.store.update((s) => { s.metrics.represents = Number(e.target.value); });
        rerender({ keepFocus: `input[name="rep"][value="${e.target.value}"]` });
      }
    });
  }

  return { key: "caja", shell: "app", title: "Tu caja — The Clothes Box", render, mount };
})();
