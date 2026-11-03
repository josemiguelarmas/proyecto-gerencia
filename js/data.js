/* Datos del prototipo.
   Lo que viene de los documentos del equipo está marcado con la fuente.
   Las marcas y prendas son DE DEMOSTRACIÓN (el planificador P03 indica
   "tabla de tallas de 3-4 marcas aliadas (ficticias)"). */
window.TCB = window.TCB || {};

TCB.data = (() => {
  // Fuente: Lienzo del modelo de negocio, Segundo Corte (precios por validar en tarjetas 03 y 04)
  const plans = {
    esencial: { id: "esencial", name: "Esencial", price: 129900, items: 3, blurb: "3 prendas al mes. Para renovar sin gastar de más." },
    estilo:   { id: "estilo",   name: "Estilo",   price: 199900, items: 5, blurb: "5 prendas al mes. Más combinaciones por caja." },
  };

  // Fuente: encuesta propia n=50 y 20 entrevistas, abril 2026 · CCCE 2024
  const evidence = {
    identity: 78, price: 66, fabric: 54,
    source: "Encuesta propia a 50 jóvenes de 18 a 30 años y 20 entrevistas, abril de 2026.",
    market: [
      { k: "+26,7 %", v: "creció el comercio electrónico en Colombia en 2024" },
      { k: "COP 105,4 billones", v: "en ventas en línea durante 2024" },
    ],
    marketSource: "CCCE, informe de cierre del comercio electrónico 2024.",
  };

  // Moodboard (variante A del onboarding, planificador P05)
  const styles = [
    { id: "urbano",   name: "Urbano relajado", note: "Cortes amplios, buzos, capas.", palette: ["#5d6066", "#a39a8c", "#2f3a33", "#d9d3c7"], glyphs: ["buzo", "cargo", "camiseta"] },
    { id: "minimal",  name: "Minimal",          note: "Pocas piezas, líneas limpias.",  palette: ["#e8e4dc", "#1f1f22", "#b8b2a6", "#fafaf7"], glyphs: ["camisa", "pantalon", "camiseta"] },
    { id: "retro",    name: "Retro",            note: "Colores lavados, años 90.",     palette: ["#c9873b", "#5b7aa6", "#a2553e", "#e9d8b4"], glyphs: ["chaqueta", "jean", "camiseta"] },
    { id: "clasico",  name: "Clásico con giro", note: "Camisas, pantalón de tela y un detalle que rompe.", palette: ["#24324a", "#eae4d6", "#7b2d26", "#8d8a80"], glyphs: ["camisa", "pantalon", "sobrecamisa"] },
    { id: "deportivo",name: "Deportivo",        note: "Comodidad que sale a la calle.", palette: ["#2b2d31", "#d4e04b", "#e8e8e6", "#3f6db3"], glyphs: ["buzo", "jogger", "camiseta"] },
    { id: "artesanal",name: "Hecho aquí",       note: "Lino, texturas, marcas locales.", palette: ["#b7a37f", "#6b7a4f", "#f0e6d2", "#8a4b2e"], glyphs: ["sobrecamisa", "pantalon", "falda"] },
  ];

  // Quiz de 8 preguntas (variante B del onboarding, planificador P05)
  const quiz = [
    { id: "q1", text: "Un martes cualquiera de clase, ¿qué te pones?", options: [
      { t: "Buzo, jogger y tenis", s: { urbano: 2, deportivo: 2 } },
      { t: "Camiseta lisa y un pantalón que combine con todo", s: { minimal: 3 } },
      { t: "Algo que encontré en una tienda de segunda", s: { retro: 3 } },
      { t: "Camisa, aunque sea por fuera", s: { clasico: 3 } },
    ]},
    { id: "q2", text: "¿Qué colores dominan tu clóset?", options: [
      { t: "Negro, blanco y gris", s: { minimal: 2, urbano: 1 } },
      { t: "Tierra: beige, café, verde oliva", s: { artesanal: 2, urbano: 1 } },
      { t: "Color, sin miedo", s: { retro: 2, deportivo: 1 } },
      { t: "Azul oscuro y tonos sobrios", s: { clasico: 2 } },
    ], key: "palette" },
    { id: "q3", text: "¿Cómo te gusta que te quede la ropa?", options: [
      { t: "Holgada", s: { urbano: 2 }, fit: "holgado" },
      { t: "A la medida, ni suelta ni pegada", s: { clasico: 1, minimal: 1 }, fit: "regular" },
      { t: "Ajustada", s: { deportivo: 1 }, fit: "ajustado" },
    ], key: "fit" },
    { id: "q4", text: "Estampados y gráficos:", options: [
      { t: "Mientras más, mejor", s: { retro: 2, urbano: 1 } },
      { t: "Uno pequeño, como detalle", s: { clasico: 1, artesanal: 1 } },
      { t: "Nada, prefiero liso", s: { minimal: 2 } },
    ], key: "prints" },
    { id: "q5", text: "¿Qué te dicen más seguido de tu ropa?", options: [
      { t: "“Siempre te ves cómodo”", s: { deportivo: 2, urbano: 1 } },
      { t: "“¿Dónde compraste eso?”", s: { retro: 2, artesanal: 1 } },
      { t: "“Te ves arreglado”", s: { clasico: 2 } },
      { t: "Nada. Y me gusta así", s: { minimal: 2 } },
    ]},
    { id: "q6", text: "Si pudieras gastar en una sola cosa, sería en…", options: [
      { t: "Una buena tela que dure", s: { artesanal: 2, minimal: 1 } },
      { t: "Una prenda que nadie más tenga", s: { retro: 2 } },
      { t: "Lo que esté sonando ahora", s: { urbano: 2 } },
    ]},
    { id: "q7", text: "¿Qué cortes quieres ver en tu caja?", options: [
      { t: "Línea masculina", line: "m" },
      { t: "Línea femenina", line: "f" },
      { t: "Las dos", line: "u" },
    ], key: "line" },
    { id: "q8", text: "¿Cuánto quieres que arriesguemos?", options: [
      { t: "Poco: cosas que sé que me voy a poner", risk: 0 },
      { t: "Un paso afuera de lo de siempre", risk: 1 },
      { t: "Sorpréndanme", risk: 2 },
    ], key: "risk" },
  ];

  // Fuente: planificador P05 — "Clase, fiesta, entrevista"
  const occasions = [
    { id: "clase", name: "Clase", sub: "El día a día en la universidad" },
    { id: "fiesta", name: "Fiesta", sub: "Salir de noche o un plan con amigos" },
    { id: "entrevista", name: "Entrevista", sub: "Práctica, primer trabajo, presentación" },
  ];

  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

  // Marcas aliadas DE DEMOSTRACIÓN. `runs` replica la idea de "semáforo"
  // y "alerta por tallaje atípico" del Sistema de solución 1.
  const brands = {
    norte: { id: "norte", name: "Taller Norte", city: "Cali", runs: 0, runsText: "talla estándar" },
    ceiba: { id: "ceiba", name: "Ceiba Estudio", city: "Cali", runs: 0.6, runsText: "talla pequeño" },
    mono:  { id: "mono",  name: "Mono Textil",  city: "Cali", runs: -0.5, runsText: "talla amplio" },
  };

  // cat: top | bottom | capa  ·  line: m | f | u
  const catalog = [
    { id: "p01", name: "Camiseta pesada lisa", type: "camiseta", cat: "top", brand: "norte", color: "#e9e4d8", colorName: "hueso", fabric: "Algodón 240 g", fit: "regular", line: "u", styles: ["minimal", "urbano", "clasico"], occ: ["clase"] },
    { id: "p02", name: "Camiseta boxy estampada", type: "camiseta", cat: "top", brand: "mono", color: "#a2553e", colorName: "ladrillo", fabric: "Algodón peinado", fit: "holgado", line: "u", styles: ["retro", "urbano"], occ: ["clase", "fiesta"], print: true },
    { id: "p03", name: "Camisa de lino manga corta", type: "camisa", cat: "top", brand: "ceiba", color: "#d8cdb4", colorName: "arena", fabric: "Lino-algodón", fit: "regular", line: "u", styles: ["artesanal", "clasico", "minimal"], occ: ["fiesta", "clase"] },
    { id: "p04", name: "Camisa oxford", type: "camisa", cat: "top", brand: "norte", color: "#b9c7dc", colorName: "azul cielo", fabric: "Oxford de algodón", fit: "regular", line: "u", styles: ["clasico", "minimal"], occ: ["entrevista", "clase"] },
    { id: "p05", name: "Buzo de felpa", type: "buzo", cat: "top", brand: "mono", color: "#6e7468", colorName: "verde gris", fabric: "Felpa perchada", fit: "holgado", line: "u", styles: ["urbano", "deportivo"], occ: ["clase"] },
    { id: "p06", name: "Top tejido sin mangas", type: "top", cat: "top", brand: "ceiba", color: "#1f1f22", colorName: "negro", fabric: "Punto acanalado", fit: "ajustado", line: "f", styles: ["minimal", "clasico"], occ: ["fiesta", "clase"] },
    { id: "p07", name: "Blusa con cuello bordado", type: "camisa", cat: "top", brand: "ceiba", color: "#f0e6d2", colorName: "crudo", fabric: "Popelina", fit: "regular", line: "f", styles: ["artesanal", "retro"], occ: ["fiesta", "entrevista"], print: true },
    { id: "p08", name: "Camiseta técnica", type: "camiseta", cat: "top", brand: "norte", color: "#3f6db3", colorName: "azul", fabric: "Poliéster reciclado", fit: "ajustado", line: "u", styles: ["deportivo"], occ: ["clase"] },
    { id: "p09", name: "Polo de punto", type: "camiseta", cat: "top", brand: "norte", color: "#7b2d26", colorName: "vino", fabric: "Punto piqué", fit: "regular", line: "m", styles: ["clasico", "retro"], occ: ["fiesta", "entrevista"] },

    { id: "p10", name: "Jean recto lavado medio", type: "jean", cat: "bottom", brand: "norte", color: "#5b7aa6", colorName: "índigo medio", fabric: "Denim 12 oz", fit: "regular", line: "u", styles: ["retro", "minimal", "urbano"], occ: ["clase", "fiesta"] },
    { id: "p11", name: "Pantalón de pinza", type: "pantalon", cat: "bottom", brand: "ceiba", color: "#2f3340", colorName: "grafito", fabric: "Sarga de viscosa", fit: "regular", line: "u", styles: ["clasico", "minimal"], occ: ["entrevista", "fiesta"] },
    { id: "p12", name: "Cargo de dril", type: "cargo", cat: "bottom", brand: "mono", color: "#6b6a4f", colorName: "oliva", fabric: "Dril de algodón", fit: "holgado", line: "u", styles: ["urbano"], occ: ["clase"] },
    { id: "p13", name: "Jogger de felpa", type: "jogger", cat: "bottom", brand: "mono", color: "#2b2d31", colorName: "carbón", fabric: "Felpa", fit: "regular", line: "u", styles: ["deportivo", "urbano"], occ: ["clase"] },
    { id: "p14", name: "Pantalón de lino", type: "pantalon", cat: "bottom", brand: "ceiba", color: "#b7a37f", colorName: "kaki", fabric: "Lino", fit: "holgado", line: "u", styles: ["artesanal", "minimal"], occ: ["fiesta", "clase"] },
    { id: "p15", name: "Falda midi plisada", type: "falda", cat: "bottom", brand: "ceiba", color: "#8a4b2e", colorName: "óxido", fabric: "Satín mate", fit: "regular", line: "f", styles: ["retro", "artesanal", "clasico"], occ: ["fiesta", "entrevista"] },
    { id: "p16", name: "Jean ancho tiro alto", type: "jean", cat: "bottom", brand: "mono", color: "#33476b", colorName: "índigo oscuro", fabric: "Denim rígido", fit: "holgado", line: "f", styles: ["retro", "urbano"], occ: ["clase", "fiesta"] },

    { id: "p17", name: "Sobrecamisa de pana", type: "sobrecamisa", cat: "capa", brand: "norte", color: "#a5673f", colorName: "arcilla", fabric: "Pana fina", fit: "regular", line: "u", styles: ["retro", "artesanal", "clasico"], occ: ["clase", "fiesta"] },
    { id: "p18", name: "Chaqueta de mezclilla", type: "chaqueta", cat: "capa", brand: "mono", color: "#5b7aa6", colorName: "índigo", fabric: "Denim", fit: "regular", line: "u", styles: ["retro", "urbano"], occ: ["clase", "fiesta"] },
    { id: "p19", name: "Blazer sin forro", type: "chaqueta", cat: "capa", brand: "ceiba", color: "#24324a", colorName: "azul noche", fabric: "Lana fría", fit: "regular", line: "u", styles: ["clasico", "minimal"], occ: ["entrevista", "fiesta"] },
    { id: "p20", name: "Chaqueta rompevientos", type: "chaqueta", cat: "capa", brand: "norte", color: "#d4e04b", colorName: "lima", fabric: "Nylon ripstop", fit: "holgado", line: "u", styles: ["deportivo", "urbano"], occ: ["clase"] },
    { id: "p21", name: "Chaleco tejido", type: "chaleco", cat: "capa", brand: "ceiba", color: "#c9b48a", colorName: "trigo", fabric: "Punto de algodón", fit: "regular", line: "u", styles: ["artesanal", "retro", "clasico"], occ: ["clase", "entrevista"] },
  ];

  // Lo que el usuario ya tiene: Grupo 3, "completar con el guardarropa que ya tiene"
  const closet = {
    top: "una camiseta blanca que ya tengas",
    bottom: "tu jean de siempre",
    shoes: { clase: "tus tenis de diario", fiesta: "zapatos oscuros o botas", entrevista: "zapatos cerrados limpios" },
  };

  // Tarjetas de prueba (Plan de pruebas, Segundo Corte)
  const cards = {
    "01": { front: "talla", type: "Deseabilidad", name: "Confianza en el tallaje", method: "Clickable Prototype", q: "¿Confían sin probarse la ropa?", goal: "Al menos 70 % da confianza 4/5 sin pedir más datos." },
    "02": { front: "curaduria", type: "Factibilidad", name: "Motor de curaduría", method: "Wizard of Oz", q: "¿Una persona con reglas simples arma buenos outfits?", goal: "Menos de 15 min por outfit y 70 % lo califica 4/5." },
    "03": { front: "suscripcion", type: "Viabilidad", name: "Disposición a pagar", method: "Simple Landing Page", q: "¿Pagarían la mensualidad?", goal: "Al menos 8 % de las visitas se registra en la lista de espera." },
    "04": { front: "suscripcion", type: "Viabilidad", name: "Tiendas y costo por caja", method: "Letter of Intent + Concierge", q: "¿Aceptan las tiendas y la caja cuesta menos que el plan?", goal: "3 de 10 tiendas firman y costo por caja menor al precio." },
    "05": { front: "curaduria", type: "Deseabilidad", name: "Quiz de estilo y “me representa”", method: "Clickable Prototype A/B", q: "¿Los outfits lo representan?", goal: "80 % termina en menos de 3 min y “me representa” de 4/5 o más." },
    "06": { front: "talla", type: "Factibilidad", name: "Precisión del motor de talla", method: "Prueba técnica manual", q: "¿Bastan cuatro datos para acertar?", goal: "Al menos 70 % de acierto de talla." },
    "07": { front: "suscripcion", type: "Deseabilidad", name: "Garantía de cambio y prueba en casa", method: "Split Test", q: "¿Quitar el costo de equivocarse destraba la compra?", goal: "El grupo con garantía supera al otro en 25 puntos de intención de compra." },
    "08": { front: "talla", type: "Deseabilidad", name: "Pop-up de medidas", method: "Pop-Up Store", q: "¿Se dejan medir en público y dejan sus datos?", goal: "25 % acepta medirse, 40 % de los medidos deja datos, menos de 4 min." },
  };

  // Qué tarjetas valida cada pantalla
  const screenCards = {
    landing: ["03", "07"],
    estilo: ["05"],
    ocasion: ["05"],
    medidas: ["01", "06"],
    talla: ["01", "07", "06"],
    caja: ["05", "02"],
    envio: ["04", "06"],
    plan: ["03", "04"],
    perfil: ["06", "08"],
  };

  return { plans, evidence, styles, quiz, occasions, sizes, brands, catalog, closet, cards, screenCards };
})();
