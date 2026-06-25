// ================================================================
// RECORDS — registros, observaciones, delete, export CSV
// ================================================================

// Tabla filtrable de auditorías
function getRegistroConMetricas(a){
  if(!isModeloSeparado(a)) return a;
  const productividad=DB.productividadSemanal.find(p=>p.agente===a.agente&&Number(p.anio)===Number(a.anio)&&Number(p.semana)===Number(a.semana));
  if(!productividad) return {...a, productividad:null, general:null, estado:'Incompleto'};
  const prod=Number(productividad.total_productividad);
  const general=calcGeneral(a.calidad,prod);
  return {...a, productividad:prod, general, estado:calcEstado(general), completo:true};
}

function renderRegistros(){
  const search=document.getElementById("filter-search").value.toLowerCase();
  const est=document.getElementById("filter-estado").value;
  const ag=document.getElementById("filter-agente").value;
  const mes=document.getElementById("filter-mes").value;
  const sem=document.getElementById("filter-semana").value;
  const data=DB.auditorias.filter(a=>{
    if(search&&!a.agente.toLowerCase().includes(search)&&!String(a.ticket).includes(search)) return false;
    if(est&&a.estado!==est) return false;
    if(ag&&a.agente!==ag) return false;
    if(mes&&a.mes!==mes) return false;
    if(sem&&String(a.semana)!==String(sem)) return false;
    return true;
  }).map(getRegistroConMetricas);
  document.getElementById("registros-count").textContent=`Mostrando ${data.length} de ${DB.auditorias.length} registros${PENDING_QUEUE.length?` · ⚠ ${PENDING_QUEUE.length} pendiente${PENDING_QUEUE.length>1?"s":""}`:""}.`;
  const tbody=document.getElementById("tbody-registros");
  if(!data.length){ tbody.innerHTML='<tr><td colspan="13" style="text-align:center;color:var(--hint);padding:24px">Sin registros.</td></tr>'; return; }
  const U=getUMB();
  const h=escapeHtml;
  const sc=(v)=>{ if(v===null||v===undefined||Number.isNaN(Number(v))) return '<span style="color:var(--hint)">-</span>'; const c=v>=U.excelente?"sc-green":v>=U.correcta?"sc-amber":"sc-red"; return `<span class="score-cell ${c}">${v}%</span>`; };
  tbody.innerHTML=data.map(a=>`<tr>
    <td><span style="font-family:'DM Mono',monospace;font-size:11px">${h(a.id_auditoria)}</span></td>
    <td>${h(a.fecha_auditoria)}</td>
    <td style="font-weight:600">${h(a.agente)}</td>
    <td style="font-family:'DM Mono',monospace;font-size:12px">${h(a.ticket)}</td>
    <td>${h(a.canal)}</td>
    <td style="font-family:'DM Mono',monospace;text-align:center">${h(a.semana)}</td>
    <td style="font-family:'DM Mono',monospace;text-align:center">${a.horas_trabajadas}hs</td>
    <td style="text-align:center">${sc(a.calidad)}</td>
    <td style="text-align:center">${sc(a.productividad)}</td>
    <td style="text-align:center">${sc(a.general)}</td>
    <td><span class="badge ${estadoBadge(a.estado)}">${h(a.estado)}</span></td>
    <td>${a.sheets_enviado?'<span class="badge badge-ok">✓ Sheets</span>':'<span class="badge badge-local">Pendiente</span>'}</td>
    <td>${canDeleteAuditorias()?`<button class="btn xs danger" data-auditoria-id="${h(a.id_auditoria)}" onclick="deleteAuditoria(this.dataset.auditoriaId)" title="Eliminar registro" aria-label="Eliminar registro ${h(a.id_auditoria)}">&times;</button>`:""}</td>
  </tr>`).join("");
}

// Tarjetas de observaciones filtradas
function renderObservaciones(){
  const h=escapeHtml;
  const agFilter  = document.getElementById("obs-filter-agente")?.value  || "";
  const estFilter = document.getElementById("obs-filter-estado")?.value  || "";
  const mesFilter = document.getElementById("obs-filter-mes")?.value     || "";
  const data=DB.auditorias.filter(a=>{
    if(!a.obs_general && !a.obs_accion) return false;
    if(agFilter  && a.agente !== agFilter)  return false;
    if(estFilter && a.estado !== estFilter) return false;
    if(mesFilter && a.mes   !== mesFilter)  return false;
    return true;
  }).sort((a,b)=>a.general-b.general);
  const countEl=document.getElementById("obs-count");
  if(countEl) countEl.textContent=`${data.length} observaci${data.length===1?"ón":"ones"} encontradas`;
  const cont=document.getElementById("obs-cards-container");
  if(!data.length){ cont.innerHTML='<div class="card" style="color:var(--hint);text-align:center;padding:32px">Sin observaciones con los filtros seleccionados.</div>'; return; }
  const U=getUMB();
  cont.innerHTML=data.map(a=>{
    const scoreClass=a.general>=U.excelente?"ok-score":a.general>=U.correcta?"mid-score":"low-score";
    const scCell=v=>{const c=v>=U.excelente?"sc-green":v>=U.correcta?"sc-amber":"sc-red"; return `<span class="score-cell ${c}">${v}%</span>`;};
    return `<div class="obs-card ${scoreClass}">
      <div class="obs-meta">
        <strong>${h(a.agente)}</strong>
        <span>${h(a.fecha_auditoria)}</span>
        ${a.ticket?`<span>Ticket: ${h(a.ticket)}</span>`:""}
        <span>Sem. ${h(a.semana)} · ${h(a.mes)}</span>
        <span style="margin-left:auto;display:flex;gap:6px;align-items:center">
          Cal: ${scCell(a.calidad)} Prod: ${scCell(a.productividad)} Gen: ${scCell(a.general)}
          <span class="badge ${estadoBadge(a.estado)}">${h(a.estado)}</span>
        </span>
      </div>
      ${a.obs_general?`<div class="obs-text">${h(a.obs_general)}</div>`:""}
      ${a.obs_accion?`<div style="margin-top:6px;font-size:11px;color:var(--amber);font-weight:500">→ Acción: ${h(a.obs_accion)}</div>`:""}
    </div>`;
  }).join("");
}

// Elimina una auditoría local y en Sheets
async function deleteAuditoria(id){
  if(!canDeleteAuditorias()) { alert("No ten�s permisos para eliminar registros."); return; }
  if(!confirm(`�Eliminar ${id}? Esta acci�n no se puede deshacer.`)) return;
  const aud=DB.auditorias.find(a=>a.id_auditoria===id);
  if(!aud) return;
  if(!aud.sheets_enviado){
    removePendingCreate(aud.client_request_id);
    DB.auditorias=DB.auditorias.filter(a=>a!==aud);
  } else {
    const res=await postSheets({_type:"delete_auditoria",id_auditoria:id});
    if(!res.ok){
      if(res.retryable){
        queuePendingDelete(id);
        DB.auditorias=DB.auditorias.filter(a=>a!==aud);
      }
      return;
    }
    DB.auditorias=DB.auditorias.filter(a=>a!==aud);
  }
  renderRegistros(); renderDashboard();
}

// Exporta todas las auditorías a CSV con BOM UTF-8 (compatible con Excel)
function exportCSV(){
  if(!DB.auditorias.length){ alert("No hay datos."); return; }
  const h=["id_auditoria","fecha_auditoria","auditor","agente","ticket","canal","tipo","mes","semana","horas_trabajadas","objetivo_interacciones","interacciones_reales","dias_tarde","dias_faltas","calidad","productividad","general","estado","requiere_seguimiento","obs_general","obs_accion","sheets_enviado"];
  const csvCell=value=>{
    let text=String(value??"");
    if(/^[=+\-@]/.test(text)) text="'"+text;
    return `"${text.replace(/"/g,'""')}"`;
  };
  const rows=DB.auditorias.map(a=>h.map(k=>csvCell(a[k])));
  const csv=[h,...rows].map(r=>r.join(",")).join("\n");
  const blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="auditoria_cs_"+new Date().toISOString().slice(0,10)+".csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
