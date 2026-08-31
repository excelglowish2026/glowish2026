(() => {
  document.addEventListener('DOMContentLoaded', () => {
    Object.keys(TABLE_CONFIGS).forEach(initForm);

    // Event delegation: table rows are re-rendered on every data reload,
    // so we listen at the document level instead of rebinding per row.
    document.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit-btn');
      if (editBtn) {
        startEdit(editBtn.dataset.key, editBtn.dataset.region, editBtn.dataset.row);
        return;
      }
      const delBtn = e.target.closest('.delete-btn');
      if (delBtn) {
        confirmDelete(delBtn.dataset.key, delBtn.dataset.region, delBtn.dataset.row);
      }
    });
  });

  function initForm(key) {
    const cfg = TABLE_CONFIGS[key];
    const container = document.getElementById('form-container-' + key);
    if (!container) return;

    const regionOptions = REGIONS.map((r) => `<option value="${r}">${r}</option>`).join('');
    const fieldsHtml = cfg.formFields.map((f) => {
      const id = `f-${key}-${f.key}`;
      let input;
      if (f.type === 'select') {
        input = `<select id="${id}" name="${f.key}" ${f.required ? 'required' : ''}>` +
          f.options.map((o) => `<option value="${o}">${o}</option>`).join('') + `</select>`;
      } else {
        input = `<input id="${id}" name="${f.key}" type="${f.type || 'text'}" ` +
          `${f.type === 'number' ? 'step="0.01"' : ''} ${f.required ? 'required' : ''} />`;
      }
      return `<div class="field${f.wide ? ' wide' : ''}"><label for="${id}">${escapeHtml(f.label)}</label>${input}</div>`;
    }).join('');

    container.innerHTML = `
      <form class="entry-form" id="form-${key}" data-edit-row="" data-edit-region="">
        <h3 id="form-title-${key}">Add entry</h3>
        <p class="status-line" id="form-status-${key}"></p>
        <div class="form-grid">
          <div class="field">
            <label for="f-${key}-Region">Region</label>
            <select id="f-${key}-Region" name="Region" required>${regionOptions}</select>
          </div>
          ${fieldsHtml}
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-secondary">Add entry</button>
          <button type="button" class="refresh-btn" id="cancel-edit-${key}" hidden>Cancel edit</button>
        </div>
      </form>
    `;

    const form = document.getElementById('form-' + key);
    form.addEventListener('submit', (e) => handleSubmit(e, key));
    document.getElementById('cancel-edit-' + key).addEventListener('click', () => resetForm(key));
  }

  async function handleSubmit(e, key) {
    e.preventDefault();
    const cfg = TABLE_CONFIGS[key];
    const form = document.getElementById('form-' + key);
    const statusEl = document.getElementById('form-status-' + key);
    if (!apiConfigured()) { setFormStatus(statusEl, 'Not connected to a spreadsheet yet.', true); return; }

    const region = form.elements['Region'].value;
    const data = {};
    cfg.formFields.forEach((f) => {
      const el = form.elements[f.key];
      data[f.key] = el ? el.value.trim() : '';
    });

    const editRow = form.dataset.editRow;
    const isEditing = !!editRow;

    const payload = isEditing
      ? { action: 'updateRow', sheet: cfg.sheet, region, row: parseInt(editRow, 10), data }
      : { action: 'addRow', sheet: cfg.sheet, region, data };

    setFormStatus(statusEl, isEditing ? 'Updating…' : 'Saving…');
    try {
      const res = await apiPost(payload);
      if (!res.success) throw new Error(res.error);
      setFormStatus(statusEl, isEditing ? 'Entry updated.' : 'Entry added.');
      resetForm(key);
      await loadAllData();
    } catch (err) {
      setFormStatus(statusEl, 'Couldn’t save: ' + err.message, true);
    }
  }

  function startEdit(key, region, rowNum) {
    const cfg = TABLE_CONFIGS[key];
    const rowObj = (ADMIN_DATA[cfg.sheet] || []).find(
      (r) => r.Region === region && String(r._row) === String(rowNum)
    );
    if (!rowObj) return;

    const form = document.getElementById('form-' + key);
    form.elements['Region'].value = region;
    form.elements['Region'].disabled = true;
    cfg.formFields.forEach((f) => {
      const el = form.elements[f.key];
      if (el) el.value = rowObj[f.key] ?? '';
    });
    form.dataset.editRow = rowNum;
    form.dataset.editRegion = region;

    document.getElementById('form-title-' + key).textContent = 'Edit entry';
    form.querySelector('button[type="submit"]').textContent = 'Update entry';
    document.getElementById('cancel-edit-' + key).hidden = false;

    // Jump to the right tab and bring the form into view.
    const tabBtn = document.querySelector(`.tab[data-target="panel-${key}"]`);
    if (tabBtn) tabBtn.click();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetForm(key) {
    const form = document.getElementById('form-' + key);
    form.reset();
    form.elements['Region'].disabled = false;
    form.dataset.editRow = '';
    form.dataset.editRegion = '';
    document.getElementById('form-title-' + key).textContent = 'Add entry';
    form.querySelector('button[type="submit"]').textContent = 'Add entry';
    document.getElementById('cancel-edit-' + key).hidden = true;
  }

  async function confirmDelete(key, region, rowNum) {
    if (!window.confirm('Delete this entry? This can’t be undone.')) return;
    const cfg = TABLE_CONFIGS[key];
    try {
      const res = await apiPost({ action: 'deleteRow', sheet: cfg.sheet, region, row: parseInt(rowNum, 10) });
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
})();
