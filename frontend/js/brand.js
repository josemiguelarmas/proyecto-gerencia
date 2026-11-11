// Brand Identity, Icons and Real Product Photography Rendering for The Clothes Box
window.TCB = window.TCB || {};

TCB.brand = (() => {
  // NUEVO LOGO: Silueta isométrica de caja misteriosa con pliegue de sastrería y estrella de descubrimiento
  function logoSvg(size = 32) {
    return `
      <svg class="brand-symbol" viewBox="0 0 36 36" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="The Clothes Box Logo">
        <!-- Base de la caja en perspectiva -->
        <path d="M18 3 L32 10.5 L32 25.5 L18 33 L4 25.5 L4 10.5 Z" fill="#c26928" stroke="#161518" stroke-width="2" stroke-linejoin="round"/>
        <!-- Pliegues superiores (caja que se abre con la sorpresa) -->
        <path d="M18 3 L32 10.5 L18 18 L4 10.5 Z" fill="#d97a36" stroke="#161518" stroke-width="2" stroke-linejoin="round"/>
        <path d="M18 18 L18 33" stroke="#161518" stroke-width="2"/>
        <path d="M4 10.5 L18 18 L32 10.5" stroke="#161518" stroke-width="2"/>
        <!-- Pliegue de sastrería interior (cinta de apertura) -->
        <path d="M18 7 L25 10.5 L18 14 L11 10.5 Z" fill="#f5f2eb" stroke="#161518" stroke-width="1.4"/>
        <!-- Destello central de descubrimiento -->
        <circle cx="18" cy="10.5" r="2" fill="#d49746"/>
      </svg>`;
  }

  // Íconos de trazo fino funcionales (glifos de interfaz, no ropa)
  const iconPaths = {
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>',
    truck: '<rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>',
    ruler: '<path d="M2 22l14-14 6 6-14 14z"></path><path d="M7.5 10.5l2 2"></path><path d="M10.5 7.5l2 2"></path><path d="M13.5 4.5l2 2"></path>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
    refresh: '<polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>',
    return: '<polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>',
    check: '<polyline points="20 6 9 17 4 12"></polyline>',
    alert: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
    info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
    x: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
    arrowR: '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>',
    arrowL: '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>',
    sparkle: '<path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9Z"></path>',
    thumbsUp: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>',
    thumbsDown: '<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>',
    tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>'
  };

  function icon(name, size = 18) {
    const p = iconPaths[name] || iconPaths.box;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  }

  // ----------------------------------------------------
  // FOTOGRAFÍAS REALES DE PRENDAS (Requisito 1: Cero ilustraciones/emojis)
  // ----------------------------------------------------
  const DEFAULT_PHOTO = 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80';

  // Foto de respaldo cuando una imagen no carga. Es un listener delegado (no un onerror en
  // línea) porque la política de seguridad de contenido (CSP) bloquea los scripts en línea.
  document.addEventListener('error', e => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.dataset.fallbackSrc && img.src !== img.dataset.fallbackSrc) {
      img.src = img.dataset.fallbackSrc;
      delete img.dataset.fallbackSrc;
    }
  }, true);

  function garmentPhoto(product, opts = {}) {
    if (!product) return '';
    const imgUrl = product.imageUrl || product.image || DEFAULT_PHOTO;
    const name = product.name || 'Prenda de moda colombiana';
    const brand = product.brandName || product.brand || '';
    const height = opts.height || '100%';
    const aspect = opts.aspect || '4/5';

    return `
      <div class="garment-photo-container ${opts.className || ''}" style="aspect-ratio:${aspect};height:${height};position:relative;overflow:hidden;background:var(--paper-2);border-radius:var(--r-1)">
        <img 
          src="${imgUrl}" 
          alt="${name}" 
          class="garment-img" 
          loading="lazy" 
          style="width:100%;height:100%;object-fit:cover;display:block;transition:transform var(--t-med)"
          data-fallback-src="${DEFAULT_PHOTO}"
        />
        ${opts.showBrand && brand ? `
          <span class="garment-photo-brand" style="position:absolute;top:10px;left:10px;background:rgba(22,21,24,0.85);color:#fff;font-family:var(--font-mono);font-size:10px;padding:3px 8px;border-radius:2px;letter-spacing:0.05em;text-transform:uppercase">
            ${brand}
          </span>
        ` : ''}
        ${opts.showFabric && product.fabric ? `
          <span class="garment-tag" style="position:absolute;bottom:10px;left:10px;background:rgba(255,255,255,0.92);color:var(--ink);font-size:10px;font-weight:700;padding:3px 8px;border-radius:2px">
            ${product.fabric.split(' ')[0]}
          </span>
        ` : ''}
      </div>`;
  }

  // Compatibilidad hacia atrás: sustituye cualquier vector por fotografía real
  function garmentSvg(type, color, opts = {}) {
    // Si se pasa un producto completo
    if (typeof type === 'object' && type !== null) {
      return garmentPhoto(type, opts);
    }
    return garmentPhoto({ name: type || 'Prenda', color, imageUrl: opts.imageUrl || DEFAULT_PHOTO }, opts);
  }

  function garmentTile(product, opts = {}) {
    return garmentPhoto(product, { ...opts, showBrand: true, showFabric: true });
  }

  return {
    logoSvg,
    icon,
    garmentPhoto,
    garmentTile,
    garmentSvg
  };
})();
