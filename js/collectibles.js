(() => {
  const panel = document.getElementById('panel-collectibles');
  const tbody = document.getElementById('collectibles-tbody');
  const form = document.getElementById('collectibles-form');
  const status = document.getElementById('collectibles-status');
  const refreshBtn = document.getElementById('collectibles-refresh');

  let loaded = false;

  panel.addEventListener('panel:show', () => {
    initStoreField(form.store);
    if (!loaded) load();
  });
  refreshBtn.addEventListener('click', load);

  async function load() {
    if (!apiConfigured()) return;
    setStatus('Loading collectibles…');
    try {
      const storeFilter = SESSION.allStores ? '' : SESSION.store;
      const res = await apiGet({ action: 'getData', sheet: 'Collectibles', store: storeFilter, region: SESSION.region });
      if (!res.success) throw new Error(res.error);
      render(res.rows);
      setStatus('');
      loaded = true;
    } catch (err) {
      setStatus('Couldn’t load collectibles: ' + err.message, true);
    }
  }

  function render(rows) {
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No collections logged yet. Add the first one below.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.Store)}</td>
        <td>${escapeHtml(r.Province)}</td>
        <td>${escapeHtml(r.District)}</td>
        <td>${escapeHtml(r.Municipality)}</td>
        <td>${fmtDate(r.Date)}</td>
        <td>${escapeHtml(r.Name)}</td>
        <td>${escapeHtml(r.Address)}</td>
        <td class="num">${escapeHtml(r.Balance)}</td>
      </tr>
    `).join('');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!apiConfigured()) { setStatus('Not connected to a spreadsheet yet.', true); return; }
    const data = {
      Store: form.store.value.trim(),
      Province: form.province.value.trim(),
      District: form.district.value.trim(),
      Municipality: form.municipality.value.trim(),
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
      setStatus('Entry added.');
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
