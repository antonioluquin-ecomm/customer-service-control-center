# Roadmap — AuditCS

Ideas para versiones futuras. Nada de esto está comprometido.

---

## Calidad de código

- Completar escape de datos de Sheets y formularios en todas las vistas (Sprint 2, realizado)
- **Event listeners** en JS en lugar de atributos `onclick/oninput` inline en HTML
- **Exportación por rango de fechas** en el CSV (actualmente exporta todo)

---

## Funcionalidades

- **Filtro por auditor** en Registros y Dashboard (actualmente solo filtra por agente)
- **Comparativa entre semanas** en Dashboard: ver tendencia semana actual vs anterior
- **Notificaciones** cuando un agente tiene 2+ auditorías consecutivas en "Observada"
- **Seguimiento de acciones correctivas**: marcar como resueltas desde la vista Observaciones
- **Paginación** en la tabla de Registros para datasets grandes
- **Buscador global** que cruce agente + ticket + ID de auditoría

---

## Configuración

- **Múltiples formularios de auditoría** por tipo de canal (Chat, Teléfono, Email con criterios distintos)
- **Importar/exportar configuración** completa en JSON (backup de parámetros y criterios)
- **Roles**: separar permisos de auditor (solo crea) vs supervisor (puede editar y eliminar)

---

## Infraestructura

- **Token de seguridad** configurable desde la propia UI (actualmente solo desde Apps Script)
- **Múltiples Spreadsheets** por período o por equipo
- **Webhook** para notificar por email o Slack cuando se registra una auditoría crítica (score < 70%)
