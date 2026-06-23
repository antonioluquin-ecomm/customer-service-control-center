// ================================================================
// UI — navegación, selects, sync bar, utilidades DOM
// ================================================================

// Shortcut para leer el value de un input por id
const v = id => { const el=document.getElementById(id); return el?el.value:""; };

// Barra de sincronización (top fixed)
function showSync(msg){ const sb=document.getElementById("sync-bar"); sb.classList.remove("err"); sb.querySelector("#sync-bar-msg").textContent=msg; sb.classList.add("show"); clearTimeout(_sTimer); }
function hideSync(msg,d=2200,isErr=false){ const sb=document.getElementById("sync-bar"); if(isErr) sb.classList.add("err"); sb.querySelector("#sync-bar-msg").textContent=msg; _sTimer=setTimeout(()=>sb.classList.remove("show"),d); }

// Estado del botón de Sheets en sidebar y en configuración
function updateSheetsUI(state){
  const btn=document.getElementById("sheets-btn");
  const lbl=document.getElementById("sheets-label");
  const badge=document.getElementById("cfg-sheets-badge");
  if(state==="connected"){
    btn.className="sheets-btn connected"; lbl.textContent=`Sheets · ${DB.auditorias.length} registros`;
    if(badge) badge.innerHTML='<span class="badge badge-excelente">✓ Conectado</span>';
  } else {
    btn.className="sheets-btn disconnected"; lbl.textContent="Sheets: desconectado";
    if(badge) badge.innerHTML='<span class="badge badge-observada">✗ Sin conexión</span>';
  }
}

// Mapa de índice de nav por id de página
const PAGE_MAP={dashboard:0,agentes:1,observaciones:2,formulario:3,productividad:4,registros:5,configuracion:6};

// Muestra la página activa y dispara su render
function showPage(id){
  if(id==="configuracion" && !isAdmin()){
    alert("Solo los administradores pueden acceder a Configuración.");
    return;
  }
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
  document.getElementById("page-"+id).classList.add("active");
  document.querySelectorAll(".nav-item")[PAGE_MAP[id]].classList.add("active");
  if(id==="configuracion") renderConfigPage();
  if(id==="dashboard")     renderDashboard();
  if(id==="registros")     renderRegistros();
  if(id==="observaciones"){ populateObsFilters(); renderObservaciones(); }
  if(id==="agentes")       renderAgentes();
  if(id==="productividad"){ initProductividadForm(); renderProductividadRecords(); }
}

function applyRoleRestrictions(){
  if(isAdmin()) return;
  const configNav=document.querySelector('.nav-item[onclick*="configuracion"]');
  if(configNav) configNav.style.display="none";
}

// Carga dinámica de agentes en el filtro de observaciones
function populateObsFilters(){
  const ofa=document.getElementById("obs-filter-agente");
  if(ofa && ofa.options.length<=1){
    const agentes=[...new Set(DB.auditorias.map(a=>a.agente).filter(Boolean))].sort();
    ofa.innerHTML='<option value="">Todos los agentes</option>'+agentes.map(a=>`<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("");
  }
}

// Rellena todos los select dinámicos de la app
function populateSelects(){
  const opts=(arr,empty)=>`<option value="">${escapeHtml(empty)}</option>`+arr.map(a=>`<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("");
  const fa=document.getElementById("f-agente"); if(fa) fa.innerHTML=opts(CFG.agentes,"— Seleccionar —");
  const fau=document.getElementById("f-auditor"); if(fau) fau.innerHTML=opts(CFG.auditores,"— Seleccionar —");
  const pa=document.getElementById("p-agente"); if(pa) pa.innerHTML=opts(CFG.agentes,"— Seleccionar —");
  const ff=document.getElementById("filter-agente"); if(ff) ff.innerHTML=opts(CFG.agentes,"Todos los agentes");
  const sd=document.getElementById("sel-agente-detail"); if(sd) sd.innerHTML=opts(CFG.agentes,"— Seleccionar agente —");
  const dfa=document.getElementById("df-agente"); if(dfa) dfa.innerHTML=opts(CFG.agentes,"Todos los agentes");
  const dfau=document.getElementById("df-auditor"); if(dfau) dfau.innerHTML=opts(CFG.auditores,"Todos los auditores");
  const ofa=document.getElementById("obs-filter-agente"); if(ofa) ofa.innerHTML=opts(CFG.agentes,"Todos los agentes");
  // Semanas dinámicas desde las auditorías cargadas
  const semanas=[...new Set(DB.auditorias.map(a=>a.semana).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  const semOpts='<option value="">Todas las semanas</option>'+semanas.map(s=>`<option value="${escapeHtml(s)}">Semana ${escapeHtml(s)}</option>`).join("");
  const fsem=document.getElementById("filter-semana"); if(fsem) fsem.innerHTML=semOpts;
  const dfsem=document.getElementById("df-semana"); if(dfsem) dfsem.innerHTML=semOpts;
  document.getElementById("sidebar-info").innerHTML=`Responsable: ${escapeHtml(CFG.auditores[0]||"—")}<br>Epic: Servicio al Cliente<br>${CFG.muestras_semana} muestras / agente / semana`;
}
