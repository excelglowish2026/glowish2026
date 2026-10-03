(() => {
  const panel = document.getElementById('panel-weeklycollection');
  if (!panel) return;

  const weekDateInput = document.getElementById('awc-week-date');
  const weekLabel = document.getElementById('awc-week-label');
  const summaryGrid = document.getElementById('awc-summary-grid');

  let currentWeek = mondaySaturdayWeek();
  let dataLoaded = { WeeklyCollection: [], WeeklyExpenses: [] };

  document.addEventListener('DOMContentLoaded', () => {
    if (!weekDateInput.value) weekDateInput.value = toDateKey(new Date());
    weekLabel.textContent = formatWeekLabel(currentWeek);

    buildForm(collectionsCfg);
    buildForm(expensesCfg);

    document.getElementById('awc-load-week').addEventListener('click', () => {
      currentWeek = mondaySaturdayWeek(weekDateInput.value);
      weekLabel.textContent = formatWeekLabel(currentWeek);
      renderAll();
    });

    document.querySelectorAll('input[name="awc-view"]').forEach((r) => {
      r.addEventListener('change', () => {
        const showCollections = document.querySelector('input[name="awc-view"]:checked').value === 'collections';
        document.getElementById('awc-collections-view').hidden = !showCollections;
        document.getElementById('awc-expenses-view').hidden = showCollections;
      });
    });

    document.addEventListener('admin-data:loaded', fetchAndRender);
  });

  async function fetchAndRender() {
    const [cRes, eRes] = await Promise.all([
      apiGet({ action: 'getAllData', sheet: 'WeeklyCollection' }),
      apiGet({ action: 'getAllData', sheet: 'WeeklyExpenses' })
    ]);
    dataLoaded.WeeklyCollection = cRes.success ? cRes.rows : [];
    dataLoaded.WeeklyExpenses = eRes.success ? eRes.rows : [];
    renderAll();
  }

  function renderAll() {
    renderTable(collectionsCfg);
    renderTable(expensesCfg);
    renderSummary();
  }

  function renderSummary() {
    const collRows = dataLoaded.WeeklyCollection.filter((r) => dateInWeek(r.Date, currentWeek));
    const expRows = dataLoaded.WeeklyExpenses.filter((r) => dateInWeek(r.Date, currentWeek));
    const totalCollections = collRows.reduce((s, r) => s + (parseFloat(r.Amount) || 0), 0);
    const totalExpenses = expRows.reduce((s, r) => s + (parseFloat(r.Amount) || 0), 0);
    const net = totalCollections - totalExpenses;
    summaryGrid.innerHTML = [
      { label: 'Total collections', value: formatMoney(totalCollections), sub: collRows.length + ' entries, all regions' },
      { label: 'Total expenses', value: formatMoney(totalExpenses), sub: expRows.length + ' entries, all regions' },
      { label: 'Net', value: formatMoney(net), sub: 'collections \u2212 expenses' }
    ].map((k) => `
      <div class="kpi-card">
        <p class="kpi-label">${escapeHtml(k.label)}</p>
        <p class="kpi-value">${escapeHtml(k.value)}</p>
        <p class="kpi-sub">${escapeHtml(k.sub)}</p>
      </div>
    `).join('');
  }

  const currentPages = { WeeklyCollection: 1, WeeklyExpenses: 1 };

  const collectionsCfg = {
    sheet: 'WeeklyCollection',
    key: 'awc-collections',
    tbody: 'awc-collections-tbody',
    pager: 'pager-awc-collections',
    formContainer: 'form-container-awc-collections',
    colspan: 9,
    fields: [
      { key: 'Store', label: 'Store', required: true },
      { key: 'Date', label: 'Date', type: 'date', required: true },
      { key: 'DistributorName', label: 'Distributor name', required: true, wide: true },
      { key: 'Amount', label: 'Amount', type: 'number', required: true },
      { key: 'ContactPerson', label: 'Contact person' },
      { key: 'ContactNo', label: 'Contact no.' },
      { key: 'Remarks', label: 'Remarks', wide: true }
    ],
    renderRow: (r) => `
      <td>${escapeHtml(r.Store)}</td>
      <td>${fmtDate(r.Date)}</td>
      <td>${escapeHtml(r.DistributorName)}</td>
      <td class="num">${escapeHtml(r.Amount)}</td>
      <td>${escapeHtml(r.ContactPerson)}</td>
      <td>${escapeHtml(r.ContactNo)}</td>
      ${remarksCellHtml(r.Remarks)}
    `
  };

  const expensesCfg = {
    sheet: 'WeeklyExpenses',
    key: 'awc-expenses',
    tbody: 'awc-expenses-tbody',
    pager: 'pager-awc-expenses',
    formContainer: 'form-container-awc-expenses',
    colspan: 6,
    fields: [
      { key: 'Store', label: 'Store', required: true },
      { key: 'Date', label: 'Date', type: 'date', required: true },
      { key: 'Particular', label: 'Particular', required: true, wide: true },
      { key: 'Amount', label: 'Amount', type: 'number', required: true }
    ],
    renderRow: (r) => `
      <td>${escapeHtml(r.Store)}</td>
      <td>${fmtDate(r.Date)}</td>
      <td>${escapeHtml(r.Particular)}</td>
      <td class="num">${escapeHtml(r.Amount)}</td>
    `
  };

  function renderTable(cfg) {
    const tbody = document.getElementById(cfg.tbody);
    const pagerEl = document.getElementById(cfg.pager);
    const rows = dataLoaded[cfg.sheet].filter((r) => dateInWeek(r.Date, currentWeek));

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${cfg.colspan}" class="empty-row">No entries for this week.</td></tr>`;
      pagerEl.hidden = true;
      return;
    }
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    currentPages[cfg.sheet] = Math.min(Math.max(1, currentPages[cfg.sheet] || 1), totalPages);
    const pageRows = pageSlice(rows, currentPages[cfg.sheet]);

    tbody.innerHTML = pageRows.map((r) => `
      <tr>
        <td><span class="region-pill">${escapeHtml(r.Region)}</span></td>
        ${cfg.renderRow(r)}
        <td class="row-actions">
          <button type="button" class="link-btn awc-edit-btn" data-key="${cfg.key}" data-region="${escapeHtml(r.Region)}" data-row="${r._row}">Edit</button>
          <button type="button" class="link-btn delete-btn awc-delete-btn" data-key="${cfg.key}" data-region="${escapeHtml(r.Region)}" data-row="${r._row}">Delete</button>
        </td>
      </tr>
    `).join('');

    renderPager(pagerEl, rows.length, currentPages[cfg.sheet], (p) => { currentPages[cfg.sheet] = p; renderTable(cfg); });
  }

  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.awc-edit-btn');
    if (editBtn) { startEdit(editBtn.dataset.key, editBtn.dataset.region, editBtn.dataset.row); return; }
    const delBtn = e.target.closest('.awc-delete-btn');
    if (delBtn) { confirmDelete(delBtn.dataset.key, delBtn.dataset.region, delBtn.dataset.row); }
  });

  function cfgByKey(key) {
    return key === collectionsCfg.key ? collectionsCfg : expensesCfg;
  }

  function buildForm(cfg) {
    const container = document.getElementById(cfg.formContainer);
    const regionOptions = REGIONS.map((r) => `<option value="${r}">${r}</option>`).join('');
    const fieldsHtml = cfg.fields.map((f) => {
      const id = `f-${cfg.key}-${f.key}`;
      const input = `<input id="${id}" name="${f.key}" type="${f.type || 'text'}" ${f.type === 'number' ? 'step="0.01"' : ''} ${f.required ? 'required' : ''} />`;
      return `<div class="field${f.wide ? ' wide' : ''}"><label for="${id}">${escapeHtml(f.label)}</label>${input}</div>`;
    }).join('');

    container.innerHTML = `
      <form class="entry-form" id="form-${cfg.key}" data-edit-row="">
        <h3 id="form-title-${cfg.key}">Add entry</h3>
        <p class="status-line" id="form-status-${cfg.key}"></p>
        <div class="form-grid">
          <div class="field"><label for="f-${cfg.key}-Region">Region</label><select id="f-${cfg.key}-Region" name="Region" required>${regionOptions}</select></div>
          ${fieldsHtml}
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-secondary">Add entry</button>
          <button type="button" class="refresh-btn" id="cancel-edit-${cfg.key}" hidden>Cancel edit</button>
        </div>
      </form>
    `;
    const form = document.getElementById(`form-${cfg.key}`);
    form.addEventListener('submit', (e) => handleSubmit(e, cfg));
    document.getElementById(`cancel-edit-${cfg.key}`).addEventListener('click', () => resetForm(cfg));
  }

  async function handleSubmit(e, cfg) {
    e.preventDefault();
    const form = document.getElementById(`form-${cfg.key}`);
    const statusEl = document.getElementById(`form-status-${cfg.key}`);
    if (!apiConfigured()) { setFormStatus(statusEl, 'Not connected to a spreadsheet yet.', true); return; }

    const region = form.elements['Region'].value;
    const data = {};
    cfg.fields.forEach((f) => { data[f.key] = form.elements[f.key].value.trim(); });

    const editRow = form.dataset.editRow;
    const isEditing = !!editRow;
    const payload = isEditing
      ? { action: 'updateRow', sheet: cfg.sheet, region, row: parseInt(editRow, 10), data }
      : { action: 'addRow', sheet: cfg.sheet, region, data };

    setFormStatus(statusEl, isEditing ? 'Updating\u2026' : 'Saving\u2026');
    try {
      const res = await apiPost(payload);
      if (!res.success) throw new Error(res.error);
      setFormStatus(statusEl, isEditing ? 'Entry updated.' : 'Entry added.');
      resetForm(cfg);
      await fetchAndRender();
    } catch (err) {
      setFormStatus(statusEl, 'Couldn\u2019t save: ' + err.message, true);
    }
  }

  function startEdit(key, region, rowNum) {
    const cfg = cfgByKey(key);
    const rowObj = dataLoaded[cfg.sheet].find((r) => r.Region === region && String(r._row) === String(rowNum));
    if (!rowObj) return;
    const form = document.getElementById(`form-${cfg.key}`);
    form.elements['Region'].value = region;
    form.elements['Region'].disabled = true;
    cfg.fields.forEach((f) => { form.elements[f.key].value = rowObj[f.key] ?? ''; });
    form.dataset.editRow = rowNum;
    document.getElementById(`form-title-${cfg.key}`).textContent = 'Edit entry';
    form.querySelector('button[type="submit"]').textContent = 'Update entry';
    document.getElementById(`cancel-edit-${cfg.key}`).hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetForm(cfg) {
    const form = document.getElementById(`form-${cfg.key}`);
    form.reset();
    form.elements['Region'].disabled = false;
    form.dataset.editRow = '';
    document.getElementById(`form-title-${cfg.key}`).textContent = 'Add entry';
    form.querySelector('button[type="submit"]').textContent = 'Add entry';
    document.getElementById(`cancel-edit-${cfg.key}`).hidden = true;
  }

  async function confirmDelete(key, region, rowNum) {
    if (!window.confirm('Delete this entry? This can\u2019t be undone.')) return;
    const cfg = cfgByKey(key);
    try {
      const res = await apiPost({ action: 'deleteRow', sheet: cfg.sheet, region, row: parseInt(rowNum, 10) });
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

  // ---- Export ----
  document.getElementById('awc-export-week-csv').addEventListener('click', () => exportIt('csv', currentWeek.start, currentWeek.end, formatWeekLabel(currentWeek), 'week-' + toDateKey(currentWeek.start)));
  document.getElementById('awc-export-week-pdf').addEventListener('click', () => exportIt('pdf', currentWeek.start, currentWeek.end, formatWeekLabel(currentWeek), 'week-' + toDateKey(currentWeek.start)));
  document.getElementById('awc-export-month-csv').addEventListener('click', () => {
    const b = monthBoundsFor(weekDateInput.value);
    exportIt('csv', b.start, b.end, formatMonthLabel(b), 'month-' + toDateKey(b.start).slice(0, 7));
  });
  document.getElementById('awc-export-month-pdf').addEventListener('click', () => {
    const b = monthBoundsFor(weekDateInput.value);
    exportIt('pdf', b.start, b.end, formatMonthLabel(b), 'month-' + toDateKey(b.start).slice(0, 7));
  });

  function exportIt(format, start, end, rangeLabel, filenameBase) {
    const collRows = dataLoaded.WeeklyCollection.filter((r) => dateInRange(r.Date, start, end));
    const expRows = dataLoaded.WeeklyExpenses.filter((r) => dateInRange(r.Date, start, end));
    const totalColl = collRows.reduce((s, r) => s + (parseFloat(r.Amount) || 0), 0);
    const totalExp = expRows.reduce((s, r) => s + (parseFloat(r.Amount) || 0), 0);

    if (format === 'csv') {
      const rows = [
        ...collRows.map((r) => ({ Section: 'Collection', Region: r.Region, Store: r.Store, Date: fmtDate(r.Date), Name: r.DistributorName, Amount: r.Amount, Contact: r.ContactPerson, ContactNo: r.ContactNo, Remarks: r.Remarks })),
        ...expRows.map((r) => ({ Section: 'Expense', Region: r.Region, Store: r.Store, Date: fmtDate(r.Date), Name: r.Particular, Amount: r.Amount, Contact: '', ContactNo: '', Remarks: '' }))
      ];
      downloadCsv(`weekly-collection-${filenameBase}.csv`,
        ['Section', 'Region', 'Store', 'Date', 'Name', 'Amount', 'Contact', 'Contact No.', 'Remarks'],
        rows, (r) => [r.Section, r.Region, r.Store, r.Date, r.Name, r.Amount, r.Contact, r.ContactNo, r.Remarks]);
      return;
    }

    const tableHtml = `
      <h3>Collections</h3>
      <table>
        <thead><tr><th>Region</th><th>Store</th><th>Date</th><th>Distributor</th><th class="num">Amount</th><th>Contact person</th><th>Contact no.</th><th>Remarks</th></tr></thead>
        <tbody>
          ${collRows.map((r) => `<tr><td>${escapeHtml(r.Region)}</td><td>${escapeHtml(r.Store)}</td><td>${escapeHtml(fmtDate(r.Date))}</td><td>${escapeHtml(r.DistributorName)}</td><td class="num">${escapeHtml(r.Amount)}</td><td>${escapeHtml(r.ContactPerson)}</td><td>${escapeHtml(r.ContactNo)}</td><td>${escapeHtml(r.Remarks)}</td></tr>`).join('')}
          <tr class="totals-row"><td colspan="4">Total</td><td class="num">${escapeHtml(totalColl.toFixed(2))}</td><td colspan="3"></td></tr>
        </tbody>
      </table>
      <h3>Expenses</h3>
      <table>
        <thead><tr><th>Region</th><th>Store</th><th>Date</th><th>Particular</th><th class="num">Amount</th></tr></thead>
        <tbody>
          ${expRows.map((r) => `<tr><td>${escapeHtml(r.Region)}</td><td>${escapeHtml(r.Store)}</td><td>${escapeHtml(fmtDate(r.Date))}</td><td>${escapeHtml(r.Particular)}</td><td class="num">${escapeHtml(r.Amount)}</td></tr>`).join('')}
          <tr class="totals-row"><td colspan="3">Total</td><td></td><td class="num">${escapeHtml(totalExp.toFixed(2))}</td></tr>
        </tbody>
      </table>
      <p class="meta"><strong>Net (collections \u2212 expenses): ${escapeHtml((totalColl - totalExp).toFixed(2))}</strong></p>
    `;
    openPrintView('Weekly Collection Report \u2014 All Regions', rangeLabel, tableHtml);
  }
})();
