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

testCalculations();
testOfflineQueueMigration();
testServerIds();
console.log('All AuditCS tests passed.');