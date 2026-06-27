// ================================================================
// Code.gs — entry points (doGet / doPost) y router.
// Sin lógica de negocio: solo dispatch y autorización.
// Protocolo de wire: { _type, sessionToken, ...payload } (compat frontend).
// Respuestas dual-emit: { status, message, ... } + { ok, data, error }.
// ================================================================

// ── GET: health + lecturas (requieren sesión) ──────────────────
function doGet(e) {
  const action = (e && e.parameter && (e.parameter.action || e.parameter.accion)) || "ping";
  try {
    if (action === "health" || action === "ping")
      return jsonOut_({ status: "ok", ok: true, service: "AuditCS v8", running: true, timestamp: new Date().toISOString() });

    ensureSetupOnce_();
    const ses = _validateSessionToken((e && e.parameter && e.parameter.sessionToken) || "");
    if (!ses.ok) return err_("Sesión requerida. Iniciá sesión nuevamente.", 401);

    if (action === "get_config")                return ok_(getConfigDominio_());
    if (action === "get_auditorias")            return ok_(getAuditorias_());
    if (action === "get_detalle")               return ok_(getDetalle_());
    if (action === "get_criterios")             return ok_(getCriterios_());
    if (action === "get_productividad_semanal") return ok_(getProductividadSemanal_());
    if (action === "getPermisos")               return handleGetPermisos_(ses);
    return err_("Acción no permitida por GET: " + action);
  } catch (err) {
    writeError_("doGet:" + action, err.message, err.stack, "");
    return err_("Error interno del servidor");
  }
}

// ── POST: router principal ──────────────────────────────────────
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let action = "?";
  try {
    const body = JSON.parse(e.postData ? e.postData.contents : "{}");
    action = body._type || body.accion || "insert_auditoria";

    ensureSetupOnce_();

    // Públicos (sin sesión)
    if (action === "login") return handleLogin_(body);

    // A partir de acá se exige sesión válida
    const ses = _validateSessionToken(body.sessionToken || body.session_token);
    if (!ses.ok) return err_("Sesión requerida. Iniciá sesión nuevamente.", 401);

    if (action === "logout") return handleLogout_(body, ses);

    // Gestión del sistema → solo Administrador (id_rol === 1)
    if (ADMIN_ACTIONS.indexOf(action) !== -1 && ses.id_rol !== 1)
      return err_("Requiere rol Administrador", 403);

    // Escrituras de dominio → el rol debe poder editar algún módulo que gobierne la acción
    const mods = ACTION_MODULE_MAP[action];
    if (mods && ses.id_rol !== 1) {
      const perm = getPermisosForRol_(ses.id_rol);
      const puede = mods.some(m => perm[m] && perm[m].editar === true);
      if (!puede) return err_("No tenés permisos de edición para esta acción", 403);
    }

    return routePost_(action, body, ses);
  } catch (err) {
    writeError_("doPost:" + action, err.message, err.stack, "");
    return err_(err.message || "Error interno del servidor");
  } finally {
    lock.releaseLock();
  }
}

// ── Dispatch ────────────────────────────────────────────────────
function routePost_(action, body, ses) {
  switch (action) {
    // Sesión / cuenta
    case "updateUser":
    case "changePassword":              return handleChangePassword_(body, ses);
    case "getPermisos":                 return handleGetPermisos_(ses);

    // Dominio
    case "config_change":               return handleConfigChange_(body, ses);
    case "update_criterios":            return handleUpdateCriterios_(body.criterios || [], ses);
    case "upsert_productividad_semanal":return upsertProductividadSemanal_(body, ses);
    case "delete_auditoria":            return deleteAuditoria_(body.id_auditoria, ses);

    // Gestión (admin)
    case "getUsuarios":                 return getUsuarios_();
    case "createUsuario":               return createUsuario_(body, ses);
    case "updateUsuario":               return updateUsuario_(body, ses);
    case "getRoles":                    return getRoles_();
    case "createRol":                   return createRol_(body, ses);
    case "updateRol":                   return updateRol_(body, ses);
    case "updatePermisos":              return updatePermisos_(body, ses);
    case "getPermisosRol":              return getPermisosRol_(body);

    // Default: insertar auditoría
    case "insert_auditoria":
    default:                            return insertAuditoriaCompleta_(body, ses);
  }
}
