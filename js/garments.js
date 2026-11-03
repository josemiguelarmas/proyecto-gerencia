/* Siluetas planas de prendas (SVG). Reemplazan fotos de catálogo:
   el prototipo no usa imágenes de terceros. */
TCB.garments = (() => {
  const shapes = {
    camiseta: {
      body: "M30 14 L42 9 Q50 16 58 9 L70 14 L89 31 L79 42 L70 35 L70 100 L30 100 L30 35 L21 42 L11 31 Z",
      details: ["M42 9 Q50 19 58 9"],
    },
    top: {
      body: "M36 10 L43 10 Q50 24 57 10 L64 10 Q66 24 71 31 L69 100 L31 100 L29 31 Q34 24 36 10 Z",
      details: ["M31 92 L69 92", "M40 32 L40 92", "M50 32 L50 92", "M60 32 L60 92"],
    },
    camisa: {
      body: "M32 13 L44 8 L50 17 L56 8 L68 13 L91 72 L81 76 L68 42 L68 102 L32 102 L32 42 L19 76 L9 72 Z",
      details: ["M44 8 L47 22 L50 17 L53 22 L56 8", "M50 17 L50 102", "M84 69 L80 71", "M16 69 L20 71"],
      buttons: [[50, 32], [50, 46], [50, 60], [50, 74], [50, 88]],
    },
    sobrecamisa: {
      body: "M31 13 L44 8 L50 17 L56 8 L69 13 L91 74 L80 78 L69 44 L69 102 L31 102 L31 44 L20 78 L9 74 Z",
      details: ["M44 8 L47 22 L50 17 L53 22 L56 8", "M50 17 L50 102", "M36 34 L46 34 L46 46 L36 46 Z", "M54 34 L64 34 L64 46 L54 46 Z"],
      buttons: [[50, 30], [50, 52], [50, 74], [50, 92]],
    },
    buzo: {
      body: "M31 14 L43 10 Q50 15 57 10 L69 14 Q84 30 90 70 L91 82 L81 84 L80 74 L70 44 L70 96 L71 104 L29 104 L30 96 L30 44 L20 74 L19 84 L9 82 L10 70 Q16 30 31 14 Z",
      details: ["M43 10 Q50 19 57 10", "M30 96 L70 96", "M80 74 L91 72", "M20 74 L9 72", "M40 52 Q50 58 60 52"],
    },
    chaqueta: {
      body: "M31 12 L43 8 L50 30 L57 8 L69 12 L90 74 L80 78 L69 44 L69 102 L31 102 L31 44 L20 78 L10 74 Z",
      details: ["M43 8 L38 26 L46 34 L50 30", "M57 8 L62 26 L54 34 L50 30", "M50 30 L50 102", "M36 70 L45 70", "M55 70 L64 70"],
      buttons: [[52, 50], [52, 64]],
    },
    chaleco: {
      body: "M33 10 L43 8 L50 36 L57 8 L67 10 Q68 26 74 32 L73 98 L27 98 L26 32 Q32 26 33 10 Z",
      details: ["M50 36 L50 98", "M27 90 L73 90", "M36 64 L45 64", "M55 64 L64 64"],
      buttons: [[52, 50], [52, 62], [52, 74]],
    },
    pantalon: {
      body: "M30 8 L70 8 L75 102 L57 102 L50 36 L43 102 L25 102 Z",
      details: ["M30 15 L70 15", "M50 15 L50 36", "M38 15 L38 60", "M62 15 L62 60"],
    },
    jean: {
      body: "M30 8 L70 8 L74 102 L57 102 L50 36 L43 102 L26 102 Z",
      details: ["M30 15 L70 15", "M50 15 L50 36", "M31 15 Q38 26 44 16", "M69 15 Q62 26 56 16", "M27 96 L43 96", "M57 96 L73 96"],
    },
    cargo: {
      body: "M29 8 L71 8 L77 102 L57 102 L50 36 L43 102 L23 102 Z",
      details: ["M29 15 L71 15", "M50 15 L50 36", "M25 52 L36 52 L36 68 L26 68", "M75 52 L64 52 L64 68 L74 68"],
    },
    jogger: {
      body: "M30 8 L70 8 L73 90 L69 102 L57 102 L55 92 L50 36 L45 92 L43 102 L31 102 L27 90 Z",
      details: ["M30 16 L70 16", "M44 16 L46 24", "M56 16 L54 24", "M30 94 L44 94", "M56 94 L70 94"],
    },
    falda: {
      body: "M35 12 L65 12 L82 100 L18 100 Z",
      details: ["M35 19 L65 19", "M42 19 L34 100", "M50 19 L50 100", "M58 19 L66 100"],
    },
  };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * (1 - amt))));
    return "#" + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }

  function svg(type, color, opts = {}) {
    const s = shapes[type] || shapes.camiseta;
    const edge = shade(color, 0.42);
    const detail = luminance(color) < 0.35 ? "rgba(255,255,255,0.35)" : "rgba(30,28,34,0.35)";
    const label = opts.label ? `<title>${opts.label}</title>` : "";
    const role = opts.label ? `role="img" aria-label="${opts.label}"` : `aria-hidden="true"`;
    const details = s.details.map((d) => `<path d="${d}" fill="none" stroke="${detail}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
    const print = opts.print ? `<circle cx="50" cy="${type === "camisa" ? 26 : 46}" r="7" fill="none" stroke="${detail}" stroke-width="1.6"/><path d="M45 ${type === "camisa" ? 26 : 46} h10" stroke="${detail}" stroke-width="1.6"/>` : "";
    const buttons = (s.buttons || []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="${detail}"/>`).join("");
    return `<svg viewBox="0 0 100 110" ${role}>${label}<path d="${s.body}" fill="${color}" stroke="${edge}" stroke-width="1.3" stroke-linejoin="round"/>${details}${print}${buttons}</svg>`;
  }

  // Fondo de la ficha: un tono de papel que no compita con la prenda
  function tile(item, { label = true, fabric = false } = {}) {
    const bg = luminance(item.color) > 0.78 ? "#ddd5c6" : "#ebe5d9";
    return `<div class="garment" style="--g-bg:${bg}">${svg(item.type, item.color, { label: label ? `${item.name}, color ${item.colorName}` : "", print: item.print && ["camiseta", "top"].includes(item.type) })}${fabric ? `<span class="garment-fabric">${item.fabric}</span>` : ""}</div>`;
  }

  return { svg, tile };
})();
