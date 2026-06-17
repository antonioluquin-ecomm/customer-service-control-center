# Apps Script — Referencia de API

Backend: `apps-script/AppsScript.js` desplegado como Web App en Google Apps Script.

---

## Autenticación

Todos los endpoints validan un token configurado como Script Property:

- **GET**: el token va como query param `?token=...`  
- **POST**: el token va en el cuerpo JSON como `{ _token: "..." }`

Si `SECRET_TOKEN` no está configurado en las propiedades, la validación se omite (modo desarrollo).

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

## Endpoints POST

Content-Type: `text/plain;charset=utf-8` (evita preflight CORS).  
El cuerpo es JSON serializado como string.

---

### Insertar auditoría (tipo por defecto)

```json
{
  "_token": "SECRET_TOKEN",
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

**Response:** `{ "status": "ok", "id": "AUD-0042" }`  
Si ya existe: `{ "status": "ok", "id": "AUD-0042", "duplicate": true }`

El backend inserta en 4 hojas: `auditorias`, `detalle_calidad`, `productividad`, `observaciones` (si hay obs).

---

### `_type: "config_change"` — Sincronizar configuración

```json
{
  "_token": "SECRET_TOKEN",
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
  "_token": "SECRET_TOKEN",
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
  "_token": "SECRET_TOKEN",
  "_type": "delete_auditoria",
  "id_auditoria": "AUD-0042"
}
```

Elimina filas en `auditorias`, `detalle_calidad`, `productividad` y `observaciones`. Registra el evento en `log_envios`.

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
