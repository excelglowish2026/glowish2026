(() => {
  const panel = document.getElementById('panel-ricecollection');
  if (!panel) return;

  const weekDateInput = document.getElementById('rc-week-date');
  const loadWeekBtn = document.getElementById('rc-load-week');
  const weekLabel = document.getElementById('rc-week-label');
  const refreshBtn = document.getElementById('rc-refresh');
  const municipalityTabsEl = document.getElementById('rc-municipality-tabs');
  const municipalityMeta = document.getElementById('rc-municipality-meta');
  const tbody = document.getElementById('rc-tbody');
  const pagerEl = document.getElementById('pager-rc');
  const searchInput = document.getElementById('rc-search');
  const form = document.getElementById('rc-form');
  const statusEl = document.getElementById('rc-status');
  const summaryTbody = document.getElementById('rc-summary-tbody');
  const weeklyViewEl = document.getElementById('rc-weekly-view');
  const listViewEl = document.getElementById('rc-list-view');
  const listMeta = document.getElementById('rc-list-meta');
  const listContainer = document.getElementById('rc-list-container');
  const reportViewEl = document.getElementById('rc-report-view');
  const reportDistrictSelect = document.getElementById('rc-report-district');
  const reportMonthInput = document.getElementById('rc-report-month');
  const reportContainer = document.getElementById('rc-report-container');

  let municipalities = [];
  let activeMunicipality = null;
  let allRows = [];
  let currentWeek = riceWeek();
  let currentPage = 1;
  let loaded = false;
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

  panel.addEventListener('panel:show', () => {
    if (!weekDateInput.value) weekDateInput.value = toDateKey(new Date());
    if (!reportMonthInput.value) reportMonthInput.value = toDateKey(new Date()).slice(0, 7);
    if (!loaded) loadAll();
  });

  document.querySelectorAll('input[name="rc-mode"]').forEach((r) => {
    r.addEventListener('change', () => {
      viewMode = document.querySelector('input[name="rc-mode"]:checked').value;
      weeklyViewEl.hidden = viewMode !== 'weekly';
      listViewEl.hidden = viewMode !== 'list';
      reportViewEl.hidden = viewMode !== 'report';
      if (viewMode === 'list') renderFullList();
      if (viewMode === 'report') renderDistrictReport();
    });
  });

  document.getElementById('rc-report-generate').addEventListener('click', renderDistrictReport);

  loadWeekBtn.addEventListener('click', () => {
    currentWeek = riceWeek(weekDateInput.value);
    weekLabel.textContent = formatWeekLabel(currentWeek);
    currentPage = 1;
    render();
    renderSummary();
  });
  refreshBtn.addEventListener('click', loadAll);

  async function loadAll() {
    if (!apiConfigured()) return;
    setStatus('Loading\u2026');
    weekLabel.textContent = formatWeekLabel(currentWeek);
    try {
      const [muRes, dataRes] = await Promise.all([
        apiGet({ action: 'getMunicipalities' }),
        apiGet({ action: 'getData', sheet: 'RiceCollection', store: '', region: SESSION.region })
      ]);
      if (!muRes.success) throw new Error(muRes.error);
      if (!dataRes.success) throw new Error(dataRes.error);
      municipalities = muRes.municipalities || [];
      allRows = dataRes.rows;
      if (!activeMunicipality || !municipalities.some((m) => m.Municipality === activeMunicipality)) {
        activeMunicipality = municipalities[0] ? municipalities[0].Municipality : null;
      }
      renderMunicipalityTabs();
      refreshDistrictOptions();
      currentPage = 1;
      render();
      renderSummary();
      if (viewMode === 'list') renderFullList();
      if (viewMode === 'report') renderDistrictReport();
      setStatus('');
      loaded = true;
    } catch (err) {
      setStatus('Couldn\u2019t load: ' + err.message, true);
    }
  }

  function activeMunicipalityInfo() {
    return municipalities.find((m) => m.Municipality === activeMunicipality) || null;
  }

  function renderMunicipalityTabs() {
    if (!municipalities.length) {
      municipalityTabsEl.innerHTML = '<span class="panel-meta">No municipalities set up yet \u2014 ask an admin to add one.</span>';
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
      });
    });
    const info = activeMunicipalityInfo();
    municipalityMeta.textContent = info ? `Province: ${info.Province || '\u2014'} \u00b7 District: ${info.District || '\u2014'}` : '';
  }

  // Full history for the active municipality, grouped by calendar month,
  // oldest first (e.g. July, August, September, October).
  function renderFullList() {
    if (!activeMunicipality) {
      listContainer.innerHTML = '<p class="empty-row">Pick a municipality tab above first.</p>';
      listMeta.textContent = '';
      return;
    }
    const rows = allRows.filter((r) => r.Municipality === activeMunicipality);
    listMeta.textContent = `${escapeHtml(activeMunicipality)} \u2014 ${rows.length} total ${rows.length === 1 ? 'entry' : 'entries'}`;

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

    const monthKeys = Object.keys(byMonth).sort(); // "YYYY-MM" sorts oldest \u2192 recent
    listContainer.innerHTML = monthKeys.map((mk) => {
      const monthRows = byMonth[mk].slice().sort((a, b) => (toDateKey(a.Date) || '').localeCompare(toDateKey(b.Date) || ''));
      const label = mk === 'Undated' ? 'Undated' : new Date(mk + '-01T00:00:00Z').toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      return `
        <div class="report-block">
          <div class="report-block-head"><h3>${escapeHtml(label)}</h3><span class="panel-meta">${monthRows.length} ${monthRows.length === 1 ? 'entry' : 'entries'}</span></div>
          <div class="table-scroll">
            <table class="ledger-table">
              <thead><tr><th>Date</th><th>Name</th><th>Address</th><th>Balance</th></tr></thead>
              <tbody>
                ${monthRows.map((r) => `
                  <tr>
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

  function rowsForActiveWeek() {
    return allRows.filter((r) => r.Municipality === activeMunicipality && dateInWeek(r.Date, currentWeek));
  }

  function render() {
    const rows = rowsForActiveWeek().filter(matchesSearch);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-row">${searchTerm ? 'No entries match your search.' : 'No entries for this municipality this week.'}</td></tr>`;
      pagerEl.hidden = true;
      return;
    }
    const pageRows = pageSlice(rows, currentPage);
    tbody.innerHTML = pageRows.map((r) => `
      <tr>
        <td>${fmtDate(r.Date)}</td>
        <td>${escapeHtml(r.Name)}</td>
        <td>${escapeHtml(r.Address)}</td>
        <td class="num">${escapeHtml(r.Balance)}</td>
      </tr>
    `).join('');
    renderPager(pagerEl, rows.length, currentPage, (p) => { currentPage = p; render(); });
  }

  function renderSummary() {
    const weekRows = allRows.filter((r) => dateInWeek(r.Date, currentWeek));
    const byMun = {};
    weekRows.forEach((r) => {
      const key = [r.Province, r.District, r.Municipality].join('||');
      if (!byMun[key]) byMun[key] = { Province: r.Province, District: r.District, Municipality: r.Municipality, total: 0 };
      byMun[key].total += parseFloat(r.Balance) || 0;
    });
    const rows = Object.values(byMun).sort((a, b) =>
      String(a.District).localeCompare(String(b.District)) || String(a.Municipality).localeCompare(String(b.Municipality)));

    if (!rows.length) {
      summaryTbody.innerHTML = '<tr><td colspan="4" class="empty-row">No collections recorded for this week yet.</td></tr>';
      return;
    }
    summaryTbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.Province)}</td>
        <td>${escapeHtml(r.District)}</td>
        <td>${escapeHtml(r.Municipality)}</td>
        <td class="num">${escapeHtml(r.total.toFixed(2))}</td>
      </tr>
    `).join('');
  }

  // ---- District Report: municipalities x weekly columns, one calendar month ----
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
          <thead><tr><th>${escapeHtml(data.district)} (${escapeHtml(data.province)})</th>${weekHeaders}</tr></thead>
          <tbody>${bodyRows}${totalRow}</tbody>
        </table>
      </div>
      <div class="overall-total-box">OVERALL TOTAL: ${escapeHtml(data.overallTotal.toFixed(2))}</div>
    `;
  }

  document.getElementById('rc-report-export-csv').addEventListener('click', () => {
    if (!reportDistrictSelect.value) return;
    const data = buildDistrictReportData();
    const headers = [data.district, ...data.weeks.map(formatWeekColumnLabel)];
    const rows = [...data.munRows, { municipality: 'TOTAL', weekTotals: data.columnTotals }];
    downloadCsv(`rice-collection-report-${data.district}-${reportMonthInput.value}.csv`,
      headers, rows, (r) => [r.municipality, ...r.weekTotals.map((t) => t.toFixed(2))]);
  });

  document.getElementById('rc-report-export-pdf').addEventListener('click', () => {
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
    openPrintView(`Rice Collection \u2014 ${data.district} (${data.province})`, reportMonthInput.value, tableHtml);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!apiConfigured()) { setStatus('Not connected to a spreadsheet yet.', true); return; }
    const info = activeMunicipalityInfo();
    if (!info) { setStatus('Pick a municipality tab above first.', true); return; }
    const data = {
      Province: info.Province || '',
      District: info.District || '',
      Municipality: info.Municipality,
      Date: form.date.value,
      Name: form.name.value.trim(),
      Address: form.address.value.trim(),
      Balance: form.balance.value
    };
    setStatus('Saving\u2026');
    try {
      const res = await apiPost({ action: 'addRow', sheet: 'RiceCollection', region: SESSION.region, data });
      if (!res.success) throw new Error(res.error);
      form.reset();
      setStatus('Entry added.');
      await loadAll();
    } catch (err) {
      setStatus('Couldn\u2019t save: ' + err.message, true);
    }
  });

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', !!isError);
  }

  // ---- Export (district summary) ----
  document.getElementById('rc-export-csv').addEventListener('click', () => {
    const rows = currentSummaryRows();
    downloadCsv(`rice-collection-summary-${toDateKey(currentWeek.start)}.csv`,
      ['Province', 'District', 'Municipality', 'Total Balance'],
      rows, (r) => [r.Province, r.District, r.Municipality, r.total.toFixed(2)]);
  });
  document.getElementById('rc-export-pdf').addEventListener('click', () => {
    const rows = currentSummaryRows();
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    const tableHtml = `
      <table>
        <thead><tr><th>Province</th><th>District</th><th>Municipality</th><th class="num">Total balance</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr><td>${escapeHtml(r.Province)}</td><td>${escapeHtml(r.District)}</td><td>${escapeHtml(r.Municipality)}</td><td class="num">${escapeHtml(r.total.toFixed(2))}</td></tr>`).join('')}
          <tr class="totals-row"><td colspan="3">Grand total</td><td class="num">${escapeHtml(grandTotal.toFixed(2))}</td></tr>
        </tbody>
      </table>
    `;
    openPrintView('Rice Collection \u2014 District Summary', formatWeekLabel(currentWeek), tableHtml);
  });

  function currentSummaryRows() {
    const weekRows = allRows.filter((r) => dateInWeek(r.Date, currentWeek));
    const byMun = {};
    weekRows.forEach((r) => {
      const key = [r.Province, r.District, r.Municipality].join('||');
      if (!byMun[key]) byMun[key] = { Province: r.Province, District: r.District, Municipality: r.Municipality, total: 0 };
      byMun[key].total += parseFloat(r.Balance) || 0;
    });
    return Object.values(byMun).sort((a, b) =>
      String(a.District).localeCompare(String(b.District)) || String(a.Municipality).localeCompare(String(b.Municipality)));
  }
})();
