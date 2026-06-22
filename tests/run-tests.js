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
  const analysis = context.analytics.buildDashboardAnalysis(records);
  assert.strictEqual(analysis.currentWeek, 11);
  assert.strictEqual(analysis.previousWeek, 10);
  assert.strictEqual(analysis.metrics.qualityDelta, -13);
  assert.strictEqual(analysis.priorities[0].agent, 'Ana');
  assert.strictEqual(analysis.priorities[0].severity, 'high');
  assert.strictEqual(analysis.rootCauses[0].name, 'Escucha');
}
testCalculations();
testOfflineQueueMigration();
testDashboardAnalysis();
testServerIds();
console.log('All AuditCS tests passed.');