/* Resultado de talla — prototipo P03 / tarjetas 01 y 07. */
TCB.screens.talla = (() => {
  const { icon, esc } = TCB.ui;
  const E = TCB.engine;
  const G = TCB.garments;
  const needs = ["Ver las medidas de cada prenda", "Probármela antes de pagar", "Opiniones de gente con mi contextura", "Nada, así está bien"];

  function emptyState() {
    return `
      <div class="wrap empty">
        <p class="front front--talla">Tu talla</p>
        <h1 tabindex="-1">Todavía no tenemos tus medidas.</h1>
        <p class="lede">Con cuatro datos te decimos qué talla pedir en cada prenda, antes de pagar.</p>
        <a class="btn" href="#/empezar">Armar mi perfil ${icon("arrowR")}</a>
      </div>`;
  }

  function render(state) {
    if (!state.box) return emptyState();
    const p = state.profile;
    const rows = state.box.items.map((id) => ({ item: E.byId(id), fit: E.fit(p, E.byId(id)) }));
    const counts = {};
    rows.forEach((r) => (counts[r.fit.size] = (counts[r.fit.size] || 0) + 1));
    const main = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const others = rows.filter((r) => r.fit.size !== main).length;
    const avg = Math.round(rows.reduce((a, r) => a + r.fit.pct, 0) / rows.length);
    const anyLow = rows.some((r) => r.fit.level === "bajo");
    const g = state.lab.guarantee;
    const conf = state.metrics.confidence;
    const usedRef = p.measures.refBrand && p.measures.refSize;

    return `
      <div class="wrap fit">
        <header class="fit-head">
          <div class="fit-summary">
            <p class="front front--talla">Tu talla</p>
            <h1 tabindex="-1">${others === 0 ? `Eres ${main} en las ${rows.length} prendas.` : `Eres ${main} en casi todo.`}</h1>
            <p class="lede">${others === 0 ? "" : `En ${others === 1 ? "una prenda" : `${others} prendas`} te recomendamos otra talla porque esa marca no talla igual. `}Lo calculamos con tu estatura, peso, contextura y la talla que más compras${usedRef ? ", más tu prenda de referencia" : ""}.</p>
            <a class="link-btn small" href="#/empezar/medidas">Corregir mis medidas</a>
          </div>
          <div class="hangtag hangtag--lg" role="img" aria-label="Talla ${main}, ${avg} por ciento de ajuste promedio">
            <span class="size-label">Talla</span><span class="size">${main}</span><span class="pct">${avg} % ajuste</span>
          </div>
        </header>

        ${anyLow ? `<p class="note note--warn">${icon("alert")}<span>Tus medidas y la talla que sueles comprar no coinciden del todo. Agrega una prenda que te quede perfecta o revisa tus datos; si no, te enviamos dos tallas en las prendas marcadas.</span></p>` : ""}

        <ol class="fit-list">
          ${rows.map(({ item, fit }) => `
            <li class="fit-row">
              <div class="fit-thumb" data-detail="${item.id}" style="cursor:pointer" title="Ver ficha técnica de ${esc(item.name)}">${G.tile(item, { label: false })}</div>
              <div class="fit-info">
                <h2 class="fit-name"><button type="button" class="link-btn" data-detail="${item.id}" style="text-align:left;cursor:pointer">${item.name}</button></h2>
                <p class="small muted">${TCB.data.brands[item.brand].name} · ${item.fabric}</p>
                <div class="meter" data-level="${fit.level}">
                  <div class="meter-row"><strong>${E.levelText[fit.level]}</strong><span class="num">${fit.pct} %</span></div>
                  <div class="meter-bar"><i style="width:${fit.pct}%"></i></div>
                </div>
                <div class="fit-flags">
                  ${fit.alert ? `<span class="chip chip--warn">${icon("alert")} ${fit.alert}: ya lo ajustamos</span>` : ""}
                  ${fit.neighbor && g ? `<span class="chip">${icon("ruler")} Entre ${fit.size} y ${fit.neighbor}: te enviamos las dos</span>` : fit.neighbor ? `<span class="chip">${icon("ruler")} Entre ${fit.size} y ${fit.neighbor}</span>` : ""}
                  ${fit.adjusted ? `<span class="chip chip--ok">${icon("refresh")} Recalibrado con tu última caja</span>` : ""}
                </div>
                <details class="why">
                  <summary>¿Por qué ${fit.size}?</summary>
                  <dl class="why-grid num">
                    <div><dt>Tu ${fit.measure}, estimado</dt><dd>${fit.bodyCm} cm</dd></div>
                    <div><dt>La prenda en ${fit.size}</dt><dd>${fit.garmentCm} cm</dd></div>
                    <div><dt>Holgura</dt><dd>${fit.room} cm · ${item.fit === "holgado" ? "corte amplio" : item.fit === "ajustado" ? "corte al cuerpo" : "corte regular"}</dd></div>
                  </dl>
                </details>
              </div>
              <div class="fit-size" aria-label="Talla recomendada ${fit.size}"><span class="size-label">Pide</span><span class="display">${fit.size}</span></div>
            </li>`).join("")}
        </ol>

        ${g ? `<p class="note note--ok">${icon("shield")}<span><strong>Si igual no te queda, el cambio es gratis.</strong> Lo recogemos en tu casa y te enviamos la otra talla.</span></p>` : ""}

        <section class="pulse" aria-labelledby="pulse-q">
          <h2 id="pulse-q" class="pulse-q">¿Qué tan seguro te sientes de que te van a quedar?</h2>
          <div>
            <div class="scale" role="radiogroup" aria-labelledby="pulse-q">
              ${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="conf" value="${n}" ${conf === n ? "checked" : ""}><span>${n}</span><span class="visually-hidden">${n === 1 ? "nada seguro" : n === 5 ? "totalmente seguro" : ""}</span></label>`).join("")}
            </div>
            <div class="scale-ends"><span>Nada</span><span>Totalmente</span></div>
          </div>
          ${conf != null && conf <= 3 ? `
          <fieldset class="pulse-more">
            <legend class="small" style="font-weight:600;margin-bottom:8px">¿Qué te daría más confianza?</legend>
            <div class="chips-select">
              ${needs.map((n, i) => `<label><input type="checkbox" name="need" value="${i}" ${(state.metrics.needs || []).includes(i) ? "checked" : ""}><span>${n}</span></label>`).join("")}
            </div>
          </fieldset>` : conf != null ? `<p class="small muted">${icon("check")} Gracias. Lo usamos para mejorar las recomendaciones.</p>` : ""}
        </section>

        <div class="flow-foot">
          <a class="btn btn--quiet" href="#/empezar/medidas">${icon("arrowL")} Mis medidas</a>
          <a class="btn" href="#/caja">Ver mi caja ${icon("arrowR")}</a>
        </div>
      </div>`;
  }

  function garmentModal(itemId) {
    const s = TCB.store.get();
    const it = E.byId(itemId);
    const fit = E.fit(s.profile, it);
    const b = TCB.data.brands[it.brand];
    const isBottom = it.cat === "bottom";

    TCB.ui.modal({
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
      foot: `<button type="button" class="btn btn--quiet" data-close>Cerrar</button><a class="btn" href="#/caja" data-close>Ver en mi caja ${icon("arrowR")}</a>`
    });
  }

  function mount(root, params, rerender) {
    root.addEventListener("click", (e) => {
      const det = e.target.closest("[data-detail]");
      if (det) garmentModal(det.dataset.detail);
    });
    root.addEventListener("change", (e) => {
      if (e.target.name === "conf") {
        TCB.store.update((s) => { s.metrics.confidence = Number(e.target.value); });
        rerender({ keepFocus: `input[name="conf"][value="${e.target.value}"]` });
      }
      if (e.target.name === "need") {
        TCB.store.update((s) => {
          const set = new Set(s.metrics.needs || []);
          e.target.checked ? set.add(Number(e.target.value)) : set.delete(Number(e.target.value));
          s.metrics.needs = [...set];
        });
      }
    });
  }

  return { key: "talla", shell: "app", title: "Tu talla — The Clothes Box", render, mount };
})();
