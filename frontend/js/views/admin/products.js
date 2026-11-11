// Admin tab "Catálogo & Fotografías": the product grid with wholesale price and stock per
// size, and the catalog CSV import with its row-by-row error report (HU-05).
window.TCB = window.TCB || {};
TCB.adminTabs = TCB.adminTabs || {};

TCB.adminTabs.products = (() => {
  const { cop } = TCB.adminFormat;

  // PESTAÑA 3: CATÁLOGO DE PRODUCTOS (FOTOGRAFÍAS REALES DE MARCAS COLOMBIANAS)
  function renderProductsTab(products) {
    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px">
          <div>
            <h2 class="display" style="font-size:var(--fs-xl)">Catálogo de Marcas Reales (${products.length} productos)</h2>
            <p class="small muted">Todas las prendas cuentan con fotografía oficial de alta resolución y tabla de medidas en centímetros.</p>
          </div>
        </div>

        <!-- HU-05: IMPORTACIÓN DE CATÁLOGO POR CSV -->
        <section style="background:var(--sheet);border:var(--line);padding:18px;margin-bottom:20px;border-radius:var(--r-1)">
          <h3 style="font-weight:700">Importar catálogo (CSV)</h3>
          <p class="small muted" style="margin-top:4px">
            Una fila por variante. Columnas: marca, nombre, categoria, estilo, ocasion, talla, color, precio_mayorista, stock.
            Varios estilos u ocasiones se separan con |. <a href="/docs/ejemplo_catalogo.csv" download>Descargar ejemplo</a>
          </p>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px">
            <input type="file" id="csv-file" accept=".csv,text/csv" class="input" style="width:auto;max-width:100%">
            <button type="button" class="btn btn--gold btn--sm" id="btn-import-csv">Importar</button>
          </div>
          <div id="import-report" style="margin-top:12px"></div>
        </section>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:20px">
          ${products.map(p => `
            <div style="background:var(--sheet);border:var(--line);border-radius:var(--r-1);overflow:hidden;display:flex;flex-direction:column">
              <div style="height:220px;position:relative">
                <img src="${p.imageUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover" />
                <span style="position:absolute;top:10px;left:10px;background:rgba(22,21,24,0.85);color:#fff;font-family:var(--font-mono);font-size:10px;padding:3px 8px;border-radius:2px">
                  ${p.brandName} (${p.brandCity})
                </span>
                <span style="position:absolute;bottom:10px;right:10px;background:var(--paper-2);font-weight:700;font-family:var(--font-mono);font-size:11px;padding:3px 8px;border:1px solid var(--ink)">
                  $${Number(p.priceCOP).toLocaleString('es-CO')}
                </span>
              </div>
              <div style="padding:16px;flex:1;display:flex;flex-direction:column;gap:8px">
                <div style="display:flex;justify-content:space-between;align-items:baseline">
                  <span class="small mono muted">${p.category.toUpperCase()} · ${p.type}</span>
                  <span class="small" style="font-weight:600">${p.colorName || p.color}</span>
                </div>
                <h4 style="font-weight:700;font-size:var(--fs-base)">${p.name}</h4>
                <p class="small muted" style="font-size:12px;line-height:1.4">${p.story || ''}</p>
                <div style="background:var(--paper-2);padding:6px 10px;border-radius:var(--r-1);font-size:11px;margin-top:auto;display:grid;gap:4px">
                  <span><strong>Tejido:</strong> ${p.fabric}</span>
                  <span><strong>Mayorista:</strong> ${cop(p.wholesalePriceCOP)}${p.wholesaleEstimated ? ' (estimado)' : ''}</span>
                  <span><strong>Stock:</strong> ${(p.variants || []).map(v => `<span class="mono" style="${v.stock === 0 ? 'color:var(--danger)' : ''}">${v.size} ${v.stock}</span>`).join(' · ')}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function mount(root, ctx) {
    root.querySelector('#btn-import-csv')?.addEventListener('click', async () => {
      const file = root.querySelector('#csv-file').files[0];
      const reportEl = root.querySelector('#import-report');
      if (!file) {
        reportEl.innerHTML = '<p class="small error">Selecciona un archivo CSV.</p>';
        return;
      }
      try {
        const res = await TCB.api.admin.importProducts(await file.text());
        await ctx.loadAdminData();
        ctx.rerender();
        document.querySelector('#import-report').innerHTML = `
          <p class="small"><strong>${res.imported}</strong> filas importadas · <strong>${res.rejected}</strong> con error · ${res.createdProducts.length} prendas nuevas · ${res.updatedProducts.length} actualizadas</p>
          ${res.errors.length ? `
            <table class="returns-history-table" style="margin-top:8px">
              <thead><tr><th>Fila</th><th>Motivo</th></tr></thead>
              <tbody>${res.errors.map(e => `<tr><td class="mono">${e.row}</td><td>${e.reason}</td></tr>`).join('')}</tbody>
            </table>
          ` : ''}
        `;
      } catch (e) {
        reportEl.innerHTML = `<p class="small error">${e.message}</p>`;
      }
    });
  }

  return { render: data => renderProductsTab(data.products), mount };
})();
