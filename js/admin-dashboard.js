let SESSION = null;

// Holds the merged (all-region) rows for each sheet, loaded once on page
// load and reused by every tab, the search boxes, and the reports tab.
let ADMIN_DATA = { PriceList: [], Ledger: [], Inventory: [], Collectibles: [] };

let WAREHOUSES = [];
let activeWarehouse = null;
let lowStockOnly = false;

const REGIONS = ['Luzon', 'Visayas', 'Mindanao'];
const PROMO_OPTIONS = ['No Promo', '50%', '40%', '30%', '25%', '20%', '10%'];

const TABLE_CONFIGS = {
  pricelist: {
    sheet: 'PriceList',
    tbody: 'admin-pricelist-tbody',
    colspan: 8,
    empty: 'No price list items found.',
    columns: [
      { key: 'Region', pill: true },
      { key: 'Store' },
      { key: 'Category' },
      { key: 'ItemName' },
      { key: 'SRP', num: true },
      { key: 'Percentage', num: true },
      { key: 'DistPrice', num: true }
    ],
    formFields: [
      { key: 'Store', label: 'Store', required: true },
      { key: 'Category', label: 'Category', required: true },
      { key: 'ItemName', label: 'Item name', required: true, wide: true },
      { key: 'SRP', label: 'SRP', type: 'number', required: true },
      { key: 'Percentage', label: 'Promo %', type: 'select', options: PROMO_OPTIONS, required: true },
      {
        key: 'DistPrice', label: 'Distributor price (auto, 20% off SRP)', type: 'computed',
        computeFrom: 'SRP', computeFn: (srp) => { const n = parseFloat(srp); return isNaN(n) ? '' : (n * 0.8).toFixed(2); }
      }
    ]
  },
  ledger: {
    sheet: 'Ledger',
    tbody: 'admin-ledger-tbody',
    colspan: 11,
    empty: 'No ledger entries found.',
    columns: [
      { key: 'Region', pill: true },
      { key: 'Store' },
      { key: 'Location' },
      { key: 'Date', date: true },
      { key: 'BegBalance', num: true },
      { key: 'Reference' },
      { key: 'Delivery', num: true },
      { key: 'Payment', num: true },
      { key: 'Balance', num: true },
      { key: 'Remarks', remarks: true }
    ],
    formFields: [
      { key: 'Store', label: 'Store', required: true },
      { key: 'Location', label: 'Location', required: true },
      { key: 'Date', label: 'Date', type: 'date', required: true },
      { key: 'BegBalance', label: 'Beginning balance', type: 'number' },
      { key: 'Reference', label: 'Reference' },
      { key: 'Delivery', label: 'Delivery', type: 'number' },
      { key: 'Payment', label: 'Payment', type: 'number' },
      { key: 'Balance', label: 'Balance', type: 'number' },
      { key: 'Remarks', label: 'Remarks', wide: true }
    ]
  },
  inventory: {
    sheet: 'Inventory',
    tbody: 'admin-inventory-tbody',
    colspan: 13,
    empty: 'Empty Inventory',
    hasCategoryToggle: true,
    hasWarehouseFilter: true,
    columns: [
      { key: 'Region', pill: true },
      { key: 'Store' },
      { key: 'Date', date: true },
      { key: 'ItemName' },
      { key: 'Beg', num: true },
      { key: 'In', num: true },
      { key: 'Out', num: true },
      { key: 'Total', num: true },
      { key: 'OutTo' },
      { key: 'Address' },
      { key: 'DeliveredBy' },
      { key: 'Remarks', remarks: true }
    ],
    formFields: [
      { key: 'Store', label: 'Store', required: true },
      { key: 'Warehouse', label: 'Warehouse', type: 'select', dynamicOptions: 'warehouses', required: true },
      { key: 'Category', label: 'Category', type: 'select', options: ['Old', 'New'], required: true },
      { key: 'Date', label: 'Date', type: 'date' },
      { key: 'ItemName', label: 'Item name', required: true, wide: true },
      { key: 'Beg', label: 'Beginning', type: 'number' },
      { key: 'In', label: 'In', type: 'number' },
      { key: 'Out', label: 'Out', type: 'number' },
      { key: 'Total', label: 'Total', type: 'number' },
      { key: 'OutTo', label: 'Out to (name)' },
      { key: 'Address', label: 'Address', wide: true },
      { key: 'DeliveredBy', label: 'Delivered by' },
      { key: 'Remarks', label: 'Remarks', wide: true }
    ]
  },
  collectibles: {
    sheet: 'Collectibles',
    tbody: 'admin-collectibles-tbody',
    colspan: 10,
    empty: 'No collectibles found.',
    columns: [
      { key: 'Region', pill: true },
      { key: 'Store' },
      { key: 'Province' },
      { key: 'District' },
      { key: 'Municipality' },
      { key: 'Date', date: true },
      { key: 'Name' },
      { key: 'Address' },
      { key: 'Balance', num: true }
    ],
    formFields: [
      { key: 'Store', label: 'Store', required: true },
      { key: 'Province', label: 'Province', required: true },
      { key: 'District', label: 'District' },
      { key: 'Municipality', label: 'Municipality' },
      { key: 'Date', label: 'Date', type: 'date', required: true },
      { key: 'Name', label: 'Name', required: true, wide: true },
      { key: 'Address', label: 'Address', wide: true },
      { key: 'Balance', label: 'Balance', type: 'number' }
    ]
  }
};

const searchTerms = { pricelist: '', ledger: '', inventory: '', collectibles: '' };
const currentPages = { pricelist: 1, ledger: 1, inventory: 1, collectibles: 1 };

document.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('session');
  if (!raw) { window.location.href = 'index.html'; return; }
  SESSION = JSON.parse(raw);
  if (SESSION.role !== 'admin' && SESSION.role !== 'owner') { window.location.href = 'dashboard.html'; return; }

  const insuranceTab = document.getElementById('tab-insurance');
  if (insuranceTab) insuranceTab.hidden = SESSION.role !== 'owner';

  if (!apiConfigured()) {
    document.getElementById('config-banner').hidden = false;
  }

  document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('session');
    window.location.href = 'index.html';
  });

  document.getElementById('refresh-all-btn').addEventListener('click', loadAllData);

  // Tabs
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.page-panel');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
      // Navigating to any tab manually exits the low-stock-only shortcut view.
      if (lowStockOnly) exitLowStockView();
    });
  });

  // Search boxes
  Object.keys(TABLE_CONFIGS).forEach((key) => {
    const input = document.getElementById('search-' + key);
    if (!input) return;
    input.addEventListener('input', () => {
      searchTerms[key] = input.value.trim().toLowerCase();
      currentPages[key] = 1;
      renderTable(key);
    });
  });

  // Inventory category toggle
  document.querySelectorAll('input[name="admin-inventory-view"]').forEach((r) => {
    r.addEventListener('change', () => { currentPages.inventory = 1; renderTable('inventory'); });
  });

  document.getElementById('add-warehouse-btn').addEventListener('click', handleAddWarehouse);
  document.getElementById('clear-low-stock-filter').addEventListener('click', exitLowStockView);

  loadAllData();
});

async function loadAllData() {
  if (!apiConfigured()) return;
  setLoadState(true);
  try {
    const [pl, lg, inv, cl, wh] = await Promise.all([
      apiGet({ action: 'getAllData', sheet: 'PriceList' }),
      apiGet({ action: 'getAllData', sheet: 'Ledger' }),
      apiGet({ action: 'getAllData', sheet: 'Inventory' }),
      apiGet({ action: 'getAllData', sheet: 'Collectibles' }),
      apiGet({ action: 'getWarehouses' })
    ]);
    ADMIN_DATA = {
      PriceList: pl.success ? pl.rows : [],
      Ledger: lg.success ? lg.rows : [],
      Inventory: inv.success ? inv.rows : [],
      Collectibles: cl.success ? cl.rows : []
    };
    WAREHOUSES = wh.success ? wh.warehouses : [];
    if (!activeWarehouse || !WAREHOUSES.includes(activeWarehouse)) {
      activeWarehouse = WAREHOUSES[0] || null;
    }
    renderWarehouseTabs();
    renderOverview();
    Object.keys(TABLE_CONFIGS).forEach(renderTable);
    document.getElementById('refresh-timestamp').textContent =
      'Last updated ' + new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    document.dispatchEvent(new CustomEvent('admin-data:loaded'));
  } catch (err) {
    document.getElementById('refresh-timestamp').textContent = 'Couldn’t load data: ' + err.message;
  } finally {
    setLoadState(false);
  }
}

function setLoadState(loading) {
  const btn = document.getElementById('refresh-all-btn');
  btn.disabled = loading;
  btn.textContent = loading ? 'Loading…' : 'Refresh all data';
}

/* ---------------- Warehouses ---------------- */

function renderWarehouseTabs() {
  const el = document.getElementById('admin-warehouse-tabs');
  if (!el) return;
  if (!WAREHOUSES.length) {
    el.innerHTML = '<span class="panel-meta">No warehouses yet — add one below.</span>';
    return;
  }
  el.innerHTML = WAREHOUSES.map((w) => `
    <button type="button" class="warehouse-tab-btn${w === activeWarehouse ? ' active' : ''}" data-warehouse="${escapeHtml(w)}">${escapeHtml(w)}</button>
  `).join('');
  el.querySelectorAll('.warehouse-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeWarehouse = btn.dataset.warehouse;
      currentPages.inventory = 1;
      renderWarehouseTabs();
      renderTable('inventory');
    });
  });
}

async function handleAddWarehouse() {
  const name = window.prompt('New warehouse name (e.g. "Cavite"):');
  if (!name || !name.trim()) return;
  try {
    const res = await apiPost({ action: 'addWarehouse', name: name.trim() });
    if (!res.success) throw new Error(res.error);
    await loadAllData();
  } catch (err) {
    window.alert('Couldn’t add warehouse: ' + err.message);
  }
}

/* ---------------- Low stock ---------------- */

function isLowStock(total) {
  const n = parseFloat(total);
  return !isNaN(n) && n < 10;
}

// Latest entry per Region+Warehouse+Store+Item — same "last row wins" logic
// as the ledger balance fix, so a low-stock count reflects current stock,
// not every historical movement row.
function latestInventoryEntries() {
  const byKey = {};
  ADMIN_DATA.Inventory.forEach((r) => {
    if (!r.ItemName) return;
    const key = [r.Region, r.Warehouse, r.Store, r.ItemName].join('||');
    byKey[key] = r;
  });
  return Object.values(byKey);
}

function lowStockEntries() {
  return latestInventoryEntries().filter((r) => isLowStock(r.Total));
}

function showLowStockView() {
  lowStockOnly = true;
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.page-panel').forEach((p) => p.classList.remove('active'));
  const tabBtn = document.querySelector('.tab[data-target="panel-inventory"]');
  if (tabBtn) tabBtn.classList.add('active');
  document.getElementById('panel-inventory').classList.add('active');
  document.getElementById('low-stock-banner').hidden = false;
  document.getElementById('inventory-normal-view').hidden = true;
  document.getElementById('inventory-low-stock-view').hidden = false;
  renderLowStockTable();
}

function exitLowStockView() {
  lowStockOnly = false;
  document.getElementById('low-stock-banner').hidden = true;
  document.getElementById('inventory-normal-view').hidden = false;
  document.getElementById('inventory-low-stock-view').hidden = true;
}

function renderLowStockTable() {
  const rows = lowStockEntries().sort((a, b) => toNumber(a.Total) - toNumber(b.Total));
  const tbody = document.getElementById('low-stock-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Nothing below 10 units right now.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((r) => `
    <tr class="low-stock-row">
      <td><span class="region-pill">${escapeHtml(r.Region)}</span></td>
      <td>${escapeHtml(r.Warehouse)}</td>
      <td>${escapeHtml(r.Store)}</td>
      <td>${escapeHtml(r.ItemName)}</td>
      <td class="num">${escapeHtml(r.Total)}</td>
    </tr>
  `).join('');
}

/* ---------------- Overview ---------------- */

function renderOverview() {
  const stores = distinctStores();
  const ledgerBalances = latestLedgerBalanceByStore();
  const totalLedgerBalance = sumValues(Object.values(ledgerBalances));
  const totalCollectibles = sumValues(ADMIN_DATA.Collectibles.map((r) => r.Balance));
  const distinctItems = new Set(ADMIN_DATA.Inventory.map((r) => r.ItemName).filter(Boolean));
  const lowStockCount = lowStockEntries().length;

  const kpis = [
    { label: 'Active stores', value: stores.length, sub: REGIONS.length + ' regions' },
    { label: 'Price list items', value: ADMIN_DATA.PriceList.length, sub: '' },
    { label: 'Outstanding ledger balance', value: formatMoney(totalLedgerBalance), sub: 'across all stores' },
    { label: 'Outstanding collectibles', value: formatMoney(totalCollectibles), sub: ADMIN_DATA.Collectibles.length + ' records' },
    { label: 'Inventory items tracked', value: distinctItems.size, sub: ADMIN_DATA.Inventory.length + ' entries' },
    { label: 'Low stock items', value: lowStockCount, sub: 'below 10 units — click to view', id: 'kpi-low-stock' }
  ];

  document.getElementById('kpi-grid').innerHTML = kpis.map((k) => `
    <div class="kpi-card${k.id ? ' kpi-clickable' : ''}" ${k.id ? `id="${k.id}"` : ''}>
      <p class="kpi-label">${escapeHtml(k.label)}</p>
      <p class="kpi-value">${escapeHtml(k.value)}</p>
      ${k.sub ? `<p class="kpi-sub">${escapeHtml(k.sub)}</p>` : ''}
    </div>
  `).join('');

  const lowStockCard = document.getElementById('kpi-low-stock');
  if (lowStockCard) lowStockCard.addEventListener('click', showLowStockView);

  document.getElementById('region-breakdown').innerHTML = REGIONS.map((region) => {
    const regionStores = stores.filter((s) => s.region === region);
    const regionLedger = sumValues(
      Object.entries(ledgerBalances).filter(([k]) => k.startsWith(region + '||')).map(([, v]) => v)
    );
    const regionCollectibles = sumValues(
      ADMIN_DATA.Collectibles.filter((r) => r.Region === region).map((r) => r.Balance)
    );
    const regionPriceItems = ADMIN_DATA.PriceList.filter((r) => r.Region === region).length;
    return `
      <div class="region-card">
        <h4>${escapeHtml(region)}</h4>
        <ul>
          <li><span>Stores</span><span>${regionStores.length}</span></li>
          <li><span>Price list items</span><span>${regionPriceItems}</span></li>
          <li><span>Ledger balance</span><span>${formatMoney(regionLedger)}</span></li>
          <li><span>Collectibles</span><span>${formatMoney(regionCollectibles)}</span></li>
        </ul>
      </div>
    `;
  }).join('');
}

function distinctStores() {
  const seen = new Map();
  [...ADMIN_DATA.PriceList, ...ADMIN_DATA.Ledger, ...ADMIN_DATA.Inventory, ...ADMIN_DATA.Collectibles].forEach((r) => {
    if (!r.Store || !r.Region) return;
    const key = r.Region + '||' + r.Store;
    if (!seen.has(key)) seen.set(key, { region: r.Region, store: r.Store });
  });
  return Array.from(seen.values());
}

function latestLedgerBalanceByStore() {
  const byStore = {};
  // Sheet rows are always appended to the bottom, never inserted elsewhere,
  // so the LAST row seen for a store is the most recent one — this is more
  // reliable than comparing Date, since correction/return rows sometimes
  // have no Date filled in and would otherwise get skipped as "older."
  ADMIN_DATA.Ledger.forEach((r) => {
    if (!r.Store || !r.Region) return;
    const key = r.Region + '||' + r.Store;
    byStore[key] = toNumber(r.Balance);
  });
  return byStore;
}

/* ---------------- Tables + search ---------------- */

function renderTable(key) {
  const cfg = TABLE_CONFIGS[key];
  const tbody = document.getElementById(cfg.tbody);
  if (!tbody) return;
  const pagerEl = document.getElementById('pager-' + key);

  let rows = ADMIN_DATA[cfg.sheet] || [];

  if (cfg.hasCategoryToggle) {
    const view = document.querySelector('input[name="admin-inventory-view"]:checked');
    if (view) rows = rows.filter((r) => String(r.Category).toLowerCase() === view.value.toLowerCase());
  }

  if (cfg.hasWarehouseFilter) {
    rows = rows.filter((r) => String(r.Warehouse || '') === String(activeWarehouse || ''));
  }

  const term = searchTerms[key];
  if (term) {
    rows = rows.filter((r) => cfg.columns.some((c) => String(r[c.key] ?? '').toLowerCase().includes(term)));
  }

  const countEl = document.getElementById('count-' + key);
  if (countEl) countEl.textContent = rows.length + (rows.length === 1 ? ' result' : ' results');

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="${cfg.colspan}" class="empty-row">${escapeHtml(cfg.empty)}</td></tr>`;
    if (pagerEl) pagerEl.hidden = true;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  currentPages[key] = Math.min(Math.max(1, currentPages[key] || 1), totalPages);
  const pageRows = pageSlice(rows, currentPages[key]);

  tbody.innerHTML = pageRows.map((r) => {
    const low = key === 'inventory' && isLowStock(r.Total);
    return `
    <tr class="${low ? 'low-stock-row' : ''}">
      ${cfg.columns.map((c) => {
        const val = r[c.key];
        if (c.pill) return `<td><span class="region-pill">${escapeHtml(val)}</span></td>`;
        if (c.date) return `<td>${escapeHtml(fmtDate(val))}</td>`;
        if (c.remarks) return remarksCellHtml(val);
        if (c.num) return `<td class="num">${escapeHtml(val)}</td>`;
        return `<td>${escapeHtml(val)}</td>`;
      }).join('')}
      <td class="row-actions">
        <button type="button" class="link-btn edit-btn" data-key="${key}" data-region="${escapeHtml(r.Region)}" data-row="${r._row}">Edit</button>
        <button type="button" class="link-btn delete-btn" data-key="${key}" data-region="${escapeHtml(r.Region)}" data-row="${r._row}">Delete</button>
      </td>
    </tr>
  `;
  }).join('');

  if (pagerEl) {
    renderPager(pagerEl, rows.length, currentPages[key], (p) => { currentPages[key] = p; renderTable(key); });
  }
}

/* ---------------- Shared helpers ---------------- */

function toNumber(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function sumValues(arr) {
  return arr.reduce((sum, v) => sum + toNumber(v), 0);
}

function formatMoney(n) {
  return '₱' + toNumber(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateKey(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  return dt.toISOString().slice(0, 10);
}

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
