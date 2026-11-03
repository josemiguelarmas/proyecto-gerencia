/* Onboarding en un solo flujo (P05 + P03): estilo → ocasión y plan → medidas.
   El planificador P05 propone "integrar el tallaje en un solo flujo continuo". */
TCB.screens.onboarding = (() => {
  const { esc, cop, icon } = TCB.ui;
  const { styles, quiz, occasions, plans, sizes, brands } = TCB.data;
  const G = TCB.garments;
  const STEPS = ["estilo", "ocasion", "medidas"];
  let quizIndex = 0;

  function header(step, title, sub, front) {
    const i = STEPS.indexOf(step);
    return `
      <div class="flow-head">
        <p class="front front--${front}">Paso ${i + 1} de 3</p>
        <h1 id="flow-title" tabindex="-1">${title}</h1>
        ${sub ? `<p class="lede">${sub}</p>` : ""}
      </div>`;
  }

  /* ---------- Paso 1A: moodboard ---------- */
  function moodboard(p) {
    return `
      <fieldset>
        <legend class="visually-hidden">Elige hasta tres estilos en orden de preferencia</legend>
        <div class="mood-grid">
          ${styles.map((s) => {
            const rank = p.styles.indexOf(s.id);
            return `
            <label class="mood ${rank > -1 ? "is-on" : ""}">
              <input type="checkbox" name="style" value="${s.id}" ${rank > -1 ? "checked" : ""}>
              <span class="mood-art" style="background:${s.palette[3]}">
                <span class="mood-swatch">${s.palette.slice(0, 3).map((c) => `<i style="background:${c}"></i>`).join("")}</span>
                <span class="mood-glyphs">${s.glyphs.map((g, k) => G.svg(g, s.palette[k % 3])).join("")}</span>
                ${rank > -1 ? `<span class="mood-rank" aria-hidden="true">${rank + 1}</span>` : ""}
              </span>
              <span class="mood-name">${s.name}</span>
              <span class="mood-note">${s.note}</span>
            </label>`;
          }).join("")}
        </div>
      </fieldset>
      <p class="small muted" id="mood-help" aria-live="polite">${p.styles.length ? `Elegiste ${p.styles.length} de 3. El primero pesa más.` : "Elige hasta tres, en orden: el primero pesa más."}</p>`;
  }

  /* ---------- Paso 1B: quiz de 8 preguntas, una a la vez ---------- */
  function quizView(p) {
    const q = quiz[quizIndex];
    const chosen = p.quiz[q.id];
    return `
      <div class="quiz">
        <div class="quiz-progress" aria-hidden="true">${quiz.map((_, i) => `<i class="${i < quizIndex ? "done" : i === quizIndex ? "now" : ""}"></i>`).join("")}</div>
        <fieldset>
          <legend class="quiz-q display"><span class="mono small muted">Pregunta ${quizIndex + 1} de ${quiz.length}</span>${q.text}</legend>
          <div class="options">
            ${q.options.map((o, i) => `
              <label class="option">
                <input type="radio" name="${q.id}" value="${i}" ${chosen === i ? "checked" : ""}>
                <span class="mark"></span>
                <span class="opt-text"><span class="opt-title">${o.t}</span></span>
              </label>`).join("")}
          </div>
        </fieldset>
        <div class="quiz-nav">
          <button type="button" class="btn btn--quiet btn--sm" data-quiz="prev" ${quizIndex === 0 ? "disabled" : ""}>${icon("arrowL")} Anterior</button>
          ${chosen != null && quizIndex < quiz.length - 1 ? `<button type="button" class="btn btn--ghost btn--sm" data-quiz="next">Siguiente ${icon("arrowR")}</button>` : ""}
        </div>
      </div>`;
  }

  function quizComplete(p) { return quiz.every((q) => p.quiz[q.id] != null); }

  // Convierte respuestas en estilos y preferencias
  function applyQuiz(p) {
    const totals = {};
    quiz.forEach((q) => {
      const a = p.quiz[q.id];
      if (a == null) return;
      const o = q.options[a];
      Object.entries(o.s || {}).forEach(([k, v]) => (totals[k] = (totals[k] || 0) + v));
      if (o.fit) p.fit = o.fit;
      if (o.line) p.line = o.line;
      if (o.risk != null) p.risk = o.risk;
      if (q.key === "prints") p.prints = a;
      if (q.key === "palette") p.palette = a;
    });
    p.styles = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  }

  /* ---------- Paso 2: ocasión, cortes y plan ---------- */
  function occasionView(p, variant) {
    return `
      <fieldset class="block">
        <legend class="block-title">Ocasiones <span class="muted small">· elige una o más</span></legend>
        <div class="options">
          ${occasions.map((o) => `
            <label class="option">
              <input type="checkbox" name="occ" value="${o.id}" ${p.occasions.includes(o.id) ? "checked" : ""}>
              <span class="mark"></span>
              <span class="opt-text"><span class="opt-title">${o.name}</span><span class="opt-sub">${o.sub}</span></span>
            </label>`).join("")}
        </div>
        <p class="error small" id="occ-err" role="alert"></p>
      </fieldset>

      ${variant === "A" ? `
      <div class="block-row">
        <fieldset class="block">
          <legend class="block-title">Cortes</legend>
          <div class="segmented">
            ${[["m", "Masculino"], ["f", "Femenino"], ["u", "Los dos"]].map(([v, t]) => `<label><input type="radio" name="line" value="${v}" ${p.line === v ? "checked" : ""}><span>${t}</span></label>`).join("")}
          </div>
        </fieldset>
        <fieldset class="block">
          <legend class="block-title">Cómo te gusta que te quede</legend>
          <div class="segmented">
            ${[["holgado", "Holgado"], ["regular", "A la medida"], ["ajustado", "Ajustado"]].map(([v, t]) => `<label><input type="radio" name="fit" value="${v}" ${p.fit === v ? "checked" : ""}><span>${t}</span></label>`).join("")}
          </div>
        </fieldset>
      </div>` : ""}

      <fieldset class="block">
        <legend class="block-title">Presupuesto al mes</legend>
        <div class="options">
          ${Object.values(plans).map((pl) => `
            <label class="option option--plan">
              <input type="radio" name="plan" value="${pl.id}" ${p.plan === pl.id ? "checked" : ""}>
              <span class="mark"></span>
              <span class="opt-text"><span class="opt-title">${pl.name} · ${pl.items} prendas</span><span class="opt-sub">${pl.blurb}</span></span>
              <span class="opt-price num">${cop(pl.price)}</span>
            </label>`).join("")}
        </div>
        <p class="small muted" style="margin-top:8px">Puedes cambiar de plan o pausar después.</p>
      </fieldset>`;
  }

  /* ---------- Paso 3: medidas ---------- */
  function measuresView(p) {
    const m = p.measures;
    const hasRef = !!(m.refBrand || m.refSize);
    return `
      <form id="measures" class="measures" novalidate>
        <div class="measure-grid">
          <div class="field">
            <label for="m-height">Estatura</label>
            <div class="input-unit"><input class="input num" id="m-height" name="height" type="number" inputmode="numeric" min="140" max="210" value="${esc(m.height)}" aria-describedby="m-height-err" required><span>cm</span></div>
            <p class="error" id="m-height-err"></p>
          </div>
          <div class="field">
            <label for="m-weight">Peso</label>
            <div class="input-unit"><input class="input num" id="m-weight" name="weight" type="number" inputmode="numeric" min="38" max="160" value="${esc(m.weight)}" aria-describedby="m-weight-err" required><span>kg</span></div>
            <p class="error" id="m-weight-err"></p>
          </div>
        </div>

        <fieldset class="field">
          <legend class="field-label">Contextura</legend>
          <div class="segmented">
            ${[["delgada", "Delgada"], ["media", "Media"], ["robusta", "Robusta"]].map(([v, t]) => `<label><input type="radio" name="build" value="${v}" ${m.build === v ? "checked" : ""}><span>${t}</span></label>`).join("")}
          </div>
          <p class="hint">Cómo te ves de hombros y torso, no de estatura.</p>
          <p class="error" id="m-build-err"></p>
        </fieldset>

        <fieldset class="field">
          <legend class="field-label">Talla que más compras</legend>
          <div class="segmented segmented--sizes">
            ${sizes.map((s) => `<label><input type="radio" name="usual" value="${s}" ${m.usual === s ? "checked" : ""}><span>${s}</span></label>`).join("")}
          </div>
          <p class="error" id="m-usual-err"></p>
        </fieldset>

        <details class="ref" ${hasRef ? "open" : ""}>
          <summary>Tengo una prenda que me queda perfecta <span class="muted">· opcional, sube la precisión</span></summary>
          <div class="measure-grid" style="margin-top:14px">
            <div class="field">
              <label for="m-refBrand">Marca</label>
              <select class="select" id="m-refBrand" name="refBrand">
                <option value="">Elige una marca</option>
                ${Object.values(brands).map((b) => `<option value="${b.id}" ${m.refBrand === b.id ? "selected" : ""}>${b.name}</option>`).join("")}
                <option value="otra" ${m.refBrand === "otra" ? "selected" : ""}>Otra marca</option>
              </select>
            </div>
            <div class="field">
              <label for="m-refSize">Talla de esa prenda</label>
              <select class="select" id="m-refSize" name="refSize">
                <option value="">—</option>
                ${sizes.map((s) => `<option ${m.refSize === s ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </div>
          </div>
        </details>

        <p class="note note--talla">${icon("info")}<span>Solo usamos estos datos para recomendar tu talla. No pedimos fotos ni escaneo del cuerpo.</span></p>
      </form>`;
  }

  /* ---------- Render ---------- */
  function render(state, params) {
    const step = STEPS.includes(params[0]) ? params[0] : "estilo";
    const p = state.profile;
    const variant = state.lab.styleVariant;
    let body, title, sub, front, canNext;

    if (step === "estilo") {
      front = "curaduria";
      if (variant === "A") {
        title = "¿Cuál se parece más a ti?";
        sub = "Elige con el ojo, no lo pienses mucho.";
        body = moodboard(p);
        canNext = p.styles.length > 0;
      } else {
        title = "Ocho preguntas sobre cómo te vistes.";
        sub = "Responde lo primero que se te venga a la cabeza.";
        body = quizView(p);
        canNext = quizComplete(p);
      }
    } else if (step === "ocasion") {
      front = "curaduria";
      title = "¿Para qué la vas a usar?";
      sub = "Armamos cada outfit pensando en una ocasión real.";
      body = occasionView(p, variant);
      canNext = true;
    } else {
      front = "talla";
      title = "Cuatro datos para tu talla.";
      sub = "Con esto cruzamos tu cuerpo con las medidas reales de cada prenda, no con la letra de la etiqueta.";
      body = measuresView(p);
      canNext = true;
    }

    const i = STEPS.indexOf(step);
    return `
      <div class="flow wrap">
        <div class="flow-progress" role="progressbar" aria-label="Avance del perfil" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${i + 1}">
          ${STEPS.map((s, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}
        </div>
        ${header(step, title, sub, front)}
        <div class="flow-body" id="flow-body">${body}</div>
        <div class="flow-foot">
          ${i > 0 ? `<a class="btn btn--quiet" href="#/empezar/${STEPS[i - 1]}">${icon("arrowL")} Atrás</a>` : `<a class="btn btn--quiet" href="#/">Salir</a>`}
          <button type="button" class="btn" data-next ${canNext ? "" : "disabled"}>${step === "medidas" ? "Calcular mi talla" : "Continuar"} ${icon("arrowR")}</button>
        </div>
      </div>`;
  }

  function mount(root, params, rerender) {
    const step = STEPS.includes(params[0]) ? params[0] : "estilo";
    const S = TCB.store;
    S.update((s) => { if (!s.metrics.onboardStart) s.metrics.onboardStart = Date.now(); });

    const refreshBody = () => {
      const html = render(S.get(), params);
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      root.querySelector("#flow-body").replaceWith(tmp.querySelector("#flow-body"));
      root.querySelector("[data-next]").disabled = tmp.querySelector("[data-next]").disabled;
    };

    let pointerPick = false;
    root.addEventListener("pointerdown", () => { pointerPick = true; });
    root.addEventListener("keydown", () => { pointerPick = false; });

    root.addEventListener("change", (e) => {
      const t = e.target;
      if (t.name === "style") {
        S.update((s) => {
          const list = s.profile.styles;
          if (t.checked) { if (list.length >= 3) { t.checked = false; return; } list.push(t.value); }
          else s.profile.styles = list.filter((x) => x !== t.value);
        });
        refreshBody();
        root.querySelector(`input[value="${t.value}"]`).focus();
        if (S.get().profile.styles.length >= 3 && !t.checked) TCB.ui.toast("Ya elegiste tres. Quita uno para cambiarlo.", { kind: "info" });
      }
      if (/^q\d$/.test(t.name)) {
        S.update((s) => { s.profile.quiz[t.name] = Number(t.value); applyQuiz(s.profile); });
        // Avanza solo con clic/toque: con teclado, las flechas cambian la opción y "Siguiente" avanza
        if (pointerPick && quizIndex < quiz.length - 1) {
          setTimeout(() => { quizIndex++; refreshBody(); root.querySelector(".quiz input")?.focus(); }, 220);
        } else refreshBody();
      }
      if (t.name === "occ") {
        S.update((s) => {
          const set = new Set(s.profile.occasions);
          t.checked ? set.add(t.value) : set.delete(t.value);
          s.profile.occasions = occasions.map((o) => o.id).filter((id) => set.has(id));
        });
        root.querySelector("#occ-err").textContent = "";
      }
      if (["line", "fit", "plan"].includes(t.name)) S.update((s) => { s.profile[t.name] = t.value; });
      if (["build", "usual", "refBrand", "refSize"].includes(t.name)) {
        S.update((s) => { s.profile.measures[t.name] = t.value; });
        const err = root.querySelector(`#m-${t.name}-err`);
        if (err) err.textContent = "";
      }
    });

    root.addEventListener("input", (e) => {
      if (["height", "weight"].includes(e.target.name)) {
        S.update((s) => { s.profile.measures[e.target.name] = e.target.value; });
        // Si ya estaba marcado con error, se corrige mientras escribe (evita saltos al salir del campo)
        if (e.target.getAttribute("aria-invalid") === "true") validateMeasure(root, e.target.name);
      }
    });
    root.addEventListener("focusout", (e) => {
      if (["height", "weight"].includes(e.target.name) && e.target.value) validateMeasure(root, e.target.name);
    });

    root.addEventListener("click", (e) => {
      const q = e.target.closest("[data-quiz]");
      if (q) { quizIndex += q.dataset.quiz === "next" ? 1 : -1; refreshBody(); root.querySelector(".quiz input")?.focus(); }
      if (e.target.closest("[data-next]")) next(root, step);
    });

    if (step === "estilo") quizIndex = Math.min(quizIndex, quiz.length - 1);
  }

  const measureRules = {
    height: (v) => (!v ? "Escribe tu estatura en centímetros." : v < 140 || v > 210 ? "Revisa la estatura: esperamos entre 140 y 210 cm." : ""),
    weight: (v) => (!v ? "Escribe tu peso en kilos." : v < 38 || v > 160 ? "Revisa el peso: esperamos entre 38 y 160 kg." : ""),
  };
  function validateMeasure(root, name) {
    const el = root.querySelector(`[name="${name}"]`);
    const msg = measureRules[name](Number(el.value));
    el.setAttribute("aria-invalid", msg ? "true" : "false");
    root.querySelector(`#m-${name}-err`).textContent = msg;
    return !msg;
  }

  function next(root, step) {
    const S = TCB.store;
    const p = S.get().profile;
    if (step === "estilo") {
      if (S.get().lab.styleVariant === "B") quizIndex = 0;
      return (location.hash = "#/empezar/ocasion");
    }
    if (step === "ocasion") {
      if (!p.occasions.length) {
        root.querySelector("#occ-err").textContent = "Elige al menos una ocasión para armar los outfits.";
        root.querySelector('input[name="occ"]').focus();
        return;
      }
      return (location.hash = "#/empezar/medidas");
    }
    // medidas
    const okH = validateMeasure(root, "height");
    const okW = validateMeasure(root, "weight");
    const build = !!p.measures.build, usual = !!p.measures.usual;
    root.querySelector("#m-build-err").textContent = build ? "" : "Elige tu contextura.";
    root.querySelector("#m-usual-err").textContent = usual ? "" : "Elige la talla que más compras.";
    const firstBad = !okH ? "height" : !okW ? "weight" : !build ? "build" : !usual ? "usual" : null;
    if (firstBad) return root.querySelector(`[name="${firstBad}"]`).focus();
    working(root);
  }

  /* Curaduría "Mago de Oz": se ve el trabajo, se resuelve con reglas */
  function working(root) {
    const S = TCB.store;
    const b = S.get().box;
    // Con una caja ya confirmada, los cambios aplican a la siguiente
    if (b && b.confirmed && b.stage < 5) {
      S.update((s) => { s.profile.done = true; });
      location.hash = "#/perfil";
      TCB.ui.toast("Guardamos tus cambios. Aplican desde tu próxima caja.");
      return;
    }
    root.innerHTML = `
      <div class="wrap flow">
        <div class="working" role="status" aria-live="polite">
          <p class="front front--curaduria">Armando tu caja</p>
          <h1 class="display" id="flow-title" tabindex="-1" style="font-size:var(--fs-3xl)">Un momento.</h1>
          <ol class="working-steps">
            <li>Leyendo tu estilo y tus ocasiones</li>
            <li>Cruzando con ${TCB.data.catalog.length} prendas de 3 marcas aliadas</li>
            <li>Calculando tu talla en cada prenda</li>
            <li>Un estilista revisa la combinación</li>
          </ol>
        </div>
      </div>`;
    root.querySelector("#flow-title").focus();
    TCB.ui.runSteps(root, null, () => {
      S.update((s) => {
        s.profile.done = true;
        s.metrics.onboardEnd = Date.now();
        const c = TCB.engine.curate(s.profile);
        s.box = { cycle: (s.history.length || 0) + 1, items: c.items, bet: c.bet, swap: null, confirmed: false, stage: 0, returns: {}, rated: false };
      });
      location.hash = "#/talla";
    });
  }

  return { key: "onboarding", shell: "flow", title: "Arma tu perfil — The Clothes Box", render, mount, screenKey: (params) => (params[0] === "ocasion" ? "ocasion" : params[0] === "medidas" ? "medidas" : "estilo") };
})();
