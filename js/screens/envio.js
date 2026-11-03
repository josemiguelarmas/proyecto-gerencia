/* Envío, "se queda o cambia" y calificación — pasos 4 a 6 del sistema
   (prototipo concierge P06 / tarjetas 04 y 06). */
TCB.screens.envio = (() => {
  const { icon, esc, toast, fmtDate, fmtShort, addDays } = TCB.ui;
  const E = TCB.engine;
  const G = TCB.garments;
  const { brands, styles } = TCB.data;

  const STAGES = [
    { t: "Confirmada", d: "Recibimos tu pedido." },
    { t: "Armada y revisada", d: "Un estilista revisó la combinación." },
    { t: "En camino", d: "Mensajería local en Cali." },
    { t: "Entregada", d: "Te queda decidir qué se queda." },
  ];
  const TITLES = ["", "Confirmada. La estamos armando.", "Armada y revisada por un estilista.", "Tu caja va en camino.", "Llegó. ¿Qué se queda?", "Listo. Así será tu próxima caja."];
  const REASONS = [["talla", "No me quedó"], ["gusto", "No me gustó"], ["calidad", "La calidad"]];

  function emptyState() {
    return `
      <div class="wrap empty">
        <p class="front front--suscripcion">Envío</p>
        <h1 tabindex="-1">No tienes una caja en camino.</h1>
        <p class="lede">Cuando confirmes tu caja, aquí ves dónde va y decides qué se queda.</p>
        <a class="btn" href="#/caja">Ir a mi caja ${icon("arrowR")}</a>
      </div>`;
  }

  function timeline(box) {
    const confirmed = box.arrive ? addDays(new Date(box.arrive), -4) : new Date();
    const dates = [confirmed, addDays(confirmed, 1), addDays(confirmed, 3), addDays(confirmed, 4)];
    return `
      <ol class="track">
        ${STAGES.map((s, i) => {
          const n = i + 1;
          const st = box.stage > n ? "done" : box.stage === n ? "now" : "next";
          return `<li class="track-step is-${st}" ${st === "now" ? 'aria-current="step"' : ""}>
            <span class="track-dot">${st === "done" ? icon("check") : ""}</span>
            <span class="track-t">${s.t}</span>
            <span class="small muted">${st === "next" ? "Estimado " : ""}${fmtShort(dates[i])}</span>
            <span class="visually-hidden">${st === "done" ? "completado" : st === "now" ? "paso actual" : "pendiente"}</span>
          </li>`;
        }).join("")}
      </ol>`;
  }

  function returnForm(state) {
    const box = state.box;
    const r = box.returns;
    return `
      <form id="returns" class="returns" novalidate>
        <p id="ret-summary" class="note note--warn" role="alert" hidden></p>
        ${box.items.map((id) => {
          const it = E.byId(id);
          const fit = E.fit(state.profile, it);
          const v = r[id] || {};
          return `
          <fieldset class="ret-row" id="ret-${id}">
            <legend class="visually-hidden">${it.name}</legend>
            <div class="ret-item">
              <div class="slip-thumb">${G.tile(it, { label: false })}</div>
              <div><p class="slip-name">${it.name}</p><p class="small muted">${brands[it.brand].name} · talla ${fit.size}</p></div>
            </div>
            <div class="ret-q">
              <div class="segmented" role="radiogroup" aria-label="¿Te la quedas?">
                <label><input type="radio" name="keep-${id}" value="1" ${v.keep === true ? "checked" : ""}><span>Me la quedo</span></label>
                <label><input type="radio" name="keep-${id}" value="0" ${v.keep === false ? "checked" : ""}><span>La cambio</span></label>
              </div>
              ${v.keep === false ? `
                <div class="ret-sub">
                  <p class="small" style="font-weight:600">¿Por qué?</p>
                  <div class="segmented">
                    ${REASONS.map(([k, t]) => `<label><input type="radio" name="why-${id}" value="${k}" ${v.why === k ? "checked" : ""}><span>${t}</span></label>`).join("")}
                  </div>
                  ${v.why === "talla" ? `
                  <p class="small" style="font-weight:600;margin-top:10px">¿Cómo te quedó?</p>
                  <div class="segmented">
                    <label><input type="radio" name="size-${id}" value="small" ${v.size === "small" ? "checked" : ""}><span>Pequeña</span></label>
                    <label><input type="radio" name="size-${id}" value="large" ${v.size === "large" ? "checked" : ""}><span>Grande</span></label>
                  </div>` : ""}
                </div>` : ""}
              <div class="ret-sub">
                <p class="small" style="font-weight:600" id="rate-l-${id}">¿Qué tanto te representa?</p>
                <div class="scale scale--sm" role="radiogroup" aria-labelledby="rate-l-${id}">
                  ${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="rate-${id}" value="${n}" ${v.rate === n ? "checked" : ""}><span>${n}</span></label>`).join("")}
                </div>
              </div>
              <p class="error small" id="err-${id}"></p>
            </div>
          </fieldset>`;
        }).join("")}
        <div class="flow-foot">
          <span class="small muted">${state.lab.guarantee ? "Los cambios son gratis: recogemos en tu dirección." : "Te contamos cómo devolver lo que no se queda."}</span>
          <button type="submit" class="btn">Enviar calificación ${icon("arrowR")}</button>
        </div>
      </form>`;
  }

  function learned(state) {
    const last = state.history[state.history.length - 1];
    if (!last) return "";
    const pickup = addDays(new Date(), 2);
    const changed = last.items.filter((x) => !x.keep);
    return `
      <section class="learned" aria-labelledby="learn-t">
        <dl class="kv kv--wide">
          <div><dt>Te quedas con</dt><dd>${last.items.length - changed.length} de ${last.items.length} prendas</dd></div>
          <div><dt>Nota promedio</dt><dd class="num">${last.avg.toFixed(1)} / 5</dd></div>
          ${changed.length ? `<div><dt>Recogemos</dt><dd>${changed.length} ${changed.length === 1 ? "prenda" : "prendas"} el ${fmtDate(pickup)}</dd></div>` : ""}
        </dl>
        <h2 id="learn-t" class="eyebrow" style="margin-top:32px">Lo que aprendimos para la caja ${last.cycle + 1}</h2>
        <ul class="learn-list">
          ${last.notes.map((n) => `<li>${icon(n.icon)}<span>${n.text}</span></li>`).join("")}
        </ul>
        <div class="flow-foot">
          <a class="btn btn--quiet" href="#/perfil">Ver mi perfil</a>
          <button type="button" class="btn" data-nextbox>Ver mi próxima caja ${icon("arrowR")}</button>
        </div>
      </section>`;
  }

  function render(state) {
    const box = state.box;
    if (!box || !box.confirmed) return emptyState();
    return `
      <div class="wrap ship">
        <header class="box-head">
          <p class="front front--suscripcion">Caja ${box.cycle}${box.address ? ` · ${esc(box.address)}` : ""}</p>
          <h1 tabindex="-1">${TITLES[box.stage]}</h1>
          ${box.stage < 4 && box.arrive ? `<p class="lede">Llega el ${fmtDate(new Date(box.arrive))}.</p>` : ""}
        </header>
        ${box.stage <= 4 ? timeline(box) : ""}
        ${box.stage < 4 ? `
          <div class="demo-advance">
            <button type="button" class="btn btn--ghost btn--sm" data-advance>${icon("flask")} Simular siguiente paso</button>
            <span class="small muted">En el prototipo el tiempo no pasa solo.</span>
          </div>` : ""}
        ${box.stage === 4 ? returnForm(state) : ""}
        ${box.stage === 5 ? learned(state) : ""}
      </div>`;
  }

  /* Recalibración: lo que reporta el usuario ajusta talla y estilo */
  function close(state) {
    const box = state.box;
    const p = state.profile;
    const notes = [];
    const items = box.items.map((id) => ({ id, ...box.returns[id] }));

    items.forEach((x) => {
      if (x.keep === false && x.why === "talla" && x.size) {
        const it = E.byId(x.id);
        const b = it.brand;
        p.brandAdj[b] = (p.brandAdj[b] || 0) + (x.size === "small" ? 0.5 : -0.5);
        notes.push({ icon: "ruler", text: `En ${brands[b].name} te recomendaremos una talla ${x.size === "small" ? "más grande" : "más pequeña"}, porque nos dijiste que te quedó ${x.size === "small" ? "pequeña" : "grande"}.` });
      }
    });

    const sorted = [...items].sort((a, b) => b.rate - a.rate);
    const best = E.byId(sorted[0].id);
    const worst = E.byId(sorted[sorted.length - 1].id);
    const bestStyle = best.styles.find((s) => s) || null;
    if (sorted[0].rate >= 4 && bestStyle) {
      p.styles = [bestStyle, ...p.styles.filter((s) => s !== bestStyle)].slice(0, 3);
      notes.push({ icon: "check", text: `Te gustó ${best.name.toLowerCase()}: subimos “${styles.find((s) => s.id === bestStyle).name}” en tu perfil.` });
    }
    if (sorted[sorted.length - 1].rate <= 2) {
      notes.push({ icon: "x", text: `Menos prendas como ${worst.name.toLowerCase()} (${worst.colorName}).` });
      p.avoid = [...new Set([...(p.avoid || []), worst.id])];
    }
    if (!notes.length) notes.push({ icon: "check", text: "Todo te quedó y te gustó: mantenemos tu perfil y variamos colores." });

    const avg = items.reduce((a, x) => a + x.rate, 0) / items.length;
    state.history.push({ cycle: box.cycle, items, avg, notes, date: new Date().toISOString() });
    box.stage = 5;
  }

  function validate(root, state) {
    const bad = [];
    state.box.items.forEach((id) => {
      const v = state.box.returns[id] || {};
      let msg = "";
      if (v.keep == null) msg = "Dinos si te la quedas o la cambias.";
      else if (v.keep === false && !v.why) msg = "Cuéntanos por qué la cambias.";
      else if (v.why === "talla" && v.keep === false && !v.size) msg = "Dinos si te quedó pequeña o grande.";
      else if (!v.rate) msg = "Califícala de 1 a 5.";
      root.querySelector(`#err-${id}`).textContent = msg;
      if (msg) bad.push(id);
    });
    const sum = root.querySelector("#ret-summary");
    if (bad.length) {
      sum.hidden = false;
      sum.innerHTML = `${icon("alert")}<span>Faltan ${bad.length === 1 ? "datos en una prenda" : `datos en ${bad.length} prendas`}.</span>`;
      root.querySelector(`#ret-${bad[0]} input`).focus();
    }
    return !bad.length;
  }

  function mount(root, params, rerender) {
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-advance]")) {
        TCB.store.update((s) => { s.box.stage = Math.min(4, s.box.stage + 1); });
        rerender({ keepFocus: "[data-advance]" });
        if (TCB.store.get().box.stage === 4) toast("Tu caja llegó.");
      }
      if (e.target.closest("[data-nextbox]")) {
        TCB.store.update((s) => {
          const prev = s.box;
          const received = s.history.flatMap((h) => h.items.map((x) => x.id));
          const c = TCB.engine.curate(s.profile, received);
          s.box = { cycle: prev.cycle + 1, items: c.items, bet: c.bet, swap: null, confirmed: false, stage: 0, returns: {}, address: prev.address };
          s.metrics.represents = null;
        });
        location.hash = "#/caja";
      }
    });
    root.addEventListener("change", (e) => {
      const m = e.target.name && e.target.name.match(/^(keep|why|size|rate)-(p\d+)$/);
      if (!m) return;
      const [, k, id] = m;
      TCB.store.update((s) => {
        const r = (s.box.returns[id] = s.box.returns[id] || {});
        if (k === "keep") { r.keep = e.target.value === "1"; if (r.keep) { delete r.why; delete r.size; } }
        if (k === "why") { r.why = e.target.value; if (r.why !== "talla") delete r.size; }
        if (k === "size") r.size = e.target.value;
        if (k === "rate") r.rate = Number(e.target.value);
      });
      if (k === "keep" || k === "why") rerender({ keepFocus: `input[name="${e.target.name}"][value="${e.target.value}"]` });
      else root.querySelector(`#err-${id}`).textContent = "";
    });
    root.addEventListener("submit", (e) => {
      e.preventDefault();
      const s = TCB.store.get();
      if (!validate(root, s)) return;
      const btn = root.querySelector('#returns button[type="submit"]');
      btn.classList.add("is-loading");
      btn.textContent = "Enviando";
      setTimeout(() => {
        TCB.store.update((st) => close(st));
        rerender();
        window.scrollTo(0, 0);
      }, 800);
    });
  }

  return { key: "envio", shell: "app", title: "Envío — The Clothes Box", render, mount };
})();
