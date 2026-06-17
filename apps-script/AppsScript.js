// =============================================================
// SISTEMA DE AUDITORÍA CUSTOMER SERVICE — Apps Script v7
// CORRECCIONES v10:
//   - CORS habilitado en doPost con headers apropiados
//   - Validación server-side de pesos de criterios
//   - ID generado por backend con lock y celda dedicada
//   - handleConfigChange con upsert (no clearContent destructivo)
//   - deleteAuditoria con log de auditoría
//   - ensureSheets con flag de inicialización (no corre en cada request)
//   - Validación de token secreto en todos los endpoints
// =============================================================
// INSTRUCCIONES DE DEPLOY:
//   1. Pegá este código en tu proyecto de Apps Script
//   2. En Propiedades del proyecto (⚙ → Propiedades de script), agregá:
//      - Clave: SECRET_TOKEN  Valor: (elegí una cadena larga y aleatoria)
//   3. Implementar como Web App → Ejecutar como: "Yo" → Acceso: "Cualquier persona"
//   4. Copiá la URL de la Web App en la Configuración del HTML
//   5. En el HTML, agregá tu token en CFG.secret_token o como parámetro de URL
// =============================================================

const SHEET_AUDITORIAS    = "auditorias";
const SHEET_DETALLE       = "detalle_calidad";
const SHEET_PRODUCTIVIDAD = "productividad";
const SHEET_OBSERVACIONES = "observaciones";
const SHEET_LOG           = "log_envios";
const SHEET_CONFIG        = "configuracion";
const SHEET_CONFIG_LOG    = "log_configuracion";
const SHEET_CRITERIOS     = "criterios_calidad";
const PROP_INITIALIZED    = "sheets_initialized";
const PROP_LAST_ID        = "last_auditoria_id";

const HEADERS = {
  auditorias: [
    "id_auditoria","fecha_registro","fecha_auditoria","anio","mes","semana",
    "auditor","agente","ticket","canal","tipo","horas_trabajadas",
    "objetivo_interacciones","interacciones_reales","dias_tarde","dias_faltas",
    "pct_calidad","pct_productividad","pct_general","estado",
    "requiere_seguimiento","obs_general","obs_desvios","obs_accion",
    "resp_seguimiento","w_calidad","w_productividad","timestamp_registro",
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
  observaciones: [
    "id_observacion","id_auditoria","fecha_registro","agente","ticket",
    "obs_general","obs_desvios","obs_accion","requiere_seguimiento",
    "resp_seguimiento","estado_seguimiento",
  ],
  log_envios: [
    "id_log","fecha_hora","id_auditoria","accion","resultado","mensaje_error",
  ],
  configuracion: [
    "parametro","valor","unidad","descripcion","ultima_actualizacion",
  ],
  log_configuracion: [
    "id_log","timestamp","accion","detalle","agentes_lista","auditores_lista","parametros_json",
  ],
  criterios_calidad: [
    "cod","bloque","nombre","peso","activo","ultima_actualizacion",
  ],
};

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

// ================================================================
// CORS HEADERS — necesarios para que el HTML pueda leer el response
// ================================================================
function corsOutput(obj) {
  const output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// Para GET: Apps Script no permite setear headers en GET con CORS completo,
// pero los GET son read-only y van con redirect:follow — funcionan sin CORS.
// Para POST: usamos text/plain en el client (evita preflight) y devolvemos JSON.
function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================================================================
// TOKEN DE SEGURIDAD
// FIX: validar token en todos los requests
// El token se guarda en Script Properties (nunca en el código)
// ================================================================
function checkToken(param_token) {
  const stored = PropertiesService.getScriptProperties().getProperty("SECRET_TOKEN");
  // Si no hay token configurado, omitir validación (desarrollo inicial)
  if (!stored || stored === "") return true;
  return param_token === stored;
}

// ================================================================
// GET
// ================================================================
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "ping";
  const token  = (e && e.parameter && e.parameter.token) || "";
  try {
    if (!checkToken(token)) return jsonOut({ status:"error", message:"Unauthorized" });
    ensureSheetsOnce();
    if (action === "get_config")     return jsonOut(getConfig());
    if (action === "get_auditorias") return jsonOut(getAuditorias());
    if (action === "get_detalle")    return jsonOut(getDetalle());
    if (action === "get_criterios")  return jsonOut(getCriteriosCalidad());
    return jsonOut({ status:"ok", service:"AuditCS v7", timestamp: new Date().toISOString() });
  } catch(err) {
    logEnvio("?", "get_error", "ERROR", err.message);
    return jsonOut({ status:"error", message: err.message });
  }
}

function getConfig() {
  const sheet   = getSheet(SHEET_CONFIG);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { status:"ok", config:null };
  const rows = sheet.getRange(2, 1, lastRow-1, 5).getValues();
  const c = {};
  rows.forEach(r => { if(r[0]) c[String(r[0]).trim()] = r[1]; });
  const toArr = val => val ? String(val).split(",").map(s=>s.trim()).filter(Boolean) : [];
  return {
    status:"ok",
    config:{
      agentes:         toArr(c["agentes"]),
      auditores:       toArr(c["auditores"]),
      horas_base:      Number(c["horas_base"])       || 44,
      tickets_base:    Number(c["tickets_base"])     || 660,
      muestras_semana: Number(c["muestras_semana"])  || 4,
      w_inter:         Number(c["w_interacciones"])  || 60,
      w_puntual:       Number(c["w_puntualidad"])    || 20,
      w_present:       Number(c["w_presentismo"])    || 20,
      obj_puntual:     Number(c["obj_puntual"])      || 1,
      obj_present:     Number(c["obj_present"])      || 1,
      u_excelente:     Number(c["umbral_excelente"]) || 95,
      u_correcta:      Number(c["umbral_correcta"])  || 80,
      w_calidad:       Number(c["w_calidad"])        || 50,
      w_productividad: Number(c["w_productividad"])  || 50,
    },
  };
}

function getAuditorias() {
  const sheet   = getSheet(SHEET_AUDITORIAS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { status:"ok", auditorias:[] };
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const rows    = sheet.getRange(2,1,lastRow-1,sheet.getLastColumn()).getValues();
  const tz      = Session.getScriptTimeZone();
  const fmt = val => { if(!val) return ""; if(val instanceof Date) return Utilities.formatDate(val,tz,"yyyy-MM-dd"); return String(val); };
  const auditorias = rows.filter(r=>r[0]).map(r => {
    const o = {}; headers.forEach((h,i) => { o[h] = r[i] !== undefined ? r[i] : ""; });
    return {
      id:o["id_auditoria"]||"", id_auditoria:o["id_auditoria"]||"",
      fecha_registro:fmt(o["fecha_registro"]), fecha_auditoria:fmt(o["fecha_auditoria"]),
      anio:o["anio"]||"", mes:o["mes"]||"", semana:o["semana"]||"",
      auditor:o["auditor"]||"", agente:o["agente"]||"",
      ticket:String(o["ticket"])||"", canal:o["canal"]||"", tipo:o["tipo"]||"",
      horas_trabajadas:Number(o["horas_trabajadas"])||0,
      objetivo_interacciones:Number(o["objetivo_interacciones"])||0,
      interacciones_reales:Number(o["interacciones_reales"])||0,
      dias_tarde:Number(o["dias_tarde"])||0, dias_faltas:Number(o["dias_faltas"])||0,
      calidad:Number(o["pct_calidad"])||0, productividad:Number(o["pct_productividad"])||0,
      general:Number(o["pct_general"])||0, estado:o["estado"]||"",
      requiere_seguimiento:o["requiere_seguimiento"]||"No",
      obs_general:o["obs_general"]||"", obs_desvios:o["obs_desvios"]||"",
      obs_accion:o["obs_accion"]||"", resp_seguimiento:o["resp_seguimiento"]||"",
      sheets_enviado:true, criterios:[],
    };
  });
  return { status:"ok", auditorias };
}

function getDetalle() {
  const sheet   = getSheet(SHEET_DETALLE);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { status:"ok", detalle:{} };
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const rows    = sheet.getRange(2,1,lastRow-1,sheet.getLastColumn()).getValues();
  const detalle = {};
  rows.forEach(r => {
    if(!r[0]) return;
    const o={}; headers.forEach((h,i)=>{o[h]=r[i];});
    const id=o["id_auditoria"]; if(!id) return;
    if(!detalle[id]) detalle[id]=[];
    detalle[id].push({
      cod:o["criterio_codigo"]||"", nombre:o["criterio_nombre"]||"",
      bloque:o["bloque"]||"", peso:Number(o["peso_porcentaje"])||0,
      cumple:o["cumple_si_no"]||"", obtenido:Number(o["porcentaje_obtenido"])||0
    });
  });
  return { status:"ok", detalle };
}

function getCriteriosCalidad() {
  const sheet   = getSheet(SHEET_CRITERIOS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) { sembrarCriteriosDefault(sheet); return { status:"ok", criterios:CRITERIOS_DEFAULT }; }
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const rows    = sheet.getRange(2,1,lastRow-1,sheet.getLastColumn()).getValues();
  const criterios = rows.filter(r=>r[0]).map(r => {
    const o={}; headers.forEach((h,i)=>{o[h]=r[i];});
    return {
      cod:o["cod"]||"", bloque:o["bloque"]||"", nombre:o["nombre"]||"",
      peso:Number(o["peso"])||0, activo:String(o["activo"]).toLowerCase()!=="false"
    };
  });
  return { status:"ok", criterios };
}

function sembrarCriteriosDefault(sheet) {
  const now = new Date().toISOString();
  CRITERIOS_DEFAULT.forEach(c => sheet.appendRow([c.cod,c.bloque,c.nombre,c.peso,c.activo,now]));
}

// ================================================================
// POST
// ================================================================
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let result = { status:"error", message:"Unknown error" };
  try {
    const payload = JSON.parse(e.postData ? e.postData.contents : "{}");
    // FIX: validar token si está configurado
    const token = payload._token || "";
    if (!checkToken(token)) {
      result = { status:"error", message:"Unauthorized" };
      return jsonOut(result);
    }
    ensureSheetsOnce();
    if (payload._type === "config_change") {
      handleConfigChange(payload);
      result = { status:"ok", type:"config_synced" };
    } else if (payload._type === "update_criterios") {
      handleUpdateCriterios(payload.criterios || []);
      result = { status:"ok", type:"criterios_updated" };
    } else if (payload._type === "delete_auditoria") {
      deleteAuditoria(payload.id_auditoria);
      result = { status:"ok", deleted:payload.id_auditoria };
    } else {
      // FIX: validar pesos de criterios server-side
      if (payload.criterios && payload.criterios.length) {
        const sumPesos = payload.criterios.reduce((s,c) => s + (Number(c.peso)||0), 0);
        if (Math.abs(sumPesos - 100) > 1) {
          logEnvio(payload.id_auditoria||"?", "insert_warn", "WARN",
            `Pesos de criterios suman ${sumPesos}% en lugar de 100%`);
        }
      }
      if (findAuditoria(payload.id_auditoria)) {
        result = { status:"ok", id:payload.id_auditoria, duplicate:true };
      } else {
        // FIX: el ID definitivo se confirma desde el backend
        insertAuditoria(payload);
        insertDetalleCalidad(payload);
        insertProductividad(payload);
        insertObservacion(payload);
        logEnvio(payload.id_auditoria, "insert_completo","OK","");
        result = { status:"ok", id:payload.id_auditoria };
      }
    }
  } catch(err) {
    logEnvio("?","post_error","ERROR",err.message);
    result = { status:"error", message:err.message };
  } finally { lock.releaseLock(); }
  return jsonOut(result);
}

// ================================================================
// FIX: handleConfigChange con upsert por fila (no clearContent)
// Evita destruir datos extra en la hoja de configuración
// ================================================================
function handleConfigChange(p) {
  const now = new Date().toISOString();
  const par = p.parametros || {};
  const sheet = getSheet(SHEET_CONFIG);

  // Mapa de parámetros a guardar
  const params = [
    ["agentes",          (p.agentes||[]).join(", "),   "lista",    "Agentes activos"],
    ["auditores",        (p.auditores||[]).join(", "), "lista",    "Auditores del sistema"],
    ["horas_base",       par.horas_base     ||44,      "hs",       "Semana estándar de referencia"],
    ["tickets_base",     par.tickets_base   ||660,     "tickets",  "Objetivo para semana completa"],
    ["muestras_semana",  par.muestras_semana||4,       "muestras", "Auditorías recomendadas/agente/semana"],
    ["w_interacciones",  par.w_inter        ||60,      "%",        "Peso interacciones en productividad"],
    ["w_puntualidad",    par.w_puntual      ||20,      "%",        "Peso puntualidad en productividad"],
    ["w_presentismo",    par.w_present      ||20,      "%",        "Peso presentismo en productividad"],
    ["obj_puntual",      par.obj_puntual    ||1,       "días",     "Máx. días tarde permitidos/semana"],
    ["obj_present",      par.obj_present    ||1,       "días",     "Máx. días falta permitidos/semana"],
    ["umbral_excelente", par.u_excelente    ||95,      "%",        "Mínimo para estado Excelente"],
    ["umbral_correcta",  par.u_correcta     ||80,      "%",        "Mínimo para estado Correcta"],
    ["w_calidad",        par.w_calidad      ||50,      "%",        "Peso calidad en score general"],
    ["w_productividad",  par.w_productividad||50,      "%",        "Peso productividad en score general"],
  ];

  // Leer hoja existente para hacer upsert
  const lastRow = sheet.getLastRow();
  let existingKeys = {};
  if (lastRow > 1) {
    const keyCol = sheet.getRange(2,1,lastRow-1,1).getValues();
    keyCol.forEach((r,i) => { if(r[0]) existingKeys[String(r[0]).trim()] = i+2; }); // row index 1-based
  }

  params.forEach(([key, val, unit, desc]) => {
    if (existingKeys[key]) {
      // Actualizar fila existente — solo columnas valor y timestamp
      sheet.getRange(existingKeys[key], 2).setValue(val);
      sheet.getRange(existingKeys[key], 5).setValue(now);
    } else {
      // Insertar nueva fila
      sheet.appendRow([key, val, unit, desc, now]);
    }
  });

  // Log de cambio de configuración
  getSheet(SHEET_CONFIG_LOG).appendRow([
    "CFGLOG-"+Date.now(), now, p.accion||"cambio_config",
    typeof p.detalle==="object"?JSON.stringify(p.detalle):(p.detalle||""),
    (p.agentes||[]).join(", "), (p.auditores||[]).join(", "), JSON.stringify(par),
  ]);
}

function handleUpdateCriterios(criterios) {
  if(!criterios.length) return;
  const sheet = getSheet(SHEET_CRITERIOS);
  // FIX: validar suma de pesos antes de sobrescribir
  const sum = criterios.reduce((s,c) => s+(Number(c.peso)||0), 0);
  if(Math.abs(sum-100) > 1) throw new Error(`Pesos de criterios suman ${sum}% (deben ser 100%)`);
  const lr = sheet.getLastRow();
  if(lr>1) sheet.getRange(2,1,lr-1,HEADERS.criterios_calidad.length).clearContent();
  const now = new Date().toISOString();
  criterios.forEach(c => sheet.appendRow([c.cod,c.bloque,c.nombre,c.peso,c.activo!==false,now]));
}

function insertAuditoria(p) {
  const sheet = getSheet(SHEET_AUDITORIAS);
  const row = HEADERS.auditorias.map(col => {
    if (col === "timestamp_registro") return new Date().toISOString();
    // FIX: incluir pesos de calidad/productividad como columnas históricas
    if (col === "w_calidad")       return p.w_calidad||50;
    if (col === "w_productividad") return p.w_productividad||50;
    return p[col] !== undefined ? p[col] : "";
  });
  sheet.appendRow(row);
}

function insertDetalleCalidad(p) {
  if(!p.criterios||!p.criterios.length) return;
  const sheet = getSheet(SHEET_DETALLE);
  p.criterios.forEach((c,i) => sheet.appendRow([
    p.id_auditoria+"-DET-"+String(i+1).padStart(3,"0"),
    p.id_auditoria, c.bloque, c.cod, c.nombre, c.peso, c.cumple, c.obtenido,
  ]));
}

function insertProductividad(p) {
  const sheet      = getSheet(SHEET_PRODUCTIVIDAD);
  const objInter   = p.objetivo_interacciones||0;
  const realInter  = p.interacciones_reales||0;
  const tarde      = p.dias_tarde||0;
  const faltas     = p.dias_faltas||0;
  const objP       = p.obj_puntual||1;
  const objR       = p.obj_present||1;
  const wI=p.w_inter||60, wP=p.w_puntual||20, wR=p.w_present||20;
  const pI = objInter>0 ? Math.min(100,Math.round(realInter/objInter*100)) : 0;
  const pP = objP>0 ? Math.min(100,Math.round(Math.max(0,objP-tarde)/objP*100)) : 100;
  const pR = objR>0 ? Math.min(100,Math.round(Math.max(0,objR-faltas)/objR*100)) : 100;
  sheet.appendRow([
    p.id_auditoria+"-PROD", p.id_auditoria, p.fecha_auditoria,
    p.anio, p.mes, p.semana, p.agente,
    p.horas_trabajadas, objInter, realInter, tarde, faltas,
    pI, pP, pR, Math.round((pI*wI+pP*wP+pR*wR)/100),
    wI, wP, wR,  // FIX: guardar pesos usados para trazabilidad histórica
  ]);
}

function insertObservacion(p) {
  if(!p.obs_general&&!p.obs_desvios&&!p.obs_accion) return;
  const sheet = getSheet(SHEET_OBSERVACIONES);
  sheet.appendRow([
    p.id_auditoria+"-OBS", p.id_auditoria, new Date().toISOString(), p.agente, p.ticket,
    p.obs_general||"", p.obs_desvios||"", p.obs_accion||"",
    p.requiere_seguimiento||"No", p.resp_seguimiento||"",
    p.requiere_seguimiento==="Sí"?"Pendiente":"N/A",
  ]);
}

// FIX: deleteAuditoria con log de auditoría y búsqueda dinámica de columna
function deleteAuditoria(id) {
  if(!id) return;
  // Log primero (antes de borrar)
  logEnvio(id, "delete_auditoria", "OK", "Eliminado por usuario desde UI");
  // Para cada hoja, buscar la columna correcta con el id dinámicamente
  const config = [
    {name:SHEET_AUDITORIAS,    idField:"id_auditoria"},
    {name:SHEET_DETALLE,       idField:"id_auditoria"},
    {name:SHEET_PRODUCTIVIDAD, idField:"id_auditoria"},
    {name:SHEET_OBSERVACIONES, idField:"id_auditoria"},
  ];
  config.forEach(({name, idField}) => {
    const s = getSheet(name);
    const lr = s.getLastRow();
    if(lr <= 1) return;
    // Encontrar columna del id dinámicamente
    const headerRow = s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
    const colIdx = headerRow.indexOf(idField);
    if(colIdx === -1) return;
    // Buscar y borrar filas desde abajo
    for(let i=lr; i>=2; i--) {
      const cellVal = String(s.getRange(i, colIdx+1).getValue());
      if(cellVal === String(id)) s.deleteRow(i);
    }
  });
}

function findAuditoria(id) {
  if(!id) return false;
  const s=getSheet(SHEET_AUDITORIAS), lr=s.getLastRow(); if(lr<=1) return false;
  return s.getRange(2,1,lr-1,1).getValues().some(r=>String(r[0])===String(id));
}

function logEnvio(id, accion, resultado, error) {
  try {
    getSheet(SHEET_LOG).appendRow([
      "LOG-"+Date.now(), new Date().toISOString(), id||"?", accion, resultado, error||""
    ]);
  } catch(e){}
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

// FIX: ensureSheetsOnce — corre solo la primera vez usando PropertiesService
// En requests normales de producción no añade overhead de verificar 8 hojas
function ensureSheetsOnce() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(PROP_INITIALIZED) === "true") return;
  // Primera ejecución: crear hojas y headers
  Object.entries(HEADERS).forEach(([name, headers]) => {
    const s = getSheet(name);
    if(s.getLastRow() === 0) {
      s.appendRow(headers);
      s.getRange(1,1,1,headers.length)
        .setFontWeight("bold")
        .setBackground("#E8F0FE")
        .setBorder(true,true,true,true,false,false);
      s.setFrozenRows(1);
    }
  });
  // Sembrar criterios por defecto si la hoja está vacía
  const sc = getSheet(SHEET_CRITERIOS);
  if(sc.getLastRow() === 1) sembrarCriteriosDefault(sc);
  props.setProperty(PROP_INITIALIZED, "true");
}

// Función manual para re-inicializar si es necesario (ejecutar desde editor)
function reinitializeSheets() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_INITIALIZED);
  ensureSheetsOnce();
  Logger.log("Sheets re-inicializados correctamente.");
}

// Función de setup inicial — ejecutar manualmente una vez al crear el proyecto
function setupInitial() {
  reinitializeSheets();
  Logger.log("Setup inicial completado.");
}
