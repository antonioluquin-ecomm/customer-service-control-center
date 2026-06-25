const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function loadCalculations() {
  const context = {
    CFG: { u_excelente: 95, u_correcta: 80, w_calidad: 50, w_productividad: 50, tickets_base: 660, horas_base: 44 },
    CRITERIOS: [], _criteriosSnapshot: null,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('assets/js/calculations.js', 'utf8') + '\nthis.calculations = { avg, calcEstado, calcGeneral, calcObjetivo, getISOWeek };', context);
  return context.calculations;
}

function testCalculations() {
  const ctx = loadCalculations();
  assert.strictEqual(ctx.avg([80, 90, 100]), 90);
  assert.strictEqual(ctx.avg([]), 0);
  assert.strictEqual(ctx.calcEstado(95), 'Excelente');
  assert.strictEqual(ctx.calcEstado(80), 'Correcta');
  assert.strictEqual(ctx.calcEstado(79), 'Observada');
  assert.strictEqual(ctx.calcGeneral(80, 90), 85);
  assert.strictEqual(ctx.calcObjetivo(22), 330);
  assert.strictEqual(ctx.getISOWeek('2026-01-01'), '1');
}

function testOfflineQueueMigration() {
  let raw = JSON.stringify([{ id_auditoria: 'LOCAL-1' }]);
  const context = {
    window: { crypto: { randomUUID: () => 'uuid-1' } },
    crypto: { randomUUID: () => 'uuid-1' },
    localStorage: { getItem: () => raw, setItem: (_, value) => { raw = value; } },
    document: { getElementById: () => null },
  };
  vm.createContext(context);
  const source = fs.readFileSync('assets/js/storage.js', 'utf8').replace(/\?\./g, '.');
  vm.runInContext(source, context);
  vm.runInContext(`
    loadPendingQueue();
    if (PENDING_QUEUE[0].operation !== 'create') throw new Error('legacy create was not normalized');
    queuePendingDelete('AUD-0001');
    if (PENDING_QUEUE[1].operation !== 'delete') throw new Error('delete was not queued');
    queuePendingProductividad({ agente:'Ana', anio:2026, semana:26 });
    if (PENDING_QUEUE[2].operation !== 'upsert_productividad') throw new Error('productividad was not queued');
  `, context);
}

function testServerIds() {
  const properties = new Map([['last_auditoria_id', '41']]);
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
    Date, JSON, String, Number,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script/AppsScript.js', 'utf8'), context);
  assert.strictEqual(context.getNextAuditoriaId(), 'AUD-0042');
  assert.strictEqual(context.getNextAuditoriaId(), 'AUD-0043');
  assert.strictEqual(context.canDeleteAuditorias({ role: 'admin' }), true);
  assert.strictEqual(context.canDeleteAuditorias({ role: 'supervisor' }), true);
  assert.strictEqual(context.canDeleteAuditorias({ role: 'auditor' }), false);
}


function testDashboardAnalysis() {
  const context = {
    CFG: { u_excelente: 95, u_correcta: 80 },
    document: { getElementById: () => null },
    escapeHtml: value => String(value),
    Chart: { getChart: () => null },
    avg: values => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0,
    getUMB: () => ({ excelente: 95, correcta: 80 }),
  };
  vm.createContext(context);
  const source = fs.readFileSync('assets/js/dashboard.js', 'utf8').replace(/\?\./g, '.');
  vm.runInContext(source + '\nthis.analytics = { buildDashboardAnalysis };', context);
  const records = [
    { agente: 'Ana', semana: 10, fecha_auditoria: '2026-03-01', general: 90, calidad: 92, productividad: 88, criterios: [{ nombre: 'Escucha', cumple: 'Sí' }] },
    { agente: 'Ana', semana: 11, fecha_auditoria: '2026-03-08', general: 68, calidad: 70, productividad: 66, criterios: [{ nombre: 'Escucha', cumple: 'No' }] },
    { agente: 'Ana', semana: 11, fecha_auditoria: '2026-03-09', general: 65, calidad: 68, productividad: 62, criterios: [{ nombre: 'Escucha', cumple: 'No' }] },
    { agente: 'Bruno', semana: 10, fecha_auditoria: '2026-03-01', general: 85, calidad: 86, productividad: 84, criterios: [{ nombre: 'Saludo', cumple: 'Sí' }] },
    { agente: 'Bruno', semana: 11, fecha_auditoria: '2026-03-08', general: 88, calidad: 90, productividad: 86, criterios: [{ nombre: 'Saludo', cumple: 'Sí' }] },
  ];
  const dashboardRecords = records.map(record => ({ ...record, anio: 2026, calidadCargada: true, productividadCargada: true, completo: true }));
  const analysis = context.analytics.buildDashboardAnalysis(dashboardRecords);
  assert.strictEqual(analysis.currentWeek, '2026-W11');
  assert.strictEqual(analysis.previousWeek, '2026-W10');
  assert.strictEqual(analysis.metrics.qualityDelta, -13);
  assert.strictEqual(analysis.priorities[0].agent, 'Ana');
  assert.strictEqual(analysis.priorities[0].severity, 'high');
  assert.strictEqual(analysis.rootCauses[0].name, 'Escucha');
  const incomplete = context.analytics.buildDashboardAnalysis([{ agente: 'Carla', anio: 2026, semana: 12, fecha_auditoria: '2026-03-15', calidad: 82, productividad: null, general: null, calidadCargada: true, productividadCargada: false, completo: false, criterios: [] }]);
  assert.strictEqual(incomplete.priorities.length, 0);
}
testCalculations();
testOfflineQueueMigration();
testDashboardAnalysis();
testSeparatedMetricsComposition();
testServerIds();
testProductividadImportParsing();
testServerMuestrasLimit();
console.log('All AuditCS tests passed.');

function testSeparatedMetricsComposition() {
  const context = {
    DB: { productividadSemanal: [{ agente:'Luciana', anio:2026, semana:23, total_productividad:71 }] },
    isModeloSeparado: item => item.productividad === null || item.general === null,
    calcGeneral: (cal, prod) => Math.round((cal + prod) / 2),
    calcEstado: score => score >= 80 ? 'Correcta' : 'Observada',
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('assets/js/records.js', 'utf8').replace(/\?\./g, '.').replace(/\?\?/g, '||') + '\nthis.records = { getRegistroConMetricas };', context);
  const record = context.records.getRegistroConMetricas({ agente:'Luciana', anio:2026, semana:23, calidad:0, productividad:null, general:null });
  assert.strictEqual(record.productividad, 71);
  assert.strictEqual(record.general, 36);
  assert.strictEqual(record.estado, 'Observada');
}

function testProductividadImportParsing() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('assets/js/productividad.js', 'utf8').replace(/\?\./g, '.').replace(/\?\?/g, '||').replace(/files\.\[0\]/g, 'files[0]') + '\nthis.productividad = { csvRows, parseSemana };', context);
  const rows = context.productividad.csvRows('Agente,Semana\n"Perez, Ana",2026-W26\n');
  assert.strictEqual(rows[1][0], 'Perez, Ana');
  assert.strictEqual(context.productividad.parseSemana('2026-W26').anio, 2026);
  assert.strictEqual(context.productividad.parseSemana('2026-W26').semana, 26);
}

function testServerMuestrasLimit() {
  const context = { Date, JSON, String, Number };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script/AppsScript.js', 'utf8'), context);
  const headers = ['id_auditoria', 'agente', 'anio', 'semana'];
  const rows = [
    ['AUD-1', 'Ana', 2026, 26], ['AUD-2', 'Ana', 2026, 26],
    ['AUD-3', 'Ana', 2026, 26], ['AUD-4', 'Ana', 2026, 26],
    ['AUD-5', 'Ana', 2025, 26],
  ];
  assert.strictEqual(context.countMuestrasSemana(rows, headers, 'Ana', 2026, 26), 4);
  assert.strictEqual(context.countMuestrasSemana(rows, headers, 'Ana', 2025, 26), 1);
}
