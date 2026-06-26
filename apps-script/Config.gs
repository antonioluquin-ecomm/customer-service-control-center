// ================================================================
// Config.gs — SOLO constantes (sin funciones)
// AuditCS · Backend estándar (apps_script_standards.md §2.4, §7.1)
// ================================================================

// ── Nombres de hojas ────────────────────────────────────────────
// Hojas de dominio existentes (minúsculas, NO renombrar — freeze zone).
// Hojas de sistema estándar (MAYÚSCULAS, agregadas en Sprint 6).
const SHEETS = {
  // Dominio (existentes)
  AUDITORIAS:            "auditorias",
  DETALLE:               "detalle_calidad",
  PRODUCTIVIDAD:         "productividad",
  PRODUCTIVIDAD_SEMANAL: "productividad_semanal",
  OBSERVACIONES:         "observaciones",
  CONFIGURACION:         "configuracion",
  CONFIG_LOG:            "log_configuracion",
  CRITERIOS:             "criterios_calidad",
  USUARIOS_LEGACY:       "usuarios",        // fuente de la migración — NO se modifica
  LOG_ENVIOS:            "log_envios",       // legacy, se conserva
  // Sistema (estándar)
  USUARIOS:              "USUARIOS",
  ROLES:                 "ROLES",
  PERMISOS_MODULOS:      "PERMISOS_MODULOS",
  SESIONES:              "SESIONES",
  LOGS:                  "LOGS",
  ERRORS:                "ERRORS",
  CONFIG:                "CONFIG",
};

// ── Headers de hojas de sistema (orden canónico) ────────────────
const HEADERS_SISTEMA = {
  USUARIOS:         ["id","nombre","email","password_hash","salt","id_rol","activo","fecha_creacion","ultimo_acceso","creado_por"],
  ROLES:            ["id","nombre","descripcion","activo","es_sistema"],
  PERMISOS_MODULOS: ["id_rol","modulo","puede_ver","puede_editar"],
  SESIONES:         ["session_token","id_usuario","email","id_rol","expira_en","fecha_creacion","activa"],
  LOGS:             ["id","fecha","accion","entidad","entidad_id","usuario","resultado","detalle"],
  ERRORS:           ["id","fecha","accion","usuario","mensaje","stack"],
  CONFIG:           ["clave","valor","descripcion","ultima_actualizacion"],
};

// ── Headers de hojas de dominio (para ensure/seed inicial) ──────
const HEADERS_DOMINIO = {
  auditorias: [
    "id_auditoria","fecha_registro","fecha_auditoria","anio","mes","semana",
    "auditor","agente","ticket","canal","tipo","horas_trabajadas",
    "objetivo_interacciones","interacciones_reales","dias_tarde","dias_faltas",
    "pct_calidad","pct_productividad","pct_general","estado",
    "requiere_seguimiento","obs_general","obs_desvios","obs_accion",
    "resp_seguimiento","w_calidad","w_productividad","client_request_id","timestamp_registro",
  ],
  detalle_calidad: [
    "id_detalle","id_auditoria","bloque","criterio_codigo",
    "criterio_nombre","peso_porcentaje","cumple_si_no","porcentaje_obtenido",
  ],
  productividad: [
    "id_productividad","id_auditoria","fecha_auditoria","anio","mes","semana",
    "agente","horas_trabajadas","objetivo_interacciones","interacciones_reales",
    "dias_tarde","dias_faltas","pct_interacciones","pct_puntualidad",
    "pct_presentismo","total_productividad","w_inter","w_puntual","w_present",
  ],
  productividad_semanal: ["id_productividad","fecha_registro","fecha_actualizacion","anio","mes","semana","agente","horas_trabajadas","objetivo_interacciones","interacciones_reales","dias_tarde","dias_faltas","pct_interacciones","pct_puntualidad","pct_presentismo","total_productividad","w_inter","w_puntual","w_present","auditor"],
  observaciones: [
    "id_observacion","id_auditoria","fecha_registro","agente","ticket",
    "obs_general","obs_desvios","obs_accion","requiere_seguimiento",
    "resp_seguimiento","estado_seguimiento",
  ],
  configuracion: ["parametro","valor","unidad","descripcion","ultima_actualizacion"],
  log_configuracion: ["id_log","timestamp","accion","detalle","agentes_lista","auditores_lista","parametros_json"],
  criterios_calidad: ["cod","bloque","nombre","peso","activo","ultima_actualizacion"],
};

// ── RBAC: módulos del sistema ───────────────────────────────────
const MODULOS = ["dashboard","formulario","productividad","registros","observaciones","agentes","configuracion"];

// ── Seed de roles (id 1 = Administrador de sistema) ─────────────
const ROLES_SEED = [
  { id:1, nombre:"Administrador", descripcion:"Acceso total al sistema",                     activo:"SI", es_sistema:"SI" },
  { id:2, nombre:"Supervisor",    descripcion:"Supervisión de equipo y configuración",       activo:"SI", es_sistema:"NO" },
  { id:3, nombre:"Auditor",       descripcion:"Carga y gestión de auditorías de calidad",    activo:"SI", es_sistema:"NO" },
  { id:4, nombre:"Agente",        descripcion:"Consulta de su propio desempeño",             activo:"SI", es_sistema:"NO" },
];

// Mapa role string (modelo viejo) → id_rol (modelo estándar)
const ROLE_STRING_TO_ID = { admin:1, supervisor:2, auditor:3, agente:4 };

// ── Seed de permisos por módulo (espeja DEFAULT_PERMISOS de auth.js) ──
// puede_ver / puede_editar como SI/NO
const PERMISOS_SEED = {
  1: { dashboard:[1,1], formulario:[1,1], productividad:[1,1], registros:[1,1], observaciones:[1,1], agentes:[1,1], configuracion:[1,1] },
  2: { dashboard:[1,0], formulario:[1,1], productividad:[1,1], registros:[1,1], observaciones:[1,0], agentes:[1,0], configuracion:[0,0] },
  3: { dashboard:[1,0], formulario:[1,1], productividad:[0,0], registros:[1,1], observaciones:[1,0], agentes:[1,0], configuracion:[0,0] },
  4: { dashboard:[1,0], formulario:[1,0], productividad:[0,0], registros:[1,0], observaciones:[1,0], agentes:[1,0], configuracion:[0,0] },
};

// ── Acciones que requieren rol Administrador (gestión del sistema) ──
const ADMIN_ACTIONS = [
  "config_change", "update_criterios",
  "getUsuarios", "createUsuario", "updateUsuario",
  "getRoles", "createRol", "updateRol", "updatePermisos",
];

// ── Mapa acción de escritura → módulos que la habilitan ─────────
const ACTION_MODULE_MAP = {
  "insert_auditoria":             ["formulario"],
  "delete_auditoria":             ["registros"],
  "upsert_productividad_semanal": ["productividad"],
};

// ── Criterios de calidad por defecto ────────────────────────────
const CRITERIOS_DEFAULT = [
  { cod:"COM_SALUDO",       bloque:"Comunicacion", nombre:"Saludo inicial",                        peso:2,  activo:true },
  { cod:"COM_TONO",         bloque:"Comunicacion", nombre:"Tono de voz / Lenguaje apropiado",      peso:4,  activo:true },
  { cod:"COM_SILENCIOS",    bloque:"Comunicacion", nombre:"Silencios y administracion de tiempos", peso:4,  activo:true },
  { cod:"COM_ESCUCHA",      bloque:"Comunicacion", nombre:"Escucha activa / Interpretacion",       peso:4,  activo:true },
  { cod:"COM_EFECTIVA",     bloque:"Comunicacion", nombre:"Comunicacion efectiva",                 peso:4,  activo:true },
  { cod:"COM_DESPEDIDA",    bloque:"Comunicacion", nombre:"Despedida",                             peso:2,  activo:true },
  { cod:"GES_HISTORIAL",    bloque:"Gestion",      nombre:"Historial del contacto / Solicitud",    peso:20, activo:true },
  { cod:"GES_INFO",         bloque:"Gestion",      nombre:"Informacion correcta",                  peso:10, activo:true },
  { cod:"GES_RESOLUCION",   bloque:"Gestion",      nombre:"Resolucion en primer contacto",         peso:10, activo:true },
  { cod:"GES_EMOCIONES",    bloque:"Gestion",      nombre:"Manejo de emociones",                   peso:10, activo:true },
  { cod:"GES_OBJECIONES",   bloque:"Gestion",      nombre:"Manejo de objeciones",                  peso:10, activo:true },
  { cod:"GES_HERRAMIENTAS", bloque:"Gestion",      nombre:"Manejo de herramientas",                peso:20, activo:true },
];

// ── Properties keys ─────────────────────────────────────────────
const PROP_SPREADSHEET_ID = "SPREADSHEET_ID";
const PROP_INITIALIZED    = "acs_initialized_v2";
const PROP_LAST_ID        = "last_auditoria_id";

// ── Sesión ──────────────────────────────────────────────────────
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas
