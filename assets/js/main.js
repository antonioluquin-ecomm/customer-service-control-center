// ================================================================
// MAIN — entry point e inicialización
// ================================================================

/* ─── THEME ──────────────────────────────────────────────────── */

const _THEME_KEY = 'cs_theme';

function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

function setTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(_THEME_KEY, next);
  const isLight = next === 'light';
  // El botón muestra la acción a la que se cambiará al hacer clic.
  document.querySelectorAll('.theme-toggle').forEach(function(btn) {
    const icon  = btn.querySelector('.th-icon');
    const label = btn.querySelector('.th-label');
    if (icon)  icon.textContent  = isLight ? '☾' : '☀';
    if (label) label.textContent = isLight ? 'Modo oscuro' : 'Modo claro';
    btn.setAttribute('title', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  });
}

function toggleTheme() { setTheme(getCurrentTheme() === 'light' ? 'dark' : 'light'); }

function initTheme() {
  const saved = localStorage.getItem(_THEME_KEY)
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(saved);
}

// Reintenta enviar a Sheets los registros que quedaron en la cola offline
async function retrySyncPending(){
  if(!PENDING_QUEUE.length){ alert("No hay registros pendientes."); return; }
  showSync(`Reintentando ${PENDING_QUEUE.length} operaciones...`);
  const retry=[...PENDING_QUEUE];
  PENDING_QUEUE=[];
  savePendingQueue();
  let fail=0;
  for(const item of retry){
    const res=await postSheets(item.payload);
    if(!res.ok){ PENDING_QUEUE.push(item); fail++; continue; }
    if(item.operation==="create"){
      const aud=DB.auditorias.find(a=>a.client_request_id===item.client_request_id);
      const serverId=res.data?.id;
      if(aud && serverId){ aud.id=serverId; aud.id_auditoria=serverId; aud.sheets_enviado=true; }
    } else if(item.operation==="upsert_productividad"){
      const payload=item.payload;
      const idx=DB.productividadSemanal.findIndex(p=>p.agente===payload.agente&&Number(p.anio)===Number(payload.anio)&&Number(p.semana)===Number(payload.semana));
      if(idx>=0) DB.productividadSemanal[idx]={...DB.productividadSemanal[idx],sheets_enviado:true};
    }
  }
  savePendingQueue();
  renderRegistros(); renderDashboard();
  if(fail===0) hideSync(`✓ Todos sincronizados`);
  else hideSync(`⚠ ${fail} operaciones aún pendientes`,3000,true);
}
// Inicialización de la app
function initVersionBadge() {
  const span    = document.getElementById('sidebarVersion');
  const btn     = document.getElementById('sidebarVersionBtn');
  const popover = document.getElementById('versionPopover');
  if (!span) return;
  span.textContent = `v${VERSION.number}`;
  if (!btn || !popover || typeof CHANGELOG === 'undefined' || !CHANGELOG.length) return;
  popover.innerHTML = CHANGELOG.map(c =>
    `<div style="margin-bottom:7px;">` +
      `<span style="font-weight:600;font-size:13px;">v${c.v}</span>` +
      `<span style="color:var(--muted);font-size:12px;margin-left:6px;">${c.date}</span>` +
      `<div style="font-size:13px;color:var(--text);margin-top:1px;">${c.desc}</div>` +
    `</div>`
  ).join('');
  btn.style.cursor = 'pointer';
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    popover.style.display = popover.style.display !== 'none' ? 'none' : 'block';
  });
  document.addEventListener('click', function() { popover.style.display = 'none'; });
}

function initMobileSidebar() {
  const toggle  = document.getElementById('sidebarToggle');
  const overlay = document.getElementById('sidebarOverlay');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !overlay || !sidebar) return;
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('visible');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  });
}

(function init(){
  if(!requireAuth()) return;
  renderSidebarUser();
  initTheme();
  initVersionBadge();
  initMobileSidebar();
  loadPendingQueue();
  applyRoleRestrictions();
  const today=new Date().toISOString().slice(0,10);
  document.getElementById("f-fecha").value=today;
  onFechaChange();
  populateSelects();
  reloadFromSheets();
})();
