// Box View — Caja Activa, Expectativa en Tránsito, Desempaque y Descubrimiento Individual de Prendas Reales
window.TCB = window.TCB || {};
TCB.views = TCB.views || {};

TCB.views.box = (() => {
  const { icon, logoSvg, garmentPhoto } = TCB.brand;

  function render(store) {
    const user = store.user;
    const profile = store.profile;
    const box = store.currentBox;

    if (!user) {
      return `
        <div class="screen wrap">
          <div class="banner banner--warn" style="max-width:540px;margin:var(--s-8) auto;text-align:center">
            ${icon('alert', 32)}
            <h2 style="font-size:var(--fs-xl);margin-top:8px">Acceso a Mi Caja</h2>
            <p class="muted">Debes iniciar sesión para consultar el estado de tu caja mensual.</p>
            <div style="margin-top:16px;display:flex;gap:12px;justify-content:center">
              <button type="button" class="btn btn--gold" data-login-trigger>Iniciar Sesión</button>
              <button type="button" class="btn btn--ghost" data-demo-trigger>Entrar con Demo</button>
            </div>
          </div>
        </div>
      `;
    }

    if (!box) {
      return `
        <div class="screen wrap">
          <div style="max-width:600px;margin:var(--s-8) auto;text-align:center;background:var(--sheet);border:var(--line);padding:var(--s-8)">
            ${logoSvg(48)}
            <h2 class="display" style="font-size:var(--fs-2xl);margin-top:16px">No tienes una caja activa</h2>
            <p class="muted" style="margin-top:8px">
              Configura tu perfil de estilo o solicita tu primera entrega para que nuestro motor de curaduría arme tu selección personalizada con marcas colombianas.
            </p>
            <div style="margin-top:24px;display:flex;gap:12px;justify-content:center">
              <button type="button" class="btn btn--gold" id="btn-request-first-box">Solicitar Mi Primera Caja ${icon('arrowR')}</button>
            </div>
          </div>
        </div>
      `;
    }

    const isSealed = (box.status === 'PREPARING' || box.status === 'SHIPPED');
    const isDelivered = (box.status === 'DELIVERED' || box.status === 'RATED');
    const isUnboxed = box.unboxed === true;

    return `
      <div class="screen wrap">
        <!-- HEADER DE PANTALLA -->
        <div class="screen-head">
          <div style="display:flex;align-items:center;gap:12px">
            <span class="badge badge--dark">Ciclo #${box.cycle || 1}</span>
            <span class="small mono muted">ID: ${box.id}</span>
          </div>
          <h1 class="screen-title display">Mi Caja de Ropa</h1>
          <p class="muted">
            Plan: <strong>${box.plan === 'estilo' || box.plan === 'STYLE' ? 'Plan Estilo (5 prendas)' : 'Plan Esencial (3 prendas)'}</strong> · Destino: <strong>${box.address || profile?.address || 'Cali, Colombia'}</strong>
          </p>
        </div>

        <!-- CONTROLADOR DE SIMULACIÓN DE DEMOSTRACIÓN (Siempre disponible para evaluar el flujo) -->
        <div class="demo-controller">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--brand-box);color:#fff;display:grid;place-items:center">
              ${icon('truck', 18)}
            </div>
            <div>
              <p style="font-weight:700;font-size:var(--fs-sm)">Controlador de Demostración Evaluativa</p>
              <p class="small muted">
                Estado backend actual: <span class="mono" style="font-weight:700;color:var(--brand-box)">${box.status}</span>
                ${isDelivered ? (isUnboxed ? ' · Desempacada (Prendas descubiertas)' : ' · En tu puerta (Sellada)') : ' · En camino (Prendas protegidas)'}
              </p>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button type="button" class="btn btn--sm btn--gold" id="btn-simulate-step">
              ${icon('refresh', 14)} Simular avance de envío (Backend)
            </button>
            <button type="button" class="btn btn--sm btn--ghost" id="btn-request-next-box" title="Genera un nuevo ciclo evitando prendas ya recibidas">
              ${icon('sparkle', 14)} Siguiente ciclo
            </button>
          </div>
        </div>

        <!-- 1. EXPERIENCIA DE EXPECTATIVA: CAJA EN PREPARACIÓN O ENVÍO -->
        ${isSealed ? renderSealedState(box) : ''}

        <!-- 2. MOMENTO DE LLEGADA A DOMICILIO (SELLADA) -->
        ${isDelivered && !isUnboxed ? renderDeliveredAwaitingUnbox(box) : ''}

        <!-- 3. EXPERIENCIA DE DESCUBRIMIENTO: PRENDAS REALES RECIBIDAS -->
        ${isDelivered && isUnboxed ? renderRevealedBox(box, profile) : ''}
      </div>
    `;
  }

  // ESTADO 1: CAJA EN PREPARACIÓN O EN CAMINO (SELLADA - REGLA DE SORPRESA ABSOLUTA)
  function renderSealedState(box) {
    const isPrep = box.status === 'PREPARING';
    const isShip = box.status === 'SHIPPED';

    return `
      <section class="sealed-box-hero" aria-label="Caja Sellada">
        <div class="sealed-badge">
          ${icon('sparkle', 14)} Contenido confidencial y protegido
        </div>

        <div class="box-illustration-wrap">
          ${logoSvg(96)}
        </div>

        <h2 class="display" style="font-size:clamp(var(--fs-2xl), 4vw, var(--fs-4xl))">
          ${isPrep ? 'Tu caja se está preparando en Cali' : 'Tu caja va en camino a tu puerta'}
        </h2>
        <p class="muted" style="max-width:540px;margin:var(--s-3) auto 0;font-size:var(--fs-base)">
          ${isPrep 
            ? 'Nuestro equipo está empaquetando prendas de marcas locales independientes (Ceiba Estudio, Mono Textil, Taller Norte) calibradas a tus medidas. Las prendas son sorpresa hasta que recibas la caja.'
            : 'El transportador ya tiene tu caja sellada. La sorpresa se mantendrá intacta hasta que abras el paquete en tu domicilio.'
          }
        </p>

        <!-- LÍNEA DE SEGUIMIENTO REAL -->
        <div class="tracking-bar" style="margin-top:var(--s-6)">
          <div class="tracking-node is-done">
            <p class="mono small">01</p>
            <p>Curaduría y patronaje</p>
          </div>
          <div class="tracking-node ${isPrep ? 'is-current' : 'is-done'}">
            <p class="mono small">02</p>
            <p>Empaque y sellado</p>
          </div>
          <div class="tracking-node ${isShip ? 'is-current' : ''}">
            <p class="mono small">03</p>
            <p>Reparto en Cali</p>
          </div>
        </div>

        <!-- DETALLES DE GUÍA -->
        <div style="display:inline-flex;gap:24px;background:var(--paper-2);border:var(--hair);padding:14px 24px;border-radius:var(--r-1);margin-top:var(--s-5);text-align:left;flex-wrap:wrap">
          <div>
            <p class="small muted">Guía de rastreo</p>
            <p class="mono" style="font-weight:700">${box.trackingNumber || 'TCB-CALI-7829-X'}</p>
          </div>
          <div>
            <p class="small muted">Prendas incluidas</p>
            <p style="font-weight:600">${box.itemsCount || 3} prendas seleccionadas</p>
          </div>
          <div>
            <p class="small muted">Entrega estimada</p>
            <p style="font-weight:600">${box.estimatedDelivery || 'Hoy antes de las 6:00 PM'}</p>
          </div>
        </div>

        <div style="margin-top:var(--s-6)">
          <p class="small muted">
            ¿Quieres probar qué ocurre al entregar? Haz clic arriba en <strong>"Simular avance de envío (Backend)"</strong>.
          </p>
        </div>
      </section>
    `;
  }

  // ESTADO 2: CAJA ENTREGADA A LA PUERTA (RITUAL DE APERTURA)
  function renderDeliveredAwaitingUnbox(box) {
    return `
      <section class="sealed-box-hero" style="border:3px solid var(--brand-box);background:linear-gradient(180deg, var(--paper-2) 0%, var(--sheet) 100%)">
        <div class="sealed-badge" style="background:var(--brand-box);color:#fff">
          ${icon('check', 14)} Paquete entregado en Cali
        </div>

        <div class="box-illustration-wrap" style="border-color:var(--brand-box);animation:pulse 2s infinite ease-in-out">
          ${logoSvg(96)}
        </div>

        <h2 class="display" style="font-size:clamp(var(--fs-2xl), 4vw, var(--fs-4xl))">
          ¡Tu caja acaba de llegar!
        </h2>
        <p class="muted" style="max-width:520px;margin:var(--s-3) auto 0;font-size:var(--fs-base)">
          Rompe el precinto de seguridad para descubrir las prendas reales que nuestro equipo seleccionó para ti este mes.
        </p>

        <div style="margin-top:var(--s-6)">
          <button type="button" class="btn btn--gold btn--lg" id="btn-unbox" style="font-size:var(--fs-lg);padding:18px 36px">
            ${icon('sparkle')} Abrir y descubrir mis prendas ${icon('arrowR')}
          </button>
        </div>
      </section>
    `;
  }

  // ESTADO 3: CAJA ENTREGADA Y DESEMPACADA (PROTAGONISMO TOTAL A LAS PRENDAS REALES)
  function renderRevealedBox(box, profile) {
    const items = box.items || [];

    return `
      <!-- BANNER DE CELEBRACIÓN Y DESCUBRIMIENTO -->
      <div class="unboxing-celebration" style="background:var(--paper-2);border-left:4px solid var(--brand-box);text-align:left;padding:24px 28px;margin-bottom:var(--s-6)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div>
            <span class="badge badge--accent">${icon('sparkle', 14)} Entrega Revelada</span>
            <h2 class="display" style="margin-top:6px;font-size:var(--fs-2xl)">Descubre tus prendas del Ciclo #${box.cycle || 1}</h2>
            <p class="muted" style="max-width:680px;margin-top:4px">
              Examina cada prenda en detalle, prueba su calce e indícanos tu opinión. Tu valoración ayuda a calibrar tu estilo para la próxima entrega sin generar devoluciones.
            </p>
          </div>
          <div style="text-align:right">
            <span class="mono small muted">Entregada: ${box.deliveredAt ? new Date(box.deliveredAt).toLocaleDateString('es-CO') : 'Hoy'}</span>
            <div><a href="#/devoluciones" class="small" style="font-weight:700;color:var(--brand-box);text-decoration:underline">¿Problema de talla? Solicitar cambio gratis</a></div>
          </div>
        </div>
      </div>

      <!-- SECCIÓN PRINCIPAL: PRENDAS INDIVIDUALES RECIBIDAS (CON FOTOGRAFÍAS REALES) -->
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--s-4);flex-wrap:wrap;gap:12px">
        <h3 class="display" style="font-size:var(--fs-2xl)">Prendas recibidas en tu caja (${items.length})</h3>
        <p class="small muted">Haz clic en <strong>"Valorar prenda"</strong> para registrar tu feedback o en <strong>"Cambio de talla"</strong> si no te queda bien.</p>
      </div>

      <div class="items-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:24px">
        ${items.map(item => renderGarmentCard(item, box)).join('')}
      </div>

      <!-- SECCIÓN SECUNDARIA: IDEAS DE COMBINACIÓN Y OUTFITS (FUNCIONALIDAD ADICIONAL) -->
      <section style="margin-top:var(--s-8);background:var(--sheet);border:var(--line);padding:var(--s-6)">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:var(--s-4)">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--ink);color:var(--paper);display:grid;place-items:center">
            ${icon('sparkle', 16)}
          </div>
          <div>
            <h3 class="display" style="font-size:var(--fs-xl)">Ideas de Combinación con tu Clóset</h3>
            <p class="small muted">Sugerencias para integrar estas prendas con básicos que ya tienes en casa</p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:20px">
          <div style="background:var(--paper-2);border:var(--hair);padding:18px;border-radius:var(--r-1)">
            <span class="badge badge--dark">Outfit 01 · Urbano Diario</span>
            <h4 style="font-weight:700;margin-top:8px">${items[0]?.name || 'Prenda superior'} + Jeans neutros</h4>
            <p class="small muted" style="margin-top:6px">
              Silueta relajada combinada con zapatillas limpias. Ideal para una jornada en campus universitario o café de trabajo en Granada.
            </p>
          </div>
          <div style="background:var(--paper-2);border:var(--hair);padding:18px;border-radius:var(--r-1)">
            <span class="badge badge--dark">Outfit 02 · Tarde / Clima Cálido</span>
            <h4 style="font-weight:700;margin-top:8px">${items[1]?.name || 'Prenda inferior'} + Camiseta básica cruda</h4>
            <p class="small muted" style="margin-top:6px">
              Corte amplio y textil transpirable para la brisa de la tarde en Cali. Acompáñalo con sandalias o calzado ligero.
            </p>
          </div>
          <div style="background:var(--paper-2);border:var(--hair);padding:18px;border-radius:var(--r-1)">
            <span class="badge badge--dark">Outfit 03 · Salida Nocturna</span>
            <h4 style="font-weight:700;margin-top:8px">${items[2]?.name || 'Tercera pieza'} + Capas monocromáticas</h4>
            <p class="small muted" style="margin-top:6px">
              Presencia contemporánea sin esfuerzo combinando texturas de sastrería y denim estructurado.
            </p>
          </div>
        </div>
      </section>
    `;
  }

  // Render individual de cada prenda con su fotografía real e información técnica
  function renderGarmentCard(item, box) {
    const fit = item.fit || {};
    const size = fit.size || item.size || 'M';
    const matchPct = fit.matchPct || 96;
    const userRating = item.userRating;

    return `
      <article class="item-card" data-item-id="${item.id}" style="background:var(--sheet);border:var(--line);border-radius:var(--r-1);overflow:hidden;display:flex;flex-direction:column">
        <!-- FOTOGRAFÍA REAL DEL PRODUCTO (Requisito 1: Cero ilustraciones) -->
        <div style="height:260px;position:relative;background:#f0ece1">
          <img 
            src="${item.imageUrl}" 
            alt="${item.name}" 
            style="width:100%;height:100%;object-fit:cover;display:block" 
            loading="lazy"
          />
          <span style="position:absolute;top:12px;left:12px;background:rgba(22,21,24,0.85);color:#fff;font-family:var(--font-mono);font-size:11px;padding:3px 10px;border-radius:2px;letter-spacing:0.05em">
            ${item.brandName || item.brandCity || 'Marca Local'}
          </span>
          <span class="item-size-badge" style="position:absolute;bottom:12px;right:12px;box-shadow:var(--lift)" title="Talla calibrada">
            Talla ${size}
          </span>
        </div>

        <div style="padding:20px;flex:1;display:flex;flex-direction:column;gap:14px">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <span class="small mono muted">${item.category ? item.category.toUpperCase() : 'PRENDA'} · ${item.colorName || item.color}</span>
              <span class="mono" style="font-weight:700;font-size:var(--fs-sm)">$${Number(item.priceCOP || 89000).toLocaleString('es-CO')}</span>
            </div>
            <h4 style="font-size:var(--fs-lg);font-weight:700;margin-top:4px">${item.name}</h4>
          </div>

          <p class="small muted" style="line-height:1.5">
            ${item.story || 'Confección nacional con acabados de alta resistencia.'}
          </p>

          <div style="background:var(--paper-2);padding:10px 14px;border:var(--hair);border-radius:var(--r-1);font-size:var(--fs-xs);display:grid;gap:4px">
            <div><strong>Tejido:</strong> ${item.fabric}</div>
            <div><strong>Corte:</strong> ${item.fit?.levelText ? `${item.fit.levelText} (${item.fit.fit || 'Regular'})` : (item.fit || 'Regular')}</div>
            <div style="display:flex;justify-content:space-between">
              <span><strong>Ajuste previsto:</strong> <span style="color:var(--brand-box);font-weight:700">${matchPct}%</span></span>
              ${fit.brandAlert ? `<span class="mono text-warn">${fit.brandAlert}</span>` : ''}
            </div>
          </div>

          <!-- ESTADO DE FEEDBACK INDIVIDUAL -->
          <div style="border-top:var(--hair);padding-top:12px;margin-top:auto">
            ${userRating ? `
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span class="badge badge--accent" style="font-size:11px">
                  ${icon('star', 12)} ${userRating.fitScore ? `Ajuste ${userRating.fitScore}/5` : ''}${userRating.fitScore && userRating.styleScore ? ' · ' : ''}${userRating.styleScore ? `Estilo ${userRating.styleScore}/5` : ''}${!userRating.fitScore && !userRating.styleScore ? `${userRating.score}/5` : ''} ${userRating.liked ? '· Te gustó' : '· No es tu estilo'}
                </span>
                <span class="small muted" style="font-size:11px">Feedback registrado</span>
              </div>
            ` : `
              <p class="small muted" style="margin-bottom:8px;font-size:11px">Aún no has valorado esta prenda.</p>
            `}

            <div style="display:flex;gap:8px">
              <button 
                type="button" 
                class="btn btn--sm btn--block ${userRating ? 'btn--ghost' : 'btn--gold'}" 
                data-open-item-feedback='${JSON.stringify({ ...item, boxId: box.id, size }).replace(/'/g, "&apos;")}'
              >
                ${icon('sparkle', 14)} ${userRating ? 'Modificar feedback' : 'Valorar prenda'}
              </button>
              <a 
                href="#/devoluciones?item=${item.id}" 
                class="btn btn--quiet btn--sm" 
                title="Si no te queda la talla, solicita cambio sin costo"
                style="color:var(--brand-box);font-size:12px;white-space:nowrap"
              >
                ${icon('return', 13)} Cambio talla
              </a>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  // MODAL DE VALORACIÓN INDIVIDUAL DE PRENDA (Requisito 4)
  function openItemFeedbackModal(item, onCompleted) {
    const existingRating = item.userRating || {};

    TCB.state.modal({
      eyebrow: 'Descubrimiento y Valoración',
      title: item.name,
      body: `
        <div class="stack" style="--stack:18px">
          <!-- Tarjeta de la prenda con foto real -->
          <div style="display:grid;grid-template-columns:100px 1fr;gap:16px;background:var(--paper-2);padding:12px;border:var(--hair);border-radius:var(--r-1);align-items:center">
            <div style="height:110px;border-radius:var(--r-1);overflow:hidden">
              <img src="${item.imageUrl}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover" />
            </div>
            <div>
              <span class="badge badge--dark" style="font-size:10px">${item.brandName || item.brandCity || 'Marca Local'}</span>
              <h4 style="font-weight:700;font-size:var(--fs-base);margin-top:4px">${item.name}</h4>
              <p class="small muted">Talla entregada: <strong>${item.size || 'M'}</strong> · Color: ${item.colorName || item.color}</p>
              <p class="mono small" style="margin-top:2px;font-weight:600">$${Number(item.priceCOP || 89000).toLocaleString('es-CO')}</p>
            </div>
          </div>

          <!-- AVISO POLÍTICA: FEEDBACK vs DEVOLUCIÓN -->
          <div class="banner banner--info" style="font-size:var(--fs-xs);padding:10px 14px">
            ${icon('info', 16)}
            <div>
              <strong>Tu feedback calibra tu estilista:</strong> Indicar que no te gusta o que prefieres otro color ayuda a personalizar futuras cajas. No genera devolución automática. (Los cambios son exclusivos por problemas de talla).
            </div>
          </div>

          <form id="item-feedback-form" class="stack" style="--stack:16px" novalidate>
            <!-- ¿Te gustó? -->
            <div>
              <label style="font-weight:700;font-size:var(--fs-sm);display:block;margin-bottom:8px">¿Qué te pareció el estilo de esta prenda?</label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <label class="btn btn--ghost" style="cursor:pointer;justify-content:flex-start;font-size:var(--fs-sm)">
                  <input type="radio" name="liked" value="true" ${existingRating.liked !== false ? 'checked' : ''} style="margin-right:8px">
                  ${icon('thumbsUp', 16)} Me gustó
                </label>
                <label class="btn btn--ghost" style="cursor:pointer;justify-content:flex-start;font-size:var(--fs-sm)">
                  <input type="radio" name="liked" value="false" ${existingRating.liked === false ? 'checked' : ''} style="margin-right:8px">
                  ${icon('thumbsDown', 16)} No es mi estilo
                </label>
              </div>
            </div>

            <!-- HU-10: ajuste y estilo se califican por separado; se puede dejar uno sin calificar -->
            ${[['fitScore', 'Ajuste de la talla'], ['styleScore', 'Estilo de la prenda']].map(([name, label]) => `
              <div class="field">
                <label for="fb-${name}">${label} (1 a 5 estrellas)</label>
                <select class="input" id="fb-${name}" name="${name}">
                  <option value="">Sin calificar por ahora</option>
                  ${[5, 4, 3, 2, 1].map(n => `
                    <option value="${n}" ${existingRating[name] === n ? 'selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5 - n)} ${n}/5</option>
                  `).join('')}
                </select>
              </div>
            `).join('')}
            <p class="error small" id="fb-error" role="alert"></p>

            <!-- Etiquetas rápidas de preferencia -->
            <div class="field">
              <label for="fb-style">Preferencia para próximas entregas</label>
              <select class="input" id="fb-style" name="styleFeedback">
                <option value="Excelente elección, más como esta" selected>Excelente elección, más como esta</option>
                <option value="Prefiero colores más neutros o tierra">Prefiero colores más neutros o tierra</option>
                <option value="Prefiero cortes más holgados">Prefiero cortes más holgados</option>
                <option value="Demasiado formal para mi día a día">Demasiado formal para mi día a día</option>
                <option value="Prefiero menos prendas con botones">Prefiero menos prendas con botones</option>
              </select>
            </div>

            <!-- Notas al estilista -->
            <div class="field">
              <label for="fb-notes">Notas para tu estilista personal (opcional)</label>
              <textarea class="input" id="fb-notes" name="preferenceNotes" rows="2" placeholder="Ej: La tela de algodón peinado es genial, pero prefiero camisetas con cuello menos cerrado...">${existingRating.preferenceNotes || existingRating.feedback || ''}</textarea>
            </div>

            <button type="submit" class="btn btn--gold btn--block" style="margin-top:6px">
              ${icon('check')} Guardar Valoración y Afinar Algoritmo
            </button>
          </form>
        </div>
      `,
      onMount(modalEl, close) {
        const form = modalEl.querySelector('#item-feedback-form');
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const liked = form.liked.value === 'true';
          const fitScore = form.fitScore.value ? Number(form.fitScore.value) : undefined;
          const styleScore = form.styleScore.value ? Number(form.styleScore.value) : undefined;
          if (fitScore === undefined && styleScore === undefined) {
            modalEl.querySelector('#fb-error').textContent = 'Califica al menos el ajuste o el estilo.';
            return;
          }
          const styleFeedback = form.styleFeedback.value;
          const preferenceNotes = form.preferenceNotes.value.trim();

          try {
            await TCB.api.boxes.itemFeedback(item.boxId, {
              productId: item.id,
              liked,
              fitScore,
              styleScore,
              styleFeedback,
              preferenceNotes
            });

            close();
            TCB.state.toast('Valoración guardada. Tu feedback calibra tu perfil para futuras cajas.');
            if (onCompleted) onCompleted();
          } catch (err) {
            TCB.state.toast(err.message || 'Error al guardar valoración', { type: 'danger' });
          }
        });
      }
    });
  }

  function mount(root) {
    // Iniciar sesión desde banner
    root.querySelector('[data-login-trigger]')?.addEventListener('click', () => {
      TCB.views.auth.openLoginModal();
    });

    root.querySelector('[data-demo-trigger]')?.addEventListener('click', async () => {
      try {
        await TCB.api.auth.login('demo@theclothesbox.co', 'demo123');
        await TCB.state.loadUserSession();
        TCB.state.toast('Sesión demo iniciada.');
        window.location.hash = '#/caja';
      } catch (e) {
        TCB.state.toast('Error al entrar con demo', { type: 'danger' });
      }
    });

    // Solicitar primera caja
    root.querySelector('#btn-request-first-box')?.addEventListener('click', async () => {
      try {
        await TCB.api.boxes.next();
        await TCB.state.loadUserSession();
        TCB.state.toast('¡Tu primera caja ha sido creada exitosamente!');
      } catch (e) {
        TCB.state.toast(e.message || 'Error al crear caja', { type: 'danger' });
      }
    });

    // Simular avance de envío (Backend step)
    root.querySelector('#btn-simulate-step')?.addEventListener('click', async () => {
      try {
        const res = await TCB.api.boxes.simulateStep();
        await TCB.state.loadUserSession();
        TCB.state.toast(res.message || 'Estado de envío actualizado.');
      } catch (e) {
        TCB.state.toast(e.message || 'Error al simular envío', { type: 'danger' });
      }
    });

    // Solicitar siguiente ciclo
    root.querySelector('#btn-request-next-box')?.addEventListener('click', async () => {
      try {
        const res = await TCB.api.boxes.next();
        await TCB.state.loadUserSession();
        TCB.state.toast(res.message || 'Nuevo ciclo generado con nuevas prendas.');
      } catch (e) {
        TCB.state.toast(e.message || 'Error al generar siguiente ciclo', { type: 'danger' });
      }
    });

    // Romper sello y abrir caja (Unboxing)
    root.querySelector('#btn-unbox')?.addEventListener('click', async () => {
      const box = TCB.state.get().currentBox;
      if (!box) return;

      try {
        await TCB.api.boxes.unbox(box.id);
        await TCB.state.loadUserSession();
        TCB.state.toast('✨ ¡Caja abierta! Tu selección exclusiva ha sido revelada.');
      } catch (e) {
        TCB.state.toast(e.message || 'Error al abrir caja', { type: 'danger' });
      }
    });

    // Botones para abrir modal de valoración individual de prenda
    root.querySelectorAll('[data-open-item-feedback]').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          const item = JSON.parse(btn.getAttribute('data-open-item-feedback'));
          openItemFeedbackModal(item, async () => {
            await TCB.state.loadUserSession();
            // Re-render
            const container = document.getElementById('app-view');
            if (container) {
              container.innerHTML = render(TCB.state.get());
              mount(container);
            }
          });
        } catch (e) {
          console.error('Error opening feedback modal:', e);
        }
      });
    });
  }

  return { render, mount };
})();
