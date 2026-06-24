// ================================================================
// DASHBOARD — supervisión operativa y vistas de agentes
// ================================================================

function getDashFiltered(){
  const ag=document.getElementById("df-agente")?.value||"";
  const auditor=document.getElementById("df-auditor")?.value||"";
  const mes=document.getElementById("df-mes")?.value||"";
  const sem=document.getElementById("df-semana")?.value||"";
  return DB.auditorias.filter(a=>{
    if(ag&&a.agente!==ag) return false;
    if(auditor&&a.auditor!==auditor) return false;
    if(mes&&a.mes!==mes) return false;
    if(sem&&String(a.semana)!==String(sem)) return false;
    return true;
  });
}

function resetDashFilters(){
  ["df-agente","df-auditor","df-mes","df-semana"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value="";
  });
  renderDashboard();
}

function avgMetric(records,key){ return avg(records.map(record=>Number(record[key])||0)); }
function getWeekNumbers(records){ return [...new Set(records.map(a=>Number(a.semana)).filter(Number.isFinite))].sort((a,b)=>a-b); }
function formatDelta(value){
  if(value===null||value===undefined) return {text:"Sin referencia", tone:"neutral"};
  const sign=value>0?"+":"";
  return {text:`${sign}${value} pp vs. semana previa`, tone:value>0?"up":value<0?"down":"neutral"};
}

function getDominantCriterion(records){
  const counts={};
  records.forEach(a=>(a.criterios||[]).forEach(c=>{
    if(c.cumple!=="No") return;
    const key=c.nombre||"Criterio sin nombre";
    if(!counts[key]) counts[key]={name:key,fail:0,total:0};
    counts[key].fail++;
  }));
  records.forEach(a=>(a.criterios||[]).forEach(c=>{
    const key=c.nombre||"Criterio sin nombre";
    if(counts[key]) counts[key].total++;
  }));
  return Object.values(counts).sort((a,b)=>(b.fail/b.total)-(a.fail/a.total)||b.fail-a.fail)[0]||null;
}

function getObservedStreak(agent,records){
  const sorted=records.filter(a=>a.agente===agent && a.general!==null).sort((a,b)=>String(b.fecha_auditoria).localeCompare(String(a.fecha_auditoria)));
  let streak=0;
  for(const audit of sorted){
    if(Number(audit.general)<80) streak++; else break;
  }
  return streak;
}

function recommendationFor(priority){
  if(priority.streak>=2) return "Programar seguimiento y revisar la reincidencia antes de la próxima muestra.";
  if(priority.score<70) return "Revisar las últimas interacciones y realizar feedback individual hoy.";
  if(priority.delta!==null&&priority.delta<=-5) return "Dar feedback focalizado sobre el cambio semanal y volver a medir.";
  if(priority.criterion) return `Reforzar ${priority.criterion.name} en el próximo feedback.`;
  return "Mantener seguimiento semanal del desempeño.";
}

function buildDashboardAnalysis(records){
  const weeks=getWeekNumbers(records);
  const currentWeek=weeks.length?weeks[weeks.length-1]:null;
  const previousWeek=weeks.length>1?weeks[weeks.length-2]:null;
  const current=currentWeek===null?[]:records.filter(a=>Number(a.semana)===currentWeek);
  const previous=previousWeek===null?[]:records.filter(a=>Number(a.semana)===previousWeek);
  const metrics={
    quality:avgMetric(current,"calidad"),
    productivity:avgMetric(current,"productividad"),
    observed:current.length?Math.round(current.filter(a=>Number(a.general)<80).length/current.length*100):0,
    total:current.length,
    qualityDelta:previous.length?avgMetric(current,"calidad")-avgMetric(previous,"calidad"):null,
    productivityDelta:previous.length?avgMetric(current,"productividad")-avgMetric(previous,"productividad"):null,
  };
  const byAgent={};
  current.forEach(a=>{
    if(!byAgent[a.agente]) byAgent[a.agente]={agent:a.agente,current:[],previous:[]};
    byAgent[a.agente].current.push(a);
  });
  previous.forEach(a=>{
    if(!byAgent[a.agente]) byAgent[a.agente]={agent:a.agente,current:[],previous:[]};
    byAgent[a.agente].previous.push(a);
  });
  const team=Object.values(byAgent).map(entry=>{
    const score=avgMetric(entry.current,"general");
    const previousScore=entry.previous.length?avgMetric(entry.previous,"general"):null;
    const delta=previousScore===null?null:score-previousScore;
    const criterion=getDominantCriterion(entry.current);
    const streak=getObservedStreak(entry.agent,records);
    const high=score<70||(delta!==null&&delta<=-10)||streak>=2;
    const medium=!high&&(score<80||(delta!==null&&delta<=-5)||(criterion&&criterion.fail>=2));
    const severity=high?"high":medium?"medium":"stable";
    const impact=(score<80?(80-score)*2:0)+(delta!==null&&delta<0?Math.abs(delta)*3:0)+streak*12+(criterion?criterion.fail*2:0);
    const priority={...entry,score,previousScore,delta,criterion,streak,severity,impact,quality:avgMetric(entry.current,"calidad"),productivity:avgMetric(entry.current,"productividad")};
    priority.recommendation=recommendationFor(priority);
    return priority;
  }).filter(entry=>entry.current.length);
  const priorities=team.filter(entry=>entry.severity!=="stable").sort((a,b)=>b.impact-a.impact);
  const rootMap={};
  current.forEach(a=>(a.criterios||[]).forEach(c=>{
    const key=c.nombre||"Criterio sin nombre";
    if(!rootMap[key]) rootMap[key]={name:key,fail:0,total:0,agents:new Set()};
    rootMap[key].total++;
    if(c.cumple==="No"){ rootMap[key].fail++; rootMap[key].agents.add(a.agente); }
  }));
  const rootCauses=Object.values(rootMap).filter(c=>c.fail).map(c=>({...c,pct:Math.round(c.fail/c.total*100),agents:[...c.agents]})).sort((a,b)=>b.pct-a.pct||b.fail-a.fail).slice(0,5);
  const trend=weeks.map(week=>{
    const items=records.filter(a=>Number(a.semana)===week);
    return {week,quality:avgMetric(items,"calidad"),productivity:avgMetric(items,"productividad")};
  });
  return {weeks,currentWeek,previousWeek,current,previous,metrics,team:team.sort((a,b)=>b.impact-a.impact),priorities,rootCauses,trend};
}

function setMetric(id,value,delta){
  const valueEl=document.getElementById(id);
  const deltaEl=document.getElementById(`${id}-delta`);
  if(valueEl) valueEl.textContent=value;
  if(deltaEl&&delta){ const info=formatDelta(delta); deltaEl.textContent=info.text; deltaEl.className=`${info.tone}`; }
}

function renderDashboard(){
  const data=getDashboardComposedRecords();
  const total=data.length;
  const analysis=buildDashboardAnalysis(data);
  const h=escapeHtml;
  const countEl=document.getElementById("df-count");
  if(countEl) countEl.textContent=data.length<total?`${data.length} de ${total} auditorías`:`${total} auditorías`;
  document.getElementById("dash-subtitle").textContent=analysis.currentWeek===null?"Sin datos para analizar":`Semana ${analysis.currentWeek} · foco en riesgo y evolución del equipo`;
  document.getElementById("db-current-week").textContent=analysis.currentWeek===null?"Sin semana disponible":`Semana ${analysis.currentWeek}`;
  document.getElementById("db-comparison-label").textContent=analysis.previousWeek===null?"Sin semana previa comparable":`Comparada con semana ${analysis.previousWeek}`;
  setMetric("dbk-cal",analysis.metrics.quality!==null?`${analysis.metrics.quality}%`:"—",analysis.metrics.qualityDelta);
  setMetric("dbk-prod",analysis.metrics.productivity!==null?`${analysis.metrics.productivity}%`:"—",analysis.metrics.productivityDelta);
  document.getElementById("dbk-obs").textContent=analysis.metrics.observed===null?"?":`${analysis.metrics.observed}%`;
  document.getElementById("dbk-obs-sub").textContent=analysis.current.length?`${analysis.current.filter(a=>a.completo&&a.general<80).length} observadas`:"Sin muestra";
  document.getElementById("dbk-total").textContent=analysis.metrics.total;
  document.getElementById("dbk-total-sub").textContent=analysis.metrics.total===1?"auditoría actual":"auditorías actuales";

  renderHistoricalDashboard(h);
  renderPriorities(analysis,h);
  renderTeamMatrix(analysis,h);
  renderRootCauses(analysis,h);
  renderCriticalAlerts(analysis.current.filter(a=>a.general!==null),h);
  renderCompleteness(analysis,h);
  renderTrend(analysis);
  renderHeatmap(data,h);
}

function renderPriorities(analysis,h){
  const cont=document.getElementById("db-priorities");
  const count=document.getElementById("db-priority-count");
  if(count) count.textContent=analysis.priorities.length?`${analysis.priorities.length} para atender`:"Sin riesgos";
  if(!analysis.current.length){ cont.innerHTML='<div class="db-empty">Seleccioná un período con auditorías para ver prioridades.</div>'; return; }
  if(!analysis.previousWeek){ cont.innerHTML='<div class="db-empty">Todavía no hay una semana previa para comparar. La lectura de riesgo usa la muestra actual.</div>'; return; }
  if(!analysis.priorities.length){ cont.innerHTML='<div class="db-empty good">No se detectaron riesgos prioritarios esta semana. Mantené el seguimiento habitual.</div>'; return; }
  cont.innerHTML=analysis.priorities.slice(0,5).map((p,index)=>{
    const delta=formatDelta(p.delta);
    const criterion=p.criterion?`${h(p.criterion.name)} · ${p.criterion.fail} incumplimiento${p.criterion.fail!==1?"s":""}`:"Sin criterio dominante";
    return `<article class="db-priority db-priority-${p.severity}">
      <div class="db-priority-index">${index+1}</div>
      <div class="db-priority-person"><strong>${h(p.agent)}</strong><span>${p.score}% general · ${p.quality}% cal. · ${p.productivity}% prod.</span></div>
      <div class="db-priority-signal ${delta.tone}"><strong>${delta.text}</strong><span>${criterion}</span></div>
      <div class="db-priority-action"><span>Acción sugerida</span><p>${h(p.recommendation)}</p></div>
    </article>`;
  }).join("");
}

function renderTeamMatrix(analysis,h){
  const cont=document.getElementById("db-team-matrix");
  if(!analysis.team.length){ cont.innerHTML='<div class="db-empty">Sin datos para construir la matriz del equipo.</div>'; return; }
  cont.innerHTML=`<table class="db-team-table"><thead><tr><th>Agente</th><th>General</th><th>Var.</th><th>Cal.</th><th>Prod.</th><th>Estado</th><th>Muestra</th></tr></thead><tbody>${analysis.team.map(p=>{
    const delta=formatDelta(p.delta); const incomplete=p.current.some(x=>!x.completo); const state=incomplete?"Incompleto":(p.score>=95?"Excelente":p.score>=80?"Correcta":"Observada");
    return `<tr><td><strong>${h(p.agent)}</strong></td><td>${incomplete?"-":p.score+"%"}</td><td class="${delta.tone}">${p.delta===null?"—":`${p.delta>0?"+":""}${p.delta} pp`}</td><td>${p.quality}%</td><td>${p.productivity}%</td><td><span class="db-state ${p.severity}">${state}</span></td><td>${p.current.length}</td></tr>`;
  }).join("")}</tbody></table>`;
}

function renderRootCauses(analysis,h){
  const cont=document.getElementById("db-root-causes");
  if(!analysis.rootCauses.length){ cont.innerHTML='<div class="db-empty good">No hay incumplimientos registrados en la semana actual.</div>'; return; }
  cont.innerHTML=analysis.rootCauses.map(c=>`<div class="db-root-row"><div><strong>${h(c.name)}</strong><span>${c.fail}/${c.total} auditorías · ${h(c.agents.slice(0,3).join(", "))}</span></div><div class="db-root-meter"><i style="width:${c.pct}%"></i></div><b>${c.pct}%</b></div>`).join("");
}

function renderCriticalAlerts(current,h){
  const cont=document.getElementById("db-alertas");
  const alerts=current.filter(a=>Number(a.general)<70).sort((a,b)=>a.general-b.general).slice(0,5);
  if(!current.length){ cont.innerHTML='<div class="db-empty">Sin auditorías en la semana actual.</div>'; return; }
  if(!alerts.length){ cont.innerHTML='<div class="db-empty good">No hay auditorías críticas en la semana actual.</div>'; return; }
  cont.innerHTML=alerts.map(a=>`<div class="db-alert-row"><div class="db-alert-dot"></div><div class="db-alert-info"><strong>${h(a.agente)}</strong><span>Ticket ${h(a.ticket||"—")} · ${h(a.fecha_auditoria)}</span></div><span class="db-score db-sc-red">${a.general}%</span></div>`).join("");
}

function renderTrend(analysis){
  const canvas=document.getElementById("chart-evolucion");
  const existing=Chart.getChart(canvas); if(existing) existing.destroy();
  if(!analysis.trend.length){ return; }
  const U=getUMB();
  new Chart(canvas,{type:"line",data:{labels:analysis.trend.map(item=>item.week),datasets:[
    {label:"Calidad",data:analysis.trend.map(item=>item.quality),borderColor:"#1d4ed8",backgroundColor:"rgba(29,78,216,.08)",tension:.35,fill:true,pointRadius:3,borderWidth:2},
    {label:"Productividad",data:analysis.trend.map(item=>item.productivity),borderColor:"#0f766e",tension:.35,fill:false,pointRadius:3,borderWidth:2},
    {label:"Umbral",data:analysis.trend.map(()=>U.correcta),borderColor:"rgba(180,83,9,.5)",borderDash:[4,3],pointRadius:0,borderWidth:1.5},
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${Math.round(c.parsed.y)}%`}}},scales:{y:{min:60,max:100,ticks:{callback:v=>v+"%",font:{size:10}},grid:{color:"rgba(0,0,0,.05)"}},x:{ticks:{font:{size:10},maxRotation:0},grid:{display:false}}}}});
}

function renderHeatmap(data,h){
  const cont=document.getElementById("db-heatmap");
  if(!data.length){ cont.innerHTML='<div class="db-empty">Sin historial para mostrar.</div>'; return; }
  const U=getUMB(), weeks=getWeekNumbers(data), agents=[...new Set(data.map(a=>a.agente))].sort();
  const cell=(value)=>value===null?"db-hm-empty":value>=U.excelente?"db-hm-ex":value>=U.correcta?"db-hm-ok":"db-hm-obs";
  cont.innerHTML=`<table class="db-hm-table"><thead><tr><th class="db-hm-ag">Agente</th>${weeks.map(w=>`<th>S${w}</th>`).join("")}</tr></thead><tbody>${agents.map(agent=>`<tr><td class="db-hm-name">${h(agent)}</td>${weeks.map(week=>{const items=data.filter(a=>a.agente===agent&&Number(a.semana)===week);const value=items.length?avgMetric(items,"calidad"):null;return `<td class="${cell(value)}">${value===null?"—":`${value}%`}</td>`;}).join("")}</tr>`).join("")}</tbody></table>`;
}

function toggleDashboardHeatmap(){
  const panel=document.getElementById("db-heatmap-panel");
  const button=document.getElementById("db-heatmap-toggle");
  const hidden=panel.classList.toggle("hidden");
  button.textContent=hidden?"Ver matriz":"Ocultar matriz";
}
// Ranking de todos los agentes con sus promedios
function renderAgentes(){
  const h=escapeHtml;
  const agents={};
  DB.auditorias.forEach(a=>{
    if(!agents[a.agente]) agents[a.agente]={gen:[],cal:[],prod:[],count:0};
    agents[a.agente].gen.push(a.general); agents[a.agente].cal.push(a.calidad);
    agents[a.agente].prod.push(a.productividad); agents[a.agente].count++;
  });
  const sorted=Object.entries(agents)
    .map(([ag,d])=>({ag,gen:avg(d.gen),cal:avg(d.cal),prod:avg(d.prod),count:d.count}))
    .sort((a,b)=>b.gen-a.gen);
  const cont=document.getElementById("agent-ranking");
  if(!sorted.length){ cont.innerHTML='<p style="color:var(--hint);font-size:13px">Sin datos.</p>'; return; }
  const U=getUMB();
  cont.innerHTML=sorted.map((a,i)=>{
    const col=a.gen>=U.excelente?"var(--green)":a.gen>=U.correcta?"var(--accent)":"var(--red)";
    const init=a.ag.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase();
    return `<div class="agent-row">
      <div style="font-size:12px;font-weight:700;color:var(--hint);width:18px">${i+1}</div>
      <div class="avatar">${h(init)}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${h(a.ag)}</div>
        <div style="font-size:11px;color:var(--muted)">${a.count} auditoría${a.count!==1?"s":""} · Cal ${a.cal}% · Prod ${a.prod}%</div>
      </div>
      <div class="mini-bar" style="width:64px"><div class="mini-bar-fill" style="width:${a.gen}%;background:${col}"></div></div>
      <div style="font-size:13px;font-family:'DM Mono',monospace;font-weight:700;color:${col};min-width:38px;text-align:right">${a.gen}%</div>
    </div>`;
  }).join("");
}

// Detalle de criterios incumplidos para un agente específico
function renderAgentDetail(){
  const h=escapeHtml;
  const ag=document.getElementById("sel-agente-detail").value;
  const cont=document.getElementById("agent-detail-content");
  if(!ag){ cont.innerHTML='<p style="color:var(--hint);font-size:13px">Seleccioná un agente.</p>'; return; }
  const auds=DB.auditorias.filter(a=>a.agente===ag);
  if(!auds.length){ cont.innerHTML='<p style="color:var(--hint);font-size:13px">Sin auditorías.</p>'; return; }
  const fail={};
  auds.forEach(a=>a.criterios?.forEach(c=>{
    if(!fail[c.nombre]) fail[c.nombre]={no:0,total:0};
    fail[c.nombre].total++; if(c.cumple==="No") fail[c.nombre].no++;
  }));
  const sorted=Object.entries(fail).sort((a,b)=>b[1].no-a[1].no);
  cont.innerHTML=`<p style="font-size:12px;color:var(--muted);margin-bottom:10px">${auds.length} auditoría${auds.length!==1?"s":""} · General prom.: ${avg(auds.map(a=>a.general))}%</p>`+
    sorted.map(([n,d])=>{
      const pct=d.total>0?Math.round(d.no/d.total*100):0;
      const col=pct>50?"var(--red)":pct>20?"var(--amber)":"var(--green)";
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;font-size:11px">${h(n)}</div>
        <div class="mini-bar" style="width:60px"><div class="mini-bar-fill" style="width:${pct}%;background:${col}"></div></div>
        <div style="font-size:11px;font-family:'DM Mono',monospace;color:${col};min-width:30px;text-align:right">${pct}%</div>
      </div>`;
    }).join("");
}

function renderCompleteness(analysis,h){const cont=document.getElementById('db-completeness');if(!cont)return;cont.innerHTML=analysis.current.length?analysis.current.map(r=>`<div class="db-alert-row"><div class="db-alert-info"><strong>${h(r.agente)}</strong><span>Calidad ${r.muestras||0}/${CFG.muestras_semana} · Productividad ${r.productividad?'cargada':'pendiente'}</span></div><span class="badge ${r.completo?'badge-excelente':'badge-observada'}">${r.completo?'Completo':'Incompleto'}</span></div>`).join(''):'<div class="db-empty">Sin semanas para mostrar.</div>';}

function isModeloSeparado(item){ const cutoff=CFG.fecha_inicio_modelo_separado; if(!cutoff) return false; const date=String(item.fecha_auditoria||item.fecha_registro||"").slice(0,10); return !date || date>=cutoff; }

// Dashboard v2: a period is an ISO year + week; incomplete data never becomes a score of zero.
function dashboardWeekKey(item){return `${Number(item.anio)||new Date(item.fecha_auditoria||Date.now()).getFullYear()}-W${String(Number(item.semana)).padStart(2,'0')}`;}
function getDashboardComposedRecords(){
  const quality=getDashFiltered().filter(isModeloSeparado), ag=document.getElementById('df-agente')?.value||'', auditor=document.getElementById('df-auditor')?.value||'', mes=document.getElementById('df-mes')?.value||'', sem=document.getElementById('df-semana')?.value||'';
  const key=x=>`${x.agente}|${x.anio||new Date(x.fecha_auditoria||Date.now()).getFullYear()}|${x.semana}`, groups={};
  quality.forEach(a=>{const k=key(a);(groups[k]||(groups[k]={agente:a.agente,anio:a.anio,mes:a.mes,semana:a.semana,items:[],productividad:null})).items.push(a);});
  DB.productividadSemanal.filter(p=>{if(!isModeloSeparado(p))return false;if(ag&&p.agente!==ag)return false;if(mes&&p.mes!==mes)return false;if(sem&&String(p.semana)!==String(sem))return false;if(auditor){const k=key(p);return quality.some(a=>key(a)===k&&a.auditor===auditor);}return true;}).forEach(p=>{const k=key(p);(groups[k]||(groups[k]={agente:p.agente,anio:p.anio,mes:p.mes,semana:p.semana,items:[],productividad:null})).productividad=p;});
  return Object.values(groups).map(g=>{const qualityLoaded=g.items.length>0, productivityLoaded=!!g.productividad, cal=qualityLoaded?avgMetric(g.items,'calidad'):null, prod=productivityLoaded?Number(g.productividad.total_productividad):null, complete=qualityLoaded&&productivityLoaded;return {agente:g.agente,anio:g.anio,mes:g.mes,semana:g.semana,fecha_auditoria:g.items[0]?.fecha_auditoria||'',calidad:cal,productividad:prod,general:complete?calcGeneral(cal,prod):null,estado:complete?calcEstado(calcGeneral(cal,prod)):'Incompleto',criterios:[].concat.apply([],g.items.map(a=>a.criterios||[])),muestras:g.items.length,calidadCargada:qualityLoaded,productividadCargada:productivityLoaded,completo:complete};});
}
function buildDashboardAnalysis(records){
  const weeks=[...new Set(records.map(dashboardWeekKey))].sort(), currentKey=weeks[weeks.length-1]||null, previousKey=weeks[weeks.length-2]||null, current=currentKey?records.filter(a=>dashboardWeekKey(a)===currentKey):[], previous=previousKey?records.filter(a=>dashboardWeekKey(a)===previousKey):[];
  const metric=(list,field,present)=>{const usable=list.filter(present);return usable.length?avgMetric(usable,field):null;};
  const metrics={quality:metric(current,'calidad',a=>a.calidadCargada),productivity:metric(current,'productividad',a=>a.productividadCargada),observed:(()=>{const done=current.filter(a=>a.completo);return done.length?Math.round(done.filter(a=>a.general<80).length/done.length*100):null;})(),total:current.length,qualityDelta:null,productivityDelta:null};
  const prevQuality=metric(previous,'calidad',a=>a.calidadCargada),prevProd=metric(previous,'productividad',a=>a.productividadCargada);if(metrics.quality!==null&&prevQuality!==null)metrics.qualityDelta=metrics.quality-prevQuality;if(metrics.productivity!==null&&prevProd!==null)metrics.productivityDelta=metrics.productivity-prevProd;
  const byAgent={};[...current,...previous].forEach(a=>{const entry=byAgent[a.agente]||(byAgent[a.agente]={agent:a.agente,current:[],previous:[]});(current.includes(a)?entry.current:entry.previous).push(a);});
  const team=Object.values(byAgent).map(entry=>{const done=entry.current.filter(a=>a.completo),prevDone=entry.previous.filter(a=>a.completo),score=done.length?avgMetric(done,'general'):null,previousScore=prevDone.length?avgMetric(prevDone,'general'):null,delta=score===null||previousScore===null?null:score-previousScore,criterion=getDominantCriterion(entry.current.filter(a=>a.calidadCargada)),streak=getObservedStreak(entry.agent,records.filter(a=>a.completo)),high=score!==null&&(score<70||(delta!==null&&delta<=-10)||streak>=2),medium=score!==null&&!high&&(score<80||(delta!==null&&delta<=-5)||(criterion&&criterion.fail>=2)),severity=high?'high':medium?'medium':'stable';return {...entry,score,previousScore,delta,criterion,streak,severity,impact:score===null?0:(80-score)*2+(delta!==null&&delta<0?Math.abs(delta)*3:0),quality:metric(entry.current,'calidad',a=>a.calidadCargada),productivity:metric(entry.current,'productividad',a=>a.productividadCargada),recommendation:score===null?'Completar calidad y productividad antes de evaluar desempeno.':recommendationFor({score,delta,streak,criterion})};}).filter(e=>e.current.length);
  const rootMap={};current.filter(a=>a.calidadCargada).forEach(a=>(a.criterios||[]).forEach(c=>{const k=c.nombre||'Criterio sin nombre';if(!rootMap[k])rootMap[k]={name:k,fail:0,total:0,agents:new Set()};rootMap[k].total++;if(c.cumple==='No'){rootMap[k].fail++;rootMap[k].agents.add(a.agente);}}));
  const trend=weeks.map(week=>{const rows=records.filter(a=>dashboardWeekKey(a)===week);return {week,quality:metric(rows,'calidad',a=>a.calidadCargada),productivity:metric(rows,'productividad',a=>a.productividadCargada)};});
  return {weeks,currentWeek:currentKey,previousWeek:previousKey,current,previous,metrics,team:team.sort((a,b)=>b.impact-a.impact),priorities:team.filter(a=>a.severity!=='stable').sort((a,b)=>b.impact-a.impact),rootCauses:Object.values(rootMap).filter(c=>c.fail).map(c=>({...c,pct:Math.round(c.fail/c.total*100),agents:[...c.agents]})).sort((a,b)=>b.pct-a.pct).slice(0,5),trend};
}

function renderHistoricalDashboard(h){
  const cont=document.getElementById('db-historico'); if(!cont) return;
  const records=getDashFiltered().filter(item=>!isModeloSeparado(item));
  if(!records.length){ cont.innerHTML='<div class="db-empty">No hay auditorias historicas para los filtros seleccionados.</div>'; return; }
  const agents=[...new Set(records.map(r=>r.agente).filter(Boolean))];
  const weeks=[...new Set(records.map(r=>`${r.anio||new Date(r.fecha_auditoria).getFullYear()}-S${r.semana}`))];
  const byAgent={};
  records.forEach(r=>{const entry=byAgent[r.agente]||(byAgent[r.agente]={items:[]});entry.items.push(r);});
  const rows=Object.entries(byAgent).map(([agent,entry])=>({agent,count:entry.items.length,quality:avgMetric(entry.items,'calidad'),last:entry.items.map(i=>String(i.fecha_auditoria||'')).sort().pop()||''})).sort((a,b)=>b.quality-a.quality||b.count-a.count);
  cont.innerHTML=`<div class="score-summary" style="margin-bottom:14px"><div><div class="ss-value" style="color:var(--accent)">${avgMetric(records,'calidad')}%</div><div class="ss-label">Calidad promedio histórica</div></div><div><div class="ss-value" style="color:var(--teal)">${records.length}</div><div class="ss-label">Auditorías históricas</div></div><div><div class="ss-value" style="color:var(--muted)">${agents.length}</div><div class="ss-label">Agentes · ${weeks.length} semanas</div></div></div><div style="overflow:auto"><table class="db-team-table"><thead><tr><th>Agente</th><th>Calidad prom.</th><th>Muestras</th><th>Última auditoría</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${h(r.agent)}</strong></td><td>${r.quality}%</td><td>${r.count}</td><td>${h(r.last)}</td></tr>`).join('')}</tbody></table></div>`;
}