/* Estado del prototipo. Se guarda en el navegador para que la demo
   sobreviva a una recarga; "Reiniciar demo" lo borra. */
TCB.store = (() => {
  const KEY = "tcb-prototipo-v1";

  const initial = () => ({
    lab: { styleVariant: "A", guarantee: true },
    metrics: { onboardStart: null, onboardEnd: null, confidence: null, represents: null, accepted: null },
    profile: {
      done: false,
      styleMethod: null,
      styles: [],
      quiz: {},
      palette: null, fit: "regular", prints: null, line: "u", risk: 1,
      occasions: [],
      plan: "esencial",
      measures: { height: "", weight: "", build: "", usual: "", refBrand: "", refSize: "" },
      brandAdj: {},
    },
    box: null,
    history: [],
    plan: { status: "activa", resumeOn: null, balance: 0 },
    waitlist: null,
  });

  let state = load();
  const subs = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(initial(), JSON.parse(raw));
    } catch (e) { /* almacenamiento bloqueado: seguimos en memoria */ }
    return initial();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignorar */ }
  }

  function get() { return state; }

  function update(fn) {
    fn(state);
    save();
    subs.forEach((s) => s(state));
  }

  function reset() {
    state = initial();
    save();
    subs.forEach((s) => s(state));
  }

  function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

  return { get, update, reset, subscribe };
})();
