// ================================================================
// Logger.gs — writeLog_ (LOGS) y writeError_ (ERRORS).
// Toda escritura genera una fila en LOGS; los errores técnicos van a ERRORS.
// ================================================================

function writeLog_(accion, entidad, entidadId, resultado, detalle, usuario) {
  try {
    getSheet_(SHEETS.LOGS).appendRow([
      getNextId_(SHEETS.LOGS),
      new Date(),
      accion || "",
      entidad || "",
      entidadId || "",
      usuario || "",
      resultado || "OK",
      detalle || "",
    ]);
  } catch (_) { /* nunca romper el flujo por un fallo de logging */ }
}

function writeError_(accion, mensaje, stack, usuario) {
  try {
    getSheet_(SHEETS.ERRORS).appendRow([
      getNextId_(SHEETS.ERRORS),
      new Date(),
      accion || "",
      usuario || "",
      mensaje || "",
      stack || "",
    ]);
  } catch (_) { /* idem */ }
}

// Compatibilidad con call sites del backend viejo: logEnvio(id, accion, resultado, error, actor).
// Mapea al LOGS estándar (entidad="auditorias").
function logEnvio_(id, accion, resultado, error, actor) {
  writeLog_(accion, "auditorias", id, resultado, error, actor);
}
