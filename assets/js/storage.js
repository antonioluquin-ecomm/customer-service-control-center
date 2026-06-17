// ================================================================
// STORAGE — persistencia en localStorage
// ================================================================
function loadPendingQueue(){
  try{ const s=localStorage.getItem("auditcs_pending"); if(s) PENDING_QUEUE=JSON.parse(s); }catch(e){}
  updateOfflineBadge();
}
function savePendingQueue(){
  try{ localStorage.setItem("auditcs_pending",JSON.stringify(PENDING_QUEUE)); }catch(e){}
  updateOfflineBadge();
}
function updateOfflineBadge(){
  const b=document.getElementById("offline-badge");
  const btn=document.getElementById("btn-retry-sync");
  if(!b) return;
  const n=PENDING_QUEUE.length;
  if(n>0){ b.textContent=n; b.classList.add("show"); if(btn) btn.style.display=""; }
  else { b.classList.remove("show"); if(btn) btn.style.display="none"; }
}

function loadLocalCfg(){
  try{ const s=localStorage.getItem(CFG_KEY); if(s){ const p=JSON.parse(s); if(p.sheets_url) CFG.sheets_url=p.sheets_url; } }catch(e){}
}
function persistUrl(){ try{ localStorage.setItem(CFG_KEY,JSON.stringify({sheets_url:CFG.sheets_url})); }catch(e){} }
function getNextId_local(){ try{ return parseInt(localStorage.getItem("auditcs_nextid"))||1; }catch(e){ return DB.nextId||1; } }
function persistNextId(){ try{ localStorage.setItem("auditcs_nextid",String(DB.nextId)); }catch(e){} }
