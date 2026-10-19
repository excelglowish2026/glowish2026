(() => {
  const panel = document.getElementById('panel-collectibles');
  const refreshBtn = document.getElementById('cl-refresh');
  const provinceTabsEl = document.getElementById('cl-province-tabs');
  const cityTabsEl = document.getElementById('cl-city-tabs');
  const cityMeta = document.getElementById('cl-city-meta');
  const statusEl = document.getElementById('cl-status');
  const form = document.getElementById('cl-form');
  const listContainer = document.getElementById('cl-list-container');

  const reportMonthField = document.getElementById('cl-report-month-field');
  const reportMonthInput = document.getElementById('cl-report-month');
  const reportRangeLabel = document.getElementById('cl-report-range-label');
  const reportContainer = document.getElementById('cl-report-container');
  const reportExportActions = document.getElementById('cl-report-export-actions');

  let cities = [];           // [{City, Province}, ...] from the Directory
  let activeProvince = null;
  let activeCity = null;
  let allRows = [];          // Collectibles rows this staffer can see
  let loaded = false;
  let lastReport = null;

  panel.addEventListener('panel:show', () => {
    initStoreField(form.store);
    if (!loaded) loadAll();
  });
  refreshBtn.addEventListener('click', loadAll);

  document.querySelectorAll('input[name="cl-report-mode"]').forEach((r) => {
    r.addEventListener('change', () => {
      reportMonthField.hidden = document.querySelector('input[name="cl-report-mode"]:checked').value !== 'province';
    });
  });
  document.getElementById('cl-report-generate').addEventListener('click', generateReport);
  document.getElementById('cl-report-export-csv').addEventListener('click', () => { if (lastReport) exportReport('csv'); });
  document.getElementById('cl-report-export-pdf').addEventListener('click', () => { if (lastReport) exportReport('pdf'); });

  async function loadAll() {
    if (!apiConfigured()) return;
    setStatus('Loading…');
    try {
      const storeFilter = SESSION.allStores ? '' : SESSION.store;
      const [citiesRes, dataRes] = await Promise.all([
        apiGet({ action: 'getCities' }),
        apiGet({ action: 'getData', sheet: 'Collectibles', store: storeFilter, region: SESSION.region })
      ]);
      if (!citiesRes.success) throw new Error(citiesRes.error);
      if (!dataRes.success) throw new Error(dataRes.error);
      cities = citiesRes.cities || [];
      allRows = dataRes.rows;
      if (!activeProvince || !provinceList().includes(activeProvince)) {
        activeProvince = provinceList()[0] || null;
      }
      syncActiveCity();
      renderProvinceTabs();
      renderCityTabs();
      renderList();
      setStatus('');
      loaded = true;
    } catch (err) {
      setStatus('Couldn’t load: ' + err.message, true);
    }
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
      provinceTabsEl.innerHTML = '<span class="panel-meta">No provinces set up yet — ask an admin to add a city.</span>';
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
    cityMeta.textContent = activeCity ? `${activeProvince} › ${activeCity}` : '';
  }

  function rowsForActiveCity() {
    return allRows.filter((r) => r.Province === activeProvince && r.Municipality === activeCity);
  }

  function renderList() {
    if (!activeCity) {
      listContainer.innerHTML = '<p class="empty-row">Pick a province and city tab above first.</p>';
      return;
    }
    listContainer.innerHTML = renderWeekGroups(rowsForActiveCity());
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
    if (!rows.length) return '<p class="empty-row">No collectibles logged yet for this city.</p>';
    const groups = groupByWeek(rows);
    let overallTotal = 0;
    const colCount = opts.showRegion ? 4 : 3;
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
              <thead><tr>${opts.showRegion ? '<th>Region</th>' : ''}<th>Date</th><th>Name</th><th>Address</th><th>Balance</th></tr></thead>
              <tbody>
                ${sortedRows.map((r) => `<tr>${opts.showRegion ? `<td><span class="region-pill">${escapeHtml(r.Region)}</span></td>` : ''}<td>${fmtDate(r.Date)}</td><td>${escapeHtml(r.Name)}</td><td>${escapeHtml(r.Address)}</td><td class="num">${escapeHtml(r.Balance)}</td></tr>`).join('')}
                <tr class="totals-row"><td colspan="${colCount}">Week total</td><td class="num">${escapeHtml(total.toFixed(2))}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
    return blocksHtml + `<div class="overall-total-box">OVERALL TOTAL: ${escapeHtml(overallTotal.toFixed(2))}</div>`;
  }

  // ---- Add entry ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!apiConfigured()) { setStatus('Not connected to a spreadsheet yet.', true); return; }
    if (!activeProvince || !activeCity) { setStatus('Pick a province and city tab above first.', true); return; }
    const data = {
      Store: form.store.value.trim(),
      Province: activeProvince,
      District: '',
      Municipality: activeCity,
      Date: form.date.value,
      Name: form.name.value.trim(),
      Address: form.address.value.trim(),
      Balance: form.balance.value
    };
    setStatus('Saving…');
    try {
      const res = await apiPost({ action: 'addRow', sheet: 'Collectibles', region: SESSION.region, data });
      if (!res.success) throw new Error(res.error);
      form.reset();
      initStoreField(form.store);
      setStatus('Entry added.');
      await loadAll();
    } catch (err) {
      setStatus('Couldn’t save: ' + err.message, true);
    }
  });

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', !!isError);
  }

  // ---- Generate Report ----
  function generateReport() {
    const mode = document.querySelector('input[name="cl-report-mode"]:checked').value;
    if (mode === 'city') {
      if (!activeCity) { reportContainer.innerHTML = '<p class="empty-row">Pick a province and city tab above first.</p>'; return; }
      const rows = rowsForActiveCity();
      reportRangeLabel.textContent = `${activeProvince} › ${activeCity} — all entries`;
      reportContainer.innerHTML = renderWeekGroups(rows);
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
      reportRangeLabel.textContent = `${activeProvince} — ${formatMonthLabel(bounds)}`;
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
          g.rows.forEach((r) => csvRows.push({ Week: label, Date: fmtDate(r.Date), Name: r.Name, Address: r.Address, Balance: r.Balance }));
        });
        downloadCsv(`collectibles-${lastReport.label}.csv`,
          ['Week', 'Date', 'Name', 'Address', 'Balance'],
          csvRows, (r) => [r.Week, r.Date, r.Name, r.Address, r.Balance]);
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
            <thead><tr><th>Date</th><th>Name</th><th>Address</th><th class="num">Balance</th></tr></thead>
            <tbody>
              ${sortedRows.map((r) => `<tr><td>${escapeHtml(fmtDate(r.Date))}</td><td>${escapeHtml(r.Name)}</td><td>${escapeHtml(r.Address)}</td><td class="num">${escapeHtml(r.Balance)}</td></tr>`).join('')}
              <tr class="totals-row"><td colspan="3">Week total</td><td class="num">${escapeHtml(total.toFixed(2))}</td></tr>
            </tbody>
          </table>
        `;
      }).join('');
      const pdfHtml = sectionsHtml + `<p class="meta"><strong>OVERALL TOTAL: ${escapeHtml(overallTotal.toFixed(2))}</strong></p>`;
      openPrintView(`Collectibles — ${activeProvince} / ${activeCity}`, 'All entries, grouped by collection week', pdfHtml);
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
    openPrintView(`Collectibles — ${activeProvince}`, lastReport.monthLabel, tableHtml);
  }
})();
