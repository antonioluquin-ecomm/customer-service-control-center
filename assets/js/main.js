// ================================================================
// MAIN — entry point e inicialización
// ================================================================

// Reintenta enviar a Sheets los registros que quedaron en la cola offline
async function retrySyncPending(){
  if(!PENDING_QUEUE.length){ alert("No hay registros pendientes."); return; }
  showSync(`Reintentando ${PENDING_QUEUE.length} registros...`);
  const retry=[...PENDING_QUEUE];
  PENDING_QUEUE=[];
  savePendingQueue();
  let fail=0;
  for(const payload of retry){
    const res=await postSheets(payload);
    if(!res.ok){ PENDING_QUEUE.push(payload); fail++; }
    else {
      const aud=DB.auditorias.find(a=>a.id_auditoria===payload.id_auditoria);
      if(aud) aud.sheets_enviado=true;
    }
  }
  savePendingQueue();
  renderRegistros();
  if(fail===0) hideSync(`✓ Todos sincronizados`);
  else hideSync(`⚠ ${fail} registros aún pendientes`,3000,true);
}

// Inicialización de la app
function initSidebarVersion() {
  const el = document.getElementById('brandMeta');
  if (el && typeof VERSION !== 'undefined') {
    el.textContent = `Customer Service · v${VERSION.number}`;
  }
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
  initSidebarVersion();
  initMobileSidebar();
  loadPendingQueue();
  renderUserChip();
  applyRoleRestrictions();
  const today=new Date().toISOString().slice(0,10);
  document.getElementById("f-fecha").value=today;
  onFechaChange();
  populateSelects();
  reloadFromSheets();
})();
