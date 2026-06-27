// ================================================================
// Auditorias.gs — dominio: auditorías, detalle, productividad,
// observaciones, criterios y configuración. Contrato de columnas
// existente preservado (freeze zone: no renombrar, solo agregar al final).
// ================================================================

// ── GETTERS (devuelven payload plano; el router envuelve con ok_) ──
function getConfigDominio_() {
  const { rows } = readSheet_(SHEETS.CONFIGURACION);
  if (!rows.length) return { config: null };
  const c = {};
  rows.forEach(r => { if (r[0]) c[String(r[0]).trim()] = r[1]; });
  const toArr = val => val ? String(val).split(",").map(s => s.trim()).filter(Boolean) : [];
  return {
    config: {
      agentes:         toArr(c["agentes"]),
      auditores:       toArr(c["auditores"]),
      horas_base:      Number(c["horas_base"])       || 44,
      tickets_base:    Number(c["tickets_base"])     || 660,
      muestras_semana: Number(c["muestras_semana"])  || 4,
      w_inter:         Number(c["w_interacciones"])  || 60,
      w_puntual:       Number(c["w_puntualidad"])    || 20,
      w_present:       Number(c["w_presentismo"])    || 20,
      obj_puntual:     Number(c["obj_puntual"])      || 1,
      obj_present:     Number(c["obj_present"])      || 1,
      u_excelente:     Number(c["umbral_excelente"]) || 95,
      u_correcta:      Number(c["umbral_correcta"])  || 80,
      w_calidad:       Number(c["w_calidad"])        || 50,
      w_productividad: Number(c["w_productividad"])  || 50,
    },
  };
}

function getAuditorias_() {
  const { headers, rows } = readSheet_(SHEETS.AUDITORIAS);
  if (!rows.length) return { auditorias: [] };
  const auditorias = rows.filter(r => r[0]).map(r => {
    const o = rowToObj_(r, headers);
    return {
      id: o["id_auditoria"] || "", id_auditoria: o["id_auditoria"] || "",
      fecha_registro: formatDate_(o["fecha_registro"]), fecha_auditoria: formatDate_(o["fecha_auditoria"]),
      anio: o["anio"] || "", mes: o["mes"] || "", semana: o["semana"] || "",
      auditor: o["auditor"] || "", agente: o["agente"] || "",
      ticket: String(o["ticket"]) || "", canal: o["canal"] || "", tipo: o["tipo"] || "",
      horas_trabajadas: Number(o["horas_trabajadas"]) || 0,
      objetivo_interacciones: Number(o["objetivo_interacciones"]) || 0,
      interacciones_reales: Number(o["interacciones_reales"]) || 0,
      dias_tarde: Number(o["dias_tarde"]) || 0, dias_faltas: Number(o["dias_faltas"]) || 0,
      calidad: numberOrNull_(o["pct_calidad"]), productividad: numberOrNull_(o["pct_productividad"]),
      general: numberOrNull_(o["pct_general"]), estado: o["estado"] || "",
      requiere_seguimiento: o["requiere_seguimiento"] || "No",
      obs_general: o["obs_general"] || "", obs_desvios: o["obs_desvios"] || "",
      obs_accion: o["obs_accion"] || "", resp_seguimiento: o["resp_seguimiento"] || "",
      client_request_id: o["client_request_id"] || "",
      sheets_enviado: true, criterios: [],
    };
  });
  return { auditorias };
}

function getDetalle_() {
  const { headers, rows } = readSheet_(SHEETS.DETALLE);
  const detalle = {};
  rows.forEach(r => {
    if (!r[0]) return;
    const o = rowToObj_(r, headers);
    const id = o["id_auditoria"]; if (!id) return;
    if (!detalle[id]) detalle[id] = [];
    detalle[id].push({
      cod: o["criterio_codigo"] || "", nombre: o["criterio_nombre"] || "",
      bloque: o["bloque"] || "", peso: Number(o["peso_porcentaje"]) || 0,
      cumple: o["cumple_si_no"] || "", obtenido: Number(o["porcentaje_obtenido"]) || 0,
    });
  });
  return { detalle };
}

function getCriterios_() {
  const sheet = getSheet_(SHEETS.CRITERIOS);
  if (sheet.getLastRow() <= 1) { sembrarCriteriosDefault_(sheet); return { criterios: CRITERIOS_DEFAULT }; }
  const { headers, rows } = readSheet_(SHEETS.CRITERIOS);
  const criterios = rows.filter(r => r[0]).map(r => {
    const o = rowToObj_(r, headers);
    return {
      cod: o["cod"] || "", bloque: o["bloque"] || "", nombre: o["nombre"] || "",
      peso: Number(o["peso"]) || 0, activo: String(o["activo"]).toLowerCase() !== "false",
    };
  });
  return { criterios };
}

function getProductividadSemanal_() {
  const { headers, rows } = readSheet_(SHEETS.PRODUCTIVIDAD_SEMANAL);
  const productividad = rows.filter(r => r[0]).map(r => rowToObj_(r, headers));
  return { productividad };
}

// ── INSERT auditoría completa (idempotente por client_request_id) ──
function insertAuditoriaCompleta_(p, ses) {
  if (p.criterios && p.criterios.length) {
    const sum = p.criterios.reduce((s, c) => s + (Number(c.peso) || 0), 0);
    if (Math.abs(sum - 100) > 1)
      writeLog_("insert_warn", "auditorias", p.id_auditoria || "?", "WARN", "Pesos suman " + sum + "%", ses.email);
  }
  const clientRequestId = String(p.client_request_id || "").trim();
  if (!clientRequestId) throw new Error("client_request_id requerido para registrar una auditoría");

  const existingId = _findAuditoriaByClientRequestId(clientRequestId);
  if (existingId) return ok_({ id: existingId, duplicate: true });

  validateMuestrasSemana_(p);
  p.id_auditoria = _getNextAuditoriaId();
  p.id = p.id_auditoria;
  _insertAuditoria(p);
  _insertDetalleCalidad(p);
  _insertObservacion(p);
  writeLog_("insert_completo", "auditorias", p.id_auditoria, "OK", "", ses.email);
  return ok_({ id: p.id_auditoria });
}

function _getNextAuditoriaId() {
  const props = PropertiesService.getScriptProperties();
  let last = Number(props.getProperty(PROP_LAST_ID)) || 0;
  if (!last) {
    const { rows } = readSheet_(SHEETS.AUDITORIAS);
    last = rows.reduce((max, row) => {
      const value = parseInt(String(row[0]).replace("AUD-", ""), 10);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
  }
  const next = last + 1;
  props.setProperty(PROP_LAST_ID, String(next));
  return "AUD-" + String(next).padStart(4, "0");
}

function _findAuditoriaByClientRequestId(clientRequestId) {
  if (!clientRequestId) return "";
  const { headers, rows } = readSheet_(SHEETS.AUDITORIAS);
  const reqCol = headers.indexOf("client_request_id");
  const idCol  = headers.indexOf("id_auditoria");
  if (reqCol === -1 || idCol === -1) return "";
  const row = rows.find(v => String(v[reqCol]) === clientRequestId);
  return row ? String(row[idCol]) : "";
}

function _insertAuditoria(p) {
  const sheet = getSheet_(SHEETS.AUDITORIAS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(col => {
    if (col === "timestamp_registro") return new Date().toISOString();
    if (col === "w_calidad")          return p.w_calidad || 50;
    if (col === "w_productividad")    return p.w_productividad || 50;
    return p[col] !== undefined ? p[col] : "";
  });
  sheet.appendRow(row);
}

function _insertDetalleCalidad(p) {
  if (!p.criterios || !p.criterios.length) return;
  const sheet = getSheet_(SHEETS.DETALLE);
  p.criterios.forEach((c, i) => sheet.appendRow([
    p.id_auditoria + "-DET-" + String(i + 1).padStart(3, "0"),
    p.id_auditoria, c.bloque, c.cod, c.nombre, c.peso, c.cumple, c.obtenido,
  ]));
}

function _insertObservacion(p) {
  if (!p.obs_general && !p.obs_desvios && !p.obs_accion) return;
  getSheet_(SHEETS.OBSERVACIONES).appendRow([
    p.id_auditoria + "-OBS", p.id_auditoria, new Date().toISOString(), p.agente, p.ticket,
    p.obs_general || "", p.obs_desvios || "", p.obs_accion || "",
    p.requiere_seguimiento || "No", p.resp_seguimiento || "",
    String(p.requiere_seguimiento || "").toLowerCase().startsWith("s") ? "Pendiente" : "N/A",
  ]);
}

// ── DELETE auditoría (4 hojas + log) ────────────────────────────
function deleteAuditoria_(id, ses) {
  if (!id) return err_("id_auditoria requerido");
  [SHEETS.AUDITORIAS, SHEETS.DETALLE, SHEETS.PRODUCTIVIDAD, SHEETS.OBSERVACIONES].forEach(name => {
    const s = getSheet_(name);
    const lr = s.getLastRow();
    if (lr <= 1) return;
    const headerRow = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
    const colIdx = headerRow.indexOf("id_auditoria");
    if (colIdx === -1) return;
    const values = s.getRange(2, colIdx + 1, lr - 1, 1).getValues();
    const matches = values.reduce((acc, row, i) => { if (String(row[0]) === String(id)) acc.push(i + 2); return acc; }, []);
    while (matches.length) {
      const end = matches.pop();
      let start = end;
      while (matches.length && matches[matches.length - 1] === start - 1) start = matches.pop();
      s.deleteRows(start, end - start + 1);
    }
  });
  writeLog_("delete_auditoria", "auditorias", id, "OK", "Eliminado desde UI", ses.email);
  return ok_({ deleted: id });
}

// ── CONFIG (upsert por fila, no destructivo) ────────────────────
function handleConfigChange_(p, ses) {
  const now = new Date().toISOString();
  const par = p.parametros || {};
  const sheet = getSheet_(SHEETS.CONFIGURACION);
  const params = [
    ["agentes",          (p.agentes || []).join(", "),   "lista",    "Agentes activos"],
    ["auditores",        (p.auditores || []).join(", "), "lista",    "Auditores del sistema"],
    ["horas_base",       par.horas_base     || 44,       "hs",       "Semana estándar de referencia"],
    ["tickets_base",     par.tickets_base   || 660,      "tickets",  "Objetivo para semana completa"],
    ["muestras_semana",  par.muestras_semana|| 4,        "muestras", "Auditorías recomendadas/agente/semana"],
    ["w_interacciones",  par.w_inter        || 60,       "%",        "Peso interacciones en productividad"],
    ["w_puntualidad",    par.w_puntual      || 20,       "%",        "Peso puntualidad en productividad"],
    ["w_presentismo",    par.w_present      || 20,       "%",        "Peso presentismo en productividad"],
    ["obj_puntual",      par.obj_puntual    || 1,        "días",     "Máx. días tarde permitidos/semana"],
    ["obj_present",      par.obj_present    || 1,        "días",     "Máx. días falta permitidos/semana"],
    ["umbral_excelente", par.u_excelente    || 95,       "%",        "Mínimo para estado Excelente"],
    ["umbral_correcta",  par.u_correcta     || 80,       "%",        "Mínimo para estado Correcta"],
    ["w_calidad",        par.w_calidad      || 50,       "%",        "Peso calidad en score general"],
    ["w_productividad",  par.w_productividad|| 50,       "%",        "Peso productividad en score general"],
  ];
  const lastRow = sheet.getLastRow();
  const existingKeys = {};
  if (lastRow > 1) {
    const keyCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    keyCol.forEach((r, i) => { if (r[0]) existingKeys[String(r[0]).trim()] = i + 2; });
  }
  params.forEach(([key, val, unit, desc]) => {
    if (existingKeys[key]) {
      sheet.getRange(existingKeys[key], 2).setValue(val);
      sheet.getRange(existingKeys[key], 5).setValue(now);
    } else {
      sheet.appendRow([key, val, unit, desc, now]);
    }
  });
  getSheet_(SHEETS.CONFIG_LOG).appendRow([
    "CFGLOG-" + Date.now(), now, p.accion || "cambio_config",
    typeof p.detalle === "object" ? JSON.stringify(p.detalle) : (p.detalle || ""),
    (p.agentes || []).join(", "), (p.auditores || []).join(", "), JSON.stringify(par),
  ]);
  writeLog_("config_change", "configuracion", "", "OK", p.accion || "Configuración actualizada", ses.email);
  return ok_({ type: "config_synced" });
}

// ── CRITERIOS ───────────────────────────────────────────────────
function handleUpdateCriterios_(criterios, ses) {
  if (!criterios || !criterios.length) return ok_({ type: "criterios_updated" });
  validatePesosCriterios_(criterios);
  const sheet = getSheet_(SHEETS.CRITERIOS);
  const lr = sheet.getLastRow();
  if (lr > 1) sheet.getRange(2, 1, lr - 1, HEADERS_DOMINIO.criterios_calidad.length).clearContent();
  const now = new Date().toISOString();
  criterios.forEach(c => sheet.appendRow([c.cod, c.bloque, c.nombre, c.peso, c.activo !== false, now]));
  writeLog_("update_criterios", "criterios_calidad", "", "OK", "Criterios actualizados", ses.email);
  return ok_({ type: "criterios_updated" });
}

function sembrarCriteriosDefault_(sheet) {
  const now = new Date().toISOString();
  CRITERIOS_DEFAULT.forEach(c => sheet.appendRow([c.cod, c.bloque, c.nombre, c.peso, c.activo, now]));
}

// ── PRODUCTIVIDAD semanal (upsert por agente+año+semana) ────────
function upsertProductividadSemanal_(p, ses) {
  const agente = String(p.agente || "").trim(), semana = Number(p.semana), anio = Number(p.anio);
  if (!agente || !Number.isInteger(semana) || semana < 1 || semana > 53 || !Number.isInteger(anio))
    throw new Error("Agente, año y semana válidos son obligatorios");
  const sheet = getSheet_(SHEETS.PRODUCTIVIDAD_SEMANAL);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const now = new Date().toISOString(), id = "PROD-" + agente + "-" + anio + "-" + semana;
  const fields = {
    id_productividad: id, fecha_registro: now, fecha_actualizacion: now, anio, mes: p.mes || "",
    semana, agente, horas_trabajadas: Number(p.horas_trabajadas) || 0,
    objetivo_interacciones: Number(p.objetivo_interacciones) || 0, interacciones_reales: Number(p.interacciones_reales) || 0,
    dias_tarde: Number(p.dias_tarde) || 0, dias_faltas: Number(p.dias_faltas) || 0,
    pct_interacciones: Number(p.pct_interacciones) || 0, pct_puntualidad: Number(p.pct_puntualidad) || 0,
    pct_presentismo: Number(p.pct_presentismo) || 0, total_productividad: Number(p.total_productividad) || 0,
    w_inter: Number(p.w_inter) || 60, w_puntual: Number(p.w_puntual) || 20, w_present: Number(p.w_present) || 20,
    auditor: ses.email || "",
  };
  const lr = sheet.getLastRow();
  const rows = lr > 1 ? sheet.getRange(2, 1, lr - 1, headers.length).getValues() : [];
  const iA = headers.indexOf("agente"), iN = headers.indexOf("anio"), iS = headers.indexOf("semana");
  const found = rows.findIndex(r => String(r[iA]) === agente && Number(r[iN]) === anio && Number(r[iS]) === semana);
  const row = headers.map(h => fields[h] !== undefined ? fields[h] : "");
  if (found >= 0) {
    const old = rows[found];
    headers.forEach((h, i) => { if (fields[h] === undefined) row[i] = old[i]; });
    sheet.getRange(found + 2, 1, 1, row.length).setValues([row]);
    writeLog_("upsert_productividad_semanal", "productividad_semanal", id, "OK", "", ses.email);
    return ok_({ id, updated: true });
  }
  sheet.appendRow(row);
  writeLog_("upsert_productividad_semanal", "productividad_semanal", id, "OK", "", ses.email);
  return ok_({ id, created: true });
}
