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

// Who is making this change — the backend writes it into the Activity log.
function currentActor() {
  try {
    const s = JSON.parse(sessionStorage.getItem('session') || 'null');
    if (!s) return null;
    return { username: s.username || 'unknown', role: s.role || '', region: s.region || '', store: s.store || '' };
  } catch (e) { return null; }
}

async function apiPost(params) {
  if (!params.actor) {
    const actor = currentActor();
    if (actor) params = Object.assign({}, params, { actor });
  }
  const res = await fetch(APP_CONFIG.API_URL, {
    method: 'POST',
    // text/plain avoids a CORS preflight, which Apps Script web apps don't handle
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(params)
  });
  if (!res.ok) throw new Error('Network error: ' + res.status);
  return res.json();
}
