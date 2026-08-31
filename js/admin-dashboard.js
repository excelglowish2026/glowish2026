let SESSION = null;

// Holds the merged (all-region) rows for each sheet, loaded once on page
// load and reused by every tab, the search boxes, and the reports tab.
let ADMIN_DATA = { PriceList: [], Ledger: [], Inventory: [], Collectibles: [] };

const REGIONS = ['Luzon', 'Visayas', 'Mindanao'];

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
      { key: 'Percentage', label: 'Percentage', type: 'number' },
      { key: 'DistPrice', label: 'Distributor price', type: 'number', required: true }
    ]
  },
  ledger: {
    sheet: 'Ledger',
    tbody: 'admin-ledger-tbody',
    colspan: 10,
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
      { key: 'Balance', num: true }
    ],
    formFields: [
      { key: 'Store', label: 'Store', required: true },
      { key: 'Location', label: 'Location', required: true },
      { key: 'Date', label: 'Date', type: 'date', required: true },
      { key: 'BegBalance', label: 'Beginning balance', type: 'number' },
      { key: 'Reference', label: 'Reference' },
      { key: 'Delivery', label: 'Delivery', type: 'number' },
      { key: 'Payment', label: 'Payment', type: 'number' },
      { key: 'Balance', label: 'Balance', type: 'number' }
    ]
  },
  inventory: {
    sheet: 'Inventory',
    tbody: 'admin-inventory-tbody',
    colspan: 12,
    empty: 'No inventory items found.',
    hasCategoryToggle: true,
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
      { key: 'DeliveredBy' }
    ],
    formFields: [
      { key: 'Store', label: 'Store', required: true },
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
  if (SESSION.role !== 'admin') { window.location.href = 'dashboard.html'; return; }

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

  loadAllData();
});

async function loadAllData() {
  if (!apiConfigured()) return;
  setLoadState(true);
  try {
    const [pl, lg, inv, cl] = await Promise.all([
      apiGet({ action: 'getAllData', sheet: 'PriceList' }),
      apiGet({ action: 'getAllData', sheet: 'Ledger' }),
      apiGet({ action: 'getAllData', sheet: 'Inventory' }),
      apiGet({ action: 'getAllData', sheet: 'Collectibles' })
    ]);
    ADMIN_DATA = {
      PriceList: pl.success ? pl.rows : [],
      Ledger: lg.success ? lg.rows : [],
      Inventory: inv.success ? inv.rows : [],
      Collectibles: cl.success ? cl.rows : []
    };
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

/* ---------------- Overview ---------------- */

function renderOverview() {
  const stores = distinctStores();
  const ledgerBalances = latestLedgerBalanceByStore();
  const totalLedgerBalance = sumValues(Object.values(ledgerBalances));
  const totalCollectibles = sumValues(ADMIN_DATA.Collectibles.map((r) => r.Balance));
  const distinctItems = new Set(ADMIN_DATA.Inventory.map((r) => r.ItemName).filter(Boolean));

  const kpis = [
    { label: 'Active stores', value: stores.length, sub: REGIONS.length + ' regions' },
    { label: 'Price list items', value: ADMIN_DATA.PriceList.length, sub: '' },
    { label: 'Outstanding ledger balance', value: formatMoney(totalLedgerBalance), sub: 'across all stores' },
    { label: 'Outstanding collectibles', value: formatMoney(totalCollectibles), sub: ADMIN_DATA.Collectibles.length + ' records' },
    { label: 'Inventory items tracked', value: distinctItems.size, sub: ADMIN_DATA.Inventory.length + ' entries' }
  ];

  document.getElementById('kpi-grid').innerHTML = kpis.map((k) => `
    <div class="kpi-card">
      <p class="kpi-label">${escapeHtml(k.label)}</p>
      <p class="kpi-value">${escapeHtml(k.value)}</p>
      ${k.sub ? `<p class="kpi-sub">${escapeHtml(k.sub)}</p>` : ''}
    </div>
  `).join('');

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
  ADMIN_DATA.Ledger.forEach((r) => {
    if (!r.Store || !r.Region) return;
    const key = r.Region + '||' + r.Store;
    const dk = dateKey(r.Date);
    if (!byStore[key] || (dk && dk > byStore[key].dk)) {
      byStore[key] = { dk: dk || '', balance: toNumber(r.Balance) };
    }
  });
  const result = {};
  Object.keys(byStore).forEach((k) => { result[k] = byStore[k].balance; });
  return result;
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

  tbody.innerHTML = pageRows.map((r) => `
    <tr>
      ${cfg.columns.map((c) => {
        const val = r[c.key];
        if (c.pill) return `<td><span class="region-pill">${escapeHtml(val)}</span></td>`;
        if (c.date) return `<td>${escapeHtml(fmtDate(val))}</td>`;
        if (c.num) return `<td class="num">${escapeHtml(val)}</td>`;
        return `<td>${escapeHtml(val)}</td>`;
      }).join('')}
      <td class="row-actions">
        <button type="button" class="link-btn edit-btn" data-key="${key}" data-region="${escapeHtml(r.Region)}" data-row="${r._row}">Edit</button>
        <button type="button" class="link-btn delete-btn" data-key="${key}" data-region="${escapeHtml(r.Region)}" data-row="${r._row}">Delete</button>
      </td>
    </tr>
  `).join('');

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
