from PIL import Image, ImageDraw
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import UPLOADS_DIR
from app.core.database import engine, Base
from app.core.timezone import get_arg_now_str
from app.core.seed_catalog import (
    SECTORES_PLANTILLA,
    TIPOS_PROBLEMA_INICIALES,
    ENCARGADOS_INICIALES,
    CATALOGO_PRODUCTOS_VIGENTES,
)
from app.models.entities import (
    Sector,
    Encargado,
    TipoProblema,
    CategoriaMueble,
    ModeloMueble,
    ReporteCalidad,
    ConfiguracionSeguridad,
)

SAMPLE_PHOTO_NAME = "ejemplo_muestra.jpg"
SAMPLE_PHOTO_URL = f"/uploads/{SAMPLE_PHOTO_NAME}"
SAMPLE_SEED_KEY = "sample_seeded_v2"
CATALOG_V12_SEED_KEY = "catalogo_vigente_v12_seeded"


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
    """Migra bases SQLite previas de forma segura sin perder tablas ni reportes."""
    cols_modelos = {
        row[1] for row in db.execute(text("PRAGMA table_info(modelos_mueble)")).fetchall()
    }
    if "categoria_id" not in cols_modelos:
        db.execute(text("ALTER TABLE modelos_mueble ADD COLUMN categoria_id INTEGER REFERENCES categorias_mueble(id)"))
    if "es_ejemplo" not in cols_modelos:
        db.execute(text("ALTER TABLE modelos_mueble ADD COLUMN es_ejemplo INTEGER NOT NULL DEFAULT 0"))

    info_reportes = db.execute(text("PRAGMA table_info(reportes_calidad)")).fetchall()
    cols_reportes = {row[1]: row for row in info_reportes}

    expected_new_cols = {
        "encargado_id",
        "tipo_problema_id",
        "impacto",
        "detalle_pieza",
        "accion_inmediata",
        "estado",
        "exportado_excel",
        "exportado_archivo",
        "exportado_at",
    }
    modelo_col = cols_reportes.get("modelo_id")
    foto_col = cols_reportes.get("foto_path")
    needs_rebuild = (
        bool(modelo_col and modelo_col[3] == 1)
        or bool(foto_col and foto_col[3] == 1)
        or "modelo_manual" not in cols_reportes
        or "es_ejemplo" not in cols_reportes
        or not expected_new_cols.issubset(cols_reportes.keys())
    )

    if needs_rebuild:
        def sel(col_name: str, default_sql: str) -> str:
            return col_name if col_name in cols_reportes else default_sql

        db.execute(text("PRAGMA foreign_keys=OFF"))
        db.execute(text("""
            CREATE TABLE reportes_calidad_new (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                client_uuid VARCHAR(64) NOT NULL UNIQUE,
                encargado_id INTEGER NULL REFERENCES encargados(id),
                tipo_problema_id INTEGER NULL REFERENCES tipos_problema(id),
                impacto VARCHAR(30) NOT NULL DEFAULT 'DEFECTO',
                modelo_id INTEGER NULL REFERENCES modelos_mueble(id),
                modelo_manual VARCHAR(150) NULL,
                detalle_pieza VARCHAR(200) NULL,
                sector_id INTEGER NOT NULL REFERENCES sectores(id),
                descripcion_defecto TEXT NOT NULL,
                cantidad_afectada VARCHAR(100) NOT NULL,
                accion_inmediata TEXT NULL,
                estado VARCHAR(30) NOT NULL DEFAULT 'Abierto',
                foto_path VARCHAR(255) NULL,
                fecha_captura_local VARCHAR(30) NOT NULL,
                fecha_sincronizacion VARCHAR(30) NOT NULL,
                es_ejemplo INTEGER NOT NULL DEFAULT 0 CHECK (es_ejemplo IN (0, 1)),
                exportado_excel INTEGER NOT NULL DEFAULT 0 CHECK (exportado_excel IN (0, 1)),
                exportado_archivo VARCHAR(180) NULL,
                exportado_at VARCHAR(30) NULL
            )
        """))
        db.execute(text(f"""
            INSERT INTO reportes_calidad_new (
                id, client_uuid, encargado_id, tipo_problema_id, impacto,
                modelo_id, modelo_manual, detalle_pieza, sector_id,
                descripcion_defecto, cantidad_afectada, accion_inmediata, estado,
                foto_path, fecha_captura_local, fecha_sincronizacion, es_ejemplo,
                exportado_excel, exportado_archivo, exportado_at
            )
            SELECT
                id,
                client_uuid,
                {sel("encargado_id", "NULL")},
                {sel("tipo_problema_id", "NULL")},
                {sel("impacto", "'DEFECTO'")},
                modelo_id,
                {sel("modelo_manual", "NULL")},
                {sel("detalle_pieza", "NULL")},
                sector_id,
                descripcion_defecto,
                cantidad_afectada,
                {sel("accion_inmediata", "NULL")},
                {sel("estado", "'Abierto'")},
                foto_path,
                fecha_captura_local,
                fecha_sincronizacion,
                {sel("es_ejemplo", "0")},
                {sel("exportado_excel", "0")},
                {sel("exportado_archivo", "NULL")},
                {sel("exportado_at", "NULL")}
            FROM reportes_calidad
        """))
        db.execute(text("DROP TABLE reportes_calidad"))
        db.execute(text("ALTER TABLE reportes_calidad_new RENAME TO reportes_calidad"))
        db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_reportes_calidad_client_uuid ON reportes_calidad (client_uuid)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_reportes_calidad_encargado_id ON reportes_calidad (encargado_id)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_reportes_calidad_tipo_problema_id ON reportes_calidad (tipo_problema_id)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_reportes_calidad_modelo_id ON reportes_calidad (modelo_id)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_reportes_calidad_sector_id ON reportes_calidad (sector_id)"))
        db.execute(text("PRAGMA foreign_keys=ON"))

    db.commit()


def _seed_v12_catalogs(db: Session, now_str: str) -> None:
    """Precarga sectores de plantilla, encargados, tipos de problema y productos vigentes (una sola vez)."""
    if db.query(ConfiguracionSeguridad).filter(ConfiguracionSeguridad.clave == CATALOG_V12_SEED_KEY).first():
        return

    # 1. Sectores de la plantilla v1.1/v1.2
    sectores_existentes = {s.nombre.strip().lower() for s in db.query(Sector).all()}
    for nombre in SECTORES_PLANTILLA:
        if nombre.strip().lower() not in sectores_existentes:
            db.add(Sector(nombre=nombre, activo=1, created_at=now_str, updated_at=now_str))

    # 2. Encargados vinculados a planillas
    encargados_existentes = {e.nombre.strip().lower() for e in db.query(Encargado).all()}
    for enc in ENCARGADOS_INICIALES:
        if enc["nombre"].strip().lower() not in encargados_existentes:
            db.add(
                Encargado(
                    nombre=enc["nombre"],
                    sector_default=enc["sector_default"],
                    archivo_excel=enc["archivo_excel"],
                    activo=1,
                    created_at=now_str,
                    updated_at=now_str,
                )
            )

    # 3. Tipos de Problema (Categorías Pareto)
    tipos_existentes = {t.nombre.strip().lower() for t in db.query(TipoProblema).all()}
    for tipo_nom in TIPOS_PROBLEMA_INICIALES:
        if tipo_nom.strip().lower() not in tipos_existentes:
            db.add(TipoProblema(nombre=tipo_nom, activo=1, created_at=now_str, updated_at=now_str))

    db.flush()

    # 4. Categorías y 76 Productos Vigentes
    cats_map = {c.nombre.strip().lower(): c for c in db.query(CategoriaMueble).all()}
    mods_por_nombre = {m.nombre.strip().lower() for m in db.query(ModeloMueble).all()}
    mods_por_codigo = {m.codigo.strip().lower() for m in db.query(ModeloMueble).all() if m.codigo}

    for cat_nombre, productos in CATALOGO_PRODUCTOS_VIGENTES.items():
        cat_obj = cats_map.get(cat_nombre.strip().lower())
        if not cat_obj:
            cat_obj = CategoriaMueble(
                nombre=cat_nombre,
                es_ejemplo=0,
                activo=1,
                created_at=now_str,
                updated_at=now_str,
            )
            db.add(cat_obj)
            db.flush()
            cats_map[cat_nombre.strip().lower()] = cat_obj

        for prod in productos:
            nom_key = prod["nombre"].strip().lower()
            cod_key = (prod["codigo"] or "").strip().lower()
            if nom_key in mods_por_nombre or (cod_key and cod_key in mods_por_codigo):
                continue
            db.add(
                ModeloMueble(
                    categoria_id=cat_obj.id,
                    nombre=prod["nombre"],
                    codigo=prod["codigo"],
                    descripcion=prod.get("descripcion"),
                    es_ejemplo=0,
                    activo=1,
                    created_at=now_str,
                    updated_at=now_str,
                )
            )
            mods_por_nombre.add(nom_key)
            if cod_key:
                mods_por_codigo.add(cod_key)

    db.add(ConfiguracionSeguridad(clave=CATALOG_V12_SEED_KEY, valor="1", updated_at=now_str))
    db.commit()


def init_db(db: Session) -> None:
    """Crea las tablas en SQLite, aplica migraciones seguras y puebla catálogos base."""
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite_schema(db)

    now_str = get_arg_now_str()

    # 1. Poblar catálogos v1.2 (sectores, encargados, tipos de problema, 76 productos)
    _seed_v12_catalogs(db, now_str)

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
        encargado_muestra = db.query(Encargado).order_by(Encargado.id.asc()).first()
        tipo_muestra = db.query(TipoProblema).order_by(TipoProblema.id.asc()).first()

        if sector_muestra and db.query(ReporteCalidad).filter(ReporteCalidad.client_uuid == "ejemplo-muestra-0001").first() is None:
            db.add(
                ReporteCalidad(
                    client_uuid="ejemplo-muestra-0001",
                    encargado_id=encargado_muestra.id if encargado_muestra else None,
                    tipo_problema_id=tipo_muestra.id if tipo_muestra else None,
                    impacto="DEFECTO",
                    modelo_id=mod_ejemplo.id,
                    modelo_manual=None,
                    detalle_pieza="Pieza de muestra (No real)",
                    sector_id=sector_muestra.id,
                    descripcion_defecto="Ejemplo visual de problema reportado. Este registro de muestra nunca suma en el Dashboard ni en Excel.",
                    cantidad_afectada="1 pieza (Muestra)",
                    accion_inmediata="Registro de muestra",
                    estado="Abierto",
                    foto_path=SAMPLE_PHOTO_URL,
                    fecha_captura_local=now_str,
                    fecha_sincronizacion=now_str,
                    es_ejemplo=1,
                    exportado_excel=0,
                )
            )

        db.add(ConfiguracionSeguridad(clave=SAMPLE_SEED_KEY, valor="1", updated_at=now_str))
        db.commit()
