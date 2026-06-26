// ================================================================
// Usuarios.gs — gestión de usuarios, roles y permisos (solo Administrador).
// Invariantes obligatorias: apps_script_standards.md §7.2.1.
// ================================================================

// ── Usuarios ────────────────────────────────────────────────────
function getUsuarios_() {
  const usuarios = getAllRows_(SHEETS.USUARIOS).map(u => ({
    id: Number(u.id), nombre: u.nombre, email: u.email,
    id_rol: Number(u.id_rol), nombre_rol: _nombreRol(u.id_rol),
    activo: boolFromSI_(u.activo),
    fecha_creacion: u.fecha_creacion, ultimo_acceso: u.ultimo_acceso,
  }));
  return ok_({ usuarios, data: usuarios });
}

function createUsuario_(params, ses) {
  const nombre       = validateString_(params.nombre, "nombre", 120);
  const email        = validateEmail_(params.email, "email");
  const id_rol       = validateIdPositivo_(params.id_rol, "id_rol");
  const passwordHash = validateString_(params.passwordHash || params.password_hash, "passwordHash", 200);
  if (_findUsuarioByEmail(email)) throw new Error("Ya existe un usuario con ese email");
  if (!_rolePorId(id_rol))        throw new Error("Rol inexistente: " + id_rol);

  const salt = Utilities.getUuid();
  const id   = getNextId_(SHEETS.USUARIOS);
  getSheet_(SHEETS.USUARIOS).appendRow([
    id, nombre, email, sha256_(salt + passwordHash), salt, id_rol, "SI",
    new Date().toISOString(), "", ses.email,
  ]);
  writeLog_("createUsuario", "USUARIOS", id, "OK", email, ses.email);
  return ok_({ id, data: { id } });
}

function updateUsuario_(params, ses) {
  const id = validateIdPositivo_(params.id, "id");
  const sheet = getSheet_(SHEETS.USUARIOS);
  const { headers, rows } = readSheet_(SHEETS.USUARIOS);
  const ci = {
    id: headers.indexOf("id"), nombre: headers.indexOf("nombre"),
    id_rol: headers.indexOf("id_rol"), activo: headers.indexOf("activo"),
  };
  const rowIdx = rows.findIndex(r => Number(r[ci.id]) === id);
  if (rowIdx === -1) throw new Error("Usuario " + id + " no encontrado");

  const nuevoRol    = params.id_rol    !== undefined ? validateIdPositivo_(params.id_rol, "id_rol") : Number(rows[rowIdx][ci.id_rol]);
  const nuevoActivo = params.activo    !== undefined ? (params.activo ? "SI" : "NO") : String(rows[rowIdx][ci.activo]);

  // Invariante: siempre ≥1 Administrador activo.
  const dejariaSinAdmin = _contarAdminsActivos(rows, ci, id, nuevoRol, nuevoActivo) === 0;
  if (dejariaSinAdmin) return err_("El sistema debe tener al menos un Administrador activo", 409);

  if (params.nombre !== undefined) sheet.getRange(rowIdx + 2, ci.nombre + 1).setValue(validateString_(params.nombre, "nombre", 120));
  if (params.id_rol !== undefined) {
    if (!_rolePorId(nuevoRol)) throw new Error("Rol inexistente: " + nuevoRol);
    sheet.getRange(rowIdx + 2, ci.id_rol + 1).setValue(nuevoRol);
  }
  if (params.activo !== undefined) sheet.getRange(rowIdx + 2, ci.activo + 1).setValue(nuevoActivo);

  // Reset de contraseña opcional (admin)
  const pwd = params.passwordHash || params.password_hash;
  if (pwd) {
    const salt = Utilities.getUuid();
    sheet.getRange(rowIdx + 2, colIndex_(headers, "password_hash")).setValue(sha256_(salt + String(pwd)));
    sheet.getRange(rowIdx + 2, colIndex_(headers, "salt")).setValue(salt);
  }
  writeLog_("updateUsuario", "USUARIOS", id, "OK", "", ses.email);
  return ok_({ id, data: { id } });
}

function _contarAdminsActivos(rows, ci, idCambiado, rolCambiado, activoCambiado) {
  let count = 0;
  rows.forEach(r => {
    const id     = Number(r[ci.id]);
    const id_rol = id === idCambiado ? rolCambiado : Number(r[ci.id_rol]);
    const activo = id === idCambiado ? activoCambiado : String(r[ci.activo]);
    if (id_rol === 1 && boolFromSI_(activo)) count++;
  });
  return count;
}

// ── Roles ───────────────────────────────────────────────────────
function getRoles_() {
  const roles = getAllRows_(SHEETS.ROLES).map(r => ({
    id: Number(r.id), nombre: r.nombre, descripcion: r.descripcion,
    activo: boolFromSI_(r.activo), es_sistema: boolFromSI_(r.es_sistema),
  }));
  return ok_({ roles, data: roles });
}

function createRol_(params, ses) {
  const nombre = validateString_(params.nombre, "nombre", 80);
  const descripcion = String(params.descripcion || "").trim();
  const id = getNextId_(SHEETS.ROLES);
  getSheet_(SHEETS.ROLES).appendRow([id, nombre, descripcion, "SI", "NO"]);
  // Rol nuevo arranca sin acceso: una fila por módulo en Oculto.
  const sheetP = getSheet_(SHEETS.PERMISOS_MODULOS);
  MODULOS.forEach(m => sheetP.appendRow([id, m, "NO", "NO"]));
  writeLog_("createRol", "ROLES", id, "OK", nombre, ses.email);
  return ok_({ id, data: { id } });
}

function updateRol_(params, ses) {
  const id = validateIdPositivo_(params.id, "id");
  const rol = _rolePorId(id);
  if (!rol) throw new Error("Rol " + id + " no encontrado");
  if (boolFromSI_(rol.es_sistema)) return err_("El rol de sistema no se puede modificar", 403);

  const sheet = getSheet_(SHEETS.ROLES);
  const { headers, rows } = readSheet_(SHEETS.ROLES);
  const cId = headers.indexOf("id");
  const rowIdx = rows.findIndex(r => Number(r[cId]) === id);
  if (params.nombre !== undefined)      sheet.getRange(rowIdx + 2, colIndex_(headers, "nombre")).setValue(validateString_(params.nombre, "nombre", 80));
  if (params.descripcion !== undefined) sheet.getRange(rowIdx + 2, colIndex_(headers, "descripcion")).setValue(String(params.descripcion).trim());
  if (params.activo !== undefined)      sheet.getRange(rowIdx + 2, colIndex_(headers, "activo")).setValue(params.activo ? "SI" : "NO");
  writeLog_("updateRol", "ROLES", id, "OK", "", ses.email);
  return ok_({ id, data: { id } });
}

// ── Permisos por módulo ─────────────────────────────────────────
// Lectura de la matriz de un rol (para la pantalla admin).
function getPermisosRol_(params) {
  const id_rol = validateIdPositivo_(params.id_rol, "id_rol");
  const permisos = getPermisosForRol_(id_rol);
  return ok_({ id_rol, permisos, data: permisos });
}

// params: { id_rol, permisos: { modulo: { ver:bool, editar:bool } } }
function updatePermisos_(params, ses) {
  const id_rol = validateIdPositivo_(params.id_rol, "id_rol");
  const rol = _rolePorId(id_rol);
  if (!rol) throw new Error("Rol " + id_rol + " no encontrado");
  if (boolFromSI_(rol.es_sistema)) return err_("Los permisos del rol de sistema no se pueden modificar", 403);

  const nuevos = params.permisos || {};
  const sheet  = getSheet_(SHEETS.PERMISOS_MODULOS);
  const { headers, rows } = readSheet_(SHEETS.PERMISOS_MODULOS);
  const ci = { rol: headers.indexOf("id_rol"), mod: headers.indexOf("modulo") };
  const cVer = colIndex_(headers, "puede_ver");
  const cEdit = colIndex_(headers, "puede_editar");

  MODULOS.forEach(m => {
    const def = nuevos[m] || { ver: false, editar: false };
    const ver = !!def.ver;
    const editar = ver && !!def.editar; // coherencia: no edita si no ve
    const rowIdx = rows.findIndex(r => Number(r[ci.rol]) === id_rol && String(r[ci.mod]) === m);
    if (rowIdx === -1) {
      sheet.appendRow([id_rol, m, siNo_(ver), siNo_(editar)]);
    } else {
      sheet.getRange(rowIdx + 2, cVer).setValue(siNo_(ver));
      sheet.getRange(rowIdx + 2, cEdit).setValue(siNo_(editar));
    }
  });
  writeLog_("updatePermisos", "PERMISOS_MODULOS", id_rol, "OK", "", ses.email);
  return ok_({ id_rol, data: { id_rol } });
}
