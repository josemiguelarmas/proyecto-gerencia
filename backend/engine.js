const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const BRAND_RUNS = {
  norte: { runs: 0, runsText: 'talla estándar' },
  ceiba: { runs: 0.6, runsText: 'talla pequeño' },
  mono: { runs: -0.5, runsText: 'talla amplio' },
  true: { runs: -0.4, runsText: 'corte holgado' },
  'punto-blanco': { runs: 0, runsText: 'talla regular' },
  mattelsa: { runs: 0.2, runsText: 'talla ajustada' }
};

const BUILD_FACTOR = { delgada: -1, media: 0, robusta: 1 };
const EASE_TOP = { ajustado: 4, regular: 8, holgado: 14 };
const EASE_BOTTOM = { ajustado: 2, regular: 4, holgado: 8 };

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x0, y0] = points[i - 1];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1][1];
}

function calculateBodyIndex(m) {
  const h = Number(m.height) || 170;
  const w = Number(m.weight) || 68;
  const bmi = w / Math.pow(h / 100, 2);
  const fromBmi = lerp([[17, 0], [19.5, 1], [22.5, 2], [25.5, 3], [28.5, 4], [32, 5]], bmi);
  const est = clamp(fromBmi + ((h - 170) / 20) * 0.6 + (BUILD_FACTOR[m.build] || 0) * 0.35, 0, 5);

  const usualIdx = m.usual ? SIZES.indexOf(m.usual) : null;
  let refIdx = null;
  if (m.refBrand && m.refSize) {
    const bRun = BRAND_RUNS[m.refBrand] ? BRAND_RUNS[m.refBrand].runs : 0;
    refIdx = SIZES.indexOf(m.refSize) - bRun;
  }

  let finalIdx;
  if (refIdx != null && refIdx >= 0) {
    finalIdx = usualIdx != null && usualIdx >= 0
      ? 0.5 * refIdx + 0.3 * usualIdx + 0.2 * est
      : 0.7 * refIdx + 0.3 * est;
  } else if (usualIdx != null && usualIdx >= 0) {
    finalIdx = 0.6 * usualIdx + 0.4 * est;
  } else {
    finalIdx = est;
  }

  return { finalIdx, est, usualIdx, disagree: usualIdx != null && Math.abs(usualIdx - est) > 1.2 };
}

function calculateFit(profile, garment) {
  const m = profile.measures || {};
  const body = calculateBodyIndex(m);
  const brandInfo = BRAND_RUNS[garment.brandId] || { runs: 0, runsText: 'talla regular' };
  const userBrandAdj = (profile.brandAdj && profile.brandAdj[garment.brandId]) || 0;

  let fitPref = 0;
  if (profile.fit === 'holgado' && garment.fit === 'ajustado') fitPref = 0.3;
  if (profile.fit === 'ajustado' && garment.fit === 'holgado') fitPref = -0.3;

  const targetNeed = body.finalIdx + brandInfo.runs + userBrandAdj + fitPref;
  const chosenIdx = clamp(Math.round(targetNeed), 0, SIZES.length - 1);
  const fraction = Math.abs(targetNeed - chosenIdx);

  let matchPct = 98 - fraction * 24 - (body.disagree ? 6 : 0) - (brandInfo.runs !== 0 ? 3 : 0);
  matchPct = Math.round(clamp(matchPct, 72, 98));

  const level = matchPct >= 90 ? 'alto' : matchPct >= 80 ? 'medio' : 'bajo';
  const size = SIZES[chosenIdx];

  const isBottom = garment.category === 'bottom';
  const bodyEstCm = Math.round((isBottom ? 66 : 86) + body.finalIdx * 6);
  const ease = (isBottom ? EASE_BOTTOM : EASE_TOP)[garment.fit] || 6;
  const garmentCm = Math.round((isBottom ? 66 : 86) + chosenIdx * 6 + ease - brandInfo.runs * 5);
  const room = garmentCm - bodyEstCm;

  return {
    size,
    matchPct,
    level,
    levelText: level === 'alto' ? 'Ajuste seguro' : level === 'medio' ? 'Ajuste probable' : 'Revisa tu talla',
    measureType: isBottom ? 'cintura' : 'pecho',
    bodyCm: bodyEstCm,
    garmentCm,
    room,
    brandAlert: brandInfo.runs !== 0 ? `${garment.brandName} ${brandInfo.runsText}` : null
  };
}

function curateBoxItems(profile, catalog, receivedItemIds = []) {
  const planItemsCount = profile.plan === 'estilo' ? 5 : 3;
  const targetSlots = planItemsCount === 5
    ? ['top', 'bottom', 'capa', 'top', 'bottom']
    : ['top', 'bottom', 'capa'];

  const chosenIds = [];

  function matchesLine(p) {
    if (profile.line === 'm') return p.line !== 'f';
    if (profile.line === 'f') return p.line !== 'm';
    return true;
  }

  function scoreProduct(p) {
    let s = 0;
    const styles = profile.styles || [];
    styles.forEach((st, idx) => {
      if (p.styles.includes(st)) s += (3 - idx) * 3;
    });
    const occs = profile.occasions || [];
    occs.forEach(o => {
      if (p.occasions.includes(o)) s += 2.5;
    });
    if (p.fit === profile.fit) s += 1.5;
    return s;
  }

  targetSlots.forEach(cat => {
    const candidateList = catalog
      .filter(p => p.category === cat && matchesLine(p) && !chosenIds.includes(p.id))
      .map(p => ({
        p,
        score: scoreProduct(p),
        isFresh: !receivedItemIds.includes(p.id)
      }))
      .sort((a, b) => {
        if (a.isFresh !== b.isFresh) return a.isFresh ? -1 : 1;
        return b.score - a.score;
      });

    if (candidateList.length > 0) {
      chosenIds.push(candidateList[0].p.id);
    }
  });

  return chosenIds;
}

module.exports = {
  SIZES,
  calculateFit,
  curateBoxItems
};
