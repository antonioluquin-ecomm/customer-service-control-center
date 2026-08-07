// ================================================================
// VolumenCanales.gs — dominio: carga diaria de volumen por canal
// (WSP, Llamadas, Redes, Mails, Ventas, Reembolsos/CC).
// Reemplaza la carga manual en Excel del jefe de Servicio al Cliente.
// Upsert por fecha (una fila por día) — mismo patrón que productividad_semanal.
// ================================================================

const VOLUMEN_CAMPOS_NUMERICOS = [
  "wsp_ingreso", "wsp_salida",
  "llamadas_atendidas", "llamadas_desbordadas", "llamadas_no_respondidas",
  "redes_privados", "redes_comentarios", "redes_min_privados",
  "mails_ingreso", "mails_salida",
  "ventas_ingreso", "ventas_salida", "ventas_cancelados",
  "reembolsos_pim", "pendientes_pim", "cc_gestionados", "reclamos",
];

function getVolumenCanales_() {
  const { headers, rows } = readSheet_(SHEETS.VOLUMEN_CANALES);
  if (!rows.length) return { volumen_canales: [] };
  const volumen_canales = rows.filter(r => r[0]).map(r => {
    const o = rowToObj_(r, headers);
    o.fecha = formatDate_(o.fecha);
    o.fecha_registro = formatDate_(o.fecha_registro);
    o.fecha_actualizacion = formatDate_(o.fecha_actualizacion);
    VOLUMEN_CAMPOS_NUMERICOS.forEach(c => { o[c] = numberOrNull_(o[c]); });
    o.veces_editado = Number(o.veces_editado) || 0;
    return o;
  });
  return { volumen_canales };
}

// ── UPSERT por fecha ─────────────────────────────────────────────
function upsertVolumenCanales_(p, ses) {
  const fecha = String(p.fecha || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Fecha inválida (YYYY-MM-DD)");

  const sheet = getSheet_(SHEETS.VOLUMEN_CANALES);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const now = new Date().toISOString();

  const fields = { fecha, anio: Number(p.anio) || 0, mes: p.mes || "", semana: Number(p.semana) || "" };
  VOLUMEN_CAMPOS_NUMERICOS.forEach(c => { fields[c] = numberOrNull_(p[c]); });

  const lr = sheet.getLastRow();
  const rows = lr > 1 ? sheet.getRange(2, 1, lr - 1, headers.length).getValues() : [];
  const iFecha = headers.indexOf("fecha");
  const found = rows.findIndex(r => formatDate_(r[iFecha]) === fecha);

  const row = headers.map(h => fields[h] !== undefined ? fields[h] : "");

  if (found >= 0) {
    const old = rows[found];
    const iEdit = headers.indexOf("veces_editado");
    const iReg  = headers.indexOf("fecha_registro");
    headers.forEach((h, i) => { if (fields[h] === undefined) row[i] = old[i]; });
    row[headers.indexOf("fecha_actualizacion")] = now;
    row[headers.indexOf("cargado_por")] = ses.email || "";
    row[iEdit] = (Number(old[iEdit]) || 0) + 1;
    row[iReg] = old[iReg]; // preserva el alta original
    sheet.getRange(found + 2, 1, 1, row.length).setValues([row]);
    writeLog_("upsert_volumen_canales", "volumen_canales", fecha, "OK", "Editado (" + row[iEdit] + "x)", ses.email);
    return ok_({ fecha, updated: true, veces_editado: row[iEdit] });
  }

  row[headers.indexOf("cargado_por")] = ses.email || "";
  row[headers.indexOf("fecha_registro")] = now;
  row[headers.indexOf("fecha_actualizacion")] = now;
  row[headers.indexOf("veces_editado")] = 0;
  sheet.appendRow(row);
  writeLog_("upsert_volumen_canales", "volumen_canales", fecha, "OK", "Creado", ses.email);
  return ok_({ fecha, created: true, veces_editado: 0 });
}
