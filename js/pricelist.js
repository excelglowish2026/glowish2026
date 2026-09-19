(() => {
  const panel = document.getElementById('panel-pricelist');
  const refreshBtn = document.getElementById('pricelist-refresh');
  const regularView = document.getElementById('regularprice-view');
  const promoView = document.getElementById('promorates-view');

  document.querySelectorAll('input[name="pricelist-view"]').forEach((r) => {
    r.addEventListener('change', () => {
      const showRegular = document.querySelector('input[name="pricelist-view"]:checked').value === 'regular';
      regularView.hidden = !showRegular;
      promoView.hidden = showRegular;
    });
  });

  panel.addEventListener('panel:show', () => {
    initStoreField(regularModule.form.store);
    initStoreField(promoModule.form.store);
    regularModule.loadIfNeeded();
    promoModule.loadIfNeeded();
  });
  refreshBtn.addEventListener('click', () => {
    regularModule.load();
    promoModule.load();
  });

  // ---- Regular Price ----
  const regularModule = makePriceModule({
    sheet: 'RegularPrice',
    tbodyId: 'regularprice-tbody',
    pagerId: 'pager-regularprice',
    formId: 'regularprice-form',
    statusId: 'regularprice-status',
    priceFieldName: 'price',
    colspan: 6,
    renderRow: (r) => `
      <tr>
        <td>${escapeHtml(r.Store)}</td>
        <td>${escapeHtml(r.Category)}</td>
        <td>${escapeHtml(r.ItemName)}</td>
        <td class="num">${escapeHtml(r.Price)}</td>
        <td class="num">${escapeHtml(r.DiscountPercent)}</td>
        <td class="num">${escapeHtml(r.DistPrice)}</td>
      </tr>
    `,
    buildData: (form) => ({
      Store: form.store.value.trim(),
      Category: form.category.value.trim(),
      ItemName: form.itemName.value.trim(),
      Price: form.price.value,
      DiscountPercent: form.discountPercent.value,
      DistPrice: form.distPrice.value
    })
  });

  // ---- Promo Rates ----
  const promoModule = makePriceModule({
    sheet: 'PromoRates',
    tbodyId: 'promorates-tbody',
    pagerId: 'pager-promorates',
    formId: 'promorates-form',
    statusId: 'promorates-status',
    priceFieldName: 'srp',
    colspan: 7,
    renderRow: (r) => `
      <tr>
        <td>${escapeHtml(r.Store)}</td>
        <td>${escapeHtml(r.Category)}</td>
        <td>${escapeHtml(r.ItemName)}</td>
        <td>${escapeHtml(r.PromoName)}</td>
        <td class="num">${escapeHtml(r.SRP)}</td>
        <td class="num">${escapeHtml(r.DiscountPercent)}</td>
        <td class="num">${escapeHtml(r.DistPrice)}</td>
      </tr>
    `,
    buildData: (form) => ({
      Store: form.store.value.trim(),
      Category: form.category.value.trim(),
      ItemName: form.itemName.value.trim(),
      PromoName: form.promoName.value.trim(),
      SRP: form.srp.value,
      DiscountPercent: form.discountPercent.value,
      DistPrice: form.distPrice.value
    })
  });

  // Shared logic for both Regular Price and Promo Rates: load, render,
  // paginate, and auto-compute distributor price from (price × discount).
  function makePriceModule(cfg) {
    const tbody = document.getElementById(cfg.tbodyId);
    const pagerEl = document.getElementById(cfg.pagerId);
    const form = document.getElementById(cfg.formId);
    const statusEl = document.getElementById(cfg.statusId);

    let allRows = [];
    let currentPage = 1;
    let loaded = false;

    function updateDistPrice() {
      const price = parseFloat(form[cfg.priceFieldName].value);
      const pct = parseFloat(form.discountPercent.value);
      form.distPrice.value = (isNaN(price) || isNaN(pct)) ? '' : (price * (1 - pct / 100)).toFixed(2);
    }
    form[cfg.priceFieldName].addEventListener('input', updateDistPrice);
    form.discountPercent.addEventListener('change', updateDistPrice);

    async function load() {
      if (!apiConfigured()) return;
      setStatus('Loading…');
      try {
        const storeFilter = SESSION.allStores ? '' : SESSION.store;
        const res = await apiGet({ action: 'getData', sheet: cfg.sheet, store: storeFilter, region: SESSION.region });
        if (!res.success) throw new Error(res.error);
        allRows = res.rows;
        currentPage = 1;
        render();
        setStatus('');
        loaded = true;
      } catch (err) {
        setStatus('Couldn’t load: ' + err.message, true);
      }
    }

    function loadIfNeeded() {
      if (!loaded) load();
    }

    function render() {
      if (!allRows.length) {
        tbody.innerHTML = `<tr><td colspan="${cfg.colspan}" class="empty-row">No items yet. Add the first one below.</td></tr>`;
        pagerEl.hidden = true;
        return;
      }
      const pageRows = pageSlice(allRows, currentPage);
      tbody.innerHTML = pageRows.map(cfg.renderRow).join('');
      renderPager(pagerEl, allRows.length, currentPage, (p) => { currentPage = p; render(); });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!apiConfigured()) { setStatus('Not connected to a spreadsheet yet.', true); return; }
      const data = cfg.buildData(form);
      setStatus('Saving…');
      try {
        const res = await apiPost({ action: 'addRow', sheet: cfg.sheet, region: SESSION.region, data });
        if (!res.success) throw new Error(res.error);
        form.reset();
        setStatus('Item added.');
        load();
      } catch (err) {
        setStatus('Couldn’t save: ' + err.message, true);
      }
    });

    function setStatus(msg, isError) {
      statusEl.textContent = msg;
      statusEl.classList.toggle('error', !!isError);
    }

    return { form, load, loadIfNeeded };
  }
})();
