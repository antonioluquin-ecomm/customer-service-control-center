# Setup — AuditCS

## Requisitos

- Cuenta de Google con acceso a Google Drive y Google Sheets
- Repositorio en GitHub con GitHub Pages habilitado (rama `main`)

---

## Paso 1 — Crear la Spreadsheet

1. Ir a [sheets.google.com](https://sheets.google.com) y crear una nueva hoja en blanco
2. Anotá el ID de la Spreadsheet (la parte larga de la URL entre `/d/` y `/edit`)
3. No hace falta crear hojas manualmente — el Apps Script las crea automáticamente en el primer request

---

## Paso 2 — Configurar el Apps Script

1. Dentro de la Spreadsheet, ir a **Extensiones → Apps Script**
2. Eliminar el código de ejemplo y pegar el contenido de [`apps-script/AppsScript.js`](../apps-script/AppsScript.js)
3. Guardar el proyecto (Ctrl+S)

### Configurar el token de seguridad

1. En el editor de Apps Script, ir a **⚙ Configuración del proyecto → Propiedades de script**
2. Agregar una propiedad:
   - Clave: `SECRET_TOKEN`
   - Valor: una cadena larga y aleatoria (ej: `AuditCS-2026-xK9mP3qR7vN2`)
3. Guardar

> Si no configurás el token, el sistema funciona igual pero sin autenticación (solo recomendado para desarrollo inicial).

---

## Paso 3 — Desplegar como Web App

1. En el editor de Apps Script, click en **Implementar → Nueva implementación**
2. Tipo: **Aplicación web**
3. Configuración:
   - Ejecutar como: **Yo** (tu cuenta de Google)
   - Quién tiene acceso: **Cualquier persona**
4. Click en **Implementar**
5. Copiar la **URL de la aplicación web** (empieza con `https://script.google.com/macros/s/...`)

---

## Paso 4 — Conectar el frontend

1. Abrir la app en el navegador (GitHub Pages o `index.html` local)
2. Ir a la sección **Configuración**
3. En el campo "URL del Apps Script", pegar la URL copiada en el paso anterior
4. Click en **Guardar URL**
5. Click en **Probar conexión** — debería aparecer "✓ Conexión OK"
6. Click en **Recargar desde Sheets** para cargar los datos

---

## Paso 5 — Inicialización de hojas

En el primer request, el Apps Script crea automáticamente las 8 hojas con sus headers:
`auditorias`, `detalle_calidad`, `productividad`, `observaciones`, `log_envios`, `configuracion`, `log_configuracion`, `criterios_calidad`

Si necesitás reinicializar las hojas manualmente, ejecutar la función `setupInitial()` desde el editor de Apps Script.

---

## Primer uso

1. Ir a **Configuración → Agentes** y agregar los nombres del equipo
2. Ir a **Configuración → Auditores** y agregar tu nombre
3. Ajustar los parámetros de productividad y pesos si los defaults no corresponden
4. Ir a **Nueva Auditoría** y completar el formulario de 5 pasos

---

## Modo offline

La app funciona sin conexión a Sheets. Las auditorías se guardan en `localStorage` y se muestran con el badge "Pendiente". Al restaurar la conexión, usar el botón **↑ Reintentar pendientes** en el topbar para sincronizar.

---

## Variables globales importantes

```js
CFG_KEY = "auditcs_cfg_v5"   // Key de localStorage donde se guarda la URL de Sheets
```

Si necesitás resetear la URL guardada, ejecutar en consola del navegador:
```js
localStorage.removeItem("auditcs_cfg_v5")
```
