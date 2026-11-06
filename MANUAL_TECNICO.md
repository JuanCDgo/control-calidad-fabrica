# Manual Técnico - Control de Calidad Fábrica de Muebles

## 1. Arquitectura del Sistema
El sistema está diseñado bajo una arquitectura **Offline-First** desacoplada pero desplegable de forma unificada:
- **Frontend (PWA Móvil y PC):** Desarrollado en React 18 con Vite y Workbox (`vite-plugin-pwa`). Gestiona almacenamiento local offline mediante IndexedDB (`idb`).
- **Backend (PC Central):** Construido sobre FastAPI (Python 3.12) y ejecutado con Uvicorn bajo HTTPS con certificados SSL locales.
- **Base de Datos:** SQLite 3 optimizada con `PRAGMA journal_mode=WAL` (Write-Ahead Logging) y `busy_timeout=5000` para soportar ráfagas de sincronización concurrente desde múltiples celulares.
- **Almacenamiento de Archivos:** Las fotos de defectos son validadas en sus bytes reales (evitando inyecciones o scripts con Pillow) y almacenadas en el disco de la PC central particionadas por fecha: `/backend/uploads/YYYY/MM/<timestamp>_<uuid>.jpg`.

---

## 2. Modelo de Datos (SQLite)

### Tabla `sectores`
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Identificador numérico del sector |
| `nombre` | TEXT | UNIQUE NOT NULL | Nombre del sector (Maquinado, Armado, etc.) |
| `activo` | INTEGER | NOT NULL DEFAULT 1 | 1 = Activo, 0 = Inactivo (Borrado lógico) |
| `created_at` | TEXT | NOT NULL | Fecha y hora de creación (GMT-3 Argentina) |
| `updated_at` | TEXT | NOT NULL | Fecha y hora de última modificación |

### Tabla `modelos_mueble`
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Identificador del modelo |
| `nombre` | TEXT | UNIQUE NOT NULL | Nombre comercial del modelo |
| `codigo` | TEXT | UNIQUE NULLABLE | Código interno o SKU |
| `descripcion` | TEXT | NULLABLE | Descripción técnica del mueble |
| `activo` | INTEGER | NOT NULL DEFAULT 1 | 1 = Activo, 0 = Inactivo (Borrado lógico) |
| `created_at` | TEXT | NOT NULL | Fecha y hora de creación (GMT-3) |
| `updated_at` | TEXT | NOT NULL | Fecha y hora de modificación |

### Tabla `reportes_calidad`
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | ID interno del reporte |
| `client_uuid` | TEXT | UNIQUE NOT NULL (INDEX) | UUID generado en el celular (Idempotencia) |
| `modelo_id` | INTEGER | FOREIGN KEY -> modelos_mueble.id | Modelo afectado |
| `sector_id` | INTEGER | FOREIGN KEY -> sectores.id | Sector donde se detectó la falla |
| `descripcion_defecto` | TEXT | NOT NULL | Detalle de la no conformidad |
| `cantidad_afectada` | TEXT | NOT NULL | Cantidad libre (ej: "2 tableros", "1 lote") |
| `foto_path` | TEXT | NOT NULL | Ruta relativa web a la imagen guardada |
| `fecha_captura_local`| TEXT | NOT NULL | Timestamp en que el operario sacó la foto |
| `fecha_sincronizacion`| TEXT| NOT NULL | Timestamp en que impactó en la PC central |

---

## 3. Estrategia Offline y Sincronización

### IndexedDB en el Navegador Móvil
1. **`reportes_pendientes` (Key: `client_uuid`):** Guarda la foto como `Blob` binario (no base64) para ahorrar memoria y prevenir congelamiento del navegador móvil.
2. **`catalogos_cache`:** Guarda copia de los modelos y sectores activos. Si la app se abre en el fondo de la fábrica sin WiFi, los desplegables se cargan de inmediato desde IndexedDB.

### Compresión al Vuelo (Canvas API)
Antes de entrar a IndexedDB, cada foto tomada por la cámara nativa (que suele pesar entre 3 y 8 MB) se escala proporcionalmente a un máximo de **1280px** en su lado mayor y se comprime en JPEG a calidad **0.80**. El peso final queda en **250–400 KB**, garantizando sincronizaciones instantáneas incluso con WiFi débil.

### Idempotencia de Red
Si la red se corta a mitad de la subida, el operario reintentará la sincronización. El backend verifica la unicidad de `client_uuid`:
- Si ya existe: devuelve el reporte existente sin duplicar filas ni archivos.
- Si es nuevo: guarda la foto, inserta en SQLite y devuelve HTTP 201.

---

## 4. Seguridad y Certificados SSL Locales
Las PWAs y la API de cámara (`navigator.mediaDevices` y `capture="environment"`) exigen contextos seguros (`HTTPS`).

El archivo `backend/generate_certs.py`:
1. Detecta automáticamente la IP LAN de la máquina (ej: `192.168.8.101`).
2. Genera una Autoridad Certificadora Raíz (`backend/certs/rootCA.crt`).
3. Emite un certificado SSL de servidor (`cert.pem`, `key.pem`) con SANs (Subject Alternative Names) para `localhost`, `127.0.0.1` y la IP LAN.
4. Si se instala `rootCA.crt` en los teléfonos de la empresa, los navegadores confían al 100% en el servidor sin emitir advertencias de seguridad.

---

## 5. Procedimiento de Respaldos (Backups)
Para hacer una copia de seguridad total del sistema, solo se requieren dos carpetas:
1. `backend/data/calidad.db` (y archivos `-wal` / `-shm` si el servidor está en marcha).
2. `backend/uploads/` (donde se encuentran organizadas todas las fotos de los reportes).

Recomendación de script de backup diario: copiar `backend/data/calidad.db` y la carpeta `backend/uploads/` a un pendrive o carpeta de Google Drive sincronizada.

---

## 6. Comandos Operativos

### Iniciar Servidor Completo (PC Central)
Hacer doble clic en `iniciar_servidor.bat` o ejecutar:
```bash
backend\.venv\Scripts\python.exe backend\run_server.py
```

### Recompilar Frontend tras modificaciones
```bash
cd frontend
npm run build
```
FastAPI sirve automáticamente los archivos compilados de `frontend/dist` en la raíz `/`.
