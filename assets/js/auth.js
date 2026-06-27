// ================================================================
// AUTH — sesión de usuario, RBAC flexible, guards y modal de contraseña
// ================================================================

window.escapeHtml = function (str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
};

(function () {

  // ── Permisos por defecto (usados hasta que el backend devuelva permisos) ──
  // Clave: id_rol — 1=admin, 2=supervisor, 3=auditor, 4=agente
  var _PERMISOS = {
    1: { dashboard:{ver:true,editar:true},  formulario:{ver:true,editar:true},  productividad:{ver:true,editar:true},  registros:{ver:true,editar:true},  observaciones:{ver:true,editar:true},  agentes:{ver:true,editar:true},  configuracion:{ver:true,editar:true}  },
    2: { dashboard:{ver:true,editar:false}, formulario:{ver:true,editar:true},  productividad:{ver:true,editar:true},  registros:{ver:true,editar:true},  observaciones:{ver:true,editar:false}, agentes:{ver:true,editar:false}, configuracion:{ver:false,editar:false} },
    3: { dashboard:{ver:true,editar:false}, formulario:{ver:true,editar:true},  productividad:{ver:false,editar:false}, registros:{ver:true,editar:true},  observaciones:{ver:true,editar:false}, agentes:{ver:true,editar:false}, configuracion:{ver:false,editar:false} },
    4: { dashboard:{ver:true,editar:false}, formulario:{ver:true,editar:false}, productividad:{ver:false,editar:false}, registros:{ver:true,editar:false}, observaciones:{ver:true,editar:false}, agentes:{ver:true,editar:false}, configuracion:{ver:false,editar:false} },
  };

  function _getPermisos() {
    const s = getSession();
    if (!s) return _PERMISOS[4]; // sin sesión → acceso mínimo
    if (s.permisos) return s.permisos;
    return _PERMISOS[Number(s.usuario.id_rol)] || _PERMISOS[4];
  }

  // ── Claves de storage ────────────────────────────────────────
  var _SESSION_KEY = 'acs_session';
  var _SESSION_KEY_OLD = 'auditcs_session';

  function _ttl() {
    return (window.CONFIG && CONFIG.AUTH && CONFIG.AUTH.SESSION_TTL_MS) || 28800000;
  }

  function _loginPath() {
    const tag = document.querySelector('script[src*="config.js"]');
    if (tag) {
      const src = tag.getAttribute('src');
      return src.replace('config.js', '').replace('assets/js/', '') + 'login.html';
    }
    const depth = window.location.pathname.split('/').filter(Boolean).length - 1;
    return '../'.repeat(Math.max(0, depth)) + 'login.html';
  }

  // ── Normalización de shape ───────────────────────────────────
  // Convierte sesión vieja {user, sessionToken, expiresAt} → nuevo shape
  function _normalize(s) {
    if (!s) return null;
    // Ya tiene shape nuevo
    if (s.usuario && s.expira_en) {
      if (new Date(s.expira_en) < new Date()) return null;
      return s;
    }
    // Shape viejo: { user:{name,email,role}, sessionToken, expiresAt }
    if (s.user && s.expiresAt) {
      if (Date.now() > s.expiresAt) return null;
      const roleMap = { admin:1, supervisor:2, auditor:3, agente:4 };
      const id_rol = roleMap[String(s.user.role || '').toLowerCase()] || 4;
      return {
        session_token: s.sessionToken || null,
        usuario: {
          id: null,
          nombre: s.user.name || s.user.email,
          email:  s.user.email,
          id_rol,
          nombre_rol: _roleLabel(id_rol),
        },
        permisos:  null,
        expira_en: new Date(s.expiresAt).toISOString(),
      };
    }
    return null;
  }

  // ── Session ──────────────────────────────────────────────────
  window.getSession = function () {
    try {
      // Intenta clave nueva; si no, fallback a clave vieja
      let raw = localStorage.getItem(_SESSION_KEY) || localStorage.getItem(_SESSION_KEY_OLD);
      if (!raw) return null;
      return _normalize(JSON.parse(raw));
    } catch { return null; }
  };

  // Acepta los parámetros viejos (user, sessionToken) por compatibilidad con login.html actual
  window.setSession = function (userOrObj, sessionToken) {
    const u = userOrObj;
    const roleMap = { admin:1, supervisor:2, auditor:3, agente:4 };
    const id_rol = u.id_rol || roleMap[String(u.role || '').toLowerCase()] || 4;
    const session = {
      session_token: sessionToken || u.session_token || null,
      usuario: {
        id:         u.id   || null,
        nombre:     u.nombre || u.name || u.email,
        email:      u.email,
        id_rol,
        nombre_rol: u.nombre_rol || _roleLabel(id_rol),
      },
      permisos:  u.permisos || null,
      expira_en: u.expira_en || new Date(Date.now() + _ttl()).toISOString(),
    };
    localStorage.setItem(_SESSION_KEY, JSON.stringify(session));
    localStorage.removeItem(_SESSION_KEY_OLD); // migración limpia
  };

  window.getSessionToken = function () {
    const s = getSession();
    return s ? (s.session_token || null) : null;
  };

  // ── RBAC ─────────────────────────────────────────────────────
  window.isAdmin = function () {
    return Number(getSession()?.usuario?.id_rol) === 1;
  };

  window.canView = function (mod) {
    if (isAdmin()) return true;
    const p = _getPermisos();
    return p[mod] ? p[mod].ver : false; // módulos sin definición: denegado por defecto
  };

  window.canEdit = function (mod) {
    if (isAdmin()) return true;
    const p = _getPermisos();
    return p[mod] ? p[mod].editar : false;
  };

  // Alias retrocompatible: antes chequeaba role string, ahora usa permisos
  window.canDeleteAuditorias = function () {
    return canEdit('registros');
  };

  // ── Guards ───────────────────────────────────────────────────
  window.requireAuth = function () {
    if (!getSession()) { window.location.href = _loginPath(); return false; }
    return true;
  };

  window.requireAdmin = function () {
    if (!getSession() || !isAdmin()) { window.location.href = _loginPath(); return false; }
    return true;
  };

  // Deshabilita .admin-only si el usuario no es admin
  window.restrictWriteIfAgent = function () {
    const admin = isAdmin();
    document.body.classList.toggle('no-edit', !admin);
    document.querySelectorAll('.admin-only').forEach(function (el) {
      el.disabled = !admin;
      if (!admin) {
        el.classList.add('agent-disabled');
        el.title = 'No tenés permisos para esta acción';
      } else {
        el.classList.remove('agent-disabled');
      }
    });
  };

  // ── Etiqueta de rol ──────────────────────────────────────────
  function _roleLabel(idRol) {
    const map = { 1:'Administrador', 2:'Supervisor', 3:'Auditor', 4:'Agente' };
    return map[Number(idRol)] || 'Usuario';
  }

  // ── Helpers: dropdown de usuario en sidebar ──────────────────
  function _openUserDropdown() {
    var drop = document.getElementById('user-dropdown');
    var chip = document.getElementById('sidebar-user-chip');
    if (!drop || !chip) return;
    var rect = chip.getBoundingClientRect();
    drop.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
    drop.style.left   = rect.left + 'px';
    drop.style.width  = rect.width + 'px';
    drop.style.display = 'block';
    chip.setAttribute('aria-expanded', 'true');
    chip.classList.add('open');
  }

  function _closeUserDropdown() {
    var drop = document.getElementById('user-dropdown');
    var chip = document.getElementById('sidebar-user-chip');
    if (drop) drop.style.display = 'none';
    if (chip) { chip.setAttribute('aria-expanded', 'false'); chip.classList.remove('open'); }
  }

  // ── Chip de usuario en sidebar footer ────────────────────────
  window.renderSidebarUser = function () {
    var s = getSession();
    if (!s) return;
    var u      = s.usuario;
    var footer = document.querySelector('.sidebar-footer');
    if (!footer) return;
    if (document.getElementById('sidebar-user-chip')) return;

    var initials = (u.nombre || u.email || '?')
      .trim().split(/\s+/).slice(0, 2).map(function(w){ return w[0] || ''; }).join('').toUpperCase().slice(0, 2) || '?';

    var chip = document.createElement('div');
    chip.id = 'sidebar-user-chip';
    chip.className = 'user-chip';
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-haspopup', 'true');
    chip.setAttribute('aria-expanded', 'false');
    chip.setAttribute('title', u.nombre || u.email);
    chip.innerHTML =
      '<div class="user-chip-info">' +
        '<span class="user-chip-name">' + escapeHtml(u.nombre || u.email) + ' <span class="user-chip-chevron" aria-hidden="true">▾</span></span>' +
        '<span class="user-chip-role">' + escapeHtml(_roleLabel(u.id_rol)) + '</span>' +
      '</div>';
    chip.addEventListener('click', function (e) {
      e.stopPropagation();
      var drop = document.getElementById('user-dropdown');
      if (drop && drop.style.display !== 'none') { _closeUserDropdown(); }
      else { _openUserDropdown(); }
    });
    footer.appendChild(chip);

    if (!document.getElementById('user-dropdown')) {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      var drop = document.createElement('div');
      drop.id = 'user-dropdown';
      drop.className = 'user-dropdown';
      drop.setAttribute('role', 'menu');
      drop.style.display = 'none';
      drop.innerHTML =
        '<div class="user-dropdown-header">' +
          '<div class="sidebar-user-name">' + escapeHtml(u.nombre || u.email) + '</div>' +
          '<div class="sidebar-user-email">' + escapeHtml(u.email) + '</div>' +
          '<div class="sidebar-user-meta"><span class="auth-chip-role">' + escapeHtml(_roleLabel(u.id_rol)) + '</span></div>' +
        '</div>' +
        '<div class="user-dropdown-sep"></div>' +
        '<button class="user-dropdown-item theme-toggle" type="button" onclick="toggleTheme()">' +
          '<span class="th-icon">' + (isDark ? '☀' : '☾') + '</span>' +
          '<span class="th-label">' + (isDark ? 'Modo claro' : 'Modo oscuro') + '</span>' +
        '</button>' +
        '<div class="user-dropdown-sep"></div>' +
        '<button class="user-dropdown-item" type="button" onclick="openChangePasswordModal()">Cambiar contraseña</button>' +
        '<div class="user-dropdown-sep"></div>' +
        '<button class="user-dropdown-item danger" type="button" onclick="authLogout()">Cerrar sesión</button>';
      drop.addEventListener('click', function (e) { e.stopPropagation(); });
      document.body.appendChild(drop);
    }

    document.addEventListener('click', _closeUserDropdown);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') _closeUserDropdown(); });
  };

  window.renderUserChip = window.renderSidebarUser; // retrocompatibilidad

  // ── Logout ───────────────────────────────────────────────────
  window.authLogout = async function () {
    const token = getSessionToken();
    localStorage.removeItem(_SESSION_KEY);
    localStorage.removeItem(_SESSION_KEY_OLD);
    if (token && window.CONFIG) {
      try {
        await fetch(CONFIG.SCRIPT_URL, {
          method: 'POST', mode: 'cors',
          headers: {'Content-Type': 'text/plain;charset=utf-8'},
          body: JSON.stringify({ _type: 'logout', sessionToken: token }),
        });
      } catch (_) {}
    }
    window.location.href = _loginPath();
  };

  // ── Refresh de permisos en background ────────────────────────
  // Llama getPermisos al GAS y actualiza session.permisos en localStorage.
  // No bloquea: si falla, se mantienen los permisos guardados en sesión.
  window.refreshPermisos = async function () {
    const s = getSession();
    if (!s || !s.session_token || !window.CONFIG) return;
    try {
      const res = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST', mode: 'cors',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify({ _type: 'getPermisos', sessionToken: s.session_token }),
      });
      const data = await res.json().catch(() => null);
      if (!data || data.status !== 'ok' || !data.permisos) return;
      s.permisos = data.permisos;
      localStorage.setItem(_SESSION_KEY, JSON.stringify(s));
      if (window.applyRoleRestrictions) applyRoleRestrictions();
    } catch (_) {}
  };

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
