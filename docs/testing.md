# Testing — AuditCS

Ejecutar desde la raíz del proyecto:

```powershell
node tests/run-tests.js
```

El runner cubre cálculos de score, semanas ISO, migración de la cola offline y asignación secuencial de IDs en Apps Script. No requiere dependencias externas.

## Métricas de sincronización

El frontend mantiene en `localStorage` la clave `auditcs_sync_metrics` con contadores de éxito, errores HTTP, errores de API y fallos de red, más el último resultado y su timestamp. Los eventos persistentes del backend continúan registrados en la hoja `log_envios`.