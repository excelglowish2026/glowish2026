(() => {
  const endInput = document.getElementById('report-end-date');
  const rangeLabel = document.getElementById('report-range-label');
  const generateBtn = document.getElementById('report-generate-btn');
  const salesBody = document.getElementById('report-sales-tbody');
  const stockBody = document.getElementById('report-stock-tbody');
  const exportSalesBtn = document.getElementById('export-sales-csv');
  const exportStockBtn = document.getElementById('export-stock-csv');

  let lastSalesRows = [];
  let lastStockRows = [];

  // Default to today, once data has loaded the first time.
  document.addEventListener('admin-data:loaded', () => {
    if (!endInput.value) {
      endInput.value = new Date().toISOString().slice(0, 10);
      generate();
    }
  }, { once: false });

  generateBtn.addEventListener('click', generate);
  exportSalesBtn.addEventListener('click', () => {
    downloadCsv('weekly-sales-report.csv', lastSalesRows, [
      'Region', 'Store', 'Entries', 'Total Delivery', 'Total Payment', 'Ending Balance'
    ], (r) => [r.Region, r.Store, r.entries, r.delivery, r.payment, r.balance]);
  });
  exportStockBtn.addEventListener('click', () => {
    downloadCsv('weekly-stock-report.csv', lastStockRows, [
      'Region', 'Store', 'Item', 'Total In', 'Total Out', 'Ending Total'
    ], (r) => [r.Region, r.Store, r.ItemName, r.totalIn, r.totalOut, r.endingTotal]);
  });

  function weekRange(endStr) {
    const end = endStr ? new Date(endStr) : new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { start, end };
  }

  function inRange(dateVal, start, end) {
    const dk = dateKey(dateVal);
    if (!dk) return false;
    const sk = start.toISOString().slice(0, 10);
    const ek = end.toISOString().slice(0, 10);
    return dk >= sk && dk <= ek;
  }

  function generate() {
    const { start, end } = weekRange(endInput.value);
    rangeLabel.textContent =
      start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + '–' +
      end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

    renderSales(start, end);
    renderStock(start, end);
  }

  function renderSales(start, end) {
    const rowsInRange = ADMIN_DATA.Ledger.filter((r) => inRange(r.Date, start, end));

    const byStore = {};
    rowsInRange.forEach((r) => {
      const key = r.Region + '||' + r.Store;
      if (!byStore[key]) {
        byStore[key] = { Region: r.Region, Store: r.Store, entries: 0, delivery: 0, payment: 0, balance: 0, latestDk: '' };
      }
      const b = byStore[key];
      b.entries += 1;
      b.delivery += toNumber(r.Delivery);
      b.payment += toNumber(r.Payment);
      const dk = dateKey(r.Date) || '';
      if (dk >= b.latestDk) { b.latestDk = dk; b.balance = toNumber(r.Balance); }
    });

    const rows = Object.values(byStore).sort((a, b) => a.Region.localeCompare(b.Region) || a.Store.localeCompare(b.Store));
    lastSalesRows = rows;

    if (!rows.length) {
      salesBody.innerHTML = '<tr><td colspan="6" class="empty-row">No ledger activity in this range.</td></tr>';
      return;
    }

    const totalDelivery = sumValues(rows.map((r) => r.delivery));
    const totalPayment = sumValues(rows.map((r) => r.payment));

    salesBody.innerHTML = rows.map((r) => `
      <tr>
        <td><span class="region-pill">${escapeHtml(r.Region)}</span></td>
        <td>${escapeHtml(r.Store)}</td>
        <td class="num">${r.entries}</td>
        <td class="num">${formatMoney(r.delivery)}</td>
        <td class="num">${formatMoney(r.payment)}</td>
        <td class="num">${formatMoney(r.balance)}</td>
      </tr>
    `).join('') + `
      <tr class="report-total-row">
        <td colspan="3">Total</td>
        <td class="num">${formatMoney(totalDelivery)}</td>
        <td class="num">${formatMoney(totalPayment)}</td>
        <td></td>
      </tr>
    `;
  }

  function renderStock(start, end) {
    const rowsInRange = ADMIN_DATA.Inventory.filter((r) => inRange(r.Date, start, end));

    const byItem = {};
    rowsInRange.forEach((r) => {
      const key = r.Region + '||' + r.Store + '||' + r.ItemName;
      if (!byItem[key]) {
        byItem[key] = { Region: r.Region, Store: r.Store, ItemName: r.ItemName, totalIn: 0, totalOut: 0, endingTotal: 0, latestDk: '' };
      }
      const b = byItem[key];
      b.totalIn += toNumber(r.In);
      b.totalOut += toNumber(r.Out);
      const dk = dateKey(r.Date) || '';
      if (dk >= b.latestDk) { b.latestDk = dk; b.endingTotal = toNumber(r.Total); }
    });

    const rows = Object.values(byItem).sort((a, b) =>
      a.Region.localeCompare(b.Region) || a.Store.localeCompare(b.Store) || a.ItemName.localeCompare(b.ItemName));
    lastStockRows = rows;

    if (!rows.length) {
      stockBody.innerHTML = '<tr><td colspan="6" class="empty-row">No inventory movement in this range.</td></tr>';
      return;
    }

    const totalIn = sumValues(rows.map((r) => r.totalIn));
    const totalOut = sumValues(rows.map((r) => r.totalOut));

    stockBody.innerHTML = rows.map((r) => `
      <tr>
        <td><span class="region-pill">${escapeHtml(r.Region)}</span></td>
        <td>${escapeHtml(r.Store)}</td>
        <td>${escapeHtml(r.ItemName)}</td>
        <td class="num">${r.totalIn}</td>
        <td class="num">${r.totalOut}</td>
        <td class="num">${r.endingTotal}</td>
      </tr>
    `).join('') + `
      <tr class="report-total-row">
        <td colspan="3">Total</td>
        <td class="num">${totalIn}</td>
        <td class="num">${totalOut}</td>
        <td></td>
      </tr>
    `;
  }

  function downloadCsv(filename, rows, headers, rowMapper) {
    if (!rows.length) return;
    const lines = [headers.join(',')];
    rows.forEach((r) => {
      lines.push(rowMapper(r).map(csvEscape).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function csvEscape(v) {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
})();
