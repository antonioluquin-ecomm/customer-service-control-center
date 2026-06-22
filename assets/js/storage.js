// ================================================================
// STORAGE — persistencia de operaciones offline en localStorage
// ================================================================
function createClientRequestId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizePendingItem(item) {
  if (item?.operation && item.payload) return item;
  const clientRequestId = item?.client_request_id || createClientRequestId();
  return {
    operation: "create",
    client_request_id: clientRequestId,
    payload: { ...item, _type: "create_auditoria", client_request_id: clientRequestId },
  };
}

function loadPendingQueue() {
  try {
    const raw = localStorage.getItem("auditcs_pending");
    if (raw) PENDING_QUEUE = JSON.parse(raw).map(normalizePendingItem);
  } catch(e) { PENDING_QUEUE = []; }
  savePendingQueue();
}

function savePendingQueue() {
  try { localStorage.setItem("auditcs_pending", JSON.stringify(PENDING_QUEUE)); } catch(e) {}
  updateOfflineBadge();
}

function queuePendingCreate(auditoria) {
  PENDING_QUEUE.push({
    operation: "create",
    client_request_id: auditoria.client_request_id,
    payload: { ...auditoria, _type: "create_auditoria" },
  });
  savePendingQueue();
}

function queuePendingDelete(id) {
  if (PENDING_QUEUE.some(item => item.operation === "delete" && item.payload.id_auditoria === id)) return;
  PENDING_QUEUE.push({ operation: "delete", payload: { _type: "delete_auditoria", id_auditoria: id } });
  savePendingQueue();
}

function removePendingCreate(clientRequestId) {
  PENDING_QUEUE = PENDING_QUEUE.filter(item => !(item.operation === "create" && item.client_request_id === clientRequestId));
  savePendingQueue();
}

function pendingCreatePayloads() {
  return PENDING_QUEUE.filter(item => item.operation === "create").map(item => item.payload);
}

function updateOfflineBadge() {
  const b = document.getElementById("offline-badge");
  const btn = document.getElementById("btn-retry-sync");
  if (!b) return;
  const n = PENDING_QUEUE.length;
  if (n > 0) { b.textContent = n; b.classList.add("show"); if (btn) btn.style.display = ""; }
  else { b.classList.remove("show"); if (btn) btn.style.display = "none"; }
}

function getNextId_local() { return 1; }
function persistNextId() {}