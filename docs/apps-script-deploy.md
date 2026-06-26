# Despliegue del backend GAS (v8 — estándar)

Guía para desplegar el backend reestructurado (Sprint 6) sobre el proyecto de
Apps Script **en producción**. El backend pasó de un único `AppsScript.js` a 9
archivos `.gs`, con RBAC en hojas, observabilidad y migración de usuarios.

> ⚠️ **Este procedimiento toca el Sheet de producción.** Hacé el backup ANTES (paso 0).
> Si algo falla, el rollback está en el paso 7.

---

## 0. Backup (obligatorio, antes de tocar nada)

1. Abrí el Google Sheet de producción.
2. **Archivo → Hacer una copia** (o **Descargar → Microsoft Excel**). Guardala con fecha.
3. Verificá que la copia tenga las hojas `auditorias`, `productividad_semanal`,
   `criterios_calidad`, `configuracion`, `usuarios` con datos.

La migración **solo lee** la hoja `usuarios` y **agrega** hojas nuevas; no modifica
ni renombra hojas/columnas existentes. Aun así, el backup es la red de seguridad.

---

## 1. Reemplazar el código en el editor de Apps Script

El proyecto se despliega por **copy-paste manual** (no hay clasp).

1. Abrí el editor de Apps Script del proyecto (Extensiones → Apps Script desde el Sheet,
   o el proyecto standalone existente).
2. **Borrá** el archivo viejo `AppsScript` (o `Código.gs`) que contiene el backend monolítico.
3. Creá los 9 archivos nuevos (➕ → Script) con **exactamente** estos nombres y pegá el
   contenido de cada uno desde `apps-script/` del repo:

   | Archivo en el editor | Origen en el repo |
   |----------------------|-------------------|
   | `Config.gs`     | `apps-script/Config.gs` |
   | `Helpers.gs`    | `apps-script/Helpers.gs` |
   | `Logger.gs`     | `apps-script/Logger.gs` |
   | `Validators.gs` | `apps-script/Validators.gs` |
   | `Auth.gs`       | `apps-script/Auth.gs` |
   | `Usuarios.gs`   | `apps-script/Usuarios.gs` |
   | `Auditorias.gs` | `apps-script/Auditorias.gs` |
   | `Setup.gs`      | `apps-script/Setup.gs` |
   | `Code.gs`       | `apps-script/Code.gs` |

   > El orden de los archivos en el editor no importa: GAS los une en un solo scope global.
   > Lo crítico es que **no quede** el archivo viejo (causaría redeclaración de `const` y rompería todo).

4. (Opcional) Si el script **no** está vinculado al Sheet (standalone), configurá en
   **Configuración del proyecto → Propiedades del script**:
   `SPREADSHEET_ID = <id del Sheet>` (el id está en la URL del Sheet).
   Si el script está vinculado al Sheet (bound), podés omitir este paso.

---

## 2. Correr el setup/migración una vez

1. En el editor, seleccioná la función **`setupAll`** en el dropdown y **Ejecutar**.
2. Autorizá los permisos cuando lo pida (primera vez).
3. **Ver → Registros** (Ctrl+Enter): debería decir `✓ setupAll completado` y
   `✓ Migrados N usuarios legacy → USUARIOS`.

`setupAll` es **idempotente**: podés correrla de nuevo sin duplicar datos.

---

## 3. Verificar las hojas creadas

En el Sheet deberían aparecer las hojas nuevas (MAYÚSCULAS):

- `USUARIOS` — con el/los admin migrado(s). Verificá que tu email esté con `id_rol=1`,
  `activo=SI` y la columna `salt` **vacía** (es correcto: indica hash legacy preservado).
- `ROLES` — 4 filas (1 Administrador `es_sistema=SI`, 2 Supervisor, 3 Auditor, 4 Agente).
- `PERMISOS_MODULOS` — 28 filas (4 roles × 7 módulos).
- `SESIONES`, `LOGS`, `ERRORS`, `CONFIG` — creadas (vacías salvo headers).

La hoja `usuarios` (minúsculas) original **queda intacta** como respaldo.

---

## 4. Publicar nueva versión del Web App

1. **Implementar → Administrar implementaciones → ✏️ (editar) → Versión: Nueva versión → Implementar.**
2. La **URL del Web App no cambia** — no hay que tocar `config.js`.
3. Confirmá que sigue como **Ejecutar como: Yo** · **Acceso: Cualquier persona**.

---

## 5. Prueba end-to-end

1. **Health:** abrí en el navegador `…/exec?action=health` → `{"status":"ok","ok":true,"running":true,…}`.
2. **Login:** entrá a la app. La sesión vieja (Script Properties) ya no vale →
   te va a pedir login de nuevo (esperado, una sola vez). Logueá con tu contraseña habitual.
3. **Escritura → LOGS:** registrá una auditoría o cambiá configuración. Verificá una fila nueva en `LOGS`.
4. **Sesión en hoja:** verificá una fila en `SESIONES` con tu token y `activa=SI`.
5. **Permisos:** confirmá que un rol no-admin no ve Configuración y no puede eliminar registros si no corresponde.
6. **Sync offline:** cortá la red, registrá algo (queda en cola local), volvé a conectar y reintentá → se sincroniza.

---

## 6. Notas de comportamiento (cambios respecto al backend viejo)

- **Sesiones** ahora viven en la hoja `SESIONES` (antes en Script Properties). Sobreviven
  redeploys y son auditables. Tras este deploy, todos re-loguean una vez.
- **Contraseñas:** el login acepta el hash legacy existente (columna `salt` vacía). Al
  cambiar la contraseña desde la app, se migra a esquema salteado automáticamente.
- **Respuestas dual-emit:** el frontend sigue leyendo `status`; el backend además expone `ok`/`data`/`error`.

---

## 7. Rollback

Si algo sale mal:

1. En el editor, restaurá el backend viejo: el contenido de `apps-script/AppsScript.js`
   está en el historial de git (commit anterior a Sprint 6). Pegalo en un único archivo
   `Code.gs` y borrá los 9 archivos nuevos.
2. **Implementar → nueva versión.**
3. Las hojas nuevas (`USUARIOS`, `ROLES`, etc.) pueden quedar — el backend viejo las ignora.
4. Si hiciera falta, restaurá el Sheet desde el backup del paso 0.
