// ================================================================
// Auth.gs — RBAC por sesión (apps_script_standards.md §7).
// Sesiones en hoja SESIONES (auditable, sobrevive redeploys).
// El rol y el estado activo se releen en vivo de USUARIOS en cada validación.
// ================================================================

// ── Búsqueda de usuarios ────────────────────────────────────────
function _findUsuarioByEmail(email) {
  const target = String(email || "").trim().toLowerCase();
  const usuarios = getAllRows_(SHEETS.USUARIOS);
  for (const u of usuarios) {
    if (String(u.email).trim().toLowerCase() === target) return u;
  }
  return null;
}

function _findUsuarioById(id) {
  const usuarios = getAllRows_(SHEETS.USUARIOS);
  for (const u of usuarios) {
    if (Number(u.id) === Number(id)) return u;
  }
  return null;
}

function _rolePorId(id_rol) {
  const roles = getAllRows_(SHEETS.ROLES);
  for (const r of roles) {
    if (Number(r.id) === Number(id_rol)) return r;
  }
  return null;
}

// El rol de sistema (es_sistema=SI) se considera siempre activo.
function _isRolActivo(id_rol) {
  const r = _rolePorId(id_rol);
  if (!r) return false;
  if (boolFromSI_(r.es_sistema)) return true;
  return boolFromSI_(r.activo);
}

function _nombreRol(id_rol) {
  const r = _rolePorId(id_rol);
  return r ? String(r.nombre) : "Rol " + id_rol;
}

// ── Verificación de contraseña (legacy directa o salted) ────────
function _verifyPassword(usuario, passwordHash) {
  const stored = String(usuario.password_hash || "");
  const salt   = String(usuario.salt || "");
  if (!salt) return stored === String(passwordHash || "");        // legacy: SHA256(password)
  return stored === sha256_(salt + String(passwordHash || ""));   // salted: SHA256(salt + SHA256(password))
}

// ── Permisos ────────────────────────────────────────────────────
// Devuelve { modulo: { ver:bool, editar:bool } } para un id_rol.
function getPermisosForRol_(id_rol) {
  const out = {};
  MODULOS.forEach(m => { out[m] = { ver: false, editar: false }; });
  const { headers, rows } = readSheet_(SHEETS.PERMISOS_MODULOS);
  const ci = {
    id_rol:       headers.indexOf("id_rol"),
    modulo:       headers.indexOf("modulo"),
    puede_ver:    headers.indexOf("puede_ver"),
    puede_editar: headers.indexOf("puede_editar"),
  };
  rows.forEach(r => {
    if (Number(r[ci.id_rol]) !== Number(id_rol)) return;
    const mod = String(r[ci.modulo]);
    if (!out[mod]) out[mod] = { ver: false, editar: false };
    out[mod].ver    = boolFromSI_(r[ci.puede_ver]);
    out[mod].editar = boolFromSI_(r[ci.puede_editar]);
  });
  // Administrador: acceso total garantizado.
  if (Number(id_rol) === 1) MODULOS.forEach(m => { out[m] = { ver: true, editar: true }; });
  return out;
}

// ── Sesiones ────────────────────────────────────────────────────
function _createSession(usuario) {
  const token  = Utilities.getUuid();
  const now    = new Date();
  const expira = new Date(now.getTime() + SESSION_TTL_MS);
  getSheet_(SHEETS.SESIONES).appendRow([
    token, usuario.id, usuario.email, usuario.id_rol, expira.toISOString(), now.toISOString(), "SI",
  ]);
  return { token, expira_en: expira.toISOString() };
}

// Valida el token contra SESIONES y relee rol/activo en vivo de USUARIOS.
// Devuelve { ok, id_usuario, email, id_rol, nombre, nombre_rol } o { ok:false, error }.
function _validateSessionToken(token) {
  if (!token) return { ok: false, error: "Token requerido" };
  const { headers, rows } = readSheet_(SHEETS.SESIONES);
  const ci = {
    token:  headers.indexOf("session_token"),
    idu:    headers.indexOf("id_usuario"),
    email:  headers.indexOf("email"),
    rol:    headers.indexOf("id_rol"),
    exp:    headers.indexOf("expira_en"),
    activa: headers.indexOf("activa"),
  };
  for (const r of rows) {
    if (String(r[ci.token]) !== String(token)) continue;
    if (!boolFromSI_(r[ci.activa]))              return { ok: false, error: "Sesión inactiva" };
    if (new Date(r[ci.exp]) < new Date())        return { ok: false, error: "Sesión expirada" };
    // Releer estado en vivo del usuario
    const u = _findUsuarioById(r[ci.idu]) || _findUsuarioByEmail(r[ci.email]);
    if (!u || !boolFromSI_(u.activo))            return { ok: false, error: "Usuario inactivo" };
    if (!_isRolActivo(u.id_rol))                 return { ok: false, error: "Rol inactivo" };
    return {
      ok: true,
      id_usuario: Number(u.id),
      email: String(u.email),
      id_rol: Number(u.id_rol),
      nombre: String(u.nombre),
      nombre_rol: _nombreRol(u.id_rol),
    };
  }
  return { ok: false, error: "Sesión no encontrada" };
}

function _invalidateSession(token) {
  if (!token) return;
  const sheet = getSheet_(SHEETS.SESIONES);
  const { headers, rows } = readSheet_(SHEETS.SESIONES);
  const ct = headers.indexOf("session_token");
  const ca = colIndex_(headers, "activa");
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][ct]) === String(token)) {
      sheet.getRange(i + 2, ca).setValue("NO");
      return;
    }
  }
}

// ── Endpoints de auth ───────────────────────────────────────────
function handleLogin_(body) {
  const email        = String(body.email || "").trim().toLowerCase();
  const passwordHash = String(body.passwordHash || body.password_hash || "").trim();
  if (!email || !passwordHash) return err_("Credenciales requeridas");

  const usuarios = getAllRows_(SHEETS.USUARIOS);
  if (!usuarios.length) return err_("No hay usuarios configurados. Ejecutá setupAll() en Apps Script.");

  const u = _findUsuarioByEmail(email);
  if (!u)                       return err_("Usuario no encontrado");
  if (!boolFromSI_(u.activo))   return err_("Usuario inactivo");
  if (!_isRolActivo(u.id_rol))  return err_("Rol inactivo. Contactá al administrador.");
  if (!_verifyPassword(u, passwordHash)) return err_("Contraseña incorrecta");

  const sess     = _createSession(u);
  const id_rol   = Number(u.id_rol);
  const permisos = getPermisosForRol_(id_rol);
  const nombre_rol = _nombreRol(id_rol);

  // Registrar último acceso (best-effort)
  _setUltimoAcceso(u.id);
  writeLog_("login", "USUARIOS", u.id, "OK", "", email);

  // Shape de sesión estándar (Sprint 5), con dual-emit de claves legacy.
  const user = {
    id: Number(u.id), email: String(u.email), nombre: String(u.nombre), name: String(u.nombre),
    id_rol, nombre_rol, role: _roleStringFromId(id_rol), permisos,
  };
  return ok_({
    sessionToken: sess.token,
    session_token: sess.token,
    user,
    usuario: { id: user.id, email: user.email, nombre: user.nombre, id_rol, nombre_rol },
    permisos,
    expira_en: sess.expira_en,
  });
}

function handleLogout_(body, ses) {
  _invalidateSession(body.sessionToken || body.session_token);
  writeLog_("logout", "USUARIOS", ses.id_usuario, "OK", ses.email);
  return ok_({});
}

// Cambio de la propia contraseña (acción updateUser legacy / changePassword estándar).
function handleChangePassword_(body, ses) {
  const passwordHash = String(body.passwordHash || body.password_nueva_hash || "").trim();
  if (!passwordHash) return err_("Datos incompletos");
  const sheet = getSheet_(SHEETS.USUARIOS);
  const { headers, rows } = readSheet_(SHEETS.USUARIOS);
  const ci = { id: headers.indexOf("id"), email: headers.indexOf("email") };
  const cHash = colIndex_(headers, "password_hash");
  const cSalt = colIndex_(headers, "salt");
  for (let i = 0; i < rows.length; i++) {
    if (Number(rows[i][ci.id]) === Number(ses.id_usuario) ||
        String(rows[i][ci.email]).trim().toLowerCase() === ses.email) {
      const salt = Utilities.getUuid();
      sheet.getRange(i + 2, cHash).setValue(sha256_(salt + passwordHash));
      sheet.getRange(i + 2, cSalt).setValue(salt);
      writeLog_("changePassword", "USUARIOS", ses.id_usuario, "OK", ses.email);
      return ok_({});
    }
  }
  return err_("Usuario no encontrado");
}

function handleGetPermisos_(ses) {
  const permisos = getPermisosForRol_(ses.id_rol);
  return ok_({ permisos, data: permisos });
}

function _setUltimoAcceso(id) {
  try {
    const sheet = getSheet_(SHEETS.USUARIOS);
    const { headers, rows } = readSheet_(SHEETS.USUARIOS);
    const ci = headers.indexOf("id");
    const cAcceso = colIndex_(headers, "ultimo_acceso");
    if (cAcceso === -1) return;
    for (let i = 0; i < rows.length; i++) {
      if (Number(rows[i][ci]) === Number(id)) {
        sheet.getRange(i + 2, cAcceso).setValue(new Date().toISOString());
        return;
      }
    }
  } catch (_) {}
}

function _roleStringFromId(id_rol) {
  const map = { 1: "admin", 2: "supervisor", 3: "auditor", 4: "agente" };
  return map[Number(id_rol)] || "agente";
}

// Limpia sesiones expiradas (ejecutar manualmente o por trigger).
function limpiarSesionesExpiradas() {
  const sheet = getSheet_(SHEETS.SESIONES);
  const { headers, rows } = readSheet_(SHEETS.SESIONES);
  const cExp = headers.indexOf("expira_en");
  const cAct = colIndex_(headers, "activa");
  let count = 0;
  for (let i = 0; i < rows.length; i++) {
    if (new Date(rows[i][cExp]) < new Date() && boolFromSI_(rows[i][cAct])) {
      sheet.getRange(i + 2, cAct).setValue("NO");
      count++;
    }
  }
  Logger.log("Sesiones expiradas marcadas inactivas: " + count);
}
