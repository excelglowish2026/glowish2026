const PAGE_SIZE = 30;

// Slices a full row array down to just the rows for `page` (1-indexed).
function pageSlice(rows, page) {
  const start = (page - 1) * PAGE_SIZE;
  return rows.slice(start, start + PAGE_SIZE);
}

// Renders Prev/Next controls into containerEl. Hides itself entirely when
// there's only one page, so nothing shows for short lists. onPageChange is
// called with the new page number when Prev/Next is clicked.
function renderPager(containerEl, totalItems, currentPage, onPageChange) {
  if (!containerEl) return;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  if (totalItems <= PAGE_SIZE) {
    containerEl.innerHTML = '';
    containerEl.hidden = true;
    return;
  }

  containerEl.hidden = false;
  const page = Math.min(Math.max(1, currentPage), totalPages);

  containerEl.innerHTML = `
    <button type="button" class="pager-btn" data-dir="prev" ${page === 1 ? 'disabled' : ''}>\u2039 Prev</button>
    <span class="pager-label">Page ${page} of ${totalPages} &middot; ${totalItems} total</span>
    <button type="button" class="pager-btn" data-dir="next" ${page === totalPages ? 'disabled' : ''}>Next \u203a</button>
  `;

  const prevBtn = containerEl.querySelector('[data-dir="prev"]');
  const nextBtn = containerEl.querySelector('[data-dir="next"]');
  if (prevBtn) prevBtn.addEventListener('click', () => onPageChange(page - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => onPageChange(page + 1));
}
