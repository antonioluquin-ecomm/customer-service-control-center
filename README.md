# AuditCS — Customer Service Control Center

Herramienta interna de auditoría de calidad y productividad para equipos de atención al cliente.

## Stack

- HTML / CSS / Vanilla JS (sin frameworks)
- Google Apps Script como backend
- Google Sheets como base de datos
- GitHub Pages como hosting (frontend estático)
- Chart.js 4.4.1 para visualizaciones

## Funcionalidades

- **Dashboard**: KPIs, ranking del equipo, evolución semanal (Chart.js), heatmap agente×semana, criterios con mayor incumplimiento, alertas de score crítico
- **Formulario**: Wizard de 5 pasos para registrar auditorías (Datos → Calidad → Productividad → Observaciones → Resumen)
- **Registros**: Historial filtrable con exportación a CSV
- **Observaciones**: Seguimiento de desvíos y acciones correctivas
- **Agentes**: Ranking y detalle de criterios incumplidos por agente
- **Configuración**: Parámetros, agentes, auditores, pesos y criterios de calidad

## Modo offline

La herramienta funciona sin conexión. Las auditorías se guardan localmente en localStorage y se sincronizan con Google Sheets cuando la conexión se restaura.

## Estructura del proyecto

```
customer-service-control-center/
├── index.html          ← Aplicación principal
├── assets/
│   ├── css/            ← Estilos separados por módulo
│   └── js/             ← Módulos JavaScript
├── apps-script/
│   └── AppsScript.js   ← Backend Google Apps Script
└── docs/               ← Documentación técnica
```

## Setup

Ver [`docs/setup.md`](docs/setup.md) para instrucciones de configuración del Apps Script y primera conexión.

## Pruebas

Ejecutar `node tests/run-tests.js` para validar cálculos, sincronización offline e IDs del backend.

## Versión

Ver [`CHANGELOG.md`](CHANGELOG.md) para el historial de versiones.
