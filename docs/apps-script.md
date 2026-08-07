# Apps Script — Referencia de API

Backend (v8 — estándar): 10 archivos `.gs` en `apps-script/` desplegados como Web App en Google Apps Script:
`Code.gs` (router) · `Auth.gs` · `Usuarios.gs` · `Auditorias.gs` · `VolumenCanales.gs` · `Validators.gs` · `Logger.gs` · `Helpers.gs` · `Config.gs` · `Setup.gs`.

Para desplegar paso a paso (incluida la migración del Sheet de producción), ver
[`apps-script-deploy.md`](apps-script-deploy.md).

> **Respuestas dual-emit:** desde v8 toda respuesta incluye las claves legacy
> (`status`, `message`, `config`, `auditorias`, …) **y** las estándar
> (`ok`, `data`, `error`). El frontend actual lee `status`; el código nuevo puede leer `ok`/`data`.
> Los ejemplos de abajo muestran solo las claves legacy por compatibilidad.

> **RBAC por sesión:** el acceso se controla con hojas `USUARIOS` (id_rol), `ROLES`,
> `PERMISOS_MODULOS` y `SESIONES`. Endpoints nuevos: `getPermisos`, `getUsuarios`,
> `createUsuario`, `updateUsuario`, `getRoles`, `createRol`, `updateRol`, `updatePermisos`.
> Observabilidad: cada escritura genera fila en `LOGS`; los errores técnicos en `ERRORS`.

---

## Autenticación

Todos los endpoints, excepto `login`, requieren un `sessionToken` vigente. El token se obtiene al iniciar sesión, se conserva solo durante la pestaña actual y debe enviarse como query param en GET o dentro del JSON en POST.

Roles: `admin`, `supervisor` y `auditor`. Todos pueden consultar y registrar auditorías. Solo `admin` puede modificar configuración y criterios o eliminar auditorías. Cada usuario autenticado solo puede cambiar su propia contraseña.

---

## Endpoints GET

Base URL: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

### `?action=get_config`

Devuelve la configuración activa (agentes, auditores, pesos, umbrales).

**Response:**
```json
{
  "status": "ok",
  "config": {
    "agentes": ["Ana García", "Carlos López"],
    "auditores": ["Gabriel Luna"],
    "horas_base": 44,
    "tickets_base": 660,
    "muestras_semana": 4,
    "w_inter": 60,
    "w_puntual": 20,
    "w_present": 20,
    "obj_puntual": 1,
    "obj_present": 1,
    "u_excelente": 95,
    "u_correcta": 80,
    "w_calidad": 50,
    "w_productividad": 50
  }
}
```

---

### `?action=get_auditorias`

Devuelve todas las auditorías de la hoja `auditorias`.

**Response:**
```json
{
  "status": "ok",
  "auditorias": [
    {
      "id_auditoria": "AUD-0001",
      "fecha_auditoria": "2026-06-10",
      "agente": "Ana García",
      "auditor": "Gabriel Luna",
      "ticket": "INC-12345",
      "canal": "Chat",
      "tipo": "Calidad",
      "mes": "Junio",
      "semana": "24",
      "horas_trabajadas": 44,
      "calidad": 88,
      "productividad": 92,
      "general": 90,
      "estado": "Correcta",
      "sheets_enviado": true,
      "criterios": []
    }
  ]
}
```

---

### `?action=get_detalle`

Devuelve los criterios evaluados indexados por `id_auditoria`.

**Response:**
```json
{
  "status": "ok",
  "detalle": {
    "AUD-0001": [
      { "cod": "COM_SALUDO", "nombre": "Saludo inicial", "bloque": "Comunicacion", "peso": 2, "cumple": "Sí", "obtenido": 2 },
      { "cod": "GES_HISTORIAL", "nombre": "Historial del contacto / Solicitud", "bloque": "Gestion", "peso": 20, "cumple": "No", "obtenido": 0 }
    ]
  }
}
```

---

### `?action=get_criterios`

Devuelve los criterios de calidad configurados en la hoja `criterios_calidad`.

**Response:**
```json
{
  "status": "ok",
  "criterios": [
    { "cod": "COM_SALUDO", "bloque": "Comunicacion", "nombre": "Saludo inicial", "peso": 2, "activo": true }
  ]
}
```

---

### `?action=get_volumen_canales`

Devuelve la carga diaria de volumen por canal (una fila por fecha, hoja `volumen_canales`).

**Response:**
```json
{
  "status": "ok",
  "volumen_canales": [
    { "fecha": "2026-08-07", "anio": 2026, "mes": "Agosto", "semana": "32",
      "wsp_ingreso": 21, "wsp_salida": 18, "mails_ingreso": 57, "veces_editado": 0,
      "cargado_por": "lucia@luquin.com.ar", "fecha_registro": "2026-08-07", "fecha_actualizacion": "2026-08-07" }
  ]
}
```

---

## Endpoints POST

Content-Type: `text/plain;charset=utf-8` (evita preflight CORS).  
El cuerpo es JSON serializado como string.

---

### Insertar auditoría (tipo por defecto)

```json
{
+
  "id_auditoria": "AUD-0042",
  "fecha_auditoria": "2026-06-17",
  "auditor": "Gabriel Luna",
  "agente": "Ana García",
  "ticket": "INC-99999",
  "canal": "Chat",
  "tipo": "Calidad",
  "anio": 2026,
  "mes": "Junio",
  "semana": "25",
  "horas_trabajadas": 44,
  "objetivo_interacciones": 660,
  "interacciones_reales": 610,
  "dias_tarde": 0,
  "dias_faltas": 0,
  "calidad": 88,
  "productividad": 92,
  "general": 90,
  "estado": "Correcta",
  "requiere_seguimiento": "No",
  "obs_general": "",
  "obs_accion": "",
  "w_calidad": 50,
  "w_productividad": 50,
  "criterios": [
    { "cod": "COM_SALUDO", "nombre": "Saludo inicial", "bloque": "Comunicacion", "peso": 2, "cumple": "Sí", "obtenido": 2 }
  ]
}
```

+
Si ya existe: `{ "status": "ok", "id": "AUD-0042", "duplicate": true }`

El backend inserta en 4 hojas: `auditorias`, `detalle_calidad`, `productividad`, `observaciones` (si hay obs).

---

### `_type: "config_change"` — Sincronizar configuración

```json
{
+
  "_type": "config_change",
  "accion": "parametros_actualizados",
  "agentes": ["Ana García", "Carlos López"],
  "auditores": ["Gabriel Luna"],
  "parametros": {
    "horas_base": 44,
    "tickets_base": 660,
    "muestras_semana": 4,
    "w_inter": 60,
    "w_puntual": 20,
    "w_present": 20,
    "obj_puntual": 1,
    "obj_present": 1,
    "u_excelente": 95,
    "u_correcta": 80,
    "w_calidad": 50,
    "w_productividad": 50
  },
  "detalle": "Guardado desde UI"
}
```

Usa upsert por fila — no destruye datos existentes en la hoja `configuracion`.

---

### `_type: "update_criterios"` — Actualizar criterios

```json
{
+
  "_type": "update_criterios",
  "criterios": [
    { "cod": "COM_SALUDO", "bloque": "Comunicacion", "nombre": "Saludo inicial", "peso": 2, "activo": true }
  ]
}
```

Valida que los pesos sumen 100% (margen ±1%). Si no, devuelve error.

---

### `_type: "delete_auditoria"` — Eliminar auditoría

```json
{
+
  "_type": "delete_auditoria",
  "id_auditoria": "AUD-0042"
}
```

Elimina filas en `auditorias`, `detalle_calidad`, `productividad` y `observaciones`. Registra el evento en `log_envios`.

---

### `_type: "upsert_volumen_canales"` — Cargar/editar el volumen de un día

```json
{
  "_type": "upsert_volumen_canales",
  "fecha": "2026-08-07",
  "wsp_ingreso": 21, "wsp_salida": 18,
  "mails_ingreso": 57, "mails_salida": null
}
```

Upsert por `fecha` (una fila por día — mismo patrón que `upsert_productividad_semanal`). Si la fecha ya
existe, sobreescribe la fila y suma 1 a `veces_editado`; conserva `fecha_registro` del alta original.
Requiere permiso de edición sobre el módulo `volumen`.

---

## Estructura de hojas

### `auditorias` (28 columnas)

`id_auditoria · fecha_registro · fecha_auditoria · anio · mes · semana · auditor · agente · ticket · canal · tipo · horas_trabajadas · objetivo_interacciones · interacciones_reales · dias_tarde · dias_faltas · pct_calidad · pct_productividad · pct_general · estado · requiere_seguimiento · obs_general · obs_desvios · obs_accion · resp_seguimiento · w_calidad · w_productividad · timestamp_registro`

### `detalle_calidad` (8 columnas)

`id_detalle · id_auditoria · bloque · criterio_codigo · criterio_nombre · peso_porcentaje · cumple_si_no · porcentaje_obtenido`

### `productividad` (19 columnas)

`id_productividad · id_auditoria · fecha_auditoria · anio · mes · semana · agente · horas_trabajadas · objetivo_interacciones · interacciones_reales · dias_tarde · dias_faltas · pct_interacciones · pct_puntualidad · pct_presentismo · total_productividad · w_inter · w_puntual · w_present`

### `configuracion` (5 columnas)

`parametro · valor · unidad · descripcion · ultima_actualizacion`

### `criterios_calidad` (6 columnas)

`cod · bloque · nombre · peso · activo · ultima_actualizacion`

### `volumen_canales` (24 columnas)

`fecha · anio · mes · semana · wsp_ingreso · wsp_salida · llamadas_atendidas · llamadas_desbordadas · llamadas_no_respondidas · redes_privados · redes_comentarios · redes_min_privados · mails_ingreso · mails_salida · ventas_ingreso · ventas_salida · ventas_cancelados · reembolsos_pim · pendientes_pim · cc_gestionados · reclamos · cargado_por · fecha_registro · fecha_actualizacion · veces_editado`

---

## Criterios de calidad por defecto

| Código | Bloque | Nombre | Peso |
|--------|--------|--------|------|
| COM_SALUDO | Comunicacion | Saludo inicial | 2% |
| COM_TONO | Comunicacion | Tono de voz / Lenguaje apropiado | 4% |
| COM_SILENCIOS | Comunicacion | Silencios y administración de tiempos | 4% |
| COM_ESCUCHA | Comunicacion | Escucha activa / Interpretación | 4% |
| COM_EFECTIVA | Comunicacion | Comunicación efectiva | 4% |
| COM_DESPEDIDA | Comunicacion | Despedida | 2% |
| GES_HISTORIAL | Gestion | Historial del contacto / Solicitud | 20% |
| GES_INFO | Gestion | Información correcta | 10% |
| GES_RESOLUCION | Gestion | Resolución en primer contacto | 10% |
| GES_EMOCIONES | Gestion | Manejo de emociones | 10% |
| GES_OBJECIONES | Gestion | Manejo de objeciones | 10% |
| GES_HERRAMIENTAS | Gestion | Manejo de herramientas | 20% |

**Total: 100%** — Comunicación 20% + Gestión 80%
