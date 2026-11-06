from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile, status
from app.models.entities import ReporteCalidad, Sector, ModeloMueble
from app.services.storage_service import save_uploaded_photo
from app.core.timezone import get_arg_now_str

def registrar_reporte_idempotente(
    db: Session,
    client_uuid: str,
    modelo_id: int,
    sector_id: int,
    descripcion_defecto: str,
    cantidad_afectada: str,
    fecha_captura_local: str,
    foto_file: UploadFile,
    foto_bytes: bytes
) -> tuple[ReporteCalidad, bool]:
    """
    Registra un reporte de forma idempotente.
    Retorna una tupla: (reporte, es_nuevo: bool).
    Si ya existía el client_uuid, no duplica el registro ni guarda fotos redundantes.
    """
    # 1. Comprobar si ya existe por client_uuid (Idempotencia de red)
    reporte_existente = db.query(ReporteCalidad).filter(
        ReporteCalidad.client_uuid == client_uuid
    ).first()

    if reporte_existente:
        return reporte_existente, False

    # 2. Validar que el sector y modelo existan en la BD
    sector = db.query(Sector).filter(Sector.id == sector_id).first()
    if not sector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El sector con ID {sector_id} no existe en la base de datos."
        )

    modelo = db.query(ModeloMueble).filter(ModeloMueble.id == modelo_id).first()
    if not modelo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El modelo de mueble con ID {modelo_id} no existe en la base de datos."
        )

    # 3. Guardar foto de forma segura
    foto_rel_path = save_uploaded_photo(foto_file, foto_bytes)

    # 4. Crear registro en SQLite con timestamps GMT-3
    ahora_sync = get_arg_now_str()
    nuevo_reporte = ReporteCalidad(
        client_uuid=client_uuid,
        modelo_id=modelo_id,
        sector_id=sector_id,
        descripcion_defecto=descripcion_defecto.strip(),
        cantidad_afectada=cantidad_afectada.strip(),
        foto_path=foto_rel_path,
        fecha_captura_local=fecha_captura_local or ahora_sync,
        fecha_sincronizacion=ahora_sync
    )

    db.add(nuevo_reporte)
    db.commit()
    db.refresh(nuevo_reporte)

    return nuevo_reporte, True
