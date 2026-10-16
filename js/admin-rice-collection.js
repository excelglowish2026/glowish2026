(() => {
  const panel = document.getElementById('panel-ricecollection');
  if (!panel) return;

  const weekDateInput = document.getElementById('arc-week-date');
  const weekLabel = document.getElementById('arc-week-label');
  const municipalityTabsEl = document.getElementById('arc-municipality-tabs');
  const municipalityMeta = document.getElementById('arc-municipality-meta');
  const tbody = document.getElementById('arc-tbody');
  const pagerEl = document.getElementById('pager-arc');
  const searchInput = document.getElementById('arc-search');
  const statusEl = document.getElementById('arc-status');
  const summaryTbody = document.getElementById('arc-summary-tbody');
  const formContainer = document.getElementById('form-container-arc');
  const weeklyViewEl = document.getElementById('arc-weekly-view');
  const listViewEl = document.getElementById('arc-list-view');
  const listMeta = document.getElementById('arc-list-meta');
  const listContainer = document.getElementById('arc-list-container');
  const reportViewEl = document.getElementById('arc-report-view');
  const reportDistrictSelect = document.getElementById('arc-report-district');
  const reportMonthInput = document.getElementById('arc-report-month');
  const reportContainer = document.getElementById('arc-report-container');

  let municipalities = [];
  let activeMunicipality = null;
  let allRows = [];
  let currentWeek = riceWeek();
  let currentPage = 1;
  let viewMode = 'weekly';
  let searchTerm = '';

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchTerm = searchInput.value.trim().toLowerCase();
      currentPage = 1;
      render();
    });
  }

  function matchesSearch(r) {
    if (!searchTerm) return true;
    return Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(searchTerm));
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!weekDateInput.value) weekDateInput.value = toDateKey(new Date());
    if (!reportMonthInput.value) reportMonthInput.value = toDateKey(new Date()).slice(0, 7);
    weekLabel.textContent = formatWeekLabel(currentWeek);

    buildForm();

    document.getElementById('arc-load-week').addEventListener('click', () => {
      currentWeek = riceWeek(weekDateInput.value);
      weekLabel.textContent = formatWeekLabel(currentWeek);
      currentPage = 1;
      render();
      renderSummary();
    });

    document.querySelectorAll('input[name="arc-mode"]').forEach((r) => {
      r.addEventListener('change', () => {
        viewMode = document.querySelector('input[name="arc-mode"]:checked').value;
        weeklyViewEl.hidden = viewMode !== 'weekly';
        listViewEl.hidden = viewMode !== 'list';
        reportViewEl.hidden = viewMode !== 'report';
        if (viewMode === 'list') renderFullList();
        if (viewMode === 'report') renderDistrictReport();
      });
    });

    document.getElementById('arc-report-generate').addEventListener('click', renderDistrictReport);
    document.getElementById('add-municipality-btn').addEventListener('click', handleAddMunicipality);

    document.addEventListener('admin-data:loaded', fetchAndRender);
  });

  async function fetchAndRender() {
    const [muRes, dataRes] = await Promise.all([
      apiGet({ action: 'getMunicipalities' }),
      apiGet({ action: 'getAllData', sheet: 'RiceCollection' })
    ]);
    municipalities = muRes.success ? muRes.municipalities : [];
    allRows = dataRes.success ? dataRes.rows : [];
    if (!activeMunicipality || !municipalities.some((m) => m.Municipality === activeMunicipality)) {
      activeMunicipality = municipalities[0] ? municipalities[0].Municipality : null;
    }
    renderMunicipalityTabs();
    refreshMunicipalitySelect();
    refreshDistrictOptions();
    currentPage = 1;
    render();
    renderSummary();
    if (viewMode === 'list') renderFullList();
    if (viewMode === 'report') renderDistrictReport();
  }

  function activeMunicipalityInfo() {
    return municipalities.find((m) => m.Municipality === activeMunicipality) || null;
  }

  function renderMunicipalityTabs() {
    if (!municipalities.length) {
      municipalityTabsEl.innerHTML = '<span class="panel-meta">No municipalities yet \u2014 add one below.</span>';
      municipalityMeta.textContent = '';
      return;
    }
    municipalityTabsEl.innerHTML = municipalities.map((m) => `
      <button type="button" class="warehouse-tab-btn${m.Municipality === activeMunicipality ? ' active' : ''}" data-mun="${escapeHtml(m.Municipality)}">${escapeHtml(m.Municipality)}</button>
    `).join('');
    municipalityTabsEl.querySelectorAll('.warehouse-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeMunicipality = btn.dataset.mun;
        currentPage = 1;
        renderMunicipalityTabs();
        if (viewMode === 'list') renderFullList();
        else render();
        syncMunicipalitySelect();
      });
    });
    const info = activeMunicipalityInfo();
    municipalityMeta.textContent = info ? `Province: ${info.Province || '\u2014'} \u00b7 District: ${info.District || '\u2014'}` : '';
  }

  // Full history for the active municipality across every region, grouped
  // by calendar month, oldest first.
  function renderFullList() {
    if (!activeMunicipality) {
      listContainer.innerHTML = '<p class="empty-row">Pick a municipality tab above first.</p>';
      listMeta.textContent = '';
      return;
    }
    const rows = allRows.filter((r) => r.Municipality === activeMunicipality);
    listMeta.textContent = `${activeMunicipality} \u2014 ${rows.length} total ${rows.length === 1 ? 'entry' : 'entries'}, all regions`;

    if (!rows.length) {
      listContainer.innerHTML = '<p class="empty-row">No records yet for this municipality.</p>';
      return;
    }

    const byMonth = {};
    rows.forEach((r) => {
      const dk = toDateKey(r.Date);
      const monthKey = dk ? dk.slice(0, 7) : 'Undated';
      if (!byMonth[monthKey]) byMonth[monthKey] = [];
      byMonth[monthKey].push(r);
    });

    const monthKeys = Object.keys(byMonth).sort();
    listContainer.innerHTML = monthKeys.map((mk) => {
      const monthRows = byMonth[mk].slice().sort((a, b) => (toDateKey(a.Date) || '').localeCompare(toDateKey(b.Date) || ''));
      const label = mk === 'Undated' ? 'Undated' : new Date(mk + '-01T00:00:00Z').toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      return `
        <div class="report-block">
          <div class="report-block-head"><h3>${escapeHtml(label)}</h3><span class="panel-meta">${monthRows.length} ${monthRows.length === 1 ? 'entry' : 'entries'}</span></div>
          <div class="table-scroll">
            <table class="ledger-table">
              <thead><tr><th>Region</th><th>Date</th><th>Name</th><th>Address</th><th>Balance</th></tr></thead>
              <tbody>
                ${monthRows.map((r) => `
                  <tr>
                    <td><span class="region-pill">${escapeHtml(r.Region)}</span></td>
                    <td>${fmtDate(r.Date)}</td>
                    <td>${escapeHtml(r.Name)}</td>
                    <td>${escapeHtml(r.Address)}</td>
                    <td class="num">${escapeHtml(r.Balance)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
  }

  // ---- District Report: municipalities x weekly columns, one calendar month, all regions ----
  function districtOptionsList() {
    const seen = new Map();
    municipalities.forEach((m) => {
      const key = (m.Province || '') + '||' + (m.District || '');
      if (!seen.has(key)) seen.set(key, { province: m.Province || '', district: m.District || '' });
    });
    return Array.from(seen.values()).sort((a, b) =>
      a.province.localeCompare(b.province) || a.district.localeCompare(b.district));
  }

  function refreshDistrictOptions() {
    const current = reportDistrictSelect.value;
    const options = districtOptionsList();
    reportDistrictSelect.innerHTML = options.map((o) =>
      `<option value="${escapeHtml(o.province)}||${escapeHtml(o.district)}">${escapeHtml(o.district)} (${escapeHtml(o.province)})</option>`
    ).join('');
    if ([...reportDistrictSelect.options].some((opt) => opt.value === current)) reportDistrictSelect.value = current;
  }

  function buildDistrictReportData() {
    const [province, district] = reportDistrictSelect.value.split('||');
    const munInDistrict = municipalities.filter((m) => (m.Province || '') === province && (m.District || '') === district);
    const weeks = riceWeeksInMonth(reportMonthInput.value + '-01');
    const munRows = munInDistrict.map((m) => {
      const weekTotals = weeks.map((w) =>
        allRows.filter((r) => r.Municipality === m.Municipality && dateInWeek(r.Date, w))
          .reduce((s, r) => s + (parseFloat(r.Balance) || 0), 0)
      );
      return { municipality: m.Municipality, weekTotals };
    });
    const columnTotals = weeks.map((_, i) => munRows.reduce((s, r) => s + r.weekTotals[i], 0));
    const overallTotal = columnTotals.reduce((s, v) => s + v, 0);
    return { province, district, weeks, munRows, columnTotals, overallTotal };
  }

  function renderDistrictReport() {
    if (!reportDistrictSelect.value) {
      reportContainer.innerHTML = '<p class="empty-row">No districts set up yet \u2014 add a municipality first.</p>';
      return;
    }
    const data = buildDistrictReportData();
    const weekHeaders = data.weeks.map((w) => `<th>${escapeHtml(formatWeekColumnLabel(w))}</th>`).join('');
    const bodyRows = data.munRows.map((r) => `
      <tr>
        <td>${escapeHtml(r.municipality)}</td>
        ${r.weekTotals.map((t) => `<td class="num">${escapeHtml(t.toFixed(2))}</td>`).join('')}
      </tr>
    `).join('');
    const totalRow = `
      <tr class="report-total-row">
        <td>TOTAL</td>
        ${data.columnTotals.map((t) => `<td class="num">${escapeHtml(t.toFixed(2))}</td>`).join('')}
      </tr>
    `;
    reportContainer.innerHTML = `
      <div class="table-scroll">
        <table class="ledger-table">
          <thead><tr><th>${escapeHtml(data.district)} (${escapeHtml(data.province)}) \u2014 all regions</th>${weekHeaders}</tr></thead>
          <tbody>${bodyRows}${totalRow}</tbody>
        </table>
      </div>
      <div class="overall-total-box">OVERALL TOTAL: ${escapeHtml(data.overallTotal.toFixed(2))}</div>
    `;
  }

  document.getElementById('arc-report-export-csv').addEventListener('click', () => {
    if (!reportDistrictSelect.value) return;
    const data = buildDistrictReportData();
    const headers = [data.district, ...data.weeks.map(formatWeekColumnLabel)];
    const rows = [...data.munRows, { municipality: 'TOTAL', weekTotals: data.columnTotals }];
    downloadCsv(`rice-collection-report-${data.district}-${reportMonthInput.value}.csv`,
      headers, rows, (r) => [r.municipality, ...r.weekTotals.map((t) => t.toFixed(2))]);
  });

  document.getElementById('arc-report-export-pdf').addEventListener('click', () => {
    if (!reportDistrictSelect.value) return;
    const data = buildDistrictReportData();
    const weekHeaders = data.weeks.map((w) => `<th class="num">${escapeHtml(formatWeekColumnLabel(w))}</th>`).join('');
    const bodyRows = data.munRows.map((r) => `
      <tr><td>${escapeHtml(r.municipality)}</td>${r.weekTotals.map((t) => `<td class="num">${escapeHtml(t.toFixed(2))}</td>`).join('')}</tr>
    `).join('');
    const totalRow = `<tr class="totals-row"><td>TOTAL</td>${data.columnTotals.map((t) => `<td class="num">${escapeHtml(t.toFixed(2))}</td>`).join('')}</tr>`;
    const tableHtml = `
      <table>
        <thead><tr><th>${escapeHtml(data.district)}</th>${weekHeaders}</tr></thead>
        <tbody>${bodyRows}${totalRow}</tbody>
      </table>
      <p class="meta"><strong>OVERALL TOTAL: ${escapeHtml(data.overallTotal.toFixed(2))}</strong></p>
    `;
    openPrintView(`Rice Collection \u2014 ${data.district} (${data.province}), All Regions`, reportMonthInput.value, tableHtml);
  });

  async function handleAddMunicipality() {
    const name = window.prompt('Municipality name:');
    if (!name || !name.trim()) return;
    const province = window.prompt('Province:') || '';
    const district = window.prompt('District:') || '';
    try {
      const res = await apiPost({ action: 'addMunicipality', name: name.trim(), province: province.trim(), district: district.trim() });
      if (!res.success) throw new Error(res.error);
      await fetchAndRender();
    } catch (err) {
      window.alert('Couldn\u2019t add municipality: ' + err.message);
    }
  }

  function rowsForActiveWeek() {
    return allRows.filter((r) => r.Municipality === activeMunicipality && dateInWeek(r.Date, currentWeek));
  }

  function render() {
    const rows = rowsForActiveWeek().filter(matchesSearch);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">${searchTerm ? 'No entries match your search.' : 'No entries for this municipality this week.'}</td></tr>`;
      pagerEl.hidden = true;
      return;
    }
    const pageRows = pageSlice(rows, currentPage);
    tbody.innerHTML = pageRows.map((r) => `
      <tr>
        <td><span class="region-pill">${escapeHtml(r.Region)}</span></td>
        <td>${fmtDate(r.Date)}</td>
        <td>${escapeHtml(r.Name)}</td>
        <td>${escapeHtml(r.Address)}</td>
        <td class="num">${escapeHtml(r.Balance)}</td>
        <td class="row-actions">
          <button type="button" class="link-btn arc-edit-btn" data-region="${escapeHtml(r.Region)}" data-row="${r._row}">Edit</button>
          <button type="button" class="link-btn delete-btn arc-delete-btn" data-region="${escapeHtml(r.Region)}" data-row="${r._row}">Delete</button>
        </td>
      </tr>
    `).join('');
    renderPager(pagerEl, rows.length, currentPage, (p) => { currentPage = p; render(); });
  }

  function renderSummary() {
    const weekRows = allRows.filter((r) => dateInWeek(r.Date, currentWeek));
    const byKey = {};
    weekRows.forEach((r) => {
      const key = [r.Region, r.Province, r.District, r.Municipality].join('||');
      if (!byKey[key]) byKey[key] = { Region: r.Region, Province: r.Province, District: r.District, Municipality: r.Municipality, total: 0 };
      byKey[key].total += parseFloat(r.Balance) || 0;
    });
    const rows = Object.values(byKey).sort((a, b) =>
      String(a.Region).localeCompare(String(b.Region)) ||
      String(a.District).localeCompare(String(b.District)) ||
      String(a.Municipality).localeCompare(String(b.Municipality)));

    if (!rows.length) {
      summaryTbody.innerHTML = '<tr><td colspan="5" class="empty-row">No collections recorded for this week yet.</td></tr>';
      return;
    }
    summaryTbody.innerHTML = rows.map((r) => `
      <tr>
        <td><span class="region-pill">${escapeHtml(r.Region)}</span></td>
        <td>${escapeHtml(r.Province)}</td>
        <td>${escapeHtml(r.District)}</td>
        <td>${escapeHtml(r.Municipality)}</td>
        <td class="num">${escapeHtml(r.total.toFixed(2))}</td>
      </tr>
    `).join('');
  }

  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.arc-edit-btn');
    if (editBtn) { startEdit(editBtn.dataset.region, editBtn.dataset.row); return; }
    const delBtn = e.target.closest('.arc-delete-btn');
    if (delBtn) { confirmDelete(delBtn.dataset.region, delBtn.dataset.row); }
  });

  function buildForm() {
    formContainer.innerHTML = `
      <form class="entry-form" id="form-arc" data-edit-row="" data-edit-region="">
        <h3 id="form-title-arc">Add collection</h3>
        <p class="status-line" id="form-status-arc"></p>
        <div class="form-grid">
          <div class="field">
            <label for="f-arc-Region">Region</label>
            <select id="f-arc-Region" name="Region" required>${REGIONS.map((r) => `<option value="${r}">${r}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label for="f-arc-Municipality">Municipality</label>
            <select id="f-arc-Municipality" name="Municipality" required></select>
          </div>
          <div class="field"><label for="f-arc-Date">Date</label><input id="f-arc-Date" name="Date" type="date" required /></div>
          <div class="field wide"><label for="f-arc-Name">Name</label><input id="f-arc-Name" name="Name" required /></div>
          <div class="field wide"><label for="f-arc-Address">Address</label><input id="f-arc-Address" name="Address" /></div>
          <div class="field"><label for="f-arc-Balance">Balance</label><input id="f-arc-Balance" name="Balance" type="number" step="0.01" /></div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-secondary">Add collection</button>
          <button type="button" class="refresh-btn" id="cancel-edit-arc" hidden>Cancel edit</button>
        </div>
      </form>
    `;
    document.getElementById('form-arc').addEventListener('submit', handleSubmit);
    document.getElementById('cancel-edit-arc').addEventListener('click', resetForm);
  }

  function refreshMunicipalitySelect() {
    const select = document.getElementById('f-arc-Municipality');
    if (!select) return;
    const current = select.value;
    select.innerHTML = municipalities.map((m) => `<option value="${escapeHtml(m.Municipality)}">${escapeHtml(m.Municipality)}</option>`).join('');
    if (municipalities.some((m) => m.Municipality === current)) select.value = current;
    else if (activeMunicipality) select.value = activeMunicipality;
  }

  function syncMunicipalitySelect() {
    const select = document.getElementById('f-arc-Municipality');
    if (select && activeMunicipality) select.value = activeMunicipality;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('form-arc');
    const statusEl2 = document.getElementById('form-status-arc');
    if (!apiConfigured()) { setFormStatus(statusEl2, 'Not connected to a spreadsheet yet.', true); return; }

    const region = form.elements['Region'].value;
    const munName = form.elements['Municipality'].value;
    const info = municipalities.find((m) => m.Municipality === munName);
    const data = {
      Province: info ? info.Province || '' : '',
      District: info ? info.District || '' : '',
      Municipality: munName,
      Date: form.elements['Date'].value,
      Name: form.elements['Name'].value.trim(),
      Address: form.elements['Address'].value.trim(),
      Balance: form.elements['Balance'].value
    };

    const editRow = form.dataset.editRow;
    const isEditing = !!editRow;
    const payload = isEditing
      ? { action: 'updateRow', sheet: 'RiceCollection', region, row: parseInt(editRow, 10), data }
      : { action: 'addRow', sheet: 'RiceCollection', region, data };

    setFormStatus(statusEl2, isEditing ? 'Updating\u2026' : 'Saving\u2026');
    try {
      const res = await apiPost(payload);
      if (!res.success) throw new Error(res.error);
      setFormStatus(statusEl2, isEditing ? 'Entry updated.' : 'Entry added.');
      resetForm();
      await fetchAndRender();
    } catch (err) {
      setFormStatus(statusEl2, 'Couldn\u2019t save: ' + err.message, true);
    }
  }

  function startEdit(region, rowNum) {
    const rowObj = allRows.find((r) => r.Region === region && String(r._row) === String(rowNum));
    if (!rowObj) return;
    const form = document.getElementById('form-arc');
    form.elements['Region'].value = region;
    form.elements['Region'].disabled = true;
    refreshMunicipalitySelect();
    form.elements['Municipality'].value = rowObj.Municipality;
    form.elements['Date'].value = rowObj.Date ? String(rowObj.Date).slice(0, 10) : '';
    form.elements['Name'].value = rowObj.Name || '';
    form.elements['Address'].value = rowObj.Address || '';
    form.elements['Balance'].value = rowObj.Balance || '';
    form.dataset.editRow = rowNum;
    form.dataset.editRegion = region;
    document.getElementById('form-title-arc').textContent = 'Edit collection';
    form.querySelector('button[type="submit"]').textContent = 'Update collection';
    document.getElementById('cancel-edit-arc').hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetForm() {
    const form = document.getElementById('form-arc');
    form.reset();
    form.elements['Region'].disabled = false;
    refreshMunicipalitySelect();
    form.dataset.editRow = '';
    form.dataset.editRegion = '';
    document.getElementById('form-title-arc').textContent = 'Add collection';
    form.querySelector('button[type="submit"]').textContent = 'Add collection';
    document.getElementById('cancel-edit-arc').hidden = true;
  }

  async function confirmDelete(region, rowNum) {
    if (!window.confirm('Delete this entry? This can\u2019t be undone.')) return;
    try {
      const res = await apiPost({ action: 'deleteRow', sheet: 'RiceCollection', region, row: parseInt(rowNum, 10) });
      if (!res.success) throw new Error(res.error);
      await fetchAndRender();
    } catch (err) {
      window.alert('Couldn\u2019t delete: ' + err.message);
    }
  }

  function setFormStatus(el, msg, isError) {
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
  }

  // ---- Export (district summary, all regions) ----
  document.getElementById('arc-export-csv').addEventListener('click', () => {
    const rows = currentSummaryRows();
    downloadCsv(`rice-collection-summary-${toDateKey(currentWeek.start)}.csv`,
      ['Region', 'Province', 'District', 'Municipality', 'Total Balance'],
      rows, (r) => [r.Region, r.Province, r.District, r.Municipality, r.total.toFixed(2)]);
  });
  document.getElementById('arc-export-pdf').addEventListener('click', () => {
    const rows = currentSummaryRows();
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    const tableHtml = `
      <table>
        <thead><tr><th>Region</th><th>Province</th><th>District</th><th>Municipality</th><th class="num">Total balance</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr><td>${escapeHtml(r.Region)}</td><td>${escapeHtml(r.Province)}</td><td>${escapeHtml(r.District)}</td><td>${escapeHtml(r.Municipality)}</td><td class="num">${escapeHtml(r.total.toFixed(2))}</td></tr>`).join('')}
          <tr class="totals-row"><td colspan="4">Grand total</td><td class="num">${escapeHtml(grandTotal.toFixed(2))}</td></tr>
        </tbody>
      </table>
    `;
    openPrintView('Rice Collection \u2014 District Summary (All Regions)', formatWeekLabel(currentWeek), tableHtml);
  });

  function currentSummaryRows() {
    const weekRows = allRows.filter((r) => dateInWeek(r.Date, currentWeek));
    const byKey = {};
    weekRows.forEach((r) => {
      const key = [r.Region, r.Province, r.District, r.Municipality].join('||');
      if (!byKey[key]) byKey[key] = { Region: r.Region, Province: r.Province, District: r.District, Municipality: r.Municipality, total: 0 };
      byKey[key].total += parseFloat(r.Balance) || 0;
    });
    return Object.values(byKey).sort((a, b) =>
      String(a.Region).localeCompare(String(b.Region)) ||
      String(a.District).localeCompare(String(b.District)) ||
      String(a.Municipality).localeCompare(String(b.Municipality)));
  }
})();
