// ================================================================
// CONFIG — constantes, defaults y criterios iniciales
// ================================================================

const VERSION = {
  number: '12.12.0',
  date:   '2026-08-07',
  notes:  'Nuevo módulo Volumen diario por canal — reemplaza la carga manual en Excel'
};

/* Máximo 10 entradas (project-standards/application_shell.md §8.5) — descripción breve,
 * de una línea. Al agregar una versión nueva, quitar la más antigua del final. */
const CHANGELOG = [
  { v: '12.12.0', date: '2026-08-07', desc: 'Nuevo módulo Volumen diario por canal (WSP, Llamadas, Redes, Mails, Ventas, Reembolsos/CC) con historial y auditoría de ediciones.' },
  { v: '12.11.2', date: '2026-07-23', desc: 'Nuevo logo de marca (chat con check) en sidebar, login y favicon.' },
  { v: '12.11.1', date: '2026-07-21', desc: 'Modal de usuario: mostrar/ocultar contraseña y botón "Generar".' },
  { v: '12.11.0', date: '2026-06-28', desc: 'Colapso del sidebar en desktop, con estado persistido y anti-flash.' },
  { v: '12.10.0', date: '2026-06-27', desc: 'Fix de logout real al backend y refresco de permisos sin re-login.' },
  { v: '12.9.1', date: '2026-06-27', desc: 'Chart.js self-hosted y limpieza diaria de sesiones expiradas.' },
  { v: '12.9.0', date: '2026-06-27', desc: 'RBAC: denegado por defecto en módulos desconocidos y sync de TTL de sesión.' },
  { v: '12.8.1', date: '2026-06-27', desc: 'Hotfix de auditoría crítica: migración de tema y logging de acciones.' },
  { v: '12.8.0', date: '2026-06-26', desc: 'Configuración con tabs: Usuarios, Roles y permisos con matriz, Conexión.' },
  { v: '12.7.0', date: '2026-06-26', desc: 'Backend GAS reestructurado con RBAC por sesión y observabilidad de logs.' },
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

// Bloques del formulario "Volumen diario" — define inputs del form, columnas
// del historial y series del gráfico. Un solo lugar para agregar/quitar un canal.
const VOLUMEN_BLOQUES = [
  { id:"wsp",        label:"WSP",              color:"#16a34a", campos:[
    { key:"wsp_ingreso", label:"Ingreso" }, { key:"wsp_salida", label:"Salida" },
  ]},
  { id:"llamadas",   label:"Llamadas",         color:"#7c9cbf", campos:[
    { key:"llamadas_atendidas", label:"Atendidas" }, { key:"llamadas_desbordadas", label:"Desbordadas" },
    { key:"llamadas_no_respondidas", label:"No respondidas" },
  ]},
  { id:"redes",      label:"Redes",            color:"#3b9c5f", campos:[
    { key:"redes_privados", label:"Privados" }, { key:"redes_comentarios", label:"Comentarios" },
    { key:"redes_min_privados", label:"Min-privados" },
  ]},
  { id:"mails",      label:"Mails",            color:"#e08e45", campos:[
    { key:"mails_ingreso", label:"Ingreso" }, { key:"mails_salida", label:"Salida" },
  ]},
  { id:"ventas",     label:"Ventas",           color:"#6b7280", campos:[
    { key:"ventas_ingreso", label:"Ingreso" }, { key:"ventas_salida", label:"Salida" },
    { key:"ventas_cancelados", label:"Cancelados" },
  ]},
  { id:"reembolsos", label:"Reembolsos / CC",  color:"#c99a1e", campos:[
    { key:"reembolsos_pim", label:"Reembolsos PIM" }, { key:"pendientes_pim", label:"Pendientes PIM" },
    { key:"cc_gestionados", label:"CC gestionados" }, { key:"reclamos", label:"Reclamos" },
  ]},
];
const VOLUMEN_CAMPOS = VOLUMEN_BLOQUES.flatMap(b => b.campos.map(c => c.key));
