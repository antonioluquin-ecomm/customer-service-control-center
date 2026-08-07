// ================================================================
// VOLUMEN — carga diaria de volumen por canal (jefe de Servicio al Cliente).
// Reemplaza la carga manual en el Excel de SharePoint. Upsert por fecha
// (una fila por día) + historial/dashboard con auditoría de ediciones.
// ================================================================

let _volumenCanalActivo = "wsp";

// "Hoy" en fecha local — nunca usar toISOString().slice(0,10) para esto:
// convierte a UTC, y en Argentina (UTC-3) eso adelanta la fecha un día
// a partir de las ~21:00 locales, justo cuando suele cerrarse la carga.
function volumenHoyLocal() {
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

function volumenFechaMeta(fecha) {
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const d = new Date(fecha + "T12:00:00");
  return { anio: d.getFullYear(), mes: meses[d.getMonth()], semana: getISOWeek(fecha) };
}

function findVolumen(fecha) { return DB.volumenCanales.find(r => r.fecha === fecha); }

/* ─── Carga del día ──────────────────────────────────────────── */

function initVolumenForm() {
  const el = document.getElementById("vc-fecha");
  if (el && !el.value) el.value = volumenHoyLocal();
  loadVolumenDia();
}

function volumenShiftDia(delta) {
  const el = document.getElementById("vc-fecha");
  const d = new Date(el.value + "T12:00:00");
  d.setDate(d.getDate() + delta);
  const p = n => String(n).padStart(2, "0");
  el.value = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  loadVolumenDia();
}

// Trae al formulario lo ya cargado para la fecha (si existe) — permite
// tanto ver el día actual como corregir un día pasado desde la misma pantalla.
function loadVolumenDia() {
  const fecha = v("vc-fecha");
  const rec = findVolumen(fecha);
  VOLUMEN_CAMPOS.forEach(k => {
    const el = document.getElementById("vc-" + k);
    if (el) el.value = rec && rec[k] != null ? rec[k] : "";
  });
  const alertEl = document.getElementById("vc-alert");
  if (alertEl) alertEl.classList.add("hidden");
  const pill = document.getElementById("vc-status");
  if (!pill) return;
  if (!rec) { pill.className = "badge badge-local"; pill.textContent = "Sin cargar"; return; }
  if (rec.sheets_enviado === false) { pill.className = "badge badge-local"; pill.textContent = "Pendiente de sincronización"; return; }
  if (Number(rec.veces_editado) > 0) { pill.className = "badge badge-correcta"; pill.textContent = `Editado ${rec.veces_editado}x — ${rec.cargado_por || ""}`; return; }
  pill.className = "badge badge-ok"; pill.textContent = `Cargado — ${rec.cargado_por || ""}`;
}

function collectVolumenData() {
  const fecha = v("vc-fecha");
  const data = { fecha, ...volumenFechaMeta(fecha) };
  VOLUMEN_CAMPOS.forEach(k => { const raw = v("vc-" + k); data[k] = raw === "" ? null : Number(raw); });
  return data;
}

function saveVolumenLocal(data, sheets_enviado, serverVecesEditado) {
  const old = findVolumen(data.fecha);
  const veces_editado = serverVecesEditado != null ? serverVecesEditado : (old ? (Number(old.veces_editado) || 0) + 1 : 0);
  const row = { ...old, ...data, veces_editado, sheets_enviado, cargado_por: getSession()?.usuario?.email || old?.cargado_por || "" };
  const i = DB.volumenCanales.indexOf(old);
  if (i >= 0) DB.volumenCanales[i] = row; else DB.volumenCanales.push(row);
  return !!old;
}

async function persistVolumen(data) {
  const res = await postSheets({ ...data, _type: "upsert_volumen_canales" });
  if (res.ok) { saveVolumenLocal(data, true, res.data?.veces_editado); return { ok: true }; }
  if (res.retryable) { saveVolumenLocal(data, false); queuePendingVolumen(data); }
  return { ok: false, retryable: !!res.retryable, reason: res.reason };
}

async function submitVolumen() {
  const data = collectVolumenData();
  if (!data.fecha) { alert("Seleccioná una fecha."); return; }
  if (VOLUMEN_CAMPOS.some(k => data[k] != null && data[k] < 0)) { alert("Los valores no pueden ser negativos."); return; }
  const exists = findVolumen(data.fecha);
  if (exists && !confirm(`Ya hay datos cargados para el ${data.fecha}. Se van a sobreescribir y quedará registrado como edición. ¿Continuar?`)) return;
  const result = await persistVolumen({ ...data, client_request_id: createClientRequestId() });
  const alertEl = document.getElementById("vc-alert");
  if (alertEl) {
    alertEl.className = result.ok ? "alert success" : "alert warning";
    alertEl.textContent = result.ok
      ? (exists ? "Día actualizado." : "Día cargado.")
      : (result.retryable ? "Sin conexión: guardado localmente y pendiente de sincronización." : "No se guardó: " + result.reason);
    alertEl.classList.remove("hidden");
  }
  loadVolumenDia();
  renderVolumenHistorial();
}

/* ─── Historial y gráfico ────────────────────────────────────── */

function setVolumenTab(tab) {
  document.querySelectorAll('[data-volumen-tab]').forEach(el => el.classList.toggle('hidden', el.dataset.volumenTab !== tab));
  document.querySelectorAll('[data-volumen-tab-btn]').forEach(el => el.classList.toggle('primary', el.dataset.volumenTabBtn === tab));
  if (tab === "historial") renderVolumenHistorial();
}

function setVolumenCanal(id) { _volumenCanalActivo = id; renderVolumenHistorial(); }

function goToVolumenFecha(fecha) {
  document.getElementById("vc-fecha").value = fecha;
  loadVolumenDia();
  setVolumenTab("carga");
}

function renderVolumenChipsOnce() {
  const wrap = document.getElementById("vc-canal-chips");
  if (!wrap || wrap.dataset.built) return;
  wrap.innerHTML = VOLUMEN_BLOQUES.map(b => `<span class="vc-canal-chip" data-canal="${b.id}" onclick="setVolumenCanal('${b.id}')">${escapeHtml(b.label)}</span>`).join("");
  wrap.dataset.built = "1";
}

// Últimos 14 días calendario, incluyendo los que no tienen carga —
// un día salteado tiene que verse en el historial, no desaparecer.
function volumenUltimosDias(n) {
  const out = [];
  const hoy = new Date();
  const p = x => String(x).padStart(2, "0");
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy); d.setDate(d.getDate() - i);
    out.push(d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()));
  }
  return out;
}

function renderVolumenHistorial() {
  renderVolumenChipsOnce();
  const bloque = VOLUMEN_BLOQUES.find(b => b.id === _volumenCanalActivo) || VOLUMEN_BLOQUES[0];
  document.querySelectorAll("#vc-canal-chips .vc-canal-chip").forEach(el => el.classList.toggle("on", el.dataset.canal === bloque.id));

  const dias30 = volumenUltimosDias(30).map(fecha => findVolumen(fecha) || { fecha, _missing: true });
  renderVolumenChart(bloque, dias30);

  const dias14 = volumenUltimosDias(14).reverse().map(fecha => findVolumen(fecha) || { fecha, _missing: true });
  renderVolumenTable(bloque, dias14);
}

function renderVolumenChart(bloque, rows) {
  const canvas = document.getElementById("chart-volumen");
  if (!canvas || typeof Chart === "undefined") return;
  const campo = bloque.campos[0].key;
  const labels = rows.map(r => r.fecha.slice(5));
  // null (no undefined) para los días sin carga — con spanGaps:false, Chart.js
  // corta la línea en vez de unir dos días lejanos como si fueran seguidos.
  const data = rows.map(r => r._missing ? null : (r[campo] ?? null));
  if (_charts.volumen) _charts.volumen.destroy();
  _charts.volumen = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels, datasets: [{ label: `${bloque.label} — ${bloque.campos[0].label}`, data, borderColor: bloque.color, backgroundColor: bloque.color + "33", fill: true, tension: .35, pointRadius: 2, spanGaps: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });
  const head = document.getElementById("vc-chart-title");
  if (head) head.textContent = `${bloque.label} — ${bloque.campos[0].label} por día`;
}

function renderVolumenTable(bloque, rows) {
  const out = document.getElementById("vc-table");
  if (!out) return;
  const cols = bloque.campos;
  out.innerHTML = `<table><thead><tr><th>Fecha</th>${cols.map(c => `<th>${escapeHtml(c.label)}</th>`).join("")}<th>Estado</th><th>Cargado por</th><th></th></tr></thead><tbody>${
    rows.map(r => {
      const estado = r._missing ? '<span class="badge badge-local">Sin cargar</span>'
        : r.sheets_enviado === false ? '<span class="badge badge-local">Pendiente sync</span>'
        : Number(r.veces_editado) > 0 ? `<span class="badge badge-correcta">Editado ${r.veces_editado}x</span>`
        : '<span class="badge badge-ok">Completo</span>';
      return `<tr><td>${escapeHtml(r.fecha)}</td>${cols.map(c => `<td>${r[c.key] ?? "—"}</td>`).join("")}<td>${estado}</td><td>${escapeHtml(r.cargado_por || "—")}</td><td><a href="#" onclick="goToVolumenFecha('${r.fecha}');return false;">${r._missing ? "Cargar" : "Editar"}</a></td></tr>`;
    }).join("")
  }</tbody></table>`;
}
