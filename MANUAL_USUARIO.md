# Manual de Usuario - Control de Calidad en Planta

Este manual explica cómo utilizar la aplicación tanto desde los teléfonos móviles en la línea de producción como desde la computadora central de la fábrica.

---

## 1. Acceso a la Aplicación

### Desde la Computadora Central
1. Hacé doble clic en `iniciar_servidor.bat` dentro de la carpeta del proyecto (si querés tenerlo en el Escritorio, creá un **acceso directo**, no muevas el archivo `.bat` suelto).
2. La primera vez en una PC nueva:
   * Si Windows pide confirmar la instalación del certificado SSL local, tocá **"Sí"** para que Chrome/Edge muestren la app como sitio seguro.
   * Si salta el **Firewall de Windows**, marcá redes privadas y tocá **"Permitir acceso"** para que los celulares puedan conectarse por WiFi.
3. El navegador se abrirá automáticamente en `https://localhost:8000` (no necesitás tener Python ni otros programas instalados).

### Desde los Celulares en la Fábrica (Escaneo QR en 1 toque)
1. Conectá el teléfono a la red WiFi de la fábrica.
2. En la pantalla de la computadora central (Panel Admin), hacé clic en el botón azul **"QR para Celulares"**.
3. Si Chrome muestra advertencia de seguridad en el teléfono, pasá a la pestaña **"Certificado SSL"** dentro del modal QR, bajá `FabricaCalidadRootCA.crt` e instalalo como Certificado de CA en Ajustes del celular.
4. Volvé a **"App Operarios"**, escaneá el código QR gigante con la cámara y abrí la página en Chrome.
5. Tocá **"Instalar aplicación"** o **"Agregar a pantalla principal"**. ¡Listo! La app queda instalada con ícono propio y lista para trabajar offline.

---

## 2. Guía para el Operario (Móvil)

### Cargar un Defecto en la Línea de Producción
1. Tocá el botón grande azul **"Capturar Foto del Defecto"**. Se abrirá la cámara de tu celular.
2. Apuntá y sacá una foto clara donde se aprecie la no conformidad (madera rajada, laca corrida, esquina golpeada).
3. La aplicación optimizará la foto automáticamente en segundos para que no pese de más.
4. Filtrá por **Categoría** y buscá en la lista el **Modelo del Mueble** por nombre o código. Si es un mueble nuevo o prototipo que todavía no está en la lista, tocá **"Otro / Prototipo"** y escribí su referencia.
5. Seleccioná el **Sector de Planta** donde estás trabajando.
6. En **Cantidad Afectada**, escribí de forma ágil el material dañado (ejemplo: *"2 tableros"*, *"1 frente de cajón"*, *"4 patas"*).
7. En **Descripción del Defecto**, escribí una explicación breve pero clara del problema.
8. Tocá **"Guardar Reporte"**.

### ¿Qué pasa si se corta el WiFi en el galpón?
* **No te preocupes:** la aplicación está pensada para esto. El reporte y la foto se guardan de forma 100% segura dentro de la memoria de tu celular.
* En la parte superior verás la etiqueta `🔴 Sin WiFi`.
* En la parte inferior de la pantalla aparecerá la lista de **"Pendientes de Sincronización"** mostrando las fotos y datos que aún están guardados en tu teléfono.

### ¿Cómo enviar los datos a la computadora central?
* Cuando camines hacia una zona con señal o vuelva el WiFi, la barra superior cambiará a `📶 Online`.
* Tocá el botón **"Sincronizar"** en la barra superior (que mostrará un número naranja indicando cuántos reportes tenés acumulados).
* En segundos, los reportes viajarán a la PC central y se vaciará la lista de pendientes de tu teléfono.

---

## 3. Guía para el Supervisor / Administración (PC Central)

En la parte superior derecha de la aplicación podés alternar a la vista **"Admin PC"**.

### Pestaña 1: Reportes de Calidad y Exportación
* Vas a ver todos los defectos enviados por los operarios organizados en tarjetas con sus fotos.
* Podés filtrar por **Sector de Planta** o por **Modelo de Mueble** para analizar en qué área se están repitiendo fallas.
* **Exportar a Excel:** Al tocar el botón verde **"Exportar a Excel"**, se descarga un archivo `.csv` compatible con Excel en español (con codificación UTF-8 con BOM y separador `;`), con todos los reportes filtrados, fechas, sectores, modelos, cantidades, descripciones y enlaces directos a las fotos.
* Al hacer clic sobre cualquier foto, se abre en **tamaño grande (Zoom)** para inspeccionar los detalles de la pieza dañada.
* Cada reporte muestra dos horarios en formato argentino (24 horas):
  * **Captura en planta:** Momento exacto en que el operario sacó la foto en la máquina.
  * **Sincronizado en PC:** Momento en que impactó en la computadora central.

### Pestaña 2: Dashboard / Métricas (Para Proyectar en TV)
Diseñado especialmente para reuniones de producción, sala de capacitación y auditorías:
* **Tarjetas KPI:** Muestra en números grandes el total de reportes, el sector con mayor cantidad de incidencias y el volumen de registros.
* **Filtros rápidos de fecha:** Podés alternar en 1 toque entre *Hoy*, *Últimos 7 días*, *Este Mes* o *Todos*.
* **Diagrama de Pareto (80/20):** Muestra los sectores ordenados de mayor a menor frecuencia en barras azules, y sobre ellos la curva naranja de porcentaje acumulado con la línea roja de corte al 80%. Esto permite mostrarle al equipo el 20% de las causas que generan el 80% de los problemas en planta.
* **Gráfico de Dona (Modelos):** Proporción de fallas según el modelo de mueble fabricado.
* **Modo Edición de Textos (Cero Textos Hardcodeados):**
  1. Tocá el botón **"Editar Textos"** en la barra superior del tablero.
  2. Todos los títulos, subtítulos y nombres de KPI aparecerán con un subrayado amarillo.
  3. Hacé clic sobre cualquiera de ellos y escribí la terminología exacta que querés mostrar en la reunión (ej: cambiar *"Frecuencia de Defectos"* por *"No Conformidades de Carpintería"*).
  4. Al tocar Enter o volver a pulsar "Listo", los cambios se guardan de forma permanente en tu navegador para futuras reuniones.
  5. Contás también con un botón de reinicio para volver a los textos estándar si lo deseás.

### Pestaña 2: Categorías y Muebles (Protegida con PIN)
Para evitar que alguien cambie o escriba mal el nombre de los muebles oficiales, la creación, edición y borrado de **Categorías y Modelos** está protegida con un **PIN de seguridad**:
* **Primera vez:** Tocá **"Configurar PIN"** y elegí una clave numérica (4 a 12 caracteres).
* **Desbloquear / Bloquear:** Mientras esté bloqueado 🔒, la lista es de solo lectura. Tocá **"Desbloquear con PIN"** para cargar categorías (ej. *Mesas*, *Sillas*, *Placares*) y agregar modelos adentro con su nombre, código y descripción.
* **Muestra de ejemplo:** El sistema incluye 1 categoría/modelo de muestra y 1 reporte de ejemplo para referencia visual. Están marcados como **"Ejemplo"** y **nunca** suman en gráficos ni se exportan a Excel.
* **Desactivar / Activar:** Los modelos inactivos **desaparecen automáticamente del celular de los operarios** para que no elijan modelos discontinuados, pero **no se borran del historial** de reportes anteriores.

### Pestaña 3: Sectores de Planta
* La aplicación ya viene cargada con los sectores de fábrica: *Maquinado, Armado, Cabinas de Fondo, Cabinas de Terminación, Embalaje, Living y Colchones, Red*.
* Podés agregar nuevos sectores si la fábrica se expande, corregir nombres o desactivar sectores temporales (sin necesidad de PIN).
