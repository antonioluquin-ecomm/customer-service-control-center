// ================================================================
// MigracionVolumenHistorico.gs — importa el histórico Ene-Ago 2026 del
// Excel "Reporte sac 2026.xlsx" (SharePoint) a la hoja `volumen_canales`.
// Herramienta de un solo uso — no se ejecuta con doGet/doPost, se corre
// manualmente desde el editor de Apps Script (Ejecutar > migrarVolumenHistoricoTodo).
//
// ── Cómo usarlo ──────────────────────────────────────────────────
// 1. En Google Drive, subí "Reporte sac 2026.xlsx" (o abrilo directo desde
//    SharePoint y descargalo) y convertilo con clic derecho → Abrir con →
//    Google Sheets. Eso crea una COPIA nueva; el Excel original no se toca.
// 2. Copiá el ID de esa copia desde su URL:
//    https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
// 3. Pegalo en MIGRACION_SOURCE_SHEET_ID acá abajo.
// 4. Pegá este archivo en el mismo proyecto de Apps Script que el resto
//    de AuditCS (junto a VolumenCanales.gs, Config.gs, etc.).
// 5. Desde el editor: seleccioná la función migrarVolumenHistoricoTodo y
//    ejecutar. Revisá el resultado en Ver > Registros de ejecución.
// 6. Es re-ejecutable sin duplicar: si una fecha ya existe en
//    volumen_canales, se salta (no pisa carga manual ni migraciones
//    previas) salvo que pases forzarSobrescritura=true.
// ================================================================

const MIGRACION_SOURCE_SHEET_ID = "PEGAR_AQUI_EL_ID_DEL_GOOGLE_SHEET_CONVERTIDO"; // ← completar

const MIGRACION_HOJAS = [
  "Enero 2026", "Febrero 2026", "Marzo 2026", "Abril 2026",
  "Mayo 2026", "Junio 2026", "Julio 2026", "Agosto 2026",
];

// Nombre de bloque tal cual aparece en el Excel → prefijo de campo en volumen_canales
// (null = sin prefijo, para el bloque "REEMBOLSOS / CC" cuyos campos ya son literales).
const MIGRACION_BLOQUES = {
  "WSP":             { prefijo: "wsp",      metricas: { "INGRESO":"ingreso", "SALIDA":"salida" } },
  "LLAMADAS":        { prefijo: "llamadas", metricas: { "ATENDIDAS":"atendidas", "DESBORDADAS":"desbordadas", "NO RESPONDIDAS":"no_respondidas" } },
  "REDES":           { prefijo: "redes",    metricas: { "PRIVADOS":"privados", "COMENTARIOS":"comentarios", "MIN-PRIVADOS":"min_privados" } },
  "MAILS":           { prefijo: "mails",    metricas: { "INGRESO":"ingreso", "SALIDA":"salida" } },
  "VENTAS":          { prefijo: "ventas",   metricas: { "INGRESO":"ingreso", "SALIDA":"salida", "CANCELADOS":"cancelados" } },
  "REEMBOLSOS / CC": { prefijo: null,       metricas: { "REEMBOLSOS PIM":"reembolsos_pim", "PENDIENTES PIM":"pendientes_pim", "CC GESTIONADOS":"cc_gestionados", "RECLAMOS":"reclamos" } },
};

// ── Entry points manuales ────────────────────────────────────────
function migrarVolumenHistoricoTodo() {
  const resumen = MIGRACION_HOJAS.map(nombre => {
    try {
      const r = migrarVolumenHistoricoHoja_(nombre, false);
      return nombre + ": " + r.importados + " día(s) importado(s), " + r.omitidos + " ya existían";
    } catch (e) {
      return nombre + ": ERROR — " + e.message;
    }
  });
  Logger.log(resumen.join("\n"));
}

// Útil para migrar (o reintentar) un solo mes, ej. desde el editor:
// migrarVolumenHistoricoHoja_("Marzo 2026", false)
function migrarVolumenHistoricoHoja_(nombreHoja, forzarSobrescritura) {
  if (!MIGRACION_SOURCE_SHEET_ID || MIGRACION_SOURCE_SHEET_ID.indexOf("PEGAR_AQUI") === 0)
    throw new Error("Configurá MIGRACION_SOURCE_SHEET_ID antes de migrar");

  const src = SpreadsheetApp.openById(MIGRACION_SOURCE_SHEET_ID).getSheetByName(nombreHoja);
  if (!src) throw new Error("No existe la hoja '" + nombreHoja + "' en el Excel origen");

  const porFecha = _migracionParsearHoja_(src.getDataRange().getValues());
  const existentes = new Set(getAllRows_(SHEETS.VOLUMEN_CANALES).map(r => formatDate_(r.fecha)));
  const ses = { email: "migracion-historico" };

  let importados = 0, omitidos = 0;
  Object.keys(porFecha).sort().forEach(fecha => {
    if (existentes.has(fecha) && !forzarSobrescritura) { omitidos++; return; }
    upsertVolumenCanales_({ fecha, ..._migracionMeta_(fecha), ...porFecha[fecha] }, ses);
    importados++;
  });
  return { importados, omitidos };
}

// ── Parseo del layout del Excel ──────────────────────────────────
// El Excel repite el mismo set de bloques (WSP, LLAMADAS, REDES, MAILS,
// VENTAS, REEMBOLSOS / CC) varias veces por hoja, en distintas columnas
// (A, D, L, …) según cuántos días se fueron pegando. En vez de asumir
// columnas fijas, se escanea toda la grilla buscando el NOMBRE del bloque;
// las fechas están a la derecha de esa celda (hasta la primera vacía) y
// las métricas debajo, en la misma columna, hasta la primera fila vacía.
function _migracionParsearHoja_(data) {
  const porFecha = {};

  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const nombreBloque = String(data[r][c] ?? "").trim().toUpperCase();
      const bloque = MIGRACION_BLOQUES[nombreBloque];
      if (!bloque) continue;

      const fechaCols = [];
      let cc = c + 1;
      while (cc < data[r].length && data[r][cc] instanceof Date) { fechaCols.push(cc); cc++; }
      if (!fechaCols.length) continue; // "WSP" suelto sin fechas al lado — no es un header de bloque

      let rr = r + 1;
      while (rr < data.length) {
        const etiquetaMetrica = String(data[rr][c] ?? "").trim().toUpperCase();
        if (!etiquetaMetrica) break; // fila vacía = fin del bloque
        const sufijo = bloque.metricas[etiquetaMetrica];
        if (sufijo) {
          const campo = bloque.prefijo ? bloque.prefijo + "_" + sufijo : sufijo;
          fechaCols.forEach(fc => {
            const valor = data[rr][fc];
            if (valor === "" || valor === null || valor === undefined) return;
            const fecha = Utilities.formatDate(data[r][fc], Session.getScriptTimeZone(), "yyyy-MM-dd");
            porFecha[fecha] = porFecha[fecha] || {};
            porFecha[fecha][campo] = Number(valor) || 0;
          });
        }
        rr++;
      }
    }
  }
  return porFecha;
}

// Mismo cálculo de año/mes/semana ISO que usa el frontend (calculations.js).
function _migracionMeta_(fecha) {
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const d = new Date(fecha + "T12:00:00");
  const temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
  return { anio: d.getFullYear(), mes: meses[d.getMonth()], semana: String(semana) };
}
