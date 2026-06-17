// ================================================================
// AUTH — sesión de usuario, guards y modal de contraseña
// ================================================================

window.escapeHtml = function (str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
};

(function () {
  function _key() {
    return (window.CONFIG && CONFIG.AUTH && CONFIG.AUTH.SESSION_KEY) || 'auditcs_session';
  }
  function _ttl() {
    return (window.CONFIG && CONFIG.AUTH && CONFIG.AUTH.SESSION_TTL_MS) || 28800000;
  }

  // ── Session ──────────────────────────────────────────────────
  window.getSession = function () {
    try {
      const raw = localStorage.getItem(_key());
      if (!raw) return null;
      const s = JSON.parse(raw);
      // Sesión inválida si expiró o no tiene user/token (sesión rota)
      if (Date.now() > s.expiresAt || !s.user || !s.sessionToken) {
        localStorage.removeItem(_key());
        return null;
      }
      return s;
    } catch { return null; }
  };

  window.setSession = function (user, sessionToken) {
    localStorage.setItem(_key(), JSON.stringify({
      user,
      sessionToken: sessionToken || null,
      loggedInAt:   Date.now(),
      expiresAt:    Date.now() + _ttl(),
    }));
  };

  window.getSessionToken = function () {
    const s = getSession();
    return s ? (s.sessionToken || null) : null;
  };

  window.authLogout = async function () {
    const token = getSessionToken();
    localStorage.removeItem(_key());
    if (token && window.callApiRaw) {
      try { await callApiRaw({ _type: 'logout', sessionToken: token }); } catch (_) {}
    }
    window.location.href = 'login.html';
  };

  // ── Guards ───────────────────────────────────────────────────
  window.requireAuth = function () {
    if (!getSession()) { window.location.href = 'login.html'; return false; }
    return true;
  };

  // ── Chip de usuario en sidebar footer ───────────────────────
  window.renderUserChip = function () {
    const s = getSession();
    if (!s) return;
    const u = s.user;
    const footer = document.querySelector('.sidebar-footer');
    if (!footer) return;
    const chip = document.createElement('div');
    chip.id = 'user-chip';
    chip.innerHTML =
      `<div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(u.name || u.email)}</div>` +
      `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(u.email)}</div>` +
      `<div style="display:flex;gap:6px">` +
        `<button class="btn xs" onclick="openChangePasswordModal()" style="flex:1">Clave</button>` +
        `<button class="btn xs danger" onclick="authLogout()" style="flex:1">Salir</button>` +
      `</div>`;
    footer.appendChild(chip);
  };

  // ── Modal: cambiar contraseña ────────────────────────────────
  window.openChangePasswordModal = function () {
    _ensureModal();
    document.getElementById('_authModal').style.display = 'flex';
    document.getElementById('_authPwdNew').focus();
  };

  function _ensureModal() {
    if (document.getElementById('_authModal')) return;
    const modal = document.createElement('div');
    modal.id = '_authModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.18);padding:28px 32px;width:100%;max-width:380px;font-family:inherit;">
        <h3 style="font-size:15px;font-weight:700;margin:0 0 18px">Cambiar contraseña</h3>
        <div style="margin-bottom:14px">
          <label style="display:block;font-size:13px;font-weight:500;margin-bottom:5px">Nueva contraseña</label>
          <input id="_authPwdNew" type="password" placeholder="Mínimo 6 caracteres"
            style="width:100%;padding:8px 12px;font-size:13.5px;border:1px solid #e5e7eb;border-radius:6px;box-sizing:border-box;font-family:inherit"/>
        </div>
        <div style="margin-bottom:6px">
          <label style="display:block;font-size:13px;font-weight:500;margin-bottom:5px">Confirmar</label>
          <input id="_authPwdConfirm" type="password" placeholder="Repetí la contraseña"
            style="width:100%;padding:8px 12px;font-size:13.5px;border:1px solid #e5e7eb;border-radius:6px;box-sizing:border-box;font-family:inherit"/>
        </div>
        <div id="_authPwdErr" style="display:none;margin:10px 0;padding:9px 13px;border-radius:6px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:13px"></div>
        <div id="_authPwdOk"  style="display:none;margin:10px 0;padding:9px 13px;border-radius:6px;background:#ecfdf5;border:1px solid #a7f3d0;color:#0a7040;font-size:13px">Contraseña actualizada.</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
          <button id="_authPwdCancel" style="padding:7px 16px;border-radius:6px;border:1px solid #e5e7eb;background:#fff;color:#374151;font-size:13px;font-weight:500;cursor:pointer">Cancelar</button>
          <button id="_authPwdSave"   style="padding:7px 16px;border-radius:6px;border:0;background:var(--primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    function _close() {
      modal.style.display = 'none';
      ['_authPwdNew','_authPwdConfirm'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('_authPwdErr').style.display = 'none';
      document.getElementById('_authPwdOk').style.display  = 'none';
      const btn = document.getElementById('_authPwdSave');
      btn.disabled = false; btn.textContent = 'Guardar';
    }

    document.getElementById('_authPwdCancel').addEventListener('click', _close);
    modal.addEventListener('click', e => { if (e.target === modal) _close(); });

    document.getElementById('_authPwdSave').addEventListener('click', async () => {
      const pwd1  = document.getElementById('_authPwdNew').value;
      const pwd2  = document.getElementById('_authPwdConfirm').value;
      const errEl = document.getElementById('_authPwdErr');
      const okEl  = document.getElementById('_authPwdOk');
      errEl.style.display = okEl.style.display = 'none';
      if (pwd1.length < 6) { errEl.textContent = 'Mínimo 6 caracteres.'; errEl.style.display = ''; return; }
      if (pwd1 !== pwd2)   { errEl.textContent = 'Las contraseñas no coinciden.'; errEl.style.display = ''; return; }
      const btn = document.getElementById('_authPwdSave');
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        const s = getSession();
        if (!s) { errEl.textContent = 'Sesión expirada. Iniciá sesión nuevamente.'; errEl.style.display = ''; return; }
        const passwordHash = await sha256(pwd1);
        await callApiRaw({ _type: 'updateUser', email: s.user.email, passwordHash, sessionToken: s.sessionToken });
        okEl.style.display = '';
        ['_authPwdNew','_authPwdConfirm'].forEach(id => document.getElementById(id).value = '');
        setTimeout(_close, 1800);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = '';
      } finally {
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    });
  }

  // ── SHA-256 ──────────────────────────────────────────────────
  window.sha256 = async function (str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  };
})();
