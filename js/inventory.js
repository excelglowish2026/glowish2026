(() => {
  const panel = document.getElementById('panel-inventory');
  const tbody = document.getElementById('inventory-tbody');
  const pagerEl = document.getElementById('pager-inventory');
  const form = document.getElementById('inventory-form');
  const status = document.getElementById('inventory-status');
  const refreshBtn = document.getElementById('inventory-refresh');
  const categoryToggle = document.querySelectorAll('input[name="inventory-category-view"]');

  let allRows = [];
  let currentPage = 1;
  let loaded = false;

  panel.addEventListener('panel:show', () => {
    initStoreField(form.store);
    if (!loaded) load();
  });
  refreshBtn.addEventListener('click', load);
  categoryToggle.forEach((r) => r.addEventListener('change', () => { currentPage = 1; render(); }));

  function currentView() {
    return document.querySelector('input[name="inventory-category-view"]:checked').value;
  }

  async function load() {
    if (!apiConfigured()) return;
    setStatus('Loading inventory…');
    try {
      const storeFilter = SESSION.allStores ? '' : SESSION.store;
      const res = await apiGet({ action: 'getData', sheet: 'Inventory', store: storeFilter, region: SESSION.region });
      if (!res.success) throw new Error(res.error);
      allRows = res.rows;
      currentPage = 1;
      render();
      setStatus('');
      loaded = true;
    } catch (err) {
      setStatus('Couldn’t load inventory: ' + err.message, true);
    }
  }

  function render() {
    const view = currentView();
    const filtered = allRows.filter((r) => String(r.Category).toLowerCase() === view.toLowerCase());
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty-row">No ${escapeHtml(view.toLowerCase())} items yet. Add one below.</td></tr>`;
      pagerEl.hidden = true;
      return;
    }
    const pageRows = pageSlice(filtered, currentPage);
    tbody.innerHTML = pageRows.map((r) => `
      <tr>
        <td>${escapeHtml(r.Store)}</td>
        <td>${fmtDate(r.Date)}</td>
        <td>${escapeHtml(r.ItemName)}</td>
        <td class="num">${escapeHtml(r.Beg)}</td>
        <td class="num">${escapeHtml(r.In)}</td>
        <td class="num">${escapeHtml(r.Out)}</td>
        <td class="num">${escapeHtml(r.Total)}</td>
        <td>${escapeHtml(r.OutTo)}</td>
        <td>${escapeHtml(r.Address)}</td>
        <td>${escapeHtml(r.DeliveredBy)}</td>
      </tr>
    `).join('');
    renderPager(pagerEl, filtered.length, currentPage, (p) => { currentPage = p; render(); });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!apiConfigured()) { setStatus('Not connected to a spreadsheet yet.', true); return; }
    const data = {
      Store: form.store.value.trim(),
      Category: form.category.value,
      Date: form.date.value,
      ItemName: form.itemName.value.trim(),
      Beg: form.beg.value,
      In: form.in.value,
      Out: form.out.value,
      Total: form.total.value,
      OutTo: form.outTo.value.trim(),
      Address: form.address.value.trim(),
      DeliveredBy: form.deliveredBy.value.trim(),
      Remarks: form.remarks.value.trim()
    };
    setStatus('Saving…');
    try {
      const res = await apiPost({ action: 'addRow', sheet: 'Inventory', region: SESSION.region, data });
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
