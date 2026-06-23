// ================================================================
// CONFIG — constantes, defaults y criterios iniciales
// ================================================================

const VERSION = {
  number: '12.1.2',
  date:   '2026-06-23',
  notes:  'Shell: anti-flash prefers-color-scheme, version badge con popover changelog en sidebar'
};

const CHANGELOG = [
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
    SESSION_KEY:    "auditcs_session",
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
