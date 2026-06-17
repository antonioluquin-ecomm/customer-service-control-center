# Changelog — AuditCS Customer Service Control Center

## [1.0.0] — 2026-06-16

### Refactor estructural (sin cambios funcionales)

- Proyecto renombrado de `auditoria_cs_v12.html` a `index.html`
- Apps Script movido a `apps-script/AppsScript.js`
- Creación de estructura de carpetas: `assets/css/`, `assets/js/`, `apps-script/`, `docs/`
- Separación de CSS embebido en módulos bajo `assets/css/`
- Separación de JavaScript embebido en módulos bajo `assets/js/`
- Alineación de tokens CSS con el estándar del ecosistema interno
- Creación de documentación técnica en `docs/`

### Sin cambios en:
- Funcionalidad del dashboard, formulario, registros, observaciones, agentes y configuración
- Integración con Google Sheets / Apps Script
- Lógica de cálculo (calidad, productividad, score general)
- Cola offline y sincronización con localStorage
- Dependencias externas (Chart.js, Google Fonts)

---

## Historial previo (monolítico)

| Versión | Descripción |
|---------|-------------|
| v12.0 | Dashboard rediseñado, heatmap agente×semana, filtros KPI, alertas score < 70% |
| v11.x | Múltiples fixes de CORS, sincronización offline, snapshot de criterios |
| v7.x (GAS) | Backend estabilizado con lock, upsert config, delete con log, token de seguridad |
