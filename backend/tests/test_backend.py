import io
import os
import shutil
import sys
import tempfile
import uuid
from pathlib import Path
from PIL import Image
import openpyxl

# Usar directorios temporales aislados para nunca ensuciar calidad.db ni uploads reales
_TMP_TEST_DIR = tempfile.TemporaryDirectory()
TMP_ROOT = Path(_TMP_TEST_DIR.name)
os.environ["CALIDAD_DATA_DIR"] = str(TMP_ROOT / "data")
os.environ["CALIDAD_UPLOADS_DIR"] = str(TMP_ROOT / "uploads")
os.environ["CALIDAD_CARGA_DIR"] = str(TMP_ROOT / "Carga_Semanal")

# Copiar plantilla real de Encargado para probar el volcado a Excel
PLANTILLA_SRC = (
    Path(__file__).resolve().parents[3]
    / "control-planta-patria-v1.1"
    / "Plantilla_Encargado_Planta.xlsx"
)
Path(os.environ["CALIDAD_CARGA_DIR"]).mkdir(parents=True, exist_ok=True)
if PLANTILLA_SRC.exists():
    shutil.copy2(PLANTILLA_SRC, Path(os.environ["CALIDAD_CARGA_DIR"]) / "Encargado_1_Armado.xlsx")

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app


def create_dummy_image_bytes():
    img = Image.new("RGB", (100, 100), color=(73, 109, 137))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.getvalue()


def test_full_flow():
    with TestClient(app) as client:
        print("\n=== 1. Health check, Server Info y Catálogos Precargados v1.2 ===")
        res = client.get("/api/health")
        assert res.status_code == 200, res.text
        assert "hora_argentina_gmt3" in res.json()

        res_info = client.get("/api/server-info")
        assert res_info.status_code == 200, res_info.text

        res_off = client.get("/api/v1/catalogos/offline")
        assert res_off.status_code == 200, res_off.text
        cat_data = res_off.json()

        assert len(cat_data["sectores"]) == 12
        assert len(cat_data["encargados"]) == 4
        assert len(cat_data["tipos_problema"]) == 12
        assert len(cat_data["categorias"]) == 6
        assert len(cat_data["modelos"]) == 76
        assert cat_data["impactos"] == ["FALTA", "SOBRA", "DEFECTO", "OTRO"]

        lucas = next(e for e in cat_data["encargados"] if "Lucas" in e["nombre"])
        armado = next(s for s in cat_data["sectores"] if s["nombre"] == "Armado")
        tipo_faltante = next(t for t in cat_data["tipos_problema"] if "FALTANTE" in t["nombre"])
        silla_docta = next(m for m in cat_data["modelos"] if m["nombre"] == "Silla Docta")

        print("\n=== 2. CRUD Encargados y Tipos de Problema ===")
        res_enc = client.post(
            "/api/v1/admin/encargados",
            json={"nombre": "Juan Test", "sector_default": "Embalaje", "archivo_excel": "Encargado_1_Armado.xlsx"},
        )
        assert res_enc.status_code == 201, res_enc.text
        enc_test_id = res_enc.json()["id"]

        res_enc_upd = client.put(f"/api/v1/admin/encargados/{enc_test_id}", json={"sector_default": "Logística"})
        assert res_enc_upd.status_code == 200 and res_enc_upd.json()["sector_default"] == "Logística"

        res_tp = client.post("/api/v1/admin/tipos-problema", json={"nombre": "PROBLEMA DE PRUEBA"})
        assert res_tp.status_code == 201, res_tp.text
        tp_test_id = res_tp.json()["id"]
        assert client.delete(f"/api/v1/admin/tipos-problema/{tp_test_id}").status_code == 200
        assert client.delete(f"/api/v1/admin/encargados/{enc_test_id}").status_code == 200

        print("\n=== 3. Seguridad PIN para Categorías y Modelos ===")
        assert client.post("/api/v1/admin/categorias", json={"nombre": "Exterior"}).status_code == 403
        assert client.post("/api/v1/admin/pin/setup", json={"pin": "2468"}).status_code == 200
        pin_headers = {"X-Admin-Pin": "2468"}
        res_cat = client.post("/api/v1/admin/categorias", json={"nombre": "Exterior"}, headers=pin_headers)
        assert res_cat.status_code == 201

        print("\n=== 4. Reporte CON Foto + Link Corto /f/{id} + Reporte SIN Foto (Opcional) ===")
        img_bytes = create_dummy_image_bytes()
        form_con_foto = {
            "client_uuid": str(uuid.uuid4()),
            "encargado_id": str(lucas["id"]),
            "tipo_problema_id": str(tipo_faltante["id"]),
            "impacto": "FALTA",
            "modelo_id": str(silla_docta["id"]),
            "detalle_pieza": "Escuadras de madera",
            "sector_id": str(armado["id"]),
            "cantidad_afectada": "1 lote",
            "descripcion_defecto": "Faltan escuadras para terminar sillas Docta",
            "accion_inmediata": "Aviso a Maquinado",
            "estado": "Abierto",
            "fecha_captura_local": "2026-11-16 09:30:00",
        }
        res_rep1 = client.post(
            "/api/v1/reportes/",
            data=form_con_foto,
            files={"foto": ("escuadras.jpg", img_bytes, "image/jpeg")},
        )
        assert res_rep1.status_code == 201, res_rep1.text
        rep1 = res_rep1.json()
        assert rep1["foto_link_corto"] == f"/f/{rep1['id']}"
        assert rep1["encargado_nombre"] == lucas["nombre"]

        # Verificar link corto /f/{id}
        res_foto = client.get(rep1["foto_link_corto"])
        assert res_foto.status_code == 200

        # Idempotencia
        res_dup = client.post(
            "/api/v1/reportes/",
            data=form_con_foto,
            files={"foto": ("escuadras.jpg", img_bytes, "image/jpeg")},
        )
        assert res_dup.status_code == 201 and res_dup.json()["id"] == rep1["id"]

        # Reporte SIN foto (foto opcional)
        form_sin_foto = {
            "client_uuid": str(uuid.uuid4()),
            "encargado_id": str(lucas["id"]),
            "tipo_problema_id": str(tipo_faltante["id"]),
            "impacto": "FALTA",
            "modelo_manual": "General",
            "detalle_pieza": "Tornillos 4x40",
            "sector_id": str(armado["id"]),
            "cantidad_afectada": "2 cajas",
            "descripcion_defecto": "Sin stock en pañol",
            "accion_inmediata": "Pedido a Compras",
            "estado": "Abierto",
            "fecha_captura_local": "2026-11-16 10:15:00",
        }
        res_rep2 = client.post("/api/v1/reportes/", data=form_sin_foto)
        assert res_rep2.status_code == 201, res_rep2.text
        rep2 = res_rep2.json()
        assert rep2["foto_path"] is None
        assert rep2["foto_link_corto"] is None

        print("\n=== 5. Edición de Reporte ===")
        res_upd_rep = client.put(
            f"/api/v1/reportes/{rep2['id']}",
            json={"estado": "Resuelto", "accion_inmediata": "Llegó compra urgente"},
        )
        assert res_upd_rep.status_code == 200
        assert res_upd_rep.json()["estado"] == "Resuelto"

        print("\n=== 6. Exportación a Planilla Excel del Encargado sin Duplicados ===")
        if PLANTILLA_SRC.exists():
            res_exp1 = client.post("/api/v1/reportes/exportar-planillas", json={})
            assert res_exp1.status_code == 200, res_exp1.text
            exp1 = res_exp1.json()
            assert exp1["exportados"] == 2
            assert "Encargado_1_Armado.xlsx" in exp1["archivos_actualizados"]

            # Segunda ejecución no debe duplicar ninguno
            res_exp2 = client.post("/api/v1/reportes/exportar-planillas", json={})
            assert res_exp2.status_code == 200
            assert res_exp2.json()["exportados"] == 0

            wb = openpyxl.load_workbook(Path(os.environ["CALIDAD_CARGA_DIR"]) / "Encargado_1_Armado.xlsx")
            ws = wb["Desvíos y Materiales"]
            assert ws["F4"].value == "Silla Docta"
            assert ws["L4"].value == "Ver Foto"
            assert ws["L4"].hyperlink is not None
            assert ws["L5"].value == "Sin foto"

        print("\n=== 7. Protección y Borrado Forzado de Reportes ===")
        assert client.delete(f"/api/v1/reportes/{rep2['id']}").status_code == 403
        assert client.delete(f"/api/v1/reportes/{rep2['id']}?forzar=true").status_code == 200


if __name__ == "__main__":
    try:
        test_full_flow()
        print("\nALL BACKEND TESTS PASSED!")
    finally:
        from app.core.database import engine
        engine.dispose()
        try:
            _TMP_TEST_DIR.cleanup()
        except Exception:
            pass
