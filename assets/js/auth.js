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

  // Ruta dinámica a login.html — funciona en subdirectorios y GitHub Pages.
  function _loginPath() {
    const tag = document.querySelector('script[src*="config.js"]');
    if (tag) {
      const src = tag.getAttribute('src');
      return src.replace('config.js', '').replace('assets/js/', '') + 'login.html';
    }
    const depth = window.location.pathname.split('/').filter(Boolean).length - 1;
    return '../'.repeat(Math.max(0, depth)) + 'login.html';
  }

  // ── Session ──────────────────────────────────────────────────
  window.getSession = function () {
    try {
      const raw = localStorage.getItem(_key());
      if (!raw) return null;
      const s = JSON.parse(raw);
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

  window.isAdmin = function () {
    return getSession()?.user?.role === 'admin';
  };

  window.canDeleteAuditorias = function () {
    const role = getSession()?.user?.role;
    return role === 'admin' || role === 'supervisor' || role === 'auditor';
  };

  window.authLogout = async function () {
    const token = getSessionToken();
    localStorage.removeItem(_key());
    if (token && window.callApiRaw) {
      try { await callApiRaw('logout', {}); } catch (_) {}
    }
    window.location.href = _loginPath();
  };

  // ── Guards ───────────────────────────────────────────────────
  window.requireAuth = function () {
    if (!getSession()) { window.location.href = _loginPath(); return false; }
    return true;
  };

  window.requireAdmin = function () {
    const s = getSession();
    if (!s || s.user.role !== 'admin') { window.location.href = _loginPath(); return false; }
    return true;
  };

  // Deshabilita todos los elementos .admin-only si el usuario es Agente.
  window.restrictWriteIfAgent = function () {
    if (isAdmin()) return;
    document.querySelectorAll('.admin-only').forEach(el => {
      el.disabled = true;
      el.title = 'Solo administradores pueden ejecutar esta acción';
      el.classList.add('agent-disabled');
    });
  };

  // Etiqueta legible del rol para el badge del sidebar.
  function _roleLabel(role) {
    const map = { admin: 'Administrador', supervisor: 'Supervisor', auditor: 'Auditor', agente: 'Agente' };
    if (!role) return 'Usuario';
    return map[String(role).toLowerCase()] || (String(role).charAt(0).toUpperCase() + String(role).slice(1));
  }

  // ── Panel de usuario en sidebar footer (application_shell.md §6.5) ──
  window.renderSidebarUser = function () {
    const s = getSession();
    if (!s) return;
    const u = s.user;
    const footer = document.querySelector('.sidebar-footer');
    if (!footer) return;
    if (document.getElementById('sidebar-user-info')) return; // evitar duplicados
    const info = document.createElement('div');
    info.id = 'sidebar-user-info';
    info.innerHTML =
      `<div class="sidebar-user-name">${escapeHtml(u.name || u.email)}</div>` +
      `<div class="sidebar-user-email">${escapeHtml(u.email)}</div>` +
      `<div class="sidebar-user-meta"><span class="auth-chip-role">${escapeHtml(_roleLabel(u.role))}</span></div>` +
      `<div class="sidebar-user-actions">` +
        `<button class="theme-toggle" type="button" onclick="toggleTheme()"><span class="th-icon">☾</span><span class="th-label">Modo oscuro</span></button>` +
        `<button class="sidebar-action-btn" type="button" onclick="openChangePasswordModal()">Cambiar contraseña</button>` +
        `<button class="sidebar-action-btn danger" type="button" onclick="authLogout()">Cerrar sesión</button>` +
      `</div>`;
    footer.appendChild(info);
  };

  // Alias de retrocompatibilidad.
  window.renderUserChip = window.renderSidebarUser;

  // ── Modal: cambiar contraseña ────────────────────────────────
  window.openChangePasswordModal = function () {
    _ensureModal();
    document.getElementById('_authModal').classList.add('open');
    document.getElementById('_authPwdNew').focus();
  };

  function _ensureModal() {
    if (document.getElementById('_authModal')) return;
    const modal = document.createElement('div');
    modal.id = '_authModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card">
        <h3>Cambiar contraseña</h3>
        <div class="modal-field">
          <label>Nueva contraseña</label>
          <input id="_authPwdNew" type="password" placeholder="Mínimo 6 caracteres"/>
        </div>
        <div class="modal-field">
          <label>Confirmar</label>
          <input id="_authPwdConfirm" type="password" placeholder="Repetí la contraseña"/>
        </div>
        <div id="_authPwdErr" class="alert error" style="display:none;margin:10px 0"></div>
        <div id="_authPwdOk"  class="alert success" style="display:none;margin:10px 0">Contraseña actualizada.</div>
        <div class="modal-actions">
          <button id="_authPwdCancel" class="btn">Cancelar</button>
          <button id="_authPwdSave"   class="btn primary">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    function _close() {
      modal.classList.remove('open');
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
        await callApiRaw('updateUser', { passwordHash });
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
