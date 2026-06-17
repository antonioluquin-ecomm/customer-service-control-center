// ================================================================
// API — comunicación con Google Sheets / Apps Script
// ================================================================

// Fetch con timeout automático via AbortController
const go = (url, timeout=18000) => {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  return fetch(url,{redirect:"follow",signal:controller.signal}).finally(()=>clearTimeout(timer));
};

// POST a Google Sheets con Content-Type text/plain (evita preflight CORS)
async function postSheets(payload){
  if(!CFG.sheets_url) return {ok:false, reason:"no_url"};
  showSync("Enviando a Google Sheets...");
  try{
    const res=await fetch(CFG.sheets_url,{
      method:"POST",
      mode:"cors",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(payload)
    });
    if(!res.ok){ hideSync("⚠ Error HTTP "+res.status,3000,true); return {ok:false,reason:"http_"+res.status}; }
    const data=await res.json().catch(()=>null);
    if(data&&data.status==="ok"){ hideSync("✓ Guardado en Sheets"); return {ok:true}; }
    const msg=data?.message||"Error desconocido";
    hideSync("⚠ "+msg,3500,true);
    return {ok:false,reason:msg};
  }catch(e){
    hideSync("⚠ Sin conexión — guardado local",3000,true);
    return {ok:false,reason:e.message};
  }
}

// Carga inicial: 4 endpoints en paralelo
async function reloadFromSheets(){
  const ov=document.getElementById("loading-overlay");
  const msg=document.getElementById("loading-msg");
  const sub=document.getElementById("loading-sub");
  if(!CFG.sheets_url){
    ov.style.display="none";
    updateSheetsUI("disconnected");
    populateSelects();
    renderDashboard();
    return;
  }
  ov.style.display="flex"; msg.textContent="Cargando datos desde Google Sheets..."; sub.textContent="Esto puede tardar unos segundos";
  try{
    const [cfgR,audR,detR,critR] = await Promise.all([
      go(CFG.sheets_url+"?action=get_config"),
      go(CFG.sheets_url+"?action=get_auditorias"),
      go(CFG.sheets_url+"?action=get_detalle"),
      go(CFG.sheets_url+"?action=get_criterios"),
    ]);
    msg.textContent="Procesando...";
    if(cfgR.ok){ const d=await cfgR.json(); if(d.status==="ok"&&d.config){ applyCfg(d.config); } }
    let auds=[];
    if(audR.ok){ const d=await audR.json(); if(d.status==="ok") auds=d.auditorias||[]; }
    let det={};
    if(detR.ok){ const d=await detR.json(); if(d.status==="ok") det=d.detalle||{}; }
    auds.forEach(a=>{ a.criterios=det[a.id_auditoria]||[]; });
    if(critR.ok){ const d=await critR.json(); if(d.status==="ok"&&d.criterios?.length) CRITERIOS=d.criterios; }
    DB.auditorias=auds;
    const maxId=auds.reduce((m,a)=>Math.max(m,parseInt(String(a.id_auditoria).replace("AUD-",""))||0),0);
    DB.nextId=Math.max(maxId+1,getNextId_local());
    persistNextId();
    updateSheetsUI("connected");
    populateSelects();
    renderDashboard();
    msg.textContent=`✓ ${auds.length} auditorías cargadas`;
    sub.textContent="Datos actualizados correctamente";
    setTimeout(()=>{ ov.style.display="none"; },700);
  }catch(err){
    console.error(err);
    updateSheetsUI("disconnected");
    msg.textContent="⚠ No se pudo conectar con Google Sheets";
    sub.textContent="Verificá la URL en Configuración.";
    setTimeout(()=>{ ov.style.display="none"; },2500);
  }
}

// Aplica configuración recibida desde Sheets a CFG
function applyCfg(c){
  if(c.agentes?.length)    CFG.agentes=c.agentes;
  if(c.auditores?.length)  CFG.auditores=c.auditores;
  if(c.horas_base)         CFG.horas_base=Number(c.horas_base);
  if(c.tickets_base)       CFG.tickets_base=Number(c.tickets_base);
  if(c.muestras_semana)    CFG.muestras_semana=Number(c.muestras_semana);
  if(c.w_inter!=null)      CFG.w_inter=Number(c.w_inter);
  if(c.w_puntual!=null)    CFG.w_puntual=Number(c.w_puntual);
  if(c.w_present!=null)    CFG.w_present=Number(c.w_present);
  if(c.obj_puntual!=null)  CFG.obj_puntual=Number(c.obj_puntual);
  if(c.obj_present!=null)  CFG.obj_present=Number(c.obj_present);
  if(c.u_excelente!=null)  CFG.u_excelente=Number(c.u_excelente);
  if(c.u_correcta!=null)   CFG.u_correcta=Number(c.u_correcta);
  if(c.w_calidad!=null)    CFG.w_calidad=Number(c.w_calidad);
  if(c.w_productividad!=null) CFG.w_productividad=Number(c.w_productividad);
}

// Prueba la conexión a Sheets
async function testSheets(){
  if(!CFG.sheets_url){alert("Sin URL.");return;}
  const badge=document.getElementById("cfg-sheets-badge");
  badge.innerHTML='<span class="badge">Probando...</span>';
  try{
    const r=await go(CFG.sheets_url+"?action=get_config");
    const d=await r.json();
    badge.innerHTML=d.status==="ok"?'<span class="badge badge-excelente">✓ Conexión OK</span>':`<span class="badge badge-observada">⚠ ${d.message}</span>`;
  }catch(e){ badge.innerHTML=`<span class="badge badge-observada">✗ ${e.message}</span>`; }
}

// POST de cambios de configuración a Sheets
async function syncConfigToSheets(accion,det){
  await postSheets({
    _type:"config_change", accion,
    timestamp:new Date().toISOString(),
    agentes:CFG.agentes, auditores:CFG.auditores,
    parametros:{
      horas_base:CFG.horas_base, tickets_base:CFG.tickets_base, muestras_semana:CFG.muestras_semana,
      w_inter:CFG.w_inter, w_puntual:CFG.w_puntual, w_present:CFG.w_present,
      obj_puntual:CFG.obj_puntual, obj_present:CFG.obj_present,
      u_excelente:CFG.u_excelente, u_correcta:CFG.u_correcta,
      w_calidad:CFG.w_calidad, w_productividad:CFG.w_productividad,
    },
    detalle:det||"",
  });
}
