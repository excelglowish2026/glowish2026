(() => {
  const panel = document.getElementById('panel-pricelist');
  const tbody = document.getElementById('pricelist-tbody');
  const form = document.getElementById('pricelist-form');
  const status = document.getElementById('pricelist-status');
  const refreshBtn = document.getElementById('pricelist-refresh');

  let loaded = false;

  panel.addEventListener('panel:show', () => {
    initStoreField(form.store);
    if (!loaded) load();
  });
  refreshBtn.addEventListener('click', load);

  async function load() {
    if (!apiConfigured()) return;
    setStatus('Loading price list…');
    try {
      const storeFilter = SESSION.allStores ? '' : SESSION.store;
      const res = await apiGet({ action: 'getData', sheet: 'PriceList', store: storeFilter, region: SESSION.region });
      if (!res.success) throw new Error(res.error);
      render(res.rows);
      setStatus('');
      loaded = true;
    } catch (err) {
      setStatus('Couldn’t load the price list: ' + err.message, true);
    }
  }

  function render(rows) {
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No items yet. Add the first one below.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.Store)}</td>
        <td>${escapeHtml(r.Category)}</td>
        <td>${escapeHtml(r.ItemName)}</td>
        <td class="num">${escapeHtml(r.SRP)}</td>
        <td class="num">${escapeHtml(r.Percentage)}</td>
        <td class="num">${escapeHtml(r.DistPrice)}</td>
      </tr>
    `).join('');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!apiConfigured()) { setStatus('Not connected to a spreadsheet yet.', true); return; }
    const data = {
      Store: form.store.value.trim(),
      Category: form.category.value.trim(),
      ItemName: form.itemName.value.trim(),
      SRP: form.srp.value,
      Percentage: form.percentage.value,
      DistPrice: form.distPrice.value
    };
    setStatus('Saving…');
    try {
      const res = await apiPost({ action: 'addRow', sheet: 'PriceList', region: SESSION.region, data });
      if (!res.success) throw new Error(res.error);
      form.reset();
      setStatus('Item added.');
      load();
    } catch (err) {
      setStatus('Couldn’t save: ' + err.message, true);
    }
  });

  function setStatus(msg, isError) {
    status.textContent = msg;
    status.classList.toggle('error', !!isError);
  }
})();
