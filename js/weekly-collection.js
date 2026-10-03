(() => {
  const panel = document.getElementById('panel-weeklycollection');
  if (!panel) return;

  const weekDateInput = document.getElementById('wc-week-date');
  const loadWeekBtn = document.getElementById('wc-load-week');
  const weekLabel = document.getElementById('wc-week-label');
  const refreshBtn = document.getElementById('wc-refresh');
  const summaryGrid = document.getElementById('wc-summary-grid');

  let currentWeek = mondaySaturdayWeek();
  let loaded = false;

  panel.addEventListener('panel:show', () => {
    initStoreField(collectionsModule.form.store);
    initStoreField(expensesModule.form.store);
    if (!weekDateInput.value) weekDateInput.value = toDateKey(new Date());
    if (!loaded) loadAll();
  });

  loadWeekBtn.addEventListener('click', () => {
    currentWeek = mondaySaturdayWeek(weekDateInput.value);
    renderWeekLabel();
    renderAll();
  });
  refreshBtn.addEventListener('click', loadAll);

  document.querySelectorAll('input[name="wc-view"]').forEach((r) => {
    r.addEventListener('change', () => {
      const showCollections = document.querySelector('input[name="wc-view"]:checked').value === 'collections';
      document.getElementById('wc-collections-view').hidden = !showCollections;
      document.getElementById('wc-expenses-view').hidden = showCollections;
    });
  });

  function renderWeekLabel() {
    weekLabel.textContent = formatWeekLabel(currentWeek);
  }

  async function loadAll() {
    renderWeekLabel();
    await Promise.all([collectionsModule.load(), expensesModule.load()]);
    renderAll();
    loaded = true;
  }

  function renderAll() {
    collectionsModule.render();
    expensesModule.render();
    renderSummary();
  }

  function renderSummary() {
    const collRows = collectionsModule.rowsInWeek();
    const expRows = expensesModule.rowsInWeek();
    const totalCollections = sumAmounts(collRows);
    const totalExpenses = sumAmounts(expRows);
    const net = totalCollections - totalExpenses;

    summaryGrid.innerHTML = [
      { label: 'Total collections', value: formatMoneyWC(totalCollections), sub: collRows.length + ' entries' },
      { label: 'Total expenses', value: formatMoneyWC(totalExpenses), sub: expRows.length + ' entries' },
      { label: 'Net', value: formatMoneyWC(net), sub: 'collections \u2212 expenses' }
    ].map((k) => `
      <div class="kpi-card">
        <p class="kpi-label">${escapeHtml(k.label)}</p>
        <p class="kpi-value">${escapeHtml(k.value)}</p>
        <p class="kpi-sub">${escapeHtml(k.sub)}</p>
      </div>
    `).join('');
  }

  function sumAmounts(rows) {
    return rows.reduce((sum, r) => sum + (parseFloat(r.Amount) || 0), 0);
  }

  function formatMoneyWC(n) {
    return '\u20b1' + (n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ---- Collections ----
  const collectionsModule = makeWeeklyModule({
    sheet: 'WeeklyCollection',
    tbodyId: 'wc-collections-tbody',
    pagerId: 'pager-wc-collections',
    formId: 'wc-collections-form',
    statusId: 'wc-collections-status',
    colspan: 6,
    renderRow: (r) => `
      <tr>
        <td>${fmtDate(r.Date)}</td>
        <td>${escapeHtml(r.DistributorName)}</td>
        <td class="num">${escapeHtml(r.Amount)}</td>
        <td>${escapeHtml(r.ContactPerson)}</td>
        <td>${escapeHtml(r.ContactNo)}</td>
        ${remarksCellHtml(r.Remarks)}
      </tr>
    `,
    buildData: (form) => ({
      Store: form.store.value.trim(),
      Date: form.date.value,
      DistributorName: form.distributorName.value.trim(),
      Amount: form.amount.value,
      ContactPerson: form.contactPerson.value.trim(),
      ContactNo: form.contactNo.value.trim(),
      Remarks: form.remarks.value.trim()
    })
  });

  // ---- Expenses ----
  const expensesModule = makeWeeklyModule({
    sheet: 'WeeklyExpenses',
    tbodyId: 'wc-expenses-tbody',
    pagerId: 'pager-wc-expenses',
    formId: 'wc-expenses-form',
    statusId: 'wc-expenses-status',
    colspan: 3,
    renderRow: (r) => `
      <tr>
        <td>${fmtDate(r.Date)}</td>
        <td>${escapeHtml(r.Particular)}</td>
        <td class="num">${escapeHtml(r.Amount)}</td>
      </tr>
    `,
    buildData: (form) => ({
      Store: form.store.value.trim(),
      Date: form.date.value,
      Particular: form.particular.value.trim(),
      Amount: form.amount.value
    })
  });

  function makeWeeklyModule(cfg) {
    const tbody = document.getElementById(cfg.tbodyId);
    const pagerEl = document.getElementById(cfg.pagerId);
    const form = document.getElementById(cfg.formId);
    const statusEl = document.getElementById(cfg.statusId);

    let allRows = [];
    let currentPage = 1;

    async function load() {
      if (!apiConfigured()) return;
      setStatus('Loading\u2026');
      try {
        const storeFilter = SESSION.allStores ? '' : SESSION.store;
        const res = await apiGet({ action: 'getData', sheet: cfg.sheet, store: storeFilter, region: SESSION.region });
        if (!res.success) throw new Error(res.error);
        allRows = res.rows;
        currentPage = 1;
        setStatus('');
      } catch (err) {
        setStatus('Couldn\u2019t load: ' + err.message, true);
      }
    }

    function rowsInWeek() {
      return allRows.filter((r) => dateInWeek(r.Date, currentWeek));
    }

    function rowsInRange(start, end) {
      return allRows.filter((r) => dateInRange(r.Date, start, end));
    }

    function render() {
      const rows = rowsInWeek();
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="${cfg.colspan}" class="empty-row">No entries for this week.</td></tr>`;
        pagerEl.hidden = true;
        return;
      }
      const pageRows = pageSlice(rows, currentPage);
      tbody.innerHTML = pageRows.map(cfg.renderRow).join('');
      renderPager(pagerEl, rows.length, currentPage, (p) => { currentPage = p; render(); });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!apiConfigured()) { setStatus('Not connected to a spreadsheet yet.', true); return; }
      const data = cfg.buildData(form);
      setStatus('Saving\u2026');
      try {
        const res = await apiPost({ action: 'addRow', sheet: cfg.sheet, region: SESSION.region, data });
        if (!res.success) throw new Error(res.error);
        form.reset();
        setStatus('Entry added.');
        await load();
        renderAll();
      } catch (err) {
        setStatus('Couldn\u2019t save: ' + err.message, true);
      }
    });

    function setStatus(msg, isError) {
      statusEl.textContent = msg;
      statusEl.classList.toggle('error', !!isError);
    }

    return { form, load, render, rowsInWeek, rowsInRange };
  }

  // ---- Export ----
  document.getElementById('wc-export-week-csv').addEventListener('click', () => {
    exportCollections(collectionsModule.rowsInWeek(), expensesModule.rowsInWeek(), 'week-' + toDateKey(currentWeek.start), formatWeekLabel(currentWeek), 'csv');
  });
  document.getElementById('wc-export-week-pdf').addEventListener('click', () => {
    exportCollections(collectionsModule.rowsInWeek(), expensesModule.rowsInWeek(), 'week-' + toDateKey(currentWeek.start), formatWeekLabel(currentWeek), 'pdf');
  });
  document.getElementById('wc-export-month-csv').addEventListener('click', () => {
    const bounds = monthBoundsFor(weekDateInput.value);
    exportCollections(collectionsModule.rowsInRange(bounds.start, bounds.end), expensesModule.rowsInRange(bounds.start, bounds.end), 'month-' + toDateKey(bounds.start).slice(0, 7), formatMonthLabel(bounds), 'csv');
  });
  document.getElementById('wc-export-month-pdf').addEventListener('click', () => {
    const bounds = monthBoundsFor(weekDateInput.value);
    exportCollections(collectionsModule.rowsInRange(bounds.start, bounds.end), expensesModule.rowsInRange(bounds.start, bounds.end), 'month-' + toDateKey(bounds.start).slice(0, 7), formatMonthLabel(bounds), 'pdf');
  });

  function exportCollections(collRows, expRows, filenameBase, rangeLabel, format) {
    const totalColl = sumAmounts(collRows);
    const totalExp = sumAmounts(expRows);
    if (format === 'csv') {
      const rows = [
        ...collRows.map((r) => ({ Section: 'Collection', Date: fmtDate(r.Date), Name: r.DistributorName, Amount: r.Amount, Contact: r.ContactPerson, ContactNo: r.ContactNo, Remarks: r.Remarks })),
        ...expRows.map((r) => ({ Section: 'Expense', Date: fmtDate(r.Date), Name: r.Particular, Amount: r.Amount, Contact: '', ContactNo: '', Remarks: '' }))
      ];
      downloadCsv(`weekly-collection-${filenameBase}.csv`,
        ['Section', 'Date', 'Name', 'Amount', 'Contact', 'Contact No.', 'Remarks'],
        rows, (r) => [r.Section, r.Date, r.Name, r.Amount, r.Contact, r.ContactNo, r.Remarks]);
      return;
    }
    const collTable = `
      <h3>Collections</h3>
      <table>
        <thead><tr><th>Date</th><th>Distributor</th><th class="num">Amount</th><th>Contact person</th><th>Contact no.</th><th>Remarks</th></tr></thead>
        <tbody>
          ${collRows.map((r) => `<tr><td>${escapeHtml(fmtDate(r.Date))}</td><td>${escapeHtml(r.DistributorName)}</td><td class="num">${escapeHtml(r.Amount)}</td><td>${escapeHtml(r.ContactPerson)}</td><td>${escapeHtml(r.ContactNo)}</td><td>${escapeHtml(r.Remarks)}</td></tr>`).join('')}
          <tr class="totals-row"><td colspan="2">Total</td><td class="num">${escapeHtml(totalColl.toFixed(2))}</td><td colspan="3"></td></tr>
        </tbody>
      </table>
      <h3>Expenses</h3>
      <table>
        <thead><tr><th>Date</th><th>Particular</th><th class="num">Amount</th></tr></thead>
        <tbody>
          ${expRows.map((r) => `<tr><td>${escapeHtml(fmtDate(r.Date))}</td><td>${escapeHtml(r.Particular)}</td><td class="num">${escapeHtml(r.Amount)}</td></tr>`).join('')}
          <tr class="totals-row"><td>Total</td><td></td><td class="num">${escapeHtml(totalExp.toFixed(2))}</td></tr>
        </tbody>
      </table>
      <p class="meta"><strong>Net (collections \u2212 expenses): ${escapeHtml((totalColl - totalExp).toFixed(2))}</strong></p>
    `;
    openPrintView('Weekly Collection Report', rangeLabel + ' \u2014 ' + (SESSION.allStores ? 'All stores' : SESSION.store), collTable);
  }
})();
