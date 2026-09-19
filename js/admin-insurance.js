(() => {
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const panel = document.getElementById('panel-insurance');
  if (!panel) return;

  const monthTabsEl = document.getElementById('insurance-month-tabs');
  const tbody = document.getElementById('insurance-tbody');
  const statusEl = document.getElementById('insurance-status');
  const formContainer = document.getElementById('form-container-insurance');
  const exportBtn = document.getElementById('export-insurance-csv');

  let allRows = [];
  let activeMonth = MONTHS[new Date().getMonth()];
  let loaded = false;

  document.addEventListener('DOMContentLoaded', () => {
    // Guard hard: even though the tab button is hidden for non-owners,
    // never fetch or build this tab's contents for anyone but the owner.
    const raw = sessionStorage.getItem('session');
    if (!raw) return;
    const session = JSON.parse(raw);
    if (session.role !== 'owner') return;

    buildForm();
    renderMonthTabs();
    document.querySelector('.tab[data-target="panel-insurance"]').addEventListener('click', () => {
      if (!loaded) load();
    });
    exportBtn.addEventListener('click', exportCsv);
  });

  function renderMonthTabs() {
    monthTabsEl.innerHTML = MONTHS.map((m) => `
      <button type="button" class="month-tab-btn${m === activeMonth ? ' active' : ''}" data-month="${m}">${m}</button>
    `).join('');
    monthTabsEl.querySelectorAll('.month-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeMonth = btn.dataset.month;
        renderMonthTabs();
        renderTable();
        document.getElementById('f-insurance-Month').value = activeMonth;
      });
    });
  }

  async function load() {
    if (!apiConfigured()) return;
    setStatus('Loading insurance records…');
    try {
      const res = await apiGet({ action: 'getInsurance' });
      if (!res.success) throw new Error(res.error);
      allRows = res.rows;
      renderTable();
      setStatus('');
      loaded = true;
    } catch (err) {
      setStatus('Couldn’t load insurance records: ' + err.message, true);
    }
  }

  function renderTable() {
    const rows = allRows.filter((r) => r.Month === activeMonth);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No records for ' + escapeHtml(activeMonth) + ' yet.</td></tr>';
      return;
    }
    // Newest date first within the month, so recent entries surface at top.
    const sorted = [...rows].sort((a, b) => String(b.Date || '').localeCompare(String(a.Date || '')));
    tbody.innerHTML = sorted.map((r) => `
      <tr>
        <td>${fmtDate(r.Date)}</td>
        <td>${escapeHtml(r.Name)}</td>
        <td>${fmtDate(r.Birthdate)}</td>
        <td>${escapeHtml(r.Address)}</td>
        ${remarksCellHtml(r.Remarks)}
        <td class="row-actions">
          <button type="button" class="link-btn ins-edit-btn" data-row="${r._row}">Edit</button>
          <button type="button" class="link-btn delete-btn ins-delete-btn" data-row="${r._row}">Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.ins-edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => startEdit(btn.dataset.row));
    });
    tbody.querySelectorAll('.ins-delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => confirmDelete(btn.dataset.row));
    });
  }

  function buildForm() {
    const monthOptions = MONTHS.map((m) => `<option value="${m}" ${m === activeMonth ? 'selected' : ''}>${m}</option>`).join('');
    formContainer.innerHTML = `
      <form class="entry-form" id="form-insurance" data-edit-row="">
        <h3 id="form-title-insurance">Add record</h3>
        <p class="status-line" id="form-status-insurance"></p>
        <div class="form-grid">
          <div class="field">
            <label for="f-insurance-Month">Month tab</label>
            <select id="f-insurance-Month" name="Month" required>${monthOptions}</select>
          </div>
          <div class="field"><label for="f-insurance-Date">Date</label><input id="f-insurance-Date" name="Date" type="date" required /></div>
          <div class="field wide"><label for="f-insurance-Name">Name</label><input id="f-insurance-Name" name="Name" required /></div>
          <div class="field"><label for="f-insurance-Birthdate">Birthdate</label><input id="f-insurance-Birthdate" name="Birthdate" type="date" /></div>
          <div class="field wide"><label for="f-insurance-Address">Address</label><input id="f-insurance-Address" name="Address" /></div>
          <div class="field wide"><label for="f-insurance-Remarks">Remarks</label><input id="f-insurance-Remarks" name="Remarks" /></div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-secondary">Add record</button>
          <button type="button" class="refresh-btn" id="cancel-edit-insurance" hidden>Cancel edit</button>
        </div>
      </form>
    `;
    const form = document.getElementById('form-insurance');
    form.addEventListener('submit', handleSubmit);
    document.getElementById('cancel-edit-insurance').addEventListener('click', resetForm);

    // Picking a date auto-jumps the Month dropdown to match it (e.g. a date
    // of 05-28-26 selects "May"), but it stays a normal dropdown so it can
    // still be overridden by hand if a record needs to sit in a different tab.
    form.elements['Date'].addEventListener('change', () => {
      const val = form.elements['Date'].value;
      if (!val) return;
      const monthIndex = parseInt(val.split('-')[1], 10) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        form.elements['Month'].value = MONTHS[monthIndex];
      }
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('form-insurance');
    const fStatus = document.getElementById('form-status-insurance');
    if (!apiConfigured()) { setFormStatus(fStatus, 'Not connected to a spreadsheet yet.', true); return; }

    const data = {
      Month: form.elements['Month'].value,
      Date: form.elements['Date'].value,
      Name: form.elements['Name'].value.trim(),
      Birthdate: form.elements['Birthdate'].value,
      Address: form.elements['Address'].value.trim(),
      Remarks: form.elements['Remarks'].value.trim()
    };

    const editRow = form.dataset.editRow;
    const isEditing = !!editRow;
    const payload = isEditing
      ? { action: 'updateInsurance', row: parseInt(editRow, 10), data }
      : { action: 'addInsurance', data };

    setFormStatus(fStatus, isEditing ? 'Updating…' : 'Saving…');
    try {
      const res = await apiPost(payload);
      if (!res.success) throw new Error(res.error);
      setFormStatus(fStatus, isEditing ? 'Record updated.' : 'Record added.');
      resetForm();
      await load();
    } catch (err) {
      setFormStatus(fStatus, 'Couldn’t save: ' + err.message, true);
    }
  }

  function startEdit(rowNum) {
    const rowObj = allRows.find((r) => String(r._row) === String(rowNum));
    if (!rowObj) return;
    const form = document.getElementById('form-insurance');
    form.elements['Month'].value = rowObj.Month;
    form.elements['Date'].value = rowObj.Date ? String(rowObj.Date).slice(0, 10) : '';
    form.elements['Name'].value = rowObj.Name || '';
    form.elements['Birthdate'].value = rowObj.Birthdate ? String(rowObj.Birthdate).slice(0, 10) : '';
    form.elements['Address'].value = rowObj.Address || '';
    form.elements['Remarks'].value = rowObj.Remarks || '';
    form.dataset.editRow = rowNum;
    document.getElementById('form-title-insurance').textContent = 'Edit record';
    form.querySelector('button[type="submit"]').textContent = 'Update record';
    document.getElementById('cancel-edit-insurance').hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetForm() {
    const form = document.getElementById('form-insurance');
    form.reset();
    form.elements['Month'].value = activeMonth;
    form.elements['Date'].value = '';
    form.dataset.editRow = '';
    document.getElementById('form-title-insurance').textContent = 'Add record';
    form.querySelector('button[type="submit"]').textContent = 'Add record';
    document.getElementById('cancel-edit-insurance').hidden = true;
  }

  async function confirmDelete(rowNum) {
    if (!window.confirm('Delete this insurance record? This can’t be undone.')) return;
    try {
      const res = await apiPost({ action: 'deleteInsurance', row: parseInt(rowNum, 10) });
      if (!res.success) throw new Error(res.error);
      await load();
    } catch (err) {
      window.alert('Couldn’t delete: ' + err.message);
    }
  }

  function exportCsv() {
    const rows = allRows.filter((r) => r.Month === activeMonth);
    if (!rows.length) { window.alert('Nothing to export for ' + activeMonth + '.'); return; }
    const headers = ['Month', 'Date', 'Name', 'Birthdate', 'Address', 'Remarks'];
    const lines = [headers.join(',')];
    rows.forEach((r) => {
      lines.push(headers.map((h) => csvEscape(r[h])).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insurance-${activeMonth.toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function csvEscape(v) {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', !!isError);
  }

  function setFormStatus(el, msg, isError) {
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
  }
})();
