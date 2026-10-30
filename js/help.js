// Role-aware user manual. Shows only the sections that apply to whoever is
// logged in (staff with one store, staff with Store = ALL, admin, or owner).
document.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('session');
  if (!raw) { window.location.href = 'index.html'; return; }
  const session = JSON.parse(raw);

  let audience;
  let label;
  if (session.role === 'owner') { audience = 'ow'; label = 'Owner'; }
  else if (session.role === 'admin') { audience = 'ad'; label = 'Admin'; }
  else if (String(session.store || '').trim().toUpperCase() === 'ALL') { audience = 'sa'; label = 'Staff (all stores)'; }
  else { audience = 's1'; label = 'Staff (' + (session.store || 'your store') + ')'; }

  document.getElementById('audience-label').textContent = label;
  document.getElementById('back-link').href =
    (audience === 'ad' || audience === 'ow') ? 'admin-dashboard.html' : 'dashboard.html';

  document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('session');
    window.location.href = 'index.html';
  });

  const intros = {
    s1: 'This guide covers everything you can do with your store account. Use the contents list to jump to a topic.',
    sa: 'This guide covers everything you can do with an all-stores staff account, including Weekly Collection and Rice Collection.',
    ad: 'This guide covers the admin dashboard: every region and store, editing and deleting rows, reports, and adding warehouses, municipalities and cities.',
    ow: 'This guide covers everything an admin can do, plus the private Insurance tab that only the owner account can see.'
  };
  document.getElementById('manual-intro').textContent = intros[audience];

  document.querySelectorAll('.manual-section li[data-for]').forEach((li) => {
    if (!li.dataset.for.split(/\s+/).includes(audience)) li.hidden = true;
  });

  const toc = document.getElementById('manual-toc');
  const links = [];
  document.querySelectorAll('.manual-section').forEach((sec) => {
    const allowed = (sec.dataset.for || '').split(/\s+/);
    if (!allowed.includes(audience)) { sec.hidden = true; return; }
    const title = sec.querySelector('h3').childNodes[0].textContent.trim();
    links.push(`<a href="#${sec.id}">${title}</a>`);
  });
  toc.innerHTML = '<strong>Contents</strong>' + links.join('');
});
