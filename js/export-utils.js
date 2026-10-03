// Shared export helpers. "PDF" export opens a clean, print-ready page and
// triggers the browser's print dialog — the person chooses "Save as PDF"
// there. This avoids pulling in a heavy PDF-generation library for what's
// fundamentally a simple printable report.

function csvEscapeVal(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCsv(filename, headers, rows, rowMapper) {
  if (!rows.length) { window.alert('Nothing to export for this range.'); return; }
  const lines = [headers.join(',')];
  rows.forEach((r) => lines.push(rowMapper(r).map(csvEscapeVal).join(',')));
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

function openPrintView(title, subtitle, bodyHtml) {
  const win = window.open('', '_blank');
  if (!win) { window.alert('Please allow pop-ups for this site to export as PDF.'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; padding: 28px; color: #1C2A24; }
  h1 { font-size: 19px; margin: 0 0 2px; }
  p.meta { color: #666; font-size: 12px; margin: 0 0 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 18px; }
  th, td { border: 1px solid #ccc; padding: 6px 9px; text-align: left; }
  th { background: #f2f2f2; }
  td.num, th.num { text-align: right; }
  .totals-row td { font-weight: bold; background: #fafafa; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<h1>${escapeHtml(title)}</h1>
${subtitle ? `<p class="meta">${escapeHtml(subtitle)}</p>` : ''}
${bodyHtml}
<script>window.onload = function() { window.print(); };</script>
</body></html>`);
  win.document.close();
}
