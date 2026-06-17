// ================================================================
// STATE — variables de estado mutable en memoria
// ================================================================
const DB = { auditorias:[], nextId:1 };
let PENDING_QUEUE = [];

// Snapshot de CRITERIOS al entrar al paso 2 del formulario
// Evita que cambios en config afecten una auditoría en curso
let _criteriosSnapshot = null;

// ID del setTimeout de la barra de sync
let _sTimer = null;

// Referencias a instancias de Chart.js
let _charts = {};
