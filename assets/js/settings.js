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
  const ue=Number(document.getElementById("cfg-u-excelente").value);
  const uc=Number(document.getElementById("cfg-u-correcta").value);
  if(!Number.isFinite(ue)||!Number.isFinite(uc)||ue<1||ue>100||uc<1||uc>100||ue<=uc){ alert("El umbral Excelente debe ser mayor que el umbral Correcta, y ambos deben estar entre 1% y 100%."); return; }
  CFG.horas_base    =Number(document.getElementById("cfg-horas-base").value)||44;
  CFG.tickets_base  =Number(document.getElementById("cfg-tickets-base").value)||660;
  CFG.muestras_semana=Number(document.getElementById("cfg-muestras").value)||4;
  CFG.w_inter=wi; CFG.w_puntual=wp; CFG.w_present=wpr;
  CFG.obj_puntual=Number(document.getElementById("cfg-obj-puntual").value)||1;
  CFG.obj_present=Number(document.getElementById("cfg-obj-present").value)||1;
  CFG.u_excelente=ue;
  CFG.u_correcta =uc;
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

// ================================================================
// ADMIN — pantalla de configuración (3 tabs: Usuarios/Roles/Conexión)
// application_shell.md §6.4 — backend Sprint 6 (RBAC en Sheets)
// ================================================================

let _adminRoles = [];
let _adminUsuarios = [];
let _adminCargado = { usuarios:false, roles:false, conexion:false };

// Llamada autenticada al backend (incluye sessionToken; lee dual-emit status).
async function adminCall(action, payload={}){
  const token = window.getSessionToken ? getSessionToken() : "";
  const res = await fetch(CONFIG.SCRIPT_URL, {
    method:"POST", mode:"cors",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body: JSON.stringify({ _type:action, sessionToken:token, ...payload }),
  });
  const data = await res.json().catch(()=>null);
  if(!data || data.status!=="ok") throw new Error(data?.message || "Error al comunicarse con el servidor");
  return data;
}

// Cambia de tab; los tabs admin cargan datos la primera vez.
function switchConfigTab(tab){
  document.querySelectorAll(".cfg-tab").forEach(b=>b.classList.toggle("active", b.dataset.cfgTab===tab));
  document.querySelectorAll(".cfg-panel").forEach(p=>p.classList.toggle("active", p.dataset.cfgPanel===tab));
  // Las acciones del header (Guardar todo) son solo para Parámetros.
  const actions=document.getElementById("cfg-header-actions");
  if(actions) actions.style.display = tab==="parametros" ? "" : "none";
  if(tab==="usuarios") renderAdminUsuarios();
  if(tab==="roles")    renderAdminRoles();
  if(tab==="conexion") renderAdminConexion();
}

function _adminError(cont, err){
  cont.innerHTML=`<div class="card"><div class="alert error" style="margin:0">No se pudo cargar: ${escapeHtml(err.message)}.<br><span style="font-size:12px;color:var(--muted)">Verificá que el backend (Sprint 6) esté desplegado y que tengas rol Administrador.</span></div></div>`;
}

function _rolNombre(id_rol){
  const r=_adminRoles.find(x=>Number(x.id)===Number(id_rol));
  return r ? r.nombre : ("Rol "+id_rol);
}

// ── Tab Usuarios ────────────────────────────────────────────────
async function renderAdminUsuarios(){
  const cont=document.getElementById("admin-usuarios");
  cont.innerHTML='<div class="card" style="color:var(--muted)">Cargando usuarios…</div>';
  try{
    // Roles antes que usuarios (el badge de rol se resuelve por lookup).
    const rRoles=await adminCall("getRoles");   _adminRoles=rRoles.roles||rRoles.data||[];
    const rUsers=await adminCall("getUsuarios"); _adminUsuarios=rUsers.usuarios||rUsers.data||[];
    _adminCargado.usuarios=true;
    _paintUsuarios(cont);
  }catch(err){ _adminError(cont, err); }
}

function _paintUsuarios(cont){
  const h=escapeHtml;
  const rows=_adminUsuarios.map(u=>`<tr>
    <td style="font-weight:600">${h(u.nombre)}</td>
    <td style="font-family:'DM Mono',monospace;font-size:12px">${h(u.email)}</td>
    <td><span class="auth-chip-role">${h(_rolNombre(u.id_rol))}</span></td>
    <td>${u.activo?'<span class="badge badge-ok">Activo</span>':'<span class="badge badge-local">Inactivo</span>'}</td>
    <td style="display:flex;gap:6px">
      <button class="btn xs" onclick="showUsuarioForm(${Number(u.id)})">Editar</button>
      <button class="btn xs ${u.activo?'danger':''}" onclick="toggleUsuarioActivo(${Number(u.id)},${u.activo?'false':'true'})">${u.activo?'Desactivar':'Activar'}</button>
    </td></tr>`).join("");
  const rolesActivos=_adminRoles.filter(r=>r.activo);
  cont.innerHTML=`
    <div class="card">
      <div class="card-header"><div><div class="card-title">Usuarios</div><div class="card-sub">Acceso al sistema y rol asignado</div></div>
        <button class="btn sm primary" onclick="showUsuarioForm()">+ Nuevo usuario</button></div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="5" style="text-align:center;color:var(--hint);padding:20px">Sin usuarios.</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="card" id="usuario-form-card" style="display:none;margin-top:16px">
      <div class="card-header"><div class="card-title" id="usuario-form-title">Nuevo usuario</div></div>
      <input type="hidden" id="uf-id"/>
      <div class="fg c2" style="gap:12px">
        <div class="field"><label>Nombre *</label><input type="text" id="uf-nombre"/></div>
        <div class="field"><label>Email *</label><input type="email" id="uf-email"/></div>
        <div class="field"><label>Rol *</label><select id="uf-rol">${rolesActivos.map(r=>`<option value="${Number(r.id)}">${h(r.nombre)}</option>`).join("")}</select></div>
        <div class="field"><label id="uf-pwd-label">Contraseña *</label><input type="password" id="uf-pwd" placeholder="Mínimo 6 caracteres"/></div>
      </div>
      <div id="uf-alert" class="alert error hidden" style="margin-top:10px"></div>
      <div style="margin-top:14px;display:flex;gap:8px">
        <button class="btn primary sm" onclick="submitUsuario()">Guardar</button>
        <button class="btn sm" onclick="document.getElementById('usuario-form-card').style.display='none'">Cancelar</button>
      </div>
    </div>`;
}

function showUsuarioForm(id){
  const card=document.getElementById("usuario-form-card");
  const u=id?_adminUsuarios.find(x=>Number(x.id)===Number(id)):null;
  document.getElementById("usuario-form-title").textContent=u?"Editar usuario":"Nuevo usuario";
  document.getElementById("uf-id").value=u?u.id:"";
  document.getElementById("uf-nombre").value=u?u.nombre:"";
  document.getElementById("uf-email").value=u?u.email:"";
  document.getElementById("uf-email").disabled=!!u;
  document.getElementById("uf-rol").value=u?u.id_rol:(_adminRoles.find(r=>r.activo)?.id||"");
  document.getElementById("uf-pwd").value="";
  document.getElementById("uf-pwd-label").textContent=u?"Nueva contraseña (opcional)":"Contraseña *";
  document.getElementById("uf-alert").classList.add("hidden");
  card.style.display="block";
}

async function submitUsuario(){
  const id=document.getElementById("uf-id").value;
  const nombre=document.getElementById("uf-nombre").value.trim();
  const email=document.getElementById("uf-email").value.trim().toLowerCase();
  const id_rol=Number(document.getElementById("uf-rol").value);
  const pwd=document.getElementById("uf-pwd").value;
  const alert=document.getElementById("uf-alert");
  const fail=m=>{ alert.textContent=m; alert.classList.remove("hidden"); };
  if(!nombre) return fail("El nombre es obligatorio.");
  if(!id) { if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Email inválido."); if(pwd.length<6) return fail("La contraseña debe tener al menos 6 caracteres."); }
  if(pwd && pwd.length<6) return fail("La contraseña debe tener al menos 6 caracteres.");
  try{
    const payload={ nombre, id_rol };
    if(pwd) payload.passwordHash=await sha256(pwd);
    if(id){ payload.id=Number(id); await adminCall("updateUsuario", payload); }
    else  { payload.email=email; await adminCall("createUsuario", payload); }
    document.getElementById("usuario-form-card").style.display="none";
    renderAdminUsuarios();
  }catch(err){ fail(err.message); }
}

async function toggleUsuarioActivo(id, activo){
  const u=_adminUsuarios.find(x=>Number(x.id)===Number(id));
  if(!confirm(`¿${activo?'Activar':'Desactivar'} a ${u?u.nombre:id}?`)) return;
  try{ await adminCall("updateUsuario", { id:Number(id), activo: activo===true||activo==="true" }); renderAdminUsuarios(); }
  catch(err){ alert(err.message); }
}

// ── Tab Roles y permisos ────────────────────────────────────────
async function renderAdminRoles(){
  const cont=document.getElementById("admin-roles");
  cont.innerHTML='<div class="card" style="color:var(--muted)">Cargando roles…</div>';
  try{
    const r=await adminCall("getRoles"); _adminRoles=r.roles||r.data||[];
    _adminCargado.roles=true;
    _paintRoles(cont);
  }catch(err){ _adminError(cont, err); }
}

function _paintRoles(cont){
  const h=escapeHtml;
  const rows=_adminRoles.map(r=>`<tr>
    <td style="font-weight:600">${h(r.nombre)}</td>
    <td>${r.es_sistema?'<span class="badge badge-local">Sistema</span>':'<span class="badge">Personalizado</span>'}</td>
    <td>${r.activo?'<span class="badge badge-ok">Activo</span>':'<span class="badge badge-local">Inactivo</span>'}</td>
    <td><button class="btn xs" onclick="selectRolPermisos(${Number(r.id)})">Ver permisos</button></td>
  </tr>`).join("");
  cont.innerHTML=`
    <div class="card">
      <div class="card-header"><div><div class="card-title">Roles</div><div class="card-sub">El rol de sistema no se puede modificar</div></div></div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>Rol</th><th>Tipo</th><th>Estado</th><th>Permisos</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
    <div class="card" id="perm-matrix-card" style="display:none;margin-top:16px"></div>`;
}

async function selectRolPermisos(id_rol){
  const card=document.getElementById("perm-matrix-card");
  card.style.display="block";
  card.innerHTML='<div style="color:var(--muted)">Cargando permisos…</div>';
  const rol=_adminRoles.find(r=>Number(r.id)===Number(id_rol));
  const readonly=!!(rol&&rol.es_sistema);
  try{
    const r=await adminCall("getPermisosRol",{ id_rol:Number(id_rol) });
    const permisos=r.permisos||r.data||{};
    const estado=p=>p.editar?"editar":(p.ver?"ver":"oculto");
    const mods=["dashboard","formulario","productividad","registros","observaciones","agentes","configuracion"];
    const rows=mods.map(m=>{
      const st=estado(permisos[m]||{ver:false,editar:false});
      return `<tr>
        <td class="perm-mod">${m}</td>
        <td><select data-mod="${m}" ${readonly?"disabled":""}>
          <option value="oculto" ${st==="oculto"?"selected":""}>Oculto</option>
          <option value="ver" ${st==="ver"?"selected":""}>Solo ver</option>
          <option value="editar" ${st==="editar"?"selected":""}>Ver + editar</option>
        </select></td></tr>`;
    }).join("");
    card.innerHTML=`
      <div class="card-header"><div><div class="card-title">Permisos · ${escapeHtml(rol?rol.nombre:id_rol)}</div>
        <div class="card-sub">${readonly?"Rol de sistema — solo lectura":"Definí el acceso por módulo"}</div></div></div>
      <table class="perm-matrix"><thead><tr><th>Módulo</th><th>Acceso</th></tr></thead><tbody>${rows}</tbody></table>
      ${readonly?"":`<div style="margin-top:14px"><button class="btn primary sm" onclick="saveRolPermisos(${Number(id_rol)})">✓ Guardar permisos</button>
        <span id="perm-save-status" style="font-size:12px;color:var(--muted);margin-left:10px"></span></div>`}`;
  }catch(err){ card.innerHTML=`<div class="alert error" style="margin:0">${escapeHtml(err.message)}</div>`; }
}

async function saveRolPermisos(id_rol){
  const permisos={};
  document.querySelectorAll("#perm-matrix-card select[data-mod]").forEach(sel=>{
    const v=sel.value;
    permisos[sel.dataset.mod]={ ver: v!=="oculto", editar: v==="editar" };
  });
  const st=document.getElementById("perm-save-status");
  if(st) st.textContent="Guardando…";
  try{ await adminCall("updatePermisos",{ id_rol:Number(id_rol), permisos }); if(st) st.textContent="✓ Guardado"; }
  catch(err){ if(st) st.textContent="⚠ "+err.message; }
}

// ── Tab Conexión ────────────────────────────────────────────────
async function renderAdminConexion(){
  const cont=document.getElementById("admin-conexion");
  const h=escapeHtml;
  const hojas=["USUARIOS","ROLES","PERMISOS_MODULOS","SESIONES","LOGS","ERRORS","CONFIG","auditorias","productividad_semanal","criterios_calidad","configuracion"];
  cont.innerHTML=`
    <div class="card">
      <div class="card-header"><div><div class="card-title">Integraciones</div><div class="card-sub">Backend de Apps Script · Google Sheets</div></div>
        <span id="conn-badge"><span class="badge badge-local">Verificando…</span></span></div>
      <div class="conn-row"><span>URL del Web App</span><span class="conn-url">${h(CONFIG.SCRIPT_URL)}</span></div>
      <div class="conn-row"><span>Estado</span><span id="conn-status">—</span></div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-header"><div><div class="card-title">Hojas requeridas</div><div class="card-sub">Estructura esperada en el Sheet</div></div></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${hojas.map(s=>`<span class="badge">${h(s)}</span>`).join("")}</div>
    </div>`;
  // Health check
  try{
    const res=await fetch(CONFIG.SCRIPT_URL+"?action=health",{redirect:"follow"});
    const data=await res.json().catch(()=>null);
    const okConn=data&&(data.status==="ok"||data.ok);
    document.getElementById("conn-badge").innerHTML=okConn?'<span class="badge badge-ok">✓ Conectado</span>':'<span class="badge badge-observada">✗ Sin respuesta</span>';
    document.getElementById("conn-status").textContent=okConn?("Servicio activo · "+(data.service||"AuditCS")):"No se pudo verificar";
  }catch(err){
    document.getElementById("conn-badge").innerHTML='<span class="badge badge-observada">✗ Sin conexión</span>';
    document.getElementById("conn-status").textContent="Error: "+err.message;
  }
}
