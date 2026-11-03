/* Motor del prototipo.
   No es IA: son reglas fijas, igual que en las pruebas del equipo
   (P03 "el match se simula con reglas fijas", tarjeta 02 "reglas simples:
   color, ocasión, presupuesto y talla"). */
TCB.engine = (() => {
  const { sizes, brands, catalog, styles, closet, occasions } = TCB.data;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const byId = (id) => catalog.find((p) => p.id === id);
  const BUILD = { delgada: -1, media: 0, robusta: 1 };
  const EASE_TOP = { ajustado: 4, regular: 8, holgado: 14 };
  const EASE_BOTTOM = { ajustado: 1, regular: 3, holgado: 6 };

  function lerp(points, x) {
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x0, y0] = points[i - 1];
      if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
    return points[points.length - 1][1];
  }

  /* Talla "real" del cuerpo, en índice continuo 0 (XS) … 5 (XXL). */
  function bodyIndex(m) {
    const h = Number(m.height), w = Number(m.weight);
    const bmi = w / Math.pow(h / 100, 2);
    const fromBmi = lerp([[17, 0], [19.5, 1], [22.5, 2], [25.5, 3], [28.5, 4], [32, 5]], bmi);
    const est = clamp(fromBmi + ((h - 170) / 20) * 0.6 + (BUILD[m.build] || 0) * 0.35, 0, 5);
    const usual = m.usual ? sizes.indexOf(m.usual) : null;
    let ref = null;
    if (m.refBrand && m.refSize) {
      ref = sizes.indexOf(m.refSize) - (brands[m.refBrand] ? brands[m.refBrand].runs : 0);
    }
    let f;
    if (ref != null) f = usual != null ? 0.5 * ref + 0.3 * usual + 0.2 * est : 0.7 * ref + 0.3 * est;
    else if (usual != null) f = 0.6 * usual + 0.4 * est;
    else f = est;
    return { f, est, usual, ref, disagree: usual != null && Math.abs(usual - est) > 1.2 };
  }

  function measuresComplete(m) {
    return Number(m.height) >= 140 && Number(m.height) <= 210 && Number(m.weight) >= 38 && Number(m.weight) <= 160 && !!m.build && !!m.usual;
  }

  function fit(profile, item) {
    const b = bodyIndex(profile.measures);
    const brand = brands[item.brand];
    const adj = profile.brandAdj[item.brand] || 0;
    let pref = 0;
    if (profile.fit === "holgado" && item.fit === "ajustado") pref = 0.3;
    if (profile.fit === "ajustado" && item.fit === "holgado") pref = -0.3;
    const need = b.f + brand.runs + adj + pref;
    const idx = clamp(Math.round(need), 0, sizes.length - 1);
    const frac = Math.abs(need - idx);
    let pct = 97 - frac * 24 - (b.disagree ? 7 : 0) - (b.ref == null ? 3 : 0) - (brand.runs ? 2 : 0);
    pct = Math.round(clamp(pct, 70, 98));
    const level = pct >= 90 ? "alto" : pct >= 80 ? "medio" : "bajo";
    const neighbor = frac > 0.3 ? sizes[clamp(need > idx ? idx + 1 : idx - 1, 0, sizes.length - 1)] : null;

    const isBottom = item.cat === "bottom";
    const bodyCm = Math.round((isBottom ? 66 : 84) + b.f * 6);
    const ease = (isBottom ? EASE_BOTTOM : EASE_TOP)[item.fit];
    const garmentCm = Math.round((isBottom ? 66 : 84) + idx * 6 + ease - brand.runs * 6);
    return {
      size: sizes[idx], pct, level, neighbor,
      measure: isBottom ? "cintura" : "pecho",
      bodyCm, garmentCm, room: garmentCm - bodyCm,
      alert: brand.runs !== 0 ? `${brand.name} ${brand.runsText}` : null,
      adjusted: adj !== 0,
    };
  }

  const levelText = { alto: "Ajuste seguro", medio: "Ajuste probable", bajo: "Revisa tu talla" };

  /* ---------- Curaduría ---------- */
  function lineOk(profile, item) {
    if (profile.line === "m") return item.line !== "f";
    if (profile.line === "f") return item.line !== "m";
    return true;
  }

  function score(profile, item) {
    let s = 0;
    profile.styles.forEach((st, i) => { if (item.styles.includes(st)) s += 3 - i; });
    profile.occasions.forEach((o) => { if (item.occ.includes(o)) s += 1.5; });
    if (item.fit === profile.fit) s += 0.5;
    if (profile.prints === 2 && item.print) s -= 5;
    if (profile.prints === 0 && item.print) s += 1;
    return s;
  }

  function pool(profile, exclude = []) {
    const avoid = profile.avoid || [];
    return catalog
      .filter((p) => lineOk(profile, p) && !exclude.includes(p.id) && !avoid.includes(p.id))
      .map((p) => ({ p, s: score(profile, p) }))
      .sort((a, b) => b.s - a.s);
  }

  /* `received`: prendas de cajas anteriores; no se repiten mientras haya opciones */
  function curate(profile, received = []) {
    const n = TCB.data.plans[profile.plan].items;
    const slots = n === 3 ? ["top", "bottom", "capa"] : ["top", "bottom", "capa", "top", "bottom"];
    const chosen = [];
    slots.forEach((cat) => {
      const usedTypes = chosen.map((id) => byId(id).type);
      const fresh = pool(profile, [...chosen, ...received]).filter((x) => x.p.cat === cat);
      const cand = fresh.length ? fresh : pool(profile, chosen).filter((x) => x.p.cat === cat);
      const pick = cand.find((x) => !usedTypes.includes(x.p.type)) || cand[0];
      if (pick) chosen.push(pick.p.id);
    });

    // La "apuesta": si pidió arriesgar, una prenda sale de su estilo principal
    let bet = null;
    if (profile.risk > 0 && profile.styles.length) {
      const lastCat = byId(chosen[chosen.length - 1]).cat;
      const outside = pool(profile, [...chosen, ...received]).filter((x) => x.p.cat === lastCat && !x.p.styles.includes(profile.styles[0]));
      if (outside.length) {
        bet = outside[0].p.id;
        chosen[chosen.length - 1] = bet;
      }
    }
    return { items: chosen, bet };
  }

  function alternatives(profile, box, itemId, count = 3) {
    const item = byId(itemId);
    return pool(profile, box.items).filter((x) => x.p.cat === item.cat).slice(0, count).map((x) => x.p);
  }

  const occLine = {
    clase: "Para clase: aguanta el día entero sentado y caminando el campus.",
    fiesta: "Para salir: sube un punto sin que parezca que te esforzaste de más.",
    entrevista: "Para una entrevista: sobrio, pero se ve como tú y no como prestado.",
  };

  function outfits(profile, box) {
    const items = box.items.map(byId);
    const occs = profile.occasions.length ? profile.occasions : ["clase"];
    const plan = [0, 1, 2].map((i) => occs[i % occs.length]);
    const styleName = (id) => (styles.find((s) => s.id === id) || {}).name;

    const seen = new Set();
    return plan.map((occ, i) => {
      const pickFrom = (cat) => {
        const list = items.filter((p) => p.cat === cat);
        if (!list.length) return null;
        const fitting = list.filter((p) => p.occ.includes(occ));
        const src = fitting.length ? fitting : list;
        return src[i % src.length];
      };
      const baseTop = pickFrom("top");
      const baseBottom = pickFrom("bottom");
      const baseCapa = items.find((p) => p.cat === "capa" && p.occ.includes(occ)) || items.find((p) => p.cat === "capa") || null;

      // Variantes en orden de preferencia; se usa la primera que no repita un outfit anterior.
      // Las que mezclan con el clóset ponen en práctica "completar con lo que ya tiene" (Grupo 3).
      const variants = [
        { top: baseTop, bottom: baseBottom, capa: baseCapa && baseCapa.occ.includes(occ) ? baseCapa : null },
        { top: baseTop, bottom: baseBottom, capa: null },
        { top: null, bottom: baseBottom, capa: baseCapa },
        { top: baseTop, bottom: null, capa: baseCapa },
        { top: baseTop, bottom: null, capa: null },
      ].filter((v) => [v.top, v.bottom, v.capa].filter(Boolean).length >= 2 || (v.top && !v.bottom));
      const sig = (v) => [v.top, v.bottom, v.capa].map((x) => (x ? x.id : "-")).join("|");
      const chosen = variants.find((v) => !seen.has(sig(v))) || variants[0];
      seen.add(sig(chosen));
      const { top, bottom, capa } = chosen;
      const pieces = [top, bottom, capa].filter(Boolean);

      const fromCloset = [];
      if (!top) fromCloset.push(closet.top);
      if (!bottom) fromCloset.push(closet.bottom);
      fromCloset.push(closet.shoes[occ]);

      const hero = capa || top || bottom;
      const matchStyle = profile.styles.find((s) => hero.styles.includes(s));
      const why = [];
      if (hero.id === box.bet) why.push(`${cap(hero.name)} es la apuesta de esta caja: nos pediste salir un poco de lo de siempre.`);
      else if (matchStyle) why.push(`Elegiste “${styleName(matchStyle)}”: ${hero.name.toLowerCase()} en ${hero.colorName} va en esa línea.`);
      why.push(occLine[occ]);
      why.push(`Lo cierras con ${fromCloset.join(" y ")}: no tienes que comprarlo.`);

      const occName = occasions.find((o) => o.id === occ).name;
      const repeat = plan.slice(0, i).filter((o) => o === occ).length;
      const title = repeat ? `${occName} · ${["otra opción", "con lo que ya tienes"][repeat - 1]}` : occName;
      return { id: `o${i + 1}`, occ, title, pieces, fromCloset, why };
    });
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  return { fit, levelText, measuresComplete, curate, alternatives, outfits, byId, bodyIndex };
})();
