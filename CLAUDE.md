# AuditCS — Instrucciones para Claude Code y Codex

> Las reglas generales y los docs maestros están en `../project-standards/` (`ai_rules.md`, `style_guide.md`, `apps_script_standards.md`).
> Este archivo contiene solo lo específico de este proyecto.

---

## Reglas activas — específicas de este proyecto

- **No hacer push** sin confirmación explícita del usuario.
- **No tocar la lógica de sincronización offline** sin auditoría previa — maneja el queue de localStorage y la sincronización con Google Sheets.
- **Chart.js 4.4.1**: no actualizar la versión sin revisar breaking changes en los gráficos del dashboard.
- **Orden de carga de scripts**: crítico — los módulos se cargan en orden explícito en `index.html`. Ver `docs/architecture.md` antes de agregar scripts.
- **No renombrar columnas ni pestañas del Sheet** sin revisar todos los parsers.

---

## Stack específico

- **Sin framework** — HTML/CSS/Vanilla JS, sin dependencias de build
- **Auth por sesión + RBAC flexible** — login con SHA-256, sesión en `localStorage` (`acs_session`) y hoja `SESIONES`; permisos por módulo (`canView`/`canEdit`) según `id_rol`. Ver `login_standard.md` y `docs/apps-script-deploy.md`
- **Backend**: Google Apps Script vía `fetch` como backend/middleware (9 archivos `.gs`, ver `docs/apps-script.md`)
- **Base de datos**: Google Sheets
- **Hosting**: GitHub Pages (frontend estático)
- **Visualizaciones**: Chart.js 4.4.1

---

## Estructura del proyecto

```
/
├─ index.html              Aplicación SPA principal
├─ assets/
│  ├─ js/                  Módulos JavaScript (orden de carga crítico)
│  └─ css/                 Estilos
├─ apps-script/            Código del backend GAS (fuente de verdad del repo)
└─ docs/                   Documentación técnica y operativa
```

---

## Versionado

Usar commits descriptivos con prefijo convencional (`feat:`, `fix:`, `style:`, `refactor:`, `docs:`). No crear sistema de versión embebido sin consultar.

---

## Documentación estándar compartida

La documentación estándar compartida se encuentra en `../project-standards/`:

- [`../project-standards/ai_rules.md`](../project-standards/ai_rules.md) — reglas de colaboración con IA
- [`../project-standards/style_guide.md`](../project-standards/style_guide.md) — colores, tipografía, componentes CSS, Git
- [`../project-standards/apps_script_standards.md`](../project-standards/apps_script_standards.md) — convenciones GAS
- [`../project-standards/google_sheets_standards.md`](../project-standards/google_sheets_standards.md) — estructura de Sheets
- [`../project-standards/login_standard.md`](../project-standards/login_standard.md) — patrón de autenticación
- [`../project-standards/application_shell.md`](../project-standards/application_shell.md) — shell de aplicación

### Entorno de trabajo

- El desarrollo se realiza desde `C:\Users\gluna\Documents\Repos`
- No usar OneDrive/SharePoint como carpeta de desarrollo
- GitHub es la fuente principal para versionado y colaboración
- OneDrive/SharePoint queda reservado para documentación funcional: archivos compartidos, PDFs, presentaciones, actas e imágenes
