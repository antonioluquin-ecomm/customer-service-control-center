// ================================================================
// CONFIG — constantes, defaults y criterios iniciales
// ================================================================

const VERSION = {
  number: '12.7.0',
  date:   '2026-06-26',
  notes:  'Estandarización Sprint 6 — backend GAS multi-archivo, RBAC en Sheets (USUARIOS/ROLES/PERMISOS/SESIONES), LOGS/ERRORS, dual-emit'
};

const CHANGELOG = [
  { v: '12.7.0', date: '2026-06-26', desc: 'Estandarización Sprint 6 — backend GAS reestructurado a 9 .gs (Code/Auth/Usuarios/Auditorias/Validators/Logger/Helpers/Config/Setup), RBAC por sesión en hojas USUARIOS/ROLES/PERMISOS_MODULOS/SESIONES, observabilidad LOGS/ERRORS, respuestas dual-emit (status+ok/data), migración idempotente de usuarios legacy preservando contraseñas' },
  { v: '12.6.0', date: '2026-06-26', desc: 'Estandarización Sprint 5 — RBAC flexible: isAdmin()=id_rol===1, canView(mod), canEdit(mod), DEFAULT_PERMISOS, acs_session (fallback auditcs_session), acs_theme (fallback cs_theme), nav por canView' },
  { v: '12.5.0', date: '2026-06-26', desc: 'Estandarización Sprint 4 — login.html: anti-flash script, variables.css para dark mode, gradiente en icono, card con border/bg token, errEl.hidden, mensajes canónicos' },
  { v: '12.4.0', date: '2026-06-26', desc: 'Estandarización Sprint 3 — Registros: th[data-sortable], paginación 25/50/100, exportCSV usa vista filtrada (_recRows) con BOM UTF-8' },
  { v: '12.3.0', date: '2026-06-26', desc: 'Estandarización Sprint 2 — topbar global sticky con breadcrumb, .page-header, renderSidebarUser con badge de rol, variantes de botón secondary/ghost, modal de contraseña con clases (dark mode)' },
  { v: '12.2.0', date: '2026-06-26', desc: 'Estandarización Sprint 1 — fuentes DM Sans/DM Mono self-host local, sin red externa de Google Fonts' },
  { v: '12.1.5', date: '2026-06-25', desc: 'Registros: habilitar eliminacion de auditorias para usuarios auditores' },
  { v: '12.1.4', date: '2026-06-25', desc: 'Registros: restaurar accion de eliminar auditorias para administradores y supervisores' },
  { v: '12.1.3', date: '2026-06-23', desc: 'Shell: dark mode completo — variables CSS, toggleTheme(), botón en sidebar footer' },
  { v: '12.1.2', date: '2026-06-23', desc: 'Shell: anti-flash prefers-color-scheme, version badge con popover changelog' },
  { v: '12.1.1', date: '2026-06-22', desc: 'Login — callApiRaw, localStorage, diseño canónico; _loginPath() dinámico' },
  { v: '12.1.0', date: '2026-06-20', desc: 'Sidebar — fixed position, brand-icon, mobile collapse, design tokens' },
  { v: '12.0.0', date: '2026-06-17', desc: 'Dashboard supervisor — métricas de equipo, tendencias y prioridades semanales' },
  { v: '11.0.0', date: '2026-06-14', desc: 'Observabilidad de sincronización — tests e idempotencia offline' },
  { v: '10.0.0', date: '2026-06-10', desc: 'Autorización por rol — restricciones de escritura para auditores no admin' },
];

const CONFIG = {
  // URL del deploy de Apps Script — reemplazar con la URL real después del deploy.
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyp88KZInCGa68llI8C4uiy8B-IOldWRCjLWFHsiGdzkDXDgJUhfWzwtN00z9FI-mq4/exec",
  AUTH: {
    SESSION_KEY:    "acs_session",
    SESSION_TTL_MS: 8 * 60 * 60 * 1000, // 8 horas
  }
};

const CFG_KEY = "auditcs_cfg_v6";

let CFG = {
  agentes:["Agostina Moya","Rodrigo Arrieta","Luciana Zurita","Lucas Veliz","Julieta Gallardo","Tania Cazorla","Santiago Jerez","Rodrigo Bacchi"],
  auditores:["Gabriel","Auditor 1","Auditor 2"],
  muestras_semana:4, horas_base:44, tickets_base:660,
  w_inter:60, w_puntual:20, w_present:20,
  obj_puntual:1, obj_present:1,
  u_excelente:95, u_correcta:80,
  w_calidad:50, w_productividad:50,
  // Fecha de corte: los historicos anteriores siguen visibles, pero no entran al score combinado.
  fecha_inicio_modelo_separado:"2026-06-24",
};

let CRITERIOS = [
  {cod:"COM_SALUDO",      bloque:"Comunicacion", nombre:"Saludo inicial",                        peso:2,  activo:true},
  {cod:"COM_TONO",        bloque:"Comunicacion", nombre:"Tono de voz / Lenguaje apropiado",      peso:4,  activo:true},
  {cod:"COM_SILENCIOS",   bloque:"Comunicacion", nombre:"Silencios y administración de tiempos", peso:4,  activo:true},
  {cod:"COM_ESCUCHA",     bloque:"Comunicacion", nombre:"Escucha activa / Interpretación",       peso:4,  activo:true},
  {cod:"COM_EFECTIVA",    bloque:"Comunicacion", nombre:"Comunicación efectiva",                 peso:4,  activo:true},
  {cod:"COM_DESPEDIDA",   bloque:"Comunicacion", nombre:"Despedida",                             peso:2,  activo:true},
  {cod:"GES_HISTORIAL",   bloque:"Gestion",      nombre:"Historial del contacto / Solicitud",   peso:20, activo:true},
  {cod:"GES_INFO",        bloque:"Gestion",      nombre:"Información correcta",                 peso:10, activo:true},
  {cod:"GES_RESOLUCION",  bloque:"Gestion",      nombre:"Resolución en primer contacto",        peso:10, activo:true},
  {cod:"GES_EMOCIONES",   bloque:"Gestion",      nombre:"Manejo de emociones",                  peso:10, activo:true},
  {cod:"GES_OBJECIONES",  bloque:"Gestion",      nombre:"Manejo de objeciones",                 peso:10, activo:true},
  {cod:"GES_HERRAMIENTAS",bloque:"Gestion",      nombre:"Manejo de herramientas",               peso:20, activo:true},
];

const CRITERIOS_DEFAULT = JSON.parse(JSON.stringify(CRITERIOS));
