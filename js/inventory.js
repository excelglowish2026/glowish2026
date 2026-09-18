(() => {
  const panel = document.getElementById('panel-inventory');
  const tbody = document.getElementById('inventory-tbody');
  const pagerEl = document.getElementById('pager-inventory');
  const form = document.getElementById('inventory-form');
  const status = document.getElementById('inventory-status');
  const refreshBtn = document.getElementById('inventory-refresh');
  const categoryToggle = document.querySelectorAll('input[name="inventory-category-view"]');
  const warehouseTabsEl = document.getElementById('warehouse-tabs');
  const warehouseHint = document.getElementById('inventory-warehouse-hint');

  let allRows = [];
  let warehouses = [];
  let activeWarehouse = null;
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
      // Inventory is tracked per warehouse (a shared stock location), not
      // per individual store, so every staff member in the region sees the
      // full picture of what's in each warehouse.
      const [whRes, invRes] = await Promise.all([
        apiGet({ action: 'getWarehouses' }),
        apiGet({ action: 'getData', sheet: 'Inventory', store: '', region: SESSION.region })
      ]);
      if (!whRes.success) throw new Error(whRes.error);
      if (!invRes.success) throw new Error(invRes.error);

      warehouses = whRes.warehouses || [];
      allRows = invRes.rows;
      if (!activeWarehouse || !warehouses.includes(activeWarehouse)) {
        activeWarehouse = warehouses[0] || null;
      }
      renderWarehouseTabs();
      currentPage = 1;
      render();
      setStatus('');
      loaded = true;
    } catch (err) {
      setStatus('Couldn’t load inventory: ' + err.message, true);
    }
  }

  function renderWarehouseTabs() {
    if (!warehouses.length) {
      warehouseTabsEl.innerHTML = '<span class="panel-meta">No warehouses set up yet — ask an admin to add one.</span>';
      return;
    }
    warehouseTabsEl.innerHTML = warehouses.map((w) => `
      <button type="button" class="warehouse-tab-btn${w === activeWarehouse ? ' active' : ''}" data-warehouse="${escapeHtml(w)}">${escapeHtml(w)}</button>
    `).join('');
    warehouseTabsEl.querySelectorAll('.warehouse-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeWarehouse = btn.dataset.warehouse;
        currentPage = 1;
        renderWarehouseTabs();
        render();
      });
    });
  }

  function render() {
    const view = currentView();
    warehouseHint.textContent = activeWarehouse ? `Adding to warehouse: ${activeWarehouse}` : '';

    const filtered = allRows.filter((r) =>
      String(r.Category).toLowerCase() === view.toLowerCase() &&
      String(r.Warehouse || '') === String(activeWarehouse || '')
    );

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="empty-row">Empty Inventory</td></tr>';
      pagerEl.hidden = true;
      return;
    }
    const pageRows = pageSlice(filtered, currentPage);
    tbody.innerHTML = pageRows.map((r) => {
      const low = isLowStock(r.Total);
      return `
      <tr class="${low ? 'low-stock-row' : ''}">
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
        ${remarksCellHtml(r.Remarks)}
      </tr>
    `;
    }).join('');
    renderPager(pagerEl, filtered.length, currentPage, (p) => { currentPage = p; render(); });
  }

  function isLowStock(total) {
    const n = parseFloat(total);
    return !isNaN(n) && n < 10;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!apiConfigured()) { setStatus('Not connected to a spreadsheet yet.', true); return; }
    if (!activeWarehouse) { setStatus('Pick a warehouse tab above first.', true); return; }
    const data = {
      Store: form.store.value.trim(),
      Warehouse: activeWarehouse,
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
