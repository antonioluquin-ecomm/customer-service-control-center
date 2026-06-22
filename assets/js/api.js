// ================================================================
// API — comunicación con Google Apps Script
// ================================================================

// Fetch con timeout (18 s) via AbortController
const go = (url, timeout = 18000) => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  return fetch(url, { redirect: "follow", signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

// POST base — sin barra de sync, sin manejo de sesión (usado por auth.js)
async function callApiRaw(payload) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 18000);
  let res;
  try {
    res = await fetch(CONFIG.SCRIPT_URL, {
      method:  "POST",
      mode:    "cors",
      headers: {"Content-Type": "text/plain;charset=utf-8"},
      body:    JSON.stringify(payload),
      signal:  ctrl.signal,
    });
  } catch(e) {
    clearTimeout(timer);
    throw new Error(e.name === "AbortError" ? "Tiempo de espera agotado (18s)" : "Sin conexión");
  }
  clearTimeout(timer);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json().catch(() => null);
  if (!data || data.status !== "ok") throw new Error(data?.message || "Error desconocido");
  return data;
}

// POST con barra de sync — incluye sessionToken automáticamente
async function postSheets(payload) {
  showSync("Enviando a Google Sheets...");
  const token = window.getSessionToken ? getSessionToken() : null;
  try {
    const res = await fetch(CONFIG.SCRIPT_URL, {
      method:  "POST",
      mode:    "cors",
      headers: {"Content-Type": "text/plain;charset=utf-8"},
      body:    JSON.stringify({ ...payload, sessionToken: token }),
    });
    if (!res.ok) { recordSyncMetric("http_error"); hideSync("⚠ Error HTTP " + res.status, 3000, true); return {ok:false, reason:"http_"+res.status}; }
    const data = await res.json().catch(() => null);
    if (data && data.status === "ok") { recordSyncMetric("success"); hideSync("✓ Guardado en Sheets"); return {ok:true, data}; }
    const msg = data?.message || "Error desconocido";
    recordSyncMetric("api_error");
    hideSync("⚠ " + msg, 3500, true);
    return {ok:false, reason:msg};
  } catch(e) {
    recordSyncMetric("network_error");
    hideSync("⚠ Sin conexión — guardado local", 3000, true);
    return {ok:false, reason:e.message};
  }
}

// Carga inicial: 4 endpoints en paralelo con sessionToken
async function reloadFromSheets() {
  const ov  = document.getElementById("loading-overlay");
  const msg = document.getElementById("loading-msg");
  const sub = document.getElementById("loading-sub");
  const token = window.getSessionToken ? getSessionToken() : "";
  const base  = CONFIG.SCRIPT_URL + "?sessionToken=" + encodeURIComponent(token || "");

  ov.style.display = "flex";
  msg.textContent  = "Cargando datos desde Google Sheets...";
  sub.textContent  = "Esto puede tardar unos segundos";

  try {
    const [cfgR, audR, detR, critR] = await Promise.all([
      go(base + "&action=get_config"),
      go(base + "&action=get_auditorias"),
      go(base + "&action=get_detalle"),
      go(base + "&action=get_criterios"),
    ]);
    msg.textContent = "Procesando...";
    // Si el servidor rechaza la sesión, redirigir al login
    const cfgCheck = cfgR.ok ? await cfgR.json() : null;
    if (cfgCheck && cfgCheck.status === "error" && cfgCheck.message?.includes("Sesión")) {
      ov.style.display = "none";
      if (window.authLogout) authLogout(); else window.location.href = "login.html";
      return;
    }
    if (cfgCheck && cfgCheck.status === "ok" && cfgCheck.config) applyCfg(cfgCheck.config);
    let auds = [];
    if (audR.ok)  { const d = await audR.json();  if (d.status === "ok")                auds = d.auditorias || []; }
    let det  = {};
    if (detR.ok)  { const d = await detR.json();  if (d.status === "ok")                det  = d.detalle || {}; }
    auds.forEach(a => { a.criterios = det[a.id_auditoria] || []; });
    if (critR.ok) { const d = await critR.json(); if (d.status === "ok" && d.criterios?.length) CRITERIOS = d.criterios; }
    pendingCreatePayloads().forEach(payload => {
      if (!auds.some(a => a.client_request_id === payload.client_request_id)) {
        auds.push({ ...payload, id: payload.id_auditoria, sheets_enviado:false });
      }
    });
    DB.auditorias = auds;
    updateSheetsUI("connected");
    populateSelects();
    renderDashboard();
    msg.textContent = `✓ ${auds.length} auditorías cargadas`;
    sub.textContent = "Datos actualizados correctamente";
    setTimeout(() => { ov.style.display = "none"; }, 700);
  } catch(err) {
    console.error(err);
    updateSheetsUI("disconnected");
    msg.textContent = "⚠ No se pudo conectar con Google Sheets";
    sub.textContent = "Verificá tu conexión o iniciá sesión nuevamente.";
    setTimeout(() => { ov.style.display = "none"; }, 2500);
  }
}

// Aplica configuración recibida desde Sheets
function applyCfg(c) {
  if (c.agentes?.length)         CFG.agentes          = c.agentes;
  if (c.auditores?.length)       CFG.auditores         = c.auditores;
  if (c.horas_base)              CFG.horas_base        = Number(c.horas_base);
  if (c.tickets_base)            CFG.tickets_base      = Number(c.tickets_base);
  if (c.muestras_semana)         CFG.muestras_semana   = Number(c.muestras_semana);
  if (c.w_inter   != null)       CFG.w_inter           = Number(c.w_inter);
  if (c.w_puntual != null)       CFG.w_puntual         = Number(c.w_puntual);
  if (c.w_present != null)       CFG.w_present         = Number(c.w_present);
  if (c.obj_puntual != null)     CFG.obj_puntual       = Number(c.obj_puntual);
  if (c.obj_present != null)     CFG.obj_present       = Number(c.obj_present);
  if (c.u_excelente != null)     CFG.u_excelente       = Number(c.u_excelente);
  if (c.u_correcta  != null)     CFG.u_correcta        = Number(c.u_correcta);
  if (c.w_calidad != null)       CFG.w_calidad         = Number(c.w_calidad);
  if (c.w_productividad != null) CFG.w_productividad   = Number(c.w_productividad);
}

// POST de cambios de configuración a Sheets
async function syncConfigToSheets(accion, det) {
  await postSheets({
    _type:     "config_change",
    accion,
    timestamp: new Date().toISOString(),
    agentes:   CFG.agentes,
    auditores: CFG.auditores,
    parametros: {
      horas_base: CFG.horas_base, tickets_base: CFG.tickets_base, muestras_semana: CFG.muestras_semana,
      w_inter: CFG.w_inter, w_puntual: CFG.w_puntual, w_present: CFG.w_present,
      obj_puntual: CFG.obj_puntual, obj_present: CFG.obj_present,
      u_excelente: CFG.u_excelente, u_correcta: CFG.u_correcta,
      w_calidad: CFG.w_calidad, w_productividad: CFG.w_productividad,
    },
    detalle: det || "",
  });
}
