/* Utilidades de interfaz: íconos, formato, toasts y modales accesibles. */
TCB.ui = (() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const cop = (n) => "COP " + n.toLocaleString("es-CO").replace(/,/g, ".");

  const fmtDate = (d) => d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  const fmtShort = (d) => d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  // Un solo set de íconos de trazo 1.6, dibujados para el prototipo
  const paths = {
    arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
    box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
    plan: '<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/>',
    ruler: '<path d="M3 16.5L16.5 3 21 7.5 7.5 21z"/><path d="M7 12.5l2 2M10 9.5l1.5 1.5M13 6.5l2 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    alert: '<path d="M12 3.5L21.5 20h-19z"/><path d="M12 10v4.5M12 17v.5"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    truck: '<path d="M3 6h11v10H3zM14 9.5h4l3 3.5v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    flask: '<path d="M9.5 3h5M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4.5V11h-6.5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  };
  const icon = (name, label) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${paths[name]}</svg>`;

  /* ---------- Toast ---------- */
  let toastHost;
  function toast(msg, { action, onAction, ms = 4200, kind = "check" } = {}) {
    if (!toastHost) {
      toastHost = document.createElement("div");
      toastHost.className = "toasts";
      toastHost.setAttribute("role", "status");
      toastHost.setAttribute("aria-live", "polite");
      document.body.appendChild(toastHost);
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `${icon(kind)}<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ""}`;
    toastHost.appendChild(el);
    const kill = () => el.remove();
    if (action) el.querySelector("button").addEventListener("click", () => { onAction && onAction(); kill(); });
    setTimeout(kill, ms);
  }

  /* ---------- Modal ---------- */
  function modal({ title, eyebrow = "", body, foot = "", onMount, label }) {
    const opener = document.activeElement;
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    const id = "m" + Math.random().toString(36).slice(2, 8);
    scrim.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="${id}">
        <div class="modal-head">
          <div class="stack" style="--stack:6px">
            ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}
            <h2 id="${id}" style="font-size:var(--fs-2xl)">${title}</h2>
          </div>
          <button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon("x")}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ""}
      </div>`;
    document.body.appendChild(scrim);
    document.body.style.overflow = "hidden";
    const dlg = scrim.querySelector(".modal");

    const focusables = () => [...dlg.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')];
    function close() {
      scrim.remove();
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      if (opener && opener.focus) opener.focus();
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    document.addEventListener("keydown", onKey);
    scrim.addEventListener("mousedown", (e) => { if (e.target === scrim) close(); });
    dlg.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
    onMount && onMount(dlg, close);
    (dlg.querySelector("[autofocus]") || focusables()[1] || focusables()[0]).focus();
    return close;
  }

  /* Pasos de "trabajando…" que se resuelven solos (Mago de Oz) */
  function runSteps(container, steps, done, stepMs = 650) {
    const lis = [...container.querySelectorAll(".working-steps li")];
    let i = 0;
    const tick = () => {
      lis.forEach((li, j) => { li.classList.toggle("is-done", j < i); li.classList.toggle("is-active", j === i); });
      if (i >= lis.length) return setTimeout(done, 250);
      i++;
      setTimeout(tick, stepMs);
    };
    tick();
  }

  return { esc, cop, fmtDate, fmtShort, addDays, icon, toast, modal, runSteps };
})();
