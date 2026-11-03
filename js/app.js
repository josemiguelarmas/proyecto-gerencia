/* Router por hash y estructura de la aplicación.
   Rutas: #/ · #/inicio/<sección> · #/empezar/<paso> · #/talla · #/caja · #/envio · #/plan · #/perfil */
TCB.app = (() => {
  const { icon } = TCB.ui;
  const S = TCB.screens;
  const routes = { "": S.landing, inicio: S.landing, empezar: S.onboarding, talla: S.talla, caja: S.caja, envio: S.envio, plan: S.plan, perfil: S.perfil };
  const appTabs = [
    { href: "#/caja", label: "Mi caja", icon: "box", match: ["caja"] },
    { href: "#/talla", label: "Tu talla", icon: "ruler", match: ["talla"] },
    { href: "#/envio", label: "Envío", icon: "truck", match: ["envio"] },
    { href: "#/plan", label: "Mi plan", icon: "plan", match: ["plan"] },
    { href: "#/perfil", label: "Perfil", icon: "user", match: ["perfil"] },
  ];

  let current = { name: null, params: [] };
  const header = document.getElementById("appbar");
  const tabbar = document.getElementById("tabbar");

  function parse() {
    const h = location.hash.replace(/^#\/?/, "");
    const [name = "", ...params] = h.split("/").filter(Boolean);
    return { name: routes[name] ? name : "", params };
  }

  const brand = `<a class="brand" href="#/" aria-label="The Clothes Box, inicio"><span class="brand-mark">The Clothes Box</span><span class="brand-bars" aria-hidden="true"><i></i><i></i><i></i></span></a>`;

  function paintShell(screen, name) {
    const st = TCB.store.get();
    let nav = "";
    if (screen.shell === "public") {
      nav = `<nav class="nav nav--public" aria-label="Principal">
        <a href="#/inicio/como-funciona" class="hide-sm">Cómo funciona</a>
        <a href="#/inicio/planes" class="hide-sm">Planes</a>
        ${st.profile.done ? `<a class="btn btn--sm" href="#/caja">Mi caja</a>` : `<a class="btn btn--sm" href="#/empezar">Arma tu perfil</a>`}
      </nav>`;
    } else if (screen.shell === "flow") {
      nav = `<p class="small muted flow-meta">Tu perfil · unos 3 minutos</p>`;
    } else {
      nav = `<nav class="nav nav--app" aria-label="Tu cuenta">
        ${appTabs.map((t) => `<a href="${t.href}" ${t.match.includes(name) ? 'aria-current="page"' : ""}>${t.label}</a>`).join("")}
      </nav>`;
    }
    header.innerHTML = `<div class="wrap appbar-inner">${brand}${nav}</div>`;

    const showTabs = screen.shell === "app";
    document.body.classList.toggle("has-tabbar", showTabs);
    tabbar.hidden = !showTabs;
    tabbar.innerHTML = showTabs ? appTabs.map((t) => `<a href="${t.href}" ${t.match.includes(name) ? 'aria-current="page"' : ""}>${icon(t.icon)}<span>${t.label}</span></a>`).join("") : "";
  }

  function draw({ keepFocus, navigated } = {}) {
    const { name, params } = parse();
    const screen = routes[name];
    const st = TCB.store.get();
    const y = window.scrollY;

    paintShell(screen, name);
    const old = document.getElementById("main");
    const main = old.cloneNode(false); // nodo nuevo: sin listeners de la pantalla anterior
    main.className = `screen screen--${screen.key}`;
    main.innerHTML = screen.render(st, params);
    old.replaceWith(main);
    screen.mount(main, params, (opts) => draw(opts || {}));

    document.title = screen.title;
    TCB.lab.setScreen(screen.screenKey ? screen.screenKey(params) : screen.key);

    if (navigated) {
      const section = screen.key === "landing" && params[0] ? document.getElementById(params[0]) : null;
      if (section) section.scrollIntoView();
      else window.scrollTo(0, 0);
      const h1 = main.querySelector("h1");
      if (h1 && !section) h1.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, y);
      if (keepFocus) main.querySelector(keepFocus)?.focus({ preventScroll: true });
    }
  }

  function onHash() {
    const next = parse();
    // Ir a una sección dentro de la landing no la vuelve a pintar
    if (current.name !== null && routes[current.name] === S.landing && routes[next.name] === S.landing && next.params[0]) {
      const el = document.getElementById(next.params[0]);
      if (el) { el.scrollIntoView({ behavior: "smooth" }); current = next; return; }
    }
    current = next;
    draw({ navigated: true });
  }

  window.addEventListener("hashchange", onHash);
  onHash();

  return { rerender: () => draw({}) };
})();
