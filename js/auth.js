document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');
  const configWarning = document.getElementById('config-warning');

  if (!apiConfigured()) {
    configWarning.hidden = false;
  }

  // Already logged in? skip straight through.
  const existing = sessionStorage.getItem('session');
  if (existing) {
    const session = JSON.parse(existing);
    routeToDashboard(session);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    if (!apiConfigured()) {
      errorEl.textContent = 'The site isn’t connected to a spreadsheet yet. See js/config.js.';
      errorEl.hidden = false;
      return;
    }

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Checking…';

    try {
      const result = await apiGet({ action: 'login', username, password });
      if (result.success) {
        sessionStorage.setItem('session', JSON.stringify(result));
        routeToDashboard(result);
      } else {
        errorEl.textContent = result.error || 'Invalid username or password.';
        errorEl.hidden = false;
      }
    } catch (err) {
      errorEl.textContent = 'Couldn’t reach the spreadsheet. Check your connection and try again.';
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Open the ledger';
    }
  });
});

function routeToDashboard(session) {
  window.location.href = session.role === 'admin' ? 'admin-dashboard.html' : 'dashboard.html';
}
