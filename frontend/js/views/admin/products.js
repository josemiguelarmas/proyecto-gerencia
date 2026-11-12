// Admin tab "Catálogo & Fotografías" (HU-05): the product grid with wholesale price and
// available units per variant, the product form to create and edit products and their
// variants (SCRUM-40), soft delete and restore, and the catalog CSV import with its
// row/field error report (SCRUM-39). The form vocabulary comes from GET /api/admin/catalog/vocab.
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.products = (() => {
  const { cop } = TCB.adminFormat;

  // State kept across rerenders: which product the form edits ('new', an id or null),
  // the vocabulary once loaded, and the last field errors returned by the API.
  let editing = null;
  let vocab = null;
  let formErrors = [];

  // Text coming from CSV files or forms is escaped before it goes into innerHTML.
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const available = v => Math.max(0, (v.stock || 0) - (v.reserved || 0));
  const LINE_LABELS = { u: 'Unisex', m: 'Masculina', f: 'Femenina' };

  function renderImportReport(res) {
    const errors = res.errors || [];
    return `
      ${res.error ? `<p class="small error">${esc(res.error)}</p>` : ''}
      <p class="small"><strong>${res.imported || 0}</strong> variantes nuevas · <strong>${res.updated || 0}</strong> actualizadas · <strong>${errors.length}</strong> errores${res.createdProducts ? ` · ${res.createdProducts.length} prendas nuevas` : ''}</p>
      ${res.ignoredColumns && res.ignoredColumns.length ? `<p class="small muted">Columnas ignoradas: ${esc(res.ignoredColumns.join(', '))}</p>` : ''}
      ${errors.length ? `
        <table class="returns-history-table" style="margin-top:8px">
          <thead><tr><th>Fila</th><th>Campo</th><th>Problema</th></tr></thead>
          <tbody>${errors.map(e => `<tr><td class="mono">${esc(e.row)}</td><td class="mono">${esc(e.field || 'fila completa')}</td><td>${esc(e.message)}</td></tr>`).join('')}</tbody>
        </table>
      ` : ''}
    `;
  }

  function options(list, selected, label = x => x) {
    return list.map(x => `<option value="${esc(x)}" ${x === selected ? 'selected' : ''}>${esc(label(x))}</option>`).join('');
  }

  function checkboxes(name, list, checked) {
    return list.map(x => `
      <label class="chip" style="cursor:pointer">
        <input type="checkbox" name="${name}" value="${esc(x)}" ${checked.includes(x) ? 'checked' : ''}> ${esc(x)}
      </label>`).join('');
  }

  function variantRow(v, isNew) {
    return `
      <tr data-variant="${isNew ? 'new' : esc(v.sku)}">
        <td>${isNew ? `<input class="input mono" name="sku" placeholder="Automático" value="${esc(v.sku || '')}" style="min-width:110px">` : `<span class="mono small">${esc(v.sku)}</span>`}</td>
        <td>${isNew ? `<select class="select" name="size">${options(vocab.sizes, v.size)}</select>` : esc(v.size)}</td>
        <td>${isNew ? `<input class="input" name="color" value="${esc(v.color || '')}" style="min-width:100px">` : esc(v.color)}</td>
        <td><input class="input num" name="stock" type="number" min="${v.reserved || 0}" step="1" value="${v.stock ?? 0}" style="width:80px"></td>
        <td class="mono small">${isNew ? '0' : `${v.reserved} · disp. ${available(v)}`}</td>
      </tr>`;
  }

  function renderForm(product) {
    const p = product || { styles: [], occasions: [], variants: [], fit: 'regular', line: 'u', category: vocab.categories[0] };
    const errorList = formErrors.length
      ? `<ul class="small error" style="margin:8px 0 0 16px">${formErrors.map(e => `<li>${esc(e.field ? `${e.field}: ` : '')}${esc(e.message)}</li>`).join('')}</ul>`
      : '';
    return `
      <section id="product-form" style="background:var(--sheet);border:var(--line);padding:18px;margin-bottom:20px;border-radius:var(--r-1)">
        <h3 style="font-weight:700">${product ? `Editar ${esc(p.name)}` : 'Nueva prenda'}</h3>
        ${errorList}
        <form id="product-edit" class="grid" style="--cols:repeat(auto-fit, minmax(220px, 1fr));gap:12px;margin-top:12px">
          <div class="field"><label for="pf-name">Nombre</label><input class="input" id="pf-name" name="name" value="${esc(p.name || '')}" required maxlength="120"></div>
          <div class="field"><label for="pf-brand">Marca aliada</label><input class="input" id="pf-brand" name="brandName" value="${esc(p.brandName || '')}" required maxlength="80"></div>
          <div class="field"><label for="pf-city">Ciudad de la marca</label><input class="input" id="pf-city" name="brandCity" value="${esc(p.brandCity || '')}" maxlength="80"></div>
          <div class="field"><label for="pf-category">Categoría</label><select class="select" id="pf-category" name="category">${options(vocab.categories, p.category)}</select></div>
          <div class="field"><label for="pf-type">Tipo</label><input class="input" id="pf-type" name="type" value="${esc(p.type || '')}" maxlength="60" placeholder="camisa, jean, chaqueta..."></div>
          <div class="field"><label for="pf-fit">Corte</label><select class="select" id="pf-fit" name="fit">${options(vocab.fits, p.fit)}</select></div>
          <div class="field"><label for="pf-line">Línea</label><select class="select" id="pf-line" name="line">${options(['u', 'm', 'f'], p.line, x => LINE_LABELS[x])}</select></div>
          <div class="field"><label for="pf-price">Precio de venta (COP)</label><input class="input num" id="pf-price" name="priceCOP" type="number" min="1" step="1" value="${p.priceCOP || ''}" required></div>
          <div class="field"><label for="pf-wholesale">Precio mayorista (COP)</label><input class="input num" id="pf-wholesale" name="wholesalePriceCOP" type="number" min="1" step="1" value="${p.wholesalePriceCOP || ''}" required></div>
          <div class="field" style="grid-column:1 / -1"><label for="pf-image">URL de la fotografía oficial</label><input class="input" id="pf-image" name="imageUrl" type="url" value="${esc(p.imageUrl || '')}" required></div>
          <div class="field" style="grid-column:1 / -1"><label for="pf-fabric">Tejido</label><input class="input" id="pf-fabric" name="fabric" value="${esc(p.fabric || '')}" maxlength="200"></div>
          <div class="field" style="grid-column:1 / -1"><label for="pf-story">Historia de la prenda</label><textarea class="textarea" id="pf-story" name="story" rows="2" maxlength="500">${esc(p.story || '')}</textarea></div>
          <div class="field" style="grid-column:1 / -1"><span class="field-label">Estilos</span><div style="display:flex;flex-wrap:wrap;gap:6px">${checkboxes('styles', vocab.styles, p.styles)}</div></div>
          <div class="field" style="grid-column:1 / -1"><span class="field-label">Ocasiones</span><div style="display:flex;flex-wrap:wrap;gap:6px">${checkboxes('occasions', vocab.occasions, p.occasions)}</div></div>
          <div class="field" style="grid-column:1 / -1;overflow-x:auto">
            <span class="field-label">Variantes (talla y color)</span>
            <table class="returns-history-table" style="margin-top:6px">
              <thead><tr><th>SKU</th><th>Talla</th><th>Color</th><th>Stock</th><th>Reservado</th></tr></thead>
              <tbody id="pf-variants">${p.variants.map(v => variantRow(v, false)).join('')}${product ? '' : variantRow({ size: 'M' }, true)}</tbody>
            </table>
            <button type="button" class="btn btn--ghost btn--sm" id="pf-add-variant" style="margin-top:8px">Agregar variante</button>
          </div>
          <div style="grid-column:1 / -1;display:flex;gap:10px;flex-wrap:wrap">
            <button type="submit" class="btn btn--gold btn--sm">${product ? 'Guardar cambios' : 'Crear prenda'}</button>
            <button type="button" class="btn btn--quiet btn--sm" id="pf-cancel">Cancelar</button>
          </div>
        </form>
      </section>
    `;
  }

  function renderCard(p) {
    const deleted = Boolean(p.deletedAt);
    return `
      <div style="background:var(--sheet);border:var(--line);border-radius:var(--r-1);overflow:hidden;display:flex;flex-direction:column;${deleted ? 'opacity:0.55' : ''}">
        <div style="height:220px;position:relative">
          <img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover" />
          <span style="position:absolute;top:10px;left:10px;background:rgba(22,21,24,0.85);color:#fff;font-family:var(--font-mono);font-size:10px;padding:3px 8px;border-radius:2px">
            ${esc(p.brandName)}${p.brandCity ? ` (${esc(p.brandCity)})` : ''}
          </span>
          ${deleted ? '<span class="chip chip--danger" style="position:absolute;top:10px;right:10px">Eliminada</span>' : ''}
          <span style="position:absolute;bottom:10px;right:10px;background:var(--paper-2);font-weight:700;font-family:var(--font-mono);font-size:11px;padding:3px 8px;border:1px solid var(--ink)">
            ${cop(p.priceCOP)}
          </span>
        </div>
        <div style="padding:16px;flex:1;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span class="small mono muted">${esc(p.category.toUpperCase())} · ${esc(p.type)}</span>
            <span class="small" style="font-weight:600">${esc(p.colorName || p.color)}</span>
          </div>
          <h4 style="font-weight:700;font-size:var(--fs-base)">${esc(p.name)}</h4>
          <p class="small muted" style="font-size:12px;line-height:1.4">${esc(p.story || '')}</p>
          <div style="background:var(--paper-2);padding:6px 10px;border-radius:var(--r-1);font-size:11px;margin-top:auto;display:grid;gap:4px">
            <span><strong>Tejido:</strong> ${esc(p.fabric)}</span>
            <span><strong>Mayorista:</strong> ${cop(p.wholesalePriceCOP)}${p.wholesaleEstimated ? ' (estimado)' : ''}</span>
            <span><strong>Disponible:</strong> ${(p.variants || []).map(v => `<span class="mono" title="${esc(v.sku)} · stock ${v.stock} · reservado ${v.reserved}" style="${available(v) === 0 ? 'color:var(--danger)' : ''}">${esc(v.size)} ${available(v)}</span>`).join(' · ')}</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${deleted
              ? `<button type="button" class="btn btn--ghost btn--sm" data-restore="${esc(p.id)}">Restaurar</button>`
              : `<button type="button" class="btn btn--ghost btn--sm" data-edit="${esc(p.id)}">Editar</button>
                 <button type="button" class="btn btn--quiet btn--sm" data-delete="${esc(p.id)}">Eliminar</button>`}
          </div>
        </div>
      </div>`;
  }

  function renderProductsTab(products) {
    const active = products.filter(p => !p.deletedAt).length;
    const editingProduct = editing && editing !== 'new' ? products.find(p => p.id === editing) : null;
    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:10px;margin-bottom:16px">
          <div>
            <h2 class="display" style="font-size:var(--fs-xl)">Catálogo de marcas aliadas (${active} activas${products.length > active ? `, ${products.length - active} eliminadas` : ''})</h2>
            <p class="small muted">Disponible = stock menos unidades reservadas para cajas aprobadas. Las prendas eliminadas no se ofrecen a nadie.</p>
          </div>
          <button type="button" class="btn btn--gold btn--sm" id="btn-new-product">Nueva prenda</button>
        </div>

        ${editing && vocab ? renderForm(editingProduct) : ''}

        <section style="background:var(--sheet);border:var(--line);padding:18px;margin-bottom:20px;border-radius:var(--r-1)">
          <h3 style="font-weight:700">Importar catálogo (CSV)</h3>
          <p class="small muted" style="margin-top:4px">
            Una fila por variante (talla y color). Columnas obligatorias: marca, nombre, categoria, estilo, ocasion, talla, color, precio_mayorista, stock.
            Opcionales: sku, precio_venta, ciudad, tipo, corte, tejido, linea, imagen_url. Si el sku ya existe, la fila actualiza esa variante.
            Varios estilos u ocasiones se separan con |. <a href="/docs/ejemplo_catalogo.csv" download>Descargar ejemplo</a>
          </p>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px">
            <input type="file" id="csv-file" accept=".csv,text/csv" class="input" style="width:auto;max-width:100%">
            <button type="button" class="btn btn--gold btn--sm" id="btn-import-csv">Importar</button>
          </div>
          <div id="import-report" style="margin-top:12px"></div>
        </section>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:20px">
          ${products.map(renderCard).join('')}
        </div>
      </div>
    `;
  }

  // Reads the form into the API payload: existing variants send sku and stock, new rows send
  // size, color, stock and an optional sku.
  function readForm(form) {
    const data = Object.fromEntries(['name', 'brandName', 'brandCity', 'category', 'type', 'fit', 'line', 'imageUrl', 'fabric', 'story']
      .map(k => [k, form.elements[k].value]));
    data.priceCOP = Number(form.elements.priceCOP.value);
    data.wholesalePriceCOP = Number(form.elements.wholesalePriceCOP.value);
    data.styles = [...form.querySelectorAll('input[name="styles"]:checked')].map(i => i.value);
    data.occasions = [...form.querySelectorAll('input[name="occasions"]:checked')].map(i => i.value);
    data.variants = [...form.querySelectorAll('#pf-variants tr')].map(row => {
      const stock = Number(row.querySelector('[name="stock"]').value);
      if (row.dataset.variant !== 'new') return { sku: row.dataset.variant, stock };
      return { sku: row.querySelector('[name="sku"]').value.trim() || undefined, size: row.querySelector('[name="size"]').value, color: row.querySelector('[name="color"]').value, stock };
    });
    return data;
  }

  async function openForm(ctx, target) {
    try {
      vocab = vocab || await TCB.api.admin.catalogVocab();
      editing = target;
      formErrors = [];
      ctx.rerender();
      document.querySelector('#product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      alert(e.message);
    }
  }

  function mount(root, ctx) {
    root.querySelector('#btn-new-product')?.addEventListener('click', () => openForm(ctx, 'new'));
    root.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openForm(ctx, btn.dataset.edit)));

    root.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta prenda del catálogo? Dejará de ofrecerse, pero su historial se conserva y puedes restaurarla.')) return;
      try {
        await TCB.api.admin.deleteProduct(btn.dataset.delete);
        await ctx.loadAdminData();
        ctx.rerender();
      } catch (e) {
        alert(e.message);
      }
    }));

    root.querySelectorAll('[data-restore]').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await TCB.api.admin.restoreProduct(btn.dataset.restore);
        await ctx.loadAdminData();
        ctx.rerender();
      } catch (e) {
        alert(e.message);
      }
    }));

    root.querySelector('#pf-cancel')?.addEventListener('click', () => {
      editing = null;
      formErrors = [];
      ctx.rerender();
    });

    root.querySelector('#pf-add-variant')?.addEventListener('click', () => {
      root.querySelector('#pf-variants').insertAdjacentHTML('beforeend', variantRow({ size: 'M' }, true));
    });

    root.querySelector('#product-edit')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const data = readForm(ev.target);
      try {
        if (editing === 'new') await TCB.api.admin.saveProduct(data);
        else await TCB.api.admin.updateProduct(editing, data);
        editing = null;
        formErrors = [];
        await ctx.loadAdminData();
      } catch (e) {
        formErrors = (e.data && e.data.errors) || [{ field: null, message: e.message }];
      }
      ctx.rerender();
    });

    root.querySelector('#btn-import-csv')?.addEventListener('click', async () => {
      const file = root.querySelector('#csv-file').files[0];
      const reportEl = root.querySelector('#import-report');
      if (!file) {
        reportEl.innerHTML = '<p class="small error">Selecciona un archivo CSV.</p>';
        return;
      }
      try {
        const res = await TCB.api.admin.importCatalogCsv(await file.text());
        await ctx.loadAdminData();
        ctx.rerender();
        document.querySelector('#import-report').innerHTML = renderImportReport(res);
      } catch (e) {
        reportEl.innerHTML = e.data ? renderImportReport(e.data) : `<p class="small error">${esc(e.message)}</p>`;
      }
    });
  }

  return { render: data => renderProductsTab(data.products), mount };
})();
