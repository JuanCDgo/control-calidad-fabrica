from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile, status
from app.models.entities import ReporteCalidad, Sector, ModeloMueble
from app.services.storage_service import save_uploaded_photo
from app.core.timezone import get_arg_now_str


def registrar_reporte_idempotente(
    db: Session,
    client_uuid: str,
    modelo_id: Optional[int],
    modelo_manual: Optional[str],
    sector_id: int,
    descripcion_defecto: str,
    cantidad_afectada: str,
    fecha_captura_local: str,
    foto_file: UploadFile,
    foto_bytes: bytes
) -> tuple[ReporteCalidad, bool]:
    """
    Registra un reporte de forma idempotente.
    Permite seleccionar un modelo oficial (modelo_id) o indicar un prototipo manual (modelo_manual).
    """
    # 1. Comprobar si ya existe por client_uuid (Idempotencia de red)
    reporte_existente = db.query(ReporteCalidad).filter(
        ReporteCalidad.client_uuid == client_uuid
    ).first()

    if reporte_existente:
        return reporte_existente, False

    # 2. Validar sector
    sector = db.query(Sector).filter(Sector.id == sector_id).first()
    if not sector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El sector con ID {sector_id} no existe en la base de datos."
        )

    # 3. Validar modelo oficial o prototipo manual
    modelo_manual_limpio = modelo_manual.strip() if modelo_manual else None
    if modelo_id is not None:
        modelo = db.query(ModeloMueble).filter(ModeloMueble.id == modelo_id).first()
        if not modelo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El modelo de mueble con ID {modelo_id} no existe en la base de datos."
            )
        modelo_manual_limpio = None
    elif not modelo_manual_limpio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes seleccionar un modelo de la lista o ingresar el nombre del prototipo."
        )

    # 4. Guardar foto de forma segura
    foto_rel_path = save_uploaded_photo(foto_file, foto_bytes)

    # 5. Crear registro en SQLite con timestamps GMT-3
    ahora_sync = get_arg_now_str()
    nuevo_reporte = ReporteCalidad(
        client_uuid=client_uuid,
        modelo_id=modelo_id,
        modelo_manual=modelo_manual_limpio,
        sector_id=sector_id,
        descripcion_defecto=descripcion_defecto.strip(),
        cantidad_afectada=cantidad_afectada.strip(),
        foto_path=foto_rel_path,
        fecha_captura_local=fecha_captura_local or ahora_sync,
        fecha_sincronizacion=ahora_sync,
        es_ejemplo=0,
    )

    db.add(nuevo_reporte)
    db.commit()
    db.refresh(nuevo_reporte)

    return nuevo_reporte, True
