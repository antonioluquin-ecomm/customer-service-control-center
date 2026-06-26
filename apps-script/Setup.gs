// ================================================================
// Setup.gs — inicialización idempotente, migración y seeds.
// Ejecutar setupAll() UNA VEZ desde el editor tras pegar el código
// y configurar SPREADSHEET_ID (opcional si el script es bound).
// ================================================================

// Punto de entrada manual: crea hojas, migra usuarios, siembra roles/permisos.
function setupAll() {
  ensureDomainSheets_();
  ensureSystemSheets_();
  seedRoles_();
  seedPermisos_();
  migrateUsuariosLegacy_();
  PropertiesService.getScriptProperties().setProperty(PROP_INITIALIZED, "true");
  Logger.log("✓ setupAll completado.");
}

// Re-ejecutable: fuerza re-inicialización (no borra datos).
function reinitialize() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_INITIALIZED);
  setupAll();
}

// Guard liviano para requests: corre setupAll solo la primera vez.
function ensureSetupOnce_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(PROP_INITIALIZED) === "true") return;
  setupAll();
}

// ── Creación de hojas ───────────────────────────────────────────
function ensureSheetWithHeaders_(name, headers) {
  const sheet = getSheet_(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold").setBackground("#E8F0FE")
      .setBorder(true, true, true, true, false, false);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureDomainSheets_() {
  Object.entries(HEADERS_DOMINIO).forEach(([name, headers]) => ensureSheetWithHeaders_(name, headers));
  // Sembrar criterios si está vacía
  const sc = getSheet_(SHEETS.CRITERIOS);
  if (sc.getLastRow() <= 1) sembrarCriteriosDefault_(sc);
  // Asegurar columna client_request_id en auditorias (append, no reordena)
  const sa = getSheet_(SHEETS.AUDITORIAS);
  if (sa.getLastRow() > 0) {
    const headers = sa.getRange(1, 1, 1, sa.getLastColumn()).getValues()[0];
    if (!headers.includes("client_request_id")) sa.getRange(1, headers.length + 1).setValue("client_request_id");
  }
}

function ensureSystemSheets_() {
  Object.entries(HEADERS_SISTEMA).forEach(([key, headers]) => ensureSheetWithHeaders_(SHEETS[key], headers));
}

// ── Seeds RBAC ──────────────────────────────────────────────────
function seedRoles_() {
  const sheet = getSheet_(SHEETS.ROLES);
  const existentes = getAllRows_(SHEETS.ROLES).map(r => Number(r.id));
  ROLES_SEED.forEach(r => {
    if (existentes.indexOf(r.id) === -1)
      sheet.appendRow([r.id, r.nombre, r.descripcion, r.activo, r.es_sistema]);
  });
}

function seedPermisos_() {
  const existentes = getAllRows_(SHEETS.PERMISOS_MODULOS)
    .map(p => Number(p.id_rol) + "|" + String(p.modulo));
  const sheet = getSheet_(SHEETS.PERMISOS_MODULOS);
  Object.keys(PERMISOS_SEED).forEach(idRol => {
    const mods = PERMISOS_SEED[idRol];
    Object.keys(mods).forEach(mod => {
      const key = idRol + "|" + mod;
      if (existentes.indexOf(key) === -1) {
        const [ver, editar] = mods[mod];
        sheet.appendRow([Number(idRol), mod, siNo_(!!ver), siNo_(!!editar)]);
      }
    });
  });
}

// ── Migración usuarios (legacy) → USUARIOS (estándar) ───────────
// Copia el password_hash verbatim (salt vacío = comparación legacy en login).
// La hoja 'usuarios' legacy NO se modifica.
function migrateUsuariosLegacy_() {
  if (getAllRows_(SHEETS.USUARIOS).length > 0) return; // ya migrado — idempotente
  const legacy = getAllRows_(SHEETS.USUARIOS_LEGACY);
  if (!legacy.length) return;
  const sheet = getSheet_(SHEETS.USUARIOS);
  let id = 1;
  legacy.forEach(u => {
    const email = String(u.email || "").trim().toLowerCase();
    if (!email) return;
    const id_rol = ROLE_STRING_TO_ID[String(u.role || "").trim().toLowerCase()] || 4;
    sheet.appendRow([
      id++, String(u.nombre || email), email, String(u.password_hash || ""), "",
      id_rol, siNo_(_legacyBool(u.activo)), new Date().toISOString(), "", "migracion",
    ]);
  });
  Logger.log("✓ Migrados " + (id - 1) + " usuarios legacy → USUARIOS.");
}

function _legacyBool(val) {
  if (val === true) return true;
  const s = String(val).trim().toLowerCase();
  return s === "si" || s === "sí" || s === "true" || s === "1";
}

// ── Setup de instalación fresca (sin usuarios legacy) ───────────
// Cambiar email/nombre/password antes de ejecutar.
function crearUsuarioInicial() {
  const email    = "admin@tudominio.com";  // ← CAMBIAR
  const nombre   = "Administrador";         // ← CAMBIAR
  const password = "cambiarme123";          // ← cambiar tras el primer login
  ensureSystemSheets_();
  seedRoles_();
  seedPermisos_();
  if (_findUsuarioByEmail(email)) { Logger.log("El usuario " + email + " ya existe."); return; }
  const salt = Utilities.getUuid();
  // El frontend envía SHA256(password); acá simulamos ese hash y luego lo salteamos.
  const passwordHashFront = sha256_(password);
  getSheet_(SHEETS.USUARIOS).appendRow([
    getNextId_(SHEETS.USUARIOS), nombre, email.toLowerCase(),
    sha256_(salt + passwordHashFront), salt, 1, "SI",
    new Date().toISOString(), "", "setup",
  ]);
  Logger.log("✓ Usuario admin creado: " + email + " — contraseña inicial: " + password);
}
