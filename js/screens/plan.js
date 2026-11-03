/* Mi plan — Grupo 5 de la convergencia: planes por rango, saldo acumulable,
   pausa y cancelación libres. Tarjetas 03 y 04. */
TCB.screens.plan = (() => {
  const { icon, cop, modal, toast, fmtDate, addDays } = TCB.ui;
  const { plans } = TCB.data;

  function nextShip(state) {
    const base = state.box && state.box.arrive ? new Date(state.box.arrive) : addDays(new Date(), 5);
    return addDays(base, 30 * ((state.plan.skips || 0) + (state.box && state.box.confirmed ? 1 : 0)));
  }

  function statusChip(pl) {
    if (pl.status === "pausada") return `<span class="chip chip--warn">${icon("pause")} Pausada hasta ${fmtDate(new Date(pl.resumeOn))}</span>`;
    if (pl.status === "cancelada") return `<span class="chip chip--danger">${icon("x")} Cancelada</span>`;
    return `<span class="chip chip--ok">${icon("check")} Activa</span>`;
  }

  function render(state) {
    if (!state.profile.done) {
      return `
        <div class="wrap empty">
          <p class="front front--suscripcion">Mi plan</p>
          <h1 tabindex="-1">Aún no tienes plan.</h1>
          <p class="lede">Primero armamos tu perfil y te mostramos tu caja. El plan lo eliges ahí.</p>
          <a class="btn" href="#/empezar">Armar mi perfil ${icon("arrowR")}</a>
        </div>`;
    }
    const pl = state.plan;
    const cur = plans[state.profile.plan];
    const active = pl.status === "activa";
    const h = state.history;

    return `
      <div class="wrap account">
        <header class="box-head">
          <p class="front front--suscripcion">Mi plan</p>
          <h1 tabindex="-1">Plan ${cur.name}</h1>
          <p>${statusChip(pl)}</p>
        </header>

        <dl class="kv kv--wide">
          <div><dt>Precio al mes</dt><dd class="num">${cop(cur.price)}</dd></div>
          <div><dt>Prendas por caja</dt><dd>${cur.items}</dd></div>
          <div><dt>Próximo envío</dt><dd>${active ? fmtDate(nextShip(state)) : "—"}</dd></div>
          <div><dt>Saldo a favor</dt><dd class="num">${cop(pl.balance)}</dd></div>
        </dl>

        <section class="settings" aria-label="Opciones del plan">
          <div class="setting">
            <div>
              <h2 class="setting-t">Cambiar de plan</h2>
              <p class="small muted">Aplica desde la próxima caja.</p>
            </div>
            <form class="setting-ctl" data-form="change">
              <div class="segmented">
                ${Object.values(plans).map((p) => `<label><input type="radio" name="plan" value="${p.id}" ${p.id === cur.id ? "checked" : ""} ${pl.status === "cancelada" ? "disabled" : ""}><span>${p.name} · ${p.items} prendas</span></label>`).join("")}
              </div>
              <button class="btn btn--ghost btn--sm" type="submit" ${pl.status === "cancelada" ? "disabled" : ""}>Guardar</button>
            </form>
          </div>

          <div class="setting">
            <div>
              <h2 class="setting-t">Saltar el próximo mes</h2>
              <p class="small muted">No enviamos caja y el valor del mes queda como saldo para usar después.</p>
            </div>
            <div class="setting-ctl"><button type="button" class="btn btn--ghost btn--sm" data-skip ${active ? "" : "disabled"}>Saltar un mes</button></div>
          </div>

          <div class="setting">
            <div>
              <h2 class="setting-t">${pl.status === "pausada" ? "Plan en pausa" : "Pausar"}</h2>
              <p class="small muted">${pl.status === "pausada" ? "Puedes reanudar antes si quieres." : "Sin cajas ni cobros durante la pausa."}</p>
            </div>
            <div class="setting-ctl">
              ${pl.status === "pausada"
                ? `<button type="button" class="btn btn--sm" data-resume>Reanudar ahora</button>`
                : `<label class="visually-hidden" for="pause-len">Tiempo de pausa</label>
                   <select class="select select--sm" id="pause-len" ${active ? "" : "disabled"}><option value="1">1 mes</option><option value="2">2 meses</option><option value="3">3 meses</option></select>
                   <button type="button" class="btn btn--ghost btn--sm" data-pause ${active ? "" : "disabled"}>Pausar</button>`}
            </div>
          </div>
        </section>

        <section class="history" aria-labelledby="hist-t">
          <h2 id="hist-t" class="eyebrow">Cajas anteriores</h2>
          ${h.length ? `
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th scope="col">Caja</th><th scope="col">Cerrada</th><th scope="col">Se quedaron</th><th scope="col">Nota promedio</th></tr></thead>
              <tbody>${h.map((x) => `<tr><td class="mono">${String(x.cycle).padStart(3, "0")}</td><td>${fmtDate(new Date(x.date))}</td><td class="num">${x.items.filter((i) => i.keep).length} de ${x.items.length}</td><td class="num">${x.avg.toFixed(1)}</td></tr>`).join("")}</tbody>
            </table>
          </div>` : `<p class="muted small empty-inline">Todavía no has cerrado ninguna caja. Cuando califiques la primera, aparece aquí.</p>`}
        </section>

        <section class="danger-zone" aria-labelledby="dz-t">
          ${pl.status === "cancelada"
            ? `<h2 id="dz-t" class="setting-t">Tu plan está cancelado</h2><p class="small muted">Tu perfil y tus tallas siguen guardados.</p><button type="button" class="btn btn--sm" data-reactivate>Reactivar plan</button>`
            : `<h2 id="dz-t" class="setting-t">Cancelar el plan</h2><p class="small muted">Sin penalidad. Conservamos tu perfil por si vuelves.</p><button type="button" class="btn btn--danger btn--sm" data-cancel>Cancelar plan</button>`}
        </section>
      </div>`;
  }

  function mount(root, params, rerender) {
    const S = TCB.store;
    root.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = e.target.elements.plan.value;
      if (v === S.get().profile.plan) return toast("Ya estás en ese plan.", { kind: "info" });
      S.update((s) => { s.profile.plan = v; });
      rerender();
      toast(`Desde la próxima caja recibes ${plans[v].items} prendas.`);
    });
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-skip]")) {
        const cur = plans[S.get().profile.plan];
        modal({
          eyebrow: "Saltar un mes",
          title: "¿Saltamos el próximo envío?",
          body: `<p>No te enviamos caja ese mes. Los <strong class="num">${cop(cur.price)}</strong> quedan como saldo a favor para una caja futura.</p>`,
          foot: `<button type="button" class="btn btn--quiet" data-close>No, mantener</button><button type="button" class="btn" data-ok autofocus>Saltar el mes</button>`,
          onMount(dlg, close) {
            dlg.querySelector("[data-ok]").addEventListener("click", () => {
              S.update((s) => { s.plan.balance += cur.price; s.plan.skips = (s.plan.skips || 0) + 1; });
              close(); rerender();
              toast("Saltaste un mes. El valor quedó como saldo.", { action: "Deshacer", onAction: () => { S.update((s) => { s.plan.balance -= cur.price; s.plan.skips -= 1; }); rerender(); } });
            });
          },
        });
      }
      if (e.target.closest("[data-pause]")) {
        const months = Number(root.querySelector("#pause-len").value);
        S.update((s) => { s.plan.status = "pausada"; s.plan.resumeOn = addDays(new Date(), 30 * months).toISOString(); });
        rerender({ keepFocus: "[data-resume]" });
        toast(`Plan pausado por ${months === 1 ? "un mes" : `${months} meses`}.`);
      }
      if (e.target.closest("[data-resume]")) {
        S.update((s) => { s.plan.status = "activa"; s.plan.resumeOn = null; });
        rerender({ keepFocus: "[data-pause]" });
        toast("Tu plan está activo otra vez.");
      }
      if (e.target.closest("[data-reactivate]")) {
        S.update((s) => { s.plan.status = "activa"; });
        rerender();
        toast("Plan reactivado.");
      }
      if (e.target.closest("[data-cancel]")) {
        modal({
          eyebrow: "Cancelar plan",
          title: "¿Seguro que quieres cancelar?",
          body: `
            <p style="margin-bottom:16px">No se envían más cajas. Si tienes una en camino, la recibes igual y puedes devolver lo que no te sirva.</p>
            <fieldset>
              <legend class="small" style="font-weight:600;margin-bottom:6px">¿Nos cuentas por qué? <span class="muted">(opcional)</span></legend>
              <div class="options">
                ${["Es muy caro para mí", "No me representaron los outfits", "Problemas con la talla", "Solo quería probar"].map((r, i) => `
                  <label class="option"><input type="radio" name="reason" value="${i}"><span class="mark"></span><span class="opt-text"><span class="opt-title">${r}</span></span></label>`).join("")}
              </div>
            </fieldset>`,
          foot: `<button type="button" class="btn" data-close autofocus>Mantener mi plan</button><button type="button" class="btn btn--danger" data-ok>Cancelar plan</button>`,
          onMount(dlg, close) {
            dlg.querySelector("[data-ok]").addEventListener("click", () => {
              const r = dlg.querySelector('input[name="reason"]:checked');
              S.update((s) => { s.plan.status = "cancelada"; s.plan.cancelReason = r ? Number(r.value) : null; });
              close(); rerender();
              toast("Plan cancelado. Tu perfil sigue guardado.");
            });
          },
        });
      }
    });
  }

  return { key: "plan", shell: "app", title: "Mi plan — The Clothes Box", render, mount };
})();
