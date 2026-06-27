// ================================================================
// Validators.gs — validación de campos y reglas de negocio.
// Todo lo que viene del frontend se trata como potencialmente corrupto.
// ================================================================

function requireParam_(value, name) {
  if (value === undefined || value === null || value === "")
    throw new Error("Parámetro requerido: " + name);
}

function validateString_(value, name, maxLen) {
  requireParam_(value, name);
  if (typeof value !== "string") throw new Error(name + " debe ser texto");
  const t = value.trim();
  if (t.length === 0) throw new Error(name + " no puede estar vacío");
  if (maxLen && t.length > maxLen) throw new Error(name + " supera el máximo de " + maxLen + " caracteres");
  return t;
}

function validateInt_(value, name) {
  const n = parseInt(value, 10);
  if (isNaN(n)) throw new Error(name + " debe ser numérico");
  return n;
}

function validateIdPositivo_(value, name) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n <= 0) throw new Error(name + " debe ser un ID numérico positivo");
  return n;
}

function validateEmail_(value, name) {
  const t = validateString_(value, name, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) throw new Error(name + " no es un email válido");
  return t;
}

function validateEnum_(value, name, allowed) {
  if (allowed.indexOf(value) === -1)
    throw new Error(name + ' inválido: "' + value + '". Permitidos: ' + allowed.join(", "));
  return value;
}

// ── Regla de negocio: tope de muestras de calidad por semana ────
function validateMuestrasSemana_(p) {
  const { headers, rows } = readSheet_(SHEETS.AUDITORIAS);
  const idxAgente = headers.indexOf("agente");
  const idxAnio   = headers.indexOf("anio");
  const idxSemana = headers.indexOf("semana");
  const limit = Number((getConfigDominio_().config || {}).muestras_semana) || 4;
  const count = rows.filter(r =>
    String(r[idxAgente]) === String(p.agente) &&
    Number(r[idxAnio])   === Number(p.anio)   &&
    Number(r[idxSemana]) === Number(p.semana)
  ).length;
  if (count >= limit)
    throw new Error("El agente ya tiene " + count + " muestras de calidad en la semana " + p.semana + " (máximo " + limit + ").");
}

// ── Validación de pesos de criterios (suma 100% ±1) ─────────────
function validatePesosCriterios_(criterios) {
  const sum = (criterios || []).reduce((s, c) => s + (Number(c.peso) || 0), 0);
  if (Math.abs(sum - 100) > 1)
    throw new Error("Pesos de criterios suman " + sum + "% (deben ser 100%)");
  return sum;
}
