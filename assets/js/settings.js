// ================================================================
// SETTINGS — página de configuración
// ================================================================

// Carga los valores actuales de CFG en los inputs de configuración
function renderConfigPage(){
  document.getElementById("cfg-horas-base").value=CFG.horas_base;
  document.getElementById("cfg-tickets-base").value=CFG.tickets_base;
  document.getElementById("cfg-muestras").value=CFG.muestras_semana;
  document.getElementById("cfg-w-inter").value=CFG.w_inter;
  document.getElementById("cfg-w-puntual").value=CFG.w_puntual;
  document.getElementById("cfg-w-present").value=CFG.w_present;
  document.getElementById("cfg-obj-puntual").value=CFG.obj_puntual;
  document.getElementById("cfg-obj-present").value=CFG.obj_present;
  document.getElementById("cfg-u-excelente").value=CFG.u_excelente;
  document.getElementById("cfg-u-correcta").value=CFG.u_correcta;
  document.getElementById("cfg-w-calidad").value=CFG.w_calidad;
  document.getElementById("cfg-w-productividad").value=CFG.w_productividad;
  renderListaAgentes(); renderListaAuditores();
  renderCriteriosConfig();
  checkPesosProd(); checkPesosGeneral();
}

// Lista editable de agentes
function renderListaAgentes(){
  const h=escapeHtml;
  const cont=document.getElementById("lista-agentes"); if(!cont) return;
  if(!CFG.agentes.length){ cont.innerHTML='<p style="color:var(--hint);font-size:12px;padding:8px 0">Sin agentes.</p>'; return; }
  cont.innerHTML=CFG.agentes.map((a,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
      <div class="avatar" style="width:28px;height:28px;font-size:11px">${h(a.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase())}</div>
      <div style="flex:1;font-size:13px">${h(a)}</div>
      <button class="btn xs danger" onclick="removeAgente(${i})">✕</button>
    </div>`).join("");
}

// Lista editable de auditores
function renderListaAuditores(){
  const h=escapeHtml;
  const cont=document.getElementById("lista-auditores"); if(!cont) return;
  if(!CFG.auditores.length){ cont.innerHTML='<p style="color:var(--hint);font-size:12px;padding:8px 0">Sin auditores.</p>'; return; }
  cont.innerHTML=CFG.auditores.map((a,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;font-size:13px;font-weight:500">${h(a)}</div>
      <button class="btn xs danger" onclick="removeAuditor(${i})">✕</button>
    </div>`).join("");
}

// Tabla editable de criterios de calidad
function renderCriteriosConfig(){
  const h=escapeHtml;
  const tbody=document.getElementById("cfg-criterios-tbody"); if(!tbody) return;
  tbody.innerHTML=CRITERIOS.map((c,i)=>{
    const tagClass=c.bloque==="Comunicacion"?"tag-com":"tag-ges";
    const tagLabel=c.bloque==="Comunicacion"?"Com.":"Gest.";
    return `<tr>
      <td><span class="bloque-tag ${tagClass}">${tagLabel}</span></td>
      <td style="font-size:13px;font-weight:500">${h(c.nombre)}</td>
      <td><input type="number" min="0" max="100" value="${Number(c.peso)||0}" id="cpeso-${i}" oninput="updateCriteriosPeso()" style="width:72px;text-align:center"/></td>
      <td><label class="toggle"><input type="checkbox" id="cactivo-${i}" ${c.activo?"checked":""}><div class="toggle-slider"></div></label></td>
    </tr>`;
  }).join("");
  updateCriteriosPeso();
}

// Muestra la suma actual de pesos de criterios
function updateCriteriosPeso(){
  let sum=0;
  CRITERIOS.forEach((c,i)=>{ const el=document.getElementById("cpeso-"+i); if(el) sum+=Number(el.value)||0; });
  const el=document.getElementById("criterios-peso-total");
  if(el){ el.textContent=`Suma: ${sum}%`; el.className=sum===100?"peso-sum ok":"peso-sum err"; }
}

// Restaura criterios a los valores por defecto
function resetCriteriosDefault(){
  if(!confirm("¿Restaurar los criterios y pesos por defecto?")) return;
  CRITERIOS=JSON.parse(JSON.stringify(CRITERIOS_DEFAULT));
  renderCriteriosConfig();
}

// Guarda los criterios editados en Sheets
async function saveCriterios(){
  CRITERIOS=CRITERIOS.map((c,i)=>{
    const peso=Number(document.getElementById("cpeso-"+i)?.value)||0;
    const activo=document.getElementById("cactivo-"+i)?.checked!==false;
    return {...c, peso, activo};
  });
  const sum=CRITERIOS.reduce((s,c)=>s+c.peso,0);
  if(sum!==100){ alert(`Los pesos deben sumar exactamente 100%. Suma actual: ${sum}%`); return; }
  const st=document.getElementById("criterios-save-status");
  if(st) st.textContent="Enviando...";
  const res=await postSheets({_type:"update_criterios", criterios:CRITERIOS});
  if(st) st.textContent=res.ok?"✓ Guardado en Sheets":("⚠ Error al guardar ("+new Date().toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"})+")");
  renderCriteriosConfig();
}

// Valida que pesos de productividad sumen 100%
function checkPesosProd(){
  const wi=Number(document.getElementById("cfg-w-inter")?.value)||0;
  const wp=Number(document.getElementById("cfg-w-puntual")?.value)||0;
  const wpr=Number(document.getElementById("cfg-w-present")?.value)||0;
  const sum=wi+wp+wpr;
  const el=document.getElementById("cfg-pesos-prod-check");
  if(el){ el.textContent=sum===100?`✓ Los pesos suman 100%. Correcto.`:`⚠ Los pesos suman ${sum}% (deben ser 100%).`; el.className=sum===100?"peso-sum ok":"peso-sum err"; }
}

// Valida que pesos de calidad+productividad sumen 100% y actualiza barra visual
function checkPesosGeneral(){
  const wc=Number(document.getElementById("cfg-w-calidad")?.value)||0;
  const wp=Number(document.getElementById("cfg-w-productividad")?.value)||0;
  const sum=wc+wp;
  const el=document.getElementById("cfg-pesos-general-check");
  if(el){ el.textContent=sum===100?`✓ Correcto. Calidad ${wc}% + Productividad ${wp}% = 100%`:`⚠ Suman ${sum}% (deben ser 100%).`; el.className=sum===100?"peso-sum ok":"peso-sum err"; }
  const bc=document.getElementById("gpb-cal"), bp=document.getElementById("gpb-prod");
  const pc=document.getElementById("gpb-cal-pct"), pp=document.getElementById("gpb-prod-pct");
  if(bc&&bp){ bc.style.flex=wc; bp.style.flex=Math.max(0,100-wc); }
  if(pc) pc.textContent=wc+"%";
  if(pp) pp.textContent=wp+"%";
}

// Guarda todos los parámetros de configuración y sincroniza con Sheets
async function saveConfig(){
  const wi=Number(document.getElementById("cfg-w-inter").value);
  const wp=Number(document.getElementById("cfg-w-puntual").value);
  const wpr=Number(document.getElementById("cfg-w-present").value);
  if(wi+wp+wpr!==100){ alert("Los pesos de productividad deben sumar 100%."); return; }
  const wc=Number(document.getElementById("cfg-w-calidad").value);
  const wprod=Number(document.getElementById("cfg-w-productividad").value);
  if(wc+wprod!==100){ alert("Calidad + Productividad deben sumar 100%."); return; }
  CFG.horas_base    =Number(document.getElementById("cfg-horas-base").value)||44;
  CFG.tickets_base  =Number(document.getElementById("cfg-tickets-base").value)||660;
  CFG.muestras_semana=Number(document.getElementById("cfg-muestras").value)||4;
  CFG.w_inter=wi; CFG.w_puntual=wp; CFG.w_present=wpr;
  CFG.obj_puntual=Number(document.getElementById("cfg-obj-puntual").value)||1;
  CFG.obj_present=Number(document.getElementById("cfg-obj-present").value)||1;
  CFG.u_excelente=Number(document.getElementById("cfg-u-excelente").value)||95;
  CFG.u_correcta =Number(document.getElementById("cfg-u-correcta").value)||80;
  CFG.w_calidad=wc; CFG.w_productividad=wprod;
  await syncConfigToSheets("parametros_actualizados","Guardado desde UI");
  populateSelects();
  const el=document.getElementById("config-saved"); el.classList.remove("hidden");
  setTimeout(()=>el.classList.add("hidden"),3000);
  const badge=document.getElementById("cfg-sync-badge");
  if(badge) badge.innerHTML=`<span class="badge badge-excelente">✓ Sincronizado ${new Date().toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"})}</span>`;
}

// CRUD agentes
function addAgente(){
  const inp=document.getElementById("nuevo-agente"), val=inp.value.trim();
  if(!val) return;
  if(CFG.agentes.includes(val)){ alert("Ya existe."); return; }
  CFG.agentes.push(val); inp.value="";
  populateSelects(); renderListaAgentes();
  syncConfigToSheets("agente_agregado",{agente:val});
}
function removeAgente(i){
  const nombre=CFG.agentes[i]; CFG.agentes.splice(i,1);
  populateSelects(); renderListaAgentes();
  syncConfigToSheets("agente_eliminado",{agente:nombre});
}

// CRUD auditores
function addAuditor(){
  const inp=document.getElementById("nuevo-auditor"), val=inp.value.trim();
  if(!val) return;
  if(CFG.auditores.includes(val)){ alert("Ya existe."); return; }
  CFG.auditores.push(val); inp.value="";
  populateSelects(); renderListaAuditores();
  syncConfigToSheets("auditor_agregado",{auditor:val});
}
function removeAuditor(i){
  const nombre=CFG.auditores[i]; CFG.auditores.splice(i,1);
  populateSelects(); renderListaAuditores();
  syncConfigToSheets("auditor_eliminado",{auditor:nombre});
}
