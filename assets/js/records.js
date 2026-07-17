// ================================================================
// RECORDS — registros, observaciones, delete, export CSV
// ================================================================

// ── Estado de tabla canónica ─────────────────────────────────────
let _recPage     = 1;
let _recPageSize = 25;
let _recSortCol  = null;
let _recSortDir  = 'asc';
let _recRows     = []; // filtrado+ordenado completo (para export y paginación)

function getRegistroConMetricas(a) {
  if (!isModeloSeparado(a)) return a;
  const productividad = DB.productividadSemanal.find(p =>
    p.agente === a.agente && Number(p.anio) === Number(a.anio) && Number(p.semana) === Number(a.semana)
  );
  if (!productividad) return { ...a, horas_trabajadas: null, productividad: null, general: null, estado: 'Incompleto' };
  const prod    = Number(productividad.total_productividad);
  const general = calcGeneral(a.calidad, prod);
  const horas   = Number(productividad.horas_trabajadas);
  return { ...a, horas_trabajadas: horas > 0 ? horas : null, productividad: prod, general, estado: calcEstado(general), completo: true };
}

// ── Filtrado y ordenamiento ──────────────────────────────────────
function _applyRecFilters() {
  const search = document.getElementById("filter-search").value.toLowerCase();
  const est    = document.getElementById("filter-estado").value;
  const ag     = document.getElementById("filter-agente").value;
  const mes    = document.getElementById("filter-mes").value;
  const sem    = document.getElementById("filter-semana").value;
  return DB.auditorias.filter(a => {
    if (search && !a.agente.toLowerCase().includes(search) && !String(a.ticket).includes(search)) return false;
    if (est && a.estado !== est) return false;
    if (ag  && a.agente !== ag)  return false;
    if (mes && a.mes    !== mes) return false;
    if (sem && String(a.semana) !== String(sem)) return false;
    return true;
  }).map(getRegistroConMetricas);
}

function _sortRecRows(rows) {
  if (!_recSortCol) return rows;
  return [...rows].sort((a, b) => {
    const va = String(a[_recSortCol] ?? '').toLowerCase();
    const vb = String(b[_recSortCol] ?? '').toLowerCase();
    return _recSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });
}

function _updateRecSortHeaders() {
  document.querySelectorAll('#tabla-registros th[data-sortable]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.key === _recSortCol) th.classList.add('sort-' + _recSortDir);
  });
}

// ── Render principal ─────────────────────────────────────────────
function renderRegistros() {
  _recRows = _sortRecRows(_applyRecFilters());
  const total     = _recRows.length;
  const pageCount = Math.max(1, Math.ceil(total / _recPageSize));
  if (_recPage > pageCount) _recPage = pageCount;
  const start = (_recPage - 1) * _recPageSize;
  const slice = _recRows.slice(start, start + _recPageSize);

  const countEl = document.getElementById("registros-count");
  if (countEl) countEl.textContent =
    `${total} de ${DB.auditorias.length} registro${DB.auditorias.length !== 1 ? 's' : ''}` +
    (PENDING_QUEUE.length ? ` · ⚠ ${PENDING_QUEUE.length} pendiente${PENDING_QUEUE.length > 1 ? 's' : ''}` : '');

  const tbody = document.getElementById("tbody-registros");
  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--hint);padding:24px">Sin registros.</td></tr>';
  } else {
    const U  = getUMB();
    const h  = escapeHtml;
    const sc = (v) => {
      if (v === null || v === undefined || Number.isNaN(Number(v))) return '<span style="color:var(--hint)">-</span>';
      const c = v >= U.excelente ? "sc-green" : v >= U.correcta ? "sc-amber" : "sc-red";
      return `<span class="score-cell ${c}">${v}%</span>`;
    };
    tbody.innerHTML = slice.map(a => `<tr>
      <td><span style="font-family:'DM Mono',monospace;font-size:11px">${h(a.id_auditoria)}</span></td>
      <td>${h(a.fecha_auditoria)}</td>
      <td style="font-weight:600">${h(a.agente)}</td>
      <td style="font-family:'DM Mono',monospace;font-size:12px">${h(a.ticket)}</td>
      <td>${h(a.canal)}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center">${h(a.semana)}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center">${Number(a.horas_trabajadas)>0?a.horas_trabajadas+'hs':'<span style="color:var(--hint)">Pendiente</span>'}</td>
      <td style="text-align:center">${sc(a.calidad)}</td>
      <td style="text-align:center">${sc(a.productividad)}</td>
      <td style="text-align:center">${sc(a.general)}</td>
      <td><span class="badge ${estadoBadge(a.estado)}">${h(a.estado)}</span></td>
      <td>${a.sheets_enviado ? '<span class="badge badge-ok">✓ Sheets</span>' : '<span class="badge badge-local">Pendiente</span>'}</td>
      <td>${canDeleteAuditorias() ? `<button class="btn xs danger" data-auditoria-id="${h(a.id_auditoria)}" onclick="deleteAuditoria(this.dataset.auditoriaId)" title="Eliminar registro" aria-label="Eliminar registro ${h(a.id_auditoria)}">&times;</button>` : ""}</td>
    </tr>`).join("");
  }

  _renderRecPagination(total);
  _updateRecSortHeaders();
}

function _renderRecPagination(total) {
  const pag = document.getElementById("rec-pagination");
  if (!pag) return;
  const pageCount = Math.max(1, Math.ceil(total / _recPageSize));
  const start     = (_recPage - 1) * _recPageSize;
  pag.style.display = total > 0 ? 'flex' : 'none';
  document.getElementById("rec-pagination-info").textContent =
    total <= _recPageSize
      ? `${total} filas`
      : `${start + 1}–${Math.min(start + _recPageSize, total)} de ${total}`;
  document.getElementById("rec-btn-prev").disabled = _recPage === 1;
  document.getElementById("rec-btn-next").disabled = _recPage >= pageCount;
}

// ── Observaciones ────────────────────────────────────────────────
function renderObservaciones() {
  const h         = escapeHtml;
  const agFilter  = document.getElementById("obs-filter-agente")?.value  || "";
  const estFilter = document.getElementById("obs-filter-estado")?.value  || "";
  const mesFilter = document.getElementById("obs-filter-mes")?.value     || "";
  const data = DB.auditorias.filter(a => {
    if (!a.obs_general && !a.obs_accion) return false;
    if (agFilter  && a.agente !== agFilter)  return false;
    if (estFilter && a.estado !== estFilter) return false;
    if (mesFilter && a.mes   !== mesFilter)  return false;
    return true;
  }).sort((a, b) => a.general - b.general);
  const countEl = document.getElementById("obs-count");
  if (countEl) countEl.textContent = `${data.length} observaci${data.length === 1 ? "ón" : "ones"} encontradas`;
  const cont = document.getElementById("obs-cards-container");
  if (!data.length) {
    cont.innerHTML = '<div class="card" style="color:var(--hint);text-align:center;padding:32px">Sin observaciones con los filtros seleccionados.</div>';
    return;
  }
  const U = getUMB();
  cont.innerHTML = data.map(a => {
    const scoreClass = a.general >= U.excelente ? "ok-score" : a.general >= U.correcta ? "mid-score" : "low-score";
    const scCell = v => { const c = v >= U.excelente ? "sc-green" : v >= U.correcta ? "sc-amber" : "sc-red"; return `<span class="score-cell ${c}">${v}%</span>`; };
    return `<div class="obs-card ${scoreClass}">
      <div class="obs-meta">
        <strong>${h(a.agente)}</strong>
        <span>${h(a.fecha_auditoria)}</span>
        ${a.ticket ? `<span>Ticket: ${h(a.ticket)}</span>` : ""}
        <span>Sem. ${h(a.semana)} · ${h(a.mes)}</span>
        <span style="margin-left:auto;display:flex;gap:6px;align-items:center">
          Cal: ${scCell(a.calidad)} Prod: ${scCell(a.productividad)} Gen: ${scCell(a.general)}
          <span class="badge ${estadoBadge(a.estado)}">${h(a.estado)}</span>
        </span>
      </div>
      ${a.obs_general ? `<div class="obs-text">${h(a.obs_general)}</div>` : ""}
      ${a.obs_accion  ? `<div style="margin-top:6px;font-size:11px;color:var(--amber);font-weight:500">→ Acción: ${h(a.obs_accion)}</div>` : ""}
    </div>`;
  }).join("");
}

// ── Eliminar auditoría ───────────────────────────────────────────
async function deleteAuditoria(id) {
  if (!canDeleteAuditorias()) { alert("No tenés permisos para eliminar registros."); return; }
  if (!confirm(`¿Eliminar ${id}? Esta acción no se puede deshacer.`)) return;
  const aud = DB.auditorias.find(a => a.id_auditoria === id);
  if (!aud) return;
  if (!aud.sheets_enviado) {
    removePendingCreate(aud.client_request_id);
    DB.auditorias = DB.auditorias.filter(a => a !== aud);
  } else {
    const res = await postSheets({ _type: "delete_auditoria", id_auditoria: id });
    if (!res.ok) {
      if (res.retryable) {
        queuePendingDelete(id);
        DB.auditorias = DB.auditorias.filter(a => a !== aud);
      }
      return;
    }
    DB.auditorias = DB.auditorias.filter(a => a !== aud);
  }
  renderRegistros();
  renderDashboard();
}

// ── Export CSV ───────────────────────────────────────────────────
function csvEscape(value) {
  const str = String(value ?? '').replace(/"/g, '""');
  return /[,;\n"]/.test(str) ? `"${str}"` : str;
}

function exportCSV() {
  if (!_recRows.length) { alert("No hay datos con los filtros actuales."); return; }
  const cols = ["id_auditoria","fecha_auditoria","auditor","agente","ticket","canal","tipo","mes","semana",
    "horas_trabajadas","objetivo_interacciones","interacciones_reales","dias_tarde","dias_faltas",
    "calidad","productividad","general","estado","requiere_seguimiento","obs_general","obs_accion","sheets_enviado"];
  const rows = _recRows.map(a => cols.map(k => csvEscape(a[k])));
  const csv  = [cols.map(csvEscape), ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: "auditoria_cs_" + new Date().toISOString().slice(0, 10) + ".csv",
  });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Wiring de sort headers y paginación ─────────────────────────
function _initRecTable() {
  document.querySelectorAll('#tabla-registros th[data-sortable]').forEach(th => {
    th.addEventListener('click', () => {
      _recSortDir = _recSortCol === th.dataset.key && _recSortDir === 'asc' ? 'desc' : 'asc';
      _recSortCol = th.dataset.key;
      _recPage    = 1;
      renderRegistros();
    });
  });
  const sel  = document.getElementById("rec-page-size");
  const prev = document.getElementById("rec-btn-prev");
  const next = document.getElementById("rec-btn-next");
  if (sel)  sel.addEventListener('change', e => { _recPageSize = Number(e.target.value); _recPage = 1; renderRegistros(); });
  if (prev) prev.addEventListener('click', () => { if (_recPage > 1) { _recPage--; renderRegistros(); } });
  if (next) next.addEventListener('click', () => {
    const pc = Math.ceil(_recRows.length / _recPageSize);
    if (_recPage < pc) { _recPage++; renderRegistros(); }
  });
}

(document.readyState === 'loading')
  ? document.addEventListener('DOMContentLoaded', _initRecTable)
  : _initRecTable();
