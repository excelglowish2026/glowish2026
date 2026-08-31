let SESSION = null;

document.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('session');
  if (!raw) {
    window.location.href = 'index.html';
    return;
  }
  SESSION = JSON.parse(raw);
  SESSION.allStores = String(SESSION.store || '').trim().toUpperCase() === 'ALL';

  document.getElementById('store-name').textContent = SESSION.allStores
    ? 'All stores'
    : (SESSION.store || 'Unknown store');
  document.getElementById('store-region').textContent = SESSION.region || '';

  if (!apiConfigured()) {
    document.getElementById('config-banner').hidden = false;
  }

  document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('session');
    window.location.href = 'index.html';
  });

  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.page-panel');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(tab.dataset.target);
      panel.classList.add('active');
      panel.dispatchEvent(new CustomEvent('panel:show'));
    });
  });

  // Load the first (default) tab's data right away.
  document.getElementById('panel-pricelist').dispatchEvent(new CustomEvent('panel:show'));
});

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Sets up a module's "Store" input: locked to the staffer's one store, or
// a free-text field (for a staffer whose Credentials row has Store = ALL).
function initStoreField(inputEl) {
  if (SESSION.allStores) {
    inputEl.value = '';
    inputEl.readOnly = false;
    inputEl.placeholder = 'e.g. Cebu';
  } else {
    inputEl.value = SESSION.store;
    inputEl.readOnly = true;
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
