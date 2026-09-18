// A single reusable overlay dialog for showing a block of text — used for
// Ledger/Inventory Remarks so long notes don't force wide table columns.
function showTextModal(title, text) {
  closeTextModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'text-modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal-head">
        <h3>${escapeHtml(title)}</h3>
        <button type="button" class="modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">${escapeHtml(text) || '<em>No remarks.</em>'}</div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTextModal();
  });
  overlay.querySelector('.modal-close').addEventListener('click', closeTextModal);
  document.addEventListener('keydown', escCloseModal);
  document.body.appendChild(overlay);
}

function closeTextModal() {
  const existing = document.getElementById('text-modal-overlay');
  if (existing) existing.remove();
  document.removeEventListener('keydown', escCloseModal);
}

function escCloseModal(e) {
  if (e.key === 'Escape') closeTextModal();
}

// Builds a table cell for a Remarks-style column: short preview inline,
// with a "View" link that opens the full text in a modal when it's long
// enough to be worth truncating.
function remarksCellHtml(text) {
  const val = (text ?? '').toString();
  if (!val.trim()) return '<td class="remarks-cell">—</td>';
  const preview = val.length > 28 ? val.slice(0, 28) + '…' : val;
  const needsView = val.length > 28;
  return `<td class="remarks-cell">
    <span class="remarks-preview">${escapeHtml(preview)}</span>
    ${needsView ? `<button type="button" class="link-btn view-remarks-btn" data-remarks="${escapeHtml(val)}">View</button>` : ''}
  </td>`;
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.view-remarks-btn');
  if (btn) showTextModal('Remarks', btn.dataset.remarks);
});
