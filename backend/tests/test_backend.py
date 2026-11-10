import io
import os
import sys
import tempfile
import uuid
from pathlib import Path
from PIL import Image

# Usar directorios temporales aislados para nunca ensuciar calidad.db ni uploads reales
_TMP_TEST_DIR = tempfile.TemporaryDirectory()
os.environ["CALIDAD_DATA_DIR"] = str(Path(_TMP_TEST_DIR.name) / "data")
os.environ["CALIDAD_UPLOADS_DIR"] = str(Path(_TMP_TEST_DIR.name) / "uploads")

# Agregar backend al path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.core.database import engine
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
        print("\n=== 1. Health check, Server Info y Certificado Root CA ===")
        res = client.get("/api/health")
        assert res.status_code == 200, res.text
        assert "hora_argentina_gmt3" in res.json()

        res_info = client.get("/api/server-info")
        assert res_info.status_code == 200, res_info.text
        assert res_info.json()["server_url"].startswith("http")

        # Si existe rootCA.crt debe descargarse correctamente
        ca_file = BACKEND_DIR / "certs" / "rootCA.crt"
        if ca_file.exists():
            res_ca = client.get("/api/ca-cert")
            assert res_ca.status_code == 200, res_ca.text
            assert b"BEGIN CERTIFICATE" in res_ca.content

        print("\n=== 2. Verificación de Sectores y Muestras de Ejemplo ===")
        res = client.get("/api/v1/admin/sectores")
        assert res.status_code == 200
        sectores = res.json()
        nombres_sectores = [s["nombre"] for s in sectores]
        for esp in [
            "Maquinado",
            "Armado",
            "Cabinas de Fondo",
            "Cabinas de Terminación",
            "Embalaje",
            "Living y Colchones",
            "Red",
        ]:
            assert esp in nombres_sectores, f"Falta sector: {esp}"

        # Verificar que el ejemplo existe en Admin pero NO viaja al celular en /catalogos/offline
        res_cats_admin = client.get("/api/v1/admin/categorias")
        assert res_cats_admin.status_code == 200
        assert any(c["es_ejemplo"] == 1 for c in res_cats_admin.json())

        res_mods_admin = client.get("/api/v1/admin/modelos")
        assert res_mods_admin.status_code == 200
        assert any(m["es_ejemplo"] == 1 for m in res_mods_admin.json())

        res_offline_init = client.get("/api/v1/catalogos/offline")
        assert res_offline_init.status_code == 200
        assert len(res_offline_init.json()["categorias"]) == 0
        assert len(res_offline_init.json()["modelos"]) == 0

        res_reps_init = client.get("/api/v1/reportes/")
        assert res_reps_init.status_code == 200
        assert any(r["es_ejemplo"] == 1 for r in res_reps_init.json())

        print("\n=== 3. Seguridad PIN para Categorías y Modelos ===")
        res_pin_status = client.get("/api/v1/admin/pin/status")
        assert res_pin_status.status_code == 200
        assert res_pin_status.json()["pin_configurado"] is False

        # Sin PIN configurado debe rechazar crear categoría o modelo
        res_no_pin = client.post("/api/v1/admin/categorias", json={"nombre": "Mesas"})
        assert res_no_pin.status_code == 403

        # Configurar PIN
        res_setup = client.post("/api/v1/admin/pin/setup", json={"pin": "2468"})
        assert res_setup.status_code == 200
        assert res_setup.json()["pin_configurado"] is True

        # Intentar crear con PIN erróneo -> 401
        res_bad_pin = client.post(
            "/api/v1/admin/categorias",
            json={"nombre": "Mesas"},
            headers={"X-Admin-Pin": "9999"},
        )
        assert res_bad_pin.status_code == 401

        # Verificar PIN válido
        res_ver = client.post("/api/v1/admin/pin/verify", json={"pin": "2468"})
        assert res_ver.status_code == 200 and res_ver.json()["valid"] is True

        print("\n=== 4. CRUD de Categorías y Modelos (con PIN) ===")
        pin_headers = {"X-Admin-Pin": "2468"}
        res_cat = client.post(
            "/api/v1/admin/categorias",
            json={"nombre": "Comedor"},
            headers=pin_headers,
        )
        assert res_cat.status_code == 201, res_cat.text
        cat_id = res_cat.json()["id"]

        nuevo_mod = {
            "nombre": f"Mesa Ratona Industrial {uuid.uuid4().hex[:6]}",
            "categoria_id": cat_id,
            "codigo": f"MRI-{uuid.uuid4().hex[:4].upper()}",
            "descripcion": "Hierro estructural y eucalipto entablonado",
        }
        res_mod = client.post("/api/v1/admin/modelos", json=nuevo_mod, headers=pin_headers)
        assert res_mod.status_code == 201, res_mod.text
        modelo_id = res_mod.json()["id"]
        assert res_mod.json()["categoria_nombre"] == "Comedor"

        # Editar modelo con PIN
        res_upd = client.put(
            f"/api/v1/admin/modelos/{modelo_id}",
            json={"descripcion": "Hierro 40x40 y eucalipto 2 pulgadas"},
            headers=pin_headers,
        )
        assert res_upd.status_code == 200

        print("\n=== 5. Catálogos Offline para PWA ===")
        res_off = client.get("/api/v1/catalogos/offline")
        assert res_off.status_code == 200
        cat_data = res_off.json()
        assert len(cat_data["categorias"]) == 1
        assert len(cat_data["modelos"]) == 1
        assert cat_data["modelos"][0]["id"] == modelo_id

        print("\n=== 6. Reporte Oficial + Idempotencia + Reporte Prototipo Manual ===")
        img_bytes = create_dummy_image_bytes()
        sector_id = sectores[0]["id"]
        form_data = {
            "client_uuid": str(uuid.uuid4()),
            "modelo_id": str(modelo_id),
            "sector_id": str(sector_id),
            "descripcion_defecto": "Fisura longitudinal en veta",
            "cantidad_afectada": "2 tableros",
            "fecha_captura_local": "2026-11-10 18:20:00",
        }
        files = {"foto": ("defecto_camara.jpg", img_bytes, "image/jpeg")}
        res_rep = client.post("/api/v1/reportes/", data=form_data, files=files)
        assert res_rep.status_code == 201, res_rep.text
        rep_data = res_rep.json()
        assert rep_data["es_ejemplo"] == 0
        assert rep_data["categoria_nombre"] == "Comedor"

        # Idempotencia
        res_dup = client.post(
            "/api/v1/reportes/",
            data=form_data,
            files={"foto": ("defecto_camara.jpg", img_bytes, "image/jpeg")},
        )
        assert res_dup.status_code == 201
        assert res_dup.json()["id"] == rep_data["id"]

        # Reporte de prototipo manual (sin modelo_id)
        proto_data = {
            "client_uuid": str(uuid.uuid4()),
            "modelo_manual": "Prototipo Mesa Extensible 2.20",
            "sector_id": str(sector_id),
            "descripcion_defecto": "Desajuste en corredera",
            "cantidad_afectada": "1 prototipo",
            "fecha_captura_local": "2026-11-10 18:22:00",
        }
        res_proto = client.post(
            "/api/v1/reportes/",
            data=proto_data,
            files={"foto": ("proto.jpg", img_bytes, "image/jpeg")},
        )
        assert res_proto.status_code == 201, res_proto.text
        assert res_proto.json()["modelo_id"] is None
        assert res_proto.json()["categoria_nombre"] == "Otro / Prototipo"
        assert "Prototipo Mesa Extensible 2.20" in res_proto.json()["modelo_nombre"]

        print("\n=== 7. Soft-Delete protegido por PIN y Protección de Reportes Reales ===")
        res_del_real = client.delete(f"/api/v1/reportes/{rep_data['id']}")
        assert res_del_real.status_code == 403  # No permite borrar reportes reales

        res_del_mod = client.delete(f"/api/v1/admin/modelos/{modelo_id}", headers=pin_headers)
        assert res_del_mod.status_code == 200
        assert res_del_mod.json()["activo"] == 0

        res_off_after = client.get("/api/v1/catalogos/offline")
        assert len(res_off_after.json()["modelos"]) == 0

    engine.dispose()
    _TMP_TEST_DIR.cleanup()
    print("\nTODOS LOS TESTS DEL BACKEND PASARON EXITOSAMENTE.")


if __name__ == "__main__":
    test_full_flow()
