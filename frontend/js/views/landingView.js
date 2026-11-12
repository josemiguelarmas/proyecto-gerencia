// Landing View — Storytelling de Producto inspirado en Apple.com
window.TCB = window.TCB || {};
TCB.views = TCB.views || {};

TCB.views.landing = (() => {
  const { icon, logoSvg, garmentTile } = TCB.brand;

  function render(store) {
    const products = store.products.slice(0, 8);

    return `
      <!-- HERO PRINCIPAL -->
      <section class="landing-hero wrap">
        <div class="landing-hero-tag">
          ${icon('sparkle', 16)}
          <span>Moda independiente curada · Piloto en Cali</span>
        </div>
        <h1 class="landing-title">
          Moda que te representa, con la talla resuelta <em>antes de pagar</em>.
        </h1>
        <p class="landing-sub">
          Recibes una caja mensual con prendas de marcas colombianas seleccionadas para tu cuerpo y tu estilo. El contenido es un misterio hasta que llega a tu puerta.
        </p>

        <div class="landing-cta-row">
          ${store.user ? `
            <a class="btn btn--gold btn--lg" href="#/caja">Ir a mi caja activa ${icon('arrowR')}</a>
            <a class="btn btn--ghost btn--lg" href="#/devoluciones">Devoluciones por talla</a>
          ` : `
            <a class="btn btn--gold btn--lg" href="#/empezar">Descubrir mi estilo ${icon('arrowR')}</a>
            <button type="button" class="btn btn--ghost btn--lg" data-open-login>Ya tengo cuenta</button>
          `}
        </div>

        <!-- CAJA SECRETA INTERACTIVA (HERO TEASER) -->
        <div class="hero-box-stage">
          <div class="mystery-box-card" role="region" aria-label="Previsualización de la caja sorpresa">
            <div class="box-seal-tape">
              <span>★ Contenido Secreto ★</span>
              <span>Edición Limitada Cali</span>
              <span>★ No Abrir Antes de Entrega ★</span>
            </div>
            <div class="mystery-box-inner">
              ${products.slice(0, 3).map(p => garmentTile(p, { showFabric: true })).join('')}
            </div>
            <div class="mystery-badge">
              ${icon('sparkle')}
              <span>Talla y estilo 100% personalizados</span>
            </div>
          </div>
        </div>
      </section>

      <!-- HISTORIA CAPÍTULO 1: DESCUBRE TU ESTILO -->
      <section class="story-chapter wrap" id="estilo">
        <div class="chapter-lead">
          <div>
            <span class="chapter-num">01 · El Problema</span>
            <h2 class="chapter-h2">El joven con identidad propia no tiene dónde comprar.</h2>
          </div>
          <p class="chapter-desc">
            El <em>fast fashion</em> uniforma a todos con las mismas camisetas sintéticas. Las marcas exclusivas cobran precios imposibles. The Clothes Box conecta talleres independientes y marcas emergentes de Colombia con prendas reales, tejidos nobles y cortes modernos.
          </p>
        </div>

        <div class="garment-showcase">
          ${products.slice(0, 4).map(p => `
            <article class="showcase-card">
              ${garmentTile(p)}
              <span class="showcase-brand">${p.brandName} · ${p.brandCity}</span>
              <h3 class="showcase-name">${p.name}</h3>
              <p class="small muted">${p.fabric}</p>
              <div class="showcase-meta">
                <span>Corte ${p.fit}</span>
                <span class="mono">COP ${p.priceCOP.toLocaleString('es-CO')}</span>
              </div>
            </article>
          `).join('')}
        </div>
      </section>

      <!-- HISTORIA CAPÍTULO 2: CUÉNTANOS QUIÉN ERES (CERTEZA DE TALLA) -->
      <section class="story-chapter wrap" id="talla">
        <div class="chapter-lead">
          <div>
            <span class="chapter-num">02 · Certeza de Talla</span>
            <h2 class="chapter-h2">El problema no es la talla: es el costo de equivocarse.</h2>
          </div>
          <p class="chapter-desc">
            Nadie quiere perder una semana devolviendo ropa por correo. Convertimos 4 datos simples (estatura, peso, contextura y una prenda que te quede bien) en una recomendación de talla milimétrica cruzada con las medidas reales en centímetros de cada taller.
          </p>
        </div>

        <div class="body-engine-grid">
          <div>
            <h3 style="font-size:var(--fs-2xl);margin-bottom:12px">Cómo calculamos tu ajuste</h3>
            <p class="muted" style="margin-bottom:24px">Sin cámaras invasivas ni escaneos corporales. Pura precisión de patronaje.</p>
            <div class="engine-step-list">
              <div class="engine-step-item">
                <span class="engine-step-icon">1</span>
                <div>
                  <strong>Índice corporal volumétrico</strong>
                  <p class="small muted">Calculado por altura, masa y contextura ósea.</p>
                </div>
              </div>
              <div class="engine-step-item">
                <span class="engine-step-icon">2</span>
                <div>
                  <strong>Calibración por prenda de referencia</strong>
                  <p class="small muted">Si tienes una prenda que te queda perfecta, la usamos para calibrar la holgura.</p>
                </div>
              </div>
              <div class="engine-step-item">
                <span class="engine-step-icon">3</span>
                <div>
                  <strong>Tabla real en centímetros de cada marca</strong>
                  <p class="small muted">No nos guiamos por la letra de la etiqueta. Sabemos cuánto mide el pecho y la cintura de cada prenda.</p>
                </div>
              </div>
            </div>
          </div>

          <div style="background:var(--paper-2);padding:24px;border:1px solid var(--rule-strong);display:grid;place-items:center;text-align:center">
            <div class="hangtag" style="margin-bottom:16px">
              <span class="label">Tu talla precisa</span>
              <span class="size">M</span>
              <span class="pct">96% Confianza</span>
            </div>
            <p class="small" style="max-width:28ch">
              <strong>Semáforo de confianza antes de pagar:</strong> si una marca aliada talla pequeño o amplio, nuestro motor lo ajusta de inmediato.
            </p>
          </div>
        </div>
      </section>

      <!-- HISTORIA CAPÍTULO 3: LA CAJA SORPRESA -->
      <section class="story-chapter wrap" id="sorpresa">
        <div class="chapter-lead">
          <div>
            <span class="chapter-num">03 · La Emoción</span>
            <h2 class="chapter-h2">Prendas secretas hasta el momento de la entrega.</h2>
          </div>
          <p class="chapter-desc">
            Comprar ropa online se volvió aburrido: catálogos infinitos de 4.000 fotos donde todas se ven iguales. En The Clothes Box recuperamos la emoción del descubrimiento. Sabemos tu perfil, pero qué prendas exactas viajan en tu caja es una sorpresa hasta que la abres.
          </p>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:20px;text-align:center">
          <div style="background:var(--sheet);border:var(--hair);padding:32px 20px">
            <div style="font-size:2rem;margin-bottom:12px">📦</div>
            <h3 style="margin-bottom:8px">1. En preparación</h3>
            <p class="small muted">Un estilista cura la combinación de colores y texturas de tu caja.</p>
          </div>
          <div style="background:var(--sheet);border:var(--hair);padding:32px 20px">
            <div style="font-size:2rem;margin-bottom:12px">🚚</div>
            <h3 style="margin-bottom:8px">2. En camino a Cali</h3>
            <p class="small muted">Despacho seguro a tu dirección con fecha de entrega garantizada.</p>
          </div>
          <div style="background:var(--sheet);border:var(--hair);padding:32px 20px">
            <div style="font-size:2rem;margin-bottom:12px">✨</div>
            <h3 style="margin-bottom:8px">3. Abre y descubre</h3>
            <p class="small muted">Unboxing táctil, fichas técnicas y combinaciones con tu propio guardarropa.</p>
          </div>
        </div>
      </section>

      <!-- BANNER DE GARANTÍA RIESGO CERO -->
      <section class="guarantee-banner">
        <div class="wrap guarantee-grid">
          <div>
            <span class="eyebrow" style="color:var(--brand-gold)">Riesgo Cero</span>
            <h2 style="font-size:var(--fs-3xl);margin-top:8px">¿Y si una prenda no te queda?</h2>
            <p class="lede" style="color:#d8d2c4;margin-top:12px">
              Las devoluciones por talla son 100% gratuitas. Las recogemos en tu casa en Cali y te enviamos la talla correcta sin preguntas incómodas.
            </p>
          </div>
          <div class="guarantee-points">
            <div class="guarantee-item">
              ${icon('check')}
              <div>
                <strong>Devolución por talla garantizada</strong>
                <p class="small" style="color:#bfb8aa">Si la prenda te queda pequeña, grande o con desajuste de corte, solicitas el cambio en un clic.</p>
              </div>
            </div>
            <div class="guarantee-item">
              ${icon('truck')}
              <div>
                <strong>Recogida a domicilio en Cali</strong>
                <p class="small" style="color:#bfb8aa">No tienes que ir a ninguna oficina postal ni hacer filas.</p>
              </div>
            </div>
            <div class="guarantee-item">
              ${icon('refresh')}
              <div>
                <strong>Recalibración automática</strong>
                <p class="small" style="color:#bfb8aa">Cada cambio ajusta el motor de patronaje para que tu siguiente caja sea aún más exacta.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- PLANES TRANSPARENTES -->
      <section class="story-chapter wrap" id="planes">
        <div style="text-align:center;max-width:540px;margin-inline:auto;margin-bottom:var(--s-7)">
          <span class="eyebrow">Suscripción Flexible</span>
          <h2 class="chapter-h2" style="margin-top:8px">Planes mensuales sin ataduras</h2>
          <p class="muted">Pausa un mes sin cobro, salta un ciclo acumulando saldo o cancela cuando quieras.</p>
        </div>

        <div class="plans-grid">
          <div class="plan-card">
            <div>
              <h3 style="font-size:var(--fs-2xl)">Plan Esencial</h3>
              <p class="small muted">Para renovar tu armario con prendas versátiles mes a mes.</p>
            </div>
            <div style="font-size:var(--fs-3xl);font-weight:600">
              <span class="mono">COP 129.900</span>
              <span class="small muted" style="font-weight:400">/ mes</span>
            </div>
            <ul class="stack" style="--stack:12px;font-size:var(--fs-sm)">
              <li style="display:flex;gap:10px;align-items:center">${icon('check')} <strong>3 prendas completas</strong> curadas para ti</li>
              <li style="display:flex;gap:10px;align-items:center">${icon('check')} Talla garantizada por prenda</li>
              <li style="display:flex;gap:10px;align-items:center">${icon('check')} Cambio gratis por problema de talla</li>
              <li style="display:flex;gap:10px;align-items:center">${icon('check')} Envío incluido en Cali</li>
            </ul>
            <a class="btn btn--block" href="#/empezar">Elegir Plan Esencial ${icon('arrowR')}</a>
          </div>

          <div class="plan-card plan-card--featured">
            <span class="chip chip--box plan-card-tag">Más Elegido</span>
            <div>
              <h3 style="font-size:var(--fs-2xl)">Plan Estilo</h3>
              <p class="small muted">Rotación completa de guardarropa: capas, tops y pantalones.</p>
            </div>
            <div style="font-size:var(--fs-3xl);font-weight:600">
              <span class="mono">COP 199.900</span>
              <span class="small muted" style="font-weight:400">/ mes</span>
            </div>
            <ul class="stack" style="--stack:12px;font-size:var(--fs-sm)">
              <li style="display:flex;gap:10px;align-items:center">${icon('check')} <strong>5 prendas completas</strong> de marcas locales</li>
              <li style="display:flex;gap:10px;align-items:center">${icon('check')} Mayor variedad de capas (chaquetas/sobrecamisas)</li>
              <li style="display:flex;gap:10px;align-items:center">${icon('check')} 3 outfits completos combinados con tu clóset</li>
              <li style="display:flex;gap:10px;align-items:center">${icon('check')} Cambio gratis por problema de talla</li>
            </ul>
            <a class="btn btn--gold btn--block" href="#/empezar">Elegir Plan Estilo ${icon('arrowR')}</a>
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="wrap" style="border-top:var(--line);padding-block:var(--s-7);margin-top:var(--s-8);display:flex;justify-content:space-between;flex-wrap:wrap;gap:24px;font-size:var(--fs-sm);color:var(--muted)">
        <div style="display:flex;align-items:center;gap:12px">
          ${logoSvg(28)}
          <span style="font-weight:700;color:var(--ink)">The Clothes Box</span>
          <span>· Moda que te representa</span>
        </div>
        <div>
          <span>Prototipo Full-Stack · Innovación y Emprendimiento II · Universidad Icesi, 2026</span>
        </div>
      </footer>
    `;
  }

  function mount(root) {
    root.querySelector('[data-open-login]')?.addEventListener('click', () => {
      TCB.views.auth.openLoginModal();
    });
  }

  return { render, mount };
})();
