(() => {
  const panel = document.getElementById('panel-ledger');
  const tbody = document.getElementById('ledger-tbody');
  const form = document.getElementById('ledger-form');
  const status = document.getElementById('ledger-status');
  const refreshBtn = document.getElementById('ledger-refresh');

  let loaded = false;

  panel.addEventListener('panel:show', () => {
    initStoreField(form.store);
    if (!loaded) load();
  });
  refreshBtn.addEventListener('click', load);

  async function load() {
    if (!apiConfigured()) return;
    setStatus('Loading ledger…');
    try {
      const storeFilter = SESSION.allStores ? '' : SESSION.store;
      const res = await apiGet({ action: 'getData', sheet: 'Ledger', store: storeFilter, region: SESSION.region });
      if (!res.success) throw new Error(res.error);
      render(res.rows);
      setStatus('');
      loaded = true;
    } catch (err) {
      setStatus('Couldn’t load the ledger: ' + err.message, true);
    }
  }

  function render(rows) {
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No entries yet. Add the first one below.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.Store)}</td>
        <td>${escapeHtml(r.Location)}</td>
        <td>${fmtDate(r.Date)}</td>
        <td class="num">${escapeHtml(r.BegBalance)}</td>
        <td>${escapeHtml(r.Reference)}</td>
        <td class="num">${escapeHtml(r.Delivery)}</td>
        <td class="num">${escapeHtml(r.Payment)}</td>
        <td class="num">${escapeHtml(r.Balance)}</td>
      </tr>
    `).join('');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!apiConfigured()) { setStatus('Not connected to a spreadsheet yet.', true); return; }
    const data = {
      Store: form.store.value.trim(),
      Location: form.location.value.trim(),
      Date: form.date.value,
      BegBalance: form.begBalance.value,
      Reference: form.reference.value.trim(),
      Delivery: form.delivery.value,
      Payment: form.payment.value,
      Balance: form.balance.value
    };
    setStatus('Saving…');
    try {
      const res = await apiPost({ action: 'addRow', sheet: 'Ledger', region: SESSION.region, data });
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
