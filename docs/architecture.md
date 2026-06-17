# Arquitectura — AuditCS

## Vistas (6 páginas)

| ID | Título | Descripción |
|----|--------|-------------|
| `dashboard` | Dashboard | KPIs del equipo, ranking, evolución semanal (Chart.js), heatmap agente×semana, criterios con mayor incumplimiento, alertas score < 70% |
| `formulario` | Nueva Auditoría | Wizard de 5 pasos: Datos generales → Calidad (criterios) → Productividad → Observaciones → Resumen + Submit |
| `registros` | Registros | Tabla filtrable (agente, estado, mes, semana, búsqueda libre) + exportación CSV |
| `observaciones` | Observaciones | Tarjetas de desvíos con estado, acción correctiva y filtros |
| `agentes` | Agentes | Ranking del equipo + detalle de criterios incumplidos por agente |
| `configuracion` | Configuración | URL de Sheets, agentes, auditores, pesos calidad/productividad, criterios de calidad |

---

## Módulos JavaScript (`assets/js/`)

Los scripts se cargan en este orden en `index.html`. El orden es crítico — módulos posteriores dependen de variables declaradas por los anteriores.

| Orden | Archivo | Responsabilidad | Variables / Funciones clave |
|-------|---------|-----------------|------------------------------|
| 1 | `config.js` | Constantes y defaults | `CFG_KEY`, `CFG`, `CRITERIOS`, `CRITERIOS_DEFAULT` |
| 2 | `state.js` | Estado mutable global | `DB`, `PENDING_QUEUE`, `_criteriosSnapshot`, `_sTimer`, `_charts` |
| 3 | `storage.js` | Persistencia localStorage | `loadPendingQueue`, `savePendingQueue`, `loadLocalCfg`, `persistUrl`, `getNextId_local`, `persistNextId`, `updateOfflineBadge` |
| 4 | `calculations.js` | Cálculos puros | `avg`, `getUMB`, `calcEstado`, `calcGeneral`, `calcObjetivo`, `activeCriterios`, `getISOWeek`, `onFechaChange` |
| 5 | `api.js` | Comunicación con Sheets | `go`, `postSheets`, `reloadFromSheets`, `applyCfg`, `testSheets`, `syncConfigToSheets` |
| 6 | `ui.js` | Navegación y UI | `v`, `showSync`, `hideSync`, `showPage`, `populateSelects`, `populateObsFilters`, `updateSheetsUI` |
| 7 | `forms.js` | Wizard de auditoría | `goStep`, `validateStep1/2/3`, `makeCriterioRow`, `renderCriterios`, `submitAuditoria`, `resetForm` |
| 8 | `dashboard.js` | Dashboard y agentes | `getDashFiltered`, `renderDashboard`, `renderAgentes`, `renderAgentDetail` |
| 9 | `records.js` | Registros y observaciones | `renderRegistros`, `renderObservaciones`, `deleteAuditoria`, `exportCSV` |
| 10 | `settings.js` | Configuración | `renderConfigPage`, `saveConfig`, `saveCriterios`, `addAgente/removeAgente`, `addAuditor/removeAuditor` |
| 11 | `main.js` | Entry point | `retrySyncPending`, IIFE `init` |

---

## Estado global

```
CFG          — configuración activa (agentes, auditores, pesos, umbrales)
DB           — { auditorias: [], nextId: 1 }
CRITERIOS    — array de 12 criterios de calidad (modificable desde Sheets)
PENDING_QUEUE — auditorías pendientes de sincronizar (cola offline)
_criteriosSnapshot — snapshot de CRITERIOS al iniciar el paso 2 del formulario
                     (evita que un cambio de config afecte una auditoría en curso)
```

### localStorage (3 keys)

| Key | Contenido |
|-----|-----------|
| `auditcs_cfg_v5` | `{ sheets_url }` — URL del Apps Script desplegado |
| `auditcs_pending` | JSON array de la cola offline |
| `auditcs_nextid` | Contador de ID local (respaldo cuando no hay conexión) |

---

## Flujo de datos

```
[index.html carga]
  → init() en main.js
    → loadLocalCfg()       — lee auditcs_cfg_v5 de localStorage
    → loadPendingQueue()   — lee auditcs_pending de localStorage
    → populateSelects()    — rellena dropdowns con CFG.agentes / CFG.auditores
    → reloadFromSheets()   — 4 GETs en paralelo a Apps Script
        ├─ get_config     → applyCfg() → actualiza CFG
        ├─ get_auditorias → DB.auditorias = [...]
        ├─ get_detalle    → adjunta criterios a cada auditoría
        └─ get_criterios  → CRITERIOS = [...]

[Usuario completa formulario]
  → submitAuditoria()
    → postSheets(payload)
        ├─ OK  → aud.sheets_enviado = true
        └─ Error → PENDING_QUEUE.push(payload) → savePendingQueue()

[Usuario retoma conexión]
  → retrySyncPending()
    → postSheets() para cada item de PENDING_QUEUE
```

---

## Módulos CSS (`assets/css/`)

| Archivo | Contenido |
|---------|-----------|
| `variables.css` | Tokens del ecosistema (`--primary`, `--success`, `--danger`), aliases de retrocompatibilidad, espaciado, radios, sombras, Google Fonts |
| `base.css` | Reset, `body`, `.hidden`, loading overlay, sync-bar, animaciones |
| `layout.css` | `.shell` (grid), `.sidebar`, `.nav`, `.main`, `.page`, `.topbar` |
| `components.css` | `.btn`, `.card`, inputs, tabla, badges, alerts, toggle, avatar |
| `dashboard.css` | `.db-*`, heatmap `.db-hm-*`, chart, ranking, criterios, alertas |
| `forms.css` | Wizard `.form-progress`, pasos `.form-step`, criterios, resumen |
| `responsive.css` | `@media` (max-width: 900px) y (max-width: 600px) |

---

## Esquema Google Sheets (8 hojas)

| Hoja | Descripción |
|------|-------------|
| `auditorias` | Una fila por auditoría con todos los campos de header (28 columnas) |
| `detalle_calidad` | Una fila por criterio evaluado (`id_detalle`, `id_auditoria`, resultado) |
| `productividad` | Detalle de interacciones, puntualidad y presentismo por auditoría |
| `observaciones` | Observaciones y acciones correctivas con estado de seguimiento |
| `log_envios` | Log de todas las operaciones POST/DELETE |
| `configuracion` | Parámetros key/value del sistema (agentes, pesos, umbrales) |
| `log_configuracion` | Historial de cambios de configuración |
| `criterios_calidad` | Definición y pesos de los 12 criterios de calidad |

Ver [`apps-script.md`](apps-script.md) para el detalle completo de endpoints y payloads.
