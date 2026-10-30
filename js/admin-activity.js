// Admin monitoring: who added / edited / deleted what, and where.
(() => {
  const panel = document.getElementById('panel-activity');
  if (!panel) return;

  const tbody = document.getElementById('activity-tbody');
  const pagerEl = document.getElementById('pager-activity');
  const statusEl = document.getElementById('activity-status');
  const countEl = document.getElementById('activity-count');
  const roleSel = document.getElementById('activity-role');
  const userSel = document.getElementById('activity-user');
  const tabSel = document.getElementById('activity-tab');
  const actionSel = document.getElementById('activity-action');
  const searchInput = document.getElementById('activity-search');

  let allRows = [];
  let filtered = [];
  let currentPage = 1;
  let loaded = false;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('[data-target="panel-activity"]').addEventListener('click', () => {
      if (!loaded) load();
    });
    document.getElementById('activity-refresh').addEventListener('click', load);
    [roleSel, userSel, tabSel, actionSel].forEach((el) => el.addEventListener('change', () => { currentPage = 1; render(); }));
    searchInput.addEventListener('input', () => { currentPage = 1; render(); });
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('.activity-view-btn');
      if (btn) openDetail(filtered[parseInt(btn.dataset.index, 10)]);
    });
  });

  async function load() {
    if (!apiConfigured()) return;
    setStatus('Loading activity…');
    try {
      const res = await apiGet({ action: 'getActivityLog', limit: 3000 });
      if (!res.success) throw new Error(res.error);
      allRows = res.rows || [];
      fillSelect(userSel, 'All users', allRows.map((r) => r.Username));
      fillSelect(tabSel, 'All tabs', allRows.map((r) => r.Tab));
      currentPage = 1;
      render();
      setStatus(allRows.length ? '' : 'Nothing has been logged yet. Activity appears here once someone adds, edits or deletes an entry (after the updated Apps Script is deployed).');
      loaded = true;
    } catch (err) {
      setStatus('Couldn’t load activity: ' + err.message, true);
    }
  }

  function fillSelect(sel, allLabel, values) {
    const current = sel.value;
    const uniq = Array.from(new Set(values.filter(Boolean))).sort();
    sel.innerHTML = `<option value="">${allLabel}</option>` +
      uniq.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    if (uniq.includes(current)) sel.value = current;
  }

  function render() {
    const term = searchInput.value.trim().toLowerCase();
    filtered = allRows.filter((r) =>
      (!roleSel.value || r.Role === roleSel.value) &&
      (!userSel.value || r.Username === userSel.value) &&
      (!tabSel.value || r.Tab === tabSel.value) &&
      (!actionSel.value || r.Action === actionSel.value) &&
      (!term || [r.Username, r.Tab, r.Action, r.Summary, r.Store, r.Region].some((v) => String(v || '').toLowerCase().includes(term))));

    countEl.textContent = filtered.length + (filtered.length === 1 ? ' action' : ' actions');

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No activity matches these filters.</td></tr>';
      pagerEl.hidden = true;
      return;
    }
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    tbody.innerHTML = filtered.slice(start, start + PAGE_SIZE).map((r, i) => `
      <tr>
        <td class="nowrap">${escapeHtml(fmtWhen(r.Timestamp))}</td>
        <td>${escapeHtml(r.Username)}</td>
        <td>${escapeHtml(r.Role)}</td>
        <td>${escapeHtml(r.Tab)}</td>
        <td><span class="act-badge act-${escapeHtml(String(r.Action).toLowerCase())}">${escapeHtml(r.Action)}</span></td>
        <td>${escapeHtml(r.Summary) || '—'}</td>
        <td><button type="button" class="link-btn activity-view-btn" data-index="${start + i}">View more</button></td>
      </tr>
    `).join('');
    renderPager(pagerEl, filtered.length, currentPage, (p) => { currentPage = p; render(); });
  }

  function fmtWhen(ts) {
    const d = new Date(String(ts).replace(' ', 'T'));
    if (isNaN(d)) return ts;
    return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function openDetail(r) {
    if (!r) return;
    let d = {};
    try { d = JSON.parse(r.Details || '{}'); } catch (e) { d = {}; }

    const meta = [
      ['When', fmtWhen(r.Timestamp)], ['Username', r.Username], ['Role', r.Role],
      ['Region', r.Region], ['Store', r.Store], ['Tab', r.Tab], ['Action', r.Action], ['Item', r.Summary]
    ].map(([k, v]) => `<div class="detail-item"><span class="detail-label">${escapeHtml(k)}</span><span class="detail-value">${escapeHtml(v) || '—'}</span></div>`).join('');

    let what = '';
    if (d.note) {
      what = `<p class="panel-meta">${escapeHtml(d.note)}</p>`;
    } else if (r.Action === 'Edit') {
      const ch = d.changes || [];
      what = ch.length
        ? `<table class="ledger-table activity-detail-table"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${
            ch.map((c) => `<tr><td>${escapeHtml(c.field)}</td><td>${escapeHtml(c.from) || '—'}</td><td>${escapeHtml(c.to) || '—'}</td></tr>`).join('')
          }</tbody></table>`
        : '<p class="panel-meta">Saved without changing any values.</p>';
    } else {
      const fields = d.fields || {};
      const keys = Object.keys(fields);
      what = keys.length
        ? `<table class="ledger-table activity-detail-table"><thead><tr><th>Field</th><th>${r.Action === 'Delete' ? 'Value that was deleted' : 'Value entered'}</th></tr></thead><tbody>${
            keys.map((k) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(fields[k])}</td></tr>`).join('')
          }</tbody></table>`
        : '<p class="panel-meta">No details were recorded.</p>';
    }

    showDetailModal(`${r.Action} — ${r.Tab}`, `
      <div class="detail-grid">${meta}</div>
      <h4 class="detail-subhead">${r.Action === 'Edit' ? 'What changed' : r.Action === 'Delete' ? 'What was deleted' : 'What was added'}</h4>
      <div class="table-scroll">${what}</div>
    `);
  }

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', !!isError);
  }
})();
