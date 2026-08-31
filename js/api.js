const API_NOT_CONFIGURED = APP_CONFIG.API_URL.indexOf('PASTE_YOUR') === 0;

function apiConfigured() {
  return !API_NOT_CONFIGURED;
}

async function apiGet(params) {
  const url = new URL(APP_CONFIG.API_URL);
  Object.keys(params).forEach((k) => url.searchParams.append(k, params[k]));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Network error: ' + res.status);
  return res.json();
}

async function apiPost(params) {
  const res = await fetch(APP_CONFIG.API_URL, {
    method: 'POST',
    // text/plain avoids a CORS preflight, which Apps Script web apps don't handle
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(params)
  });
  if (!res.ok) throw new Error('Network error: ' + res.status);
  return res.json();
}
