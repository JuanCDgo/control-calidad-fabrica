import io
import sys
import uuid
from pathlib import Path
from PIL import Image

# Agregar backend al path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app

def create_dummy_image_bytes():
    """Crea una imagen válida en memoria de 100x100 para pruebas de carga."""
    img = Image.new("RGB", (100, 100), color=(73, 109, 137))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.getvalue()

def test_full_flow():
    with TestClient(app) as client:
        print("\n=== 1. Health check y Formato GMT-3 ===")
        res = client.get("/api/health")
        assert res.status_code == 200, res.text
        data = res.json()
        print("Health OK:", data)
        assert "hora_argentina_gmt3" in data

        print("\n=== 2. Verificación de Sectores Requeridos Poblados ===")
        res = client.get("/api/v1/admin/sectores")
        assert res.status_code == 200
        sectores = res.json()
        nombres_sectores = [s["nombre"] for s in sectores]
        print(f"Total sectores cargados: {len(sectores)}")
        
        esperados = [
            "Maquinado",
            "Armado",
            "Cabinas de Fondo",
            "Cabinas de Terminación",
            "Embalaje",
            "Living y Colchones",
            "Red"
        ]
        for esp in esperados:
            assert esp in nombres_sectores, f"Falta sector: {esp}"
        print("Todos los sectores requeridos están presentes.")

        print("\n=== 3. CRUD de Modelos de Mueble ===")
        nuevo_mod = {
            "nombre": f"Mesa Ratona Industrial {uuid.uuid4().hex[:6]}",
            "codigo": f"MRI-{uuid.uuid4().hex[:4].upper()}",
            "descripcion": "Hierro estructural y eucalipto entablonado"
        }
        res = client.post("/api/v1/admin/modelos", json=nuevo_mod)
        assert res.status_code == 201, res.text
        modelo_creado = res.json()
        modelo_id = modelo_creado["id"]
        print(f"Modelo creado OK: ID {modelo_id} - {modelo_creado['nombre']}")

        # Modificar modelo
        res = client.put(f"/api/v1/admin/modelos/{modelo_id}", json={"descripcion": "Hierro 40x40 y eucalipto 2 pulgadas"})
        assert res.status_code == 200
        print("Modelo modificado OK.")

        print("\n=== 4. Catálogos Offline para PWA ===")
        res = client.get("/api/v1/catalogos/offline")
        assert res.status_code == 200
        cat_data = res.json()
        assert len(cat_data["sectores"]) >= 7
        assert len(cat_data["modelos"]) >= 1
        print("Catálogos offline OK (Listos para cachear en IndexedDB del celular).")

        print("\n=== 5. Reporte de Defecto desde Celular (Carga con Foto) ===")
        img_bytes = create_dummy_image_bytes()
        client_uuid = str(uuid.uuid4())
        sector_id = sectores[0]["id"] # Por ejemplo Maquinado

        form_data = {
            "client_uuid": client_uuid,
            "modelo_id": str(modelo_id),
            "sector_id": str(sector_id),
            "descripcion_defecto": "Fisura longitudinal en veta de madera al pasar por tupi",
            "cantidad_afectada": "2 tableros",
            "fecha_captura_local": "2026-11-06 18:50:00"
        }
        files = {
            "foto": ("defecto_camara.jpg", img_bytes, "image/jpeg")
        }

        res = client.post("/api/v1/reportes/", data=form_data, files=files)
        assert res.status_code == 201, res.text
        reporte_data = res.json()
        print("Reporte creado OK:")
        print(f" - ID: {reporte_data['id']}")
        print(f" - UUID: {reporte_data['client_uuid']}")
        print(f" - Cantidad: {reporte_data['cantidad_afectada']}")
        print(f" - Foto path: {reporte_data['foto_path']}")
        print(f" - Modelo: {reporte_data['modelo_nombre']}")
        print(f" - Sector: {reporte_data['sector_nombre']}")

        # Comprobar que el archivo realmente existe en el disco
        foto_rel = reporte_data["foto_path"].lstrip("/uploads/")
        foto_disk = BACKEND_DIR / "uploads" / foto_rel
        assert foto_disk.exists(), f"El archivo de foto no se encuentra en {foto_disk}"
        print(f"Archivo de imagen verificado en disco: {foto_disk.name} ({foto_disk.stat().st_size} bytes)")

        print("\n=== 6. Prueba de Idempotencia de Red (WiFi Inestable) ===")
        # Reenviamos exactamente el mismo reporte (mismo client_uuid)
        res_dup = client.post("/api/v1/reportes/", data=form_data, files={"foto": ("defecto_camara.jpg", img_bytes, "image/jpeg")})
        assert res_dup.status_code == 201
        reporte_dup = res_dup.json()
        assert reporte_dup["id"] == reporte_data["id"]
        print("Idempotencia OK: No se duplicó el reporte en la base de datos.")

        print("\n=== 7. Listado y Filtrado de Reportes en Panel Central ===")
        res = client.get("/api/v1/reportes/")
        assert res.status_code == 200
        reportes_list = res.json()
        assert len(reportes_list) >= 1
        print(f"Total reportes listados en panel: {len(reportes_list)}")

        print("\n=== 8. Desactivación Lógica (Activo/Inactivo sin perder historial) ===")
        # Intentamos borrar el modelo que tiene reporte asociado -> Debe desactivarse lógicamente
        res_del = client.delete(f"/api/v1/admin/modelos/{modelo_id}")
        assert res_del.status_code == 200
        del_data = res_del.json()
        assert del_data["activo"] == 0
        print("Soft-delete verificado: el modelo pasó a inactivo y el historial de reportes quedó intacto.")

        # Verificar que ya no aparece en catálogo de celulares (solo activos)
        res_offline = client.get("/api/v1/catalogos/offline")
        modelos_offline = [m["id"] for m in res_offline.json()["modelos"]]
        assert modelo_id not in modelos_offline
        print("Verificado: El modelo inactivo ya no viaja al celular de los operarios.")

    print("\n TODOS LOS TESTS DEL BACKEND PASARON EXITOSAMENTE.")

if __name__ == "__main__":
    test_full_flow()
