(() => {
  const panel = document.getElementById('panel-collectibles');
  if (!panel) return;

  const provinceTabsEl = document.getElementById('acl-province-tabs');
  const cityTabsEl = document.getElementById('acl-city-tabs');
  const cityMeta = document.getElementById('acl-city-meta');
  const searchInput = document.getElementById('acl-search');
  const listContainer = document.getElementById('acl-list-container');
  const formContainer = document.getElementById('form-container-acl');

  const reportMonthField = document.getElementById('acl-report-month-field');
  const reportMonthInput = document.getElementById('acl-report-month');
  const reportRangeLabel = document.getElementById('acl-report-range-label');
  const reportContainer = document.getElementById('acl-report-container');
  const reportExportActions = document.getElementById('acl-report-export-actions');

  let cities = [];
  let activeProvince = null;
  let activeCity = null;
  let allRows = [];
  let searchTerm = '';
  let lastReport = null;

  document.addEventListener('DOMContentLoaded', () => {
    buildForm();
    document.getElementById('add-city-btn').addEventListener('click', handleAddCity);

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchTerm = searchInput.value.trim().toLowerCase();
        renderList();
      });
    }

    document.querySelectorAll('input[name="acl-report-mode"]').forEach((r) => {
      r.addEventListener('change', () => {
        reportMonthField.hidden = document.querySelector('input[name="acl-report-mode"]:checked').value !== 'province';
      });
    });
    document.getElementById('acl-report-generate').addEventListener('click', generateReport);
    document.getElementById('acl-report-export-csv').addEventListener('click', () => { if (lastReport) exportReport('csv'); });
    document.getElementById('acl-report-export-pdf').addEventListener('click', () => { if (lastReport) exportReport('pdf'); });

    document.addEventListener('admin-data:loaded', fetchAndRender);
  });

  async function fetchAndRender() {
    const [citiesRes, dataRes] = await Promise.all([
      apiGet({ action: 'getCities' }),
      apiGet({ action: 'getAllData', sheet: 'Collectibles' })
    ]);
    cities = citiesRes.success ? citiesRes.cities : [];
    allRows = dataRes.success ? dataRes.rows : [];
    if (!activeProvince || !provinceList().includes(activeProvince)) {
      activeProvince = provinceList()[0] || null;
    }
    syncActiveCity();
    renderProvinceTabs();
    renderCityTabs();
    renderList();
  }

  function provinceList() {
    const seen = new Set();
    cities.forEach((c) => { if (c.Province) seen.add(c.Province); });
    return Array.from(seen).sort();
  }

  function citiesInActiveProvince() {
    return cities.filter((c) => c.Province === activeProvince).map((c) => c.City).sort();
  }

  function syncActiveCity() {
    const inProvince = citiesInActiveProvince();
    if (!activeCity || !inProvince.includes(activeCity)) {
      activeCity = inProvince[0] || null;
    }
  }

  function renderProvinceTabs() {
    const provinces = provinceList();
    if (!provinces.length) {
      provinceTabsEl.innerHTML = '<span class="panel-meta">No provinces yet — add a city below.</span>';
      cityTabsEl.innerHTML = '';
      cityMeta.textContent = '';
      return;
    }
    provinceTabsEl.innerHTML = provinces.map((p) => `
      <button type="button" class="warehouse-tab-btn${p === activeProvince ? ' active' : ''}" data-province="${escapeHtml(p)}">${escapeHtml(p)}</button>
    `).join('');
    provinceTabsEl.querySelectorAll('.warehouse-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeProvince = btn.dataset.province;
        activeCity = null;
        syncActiveCity();
        renderProvinceTabs();
        renderCityTabs();
        renderList();
      });
    });
  }

  function renderCityTabs() {
    const list = citiesInActiveProvince();
    if (!list.length) {
      cityTabsEl.innerHTML = '<span class="panel-meta">No cities under this province yet.</span>';
      cityMeta.textContent = '';
      return;
    }
    cityTabsEl.innerHTML = list.map((c) => `
      <button type="button" class="warehouse-tab-btn${c === activeCity ? ' active' : ''}" data-city="${escapeHtml(c)}">${escapeHtml(c)}</button>
    `).join('');
    cityTabsEl.querySelectorAll('.warehouse-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeCity = btn.dataset.city;
        renderCityTabs();
        renderList();
      });
    });
    cityMeta.textContent = activeCity ? `${activeProvince} › ${activeCity} — all regions` : '';
  }

  function rowsForActiveCity() {
    let rows = allRows.filter((r) => r.Province === activeProvince && r.Municipality === activeCity);
    if (searchTerm) {
      rows = rows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(searchTerm)));
    }
    return rows;
  }

  function renderList() {
    if (!activeCity) {
      listContainer.innerHTML = '<p class="empty-row">Pick a province and city tab above first.</p>';
      return;
    }
    listContainer.innerHTML = renderWeekGroups(rowsForActiveCity(), { showRegion: true, actions: true });
    wireRowActions();
  }

  // ---- Week grouping (Sat–Fri, same math as Rice Collection) ----
  function groupByWeek(rows) {
    const byWeek = {};
    rows.forEach((r) => {
      const dk = toDateKey(r.Date);
      const key = dk ? 'w:' + toDateKey(riceWeek(dk).start) : 'undated';
      if (!byWeek[key]) byWeek[key] = { week: dk ? riceWeek(dk) : null, rows: [] };
      byWeek[key].rows.push(r);
    });
    return Object.values(byWeek).sort((a, b) => {
      if (!a.week) return 1;
      if (!b.week) return -1;
      return toDateKey(a.week.start).localeCompare(toDateKey(b.week.start));
    });
  }

  function sumBalances(rows) {
    return rows.reduce((s, r) => s + (parseFloat(r.Balance) || 0), 0);
  }

  function renderWeekGroups(rows, opts) {
    opts = opts || {};
    if (!rows.length) return `<p class="empty-row">${searchTerm ? 'No entries match your search.' : 'No collectibles logged yet for this city.'}</p>`;
    const groups = groupByWeek(rows);
    let overallTotal = 0;
    const leadCols = (opts.showRegion ? 1 : 0) + 3; // Region? + Date + Name + Address
    const blocksHtml = groups.map((g) => {
      const total = sumBalances(g.rows);
      overallTotal += total;
      const label = g.week ? formatWeekLabel(g.week) : 'Undated';
      const sortedRows = g.rows.slice().sort((a, b) => (toDateKey(a.Date) || '').localeCompare(toDateKey(b.Date) || ''));
      return `
        <div class="report-block">
          <div class="report-block-head"><h3>${escapeHtml(label)}</h3><span class="panel-meta">${g.rows.length} ${g.rows.length === 1 ? 'entry' : 'entries'}</span></div>
          <div class="table-scroll">
            <table class="ledger-table">
              <thead><tr>${opts.showRegion ? '<th>Region</th>' : ''}<th>Date</th><th>Name</th><th>Address</th><th>Balance</th>${opts.actions ? '<th>Actions</th>' : ''}</tr></thead>
              <tbody>
                ${sortedRows.map((r) => `
                  <tr>
                    ${opts.showRegion ? `<td><span class="region-pill">${escapeHtml(r.Region)}</span></td>` : ''}
                    <td>${fmtDate(r.Date)}</td>
                    <td>${escapeHtml(r.Name)}</td>
                    <td>${escapeHtml(r.Address)}</td>
                    <td class="num">${escapeHtml(r.Balance)}</td>
                    ${opts.actions ? `
                    <td class="row-actions">
                      <button type="button" class="link-btn acl-edit-btn" data-region="${escapeHtml(r.Region)}" data-row="${r._row}">Edit</button>
                      <button type="button" class="link-btn delete-btn acl-delete-btn" data-region="${escapeHtml(r.Region)}" data-row="${r._row}">Delete</button>
                    </td>` : ''}
                  </tr>
                `).join('')}
                <tr class="totals-row"><td colspan="${leadCols}">Week total</td><td class="num">${escapeHtml(total.toFixed(2))}</td>${opts.actions ? '<td></td>' : ''}</tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
    return blocksHtml + `<div class="overall-total-box">OVERALL TOTAL: ${escapeHtml(overallTotal.toFixed(2))}</div>`;
  }

  function wireRowActions() {
    listContainer.querySelectorAll('.acl-edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => startEdit(btn.dataset.region, btn.dataset.row));
    });
    listContainer.querySelectorAll('.acl-delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => confirmDelete(btn.dataset.region, btn.dataset.row));
    });
  }

  // ---- Add / edit / delete entry ----
  function buildForm() {
    formContainer.innerHTML = `
      <form class="entry-form" id="form-acl" data-edit-row="" data-edit-region="">
        <h3 id="form-title-acl">Add collection</h3>
        <p class="status-line" id="form-status-acl"></p>
        <div class="form-grid">
          <div class="field">
            <label for="f-acl-Region">Region</label>
            <select id="f-acl-Region" name="Region" required>${REGIONS.map((r) => `<option value="${r}">${r}</option>`).join('')}</select>
          </div>
          <div class="field"><label for="f-acl-Store">Store</label><input id="f-acl-Store" name="Store" required /></div>
          <div class="field"><label for="f-acl-Date">Date</label><input id="f-acl-Date" name="Date" type="date" required /></div>
          <div class="field wide"><label for="f-acl-Name">Name</label><input id="f-acl-Name" name="Name" required /></div>
          <div class="field wide"><label for="f-acl-Address">Address</label><input id="f-acl-Address" name="Address" /></div>
          <div class="field"><label for="f-acl-Balance">Balance</label><input id="f-acl-Balance" name="Balance" type="number" step="0.01" /></div>
        </div>
        <p class="panel-meta">Saves to the province/city tab currently selected above.</p>
        <div class="form-actions">
          <button type="submit" class="btn-secondary">Add collection</button>
          <button type="button" class="refresh-btn" id="cancel-edit-acl" hidden>Cancel edit</button>
        </div>
      </form>
    `;
    document.getElementById('form-acl').addEventListener('submit', handleSubmit);
    document.getElementById('cancel-edit-acl').addEventListener('click', resetForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('form-acl');
    const statusEl = document.getElementById('form-status-acl');
    if (!apiConfigured()) { setFormStatus(statusEl, 'Not connected to a spreadsheet yet.', true); return; }
    if (!activeProvince || !activeCity) { setFormStatus(statusEl, 'Pick a province and city tab above first.', true); return; }

    const region = form.elements['Region'].value;
    const data = {
      Store: form.elements['Store'].value.trim(),
      Province: activeProvince,
      District: '',
      Municipality: activeCity,
      Date: form.elements['Date'].value,
      Name: form.elements['Name'].value.trim(),
      Address: form.elements['Address'].value.trim(),
      Balance: form.elements['Balance'].value
    };

    const editRow = form.dataset.editRow;
    const isEditing = !!editRow;
    const payload = isEditing
      ? { action: 'updateRow', sheet: 'Collectibles', region, row: parseInt(editRow, 10), data }
      : { action: 'addRow', sheet: 'Collectibles', region, data };

    setFormStatus(statusEl, isEditing ? 'Updating…' : 'Saving…');
    try {
      const res = await apiPost(payload);
      if (!res.success) throw new Error(res.error);
      setFormStatus(statusEl, isEditing ? 'Entry updated.' : 'Entry added.');
      resetForm();
      await loadAllData();
    } catch (err) {
      setFormStatus(statusEl, 'Couldn’t save: ' + err.message, true);
    }
  }

  function startEdit(region, rowNum) {
    const rowObj = allRows.find((r) => r.Region === region && String(r._row) === String(rowNum));
    if (!rowObj) return;
    const form = document.getElementById('form-acl');
    form.elements['Region'].value = region;
    form.elements['Region'].disabled = true;
    form.elements['Store'].value = rowObj.Store || '';
    form.elements['Date'].value = rowObj.Date ? String(rowObj.Date).slice(0, 10) : '';
    form.elements['Name'].value = rowObj.Name || '';
    form.elements['Address'].value = rowObj.Address || '';
    form.elements['Balance'].value = rowObj.Balance || '';
    form.dataset.editRow = rowNum;
    form.dataset.editRegion = region;
    document.getElementById('form-title-acl').textContent = 'Edit collection';
    form.querySelector('button[type="submit"]').textContent = 'Update collection';
    document.getElementById('cancel-edit-acl').hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetForm() {
    const form = document.getElementById('form-acl');
    form.reset();
    form.elements['Region'].disabled = false;
    form.dataset.editRow = '';
    form.dataset.editRegion = '';
    document.getElementById('form-title-acl').textContent = 'Add collection';
    form.querySelector('button[type="submit"]').textContent = 'Add collection';
    document.getElementById('cancel-edit-acl').hidden = true;
  }

  async function confirmDelete(region, rowNum) {
    if (!window.confirm('Delete this entry? This can’t be undone.')) return;
    try {
      const res = await apiPost({ action: 'deleteRow', sheet: 'Collectibles', region, row: parseInt(rowNum, 10) });
      if (!res.success) throw new Error(res.error);
      await loadAllData();
    } catch (err) {
      window.alert('Couldn’t delete: ' + err.message);
    }
  }

  function setFormStatus(el, msg, isError) {
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
  }

  // ---- Add city (admin-only) ----
  async function handleAddCity() {
    const city = window.prompt('City name (e.g. "Mandaue"):');
    if (!city || !city.trim()) return;
    const province = window.prompt('Province (e.g. "Cebu"):');
    if (!province || !province.trim()) { window.alert('A province is required.'); return; }
    try {
      const res = await apiPost({ action: 'addCity', city: city.trim(), province: province.trim() });
      if (!res.success) throw new Error(res.error);
      await fetchAndRender();
    } catch (err) {
      window.alert('Couldn’t add city: ' + err.message);
    }
  }

  // ---- Generate Report ----
  function generateReport() {
    const mode = document.querySelector('input[name="acl-report-mode"]:checked').value;
    if (mode === 'city') {
      if (!activeCity) { reportContainer.innerHTML = '<p class="empty-row">Pick a province and city tab above first.</p>'; return; }
      const rows = allRows.filter((r) => r.Province === activeProvince && r.Municipality === activeCity);
      reportRangeLabel.textContent = `${activeProvince} › ${activeCity} — all entries, all regions`;
      reportContainer.innerHTML = renderWeekGroups(rows, { showRegion: true });
      lastReport = { mode: 'city', rows, label: `${activeProvince}-${activeCity}` };
    } else {
      if (!activeProvince) { reportContainer.innerHTML = '<p class="empty-row">Pick a province tab above first.</p>'; return; }
      if (!reportMonthInput.value) reportMonthInput.value = toDateKey(new Date()).slice(0, 7);
      const bounds = monthBoundsFor(reportMonthInput.value + '-01');
      const monthRows = allRows.filter((r) => r.Province === activeProvince && dateInRange(r.Date, bounds.start, bounds.end));
      const byCity = {};
      monthRows.forEach((r) => {
        const key = r.Municipality || 'Unspecified';
        byCity[key] = (byCity[key] || 0) + (parseFloat(r.Balance) || 0);
      });
      const cityRows = Object.keys(byCity).sort().map((c) => ({ city: c, total: byCity[c] }));
      const grandTotal = cityRows.reduce((s, r) => s + r.total, 0);
      reportRangeLabel.textContent = `${activeProvince} — ${formatMonthLabel(bounds)}, all regions`;
      reportContainer.innerHTML = `
        <div class="table-scroll">
          <table class="ledger-table">
            <thead><tr><th>City</th><th>Total balance</th></tr></thead>
            <tbody>
              ${cityRows.length ? cityRows.map((r) => `<tr><td>${escapeHtml(r.city)}</td><td class="num">${escapeHtml(r.total.toFixed(2))}</td></tr>`).join('') : '<tr><td colspan="2" class="empty-row">No collectibles in this province this month.</td></tr>'}
              <tr class="report-total-row"><td>TOTAL</td><td class="num">${escapeHtml(grandTotal.toFixed(2))}</td></tr>
            </tbody>
          </table>
        </div>
      `;
      lastReport = { mode: 'province', cityRows, grandTotal, label: `${activeProvince}-${reportMonthInput.value}`, monthLabel: formatMonthLabel(bounds) };
    }
    reportExportActions.hidden = false;
  }

  function exportReport(format) {
    if (!lastReport) return;
    if (lastReport.mode === 'city') {
      const groups = groupByWeek(lastReport.rows);
      if (format === 'csv') {
        const csvRows = [];
        groups.forEach((g) => {
          const label = g.week ? formatWeekLabel(g.week) : 'Undated';
          g.rows.forEach((r) => csvRows.push({ Week: label, Region: r.Region, Store: r.Store, Date: fmtDate(r.Date), Name: r.Name, Address: r.Address, Balance: r.Balance }));
        });
        downloadCsv(`collectibles-${lastReport.label}.csv`,
          ['Week', 'Region', 'Store', 'Date', 'Name', 'Address', 'Balance'],
          csvRows, (r) => [r.Week, r.Region, r.Store, r.Date, r.Name, r.Address, r.Balance]);
        return;
      }
      let overallTotal = 0;
      const sectionsHtml = groups.map((g) => {
        const label = g.week ? formatWeekLabel(g.week) : 'Undated';
        const total = sumBalances(g.rows);
        overallTotal += total;
        const sortedRows = g.rows.slice().sort((a, b) => (toDateKey(a.Date) || '').localeCompare(toDateKey(b.Date) || ''));
        return `
          <h3>${escapeHtml(label)}</h3>
          <table>
            <thead><tr><th>Region</th><th>Store</th><th>Date</th><th>Name</th><th>Address</th><th class="num">Balance</th></tr></thead>
            <tbody>
              ${sortedRows.map((r) => `<tr><td>${escapeHtml(r.Region)}</td><td>${escapeHtml(r.Store)}</td><td>${escapeHtml(fmtDate(r.Date))}</td><td>${escapeHtml(r.Name)}</td><td>${escapeHtml(r.Address)}</td><td class="num">${escapeHtml(r.Balance)}</td></tr>`).join('')}
              <tr class="totals-row"><td colspan="5">Week total</td><td class="num">${escapeHtml(total.toFixed(2))}</td></tr>
            </tbody>
          </table>
        `;
      }).join('');
      const pdfHtml = sectionsHtml + `<p class="meta"><strong>OVERALL TOTAL: ${escapeHtml(overallTotal.toFixed(2))}</strong></p>`;
      openPrintView(`Collectibles — ${activeProvince} / ${activeCity}`, 'All entries, grouped by collection week, all regions', pdfHtml);
      return;
    }
    // province mode
    if (format === 'csv') {
      downloadCsv(`collectibles-${lastReport.label}.csv`,
        ['City', 'Total Balance'],
        [...lastReport.cityRows, { city: 'TOTAL', total: lastReport.grandTotal }],
        (r) => [r.city, r.total.toFixed(2)]);
      return;
    }
    const tableHtml = `
      <table>
        <thead><tr><th>City</th><th class="num">Total balance</th></tr></thead>
        <tbody>
          ${lastReport.cityRows.map((r) => `<tr><td>${escapeHtml(r.city)}</td><td class="num">${escapeHtml(r.total.toFixed(2))}</td></tr>`).join('')}
          <tr class="totals-row"><td>TOTAL</td><td class="num">${escapeHtml(lastReport.grandTotal.toFixed(2))}</td></tr>
        </tbody>
      </table>
    `;
    openPrintView(`Collectibles — ${activeProvince}, All Regions`, lastReport.monthLabel, tableHtml);
  }
})();
