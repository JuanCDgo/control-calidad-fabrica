from pathlib import Path
from PIL import Image, ImageDraw
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import UPLOADS_DIR
from app.core.database import engine, Base
from app.core.timezone import get_arg_now_str
from app.models.entities import (
    Sector,
    CategoriaMueble,
    ModeloMueble,
    ReporteCalidad,
    ConfiguracionSeguridad,
)

SECTORES_INICIALES = [
    "Maquinado",
    "Armado",
    "Cabinas de Fondo",
    "Cabinas de Terminación",
    "Embalaje",
    "Living y Colchones",
    "Red",
]

SAMPLE_PHOTO_NAME = "ejemplo_muestra.jpg"
SAMPLE_PHOTO_URL = f"/uploads/{SAMPLE_PHOTO_NAME}"
SAMPLE_SEED_KEY = "sample_seeded_v2"


def _ensure_sample_photo() -> None:
    """Genera una imagen de muestra liviana si no existe en disco."""
    target = UPLOADS_DIR / SAMPLE_PHOTO_NAME
    if target.exists():
        return
    img = Image.new("RGB", (640, 420), color=(30, 41, 59))
    draw = ImageDraw.Draw(img)
    draw.rectangle([30, 30, 610, 390], outline=(96, 165, 250), width=4)
    draw.rectangle([80, 110, 560, 310], fill=(51, 65, 85), outline=(148, 163, 184), width=2)
    draw.line([140, 150, 490, 260], fill=(239, 68, 68), width=6)
    draw.text((195, 65), "EJEMPLO DE MUESTRA - NO REAL", fill=(250, 204, 21))
    draw.text((170, 335), "Referencia visual de tarjeta de reporte", fill=(203, 213, 225))
    img.save(target, format="JPEG", quality=85)


def _migrate_sqlite_schema(db: Session) -> None:
    """Migra bases SQLite previas de forma segura sin perder tablas ni sectores."""
    # 1. Columnas nuevas en modelos_mueble
    cols_modelos = {
        row[1] for row in db.execute(text("PRAGMA table_info(modelos_mueble)")).fetchall()
    }
    if "categoria_id" not in cols_modelos:
        db.execute(text("ALTER TABLE modelos_mueble ADD COLUMN categoria_id INTEGER REFERENCES categorias_mueble(id)"))
    if "es_ejemplo" not in cols_modelos:
        db.execute(text("ALTER TABLE modelos_mueble ADD COLUMN es_ejemplo INTEGER NOT NULL DEFAULT 0"))

    # 2. Revisar reportes_calidad (modelo_id nullable + modelo_manual + es_ejemplo)
    info_reportes = db.execute(text("PRAGMA table_info(reportes_calidad)")).fetchall()
    cols_reportes = {row[1]: row for row in info_reportes}
    modelo_col = cols_reportes.get("modelo_id")
    modelo_notnull = bool(modelo_col and modelo_col[3] == 1)

    if modelo_notnull or "modelo_manual" not in cols_reportes or "es_ejemplo" not in cols_reportes:
        has_manual = "modelo_manual" in cols_reportes
        has_ejemplo = "es_ejemplo" in cols_reportes
        manual_sel = "modelo_manual" if has_manual else "NULL"
        ejemplo_sel = "es_ejemplo" if has_ejemplo else "0"

        db.execute(text("PRAGMA foreign_keys=OFF"))
        db.execute(text("""
            CREATE TABLE reportes_calidad_new (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                client_uuid VARCHAR(64) NOT NULL UNIQUE,
                modelo_id INTEGER NULL REFERENCES modelos_mueble(id),
                modelo_manual VARCHAR(150) NULL,
                sector_id INTEGER NOT NULL REFERENCES sectores(id),
                descripcion_defecto TEXT NOT NULL,
                cantidad_afectada VARCHAR(100) NOT NULL,
                foto_path VARCHAR(255) NOT NULL,
                fecha_captura_local VARCHAR(30) NOT NULL,
                fecha_sincronizacion VARCHAR(30) NOT NULL,
                es_ejemplo INTEGER NOT NULL DEFAULT 0 CHECK (es_ejemplo IN (0, 1))
            )
        """))
        db.execute(text(f"""
            INSERT INTO reportes_calidad_new (
                id, client_uuid, modelo_id, modelo_manual, sector_id,
                descripcion_defecto, cantidad_afectada, foto_path,
                fecha_captura_local, fecha_sincronizacion, es_ejemplo
            )
            SELECT
                id, client_uuid, modelo_id, {manual_sel}, sector_id,
                descripcion_defecto, cantidad_afectada, foto_path,
                fecha_captura_local, fecha_sincronizacion, {ejemplo_sel}
            FROM reportes_calidad
        """))
        db.execute(text("DROP TABLE reportes_calidad"))
        db.execute(text("ALTER TABLE reportes_calidad_new RENAME TO reportes_calidad"))
        db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_reportes_calidad_client_uuid ON reportes_calidad (client_uuid)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_reportes_calidad_modelo_id ON reportes_calidad (modelo_id)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_reportes_calidad_sector_id ON reportes_calidad (sector_id)"))
        db.execute(text("PRAGMA foreign_keys=ON"))

    db.commit()


def init_db(db: Session) -> None:
    """Crea las tablas en SQLite, aplica migraciones seguras y puebla datos base."""
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite_schema(db)

    now_str = get_arg_now_str()

    # 1. Poblar sectores requeridos
    if db.query(Sector).count() == 0:
        for nombre in SECTORES_INICIALES:
            db.add(Sector(nombre=nombre, activo=1, created_at=now_str, updated_at=now_str))
        db.commit()

    # 2. Poblar 1 categoría + 1 modelo + 1 reporte de ejemplo (una sola vez, excluidos de datos reales)
    already_seeded = (
        db.query(ConfiguracionSeguridad)
        .filter(ConfiguracionSeguridad.clave == SAMPLE_SEED_KEY)
        .first()
    )
    if not already_seeded:
        _ensure_sample_photo()

        cat_ejemplo = (
            db.query(CategoriaMueble)
            .filter(CategoriaMueble.nombre == "Ejemplo (Muestra)")
            .first()
        )
        if not cat_ejemplo:
            cat_ejemplo = CategoriaMueble(
                nombre="Ejemplo (Muestra)",
                es_ejemplo=1,
                activo=1,
                created_at=now_str,
                updated_at=now_str,
            )
            db.add(cat_ejemplo)
            db.flush()

        mod_ejemplo = (
            db.query(ModeloMueble)
            .filter(ModeloMueble.nombre == "Modelo de Muestra (Ejemplo)")
            .first()
        )
        if not mod_ejemplo:
            mod_ejemplo = ModeloMueble(
                categoria_id=cat_ejemplo.id,
                nombre="Modelo de Muestra (Ejemplo)",
                codigo="EJ-01",
                descripcion="Así se carga un mueble con su categoría y código. Excluido de métricas y del celular.",
                es_ejemplo=1,
                activo=1,
                created_at=now_str,
                updated_at=now_str,
            )
            db.add(mod_ejemplo)
            db.flush()

        sector_muestra = db.query(Sector).order_by(Sector.id.asc()).first()
        if sector_muestra and db.query(ReporteCalidad).filter(ReporteCalidad.client_uuid == "ejemplo-muestra-0001").first() is None:
            db.add(
                ReporteCalidad(
                    client_uuid="ejemplo-muestra-0001",
                    modelo_id=mod_ejemplo.id,
                    modelo_manual=None,
                    sector_id=sector_muestra.id,
                    descripcion_defecto="Ejemplo visual de defecto reportado. Este registro de muestra nunca suma en el Dashboard ni en Excel.",
                    cantidad_afectada="1 pieza (Muestra)",
                    foto_path=SAMPLE_PHOTO_URL,
                    fecha_captura_local=now_str,
                    fecha_sincronizacion=now_str,
                    es_ejemplo=1,
                )
            )

        db.add(ConfiguracionSeguridad(clave=SAMPLE_SEED_KEY, valor="1", updated_at=now_str))
        db.commit()
