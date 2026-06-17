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
(function init(){
  if(!requireAuth()) return;
  loadPendingQueue();
  renderUserChip();
  const today=new Date().toISOString().slice(0,10);
  document.getElementById("f-fecha").value=today;
  onFechaChange();
  populateSelects();
  reloadFromSheets();
})();
