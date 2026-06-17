// ================================================================
// DASHBOARD — renderizado principal y vistas de agentes
// ================================================================

// Retorna auditorías filtradas por agente/mes/semana
function getDashFiltered(){
  const ag  = document.getElementById("df-agente")?.value  || "";
  const mes = document.getElementById("df-mes")?.value     || "";
  const sem = document.getElementById("df-semana")?.value  || "";
  return DB.auditorias.filter(a=>{
    if(ag  && a.agente !== ag)                  return false;
    if(mes && a.mes   !== mes)                  return false;
    if(sem && String(a.semana) !== String(sem)) return false;
    return true;
  });
}

// Limpia los filtros del dashboard
function resetDashFilters(){
  ["df-agente","df-mes","df-semana"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value="";
  });
  renderDashboard();
}

// Renderiza KPIs, ranking, evolución, heatmap, criterios y alertas
function renderDashboard(){
  const data = getDashFiltered();
  const total = DB.auditorias.length;
  const U = getUMB();

  const countEl = document.getElementById("df-count");
  if(countEl) countEl.textContent = data.length < total
    ? `${data.length} de ${total} auditorías`
    : `${total} auditorías`;

  document.getElementById("dash-subtitle").textContent=
    `${data.length} auditorías · Calidad ${CFG.w_calidad}% + Productividad ${CFG.w_productividad}%`;

  if(!data.length){
    document.getElementById("dbk-total").textContent="0";
    document.getElementById("dbk-cal").textContent="—";
    document.getElementById("dbk-prod").textContent="—";
    document.getElementById("dbk-obs").textContent="0";
    document.getElementById("db-ranking-table").innerHTML='';
    document.getElementById("db-heatmap").innerHTML='';
    document.getElementById("db-criterios").innerHTML='<p style="color:var(--hint);font-size:13px;padding:8px 0">Sin datos.</p>';
    document.getElementById("db-alertas").innerHTML='<p style="color:var(--hint);font-size:13px;padding:8px 0">Sin alertas.</p>';
    const ch=Chart.getChart("chart-evolucion"); if(ch) ch.destroy();
    return;
  }

  // KPIs
  const calProm = avg(data.map(a=>a.calidad));
  const prodProm = avg(data.map(a=>a.productividad));
  const obsCount = data.filter(a=>a.estado==="Observada").length;
  const kpiColor=(v)=>v>=95?"ok":v>=80?"warn":"bad";
  document.getElementById("dbk-total").textContent = data.length;
  document.getElementById("dbk-total-sub").textContent = `${[...new Set(data.map(a=>a.agente))].length} agentes`;
  const calEl=document.getElementById("dbk-cal");
  calEl.textContent=calProm+"%"; calEl.className="db-kpi-val "+kpiColor(calProm);
  const prodEl=document.getElementById("dbk-prod");
  prodEl.textContent=prodProm+"%"; prodEl.className="db-kpi-val "+kpiColor(prodProm);
  const obsEl=document.getElementById("dbk-obs");
  obsEl.textContent=obsCount; obsEl.className="db-kpi-val "+(obsCount===0?"ok":obsCount<=10?"warn":"bad");
  document.getElementById("dbk-obs-sub").textContent=`${Math.round(obsCount/data.length*100)}% del total`;

  // Ranking
  const agMap={};
  data.forEach(a=>{
    if(!agMap[a.agente]) agMap[a.agente]={cal:[],prod:[],gen:[]};
    agMap[a.agente].cal.push(a.calidad);
    agMap[a.agente].prod.push(a.productividad);
    agMap[a.agente].gen.push(a.general);
  });
  const ranking=Object.entries(agMap).map(([n,d])=>({
    n, cal:avg(d.cal), prod:avg(d.prod), gen:avg(d.gen), total:d.gen.length
  })).sort((a,b)=>b.gen-a.gen);

  const scTag=(v)=>{
    const cls=v>=U.excelente?"db-sc-green":v>=U.correcta?"db-sc-amber":"db-sc-red";
    return `<span class="db-score ${cls}">${v}%</span>`;
  };
  const barCol=(v)=>v>=U.excelente?"#15803d":v>=U.correcta?"#1d4ed8":"#dc2626";

  document.getElementById("db-ranking-table").innerHTML=ranking.map((r,i)=>`
    <tr>
      <td class="db-rank-num">${i+1}</td>
      <td class="db-rank-name">${r.n.split(" ").slice(0,2).join(" ")}</td>
      <td style="width:100%;padding:0 8px">
        <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="width:${r.gen}%;height:100%;background:${barCol(r.gen)};border-radius:3px"></div>
        </div>
        <div class="db-rank-sub" style="margin-top:3px">Cal ${r.cal}% · Prod ${r.prod}%</div>
      </td>
      <td style="white-space:nowrap">${scTag(r.gen)}</td>
    </tr>`).join("");

  // Evolución semanal (Chart.js)
  const semMap={};
  data.forEach(a=>{ const s=String(a.semana); if(!semMap[s]) semMap[s]=[]; semMap[s].push(a.calidad); });
  const semKeys=Object.keys(semMap).sort((a,b)=>Number(a)-Number(b));
  const evoL=semKeys.map(s=>"S"+s);
  const evoD=semKeys.map(s=>avg(semMap[s]));
  const ch=Chart.getChart("chart-evolucion"); if(ch) ch.destroy();
  new Chart(document.getElementById("chart-evolucion"),{
    type:"line",
    data:{labels:evoL,datasets:[
      {data:evoD,borderColor:"#1d4ed8",backgroundColor:"rgba(29,78,216,.07)",
       tension:.4,fill:true,pointRadius:3,pointBackgroundColor:"#1d4ed8",borderWidth:2},
      {data:evoD.map(()=>U.correcta),borderColor:"rgba(180,83,9,.4)",
       borderDash:[4,3],borderWidth:1.5,pointRadius:0,fill:false},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${Math.round(c.parsed.y)}%`}}},
      scales:{
        y:{min:60,max:100,ticks:{callback:v=>v+"%",font:{size:10}},grid:{color:"rgba(0,0,0,.04)"}},
        x:{ticks:{font:{size:10},maxRotation:0},grid:{display:false}}
      }
    }
  });

  // Heatmap agente × semana
  const hmMatrix={};
  const hmSems=new Set();
  data.forEach(a=>{
    const s=String(a.semana); hmSems.add(s);
    if(!hmMatrix[a.agente]) hmMatrix[a.agente]={};
    if(!hmMatrix[a.agente][s]) hmMatrix[a.agente][s]=[];
    hmMatrix[a.agente][s].push(a.calidad);
  });
  const semList=[...hmSems].sort((a,b)=>Number(a)-Number(b));
  const agList=Object.keys(hmMatrix).sort();
  const hmCls=(v)=>{
    if(v===null) return "db-hm-empty";
    return v>=U.excelente?"db-hm-ex":v>=U.correcta?"db-hm-ok":"db-hm-obs";
  };
  let hmHtml=`<table class="db-hm-table"><thead><tr>
    <th class="db-hm-ag">Agente</th>`;
  semList.forEach(s=>{ hmHtml+=`<th>S${s}</th>`; });
  hmHtml+=`<th style="font-weight:700">Prom.</th></tr></thead><tbody>`;
  agList.forEach(ag=>{
    const vals=semList.map(s=>{
      const arr=hmMatrix[ag][s];
      return arr?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):null;
    });
    const nonNull=vals.filter(v=>v!==null);
    const prom=nonNull.length?Math.round(nonNull.reduce((a,b)=>a+b,0)/nonNull.length):null;
    hmHtml+=`<tr><td class="db-hm-name">${ag.split(" ").slice(0,2).join(" ")}</td>`;
    vals.forEach(v=>{ hmHtml+=`<td class="${hmCls(v)}">${v!==null?v+"%":"—"}</td>`; });
    hmHtml+=`<td class="${hmCls(prom)}" style="font-weight:700">${prom!==null?prom+"%":"—"}</td>`;
    hmHtml+=`</tr>`;
  });
  hmHtml+=`</tbody></table>`;
  document.getElementById("db-heatmap").innerHTML=hmHtml;

  // Criterios con mayor incumplimiento
  const critFail={}, critTotal={}, critBloque={}, critPeso={};
  data.forEach(a=>a.criterios?.forEach(c=>{
    if(!critTotal[c.nombre]) critTotal[c.nombre]=0;
    critTotal[c.nombre]++;
    if(!critBloque[c.nombre]) critBloque[c.nombre]=c.bloque||"";
    if(!critPeso[c.nombre]) critPeso[c.nombre]=c.peso||0;
    if(c.cumple==="No"){
      if(!critFail[c.nombre]) critFail[c.nombre]=0;
      critFail[c.nombre]++;
    }
  }));
  const critRows=Object.entries(critTotal)
    .map(([n,tot])=>({n, pct:Math.round((critFail[n]||0)/tot*100), bloque:critBloque[n], peso:critPeso[n]}))
    .sort((a,b)=>b.pct-a.pct);

  document.getElementById("db-criterios").innerHTML=critRows.length
    ? critRows.map(({n,pct,bloque,peso})=>{
        const tagCls=bloque==="Comunicacion"?"db-tag-c":"db-tag-g";
        const tagLabel=bloque==="Comunicacion"?"Com":"Ges";
        const fillCol=pct>=50?"#dc2626":pct>=25?"#b45309":"#15803d";
        return `<div class="db-crit-row">
          <span class="db-crit-tag ${tagCls}">${tagLabel} ${peso}%</span>
          <span class="db-crit-name" title="${n}">${n}</span>
          <div class="db-crit-bar"><div class="db-crit-fill" style="width:${pct}%;background:${fillCol}"></div></div>
          <span class="db-crit-pct" style="color:${fillCol}">${pct}%</span>
        </div>`;
      }).join("")
    : '<p style="color:var(--hint);font-size:13px;padding:8px 0">Sin datos de criterios.</p>';

  // Alertas score < 70%
  const alerts=data.filter(a=>a.general<70).sort((a,b)=>a.general-b.general).slice(0,8);
  document.getElementById("db-alertas").innerHTML=alerts.length
    ? alerts.map(a=>{
        const dotCol=a.general<40?"#dc2626":a.general<55?"#b45309":"#d97706";
        return `<div class="db-alert-row">
          <div class="db-alert-dot" style="background:${dotCol}"></div>
          <div class="db-alert-info">
            <div class="db-alert-name">${a.agente.split(" ").slice(0,2).join(" ")}</div>
            <div class="db-alert-meta">Ticket ${a.ticket||"—"} · ${a.fecha_auditoria} · Sem ${a.semana}</div>
          </div>
          <span class="db-score db-sc-red">${a.general}%</span>
        </div>`;
      }).join("")
    : '<p style="color:var(--hint);font-size:13px;padding:8px 0">Sin auditorías con score &lt; 70%.</p>';
}

// Ranking de todos los agentes con sus promedios
function renderAgentes(){
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
      <div class="avatar">${init}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${a.ag}</div>
        <div style="font-size:11px;color:var(--muted)">${a.count} auditoría${a.count!==1?"s":""} · Cal ${a.cal}% · Prod ${a.prod}%</div>
      </div>
      <div class="mini-bar" style="width:64px"><div class="mini-bar-fill" style="width:${a.gen}%;background:${col}"></div></div>
      <div style="font-size:13px;font-family:'DM Mono',monospace;font-weight:700;color:${col};min-width:38px;text-align:right">${a.gen}%</div>
    </div>`;
  }).join("");
}

// Detalle de criterios incumplidos para un agente específico
function renderAgentDetail(){
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
        <div style="flex:1;font-size:11px">${n}</div>
        <div class="mini-bar" style="width:60px"><div class="mini-bar-fill" style="width:${pct}%;background:${col}"></div></div>
        <div style="font-size:11px;font-family:'DM Mono',monospace;color:${col};min-width:30px;text-align:right">${pct}%</div>
      </div>`;
    }).join("");
}
