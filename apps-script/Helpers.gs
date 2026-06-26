// ================================================================
// Helpers.gs — operaciones genéricas de Sheets y respuesta JSON.
// Sin conocimiento de entidades de negocio (apps_script_standards.md §9).
// ================================================================

// ── Spreadsheet ─────────────────────────────────────────────────
// Prefiere SPREADSHEET_ID (Script Property); cae a getActiveSpreadsheet()
// para que funcione tanto standalone como bound al Sheet.
function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_SPREADSHEET_ID);
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error("No hay Spreadsheet activo y SPREADSHEET_ID no está configurado en Script Properties");
  return active;
}

// Devuelve la hoja por nombre; la crea si no existe.
function getSheet_(name) {
  const ss = getSpreadsheet_();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

// ── Lectura por nombre de header (resiliente a columnas agregadas) ──
// Devuelve { headers:[], rows:[[...]] } con las filas de datos (sin header).
function readSheet_(name) {
  const sheet = getSheet_(name);
  const lr = sheet.getLastRow();
  const lc = sheet.getLastColumn();
  if (lr < 1 || lc < 1) return { headers: [], rows: [] };
  const headers = sheet.getRange(1, 1, 1, lc).getValues()[0];
  const rows = lr > 1 ? sheet.getRange(2, 1, lr - 1, lc).getValues() : [];
  return { headers, rows };
}

// Convierte una fila plana en objeto usando los headers.
function rowToObj_(row, headers) {
  const o = {};
  headers.forEach((h, i) => { o[h] = row[i]; });
  return o;
}

// Carga todas las filas no vacías (primera columna con valor) como objetos.
function getAllRows_(name) {
  const { headers, rows } = readSheet_(name);
  return rows.filter(r => r[0] !== "" && r[0] !== null && r[0] !== undefined)
             .map(r => rowToObj_(r, headers));
}

// Índice de columna (1-based) por nombre de header; -1 si no existe.
function colIndex_(headers, name) {
  const i = headers.indexOf(name);
  return i === -1 ? -1 : i + 1;
}

// Autoincremental: max(id) + 1 sobre la primera columna.
function getNextId_(name) {
  const sheet = getSheet_(name);
  const lr = sheet.getLastRow();
  if (lr <= 1) return 1;
  const ids = sheet.getRange(2, 1, lr - 1, 1).getValues().flat()
    .map(v => parseInt(v, 10)).filter(v => !isNaN(v) && v > 0);
  return ids.length ? Math.max.apply(null, ids) + 1 : 1;
}

// ── Respuesta JSON con dual-emit ────────────────────────────────
// Mantiene { status, message, ...payload } (contrato del frontend actual)
// y agrega { ok, data, error } (estándar). El frontend lee `status`; el
// código nuevo puede leer `ok`/`data`.
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// payload: objeto con las claves legacy (config, auditorias, sessionToken, etc.).
// Quien necesite la clave estándar `data` la pasa explícitamente (no se
// auto-duplica para no inflar respuestas grandes como get_auditorias).
function ok_(payload) {
  return jsonOut_(Object.assign({ status: "ok", ok: true }, payload || {}));
}

function err_(mensaje, code) {
  return jsonOut_({ status: "error", ok: false, message: mensaje, error: mensaje, code: code || 400 });
}

// ── Utilidades ──────────────────────────────────────────────────
function sha256_(str) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(str), Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function formatDate_(val) {
  if (!val) return "";
  if (val instanceof Date) return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(val);
}

// 0% es un valor medido válido — solo blanco/null se convierte en null.
function numberOrNull_(val) {
  return (val === "" || val === null || val === undefined) ? null : Number(val);
}

function boolFromSI_(val) {
  return String(val).trim().toUpperCase() === "SI";
}

function siNo_(truthy) { return truthy ? "SI" : "NO"; }
