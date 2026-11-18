// Admin / owner: export or print the inventory list (physical copy).
(() => {
  const scopeSel = document.getElementById('inv-export-scope');
  if (!scopeSel) return;
  const regionSel = document.getElementById('inv-export-region');
  const latestChk = document.getElementById('inv-export-latest');

  document.addEventListener('DOMContentLoaded', () => {
    regionSel.innerHTML = '<option value="">All regions</option>' +
      REGIONS.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
    document.getElementById('inv-export-print').addEventListener('click', () => run('print'));
    document.getElementById('inv-export-csv').addEventListener('click', () => run('csv'));
  });

  function currentView() {
    const v = document.querySelector('input[name="admin-inventory-view"]:checked');
    return v ? v.value : 'Old';
  }

  function collectRows() {
    let rows = ADMIN_DATA.Inventory.filter((r) => r.ItemName);
    if (regionSel.value) rows = rows.filter((r) => r.Region === regionSel.value);

    const scope = scopeSel.value;
    if (scope === 'view' || scope === 'warehouse') {
      rows = rows.filter((r) => String(r.Warehouse || '') === String(activeWarehouse || ''));
    }
    if (scope === 'view') {
      rows = rows.filter((r) => String(r.Category).toLowerCase() === currentView().toLowerCase());
    }
    if (latestChk.checked) {
      // Rows are appended in order, so the last one per item is the current stock.
      const byKey = {};
      rows.forEach((r) => { byKey[[r.Region, r.Warehouse, r.Category, r.Store, r.ItemName].join('||')] = r; });
      rows = Object.values(byKey);
    }
    const s = (v) => String(v || '').toLowerCase();
    return rows.sort((a, b) =>
      s(a.Region).localeCompare(s(b.Region)) || s(a.Warehouse).localeCompare(s(b.Warehouse)) ||
      s(a.Category).localeCompare(s(b.Category)) || s(a.ItemName).localeCompare(s(b.ItemName)));
  }

  function describe() {
    const scope = scopeSel.value;
    const parts = [];
    if (scope === 'all') parts.push('All warehouses');
    else {
      parts.push('Warehouse: ' + (activeWarehouse || '—'));
      parts.push(scope === 'view' ? currentView() + ' items' : 'Old + New items');
    }
    parts.push(regionSel.value || 'All regions');
    parts.push(latestChk.checked ? 'Current stock (latest entry per item)' : 'Full entry history');
    parts.push('Printed ' + new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }));
    return parts.join(' · ');
  }

  function run(mode) {
    const rows = collectRows();
    if (!rows.length) { window.alert('There are no inventory items to export for this selection.'); return; }

    if (mode === 'csv') {
      downloadCsv('inventory-' + new Date().toISOString().slice(0, 10) + '.csv',
        ['Region', 'Warehouse', 'Category', 'Store', 'Date', 'Item name', 'Beg.', 'In', 'Out', 'Total', 'Out to', 'Address', 'Delivered by', 'Remarks'],
        rows, (r) => [r.Region, r.Warehouse, r.Category, r.Store, fmtDate(r.Date), r.ItemName, r.Beg, r.In, r.Out, r.Total, r.OutTo, r.Address, r.DeliveredBy, r.Remarks]);
      return;
    }

    // Group: Warehouse > Category, one table each, so the printout reads like a stock sheet.
    const groups = {};
    rows.forEach((r) => {
      const k = (r.Warehouse || 'No warehouse') + ' — ' + (r.Category || '') + ' items';
      (groups[k] = groups[k] || []).push(r);
    });
    const html = Object.keys(groups).map((k) => `
      <h3>${escapeHtml(k)} <span class="cnt">(${groups[k].length})</span></h3>
      <table>
        <thead><tr><th>Region</th><th>Store</th><th>Date</th><th>Item name</th><th class="num">Beg.</th><th class="num">In</th><th class="num">Out</th><th class="num">Total</th><th>Out to</th><th>Delivered by</th><th>Remarks</th></tr></thead>
        <tbody>
          ${groups[k].map((r) => `<tr class="${isLowStock(r.Total) ? 'low' : ''}"><td>${escapeHtml(r.Region)}</td><td>${escapeHtml(r.Store)}</td><td>${escapeHtml(fmtDate(r.Date))}</td><td>${escapeHtml(r.ItemName)}</td><td class="num">${escapeHtml(r.Beg)}</td><td class="num">${escapeHtml(r.In)}</td><td class="num">${escapeHtml(r.Out)}</td><td class="num">${escapeHtml(r.Total)}</td><td>${escapeHtml(r.OutTo)}</td><td>${escapeHtml(r.DeliveredBy)}</td><td>${escapeHtml(r.Remarks)}</td></tr>`).join('')}
        </tbody>
      </table>`).join('');
    const css = '@page { size: landscape; margin: 12mm; } h3 { font-size: 14px; margin: 18px 0 6px; page-break-after: avoid; } .cnt { color:#777; font-weight:normal; } table { font-size: 11px; } tr { page-break-inside: avoid; } tr.low td.num:nth-child(8) { color: #b00020; font-weight: bold; } thead { display: table-header-group; }';
    openPrintView('Inventory list', describe(), html + '<p class="meta">Totals under 10 are shown in red.</p>', css);
  }
})();
