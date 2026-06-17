// ================================================================
// FORMS — wizard de auditoría (5 pasos)
// ================================================================

// Navega al paso n del wizard
function goStep(n){
  document.querySelectorAll(".form-step").forEach(s=>s.classList.remove("active"));
  document.querySelectorAll(".step-tab").forEach(t=>t.classList.remove("active","done"));
  document.getElementById("step-"+n).classList.add("active");
  document.getElementById("tab-"+n).classList.add("active");
  for(let i=1;i<n;i++) document.getElementById("tab-"+i).classList.add("done");
  if(n===2) renderCriterios();
  if(n===3) renderProdBanner();
  if(n===5) renderResumen();
}

// Paso 1: valida campos obligatorios y detecta duplicados
function validateStep1(){
  const req=["f-auditor","f-fecha","f-agente","f-ticket","f-canal","f-tipo","f-horas"];
  for(const id of req){
    const el=document.getElementById(id);
    if(!el.value.trim()){ el.classList.add("error"); el.focus(); setTimeout(()=>el.classList.remove("error"),2000); return; }
  }
  const agente=v("f-agente"), ticket=v("f-ticket").trim();
  const dup=DB.auditorias.find(a=>a.agente===agente && String(a.ticket)===ticket);
  const alertEl=document.getElementById("duplicate-alert");
  if(dup){
    alertEl.classList.remove("hidden");
    alertEl.innerHTML=`⚠ Ya existe una auditoría para <strong>${agente}</strong> con el ticket <strong>${ticket}</strong> (${dup.id_auditoria} · ${dup.fecha_auditoria}). ¿Querés continuar de todas formas? <button class="btn xs" onclick="goStep(2)" style="margin-left:10px">Continuar igual</button>`;
    return;
  }
  alertEl.classList.add("hidden");
  goStep(2);
}

// Paso 2: todos los criterios activos deben estar evaluados
function validateStep2(){
  const active=activeCriterios();
  const faltantes=active.filter(c=>!document.querySelector(`input[name="crit-${c.cod}"]:checked`));
  const alertEl=document.getElementById("criterios-incomplete-alert");
  if(faltantes.length){
    alertEl.classList.remove("hidden");
    alertEl.innerHTML=`⚠ Faltan evaluar ${faltantes.length} criterio${faltantes.length>1?"s":""}: <strong>${faltantes.map(c=>c.nombre).join(", ")}</strong>`;
    return;
  }
  alertEl.classList.add("hidden");
  goStep(3);
}

// Paso 3: interacciones reales obligatorias
function validateStep3(){
  const inter=document.getElementById("p-inter");
  if(!inter.value.trim()||isNaN(Number(inter.value))||Number(inter.value)<0){
    inter.classList.add("error");
    inter.focus();
    setTimeout(()=>inter.classList.remove("error"),2000);
    return;
  }
  goStep(4);
}

// Preview de objetivo de interacciones al ingresar horas
function updateHorasBanner(){
  const hs=document.getElementById("f-horas").value;
  const prev=document.getElementById("horas-preview");
  const obj=calcObjetivo(hs);
  if(!hs){ prev.innerHTML='<span style="color:var(--hint)">Ingresá las horas para ver el objetivo</span>'; }
  else { prev.innerHTML=`<strong style="color:var(--accent);font-size:18px;font-family:'DM Mono',monospace">${obj}</strong>&nbsp;<span style="color:var(--muted)">interacciones objetivo para ${hs} horas</span>`; }
  document.getElementById("horas-formula-hint").textContent=`Fórmula: ${CFG.horas_base} hs → ${CFG.tickets_base} tickets · proporcional`;
  updateSemanaCount();
}

// Alerta si el agente ya tiene el máximo de muestras en la semana
function updateSemanaCount(){
  const ag=v("f-agente"), sem=v("f-semana");
  const el=document.getElementById("semana-count-alert");
  if(!ag||!sem){ el.classList.add("hidden"); return; }
  const count=DB.auditorias.filter(a=>a.agente===ag&&String(a.semana)===String(sem)).length;
  if(!count){ el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  if(count>=CFG.muestras_semana)
    el.innerHTML=`⚠️ <strong>${ag}</strong> ya tiene <strong>${count} auditorías</strong> en la semana ${sem} (máximo: ${CFG.muestras_semana}).`;
  else
    el.innerHTML=`ℹ️ <strong>${ag}</strong> tiene ${count} de ${CFG.muestras_semana} muestras en semana ${sem}.`;
}

// Crea una fila HTML de criterio (Sí/No radio buttons)
function makeCriterioRow(c){
  const row=document.createElement("div"); row.className="criteria-row";
  row.innerHTML=`
    <div class="criteria-name">${c.nombre}</div>
    <div class="criteria-peso">${c.peso}%</div>
    <div class="radio-group">
      <label class="radio-btn yes" id="btn-yes-${c.cod}"><input type="radio" name="crit-${c.cod}" value="si" onchange="onCritChange('${c.cod}',${c.peso})"> Sí</label>
      <label class="radio-btn no"  id="btn-no-${c.cod}"><input type="radio" name="crit-${c.cod}" value="no" onchange="onCritChange('${c.cod}',0)"> No</label>
    </div>
    <div class="criteria-score" id="cscore-${c.cod}" style="color:var(--hint)">—</div>`;
  return row;
}

// Renderiza el listado de criterios en el paso 2 y toma snapshot
function renderCriterios(){
  if(!CRITERIOS.length) CRITERIOS=JSON.parse(JSON.stringify(CRITERIOS_DEFAULT));
  _criteriosSnapshot=JSON.parse(JSON.stringify(CRITERIOS));
  const active=activeCriterios();
  const comCont=document.getElementById("criterios-comunicacion");
  const comWrap=document.getElementById("criterios-comunicacion-wrap");
  if(comCont){
    comWrap.querySelector(".criteria-header span").textContent="Comunicación";
    comCont.innerHTML="";
    active.filter(c=>c.bloque==="Comunicacion").forEach(c=>comCont.appendChild(makeCriterioRow(c)));
  }
  const gesCont=document.getElementById("criterios-gestion");
  const gesWrap=document.getElementById("criterios-gestion-wrap");
  if(gesCont){
    gesWrap.querySelector(".criteria-header span").textContent="Gestión";
    gesCont.innerHTML="";
    active.filter(c=>c.bloque==="Gestion").forEach(c=>gesCont.appendChild(makeCriterioRow(c)));
  }
  updateCalidadTotal();
}

// Al cambiar un criterio: actualiza score visual y limpia alerta si corresponde
function onCritChange(cod,peso){
  const el=document.getElementById("cscore-"+cod);
  if(el){ el.textContent=peso+"%"; el.style.color=peso>0?"var(--green)":"var(--red)"; }
  document.getElementById("btn-yes-"+cod)?.classList.toggle("selected",peso>0);
  document.getElementById("btn-no-"+cod)?.classList.toggle("selected",peso===0);
  updateCalidadTotal();
  const faltantes=activeCriterios().filter(c=>!document.querySelector(`input[name="crit-${c.cod}"]:checked`));
  if(!faltantes.length) document.getElementById("criterios-incomplete-alert")?.classList.add("hidden");
}

// Recalcula y muestra el puntaje total de calidad
function updateCalidadTotal(){
  const active=activeCriterios();
  let total=0, eval_=0;
  active.forEach(c=>{ const ch=document.querySelector(`input[name="crit-${c.cod}"]:checked`); if(ch){ eval_++; if(ch.value==="si") total+=c.peso; }});
  document.getElementById("sc-puntaje").textContent=total+"%";
  document.getElementById("sc-criterios").textContent=eval_+"/"+active.length;
  document.getElementById("sc-pct").textContent=total+"%";
  const badge=document.getElementById("sc-badge");
  if(!eval_){ badge.innerHTML=""; return; }
  const e=calcEstado(total);
  badge.innerHTML=`<span class="score-badge ${estadoSB(e)}">${e}</span>`;
}

// Retorna el puntaje total de calidad (suma pesos de "Sí")
function getCalidad(){
  let t=0;
  activeCriterios().forEach(c=>{ const ch=document.querySelector(`input[name="crit-${c.cod}"]:checked`); if(ch&&ch.value==="si") t+=c.peso; });
  return t;
}

// Retorna array con detalle de cada criterio evaluado
function getCriterioDetalle(){
  return activeCriterios().map(c=>{
    const ch=document.querySelector(`input[name="crit-${c.cod}"]:checked`);
    return { cod:c.cod, nombre:c.nombre, bloque:c.bloque, peso:c.peso,
      cumple:ch?ch.value==="si"?"Sí":"No":"No evaluado",
      obtenido:ch&&ch.value==="si"?c.peso:0 };
  });
}

// Renderiza el banner de productividad con horas, objetivo y pesos
function renderProdBanner(){
  const hs=v("f-horas"), obj=calcObjetivo(hs);
  document.getElementById("prod-horas-val").textContent=(hs||"—")+" hs";
  document.getElementById("prod-obj-val").textContent="Objetivo: "+(obj||"—")+" interacciones";
  document.getElementById("obj-inter").textContent=obj||"—";
  document.getElementById("obj-tarde").textContent=CFG.obj_puntual;
  document.getElementById("obj-faltas").textContent=CFG.obj_present;
  document.getElementById("prod-pesos-info").textContent=`${CFG.w_inter}% · ${CFG.w_puntual}% · ${CFG.w_present}%`;
  document.getElementById("prod-inter-label").textContent=`Peso: ${CFG.w_inter}% de productividad`;
  document.getElementById("prod-puntual-label").textContent=`Peso: ${CFG.w_puntual}% · Obj: máx. ${CFG.obj_puntual} días/semana`;
  document.getElementById("prod-present-label").textContent=`Peso: ${CFG.w_present}% · Obj: máx. ${CFG.obj_present} días/semana`;
  calcProd();
}

// Calcula scores parciales de productividad y actualiza DOM
function calcProd(){
  const hs=v("f-horas"), obj=calcObjetivo(hs);
  const inter=Number(v("p-inter"))||0;
  const tarde=Number(v("p-tarde"))||0;
  const faltas=Number(v("p-faltas"))||0;
  const pI=obj>0?Math.min(100,Math.round(inter/obj*100)):0;
  const pP=CFG.obj_puntual>0?Math.min(100,Math.round(Math.max(0,CFG.obj_puntual-tarde)/CFG.obj_puntual*100)):100;
  const pR=CFG.obj_present>0?Math.min(100,Math.round(Math.max(0,CFG.obj_present-faltas)/CFG.obj_present*100)):100;
  const total=Math.round((pI*CFG.w_inter+pP*CFG.w_puntual+pR*CFG.w_present)/100);
  const col=x=>x>=80?"var(--green)":x>=60?"var(--amber)":"var(--red)";
  [["pct-inter",pI],["pct-puntual",pP],["pct-present",pR]].forEach(([id,val])=>{
    const el=document.getElementById(id); if(el){ el.textContent=val+"%"; el.style.color=col(val); }
  });
  document.getElementById("pp-inter").textContent=pI+"%";
  document.getElementById("pp-asist").textContent=Math.round((pP+pR)/2)+"%";
  document.getElementById("pp-total").textContent=total+"%";
  return total;
}

// Retorna el score total de productividad calculado desde inputs (sin side effects)
function getProd(){
  const hs=v("f-horas"), obj=calcObjetivo(hs);
  const inter=Number(v("p-inter"))||0;
  const tarde=Number(v("p-tarde"))||0;
  const faltas=Number(v("p-faltas"))||0;
  const pI=obj>0?Math.min(100,Math.round(inter/obj*100)):0;
  const pP=CFG.obj_puntual>0?Math.min(100,Math.round(Math.max(0,CFG.obj_puntual-tarde)/CFG.obj_puntual*100)):100;
  const pR=CFG.obj_present>0?Math.min(100,Math.round(Math.max(0,CFG.obj_present-faltas)/CFG.obj_present*100)):100;
  return Math.round((pI*CFG.w_inter+pP*CFG.w_puntual+pR*CFG.w_present)/100);
}

// Renderiza la vista previa de la auditoría antes del submit
function renderResumen(){
  const cal=getCalidad(), prod=getProd();
  const general=calcGeneral(cal,prod);
  const estado=calcEstado(general);
  const hs=v("f-horas"), obj=calcObjetivo(hs);
  const sheetsLine=`<span style="color:var(--green);font-size:12px">✓ Se enviará a Google Sheets automáticamente</span>`;
  document.getElementById("resumen-content").innerHTML=`
    <div class="score-summary" style="margin-bottom:18px">
      <div><div class="ss-value" style="color:var(--accent)">${cal}%</div><div class="ss-label">Calidad (${CFG.w_calidad}%)</div></div>
      <div><div class="ss-value" style="color:var(--teal)">${prod}%</div><div class="ss-label">Productividad (${CFG.w_productividad}%)</div></div>
      <div><div class="ss-value" style="color:var(--green)">${general}%</div><div class="ss-label">Score General</div><div class="ss-badge"><span class="score-badge ${estadoSB(estado)}">${estado}</span></div></div>
    </div>
    <div class="resumen-grid">
      <div class="resumen-item"><div class="rl">Agente</div><div class="rv">${v("f-agente")}</div></div>
      <div class="resumen-item"><div class="rl">Ticket</div><div class="rv">${v("f-ticket")}</div></div>
      <div class="resumen-item"><div class="rl">Canal</div><div class="rv">${v("f-canal")}</div></div>
      <div class="resumen-item"><div class="rl">Tipo</div><div class="rv">${v("f-tipo")}</div></div>
      <div class="resumen-item"><div class="rl">Horas / Objetivo</div><div class="rv">${hs} hs → ${obj} int.</div></div>
      <div class="resumen-item"><div class="rl">Auditor</div><div class="rv">${v("f-auditor")}</div></div>
      <div class="resumen-item"><div class="rl">Fecha</div><div class="rv">${v("f-fecha")}</div></div>
      <div class="resumen-item"><div class="rl">Semana</div><div class="rv">${v("f-semana")}</div></div>
    </div>
    ${v("f-obs-general")?`<div class="alert info" style="margin-bottom:8px"><strong>Obs:</strong> ${v("f-obs-general")}</div>`:""}
    ${v("f-obs-accion")?`<div class="alert warning"><strong>Acción:</strong> ${v("f-obs-accion")}</div>`:""}
    <div style="margin-top:12px">${sheetsLine}</div>`;
}

// Registra la auditoría y la envía a Sheets (o la encola si falla)
async function submitAuditoria(){
  const btn=document.getElementById("btn-submit");
  btn.disabled=true; btn.textContent="Registrando...";
  const cal=getCalidad(), prod=getProd();
  const general=calcGeneral(cal,prod);
  const estado=calcEstado(general);
  const hs=v("f-horas"), obj=calcObjetivo(hs);
  const id="AUD-"+String(DB.nextId).padStart(4,"0");
  DB.nextId++; persistNextId();
  const aud={
    id, id_auditoria:id,
    fecha_registro:new Date().toISOString(),
    fecha_auditoria:v("f-fecha"),
    anio:v("f-fecha")?new Date(v("f-fecha")+"T00:00:00").getFullYear():new Date().getFullYear(),
    mes:v("f-mes"), semana:v("f-semana"),
    auditor:v("f-auditor"), agente:v("f-agente"),
    ticket:v("f-ticket"), canal:v("f-canal"), tipo:v("f-tipo"),
    horas_trabajadas:Number(hs), objetivo_interacciones:obj,
    interacciones_reales:Number(v("p-inter"))||0,
    dias_tarde:Number(v("p-tarde"))||0,
    dias_faltas:Number(v("p-faltas"))||0,
    calidad:cal, productividad:prod, general, estado,
    requiere_seguimiento:v("f-seguimiento"),
    obs_general:v("f-obs-general"), obs_desvios:v("f-obs-desvios"),
    obs_accion:v("f-obs-accion"), resp_seguimiento:v("f-resp-seg"),
    criterios:getCriterioDetalle(),
    sheets_enviado:false,
    obj_puntual:CFG.obj_puntual, obj_present:CFG.obj_present,
    w_inter:CFG.w_inter, w_puntual:CFG.w_puntual, w_present:CFG.w_present,
    w_calidad:CFG.w_calidad, w_productividad:CFG.w_productividad,
    pct_calidad:cal, pct_productividad:prod, pct_general:general,
  };
  DB.auditorias.push(aud);
  const res=await postSheets(aud);
  if(res.ok){
    aud.sheets_enviado=true;
  } else {
    PENDING_QUEUE.push(aud);
    savePendingQueue();
  }
  const alertEl=document.getElementById("form-alert");
  alertEl.className=res.ok?"alert success":"alert warning";
  alertEl.classList.remove("hidden");
  alertEl.textContent=res.ok?`✓ ${id} registrada y enviada a Sheets.`:`⚠ ${id} guardada localmente. Se reintentará cuando haya conexión.`;
  setTimeout(()=>alertEl.classList.add("hidden"),7000);
  _criteriosSnapshot=null;
  resetForm();
  btn.disabled=false; btn.textContent="✓ Registrar y enviar a Sheets";
  populateSelects(); renderDashboard();
}

// Limpia todos los campos del formulario y resetea al paso 1
function resetForm(){
  document.querySelectorAll("#page-formulario input,#page-formulario select,#page-formulario textarea").forEach(el=>{
    if(el.type==="radio") el.checked=false;
    else if(!el.readOnly&&!el.disabled) el.value="";
  });
  document.querySelectorAll(".radio-btn").forEach(b=>b.classList.remove("selected"));
  document.querySelectorAll(".criteria-score").forEach(el=>{ el.textContent="—"; el.style.color="var(--hint)"; });
  document.getElementById("horas-preview").innerHTML='<span style="color:var(--hint)">Ingresá las horas para ver el objetivo</span>';
  document.getElementById("semana-count-alert").classList.add("hidden");
  document.getElementById("duplicate-alert").classList.add("hidden");
  document.getElementById("criterios-incomplete-alert")?.classList.add("hidden");
  document.querySelectorAll(".step-tab").forEach(t=>t.classList.remove("done","active"));
  document.getElementById("tab-1").classList.add("active");
  document.querySelectorAll(".form-step").forEach(s=>s.classList.remove("active"));
  document.getElementById("step-1").classList.add("active");
  const today=new Date().toISOString().slice(0,10);
  document.getElementById("f-fecha").value=today;
  onFechaChange();
}
