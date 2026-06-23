// ================================================================
// FORMS - auditoria de calidad (sin productividad)
// ================================================================
function goStep(n){
  document.querySelectorAll('.form-step').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.step-tab').forEach(t=>t.classList.remove('active','done'));
  document.getElementById('step-'+n)?.classList.add('active');
  document.getElementById('tab-'+n)?.classList.add('active');
  for(let i=1;i<n;i++) document.getElementById('tab-'+i)?.classList.add('done');
  if(n===2) renderCriterios();
  if(n===4) renderResumen();
}

function validateStep1(){
  const required=['f-auditor','f-fecha','f-agente','f-ticket','f-canal','f-tipo'];
  for(const id of required){ const el=document.getElementById(id); if(!el?.value.trim()){ el.classList.add('error'); el.focus(); setTimeout(()=>el.classList.remove('error'),2000); return; } }
  const agente=v('f-agente'), semana=v('f-semana'), ticket=v('f-ticket').trim(), alertEl=document.getElementById('duplicate-alert');
  const muestras=DB.auditorias.filter(a=>a.agente===agente&&String(a.semana)===String(semana)).length;
  if(muestras>=CFG.muestras_semana){ alertEl.classList.remove('hidden'); alertEl.textContent=`? ${agente} ya tiene ${muestras} muestras de calidad en la semana ${semana} (maximo: ${CFG.muestras_semana}).`; return; }
  const dup=DB.auditorias.find(a=>a.agente===agente&&String(a.ticket)===ticket);
  if(dup){ alertEl.classList.remove('hidden'); alertEl.innerHTML=`? Ya existe una auditoria para <strong>${escapeHtml(agente)}</strong> con el ticket <strong>${escapeHtml(ticket)}</strong>. <button class="btn xs" onclick="goStep(2)">Continuar igual</button>`; return; }
  alertEl.classList.add('hidden'); goStep(2);
}
function validateStep2(){
  const missing=activeCriterios().filter(c=>!document.querySelector(`input[name="crit-${c.cod}"]:checked`)); const alertEl=document.getElementById('criterios-incomplete-alert');
  if(missing.length){ alertEl.classList.remove('hidden'); alertEl.textContent=`? Faltan evaluar ${missing.length} criterios.`; return; } alertEl.classList.add('hidden'); goStep(3);
}
function validateStep3(){ goStep(4); }
function updateHorasBanner(){ updateSemanaCount(); }
function updateSemanaCount(){
  const ag=v('f-agente'), sem=v('f-semana'), el=document.getElementById('semana-count-alert'); if(!el) return;
  if(!ag||!sem){el.classList.add('hidden');return;} const count=DB.auditorias.filter(a=>a.agente===ag&&String(a.semana)===String(sem)).length;
  el.classList.toggle('hidden',!count); if(count) el.textContent=count>=CFG.muestras_semana?`?? ${ag} ya tiene ${count} auditorias de calidad esta semana (maximo ${CFG.muestras_semana}).`:`?? ${ag} tiene ${count} de ${CFG.muestras_semana} muestras de calidad.`;
}
function makeCriterioRow(c){ const cod=String(c.cod||'').replace(/[^A-Za-z0-9_-]/g,''),peso=Number(c.peso)||0; c.cod=cod; const row=document.createElement('div'); row.className='criteria-row'; row.innerHTML=`<div class="criteria-name">${escapeHtml(c.nombre)}</div><div class="criteria-peso">${peso}%</div><div class="radio-group"><label class="radio-btn yes" id="btn-yes-${cod}"><input type="radio" name="crit-${cod}" value="si" onchange="onCritChange('${cod}',${peso})"> Si</label><label class="radio-btn no" id="btn-no-${cod}"><input type="radio" name="crit-${cod}" value="no" onchange="onCritChange('${cod}',0)"> No</label></div><div class="criteria-score" id="cscore-${cod}">-</div>`; return row; }
function renderCriterios(){ if(!CRITERIOS.length) CRITERIOS=JSON.parse(JSON.stringify(CRITERIOS_DEFAULT)); _criteriosSnapshot=JSON.parse(JSON.stringify(CRITERIOS)); const active=activeCriterios(); [['comunicacion','Comunicacion'],['gestion','Gestion']].forEach(([id,bloque])=>{const el=document.getElementById('criterios-'+id); if(el){el.innerHTML='';active.filter(c=>c.bloque===bloque).forEach(c=>el.appendChild(makeCriterioRow(c)));}}); updateCalidadTotal(); }
function onCritChange(cod,peso){ const el=document.getElementById('cscore-'+cod); if(el){el.textContent=peso+'%';el.style.color=peso?'var(--green)':'var(--red)';} document.getElementById('btn-yes-'+cod)?.classList.toggle('selected',peso>0); document.getElementById('btn-no-'+cod)?.classList.toggle('selected',peso===0); updateCalidadTotal(); }
function updateCalidadTotal(){ const active=activeCriterios(); let total=0, done=0; active.forEach(c=>{const x=document.querySelector(`input[name="crit-${c.cod}"]:checked`);if(x){done++;if(x.value==='si')total+=c.peso;}}); document.getElementById('sc-puntaje').textContent=total+'%';document.getElementById('sc-pct').textContent=total+'%';document.getElementById('sc-criterios').textContent=done+'/'+active.length; const b=document.getElementById('sc-badge'); if(b)b.innerHTML=done?`<span class="score-badge ${estadoSB(calcEstado(total))}">${calcEstado(total)}</span>`:''; }
function getCalidad(){let total=0;activeCriterios().forEach(c=>{const x=document.querySelector(`input[name="crit-${c.cod}"]:checked`);if(x?.value==='si')total+=c.peso;});return total;}
function getCriterioDetalle(){return activeCriterios().map(c=>{const x=document.querySelector(`input[name="crit-${c.cod}"]:checked`);return {cod:c.cod,nombre:c.nombre,bloque:c.bloque,peso:c.peso,cumple:x?(x.value==='si'?'Si':'No'):'No evaluado',obtenido:x?.value==='si'?c.peso:0};});}
function renderResumen(){const cal=getCalidad(),estado=calcEstado(cal),h=escapeHtml;document.getElementById('resumen-content').innerHTML=`<div class="score-summary"><div><div class="ss-value" style="color:var(--accent)">${cal}%</div><div class="ss-label">Puntaje de calidad</div></div><div><div class="ss-value" style="color:var(--muted)">-</div><div class="ss-label">Productividad se carga aparte</div></div><div><div class="ss-value" style="color:var(--green)">${estado}</div><div class="ss-label">Estado de la muestra</div></div></div><div class="resumen-grid"><div class="resumen-item"><div class="rl">Agente</div><div class="rv">${h(v('f-agente'))}</div></div><div class="resumen-item"><div class="rl">Ticket</div><div class="rv">${h(v('f-ticket'))}</div></div><div class="resumen-item"><div class="rl">Auditor</div><div class="rv">${h(v('f-auditor'))}</div></div><div class="resumen-item"><div class="rl">Semana</div><div class="rv">${h(v('f-semana'))}</div></div></div>`;}
async function submitAuditoria(){
  const btn=document.getElementById('btn-submit'); btn.disabled=true; btn.textContent='Registrando...';
  const cal=getCalidad(), client_request_id=createClientRequestId(), id='LOCAL-'+client_request_id.slice(-8).toUpperCase(), fecha=v('f-fecha');
  const aud={id,id_auditoria:id,client_request_id,fecha_registro:new Date().toISOString(),fecha_auditoria:fecha,anio:new Date(fecha+'T00:00:00').getFullYear(),mes:v('f-mes'),semana:v('f-semana'),auditor:v('f-auditor'),agente:v('f-agente'),ticket:v('f-ticket'),canal:v('f-canal'),tipo:v('f-tipo'),calidad:cal,productividad:null,general:null,estado:calcEstado(cal),requiere_seguimiento:v('f-seguimiento'),obs_general:v('f-obs-general'),obs_desvios:v('f-obs-desvios'),obs_accion:v('f-obs-accion'),resp_seguimiento:v('f-resp-seg'),criterios:getCriterioDetalle(),sheets_enviado:false,pct_calidad:cal};
  DB.auditorias.push(aud);
  const res=await postSheets({...aud,_type:'create_auditoria'});
  if(res.ok){ const serverId=res.data?.id; if(serverId){aud.id=serverId;aud.id_auditoria=serverId;} aud.sheets_enviado=true; }
  else if(res.retryable){ queuePendingCreate(aud); }
  else { DB.auditorias=DB.auditorias.filter(item=>item!==aud); const alertEl=document.getElementById('form-alert'); alertEl.className='alert error'; alertEl.textContent=`No se registro la auditoria: ${res.reason}`; alertEl.classList.remove('hidden'); btn.disabled=false; btn.textContent='Registrar y enviar a Sheets'; renderDashboard(); return; }
  const alertEl=document.getElementById('form-alert'); alertEl.className=res.ok?'alert success':'alert warning'; alertEl.classList.remove('hidden'); alertEl.textContent=res.ok?`${aud.id_auditoria} registrada.`:`${id} guardada localmente y pendiente de sincronizacion.`;
  _criteriosSnapshot=null; resetForm(); btn.disabled=false; btn.textContent='Registrar y enviar a Sheets'; populateSelects(); renderDashboard();
}function resetForm(){document.querySelectorAll('#page-formulario input,#page-formulario select,#page-formulario textarea').forEach(el=>{if(el.type==='radio')el.checked=false;else if(!el.readOnly&&!el.disabled)el.value='';});document.querySelectorAll('.radio-btn').forEach(b=>b.classList.remove('selected'));const today=new Date().toISOString().slice(0,10);document.getElementById('f-fecha').value=today;onFechaChange();goStep(1);}
