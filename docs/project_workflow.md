# Project Workflow — AuditCS (Customer Service Control Center)

| Campo | Detalle |
|-------|---------|
| Versión | v1.0 |
| Actualizado | 2026-06-25 |
| Estado | Activo |
| Documentos relacionados | `../project-standards/ai_rules.md` · `../project-standards/style_guide.md` · `CLAUDE.md` |

---

## 1. Propósito

Workflow operativo de AuditCS: herramienta de auditoría de atención al cliente con sincronización offline y visualizaciones. Las reglas genéricas de proceso viven en `../project-standards/project_workflow_template.md`.

---

## 2. Documentos maestros

| Necesito saber... | Ir a... |
|---|---|
| Reglas de colaboración con IA | `../project-standards/ai_rules.md` |
| Colores, CSS, Git | `../project-standards/style_guide.md` |
| Convenciones GAS | `../project-standards/apps_script_standards.md` |
| Arquitectura del proyecto | `docs/architecture.md` |
| Setup del GAS | `docs/setup.md` |
| Instrucciones específicas para Claude Code | `CLAUDE.md` |

---

## 3. Tipos de cambios y riesgo

| Tipo | Riesgo | Requiere |
|------|--------|----------|
| Documentación, labels, copy | Bajo | Commit claro |
| CSS, layout, tema | Bajo–Medio | Smoke visual |
| JS de módulo (filtros, tablas, render) | Medio | Smoke + consola |
| Gráficos Chart.js | Medio–Alto | Smoke con datos reales, verificar versión 4.4.1 |
| GAS backend, `assets/js/shared.js` | Alto | Auditoría previa |
| Lógica de sincronización offline (queue localStorage) | Crítico | Ver §7 |

---

## 4. Flujo de trabajo estándar

```
1. Descubrimiento  → entender problema, alcance, restricciones
2. Auditoría       → sin modificar archivos (cuando el alcance no está claro)
3. Implementación  → cambios pequeños, archivos explícitos, respetando orden de carga
4. Validación      → smoke, consola, datos reales si aplica
5. Documentación   → si hay cambio funcional o de arquitectura
6. Release         → push a main, verificar GitHub Pages
```

---

## 5. Flujo de release

1. Smoke del flujo principal: carga de datos → filtros → gráficos → estado de sync
2. Verificar que el queue de localStorage no se corrompe después del cambio
3. Commit con prefijo convencional
4. Push a `main`
5. Verificar GitHub Pages (2–3 min de propagación)

---

## 6. Checklist pre-push

```
[ ] index.html carga sin errores de consola
[ ] Gráficos Chart.js renderizan con datos (verificar versión 4.4.1)
[ ] Filtros aplican y el render es correcto
[ ] Estado de sincronización visible y coherente
[ ] Queue de localStorage intacto (no se vació ni corrompió)
[ ] Orden de carga de scripts no se modificó (ver docs/architecture.md)
```

---

## 7. Freeze zones

### 7.1 Zonas congeladas

| Zona | Razón |
|------|-------|
| Lógica de sincronización offline | Maneja el queue de `localStorage` y la sincronización con Google Sheets — cambio aquí puede perder datos no sincronizados |
| `Chart.js 4.4.1` (vendor local) | Versión bloqueada; actualizar sin revisar breaking changes rompe los gráficos |
| Orden de carga de scripts en `index.html` | Crítico — los módulos se cargan en orden explícito; agregar o mover scripts puede romper dependencias |
| Nombres de columnas y pestañas del Sheet | Los parsers dependen de los nombres exactos; renombrar rompe la sincronización |
| GAS backend | Lógica de negocio y escritura al Sheet |

### 7.2 Protocolo para freeze zones

1. Auditoría del módulo (sin modificar)
2. Leer `docs/architecture.md` antes de tocar el orden de carga de scripts
3. Implementar con archivos explícitos
4. Validar que el queue de sync no quedó vacío ni en estado inconsistente
5. Documentar el cambio en `CLAUDE.md` o `docs/decisions/`

### 7.3 Declaración de freeze en prompts

```
Modificar solo:
- assets/js/[módulo específico].js
- assets/css/[hoja específica].css

No modificar:
- Lógica de sincronización offline (ver docs/architecture.md)
- Orden de <script> en index.html
- apps-script/ (GAS backend)
- Nombres de columnas del Sheet
```

---

## 8. Smoke visual y QA

```
[ ] index.html carga sin errores de consola
[ ] Datos cargan desde el GAS (o modo offline si aplica)
[ ] Gráficos de Chart.js renderizan correctamente
[ ] Filtros: aplicar un filtro actualiza tabla y gráficos sin error
[ ] Indicador de estado de sync es visible y correcto
[ ] Acceso solo por URL conocida (sin pantalla de login)
[ ] Mobile: tablas y gráficos sin overflow
```

---

## 9. Convenciones del proyecto

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Acceso | por URL conocida, sin login | no hay pantalla de auth |
| Gráficos | Chart.js 4.4.1 (vendor local) | `assets/js/vendor/chart.min.js` |
| Módulos JS | orden de carga crítico en `index.html` | ver `docs/architecture.md` |
| Sync | queue en `localStorage`, flush al GAS | no modificar estructura del queue |
| Columnas del Sheet | nombres exactos en snake_case | no renombrar sin revisar parsers |

---

## 10. Aprendizajes — AuditCS

> Documentar aprendizajes aquí a medida que aparezcan.

### 10.1 Chart.js versión bloqueada en 4.4.1

Chart.js tiene breaking changes frecuentes entre versiones menores. La configuración actual de los gráficos (opciones, plugins, datasets) está ajustada a la 4.4.1. Antes de actualizar, revisar el changelog de Chart.js para esa versión específica y validar cada gráfico manualmente.

### 10.2 El orden de carga de scripts en index.html es parte de la arquitectura

Los módulos JS se cargan en un orden deliberado que establece dependencias implícitas. Agregar un `<script>` en el lugar incorrecto puede hacer que un módulo intente usar una función que todavía no existe. Consultar `docs/architecture.md` antes de agregar cualquier script.
