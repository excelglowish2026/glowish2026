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
  const form = document.getElementById('rc-form');
  const statusEl = document.getElementById('rc-status');
  const summaryTbody = document.getElementById('rc-summary-tbody');

  let municipalities = [];
  let activeMunicipality = null;
  let allRows = [];
  let currentWeek = riceWeek();
  let currentPage = 1;
  let loaded = false;

  panel.addEventListener('panel:show', () => {
    if (!weekDateInput.value) weekDateInput.value = toDateKey(new Date());
    if (!loaded) loadAll();
  });

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
      currentPage = 1;
      render();
      renderSummary();
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
        render();
      });
    });
    const info = activeMunicipalityInfo();
    municipalityMeta.textContent = info ? `Province: ${info.Province || '\u2014'} \u00b7 District: ${info.District || '\u2014'}` : '';
  }

  function rowsForActiveWeek() {
    return allRows.filter((r) => r.Municipality === activeMunicipality && dateInWeek(r.Date, currentWeek));
  }

  function render() {
    const rows = rowsForActiveWeek();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No entries for this municipality this week.</td></tr>';
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
