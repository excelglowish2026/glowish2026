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
  const searchInput = document.getElementById('inventory-search');
  let searchTerm = '';

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
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchTerm = searchInput.value.trim().toLowerCase();
      currentPage = 1;
      render();
    });
  }
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

    let filtered = allRows.filter((r) =>
      String(r.Category).toLowerCase() === view.toLowerCase() &&
      String(r.Warehouse || '') === String(activeWarehouse || '')
    );
    if (searchTerm) {
      filtered = filtered.filter((r) =>
        Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(searchTerm)) ||
        fmtDate(r.Date).toLowerCase().includes(searchTerm));
    }

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-row">${searchTerm ? 'No items match your search.' : 'Empty Inventory'}</td></tr>`;
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
        <td><button type="button" class="link-btn inv-view-btn" data-row="${r._row}">View more</button></td>
      </tr>
    `;
    }).join('');
    renderPager(pagerEl, filtered.length, currentPage, (p) => { currentPage = p; render(); });
  }

  // ---- "View more" modal: every field, plus Edit for Store = ALL staff ----
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.inv-view-btn');
    if (!btn) return;
    const row = allRows.find((r) => String(r._row) === String(btn.dataset.row));
    if (row) openDetail(row);
  });

  const DETAIL_FIELDS = [
    ['Store', 'Store'], ['Warehouse', 'Warehouse'], ['Category', 'Category'], ['Date', 'Date'],
    ['ItemName', 'Item name'], ['Beg', 'Beginning'], ['In', 'In'], ['Out', 'Out'], ['Total', 'Total'],
    ['OutTo', 'Out to'], ['Address', 'Address'], ['DeliveredBy', 'Delivered by'], ['Remarks', 'Remarks']
  ];

  function openDetail(row) {
    const body = showDetailModal(row.ItemName || 'Inventory item', '');
    showDetailView(body, row);
  }

  function showDetailView(body, row) {
    const items = DETAIL_FIELDS.map(([key, label]) => {
      const val = key === 'Date' ? fmtDate(row[key]) : row[key];
      const wide = key === 'Address' || key === 'Remarks' || key === 'ItemName';
      return `<div class="detail-item${wide ? ' wide' : ''}"><span class="detail-label">${escapeHtml(label)}</span><span class="detail-value">${escapeHtml(val) || '\u2014'}</span></div>`;
    }).join('');
    body.innerHTML = `
      <div class="detail-grid">${items}</div>
      ${SESSION.allStores ? '<div class="detail-actions"><button type="button" class="btn-secondary" id="inv-edit-btn">Edit</button></div>' : ''}
    `;
    const editBtn = body.querySelector('#inv-edit-btn');
    if (editBtn) editBtn.addEventListener('click', () => showEditView(body, row));
  }

  function showEditView(body, row) {
    const whOptions = warehouses.map((w) => `<option value="${escapeHtml(w)}" ${w === row.Warehouse ? 'selected' : ''}>${escapeHtml(w)}</option>`).join('');
    const num = (name, label) => `<div class="field"><label>${label}<input name="${name}" type="number" step="any" value="${escapeHtml(row[name] ?? '')}" /></label></div>`;
    const txt = (name, label, wide) => `<div class="field${wide ? ' wide' : ''}"><label>${label}<input name="${name}" value="${escapeHtml(row[name] ?? '')}" /></label></div>`;
    body.innerHTML = `
      <form class="inv-edit-form" id="inv-edit-form">
        <p class="panel-meta">Item name can\u2019t be changed. When you press Update, the date becomes today (${escapeHtml(fmtDate(todayKey()))}).</p>
        <div class="form-grid">
          <div class="field wide"><label>Item name<input value="${escapeHtml(row.ItemName)}" readonly /></label></div>
          ${txt('Store', 'Store')}
          <div class="field"><label>Warehouse<select name="Warehouse">${whOptions}</select></label></div>
          <div class="field"><label>Category<select name="Category"><option value="Old" ${row.Category === 'Old' ? 'selected' : ''}>Old</option><option value="New" ${row.Category === 'New' ? 'selected' : ''}>New</option></select></label></div>
          ${num('Beg', 'Beginning')}
          ${num('In', 'In')}
          ${num('Out', 'Out')}
          ${num('Total', 'Total')}
          ${txt('OutTo', 'Out to')}
          ${txt('DeliveredBy', 'Delivered by')}
          ${txt('Address', 'Address', true)}
          ${txt('Remarks', 'Remarks', true)}
        </div>
        <p class="status-line" id="inv-edit-status"></p>
        <div class="detail-actions">
          <button type="submit" class="btn-secondary">Update</button>
          <button type="button" class="refresh-btn" id="inv-edit-cancel">Cancel</button>
        </div>
      </form>
    `;
    body.querySelector('#inv-edit-cancel').addEventListener('click', () => showDetailView(body, row));
    body.querySelector('#inv-edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const statusEl = body.querySelector('#inv-edit-status');
      const submit = f.querySelector('button[type="submit"]');
      const val = (n) => f.elements[n].value.trim();
      const data = {
        Store: val('Store'),
        Warehouse: f.elements['Warehouse'].value,
        Category: f.elements['Category'].value,
        Date: todayKey(),
        ItemName: row.ItemName,
        Beg: val('Beg'), In: val('In'), Out: val('Out'), Total: val('Total'),
        OutTo: val('OutTo'), Address: val('Address'), DeliveredBy: val('DeliveredBy'), Remarks: val('Remarks')
      };
      submit.disabled = true;
      statusEl.classList.remove('error');
      statusEl.textContent = 'Saving\u2026';
      try {
        const res = await apiPost({ action: 'updateRow', sheet: 'Inventory', region: SESSION.region, row: row._row, data });
        if (!res.success) throw new Error(res.error);
        closeTextModal();
        await load();
        setStatus('Item updated \u2014 date set to today.');
      } catch (err) {
        submit.disabled = false;
        statusEl.classList.add('error');
        statusEl.textContent = 'Couldn\u2019t save: ' + err.message;
      }
    });
  }

  // Today's date in the user's own timezone, as yyyy-MM-dd.
  function todayKey() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
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
