// ── API helper ────────────────────────────────────────────────────────────
// Mismo API público que vtex-control-center: callApiRaw(action, payload?)
// Internamente serializa con _type (formato del backend de AuditCS).

window.callApiRaw = async function (action, payload = {}) {
  const token = getSessionToken();
  const body  = { _type: action, ...payload };
  if (token) body.sessionToken = token;
  const res = await fetch(CONFIG.SCRIPT_URL, {
    method:  'POST',
    mode:    'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body:    JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!data || data.status !== 'ok') throw new Error(data?.message || 'Error desconocido');
  return data;
};
